using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.MusicAgent.ML;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
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
        private readonly FeatureCorrelationService _correlations;
        private readonly CrossValidationService _crossValidation;
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<MlController> _logger;

        public MlController(
            MlLibrarySettings librarySettings,
            MlMetricsStore metricsStore,
            IGenreClassifier genreClassifier,
            AudioFeatureLearner featureLearner,
            CommercialScorePredictor commercialPredictor,
            ISpotifyDatasetLoader datasetLoader,
            KMeansClusteringService kMeans,
            FeatureCorrelationService correlations,
            CrossValidationService crossValidation,
            MusicAgentDbContext db,
            ILogger<MlController> logger)
        {
            _librarySettings  = librarySettings;
            _metricsStore     = metricsStore;
            _genreClassifier  = genreClassifier;
            _featureLearner   = featureLearner;
            _commercialPredictor = commercialPredictor;
            _datasetLoader    = datasetLoader;
            _kMeans           = kMeans;
            _correlations     = correlations;
            _crossValidation  = crossValidation;
            _db               = db;
            _logger           = logger;
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
        /// Returns the Pearson correlation matrix over the Spotify dataset's audio features.
        /// Computed at startup; re-computed when the dataset changes.
        /// </summary>
        [HttpGet("correlations")]
        public IActionResult GetCorrelations()
        {
            var snapshot = _metricsStore.GetCorrelations();
            if (snapshot == null)
            {
                // Compute on demand if startup computation hasn't finished yet
                try
                {
                    snapshot = _correlations.GetOrCompute();
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            return Ok(new
            {
                ready      = true,
                features   = snapshot.Features,
                matrix     = snapshot.Matrix,
                sampleSize = snapshot.SampleSize,
                computedAt = snapshot.ComputedAt,
                description = "Pearson correlation matrix r[i][j] ∈ [−1,+1]. " +
                              "r close to +1 = highly positively correlated; −1 = negatively correlated; 0 = no linear relationship."
            });
        }

        /// <summary>
        /// Runs k-fold cross-validation on the genre classifier and returns per-fold metrics.
        /// CPU-bound: allow 30–120 s. Results are cached until the next call.
        /// </summary>
        [HttpPost("cross-validate")]
        public async Task<IActionResult> CrossValidate([FromQuery] int folds = 5, CancellationToken ct = default)
        {
            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
                return BadRequest(new { error = "Dataset not loaded." });

            CrossValidationResult result;
            try
            {
                result = await Task.Run(() => _crossValidation.Run(folds), ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Cross-validation failed");
                return StatusCode(500, new { error = ex.Message });
            }

            return Ok(result);
        }

        /// <summary>
        /// Returns the cached cross-validation result without re-running.
        /// </summary>
        [HttpGet("cross-validate")]
        public IActionResult GetCrossValidation()
        {
            var result = _metricsStore.GetCrossValidation();
            if (result == null)
                return Ok(new { ready = false, message = "No cross-validation run yet. POST to /api/ml/cross-validate to trigger one." });

            return Ok(new { ready = true, result });
        }

        /// <summary>
        /// Explains why a track was predicted as a given genre.
        ///
        /// Method: for each feature, compares the track's value to the known
        /// genre fingerprint (derived from ANOVA importance + typical feature ranges).
        /// Returns supporting evidence ("why this genre") and competing signals
        /// ("what almost made it another genre").
        /// </summary>
        [HttpPost("explain")]
        public IActionResult Explain([FromBody] ExplainRequest req)
        {
            var importanceSnapshot = _metricsStore.Get("Genre Classifier");
            var featureImportance  = importanceSnapshot?.FeatureImportance
                                     ?? new Dictionary<string, double>();

            // Genre fingerprints: for each genre, which features are typically high/low.
            // Derived from the training heuristics and known musicological patterns.
            var fingerprints = new Dictionary<string, Dictionary<string, string>>
            {
                ["Electronic/Dance"] = new() { ["Energy"] = "high", ["Danceability"] = "high", ["Acousticness"] = "low",  ["Speechiness"] = "low"  },
                ["Hip-Hop/Rap"]      = new() { ["Speechiness"] = "high", ["Energy"] = "moderate", ["Danceability"] = "high", ["Acousticness"] = "low" },
                ["Pop"]              = new() { ["Valence"] = "high", ["Danceability"] = "moderate", ["Energy"] = "moderate", ["Acousticness"] = "low" },
                ["Rock"]             = new() { ["Energy"] = "high", ["Acousticness"] = "low", ["Speechiness"] = "low", ["Instrumentalness"] = "low" },
                ["Acoustic/Folk"]    = new() { ["Acousticness"] = "high", ["Energy"] = "low", ["Instrumentalness"] = "moderate", ["Speechiness"] = "low" },
                ["R&B/Soul"]         = new() { ["Danceability"] = "high", ["Energy"] = "moderate", ["Valence"] = "moderate", ["Speechiness"] = "low" },
                ["Indie/Alternative"]= new() { ["Energy"] = "moderate", ["Acousticness"] = "moderate", ["Valence"] = "low", ["Danceability"] = "moderate" },
                ["Classical/Ambient"]= new() { ["Instrumentalness"] = "high", ["Acousticness"] = "high", ["Energy"] = "low", ["Speechiness"] = "low" },
                ["Ambient/Experimental"] = new() { ["Instrumentalness"] = "high", ["Energy"] = "low", ["Speechiness"] = "low" },
            };

            var trackValues = new Dictionary<string, double>
            {
                ["Energy"]           = req.Energy,
                ["Danceability"]     = req.Danceability,
                ["Valence"]          = req.Valence,
                ["Acousticness"]     = req.Acousticness,
                ["Speechiness"]      = req.Speechiness,
                ["Instrumentalness"] = req.Instrumentalness,
                ["Tempo (norm)"]     = req.Tempo / 220.0,
                ["Loudness (norm)"]  = (req.Loudness + 60.0) / 60.0,
                ["SpectralCentroid"] = req.SpectralCentroid / 4000.0,
            };

            // Threshold helpers
            bool IsHigh(double v)     => v >= 0.65;
            bool IsModerate(double v) => v >= 0.35 && v < 0.65;
            bool IsLow(double v)      => v < 0.35;

            var fingerprint = fingerprints.GetValueOrDefault(req.PredictedGenre, new Dictionary<string, string>());

            var supportingFeatures = new List<object>();
            var competingSignals   = new List<object>();

            foreach (var (feat, expected) in fingerprint)
            {
                if (!trackValues.TryGetValue(feat, out var val)) continue;
                var importance = featureImportance.TryGetValue(feat, out var imp) ? imp : 0;

                bool matches = expected switch
                {
                    "high"     => IsHigh(val),
                    "moderate" => IsModerate(val),
                    "low"      => IsLow(val),
                    _          => false
                };

                var entry = new
                {
                    feature   = feat,
                    value     = Math.Round(val, 3),
                    expected,
                    matches,
                    importance = Math.Round(importance, 1),
                    interpretation = matches
                        ? $"{feat} is {expected} ({val:P0}) — typical for {req.PredictedGenre}"
                        : $"{feat} is {(IsHigh(val) ? "high" : IsLow(val) ? "low" : "moderate")} ({val:P0}) — less typical; {expected} expected for {req.PredictedGenre}"
                };

                if (matches) supportingFeatures.Add(entry);
                else         competingSignals.Add(entry);
            }

            // Sort by importance descending
            supportingFeatures.Sort((a, b) =>
                ((double)((dynamic)b).importance).CompareTo((double)((dynamic)a).importance));
            competingSignals.Sort((a, b) =>
                ((double)((dynamic)b).importance).CompareTo((double)((dynamic)a).importance));

            return Ok(new
            {
                predictedGenre     = req.PredictedGenre,
                supportingFeatures = supportingFeatures.Take(4),
                competingSignals   = competingSignals.Take(3),
                explanation        = $"The model classified this track as {req.PredictedGenre} primarily " +
                                     $"based on {(supportingFeatures.Count > 0 ? ((dynamic)supportingFeatures[0]).feature : "audio features")} " +
                                     $"and {supportingFeatures.Count} other matching signals."
            });
        }

        /// <summary>
        /// Returns a genre distribution timeline from uploaded tracks in the database.
        /// Groups completed analyses by day and genre, showing how the upload pattern
        /// shifts over time — useful for detecting concept drift (model distribution shift).
        /// </summary>
        [HttpGet("genre-drift")]
        public async Task<IActionResult> GetGenreDrift(
            [FromQuery] int days = 30,
            CancellationToken ct = default)
        {
            days = Math.Clamp(days, 7, 365);
            var since = DateTime.UtcNow.AddDays(-days).Date;

            var rows = await _db.Analyses
                .AsNoTracking()
                .Where(a => a.AnalyzedAt >= since && !string.IsNullOrEmpty(a.Genre))
                .Select(a => new { a.Genre, Date = a.AnalyzedAt.Date, a.Confidence })
                .ToListAsync(ct);

            if (rows.Count == 0)
                return Ok(new { days, total = 0, timeline = Array.Empty<object>(), genreBreakdown = Array.Empty<object>() });

            // Daily genre counts
            var timeline = rows
                .GroupBy(r => r.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    date  = g.Key.ToString("yyyy-MM-dd"),
                    total = g.Count(),
                    avgConfidence = Math.Round(g.Average(r => r.Confidence), 1),
                    genres = g.GroupBy(r => r.Genre)
                               .ToDictionary(gg => gg.Key, gg => gg.Count())
                })
                .ToList();

            // Overall genre breakdown for the period
            var genreBreakdown = rows
                .GroupBy(r => r.Genre)
                .Select(g => new
                {
                    genre     = g.Key,
                    count     = g.Count(),
                    pct       = Math.Round(g.Count() * 100.0 / rows.Count, 1),
                    avgConf   = Math.Round(g.Average(r => r.Confidence), 1)
                })
                .OrderByDescending(x => x.count)
                .ToList();

            // Detect "drift": compare first-half vs second-half genre distribution
            var midpoint  = since.AddDays(days / 2);
            var firstHalf = rows.Where(r => r.Date < midpoint).GroupBy(r => r.Genre)
                               .ToDictionary(g => g.Key, g => g.Count());
            var secondHalf = rows.Where(r => r.Date >= midpoint).GroupBy(r => r.Genre)
                                .ToDictionary(g => g.Key, g => g.Count());

            int firstTotal  = firstHalf.Values.Sum();
            int secondTotal = secondHalf.Values.Sum();

            var driftSignals = new List<object>();
            if (firstTotal > 0 && secondTotal > 0)
            {
                var allGenres = firstHalf.Keys.Union(secondHalf.Keys);
                foreach (var genre in allGenres)
                {
                    double pct1 = (firstHalf.GetValueOrDefault(genre, 0) * 100.0) / firstTotal;
                    double pct2 = (secondHalf.GetValueOrDefault(genre, 0) * 100.0) / secondTotal;
                    double delta = pct2 - pct1;
                    if (Math.Abs(delta) >= 5)
                        driftSignals.Add(new { genre, pctFirst = Math.Round(pct1, 1), pctSecond = Math.Round(pct2, 1), delta = Math.Round(delta, 1) });
                }
                driftSignals.Sort((a, b) => Math.Abs(((dynamic)b).delta).CompareTo(Math.Abs(((dynamic)a).delta)));
            }

            return Ok(new
            {
                days,
                total          = rows.Count,
                since          = since.ToString("yyyy-MM-dd"),
                timeline,
                genreBreakdown,
                driftSignals,
                driftDetected  = driftSignals.Count > 0,
                description    = "Genre drift measures how the uploaded track distribution shifts over time. " +
                                 "If certain genres appear more in the second half of the period, the data " +
                                 "distribution is drifting — a signal to retrain or adjust the model."
            });
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

            // CancellationToken.None: training is a long-running write operation.
            // An HTTP disconnect mid-training must not leave models in a partial state.
            await Task.WhenAll(
                Task.Run(() => _featureLearner.Train(dataset)),
                Task.Run(() => _commercialPredictor.Train(dataset))
            );

            await _genreClassifier.TrainAsync(CancellationToken.None);

            // Re-cluster with the same k as the cached result (default 8)
            var prevK = _metricsStore.GetClustering()?.K ?? 8;
            await Task.Run(() => _kMeans.Cluster(dataset, prevK));

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

            // CancellationToken.None: training is a long-running write operation.
            // An HTTP disconnect mid-training must not leave models in a partial state.
            await Task.WhenAll(
                Task.Run(() => _featureLearner.Train(dataset)),
                Task.Run(() => _commercialPredictor.Train(dataset))
            );
            await _genreClassifier.TrainAsync(CancellationToken.None);

            var prevK = _metricsStore.GetClustering()?.K ?? 8;
            await Task.Run(() => _kMeans.Cluster(dataset, prevK));

            return Ok(new
            {
                activeLibrary = _librarySettings.ActiveLibrary.ToString(),
                models        = _metricsStore.All()
            });
        }
    }

    public record SwitchLibraryRequest(string Library);

    /// <summary>
    /// Input for the /explain endpoint — the audio features of a track to be explained.
    /// </summary>
    public record ExplainRequest(
        string PredictedGenre,
        double Energy,
        double Danceability,
        double Valence,
        double Acousticness,
        double Speechiness,
        double Instrumentalness,
        double Tempo,
        double Loudness,
        double SpectralCentroid,
        double ZeroCrossingRate);
}
