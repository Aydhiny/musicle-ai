using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Application.Services;
using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Dtos;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.ML;
using Microsoft.ML.Data;
using System.Text.Json;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// IMPROVED: Now uses user feedback from database as "gold" labels for training
    /// This implements REAL learning - the model changes based on user corrections
    /// </summary>
    public class MLNetGenreClassifierWithFeedback : IGenreClassifier
    {
        private readonly MLContext _mlContext;
        private readonly ILogger<MLNetGenreClassifierWithFeedback> _logger;
        private readonly ISpotifyDatasetLoader _datasetLoader;
        private readonly MusicAgentDbContext _db;
        private ITransformer? _model;
        private readonly string _modelPath;

        public MLNetGenreClassifierWithFeedback(
            ILogger<MLNetGenreClassifierWithFeedback> logger,
            ISpotifyDatasetLoader datasetLoader,
            MusicAgentDbContext db,
            string modelPath = "Models/genre_model.zip")
        {
            _mlContext = new MLContext(seed: 1);
            _logger = logger;
            _datasetLoader = datasetLoader;
            _db = db;
            _modelPath = modelPath;

            Directory.CreateDirectory(Path.GetDirectoryName(_modelPath)!);
        }

        public async Task<ModelMetrics> TrainAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("🎓 Starting FEEDBACK-ENHANCED model training...");

            // STEP 1: Get base training data from Spotify CSV
            var spotifyDataset = _datasetLoader.GetCachedDataset();
            _logger.LogInformation("📊 Loaded {Count} tracks from Spotify dataset", spotifyDataset.Count);

            // STEP 2: Get user feedback from database (THE LEARNING SIGNAL!)
            var feedbackData = await GetFeedbackTrainingDataAsync(ct);
            _logger.LogInformation("💡 Loaded {Count} user corrections from database", feedbackData.Count);

            // STEP 3: Combine both sources - user feedback takes priority
            var trainingData = new List<GenreTrainingData>();

            // Add Spotify data (static baseline)
            trainingData.AddRange(spotifyDataset.Select(track => new GenreTrainingData
            {
                Tempo = track.Tempo,
                Energy = track.Energy,
                Danceability = track.Danceability,
                Valence = track.Valence,
                Acousticness = track.Acousticness,
                Loudness = track.Loudness,
                Speechiness = track.Speechiness,
                Instrumentalness = track.Instrumentalness,
                Liveness = track.Liveness,
                Popularity = track.Popularity,
                Label = DetermineGenreFromFeatures(track),
                Weight = 1.0f // Normal weight
            }));

            // Add user feedback data (HIGHER WEIGHT - these are "gold" labels!)
            trainingData.AddRange(feedbackData.Select(fb => new GenreTrainingData
            {
                Tempo = fb.Tempo,
                Energy = fb.Energy,
                Danceability = fb.Danceability,
                Valence = fb.Valence,
                Acousticness = fb.Acousticness,
                Loudness = fb.Loudness,
                Speechiness = fb.Speechiness,
                Instrumentalness = fb.Instrumentalness,
                Liveness = fb.Liveness,
                Popularity = fb.Popularity,
                Label = fb.Label, // User-corrected genre!
                Weight = 3.0f // 3x weight - user corrections are more important!
            }));

            _logger.LogInformation(
                "📚 Combined training set: {Total} samples ({Spotify} Spotify + {Feedback} user feedback)",
                trainingData.Count, spotifyDataset.Count, feedbackData.Count);

            // STEP 4: Log genre distribution (see how feedback changes it)
            var genreDistribution = trainingData
                .GroupBy(t => t.Label)
                .Select(g => new
                {
                    Genre = g.Key,
                    Count = g.Count(),
                    FeedbackCount = feedbackData.Count(f => f.Label == g.Key),
                    TotalWeight = g.Sum(x => x.Weight)
                })
                .OrderByDescending(x => x.TotalWeight);

            _logger.LogInformation("📊 Genre distribution (with feedback weights):");
            foreach (var item in genreDistribution)
            {
                _logger.LogInformation(
                    "  {Genre}: {Count} tracks ({Percent:P1}) - {Feedback} user corrections, weight: {Weight:F1}",
                    item.Genre, item.Count, item.Count / (double)trainingData.Count,
                    item.FeedbackCount, item.TotalWeight);
            }

            // STEP 5: Train the model with weighted data
            var dataView = _mlContext.Data.LoadFromEnumerable(trainingData);
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

            var pipeline = _mlContext.Transforms.Conversion
                .MapValueToKey(nameof(GenreTrainingData.Label))
                .Append(_mlContext.Transforms.Concatenate("Features",
                    nameof(GenreTrainingData.Tempo),
                    nameof(GenreTrainingData.Energy),
                    nameof(GenreTrainingData.Danceability),
                    nameof(GenreTrainingData.Valence),
                    nameof(GenreTrainingData.Acousticness),
                    nameof(GenreTrainingData.Loudness),
                    nameof(GenreTrainingData.Speechiness),
                    nameof(GenreTrainingData.Instrumentalness),
                    nameof(GenreTrainingData.Liveness),
                    nameof(GenreTrainingData.Popularity)))
                .Append(_mlContext.Transforms.NormalizeMinMax("Features"))
                // Use ExampleWeightColumnName to give user feedback more influence!
                .Append(_mlContext.MulticlassClassification.Trainers.SdcaMaximumEntropy(
                    labelColumnName: "Label",
                    featureColumnName: "Features",
                    exampleWeightColumnName: nameof(GenreTrainingData.Weight))) // KEY: Weight feedback higher!
                .Append(_mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"));

            _logger.LogInformation("🔧 Training model with {Count} weighted samples...", trainingData.Count);
            var startTime = DateTime.UtcNow;
            _model = pipeline.Fit(split.TrainSet);
            var trainingDuration = DateTime.UtcNow - startTime;

            // STEP 6: Evaluate
            var predictions = _model.Transform(split.TestSet);
            var metrics = _mlContext.MulticlassClassification.Evaluate(predictions);

            _logger.LogInformation("✅ Model trained in {Duration}s", trainingDuration.TotalSeconds);
            _logger.LogInformation("📈 Macro Accuracy: {Accuracy:P2}", metrics.MacroAccuracy);
            _logger.LogInformation("📈 Micro Accuracy: {Accuracy:P2}", metrics.MicroAccuracy);
            _logger.LogInformation("📉 Log-Loss: {LogLoss:F4}", metrics.LogLoss);

            // STEP 7: Save model
            _mlContext.Model.Save(_model, dataView.Schema, _modelPath);
            _logger.LogInformation("💾 Model saved to {Path}", _modelPath);

            // STEP 8: Mark feedback as used in training
            await MarkFeedbackAsUsedAsync(ct);

            return new ModelMetrics
            {
                Accuracy = metrics.MacroAccuracy,
                LogLoss = metrics.LogLoss,
                TrainingSamples = trainingData.Count
            };
        }

        /// <summary>
        /// Get training data from user feedback in database
        /// This is the LEARNING MECHANISM - user corrections become training data
        /// </summary>
        private async Task<List<EnhancedTrainingData>> GetFeedbackTrainingDataAsync(CancellationToken ct)
        {
            var feedbackData = await _db.Set<UserFeedback>()
                .Include(f => f.Analysis)
                .Where(f => f.CorrectedGenre != null) // Only feedback with genre corrections
                .ToListAsync(ct);

            var result = new List<EnhancedTrainingData>();

            foreach (var feedback in feedbackData)
            {
                // Parse characteristics from JSON
                if (string.IsNullOrEmpty(feedback.Analysis.CharacteristicsJson))
                    continue;

                var chars = JsonSerializer.Deserialize<Characteristics>(
                    feedback.Analysis.CharacteristicsJson);

                if (chars == null)
                    continue;

                result.Add(new EnhancedTrainingData
                {
                    AnalysisId = feedback.AnalysisId,
                    Tempo = (float)chars.Tempo,
                    Energy = (float)chars.Energy,
                    Danceability = (float)chars.Danceability,
                    Valence = (float)chars.Valence,
                    Acousticness = (float)chars.Acousticness,
                    Loudness = (float)chars.Loudness,
                    Speechiness = (float)chars.Speechiness,
                    Instrumentalness = (float)chars.Instrumentalness,
                    Liveness = 0.15f, // Default
                    Popularity = 50, // Default
                    Label = feedback.CorrectedGenre!, // USER'S CORRECTION - the gold label!
                    IsCorrected = true,
                    AccuracyRating = feedback.AccuracyRating,
                    AnalyzedAt = feedback.Analysis.AnalyzedAt
                });
            }

            return result;
        }

        /// <summary>
        /// Mark all feedback as incorporated into training
        /// </summary>
        private async Task MarkFeedbackAsUsedAsync(CancellationToken ct)
        {
            var unusedFeedback = await _db.Set<UserFeedback>()
                .Where(f => !f.UsedInTraining && f.CorrectedGenre != null)
                .ToListAsync(ct);

            var modelVersion = $"v{DateTime.UtcNow:yyyyMMdd-HHmmss}";

            foreach (var feedback in unusedFeedback)
            {
                feedback.UsedInTraining = true;
                feedback.FirstUsedInModelVersion = modelVersion;
            }

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "✅ Marked {Count} feedback entries as used in model {Version}",
                unusedFeedback.Count, modelVersion);
        }

        public async Task<GenrePrediction> PredictAsync(Characteristics characteristics, CancellationToken ct = default)
        {
            if (_model == null)
            {
                if (File.Exists(_modelPath))
                {
                    _logger.LogInformation("📂 Loading model from {Path}", _modelPath);
                    _model = _mlContext.Model.Load(_modelPath, out _);
                }
                else
                {
                    _logger.LogWarning("⚠️ Model not found. Training new model...");
                    await TrainAsync(ct);
                }
            }

            var predictionEngine = _mlContext.Model.CreatePredictionEngine<GenreTrainingData, GenrePredictionOutput>(_model!);

            var input = new GenreTrainingData
            {
                Tempo = (float)characteristics.Tempo,
                Energy = (float)characteristics.Energy,
                Danceability = (float)characteristics.Danceability,
                Valence = (float)characteristics.Valence,
                Acousticness = (float)characteristics.Acousticness,
                Loudness = (float)characteristics.Loudness,
                Speechiness = (float)characteristics.Speechiness,
                Instrumentalness = (float)characteristics.Instrumentalness,
                Liveness = 0.15f,
                Popularity = 50
            };

            var prediction = predictionEngine.Predict(input);
            var maxConfidence = prediction.Score?.Max() ?? 0f;

            return new GenrePrediction
            {
                Genre = prediction.PredictedLabel ?? "Unknown",
                Confidence = (int)(maxConfidence * 100)
            };
        }

        private string DetermineGenreFromFeatures(SpotifyTrackData track)
        {
            // Same rule-based logic as before for Spotify data
            var scores = new Dictionary<string, double>();

            // Electronic/Dance
            var electronicScore = 0.0;
            if (track.Tempo >= 115 && track.Tempo <= 140) electronicScore += 25;
            if (track.Energy >= 0.7) electronicScore += 30;
            if (track.Danceability >= 0.65) electronicScore += 25;
            if (track.Acousticness <= 0.3) electronicScore += 15;
            if (track.Valence >= 0.5) electronicScore += 5;
            scores["Electronic/Dance"] = electronicScore;

            // Hip-Hop/Rap
            var hiphopScore = 0.0;
            if (track.Speechiness >= 0.15) hiphopScore += 40;
            if (track.Speechiness >= 0.25) hiphopScore += 20;
            if (track.Tempo >= 75 && track.Tempo <= 115) hiphopScore += 20;
            if (track.Energy >= 0.5 && track.Energy <= 0.8) hiphopScore += 15;
            if (track.Danceability >= 0.6) hiphopScore += 5;
            scores["Hip-Hop/Rap"] = hiphopScore;

            // Pop
            var popScore = 0.0;
            if (track.Popularity >= 60) popScore += 25;
            if (track.Energy >= 0.5 && track.Energy <= 0.8) popScore += 20;
            if (track.Danceability >= 0.5 && track.Danceability <= 0.8) popScore += 20;
            if (track.Valence >= 0.4) popScore += 15;
            if (track.Tempo >= 100 && track.Tempo <= 130) popScore += 15;
            if (track.Speechiness < 0.15 && track.Speechiness > 0.03) popScore += 5;
            scores["Pop"] = popScore;

            // Rock
            var rockScore = 0.0;
            if (track.Energy >= 0.7) rockScore += 35;
            if (track.Acousticness <= 0.25) rockScore += 25;
            if (track.Tempo >= 110 && track.Tempo <= 140) rockScore += 20;
            if (track.Loudness >= -6) rockScore += 15;
            if (track.Instrumentalness <= 0.4) rockScore += 5;
            scores["Rock"] = rockScore;

            // Acoustic/Folk
            var acousticScore = 0.0;
            if (track.Acousticness >= 0.6) acousticScore += 40;
            if (track.Acousticness >= 0.8) acousticScore += 20;
            if (track.Energy <= 0.5) acousticScore += 25;
            if (track.Tempo >= 80 && track.Tempo <= 120) acousticScore += 10;
            if (track.Valence >= 0.3) acousticScore += 5;
            scores["Acoustic/Folk"] = acousticScore;

            // R&B/Soul
            var rnbScore = 0.0;
            if (track.Energy >= 0.4 && track.Energy <= 0.7) rnbScore += 25;
            if (track.Danceability >= 0.5 && track.Danceability <= 0.8) rnbScore += 25;
            if (track.Tempo >= 80 && track.Tempo <= 120) rnbScore += 20;
            if (track.Speechiness >= 0.03 && track.Speechiness <= 0.15) rnbScore += 15;
            if (track.Valence >= 0.3 && track.Valence <= 0.7) rnbScore += 15;
            scores["R&B/Soul"] = rnbScore;

            // Indie/Alternative
            var indieScore = 0.0;
            if (track.Energy >= 0.4 && track.Energy <= 0.7) indieScore += 20;
            if (track.Acousticness >= 0.3 && track.Acousticness <= 0.6) indieScore += 20;
            if (track.Tempo >= 100 && track.Tempo <= 140) indieScore += 15;
            if (track.Popularity < 60) indieScore += 15;
            if (track.Valence >= 0.3 && track.Valence <= 0.7) indieScore += 15;
            if (track.Danceability >= 0.4 && track.Danceability <= 0.7) indieScore += 15;
            scores["Indie/Alternative"] = indieScore;

            // Classical/Ambient
            var classicalScore = 0.0;
            if (track.Instrumentalness >= 0.5) classicalScore += 50;
            if (track.Instrumentalness >= 0.8) classicalScore += 20;
            if (track.Energy <= 0.4) classicalScore += 15;
            if (track.Acousticness >= 0.7) classicalScore += 15;
            scores["Classical/Ambient"] = classicalScore;

            var bestGenre = scores.OrderByDescending(x => x.Value).First();

            if (bestGenre.Value < 30)
            {
                return "Pop";
            }

            return bestGenre.Key;
        }
    }

    /// <summary>
    /// Training data with weight column for giving user feedback more influence
    /// </summary>
    public class GenreTrainingData
    {
        public float Tempo { get; set; }
        public float Energy { get; set; }
        public float Danceability { get; set; }
        public float Valence { get; set; }
        public float Acousticness { get; set; }
        public float Loudness { get; set; }
        public float Speechiness { get; set; }
        public float Instrumentalness { get; set; }
        public float Liveness { get; set; }
        public float Popularity { get; set; }

        [ColumnName("Label")]
        public string Label { get; set; } = string.Empty;

        /// <summary>
        /// Weight for this sample (user feedback gets higher weight)
        /// </summary>
        public float Weight { get; set; } = 1.0f;
    }

    public class GenrePredictionOutput
    {
        [ColumnName("PredictedLabel")]
        public string? PredictedLabel { get; set; }

        [ColumnName("Score")]
        public float[]? Score { get; set; }
    }

    public class GenrePrediction
    {
        public string Genre { get; set; } = string.Empty;
        public int Confidence { get; set; }
    }

    public class ModelMetrics
    {
        public double Accuracy { get; set; }
        public double LogLoss { get; set; }
        public int TrainingSamples { get; set; }
    }
}
