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

        // Genre labels in score-index order (used to build probability dictionaries)
        public IReadOnlyList<string>? GenreLabels { get; init; }

        // Full NxN confusion matrix: [actual][predicted] counts, rows/cols = GenreLabels order
        public IReadOnlyList<IReadOnlyList<int>>? ConfusionMatrix { get; init; }

        // Feature importance: feature name → normalised importance score (0–100)
        public IReadOnlyDictionary<string, double>? FeatureImportance { get; init; }
    }

    public record ClassMetrics(double Precision, double Recall, double F1);

    /// <summary>One recorded training run, stored in-memory for the learning-curve chart.</summary>
    public record TrainingRun(
        DateTimeOffset TrainedAt,
        string Library,
        double Accuracy,
        double LogLoss,
        int Samples);

    /// <summary>
    /// Summary of a K-Means clustering pass over the Spotify dataset.
    /// Stored as a singleton snapshot — replaced on every retrain.
    /// </summary>
    public record ClusteringSnapshot(
        int K,
        int TotalPoints,
        double Inertia,
        IReadOnlyList<ClusterInfo> Clusters,
        DateTimeOffset ComputedAt);

    public record ClusterInfo(
        int ClusterId,
        int Size,
        string DominantGenre,
        IReadOnlyDictionary<string, double> Centroid,
        /// <summary>
        /// Mean Euclidean distance from cluster members to their centroid.
        /// Used by AnomalyDetectionService to z-score a new point's distance.
        /// </summary>
        double AvgIntraClusterDistance,
        double StdIntraClusterDistance);

    /// <summary>Summary of one k-fold cross-validation run on the genre classifier.</summary>
    public record CrossValidationResult(
        int Folds,
        IReadOnlyList<double> FoldAccuracies,
        double MeanAccuracy,
        double StdAccuracy,
        double MeanLogLoss,
        int TrainingSamples,
        DateTimeOffset ComputedAt);

    /// <summary>
    /// Singleton write-through cache of per-model training results.
    /// Thread-safe: ConcurrentDictionary / Interlocked for all mutable state.
    /// </summary>
    public class MlMetricsStore
    {
        private readonly ConcurrentDictionary<string, ModelSnapshot> _snapshots = new();
        private readonly ConcurrentQueue<TrainingRun> _history = new();
        private volatile ClusteringSnapshot? _clustering;

        public void Upsert(ModelSnapshot snapshot) =>
            _snapshots[snapshot.Name] = snapshot;

        public IReadOnlyList<ModelSnapshot> All() =>
            _snapshots.Values.OrderBy(s => s.Name).ToList();

        public ModelSnapshot? Get(string name) =>
            _snapshots.GetValueOrDefault(name);

        // ── Training history ─────────────────────────────────────────────────

        public void AddTrainingRun(TrainingRun run) => _history.Enqueue(run);

        /// <summary>Returns the last 20 training runs in chronological order.</summary>
        public IReadOnlyList<TrainingRun> TrainingHistory =>
            _history.ToArray().TakeLast(20).ToList();

        // ── K-Means clustering ───────────────────────────────────────────────

        public void SetClustering(ClusteringSnapshot snapshot) =>
            _clustering = snapshot;

        public ClusteringSnapshot? GetClustering() => _clustering;

        // ── Cross-validation ─────────────────────────────────────────────────

        private volatile CrossValidationResult? _cvResult;

        public void SetCrossValidation(CrossValidationResult result) =>
            _cvResult = result;

        public CrossValidationResult? GetCrossValidation() => _cvResult;

        // ── Feature correlation matrix ───────────────────────────────────────

        private volatile FeatureCorrelationSnapshot? _correlations;

        public void SetCorrelations(FeatureCorrelationSnapshot snapshot) =>
            _correlations = snapshot;

        public FeatureCorrelationSnapshot? GetCorrelations() => _correlations;
    }

    /// <summary>Pearson correlation matrix over audio features from the Spotify dataset.</summary>
    public record FeatureCorrelationSnapshot(
        IReadOnlyList<string> Features,
        IReadOnlyList<IReadOnlyList<double>> Matrix,
        int SampleSize,
        DateTimeOffset ComputedAt);
}
