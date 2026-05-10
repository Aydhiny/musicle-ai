using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Enums;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IQueueService
    {
        Task<Track?> DequeueNextAsync(CancellationToken ct);
        Task UpdateStatusAsync(Guid trackId, AnalysisStatus status, CancellationToken ct);
        Task<bool> HasQueuedTracksAsync(CancellationToken ct);
    }
}
