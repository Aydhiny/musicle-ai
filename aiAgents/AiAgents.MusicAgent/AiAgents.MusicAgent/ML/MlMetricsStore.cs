using System.Collections.Concurrent;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Immutable snapshot of a trained model's state, pushed into MlMetricsStore
    /// immediately after each training run. The API controller reads from this store
    /// so it never blocks on an in-flight training operation.
    /// </summary>
    public record ModelSnapshot
    {
        public required string Name { get; init; }
        public required string ActiveLibrary { get; init; }
        public bool IsReady { get; init; }

        // Regression metrics (AudioFeatureLearner, CommercialScorePredictor)
        public double? RSquared { get; init; }
        public double? Rmse { get; init; }
        public double? Mae { get; init; }

        // Classification metrics (GenreClassifier)
        public double? Accuracy { get; init; }
        public double? MacroF1 { get; init; }
        public double? LogLoss { get; init; }

        public int TrainingSamples { get; init; }
        public DateTimeOffset? TrainedAt { get; init; }

        // Human-readable descriptions shown in the dashboard
        public string Description { get; init; } = "";
        public string[] InputFeatures { get; init; } = [];
        public string[] OutputTargets { get; init; } = [];
        public string[] ExpansionTips { get; init; } = [];

        // Per-class breakdown for the genre classifier
        public IReadOnlyDictionary<string, ClassMetrics>? PerClassMetrics { get; init; }
    }

    public record ClassMetrics(double Precision, double Recall, double F1);

    /// <summary>
    /// Singleton write-through cache of per-model training results.
    /// Thread-safe: ConcurrentDictionary handles concurrent Upsert / All calls.
    /// </summary>
    public class MlMetricsStore
    {
        private readonly ConcurrentDictionary<string, ModelSnapshot> _snapshots = new();

        public void Upsert(ModelSnapshot snapshot) =>
            _snapshots[snapshot.Name] = snapshot;

        public IReadOnlyList<ModelSnapshot> All() =>
            _snapshots.Values.OrderBy(s => s.Name).ToList();

        public ModelSnapshot? Get(string name) =>
            _snapshots.GetValueOrDefault(name);
    }
}
