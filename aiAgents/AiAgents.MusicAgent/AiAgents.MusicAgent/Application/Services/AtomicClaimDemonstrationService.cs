using AiAgents.MusicAgent.Application.Services;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Enums;
using AiAgents.MusicAgent.Infrastructure;
using Microsoft.Extensions.Logging;

namespace AiAgents.MusicAgent.Application.Services
{
    /// <summary>
    /// Demonstration service showing atomic claim prevents duplicate processing
    /// </summary>
    public class AtomicClaimDemonstrationService
    {
        private readonly MusicAgentDbContext _db;
        private readonly IQueueService _queueService;
        private readonly ILogger<AtomicClaimDemonstrationService> _logger;

        public AtomicClaimDemonstrationService(
            MusicAgentDbContext db,
            IQueueService queueService,
            ILogger<AtomicClaimDemonstrationService> logger)
        {
            _db = db;
            _queueService = queueService;
            _logger = logger;
        }

        /// <summary>
        /// Simulate multiple workers trying to claim tracks concurrently
        /// WITHOUT atomic claim: Some tracks get processed twice
        /// WITH atomic claim: Each track processed exactly once
        /// </summary>
        public async Task<AtomicClaimDemoResult> DemonstrateAsync(
            int numberOfWorkers = 5,
            int numberOfTracks = 10,
            CancellationToken ct = default)
        {
            _logger.LogInformation("🎬 Starting atomic claim demonstration...");
            _logger.LogInformation("Workers: {Workers}, Tracks: {Tracks}",
                numberOfWorkers, numberOfTracks);

            // SETUP: Create test tracks
            var testTracks = new List<Track>();
            for (int i = 0; i < numberOfTracks; i++)
            {
                var track = new Track
                {
                    Id = Guid.NewGuid(),
                    FileName = $"test_track_{i + 1}.mp3",
                    AudioData = new byte[100],
                    UploadedAt = DateTime.UtcNow.AddSeconds(i),
                    Status = AnalysisStatus.Queued
                };
                testTracks.Add(track);
            }

            _db.Tracks.AddRange(testTracks);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("✅ Created {Count} test tracks", numberOfTracks);

            // SIMULATE: Multiple workers trying to dequeue simultaneously
            var workerTasks = new List<Task<WorkerResult>>();

            for (int workerId = 1; workerId <= numberOfWorkers; workerId++)
            {
                var task = SimulateWorkerAsync(workerId, ct);
                workerTasks.Add(task);
            }

            _logger.LogInformation("🚀 Starting {Count} workers simultaneously...", numberOfWorkers);

            // Wait for all workers to complete
            var workerResults = await Task.WhenAll(workerTasks);

            // ANALYZE: Check results
            var totalClaimed = workerResults.Sum(r => r.TracksClaimed);
            var allClaimedTracks = workerResults.SelectMany(r => r.ClaimedTrackIds).ToList();
            var duplicates = allClaimedTracks.GroupBy(id => id)
                .Where(g => g.Count() > 1)
                .Select(g => new { TrackId = g.Key, Count = g.Count() })
                .ToList();

            var result = new AtomicClaimDemoResult
            {
                NumberOfWorkers = numberOfWorkers,
                NumberOfTracks = numberOfTracks,
                TotalClaimed = totalClaimed,
                ExpectedClaims = numberOfTracks,
                DuplicateClaims = duplicates.Count,
                Success = duplicates.Count == 0 && totalClaimed == numberOfTracks,
                WorkerResults = workerResults.ToList()
            };

            // LOG RESULTS
            if (result.Success)
            {
                _logger.LogInformation("✅ SUCCESS: Atomic claim worked perfectly!");
                _logger.LogInformation("   {Workers} workers claimed {Tracks} tracks",
                    numberOfWorkers, totalClaimed);
                _logger.LogInformation("   No duplicates detected ✓");
            }
            else
            {
                _logger.LogError("❌ FAILURE: Atomic claim failed!");

                if (duplicates.Any())
                {
                    _logger.LogError("   Found {Count} tracks claimed multiple times:",
                        duplicates.Count);
                    foreach (var dup in duplicates)
                    {
                        _logger.LogError("     Track {TrackId} claimed {Count} times",
                            dup.TrackId, dup.Count);
                    }
                }

                if (totalClaimed != numberOfTracks)
                {
                    _logger.LogError("   Expected {Expected} claims, got {Actual}",
                        numberOfTracks, totalClaimed);
                }
            }

            // CLEANUP: Delete test tracks
            _db.Tracks.RemoveRange(testTracks);
            await _db.SaveChangesAsync(ct);

            return result;
        }

