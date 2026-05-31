using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Data;
using Microsoft.ML;
using Microsoft.ML.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// k-Fold Cross-Validation for the genre classifier.
    ///
    /// Why cross-validation?
    ///   A single 80/20 train-test split is subject to randomness: the specific 20%
    ///   held out can make the accuracy estimate optimistic or pessimistic. k-fold CV
    ///   partitions the data into k equal folds, trains k times (each time using a
    ///   different fold as the test set), and averages the results.
    ///
    ///   Mean accuracy ± std deviation gives a statistically robust estimate and tells
    ///   you how much variance the model has (high std → unstable, likely to overfit).
    ///
    /// Implementation uses ML.NET's built-in CrossValidate() method.
    /// Runs on a stratified sample (up to 3 000 tracks per genre, capped at 30 k total)
    /// to keep training time reasonable.
    /// </summary>
    public class CrossValidationService
    {
        private readonly ISpotifyDatasetLoader _datasetLoader;
        private readonly MlLibrarySettings _librarySettings;
        private readonly MlMetricsStore _metricsStore;
        private readonly ILogger<CrossValidationService> _logger;

        public CrossValidationService(
            ISpotifyDatasetLoader datasetLoader,
            MlLibrarySettings librarySettings,
            MlMetricsStore metricsStore,
            ILogger<CrossValidationService> logger)
        {
            _datasetLoader   = datasetLoader;
            _librarySettings = librarySettings;
            _metricsStore    = metricsStore;
            _logger          = logger;
        }

        /// <summary>
        /// Runs k-fold cross-validation and caches the result.
        /// CPU-bound and synchronous — call from Task.Run() if on a request thread.
        /// </summary>
        public CrossValidationResult Run(int folds = 5)
        {
            folds = Math.Clamp(folds, 3, 10);
            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
                throw new InvalidOperationException("Dataset not loaded.");

            var lib = _librarySettings.ActiveLibrary;
            _logger.LogInformation("Cross-validation: {Folds}-fold on {N} tracks ({Library})…",
                folds, dataset.Count, lib);

            var mlContext = new MLContext(seed: 42);

            // Build training rows (same label heuristic as the main classifier)
            var rows = dataset
                .Where(t => t.Popularity > 0)
                .GroupBy(t => (t.SongName.Trim().ToLower(), t.ArtistName.Trim().ToLower()))
                .Select(g => g.OrderByDescending(t => t.Popularity).First())
                .Select(t => new CvRow
                {
                    Tempo            = t.Tempo,
                    Energy           = t.Energy,
                    Danceability     = t.Danceability,
                    Valence          = t.Valence,
                    Acousticness     = t.Acousticness,
                    Loudness         = t.Loudness,
                    Speechiness      = t.Speechiness,
                    Instrumentalness = t.Instrumentalness,
                    Label            = DetermineGenre(t)
                })
                .ToList();

            _logger.LogInformation("CV: {N} deduplicated, labelled samples", rows.Count);

            var dataView = mlContext.Data.LoadFromEnumerable(rows);

            var featureBlock = mlContext.Transforms.Conversion
                .MapValueToKey(nameof(CvRow.Label))
                .Append(mlContext.Transforms.Concatenate("Features",
                    nameof(CvRow.Tempo),      nameof(CvRow.Energy),
                    nameof(CvRow.Danceability), nameof(CvRow.Valence),
                    nameof(CvRow.Acousticness), nameof(CvRow.Loudness),
                    nameof(CvRow.Speechiness),  nameof(CvRow.Instrumentalness)))
                .Append(mlContext.Transforms.NormalizeMinMax("Features"));

            IEstimator<ITransformer> pipeline;
            if (lib == MlLibrary.FastTree)
                pipeline = featureBlock.Append(
                    mlContext.MulticlassClassification.Trainers.OneVersusAll(
                        mlContext.BinaryClassification.Trainers.FastTree(
                            labelColumnName: "Label", featureColumnName: "Features",
                            numberOfTrees: 100, numberOfLeaves: 31, learningRate: 0.1),
                        labelColumnName: "Label"))
                    .Append(mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"));
            else
                pipeline = featureBlock.Append(
                    mlContext.MulticlassClassification.Trainers.LightGbm(
                        labelColumnName: "Label", featureColumnName: "Features",
                        numberOfIterations: 150, learningRate: 0.1, numberOfLeaves: 31))
                    .Append(mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"));

            var cvResults = mlContext.MulticlassClassification.CrossValidate(
                dataView, pipeline, numberOfFolds: folds, labelColumnName: "Label");

            var accuracies = cvResults.Select(r => r.Metrics.MacroAccuracy).ToList();
            var logLosses  = cvResults.Select(r => r.Metrics.LogLoss).ToList();

            double meanAcc  = accuracies.Average();
            double stdAcc   = Math.Sqrt(accuracies.Average(a => Math.Pow(a - meanAcc, 2)));
            double meanLoss = logLosses.Average();

            _logger.LogInformation(
                "CV complete: mean accuracy {Mean:P2} ± {Std:P2} (log-loss {Loss:F3})",
                meanAcc, stdAcc, meanLoss);

            var result = new CrossValidationResult(
                Folds:           folds,
                FoldAccuracies:  accuracies.Select(a => Math.Round(a, 4)).ToList(),
                MeanAccuracy:    Math.Round(meanAcc, 4),
                StdAccuracy:     Math.Round(stdAcc, 4),
                MeanLogLoss:     Math.Round(meanLoss, 4),
                TrainingSamples: rows.Count,
                ComputedAt:      DateTimeOffset.UtcNow);

            _metricsStore.SetCrossValidation(result);
            return result;
        }

        private static string DetermineGenre(SpotifyTrackData t)
        {
            if (t.Instrumentalness >= 0.8 && t.Energy <= 0.3) return "Classical/Ambient";
            if (t.Speechiness >= 0.15) return "Hip-Hop/Rap";
            if (t.Acousticness >= 0.7 && t.Energy <= 0.5) return "Acoustic/Folk";
            if (t.Energy >= 0.7 && t.Danceability >= 0.65 && t.Acousticness <= 0.2) return "Electronic/Dance";
            if (t.Energy >= 0.7 && t.Acousticness <= 0.25 && t.Speechiness < 0.1) return "Rock";
            if (t.Danceability >= 0.65 && t.Energy >= 0.4 && t.Energy <= 0.8) return "R&B/Soul";
            if (t.Valence >= 0.5 && t.Danceability >= 0.5 && t.Energy >= 0.45) return "Pop";
            if (t.Energy >= 0.4f && t.Acousticness >= 0.15f && t.Acousticness <= 0.65f) return "Indie/Alternative";
            return "Pop";
        }
    }

    public class CvRow
    {
        public float Tempo { get; set; }
        public float Energy { get; set; }
        public float Danceability { get; set; }
        public float Valence { get; set; }
        public float Acousticness { get; set; }
        public float Loudness { get; set; }
        public float Speechiness { get; set; }
        public float Instrumentalness { get; set; }
        [ColumnName("Label")]
        public string Label { get; set; } = string.Empty;
    }
}
