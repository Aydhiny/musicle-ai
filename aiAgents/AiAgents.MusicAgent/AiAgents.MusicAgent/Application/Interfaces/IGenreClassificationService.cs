using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IGenreClassificationService
    {
        Task<GenreDecision> ClassifyAsync(Characteristics chars, CancellationToken ct);
    }
}
