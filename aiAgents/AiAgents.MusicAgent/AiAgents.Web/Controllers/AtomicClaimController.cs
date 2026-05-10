using AiAgents.MusicAgent.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.MusicAgent.Web.Controllers
{
    /// <summary>
    /// API controller for demonstrating and testing atomic claim mechanism
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AtomicClaimController : ControllerBase
    {
        private readonly AtomicClaimDemonstrationService _demo;
        private readonly IQueueService _queueService;
        private readonly ILogger<AtomicClaimController> _logger;

        public AtomicClaimController(
            AtomicClaimDemonstrationService demo,
            IQueueService queueService,
            ILogger<AtomicClaimController> logger)
        {
            _demo = demo;
            _queueService = queueService;
            _logger = logger;
        }

        /// <summary>
        /// Demonstrate atomic claim with multiple simulated workers
        /// Shows that each track is claimed exactly once, no duplicates
        /// </summary>
        /// <param name="workers">Number of concurrent workers to simulate (default: 5)</param>
        /// <param name="tracks">Number of test tracks to create (default: 10)</param>
        [HttpPost("demonstrate")]
        public async Task<IActionResult> Demonstrate(
            [FromQuery] int workers = 5,
            [FromQuery] int tracks = 10,
            CancellationToken ct = default)
        {
            try
            {
                if (workers < 1 || workers > 20)
                    return BadRequest(new { error = "Workers must be between 1 and 20" });

                if (tracks < 1 || tracks > 100)
                    return BadRequest(new { error = "Tracks must be between 1 and 100" });

                _logger.LogInformation(
                    "🎯 Atomic claim demonstration requested: {Workers} workers, {Tracks} tracks",
                    workers, tracks);

                var result = await _demo.DemonstrateAsync(workers, tracks, ct);

                return Ok(new
                {
                    success = result.Success,
                    configuration = new
                    {
                        workers = result.NumberOfWorkers,
                        tracks = result.NumberOfTracks
                    },
                    results = new
                    {
                        totalClaimed = result.TotalClaimed,
                        expectedClaims = result.ExpectedClaims,
                        duplicateClaims = result.DuplicateClaims,
                        claimRate = result.TotalClaimed / (double)result.ExpectedClaims
                    },
                    workerStats = result.WorkerResults.Select(w => new
                    {
                        workerId = w.WorkerId,
                        tracksClaimed = w.TracksClaimed,
                        durationMs = w.Duration.TotalMilliseconds,
                        success = w.Success
                    }),
                    conclusion = result.Success
                        ? $"✅ SUCCESS: {result.NumberOfWorkers} workers claimed {result.TotalClaimed} tracks with NO duplicates"
                        : $"❌ FAILURE: Found {result.DuplicateClaims} duplicate claims",
                    explanation = result.Success
                        ? "Atomic claim mechanism prevented race conditions. Each track was claimed by exactly one worker."
                        : "Atomic claim mechanism failed. Some tracks were claimed by multiple workers."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in atomic claim demonstration");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Show how race condition would occur WITHOUT atomic claim
        /// Educational endpoint to explain the problem
        /// </summary>
        [HttpGet("explain-race-condition")]
        public async Task<IActionResult> ExplainRaceCondition(CancellationToken ct)
        {
            try
            {
                var explanation = await _demo.SimulateRaceConditionAsync(ct);

                return Ok(new
                {
                    title = "Race Condition Explanation",
                    problem = "Without atomic claim, multiple workers can claim the same track",
                    scenario = explanation,
                    solution = "Atomic claim using database transactions ensures only one worker gets each track"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error explaining race condition");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Get current queue statistics
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats(CancellationToken ct)
        {
            try
            {
                var queueLength = await _queueService.GetQueueLengthAsync(ct);
                var processingTracks = await _queueService.GetProcessingTracksAsync(ct);

                return Ok(new
                {
                    queueLength,
                    processingCount = processingTracks.Count,
                    processingTracks = processingTracks.Select(t => new
                    {
                        t.Id,
                        t.FileName,
                        t.ClaimedByWorker,
                        t.ClaimedAt,
                        processingDuration = t.ClaimedAt.HasValue
                            ? (DateTime.UtcNow - t.ClaimedAt.Value).TotalMinutes
                            : 0
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting queue stats");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Manually trigger reclaim of stalled tracks
        /// Useful for testing or emergency recovery
        /// </summary>
        [HttpPost("reclaim-stalled")]
        public async Task<IActionResult> ReclaimStalled(
            [FromQuery] int timeoutMinutes = 30,
            CancellationToken ct = default)
        {
            try
            {
                if (timeoutMinutes < 1 || timeoutMinutes > 1440)
                    return BadRequest(new { error = "Timeout must be between 1 and 1440 minutes" });

                var timeout = TimeSpan.FromMinutes(timeoutMinutes);

                _logger.LogInformation(
                    "🔄 Manual reclaim requested with timeout: {Timeout} minutes",
                    timeoutMinutes);

                await _queueService.ReclaimStalledTracksAsync(timeout, ct);

                return Ok(new
                {
                    success = true,
                    message = $"Reclaimed tracks stalled for more than {timeoutMinutes} minutes",
                    timeout = timeout
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reclaiming stalled tracks");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}