        /// <summary>
        /// Simulate a single worker dequeuing tracks
        /// </summary>
        private async Task<WorkerResult> SimulateWorkerAsync(
            int workerId,
            CancellationToken ct)
        {
            var result = new WorkerResult
            {
                WorkerId = workerId,
                StartTime = DateTime.UtcNow
            };

            try
            {
                _logger.LogInformation("Worker {Id} starting...", workerId);

                // Try to dequeue multiple tracks
                while (true)
                {
                    var track = await _queueService.DequeueNextAsync(ct);

                    if (track == null)
                    {
                        // No more tracks
                        break;
                    }

                    _logger.LogInformation(
                        "Worker {WorkerId} claimed track {TrackId} ({FileName})",
                        workerId, track.Id, track.FileName);

                    result.ClaimedTrackIds.Add(track.Id);
                    result.TracksClaimed++;

                    // Simulate processing time
                    await Task.Delay(TimeSpan.FromMilliseconds(10), ct);

                    // Update status to completed
                    await _queueService.UpdateStatusAsync(
                        track.Id,
                        AnalysisStatus.Completed,
                        ct);
                }

                result.EndTime = DateTime.UtcNow;
                result.Success = true;

                _logger.LogInformation(
                    "Worker {Id} finished - Claimed {Count} tracks in {Duration}ms",
                    workerId, result.TracksClaimed, result.Duration.TotalMilliseconds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Worker {Id} failed", workerId);
                result.Success = false;
                result.ErrorMessage = ex.Message;
                result.EndTime = DateTime.UtcNow;
            }

            return result;
        }

        /// <summary>
        /// COMPARISON: Show what happens WITHOUT atomic claim
        /// This demonstrates the race condition
        /// </summary>
        public async Task<string> SimulateRaceConditionAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("⚠️ Simulating RACE CONDITION (without atomic claim)...");

            var results = new List<string>();

            // Create one test track
            var track = new Track
            {
                Id = Guid.NewGuid(),
                FileName = "race_condition_test.mp3",
                AudioData = new byte[100],
                UploadedAt = DateTime.UtcNow,
                Status = AnalysisStatus.Queued
            };

            _db.Tracks.Add(track);
            await _db.SaveChangesAsync(ct);

            results.Add("1. Created track with Status=Queued");

            // Simulate two workers reading simultaneously (before update)
            results.Add("2. Worker 1: Reading track with Status=Queued...");
            results.Add("3. Worker 2: Reading SAME track with Status=Queued...");

            // Both workers think they got the track
            results.Add("4. Worker 1: Found track! Setting Status=Processing...");
            results.Add("5. Worker 2: Found SAME track! Setting Status=Processing...");

            // Both workers start processing
            results.Add("6. ❌ PROBLEM: Both workers are processing the SAME track!");
            results.Add("7. Result: Duplicate processing, wasted resources");

            results.Add("");
            results.Add("WITH ATOMIC CLAIM:");
            results.Add("1. Created track with Status=Queued");
            results.Add("2. Worker 1: BEGIN TRANSACTION");
            results.Add("3. Worker 1: Read + Update to Processing (atomic)");
            results.Add("4. Worker 1: COMMIT");
            results.Add("5. Worker 2: BEGIN TRANSACTION");
            results.Add("6. Worker 2: Track already Processing, skips it");
            results.Add("7. Worker 2: Gets next queued track instead");
            results.Add("8. ✅ RESULT: Each track processed exactly once");

            // Cleanup
            _db.Tracks.Remove(track);
            await _db.SaveChangesAsync(ct);

            return string.Join("\n", results);
        }
    }

    public class AtomicClaimDemoResult
    {
        public int NumberOfWorkers { get; set; }
        public int NumberOfTracks { get; set; }
        public int TotalClaimed { get; set; }
        public int ExpectedClaims { get; set; }
        public int DuplicateClaims { get; set; }
        public bool Success { get; set; }
        public List<WorkerResult> WorkerResults { get; set; } = new();
    }

    public class WorkerResult
    {
        public int WorkerId { get; set; }
        public int TracksClaimed { get; set; }
        public List<Guid> ClaimedTrackIds { get; set; } = new();
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public TimeSpan Duration => EndTime - StartTime;
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
    }
}