using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Entities;
using Microsoft.ML;
using Microsoft.ML.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Replaces hand-written formulas for derived audio features with regression
    /// models trained on the Spotify dataset.
    ///
    /// Raw signals we can extract from audio (Energy, Tempo, Loudness,
    /// Instrumentalness) are used as inputs.  The Spotify CSV provides ground-truth
    /// labels for Danceability, Valence, Acousticness, Speechiness, and
    /// ViralPotential (proxied by Popularity).  Five LightGBM regression models
    /// learn the relationships from data instead of us hard-coding weights.
    /// </summary>
    public class AudioFeatureLearner
    {
        private readonly MLContext _mlContext;
        private readonly ILogger<AudioFeatureLearner> _logger;

        // One prediction engine per target feature
        private PredictionEngine<FeatureInput, SingleOutput>? _danceabilityEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _valenceEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _acousticnessEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _speechinessEngine;
        private PredictionEngine<FeatureInput, SingleOutput>? _viralPotentialEngine;

        public bool IsReady => _danceabilityEngine != null;

        public AudioFeatureLearner(ILogger<AudioFeatureLearner> logger)
        {
            _mlContext = new MLContext(seed: 42);
            _logger = logger;
        }

        /// <summary>
        /// Train all five regression models on the Spotify dataset.
        /// Called once at startup after the dataset is loaded.
        ///
        /// Inputs available at inference time (computable from raw audio):
        ///   Energy, Tempo, Loudness, Instrumentalness (via spectral flatness)
        ///
        /// Target features (labels from Spotify CSV):
        ///   Danceability, Valence, Acousticness, Speechiness, ViralPotential
        /// </summary>
        public void Train(List<SpotifyTrackData> dataset)
        {
            _logger.LogInformation(
                "Training audio feature regression models on {Count} Spotify tracks...", dataset.Count);

            // Normalise loudness from -60..0 dB to 0..1 so all inputs are on the same scale
            var rows = dataset.Select(t => new FeatureInput
            {
                Energy           = t.Energy,
                NormalisedTempo  = (float)(t.Tempo / 220.0),
                NormLoudness     = (float)((t.Loudness + 60.0) / 60.0),
                Instrumentalness = t.Instrumentalness,

                // Targets (labels)
                Danceability     = t.Danceability,
                Valence          = t.Valence,
                Acousticness     = t.Acousticness,
                Speechiness      = t.Speechiness,
                ViralPotential   = t.Popularity / 100f    // 0–100 → 0–1
            }).ToList();

            // Each target uses only the inputs that are physically meaningful for it.
            // Using Instrumentalness to predict Danceability was the root cause of
            // Memphis Trap → Indie: 808 bass reads as "tonal" → high Instrumentalness
            // → danceability model thinks "classical" → predicts 0.36 instead of ~0.75.

            // Danceability: rhythm & tempo drive this, not whether vocals exist
            _danceabilityEngine = BuildEngine(rows, nameof(FeatureInput.Danceability),
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness));

            // Valence (mood): energy + loudness are the main drivers
            _valenceEngine = BuildEngine(rows, nameof(FeatureInput.Valence),
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness),
                nameof(FeatureInput.Instrumentalness));

            // Acousticness: all 4 signals matter here
            _acousticnessEngine = BuildEngine(rows, nameof(FeatureInput.Acousticness),
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness),
                nameof(FeatureInput.Instrumentalness));

            // Speechiness: don't let Instrumentalness suppress it — a quiet rap
            // track has Instrumentalness=0.5 but is still speech-heavy
            _speechinessEngine = BuildEngine(rows, nameof(FeatureInput.Speechiness),
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness));

            // Viral potential: all signals
            _viralPotentialEngine = BuildEngine(rows, nameof(FeatureInput.ViralPotential),
                nameof(FeatureInput.Energy),
                nameof(FeatureInput.NormalisedTempo),
                nameof(FeatureInput.NormLoudness),
                nameof(FeatureInput.Instrumentalness));

            _logger.LogInformation("Audio feature regression models ready.");
        }

        private PredictionEngine<FeatureInput, SingleOutput> BuildEngine(
            List<FeatureInput> rows, string labelColumn, params string[] inputColumns)
        {
            var dataView = _mlContext.Data.LoadFromEnumerable(rows);
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

            var pipeline = _mlContext.Transforms
                .CopyColumns("Label", labelColumn)
                .Append(_mlContext.Transforms.Concatenate("Features", inputColumns))
                .Append(_mlContext.Regression.Trainers.LightGbm(
                    numberOfIterations: 300,
                    learningRate: 0.05,
                    numberOfLeaves: 31));

            var model = pipeline.Fit(split.TrainSet);

            var preds   = model.Transform(split.TestSet);
            var metrics = _mlContext.Regression.Evaluate(preds);
            _logger.LogInformation(
                "  {Label,-18} R²={R2:F3}  RMSE={RMSE:F3}  inputs=[{Inputs}]",
                labelColumn, metrics.RSquared, metrics.RootMeanSquaredError,
                string.Join(",", inputColumns));

            return _mlContext.Model.CreatePredictionEngine<FeatureInput, SingleOutput>(model);
        }

        // ─── Public inference ────────────────────────────────────────────────────

        /// <summary>
        /// Replace the hand-written derived feature formulas with ML predictions.
        /// Modifies the Characteristics object in-place.
        /// No-ops if the models haven't been trained yet (startup edge case).
        /// </summary>
        public void EnrichFeatures(Characteristics chars)
        {
            if (!IsReady) return;

            var input = ToInput(chars);

            chars.Danceability = Clamp(Predict(_danceabilityEngine!, input));
            chars.Valence      = Clamp(Predict(_valenceEngine!, input));
            chars.Acousticness = Clamp(Predict(_acousticnessEngine!, input));
            chars.Speechiness  = Clamp(Predict(_speechinessEngine!, input));
            // ViralPotential is exposed via ViralScore property (see below)
        }

        /// <summary>
        /// Predicted viral potential (0–1) for use by the scoring service.
        /// </summary>
        public double PredictViralPotential(Characteristics chars)
        {
            if (_viralPotentialEngine == null) return 0.5;
            return Clamp(Predict(_viralPotentialEngine, ToInput(chars)));
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        private static FeatureInput ToInput(Characteristics chars) => new()
        {
            Energy           = (float)chars.Energy,
            NormalisedTempo  = (float)(chars.Tempo / 220.0),
            NormLoudness     = (float)((chars.Loudness + 60.0) / 60.0),
            Instrumentalness = (float)chars.Instrumentalness
        };

        private static double Predict(
            PredictionEngine<FeatureInput, SingleOutput> engine, FeatureInput input)
            => engine.Predict(input).Score;

        private static double Clamp(double v) => Math.Max(0, Math.Min(1, v));
    }

    // ─── Schema classes ──────────────────────────────────────────────────────────

    /// <summary>
    /// One row of training data.  All target columns are present; the pipeline
    /// picks the correct one via CopyColumns("Label", targetColumn).
    /// </summary>
    public class FeatureInput
    {
        // ── Inputs (computable from raw audio) ──────────────────────────────────
        public float Energy           { get; set; }
        public float NormalisedTempo  { get; set; }   // Tempo / 220
        public float NormLoudness     { get; set; }   // (Loudness + 60) / 60
        public float Instrumentalness { get; set; }

        // ── Targets (Spotify ground-truth labels, used during training only) ────
        public float Danceability     { get; set; }
        public float Valence          { get; set; }
        public float Acousticness     { get; set; }
        public float Speechiness      { get; set; }
        public float ViralPotential   { get; set; }   // Popularity / 100
    }

    public class SingleOutput
    {
        [ColumnName("Score")]
        public float Score { get; set; }
    }
}
