using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IAudioProcessingService
    {
        Task<AudioFeatures> ExtractFeaturesAsync(byte[] audioData, CancellationToken ct);
        Characteristics CalculateCharacteristics(AudioFeatures features);
    }
}
