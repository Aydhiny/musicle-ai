using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.ML
{
    public interface IGenreClassifier
    {
        Task<ModelMetrics> TrainAsync(CancellationToken ct = default);
        Task<GenrePrediction> PredictAsync(Characteristics characteristics, CancellationToken ct = default);
    }
}
