using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Enums;
using AiAgents.MusicAgent.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;

namespace AiAgents.MusicAgent.Application.Services
{
    /// <summary>
    /// IMPROVED: Queue service with ATOMIC CLAIM mechanism
    /// Prevents duplicate processing when multiple workers are running
    /// </summary>
    public class AtomicQueueService :
        AiAgents.MusicAgent.Application.Services.IQueueService,
        AiAgents.MusicAgent.Application.Interfaces.IQueueService
    {
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<AtomicQueueService> _logger;

        public AtomicQueueService(
            MusicAgentDbContext db,
            ILogger<AtomicQueueService> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task<Track?> DequeueNextAsync(CancellationToken ct = default)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.ReadCommitted, ct);

            try
            {
                var track = await _db.Tracks
                    .Where(t => t.Status == AnalysisStatus.Queued)
                    .OrderBy(t => t.UploadedAt)
                    .FirstOrDefaultAsync(ct);

                if (track == null)
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogDebug("No queued tracks available");
                    return null;
                }

                track.Status = AnalysisStatus.Processing;
                track.ClaimedAt = DateTime.UtcNow;
                track.ClaimedByWorker = Environment.MachineName;

                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                _logger.LogInformation(
                    "✅ CLAIMED track {TrackId} ({FileName}) - Worker: {Worker}",
                    track.Id, track.FileName, track.ClaimedByWorker);

                return track;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await transaction.RollbackAsync(ct);
                _logger.LogWarning(ex,
                    "Concurrency conflict - another worker claimed the track. Retrying...");
                return await DequeueNextAsync(ct);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                _logger.LogError(ex, "Error dequeuing track");
                throw;
            }
        }

        public async Task UpdateStatusAsync(
            Guid trackId,
            AnalysisStatus status,
            CancellationToken ct = default)
        {
            var track = await _db.Tracks.FindAsync(new object[] { trackId }, ct);

            if (track == null)
            {
                _logger.LogWarning("Track {TrackId} not found for status update", trackId);
                return;
            }

            var oldStatus = track.Status;
            track.Status = status;

            if (status == AnalysisStatus.Completed)
            {
                track.CompletedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Status updated for track {TrackId}: {OldStatus} → {NewStatus}",
                trackId, oldStatus, status);
        }

        public async Task<int> GetQueueLengthAsync(CancellationToken ct = default)
        {
            return await _db.Tracks
                .CountAsync(t => t.Status == AnalysisStatus.Queued, ct);
        }

        public async Task<List<Track>> GetProcessingTracksAsync(CancellationToken ct = default)
        {
            return await _db.Tracks
                .Where(t => t.Status == AnalysisStatus.Processing)
                .OrderBy(t => t.ClaimedAt)
                .ToListAsync(ct);
        }

        public async Task ReclaimStalledTracksAsync(
            TimeSpan timeout,
            CancellationToken ct = default)
        {
            var cutoff = DateTime.UtcNow - timeout;

            var stalledTracks = await _db.Tracks
                .Where(t => t.Status == AnalysisStatus.Processing
                         && t.ClaimedAt < cutoff)
                .ToListAsync(ct);

            if (stalledTracks.Any())
            {
                _logger.LogWarning(
                    "🔄 Found {Count} stalled tracks (claimed before {Cutoff}). Reclaiming...",
                    stalledTracks.Count, cutoff);

                foreach (var track in stalledTracks)
                {
                    _logger.LogWarning(
                        "Reclaiming stalled track {TrackId} ({FileName}) - Was claimed by {Worker} at {ClaimedAt}",
                        track.Id, track.FileName, track.ClaimedByWorker, track.ClaimedAt);

                    track.Status = AnalysisStatus.Queued;
                    track.ClaimedAt = null;
                    track.ClaimedByWorker = null;
                }

                await _db.SaveChangesAsync(ct);

                _logger.LogInformation(
                    "✅ Reclaimed {Count} stalled tracks",
                    stalledTracks.Count);
            }
        }

        // Implementation for old interface
        public async Task<bool> HasQueuedTracksAsync(CancellationToken ct = default)
        {
            var count = await GetQueueLengthAsync(ct);
            return count > 0;
        }
    }

    /// <summary>
    /// Interface for queue service
    /// </summary>
    public interface IQueueService
    {
        Task<Track?> DequeueNextAsync(CancellationToken ct = default);
        Task UpdateStatusAsync(Guid trackId, AnalysisStatus status, CancellationToken ct = default);
        Task<int> GetQueueLengthAsync(CancellationToken ct = default);
        Task<List<Track>> GetProcessingTracksAsync(CancellationToken ct = default);
        Task ReclaimStalledTracksAsync(TimeSpan timeout, CancellationToken ct = default);
    }
}