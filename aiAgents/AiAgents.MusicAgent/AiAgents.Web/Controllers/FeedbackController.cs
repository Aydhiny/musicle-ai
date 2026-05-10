using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    /// <summary>
    /// API for submitting user feedback/corrections
    /// This provides the LEARNING SIGNAL for the model
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class FeedbackController : ControllerBase
    {
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<FeedbackController> _logger;

        public FeedbackController(MusicAgentDbContext db, ILogger<FeedbackController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// Submit feedback/correction for an analysis
        /// This is the KEY method - user corrections become "gold" labels
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SubmitFeedback([FromBody] SubmitFeedbackDto dto, CancellationToken ct)
        {
            Guid? userId = TryGetCurrentUserId(out var currentUserId) ? currentUserId : (Guid?)null;

            // Validate analysis exists
            var analysis = await _db.Analyses
                .Include(a => a.Track)
                .FirstOrDefaultAsync(a => a.Id == dto.AnalysisId, ct);

            if (analysis == null)
                return NotFound(new { error = "Analysis not found" });

            // Create feedback record
            var feedback = new UserFeedback
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                AnalysisId = dto.AnalysisId,
                CorrectedGenre = dto.CorrectedGenre,
                CorrectedSubgenre = dto.CorrectedSubgenre,
                AccuracyRating = dto.AccuracyRating,
                CorrectedCommercialScore = dto.CorrectedCommercialScore,
                CorrectedProductionScore = dto.CorrectedProductionScore,
                CorrectedViralPotential = dto.CorrectedViralPotential,
                Notes = dto.Notes,
                SubmittedAt = DateTime.UtcNow,
                UsedInTraining = false // Will be set to true when incorporated
            };

            _db.Set<UserFeedback>().Add(feedback);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "💡 Feedback received for analysis {AnalysisId} - Original: {Original}, Corrected: {Corrected}",
                dto.AnalysisId,
                analysis.Genre,
                dto.CorrectedGenre ?? "(no correction)");

            // Log as a learning signal
            if (!string.IsNullOrEmpty(dto.CorrectedGenre) && dto.CorrectedGenre != analysis.Genre)
            {
                _logger.LogInformation(
                    "🎓 LEARNING SIGNAL: User corrected genre from '{Wrong}' to '{Right}' for track '{Track}'",
                    analysis.Genre, dto.CorrectedGenre, analysis.Track.FileName);
            }

            return Ok(new
            {
                feedbackId = feedback.Id,
                message = "Feedback recorded successfully. Will be used in next model training.",
                correctionCount = await _db.Set<UserFeedback>()
                    .CountAsync(f => !f.UsedInTraining, ct)
            });
        }

        /// <summary>
        /// Get feedback for a specific analysis
        /// </summary>
        [HttpGet("analysis/{analysisId}")]
        public async Task<IActionResult> GetFeedbackForAnalysis(Guid analysisId, CancellationToken ct)
        {
            var feedback = await _db.Set<UserFeedback>()
                .Where(f => f.AnalysisId == analysisId)
                .OrderByDescending(f => f.SubmittedAt)
                .Select(f => new
                {
                    f.Id,
                    f.CorrectedGenre,
                    f.CorrectedSubgenre,
                    f.AccuracyRating,
                    f.CorrectedCommercialScore,
                    f.CorrectedProductionScore,
                    f.CorrectedViralPotential,
                    f.Notes,
                    f.SubmittedAt,
                    f.UsedInTraining,
                    f.FirstUsedInModelVersion
                })
                .ToListAsync(ct);

            return Ok(new { feedback, count = feedback.Count });
        }

        /// <summary>
        /// Get all pending feedback (not yet used in training)
        /// </summary>
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingFeedback(CancellationToken ct)
        {
            var pending = await _db.Set<UserFeedback>()
                .Include(f => f.Analysis)
                    .ThenInclude(a => a.Track)
                .Where(f => !f.UsedInTraining)
                .OrderByDescending(f => f.SubmittedAt)
                .Select(f => new
                {
                    f.Id,
                    f.AnalysisId,
                    trackName = f.Analysis.Track.FileName,
                    originalGenre = f.Analysis.Genre,
                    f.CorrectedGenre,
                    f.AccuracyRating,
                    f.SubmittedAt
                })
                .ToListAsync(ct);

            return Ok(new
            {
                pendingFeedback = pending,
                count = pending.Count,
                message = $"{pending.Count} corrections ready for next training cycle"
            });
        }

        /// <summary>
        /// Get feedback statistics
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats(CancellationToken ct)
        {
            var totalFeedback = await _db.Set<UserFeedback>().CountAsync(ct);
            var usedInTraining = await _db.Set<UserFeedback>().CountAsync(f => f.UsedInTraining, ct);
            var pending = totalFeedback - usedInTraining;

            var avgRating = await _db.Set<UserFeedback>()
                .Where(f => f.AccuracyRating.HasValue)
                .AverageAsync(f => (double?)f.AccuracyRating, ct);

            var genreCorrections = await _db.Set<UserFeedback>()
                .Where(f => f.CorrectedGenre != null)
                .CountAsync(ct);

            return Ok(new
            {
                totalFeedback,
                usedInTraining,
                pending,
                averageAccuracyRating = avgRating,
                genreCorrections,
                learningRate = totalFeedback > 0 ? (double)usedInTraining / totalFeedback : 0
            });
        }

        private bool TryGetCurrentUserId(out Guid userId)
        {
            var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
            return Guid.TryParse(id, out userId);
        }
    }
}
