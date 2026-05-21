using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Entities;
using Microsoft.ML;
using Microsoft.ML.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Regression model that predicts a commercial score (1–10) from Spotify popularity data.
    ///
    /// Supports two trainers selected at runtime via MlLibrarySettings:
    ///   LightGBM  — leaf-wise gradient boosting (default; fast on large datasets).
    ///   FastTree  — level-wise MART gradient boosted trees (XGBoost-family; more
    ///               stable on smaller datasets due to level-wise splitting).
    /// </summary>
    public class CommercialScorePredictor
    {
        private readonly MLContext _mlContext;
        private readonly ILogger<CommercialScorePredictor> _logger;
        private readonly MlLibrarySettings _librarySettings;
        private readonly MlMetricsStore _metricsStore;
        private ITransformer? _model;

        // Cached after Train() — CreatePredictionEngine compiles the full transformer
        // pipeline; recreating it per-call wastes significant CPU.
        // PredictionEngine<T,U> is NOT thread-safe (reuses an internal buffer).
        // This class is a Singleton, so _lock serialises concurrent Predict() calls.
        private readonly object _lock = new();
        private PredictionEngine<CommercialInput, SingleOutput>? _predictionEngine;

        public bool IsReady => _predictionEngine != null;

        private static readonly string[] InputFeatures =
        [
            "Danceability", "Energy", "Valence", "Tempo (normalised)",
            "Acousticness", "Speechiness", "Loudness (normalised)",
            "Instrumentalness", "Liveness"
        ];

        public CommercialScorePredictor(
            ILogger<CommercialScorePredictor> logger,
            MlLibrarySettings librarySettings,
            MlMetricsStore metricsStore)
        {
            _mlContext = new MLContext(seed: 42);
            _logger = logger;
            _librarySettings = librarySettings;
            _metricsStore = metricsStore;
        }

        /// <summary>
        /// Train on the Spotify dataset. Popularity (0–100) is scaled to 0–10.
        /// Uses the trainer selected by MlLibrarySettings.
        /// </summary>
        public void Train(List<SpotifyTrackData> dataset)
        {
            var lib = _librarySettings.ActiveLibrary;
            _logger.LogInformation(
                "Training commercial score model ({Library}) on {Count} Spotify tracks...",
                lib, dataset.Count);

            var rows = dataset
                .Where(t => t.Popularity > 0)
                .Select(t => new CommercialInput
                {
                    Danceability       = t.Danceability,
                    Energy             = t.Energy,
                    Valence            = t.Valence,
                    NormalizedTempo    = (float)(t.Tempo / 220.0),            // 0–220 BPM → 0–1
                    Acousticness       = t.Acousticness,
                    Speechiness        = t.Speechiness,
                    NormalizedLoudness = (float)((t.Loudness + 60.0) / 60.0), // -60..0 dB → 0–1
                    Instrumentalness   = t.Instrumentalness,
                    Liveness           = t.Liveness,
                    Label              = t.Popularity / 10f                   // 0–100 → 0–10
                })
                .ToList();

            var dataView = _mlContext.Data.LoadFromEnumerable(rows);

            // Feature prep is identical for both trainers; only the final estimator differs.
            var featurePipeline = _mlContext.Transforms
                .Concatenate("Features",
                    nameof(CommercialInput.Danceability),
                    nameof(CommercialInput.Energy),
                    nameof(CommercialInput.Valence),
                    nameof(CommercialInput.NormalizedTempo),
                    nameof(CommercialInput.Acousticness),
                    nameof(CommercialInput.Speechiness),
                    nameof(CommercialInput.NormalizedLoudness),
                    nameof(CommercialInput.Instrumentalness),
                    nameof(CommercialInput.Liveness))
                .Append(_mlContext.Transforms.NormalizeMinMax("Features"));

            // IEstimator<ITransformer> is the common base — necessary because
            // EstimatorChain<FastTreeModelParams> and EstimatorChain<LightGbmModelParams>
            // are incompatible generic types that share no implicit conversion.
            IEstimator<ITransformer> pipeline;
            if (lib == MlLibrary.FastTree)
                pipeline = featurePipeline.Append(_mlContext.Regression.Trainers.FastTree(
                    labelColumnName: nameof(CommercialInput.Label),
                    featureColumnName: "Features",
                    numberOfTrees: 200,
                    numberOfLeaves: 31,
                    learningRate: 0.05));
            else
                pipeline = featurePipeline.Append(_mlContext.Regression.Trainers.LightGbm(
                    labelColumnName: nameof(CommercialInput.Label),
                    featureColumnName: "Features",
                    numberOfIterations: 200,
                    learningRate: 0.05,
                    numberOfLeaves: 31));

            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);
            _model = pipeline.Fit(split.TrainSet);

            var predictions = _model.Transform(split.TestSet);
            var metrics = _mlContext.Regression.Evaluate(
                predictions, labelColumnName: nameof(CommercialInput.Label));

            _logger.LogInformation(
                "Commercial score model ({Library}) ready — R²={R2:F4} RMSE={RMSE:F4} MAE={MAE:F4}",
                lib, metrics.RSquared, metrics.RootMeanSquaredError, metrics.MeanAbsoluteError);

            lock (_lock)
            {
                _predictionEngine = _mlContext.Model.CreatePredictionEngine<CommercialInput, SingleOutput>(_model);
            }

            _metricsStore.Upsert(new ModelSnapshot
            {
                Name            = "Commercial Score Predictor",
                ActiveLibrary   = lib.ToString(),
                IsReady         = true,
                RSquared        = Math.Round(metrics.RSquared, 4),
                Rmse            = Math.Round(metrics.RootMeanSquaredError, 4),
                Mae             = Math.Round(metrics.MeanAbsoluteError, 4),
                TrainingSamples = rows.Count,
                TrainedAt       = DateTimeOffset.UtcNow,
                InputFeatures   = InputFeatures,
                OutputTargets   = ["CommercialScore (1–10)"],
                Description     =
                    "Predicts how commercially viable a track is (1–10) using a gradient-boosted " +
                    "regression model trained on Spotify popularity data. Higher scores correlate " +
                    "with chart performance and streaming potential.",
                ExpansionTips   =
                [
                    "Add Billboard chart data as an extra label source beyond Spotify popularity.",
                    "Include TikTok/YouTube view counts as a second regression target (multi-output).",
                    "Add release-year feature to account for changing listener tastes over time.",
                    "Train separate models per genre — commercial drivers differ between EDM and Folk."
                ]
            });
        }

        /// <summary>
        /// Predict a commercial score (1–10) from extracted audio characteristics.
        /// Falls back to 5 if the model hasn't been trained yet.
        /// </summary>
        public int Predict(Characteristics chars)
        {
            if (_predictionEngine == null) return 5;

            var input = new CommercialInput
            {
                Danceability       = (float)chars.Danceability,
                Energy             = (float)chars.Energy,
                Valence            = (float)chars.Valence,
                NormalizedTempo    = (float)(chars.Tempo / 220.0),
                Acousticness       = (float)chars.Acousticness,
                Speechiness        = (float)chars.Speechiness,
                NormalizedLoudness = (float)((chars.Loudness + 60.0) / 60.0),
                Instrumentalness   = (float)chars.Instrumentalness,
                Liveness           = 0.15f
            };

            float score;
            lock (_lock) { score = _predictionEngine.Predict(input).Score; }
            return Math.Max(1, Math.Min(10, (int)Math.Round(score)));
        }
    }

    public class CommercialInput
    {
        public float Danceability       { get; set; }
        public float Energy             { get; set; }
        public float Valence            { get; set; }
        public float NormalizedTempo    { get; set; }
        public float Acousticness       { get; set; }
        public float Speechiness        { get; set; }
        public float NormalizedLoudness { get; set; }
        public float Instrumentalness   { get; set; }
        public float Liveness           { get; set; }

        [ColumnName("Label")]
        public float Label { get; set; }
    }

    // CommercialOutput removed — uses SingleOutput from AudioFeatureLearner (same namespace, identical schema).
}
