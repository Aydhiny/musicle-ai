using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IAudioFeatureExtractor
    {
        Task<Characteristics> ExtractFeaturesAsync(byte[] audioData, string fileName);
    }
}
