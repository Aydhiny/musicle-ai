// AiAgents.MusicAgent.Web/Controllers/AnalysisController.cs - FIXED VERSION
using AiAgents.MusicAgent.Application.Services;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Enums;
using AiAgents.MusicAgent.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AiAgents.Shared.Dtos;

namespace AiAgents.MusicAgent.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalysisController : ControllerBase
    {
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<AnalysisController> _logger;

        public AnalysisController(MusicAgentDbContext db, ILogger<AnalysisController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpPost("upload")]
        [RequestSizeLimit(52428800)] // 50MB
        public async Task<IActionResult> Upload([FromForm] IFormFile file, CancellationToken ct)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file provided" });

            if (!file.ContentType.StartsWith("audio/"))
                return BadRequest(new { error = "Only audio files allowed" });

            if (file.Length > 50 * 1024 * 1024)
                return BadRequest(new { error = "File too large. Max 50MB." });

            try
            {
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms, ct);

                var track = new Track
                {
                    Id = Guid.NewGuid(),
                    FileName = file.FileName,
                    AudioData = ms.ToArray(),
                    UploadedAt = DateTime.UtcNow,
                    Status = AnalysisStatus.Queued
                };

                _db.Tracks.Add(track);
                await _db.SaveChangesAsync(ct);

                _logger.LogInformation("Track {TrackId} uploaded: {FileName}", track.Id, track.FileName);

                return Ok(new
                {
                    trackId = track.Id,
                    fileName = track.FileName,
                    status = "Queued",
                    uploadedAt = track.UploadedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading track");
                return StatusCode(500, new { error = "Error uploading file" });
            }
        }

        /// <summary>
        /// FIXED: Now returns analysisId for feedback submission
        /// </summary>
        [HttpGet("{trackId}")]
        public async Task<IActionResult> GetAnalysis(Guid trackId, CancellationToken ct)
        {
            var track = await _db.Tracks
                .Include(t => t.Analysis)
                .FirstOrDefaultAsync(t => t.Id == trackId, ct);

            if (track == null)
                return NotFound(new { error = "Track not found" });

            // Still processing or failed
            if (track.Analysis == null)
            {
                return Ok(new
                {
                    trackId = track.Id,
                    fileName = track.FileName,
                    status = track.Status.ToString(),
                    uploadedAt = track.UploadedAt,
                    audioUrl = $"/api/analysis/{track.Id}/audio",
                    analysisId = (Guid?)null // ? Include null analysisId
                });
            }

            // Parse JSON fields
            Characteristics? characteristics = null;
            List<string>? strengths = null;
            List<string>? improvements = null;

            try
            {
                if (!string.IsNullOrEmpty(track.Analysis.CharacteristicsJson))
                    characteristics = JsonSerializer.Deserialize<Characteristics>(track.Analysis.CharacteristicsJson);

                if (!string.IsNullOrEmpty(track.Analysis.StrengthsJson))
                    strengths = JsonSerializer.Deserialize<List<string>>(track.Analysis.StrengthsJson);

                if (!string.IsNullOrEmpty(track.Analysis.ImprovementsJson))
                    improvements = JsonSerializer.Deserialize<List<string>>(track.Analysis.ImprovementsJson);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error parsing JSON for track {TrackId}", trackId);
            }

            // Parse genre probabilities if stored
            Dictionary<string, float>? genreProbabilities = null;
            try
            {
                if (!string.IsNullOrEmpty(track.Analysis.GenreProbabilitiesJson))
                    genreProbabilities = System.Text.Json.JsonSerializer
                        .Deserialize<Dictionary<string, float>>(track.Analysis.GenreProbabilitiesJson);
            }
            catch { /* non-critical */ }

            // Return full analysis with analysisId
            return Ok(new
            {
                trackId    = track.Id,
                analysisId = track.Analysis.Id,
                fileName   = track.FileName,
                status     = track.Status.ToString(),
                uploadedAt = track.UploadedAt,
                audioUrl   = $"/api/analysis/{track.Id}/audio",
                analysis   = new
                {
                    id              = track.Analysis.Id,
                    genre           = track.Analysis.Genre,
                    subgenre        = track.Analysis.Subgenre,
                    confidence      = track.Analysis.Confidence,
                    commercialScore = track.Analysis.CommercialScore,
                    productionScore = track.Analysis.ProductionScore,
                    viralPotential  = track.Analysis.ViralPotential,
                    characteristics = characteristics,
                    strengths       = strengths ?? new List<string>(),
                    improvements    = improvements ?? new List<string>(),
                    genreProbabilities = genreProbabilities,
                    analyzedAt      = track.Analysis.AnalyzedAt
                }
            });
        }

        [AllowAnonymous]
        [HttpGet("{trackId:guid}/audio")]
        public async Task<IActionResult> GetAudio(Guid trackId, CancellationToken ct)
        {
            var track = await _db.Tracks
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == trackId, ct);

            if (track == null)
            {
                return NotFound(new { error = "Track not found" });
            }

            if (track.AudioData.Length == 0)
            {
                return NotFound(new { error = "Audio not available" });
            }

            var contentType = ResolveContentType(track.FileName);
            return File(track.AudioData, contentType, track.FileName);
        }

        [HttpGet("recent")]
        public async Task<IActionResult> GetRecent([FromQuery] int count = 10, CancellationToken ct = default)
        {
            var tracks = await _db.Tracks
                .Include(t => t.Analysis)
                .OrderByDescending(t => t.UploadedAt)
                .Take(Math.Min(count, 50))
                .Select(t => new
                {
                    trackId = t.Id,
                    analysisId = t.Analysis != null ? t.Analysis.Id : (Guid?)null, // ? Include analysisId
                    fileName = t.FileName,
                    status = t.Status.ToString(),
                    uploadedAt = t.UploadedAt,
                    genre = t.Analysis != null ? t.Analysis.Genre : null,
                    subgenre = t.Analysis != null ? t.Analysis.Subgenre : null,
                    confidence = t.Analysis != null ? t.Analysis.Confidence : (int?)null
                })
                .ToListAsync(ct);

            return Ok(new { tracks, count = tracks.Count });
        }

        [AllowAnonymous]
        [HttpGet("{trackId:guid}/comments")]
        public async Task<IActionResult> GetWaveformComments(Guid trackId, CancellationToken ct)
        {
            var exists = await _db.Tracks.AnyAsync(t => t.Id == trackId, ct);
            if (!exists)
            {
                return NotFound(new { error = "Track not found" });
            }

            var comments = await _db.WaveformComments
                .AsNoTracking()
                .Where(c => c.TrackId == trackId)
                .OrderBy(c => c.TimeSeconds)
                .ThenBy(c => c.CreatedAt)
                .Select(c => new WaveformCommentDto
                {
                    Id = c.Id,
                    TrackId = c.TrackId,
                    AuthorId = c.AuthorId,
                    AuthorUserName = c.Author.UserName,
                    TimeSeconds = c.TimeSeconds,
                    Content = c.Content,
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync(ct);

            return Ok(new { comments, count = comments.Count });
        }

        [Authorize]
        [HttpPost("{trackId:guid}/comments")]
        public async Task<IActionResult> AddWaveformComment(Guid trackId, [FromBody] CreateWaveformCommentDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            if (string.IsNullOrWhiteSpace(dto.Content))
            {
                return BadRequest(new { error = "Comment content is required." });
            }

            var trackExists = await _db.Tracks.AnyAsync(t => t.Id == trackId, ct);
            if (!trackExists)
            {
                return NotFound(new { error = "Track not found" });
            }

            var comment = new WaveformComment
            {
                Id = Guid.NewGuid(),
                TrackId = trackId,
                AuthorId = userId,
                TimeSeconds = Math.Max(0, dto.TimeSeconds),
                Content = dto.Content.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _db.WaveformComments.Add(comment);
            await _db.SaveChangesAsync(ct);

            var authorName = await _db.AppUsers
                .AsNoTracking()
                .Where(u => u.Id == comment.AuthorId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync(ct) ?? "User";

            return Ok(new WaveformCommentDto
            {
                Id = comment.Id,
                TrackId = comment.TrackId,
                AuthorId = comment.AuthorId,
                AuthorUserName = authorName,
                TimeSeconds = comment.TimeSeconds,
                Content = comment.Content,
                CreatedAt = comment.CreatedAt
            });
        }

        [Authorize]
        [HttpPost("{trackId:guid}/revision")]
        public async Task<IActionResult> CreateRevision(Guid trackId, [FromBody] CreateTrackRevisionDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out _))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            if (trackId == dto.PreviousTrackId)
            {
                return BadRequest(new { error = "Track cannot be its own previous revision." });
            }

            var exists = await _db.Tracks
                .AsNoTracking()
                .CountAsync(t => t.Id == trackId || t.Id == dto.PreviousTrackId, ct);

            if (exists != 2)
            {
                return NotFound(new { error = "One or more tracks not found." });
            }

            var existing = await _db.TrackRevisions.FirstOrDefaultAsync(r => r.TrackId == trackId, ct);
            if (existing is null)
            {
                _db.TrackRevisions.Add(new TrackRevision
                {
                    Id = Guid.NewGuid(),
                    TrackId = trackId,
                    PreviousTrackId = dto.PreviousTrackId,
                    Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.PreviousTrackId = dto.PreviousTrackId;
                existing.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
                existing.CreatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);
            var timeline = await BuildTimelineAsync(trackId, ct);
            return Ok(new { timeline });
        }

        [AllowAnonymous]
        [HttpGet("{trackId:guid}/timeline")]
        public async Task<IActionResult> GetTimeline(Guid trackId, CancellationToken ct)
        {
            var exists = await _db.Tracks.AnyAsync(t => t.Id == trackId, ct);
            if (!exists)
            {
                return NotFound(new { error = "Track not found" });
            }

            var timeline = await BuildTimelineAsync(trackId, ct);
            return Ok(new { timeline });
        }

        [HttpDelete("{trackId}")]
        public async Task<IActionResult> DeleteTrack(Guid trackId, CancellationToken ct)
        {
            var track = await _db.Tracks.FindAsync(new object[] { trackId }, ct);

            if (track == null)
                return NotFound(new { error = "Track not found" });

            _db.Tracks.Remove(track);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("Track {TrackId} deleted", trackId);

            return NoContent();
        }

        private static string ResolveContentType(string fileName)
        {
            var ext = Path.GetExtension(fileName)?.ToLowerInvariant() ?? string.Empty;
            return ext switch
            {
                ".wav" => "audio/wav",
                ".wave" => "audio/wav",
                ".mp3" => "audio/mpeg",
                ".ogg" => "audio/ogg",
                ".flac" => "audio/flac",
                ".m4a" => "audio/mp4",
                _ => "application/octet-stream"
            };
        }

        private async Task<IReadOnlyList<TrackRevisionDto>> BuildTimelineAsync(Guid trackId, CancellationToken ct)
        {
            var revisions = await _db.TrackRevisions
                .AsNoTracking()
                .ToListAsync(ct);

            var timeline = new List<Guid> { trackId };
            var current = trackId;

            while (true)
            {
                var match = revisions.FirstOrDefault(r => r.TrackId == current);
                if (match == null)
                {
                    break;
                }
                timeline.Add(match.PreviousTrackId);
                current = match.PreviousTrackId;
            }

            var notesByTrack = revisions.ToDictionary(r => r.TrackId, r => r.Note);

            var rows = await _db.Tracks
                .AsNoTracking()
                .Include(t => t.Analysis)
                .Where(t => timeline.Contains(t.Id))
                .Select(t => new TrackRevisionDto
                {
                    TrackId = t.Id,
                    TrackName = t.FileName,
                    AnalysisId = t.Analysis != null ? t.Analysis.Id : (Guid?)null,
                    Genre = t.Analysis != null ? t.Analysis.Genre : null,
                    Subgenre = t.Analysis != null ? t.Analysis.Subgenre : null,
                    Confidence = t.Analysis != null ? t.Analysis.Confidence : (int?)null,
                    UploadedAt = t.UploadedAt,
                    Note = notesByTrack.ContainsKey(t.Id) ? notesByTrack[t.Id] : null
                })
                .ToListAsync(ct);

            return timeline
                .Select(id => rows.FirstOrDefault(r => r.TrackId == id))
                .Where(r => r != null)
                .Cast<TrackRevisionDto>()
                .ToList();
        }

        private bool TryGetCurrentUserId(out Guid userId)
        {
            var id = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(id, out userId);
        }
    }

    // DTO classes (move to separate file if needed)
    public class Characteristics
    {
        public double Tempo { get; set; }
        public double Energy { get; set; }
        public double Danceability { get; set; }
        public double Valence { get; set; }
        public double Acousticness { get; set; }
        public double Loudness { get; set; }
        public double Speechiness { get; set; }
        public double Instrumentalness { get; set; }
        public double SpectralCentroid { get; set; }
        public double DynamicRange { get; set; }
    }
}
