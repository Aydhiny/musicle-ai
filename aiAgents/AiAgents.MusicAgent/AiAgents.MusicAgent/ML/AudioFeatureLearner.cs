using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Entities;
using Microsoft.ML;
using Microsoft.ML.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Five regression models that enrich raw NAudio features with Spotify-calibrated
    /// derived features (Danceability, Valence, Acousticness, Speechiness, ViralPotential).
    ///
    /// Supports two trainers selected at runtime via MlLibrarySettings:
    ///   LightGBM  — leaf-wise gradient boosting (default).
    ///   FastTree  — level-wise MART gradient boosted trees (XGBoost-family).
    ///
    /// Inputs available at inference time (computable from raw audio):
    ///   Energy, Tempo, Loudness, Instrumentalness (via spectral flatness)
    ///
    /// Target features (labels from Spotify CSV):
    ///   Danceability, Valence, Acousticness, Speechiness, ViralPotential
    /// </summary>
    public class AudioFeatureLearner
    {
        private readonly MLContext _mlContext;
        private readonly ILogger<AudioFeatureLearner> _logger;
        private readonly MlLibrarySettings _librarySettings;
        private readonly MlMetricsStore _metricsStore;

        // PredictionEngine<T,U> is NOT thread-safe — it reuses an internal buffer.
        // This class is a Singleton so all concurrent requests share these engines.
        // Every Predict() call must hold this lock to serialise buffer access.
        private readonly object _lock = new();

        private PredictionEngine<FeatureInput, SingleOutput>? _danceabilityEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _valenceEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _acousticnessEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _speechinessEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _viralPotentialEngine;

        public bool IsReady => _danceabilityEngine != null;

        public AudioFeatureLearner(
            ILogger<AudioFeatureLearner> logger,
            MlLibrarySettings librarySettings,
            MlMetricsStore metricsStore)
        {
            _mlContext = new MLContext(seed: 42);
            _logger = logger;
            _librarySettings = librarySettings;
            _metricsStore = metricsStore;
        }

        public void Train(List<SpotifyTrackData> dataset)
        {
            var lib = _librarySettings.ActiveLibrary;
            _logger.LogInformation(
                "Training audio feature regression models ({Library}) on {Count} Spotify tracks...",
                lib, dataset.Count);

            var rows = dataset.Select(t => new FeatureInput
            {
                Energy           = t.Energy,
                NormalisedTempo  = (float)(t.Tempo / 220.0),
                NormLoudness     = (float)((t.Loudness + 60.0) / 60.0),
                Instrumentalness = t.Instrumentalness,

                Danceability   = t.Danceability,
                Valence        = t.Valence,
                Acousticness   = t.Acousticness,
                Speechiness    = t.Speechiness,
                ViralPotential = t.Popularity / 100f
            }).ToList();

            // Each target uses only the inputs that are physically meaningful for it.
            // Using Instrumentalness to predict Danceability was the root cause of
            // Memphis Trap → Indie misclassifications (808 bass → high Instrumentalness
            // → danceability model predicts ~0.36 instead of ~0.75).

            var r2Totals = new Dictionary<string, double>();

            _danceabilityEngine = BuildEngine(lib, rows, nameof(FeatureInput.Danceability), r2Totals,
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness));

            _valenceEngine = BuildEngine(lib, rows, nameof(FeatureInput.Valence), r2Totals,
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness),
                nameof(FeatureInput.Instrumentalness));

            _acousticnessEngine = BuildEngine(lib, rows, nameof(FeatureInput.Acousticness), r2Totals,
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness),
                nameof(FeatureInput.Instrumentalness));

            _speechinessEngine = BuildEngine(lib, rows, nameof(FeatureInput.Speechiness), r2Totals,
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness));

            _viralPotentialEngine = BuildEngine(lib, rows, nameof(FeatureInput.ViralPotential), r2Totals,
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness),
                nameof(FeatureInput.Instrumentalness));

            _logger.LogInformation("Audio feature regression models ({Library}) ready.", lib);

            double avgR2 = r2Totals.Values.DefaultIfEmpty(0).Average();
            _metricsStore.Upsert(new ModelSnapshot
            {
                Name            = "Audio Feature Learner",
                ActiveLibrary   = lib.ToString(),
                IsReady         = true,
                RSquared        = Math.Round(avgR2, 4),
                TrainingSamples = rows.Count,
                TrainedAt       = DateTimeOffset.UtcNow,
                InputFeatures   = ["Energy", "Tempo (normalised)", "Loudness (normalised)", "Instrumentalness"],
                OutputTargets   = ["Danceability", "Valence", "Acousticness", "Speechiness", "Viral Potential"],
                Description     =
                    "Five gradient-boosted regression models that translate raw NAudio signal " +
                    "measurements into Spotify-calibrated perceptual features. Each model uses only " +
                    "the physically meaningful inputs for its target (e.g. Instrumentalness is " +
                    "excluded from Danceability to prevent 808-bass misclassification).",
                ExpansionTips   =
                [
                    "Add zero-crossing rate and spectral flux as raw inputs — both correlate strongly with Speechiness.",
                    "Extract MFCC coefficients (13–20 bands) to give the models richer timbral information.",
                    "Add chroma features (12-bin pitch class profile) to improve Valence predictions.",
                    "Train separate models per genre shard — Danceability in Electronic vs Folk is driven by different signals."
                ]
            });
        }

        private PredictionEngine<FeatureInput, SingleOutput> BuildEngine(
            MlLibrary lib,
            List<FeatureInput> rows,
            string labelColumn,
            Dictionary<string, double> r2Collector,
            params string[] inputColumns)
        {
            var dataView = _mlContext.Data.LoadFromEnumerable(rows);
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

            var featurePipeline = _mlContext.Transforms
                .CopyColumns("Label", labelColumn)
                .Append(_mlContext.Transforms.Concatenate("Features", inputColumns));

            // Same generic-type incompatibility as CommercialScorePredictor — use the
            // shared IEstimator<ITransformer> base so the if/else can compile.
            IEstimator<ITransformer> pipeline;
            if (lib == MlLibrary.FastTree)
                pipeline = featurePipeline.Append(_mlContext.Regression.Trainers.FastTree(
                    numberOfTrees: 300,
                    learningRate: 0.05,
                    numberOfLeaves: 31));
            else
                pipeline = featurePipeline.Append(_mlContext.Regression.Trainers.LightGbm(
                    numberOfIterations: 300,
                    learningRate: 0.05,
                    numberOfLeaves: 31));

            var model = pipeline.Fit(split.TrainSet);
            var preds   = model.Transform(split.TestSet);
            var metrics = _mlContext.Regression.Evaluate(preds);

            r2Collector[labelColumn] = metrics.RSquared;
            _logger.LogInformation(
                "  {Label,-18} R²={R2:F3}  RMSE={RMSE:F3}  inputs=[{Inputs}]",
                labelColumn, metrics.RSquared, metrics.RootMeanSquaredError,
                string.Join(",", inputColumns));

            return _mlContext.Model.CreatePredictionEngine<FeatureInput, SingleOutput>(model);
        }

        // ─── Public inference ────────────────────────────────────────────────────

        /// <summary>
        /// Enrich a Characteristics object with ML-predicted derived features.
        /// Modifies in-place. No-ops if models haven't trained yet.
        /// </summary>
        public void EnrichFeatures(Characteristics chars)
        {
            if (!IsReady) return;

            var input = ToInput(chars);
            lock (_lock)
            {
                chars.Danceability = Clamp(_danceabilityEngine!.Predict(input).Score);
                chars.Valence      = Clamp(_valenceEngine!.Predict(input).Score);
                chars.Acousticness = Clamp(_acousticnessEngine!.Predict(input).Score);
                chars.Speechiness  = Clamp(_speechinessEngine!.Predict(input).Score);
            }
        }

        /// <summary>Predicted viral potential (0–1) for the scoring service.</summary>
        public double PredictViralPotential(Characteristics chars)
        {
            if (_viralPotentialEngine == null) return 0.5;
            lock (_lock)
            {
                return Clamp(_viralPotentialEngine.Predict(ToInput(chars)).Score);
            }
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        private static FeatureInput ToInput(Characteristics chars) => new()
        {
            Energy           = (float)chars.Energy,
            NormalisedTempo  = (float)(chars.Tempo / 220.0),
            NormLoudness     = (float)((chars.Loudness + 60.0) / 60.0),
            Instrumentalness = (float)chars.Instrumentalness
        };

        private static double Clamp(double v) => Math.Max(0, Math.Min(1, v));
    }

    // ─── Schema classes ──────────────────────────────────────────────────────────

    public class FeatureInput
    {
        public float Energy           { get; set; }
        public float NormalisedTempo  { get; set; }
        public float NormLoudness     { get; set; }
        public float Instrumentalness { get; set; }

        public float Danceability   { get; set; }
        public float Valence        { get; set; }
        public float Acousticness   { get; set; }
        public float Speechiness    { get; set; }
        public float ViralPotential { get; set; }
    }

    public class SingleOutput
    {
        [ColumnName("Score")]
        public float Score { get; set; }
    }
}
