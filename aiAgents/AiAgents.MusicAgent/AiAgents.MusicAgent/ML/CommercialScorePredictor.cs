using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Entities;
using Microsoft.ML;
using Microsoft.ML.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// LightGBM regression model that predicts a commercial score (1–10)
    /// learned from Spotify popularity data.
    ///
    /// This replaces the hand-written BPM/energy formula with an actual
    /// ML model trained on what makes real tracks popular.
    /// </summary>
    public class CommercialScorePredictor
    {
        private readonly MLContext _mlContext;
        private readonly ILogger<CommercialScorePredictor> _logger;
        private ITransformer? _model;

        public bool IsReady => _model != null;

        public CommercialScorePredictor(ILogger<CommercialScorePredictor> logger)
        {
            _mlContext = new MLContext(seed: 42);
            _logger = logger;
        }

        /// <summary>
        /// Train on the Spotify dataset. Popularity (0–100) is scaled to 0–10.
        /// Called once at startup after the dataset is loaded.
        /// </summary>
        public void Train(List<SpotifyTrackData> dataset)
        {
            _logger.LogInformation(
                "Training commercial score regression model on {Count} Spotify tracks...", dataset.Count);

            var rows = dataset
                .Where(t => t.Popularity > 0)
                .Select(t => new CommercialInput
                {
                    Danceability      = t.Danceability,
                    Energy            = t.Energy,
                    Valence           = t.Valence,
                    NormalizedTempo   = (float)(t.Tempo / 200.0),           // 0–200 BPM → 0–1
                    Acousticness      = t.Acousticness,
                    Speechiness       = t.Speechiness,
                    NormalizedLoudness = (float)((t.Loudness + 60.0) / 60.0), // -60..0 dB → 0–1
                    Instrumentalness  = t.Instrumentalness,
                    Liveness          = t.Liveness,
                    Label             = t.Popularity / 10f                  // 0–100 → 0–10
                })
                .ToList();

            var dataView = _mlContext.Data.LoadFromEnumerable(rows);

            var pipeline = _mlContext.Transforms
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
                .Append(_mlContext.Transforms.NormalizeMinMax("Features"))
                .Append(_mlContext.Regression.Trainers.LightGbm(
                    labelColumnName: nameof(CommercialInput.Label),
                    featureColumnName: "Features",
                    numberOfIterations: 200,
                    learningRate: 0.05,
                    numberOfLeaves: 31));

            // Train / evaluate with 80/20 split
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);
            _model = pipeline.Fit(split.TrainSet);

            var predictions = _model.Transform(split.TestSet);
            var metrics = _mlContext.Regression.Evaluate(
                predictions, labelColumnName: nameof(CommercialInput.Label));

            _logger.LogInformation(
                "Commercial score model ready — R²={R2:F4} RMSE={RMSE:F4} MAE={MAE:F4}",
                metrics.RSquared, metrics.RootMeanSquaredError, metrics.MeanAbsoluteError);
        }

        /// <summary>
        /// Predict a commercial score (1–10) from extracted audio characteristics.
        /// Falls back to 5 if the model hasn't been trained yet.
        /// </summary>
        public int Predict(Characteristics chars)
        {
            if (_model == null)
            {
                return 5; // neutral fallback before training completes
            }

            var engine = _mlContext.Model.CreatePredictionEngine<CommercialInput, CommercialOutput>(_model);

            var input = new CommercialInput
            {
                Danceability       = (float)chars.Danceability,
                Energy             = (float)chars.Energy,
                Valence            = (float)chars.Valence,
                NormalizedTempo    = (float)(chars.Tempo / 200.0),
                Acousticness       = (float)chars.Acousticness,
                Speechiness        = (float)chars.Speechiness,
                NormalizedLoudness = (float)((chars.Loudness + 60.0) / 60.0),
                Instrumentalness   = (float)chars.Instrumentalness,
                Liveness           = 0.15f,
                Label              = 0  // ignored at inference
            };

            var result = engine.Predict(input);
            // Clamp to 1–10 and round
            return Math.Max(1, Math.Min(10, (int)Math.Round(result.Score)));
        }
    }

    public class CommercialInput
    {
        public float Danceability      { get; set; }
        public float Energy            { get; set; }
        public float Valence           { get; set; }
        public float NormalizedTempo   { get; set; }
        public float Acousticness      { get; set; }
        public float Speechiness       { get; set; }
        public float NormalizedLoudness { get; set; }
        public float Instrumentalness  { get; set; }
        public float Liveness          { get; set; }

        [ColumnName("Label")]
        public float Label { get; set; }
    }

    public class CommercialOutput
    {
        [ColumnName("Score")]
        public float Score { get; set; }
    }
}
