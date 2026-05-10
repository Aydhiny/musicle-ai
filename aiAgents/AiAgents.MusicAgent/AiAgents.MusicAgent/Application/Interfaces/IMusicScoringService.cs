using AiAgents.MusicAgent.Application.Services;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IMusicScoringService
    {
        MusicScores CalculateScores(Characteristics characteristics, string genre, int confidence);
    }
}
