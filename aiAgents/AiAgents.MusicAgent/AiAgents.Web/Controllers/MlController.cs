using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.ML;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/ml")]
    public class MlController : ControllerBase
    {
        private readonly MlLibrarySettings _librarySettings;
        private readonly MlMetricsStore _metricsStore;
        private readonly IGenreClassifier _genreClassifier;
        private readonly AudioFeatureLearner _featureLearner;
        private readonly CommercialScorePredictor _commercialPredictor;
        private readonly ISpotifyDatasetLoader _datasetLoader;
        private readonly KMeansClusteringService _kMeans;
        private readonly ILogger<MlController> _logger;

        public MlController(
            MlLibrarySettings librarySettings,
            MlMetricsStore metricsStore,
            IGenreClassifier genreClassifier,
            AudioFeatureLearner featureLearner,
            CommercialScorePredictor commercialPredictor,
            ISpotifyDatasetLoader datasetLoader,
            KMeansClusteringService kMeans,
            ILogger<MlController> logger)
        {
            _librarySettings     = librarySettings;
            _metricsStore        = metricsStore;
            _genreClassifier     = genreClassifier;
            _featureLearner      = featureLearner;
            _commercialPredictor = commercialPredictor;
            _datasetLoader       = datasetLoader;
            _kMeans              = kMeans;
            _logger              = logger;
        }

        /// <summary>
        /// Returns the active library, all model metrics, and static pipeline metadata.
        /// Safe to poll — reads from the in-memory store, no DB or training involved.
        /// </summary>
        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                activeLibrary = _librarySettings.ActiveLibrary.ToString(),
                availableLibraries = new[]
                {
                    new
                    {
                        id          = "LightGBM",
                        name        = "LightGBM",
                        description = "Microsoft's leaf-wise gradient boosting. Faster training on large datasets; uses less memory. Default choice.",
                        badge       = "Default"
                    },
                    new
                    {
                        id          = "FastTree",
                        name        = "XGBoost (FastTree GBDT)",
                        description = "Level-wise gradient boosted decision trees — the same algorithm family as XGBoost. More regularised splits; slightly better on smaller datasets.",
                        badge       = "XGBoost-family"
                    }
                },
                models   = _metricsStore.All(),
                pipeline = new
                {
                    stages = new[]
                    {
                        new { step = 1, name = "Audio Ingestion",      description = "NAudio reads PCM samples. FFT extracts Energy, Tempo, Loudness, SpectralCentroid, ZeroCrossingRate, Instrumentalness." },
                        new { step = 2, name = "Feature Enrichment",   description = "AudioFeatureLearner replaces hand-written formulas with 5 regression models that predict Danceability, Valence, Acousticness, Speechiness, and ViralPotential from the raw signals." },
                        new { step = 3, name = "Genre Classification", description = "16-feature multiclass GBDT classifier maps the enriched feature vector to one of 9 genre labels. Interaction features encode known genre fingerprints." },
                        new { step = 4, name = "Scoring",              description = "CommercialScorePredictor (regression) combines the features and genre prediction into CommercialScore, ProductionScore, and ViralPotential (1–10 each)." },
                        new { step = 5, name = "Feedback Loop",        description = "User genre corrections are stored as high-weight (3×) training samples. TrainAsync() is called after each correction batch, closing the active-learning loop." }
                    }
                }
            });
        }

        /// <summary>
        /// Returns per-feature ANOVA F-statistic importance scores (0–100, normalised).
        /// Computed during the last genre classifier training run.
        /// </summary>
        [HttpGet("feature-importance")]
        public IActionResult GetFeatureImportance()
        {
            var snapshot = _metricsStore.Get("Genre Classifier");
            if (snapshot?.FeatureImportance == null)
                return Ok(new { ready = false, message = "Feature importance not yet computed — trigger a retrain first." });

            var ranked = snapshot.FeatureImportance
                .OrderByDescending(x => x.Value)
                .Select((x, i) => new { rank = i + 1, feature = x.Key, score = x.Value })
                .ToList();

            return Ok(new
            {
                ready   = true,
                method  = "ANOVA F-statistic (one-way, per feature)",
                tooltip = "Higher score = the feature varies more between genres than within a genre. Score is normalised to 0–100.",
                features = ranked
            });
        }

        /// <summary>
        /// Returns the full NxN confusion matrix from the last genre classifier training run.
        /// Rows = actual genre, columns = predicted genre.
        /// </summary>
        [HttpGet("confusion-matrix")]
        public IActionResult GetConfusionMatrix()
        {
            var snapshot = _metricsStore.Get("Genre Classifier");
            if (snapshot?.ConfusionMatrix == null || snapshot.GenreLabels == null)
                return Ok(new { ready = false, message = "Confusion matrix not yet available — trigger a retrain first." });

            return Ok(new
            {
                ready       = true,
                labels      = snapshot.GenreLabels,
                matrix      = snapshot.ConfusionMatrix,
                description = "confusionMatrix[actual][predicted] = count. " +
                              "The diagonal is correctly classified tracks; off-diagonal entries are misclassifications."
            });
        }

        /// <summary>
        /// Returns in-memory training history (last 20 runs) for learning-curve charts.
        /// Resets on server restart — persisting to DB is a future enhancement.
        /// </summary>
        [HttpGet("training-history")]
        public IActionResult GetTrainingHistory()
        {
            var history = _metricsStore.TrainingHistory;
            return Ok(new
            {
                count   = history.Count,
                runs    = history,
                message = history.Count == 0
                    ? "No training runs recorded yet — trigger at least one retrain."
                    : null
            });
        }

        /// <summary>
        /// Returns the K-Means clustering result computed over the Spotify dataset.
        /// k defaults to 8. Re-clusters if k differs from the cached result.
        /// </summary>
        [HttpGet("clusters")]
        public IActionResult GetClusters([FromQuery] int k = 8)
        {
            k = Math.Clamp(k, 2, 20);
            var cached = _metricsStore.GetClustering();

            if (cached != null && cached.K == k)
                return Ok(cached);

            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
                return BadRequest(new { error = "Spotify dataset not loaded yet." });

            var snapshot = _kMeans.Cluster(dataset, k);
            return Ok(snapshot);
        }

        /// <summary>
        /// Switch the active ML library and retrain all three models.
        /// Training runs synchronously — allow 15–60 s depending on dataset size.
        /// </summary>
        [HttpPost("library")]
        public async Task<IActionResult> SwitchLibrary(
            [FromBody] SwitchLibraryRequest req,
            CancellationToken ct)
        {
            if (!Enum.TryParse<MlLibrary>(req.Library, ignoreCase: true, out var lib))
                return BadRequest(new { error = $"Unknown library '{req.Library}'. Valid values: LightGBM, FastTree." });

            _librarySettings.Switch(lib);
            _logger.LogInformation("ML library switched to {Library} — retraining all models", lib);

            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
                return Ok(new { activeLibrary = lib.ToString(), warning = "Dataset not loaded — models not retrained." });

            await Task.WhenAll(
                Task.Run(() => _featureLearner.Train(dataset),      ct),
                Task.Run(() => _commercialPredictor.Train(dataset), ct)
            );

            await _genreClassifier.TrainAsync(ct);

            // Re-cluster with the same k as the cached result (default 8)
            var prevK = _metricsStore.GetClustering()?.K ?? 8;
            await Task.Run(() => _kMeans.Cluster(dataset, prevK), ct);

            _logger.LogInformation("All models retrained with {Library}", lib);

            return Ok(new
            {
                activeLibrary = lib.ToString(),
                models        = _metricsStore.All()
            });
        }

        /// <summary>
        /// Trigger a retrain of all models without switching library.
        /// Useful after importing new feedback data.
        /// </summary>
        [HttpPost("retrain")]
        public async Task<IActionResult> Retrain(CancellationToken ct)
        {
            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
                return BadRequest(new { error = "Spotify dataset not loaded. Restart the backend to reload it." });

            await Task.WhenAll(
                Task.Run(() => _featureLearner.Train(dataset),      ct),
                Task.Run(() => _commercialPredictor.Train(dataset), ct)
            );
            await _genreClassifier.TrainAsync(ct);

            var prevK = _metricsStore.GetClustering()?.K ?? 8;
            await Task.Run(() => _kMeans.Cluster(dataset, prevK), ct);

            return Ok(new
            {
                activeLibrary = _librarySettings.ActiveLibrary.ToString(),
                models        = _metricsStore.All()
            });
        }
    }

    public record SwitchLibraryRequest(string Library);
}
