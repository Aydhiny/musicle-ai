using AiAgents.MusicAgent.Application.Services; // Use new interface
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Enums;
using AiAgents.MusicAgent.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiAgents.MusicAgent.Application.Services
{
    public class QueueService : IQueueService
    {
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<QueueService> _logger;

        public QueueService(
            MusicAgentDbContext db,
            ILogger<QueueService> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task<Track?> DequeueNextAsync(CancellationToken ct = default)
        {
            var track = await _db.Tracks
                .Where(t => t.Status == AnalysisStatus.Queued)
                .OrderBy(t => t.UploadedAt)
                .FirstOrDefaultAsync(ct);

            if (track != null)
            {
                track.Status = AnalysisStatus.Processing;
                await _db.SaveChangesAsync(ct);
            }

            return track;
        }

        public async Task UpdateStatusAsync(Guid trackId, AnalysisStatus status, CancellationToken ct = default)
        {
            var track = await _db.Tracks.FindAsync(new object[] { trackId }, ct);
            if (track != null)
            {
                track.Status = status;
                await _db.SaveChangesAsync(ct);
            }
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
                .ToListAsync(ct);
        }

        public async Task ReclaimStalledTracksAsync(TimeSpan timeout, CancellationToken ct = default)
        {
            var cutoff = DateTime.UtcNow - timeout;

            var stalledTracks = await _db.Tracks
                .Where(t => t.Status == AnalysisStatus.Processing
                         && t.ClaimedAt < cutoff)
                .ToListAsync(ct);

            if (stalledTracks.Any())
            {
                _logger.LogWarning("Reclaiming {Count} stalled tracks", stalledTracks.Count);

                foreach (var track in stalledTracks)
                {
                    track.Status = AnalysisStatus.Queued;
                    track.ClaimedAt = null;
                    track.ClaimedByWorker = null;
                }

                await _db.SaveChangesAsync(ct);
            }
        }
    }
}