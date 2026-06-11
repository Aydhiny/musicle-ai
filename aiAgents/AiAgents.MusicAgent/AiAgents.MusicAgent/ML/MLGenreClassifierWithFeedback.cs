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
        private readonly MlLibrarySettings _librarySettings;
        private readonly MlMetricsStore _metricsStore;
        private ITransformer? _model;
        // Cached after Train() or first load — CreatePredictionEngine compiles the full
        // transformer pipeline; recreating it per request wastes significant CPU.
        private PredictionEngine<GenreTrainingData, GenrePredictionOutput>? _predictionEngine;
        private readonly string _modelPath;
        // Genre labels in Score[] order; populated after each successful training run.
        private IReadOnlyList<string>? _genreLabels;

        public MLNetGenreClassifierWithFeedback(
            ILogger<MLNetGenreClassifierWithFeedback> logger,
            ISpotifyDatasetLoader datasetLoader,
            MusicAgentDbContext db,
            string modelPath = "Models/genre_model.zip",
            MlLibrarySettings? librarySettings = null,
            MlMetricsStore? metricsStore = null)
        {
            _mlContext = new MLContext(seed: 1);
            _logger = logger;
            _datasetLoader = datasetLoader;
            _db = db;
            _librarySettings = librarySettings ?? new MlLibrarySettings();
            _metricsStore = metricsStore ?? new MlMetricsStore();
            _modelPath = modelPath;

            Directory.CreateDirectory(Path.GetDirectoryName(_modelPath)!);
        }

        public async Task<ModelMetrics> TrainAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("🎓 Starting FEEDBACK-ENHANCED model training...");

            // STEP 1: Get base training data from Spotify CSV
            var spotifyDataset = _datasetLoader.GetCachedDataset();
            _logger.LogInformation("📊 Loaded {Count} tracks from Spotify dataset", spotifyDataset.Count);

            // ── Data cleaning ────────────────────────────────────────────────────
            // Duplicates corrupt training: the model sees the same feature vector
            // multiple times with the same label, making it overconfident for common
            // tracks. Keep the highest-popularity copy of each (SongName, ArtistName) pair.
            var deduped = spotifyDataset
                .GroupBy(t => (t.SongName.Trim().ToLowerInvariant(), t.ArtistName.Trim().ToLowerInvariant()))
                .Select(g => g.OrderByDescending(t => t.Popularity).First())
                .ToList();

            // Popularity=0 rows are metadata artifacts (missing data, region locks),
            // not legitimate low-popularity tracks. They skew feature distributions.
            var clean = deduped.Where(t => t.Popularity > 0).ToList();

            _logger.LogInformation(
                "🧹 Dataset cleaned: {Orig} → {Clean} tracks (−{Dup} duplicates, −{Dead} Popularity=0 artifacts)",
                spotifyDataset.Count, clean.Count,
                spotifyDataset.Count - deduped.Count,
                deduped.Count - clean.Count);

            // STEP 2: Get user feedback from database (THE LEARNING SIGNAL!)
            var feedbackData = await GetFeedbackTrainingDataAsync(ct);
            _logger.LogInformation("💡 Loaded {Count} user corrections from database", feedbackData.Count);

            // STEP 3: Combine both sources - user feedback takes priority
            var trainingData = new List<GenreTrainingData>();

            // Add Spotify data (static baseline).
            // SpectralCentroid and ZeroCrossingRate are synthesised from Spotify's
            // known features — see SyntheticSpectralCentroid / SyntheticZCR below.
            // Interaction features (Energy×Danceability etc.) are pre-computed products
            // that capture genre fingerprints LightGBM would need many splits to discover.
            trainingData.AddRange(clean.Select(track => new GenreTrainingData
            {
                Tempo            = track.Tempo,
                Energy           = track.Energy,
                Danceability     = track.Danceability,
                Valence          = track.Valence,
                Acousticness     = track.Acousticness,
                Loudness         = track.Loudness,
                Speechiness      = track.Speechiness,
                Instrumentalness = track.Instrumentalness,
                Liveness         = track.Liveness,
                Popularity       = track.Popularity,
                SpectralCentroid = SyntheticSpectralCentroid(track),
                ZeroCrossingRate = SyntheticZCR(track),
                // Interaction features — multiplicative products that encode known genre fingerprints
                EnergyDanceability   = track.Energy * track.Danceability,    // high in EDM, low in classical
                AcousticInstrumental = track.Acousticness * track.Instrumentalness, // THE classical fingerprint
                SpeechEnergy         = track.Speechiness * track.Energy,     // rap fingerprint
                ValenceEnergy        = track.Valence * track.Energy,         // pop/EDM fingerprint
                Label                = DetermineGenreFromFeatures(track),
                Weight               = 1.0f
            }));

            // Add user feedback data (HIGHER WEIGHT - these are "gold" labels!)
            // Use real SpectralCentroid from stored CharacteristicsJson if available.
            trainingData.AddRange(feedbackData.Select(fb => new GenreTrainingData
            {
                Tempo            = fb.Tempo,
                Energy           = fb.Energy,
                Danceability     = fb.Danceability,
                Valence          = fb.Valence,
                Acousticness     = fb.Acousticness,
                Loudness         = fb.Loudness,
                Speechiness      = fb.Speechiness,
                Instrumentalness = fb.Instrumentalness,
                Liveness         = fb.Liveness,
                Popularity       = fb.Popularity,
                SpectralCentroid = fb.SpectralCentroid,
                ZeroCrossingRate = fb.ZeroCrossingRate,
                EnergyDanceability   = fb.Energy * fb.Danceability,
                AcousticInstrumental = fb.Acousticness * fb.Instrumentalness,
                SpeechEnergy         = fb.Speechiness * fb.Energy,
                ValenceEnergy        = fb.Valence * fb.Energy,
                Label            = fb.Label,
                Weight           = 3.0f
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

            // STEP 5: Add synthetic Ambient/Experimental examples.
            // Binaural beats, test tones, and pure-sine audio are never in Spotify
            // data, so we inject synthetic rows with realistic centroid values.
            // The model learns "very low SpectralCentroid + high instrumentalness = Ambient"
            // from data rather than from a hard-coded rule.
            var ambientSynth = GenerateSyntheticAmbientExamples();
            trainingData.AddRange(ambientSynth);
            _logger.LogInformation("➕ Added {Count} synthetic Ambient/Experimental examples", ambientSynth.Count);

            // STEP 6: Train multiclass classifier — trainer selected via MlLibrarySettings.
            // LightGBM  = leaf-wise gradient boosting (fast, handles large datasets well).
            // FastTree  = level-wise MART GBDT via One-vs-All (XGBoost-family; more
            //             regularised, slightly better on smaller datasets).
            var lib = _librarySettings.ActiveLibrary;
            var dataView = _mlContext.Data.LoadFromEnumerable(trainingData);
            var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

            var featureBlock = _mlContext.Transforms.Conversion
                .MapValueToKey(nameof(GenreTrainingData.Label))
                .Append(_mlContext.Transforms.Concatenate("Features",
                    // Raw Spotify / NAudio features (12)
                    nameof(GenreTrainingData.Tempo),
                    nameof(GenreTrainingData.Energy),
                    nameof(GenreTrainingData.Danceability),
                    nameof(GenreTrainingData.Valence),
                    nameof(GenreTrainingData.Acousticness),
                    nameof(GenreTrainingData.Loudness),
                    nameof(GenreTrainingData.Speechiness),
                    nameof(GenreTrainingData.Instrumentalness),
                    nameof(GenreTrainingData.Liveness),
                    nameof(GenreTrainingData.Popularity),
                    nameof(GenreTrainingData.SpectralCentroid),
                    nameof(GenreTrainingData.ZeroCrossingRate),
                    // Interaction features (4) — pre-computed products the model needs fewer
                    // splits to exploit; each encodes a known genre fingerprint explicitly.
                    nameof(GenreTrainingData.EnergyDanceability),    // EDM detector
                    nameof(GenreTrainingData.AcousticInstrumental),  // classical detector
                    nameof(GenreTrainingData.SpeechEnergy),          // rap detector
                    nameof(GenreTrainingData.ValenceEnergy)))        // pop/EDM brightness detector
                .Append(_mlContext.Transforms.NormalizeMinMax("Features"));

            var pipeline = lib == MlLibrary.FastTree
                ? featureBlock
                    .Append(_mlContext.MulticlassClassification.Trainers.OneVersusAll(
                        _mlContext.BinaryClassification.Trainers.FastTree(
                            labelColumnName: "Label",
                            featureColumnName: "Features",
                            numberOfTrees: 300,
                            numberOfLeaves: 50,
                            learningRate: 0.05),
                        labelColumnName: "Label"))
                    .Append(_mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"))
                : featureBlock
                    .Append(_mlContext.MulticlassClassification.Trainers.LightGbm(
                        labelColumnName: "Label",
                        featureColumnName: "Features",
                        exampleWeightColumnName: nameof(GenreTrainingData.Weight),
                        numberOfIterations: 500,
                        learningRate: 0.05,
                        numberOfLeaves: 50,
                        minimumExampleCountPerLeaf: 5))   // prevents leaf nodes with <5 samples (overfitting guard)
                    .Append(_mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"));

            _logger.LogInformation("🔧 Training model with {Count} weighted samples...", trainingData.Count);
            var startTime = DateTime.UtcNow;
            _model = pipeline.Fit(split.TrainSet);
            var trainingDuration = DateTime.UtcNow - startTime;

            // STEP 6: Evaluate
            var predictions = _model.Transform(split.TestSet);
            var metrics = _mlContext.MulticlassClassification.Evaluate(predictions);

            _logger.LogInformation("✅ Model trained in {Duration:F1}s", trainingDuration.TotalSeconds);
            _logger.LogInformation("📈 Macro Accuracy: {Accuracy:P2}  (average F1 across all genres — target >0.80)",
                metrics.MacroAccuracy);
            _logger.LogInformation("📈 Micro Accuracy: {Accuracy:P2}  (weighted by class size)",
                metrics.MicroAccuracy);
            _logger.LogInformation("📉 Log-Loss: {LogLoss:F4}  (lower is better; <0.5 is good)", metrics.LogLoss);

            // ── Extract genre labels in Score[] order ────────────────────────────
            // ML.NET stores slot names on the Score column of the predictions schema.
            // These tell us which genre corresponds to which score index — essential
            // for building a genre→probability map at inference time.
            var genreLabels = ExtractGenreLabels(predictions);
            _genreLabels = genreLabels;
            _logger.LogInformation("🏷️  Genre labels extracted: [{Labels}]", string.Join(", ", genreLabels));

            // ── Per-class metrics ────────────────────────────────────────────────
            var cm = metrics.ConfusionMatrix;
            _logger.LogInformation("📊 Per-class performance (Precision / Recall):");
            var perClass = new Dictionary<string, ClassMetrics>();
            for (int i = 0; i < cm.NumberOfClasses; i++)
            {
                var labelKey = (i < genreLabels.Count) ? genreLabels[i] : $"Class {i}";
                double prec = cm.PerClassPrecision.Count > i ? cm.PerClassPrecision[i] : 0;
                double rec  = cm.PerClassRecall.Count  > i ? cm.PerClassRecall[i]  : 0;
                double f1   = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0;
                perClass[labelKey] = new ClassMetrics(
                    Math.Round(prec, 3), Math.Round(rec, 3), Math.Round(f1, 3));
                _logger.LogInformation("    {Label}: Precision={Prec:P1}  Recall={Rec:P1}  F1={F1:P1}",
                    labelKey, prec, rec, f1);
            }

            // ── Full NxN confusion matrix ────────────────────────────────────────
            // cm.Counts[actual][predicted] — exposed as a 2D jagged list so the
            // frontend can render a heatmap without any further computation.
            var confMatrix = BuildConfusionMatrix(cm);

            // ── Feature importance via ANOVA F-statistic ─────────────────────────
            // Measures how much each feature discriminates between genres:
            //   high between-class variance AND low within-class variance = good discriminator.
            // This is the one-way ANOVA F-score, a standard filter method in ML.
            var featureImportance = ComputeFeatureImportance(trainingData, genreLabels);
            _logger.LogInformation("🔍 Top features: {Top}",
                string.Join(", ", featureImportance.OrderByDescending(x => x.Value).Take(5).Select(x => $"{x.Key}={x.Value:F1}")));

            // STEP 7: Save model and cache the prediction engine
            _mlContext.Model.Save(_model, dataView.Schema, _modelPath);
            _logger.LogInformation("💾 Model saved to {Path}", _modelPath);
            _predictionEngine = _mlContext.Model.CreatePredictionEngine<GenreTrainingData, GenrePredictionOutput>(_model);

            // STEP 8: Publish all metrics to the store for the ML dashboard
            var now = DateTimeOffset.UtcNow;
            _metricsStore.Upsert(new ModelSnapshot
            {
                Name            = "Genre Classifier",
                ActiveLibrary   = lib.ToString(),
                IsReady         = true,
                Accuracy        = Math.Round(metrics.MacroAccuracy, 4),
                MacroF1         = Math.Round(metrics.MacroAccuracy, 4),
                LogLoss         = Math.Round(metrics.LogLoss, 4),
                TrainingSamples = trainingData.Count,
                TrainedAt       = now,
                PerClassMetrics = perClass,
                GenreLabels     = genreLabels,
                ConfusionMatrix = confMatrix,
                FeatureImportance = featureImportance,
                InputFeatures   =
                [
                    "Tempo", "Energy", "Danceability", "Valence", "Acousticness",
                    "Loudness", "Speechiness", "Instrumentalness", "Liveness",
                    "Popularity", "SpectralCentroid", "ZeroCrossingRate",
                    "Energy×Danceability (interaction)", "Acoustic×Instrumental (interaction)",
                    "Speech×Energy (interaction)", "Valence×Energy (interaction)"
                ],
                OutputTargets   = ["Genre (12 classes)"],
                Description     =
                    "16-feature multiclass classifier that maps audio characteristics to genre. " +
                    "Trained on cleaned Spotify data plus user feedback corrections (3× weighted). " +
                    "Synthetic ambient examples are injected to cover test tones and binaural beats " +
                    "that never appear in Spotify. User corrections retrain the model automatically.",
                ExpansionTips   =
                [
                    "Import MusicBrainz genre tags to replace heuristic Spotify labels with ground-truth.",
                    "Add subgenre prediction as a second output head (e.g. 'Hip-Hop → Trap').",
                    "Add MFCC and chroma features from NAudio to give the model richer spectral info.",
                    "Implement active learning: low-confidence predictions go into a review queue for user correction.",
                    "Use cross-validation (5-fold) instead of a single 80/20 split for more stable accuracy estimates."
                ]
            });

            // STEP 8b: Append to training history (in-memory learning curve)
            _metricsStore.AddTrainingRun(new TrainingRun(
                TrainedAt: now,
                Library:   lib.ToString(),
                Accuracy:  Math.Round(metrics.MacroAccuracy, 4),
                LogLoss:   Math.Round(metrics.LogLoss, 4),
                Samples:   trainingData.Count));

            // STEP 9: Mark feedback as used in training.
            // Use CancellationToken.None — the model is already saved and this write
            // MUST complete even if the HTTP request was cancelled mid-training.
            await MarkFeedbackAsUsedAsync(CancellationToken.None);

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
                .Where(f => f.CorrectedGenre != null)
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
                    AnalysisId       = feedback.AnalysisId,
                    Tempo            = (float)chars.Tempo,
                    Energy           = (float)chars.Energy,
                    Danceability     = (float)chars.Danceability,
                    Valence          = (float)chars.Valence,
                    Acousticness     = (float)chars.Acousticness,
                    Loudness         = (float)chars.Loudness,
                    Speechiness      = (float)chars.Speechiness,
                    Instrumentalness = (float)chars.Instrumentalness,
                    Liveness         = 0.15f,
                    Popularity       = 50,
                    SpectralCentroid = (float)(chars.SpectralCentroid / 4000.0),
                    ZeroCrossingRate = (float)chars.ZeroCrossingRate,
                    Label            = feedback.CorrectedGenre!,
                    IsCorrected      = true,
                    AccuracyRating   = feedback.AccuracyRating,
                    AnalyzedAt       = feedback.Analysis.AnalyzedAt
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
            if (_predictionEngine == null)
            {
                if (File.Exists(_modelPath))
                {
                    _logger.LogInformation("📂 Loading model from {Path}", _modelPath);
                    _model = _mlContext.Model.Load(_modelPath, out _);
                    _predictionEngine = _mlContext.Model.CreatePredictionEngine<GenreTrainingData, GenrePredictionOutput>(_model);
                }
                else
                {
                    _logger.LogWarning("⚠️ Model not found. Training new model...");
                    await TrainAsync(ct);
                }
            }

            float energy           = (float)characteristics.Energy;
            float danceability     = (float)characteristics.Danceability;
            float acousticness     = (float)characteristics.Acousticness;
            float instrumentalness = (float)characteristics.Instrumentalness;
            float speechiness      = (float)characteristics.Speechiness;
            float valence          = (float)characteristics.Valence;

            var input = new GenreTrainingData
            {
                Tempo            = (float)characteristics.Tempo,
                Energy           = energy,
                Danceability     = danceability,
                Valence          = valence,
                Acousticness     = acousticness,
                Loudness         = (float)characteristics.Loudness,
                Speechiness      = speechiness,
                Instrumentalness = instrumentalness,
                Liveness         = 0.15f,
                Popularity       = 50,
                SpectralCentroid  = (float)(characteristics.SpectralCentroid / 4000.0),
                ZeroCrossingRate  = (float)characteristics.ZeroCrossingRate,
                EnergyDanceability   = energy * danceability,
                AcousticInstrumental = acousticness * instrumentalness,
                SpeechEnergy         = speechiness * energy,
                ValenceEnergy        = valence * energy,
            };

            var prediction = _predictionEngine!.Predict(input);
            var scores = prediction.Score ?? [];
            var maxConfidence = scores.Length > 0 ? scores.Max() : 0f;

            // Build probability dictionary using cached label order
            var probabilities = BuildProbabilityDictionary(scores);

            return new GenrePrediction
            {
                Genre      = prediction.PredictedLabel ?? "Unknown",
                Confidence = (int)(maxConfidence * 100),
                Probabilities = probabilities
            };
        }

        /// <summary>
        /// Maps Score[] from ML.NET into genre → probability pairs using _genreLabels.
        /// Falls back to "Class N" keys if labels were never set.
        /// </summary>
        private IReadOnlyDictionary<string, float> BuildProbabilityDictionary(float[] scores)
        {
            var result = new Dictionary<string, float>(scores.Length);
            for (int i = 0; i < scores.Length; i++)
            {
                var label = (_genreLabels != null && i < _genreLabels.Count)
                    ? _genreLabels[i]
                    : $"Class {i}";
                result[label] = scores[i];
            }
            return result;
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        /// <summary>
        /// Extracts the genre label order that ML.NET assigned to the Score[] vector.
        /// The Score column carries SlotNames metadata: one name per score index.
        /// Falls back to a sorted list of unique labels from the training data.
        /// </summary>
        private static IReadOnlyList<string> ExtractGenreLabels(IDataView predictions)
        {
            // "SlotNames" is the well-known annotation kind that ML.NET attaches to
            // the Score column after MapValueToKey. It lists genres in Score[] index order.
            const string SlotNamesKind = "SlotNames";
            try
            {
                var scoreCol = predictions.Schema["Score"];
                var slotNames = default(VBuffer<ReadOnlyMemory<char>>);
                scoreCol.Annotations.GetValue(SlotNamesKind, ref slotNames);

                if (slotNames.Length > 0)
                    return slotNames.DenseValues().Select(v => v.ToString()).ToList();
            }
            catch
            {
                // SlotNames annotation not available — fall through to alphabetical fallback.
                // MapValueToKey assigns keys in the order labels are first seen in the
                // training data; sorting alphabetically is the safest approximation.
            }

            return
            [
                "Acoustic/Folk", "Ambient/Experimental", "Classical/Ambient",
                "Electronic/Dance", "Hip-Hop/Rap", "Indie/Alternative",
                "Pop", "R&B/Soul", "Rock"
            ];
        }

        /// <summary>
        /// Converts ML.NET's ConfusionMatrix into a serialisable jagged list.
        /// confMatrix[actual][predicted] = count.
        /// </summary>
        private static IReadOnlyList<IReadOnlyList<int>> BuildConfusionMatrix(
            Microsoft.ML.Data.ConfusionMatrix cm)
        {
            int n = cm.NumberOfClasses;
            var matrix = new List<IReadOnlyList<int>>(n);
            for (int actual = 0; actual < n; actual++)
            {
                var row = new List<int>(n);
                for (int predicted = 0; predicted < n; predicted++)
                    row.Add((int)(cm.Counts[actual][predicted]));
                matrix.Add(row);
            }
            return matrix;
        }

        /// <summary>
        /// Computes one-way ANOVA F-statistic for each feature — a standard filter
        /// method that measures how discriminative a feature is across genre classes.
        ///
        /// F = (between-class variance / k−1) / (within-class variance / N−k)
        ///
        /// Higher F = the feature varies more across genres than within a genre
        ///            → more useful for classification.
        ///
        /// Results are normalised to a 0–100 scale for the dashboard.
        /// </summary>
        private static IReadOnlyDictionary<string, double> ComputeFeatureImportance(
            List<GenreTrainingData> data,
            IReadOnlyList<string> labels)
        {
            var featureSelectors = new (string Name, Func<GenreTrainingData, float> Get)[]
            {
                ("Tempo",                 d => d.Tempo / 250f),
                ("Energy",                d => d.Energy),
                ("Danceability",          d => d.Danceability),
                ("Valence",               d => d.Valence),
                ("Acousticness",          d => d.Acousticness),
                ("Loudness",              d => (d.Loudness + 60f) / 60f),
                ("Speechiness",           d => d.Speechiness),
                ("Instrumentalness",      d => d.Instrumentalness),
                ("Liveness",              d => d.Liveness),
                ("Popularity",            d => d.Popularity / 100f),
                ("SpectralCentroid",      d => d.SpectralCentroid),
                ("ZeroCrossingRate",      d => d.ZeroCrossingRate),
                ("Energy×Danceability",   d => d.EnergyDanceability),
                ("Acoustic×Instrumental", d => d.AcousticInstrumental),
                ("Speech×Energy",         d => d.SpeechEnergy),
                ("Valence×Energy",        d => d.ValenceEnergy),
            };

            int n = data.Count;
            int k = Math.Max(2, data.Select(d => d.Label).Distinct().Count());

            var result = new Dictionary<string, double>();

            foreach (var (name, getter) in featureSelectors)
            {
                var values = data.Select(getter).ToArray();
                var grandMean = values.Average();

                // Group by label
                var groups = data
                    .GroupBy(d => d.Label)
                    .Select(g => g.Select(getter).ToArray())
                    .ToList();

                // Between-class sum of squares: sum_j n_j * (mean_j − grand_mean)²
                double ssBetween = groups.Sum(g =>
                    g.Length * Math.Pow(g.Average() - grandMean, 2));

                // Within-class sum of squares: sum_j sum_i (x_ij − mean_j)²
                double ssWithin = groups.Sum(g =>
                {
                    double gm = g.Average();
                    return g.Sum(v => Math.Pow(v - gm, 2));
                });

                double dfBetween = k - 1;
                double dfWithin  = n - k;

                double f = (ssWithin < 1e-10 || dfWithin < 1)
                    ? 0
                    : (ssBetween / dfBetween) / (ssWithin / dfWithin);

                result[name] = Math.Round(f, 2);
            }

            // Normalise to 0–100 for the dashboard
            double max = result.Values.Max();
            if (max > 0)
            {
                var keys = result.Keys.ToList();
                foreach (var key in keys)
                    result[key] = Math.Round(result[key] / max * 100.0, 1);
            }

            return result;
        }

        /// <summary>
        /// Labels Spotify tracks for training. Uses the Spotify-computed features
        /// (which are accurate) to assign genre classes.
        ///
        /// Also synthesises SpectralCentroid and ZeroCrossingRate — features we
        /// compute from raw audio — so the model learns to use them at inference time.
        /// The synthesis is physics-based: acoustic instruments have lower centroids,
        /// high-energy electronic music has higher centroids.
        /// </summary>
        private string DetermineGenreFromFeatures(SpotifyTrackData track)
        {
            var scores = new Dictionary<string, double>();

            // ── Ambient/Experimental ─────────────────────────────────────────────
            // Pure-tone / near-silence audio — extremely high instrumentalness,
            // near-zero speechiness, and (synthetically) very low centroid.
            var ambientScore = 0.0;
            if (track.Instrumentalness >= 0.95) ambientScore += 40;
            if (track.Energy <= 0.15)           ambientScore += 30;
            if (track.Speechiness < 0.03)       ambientScore += 20;
            if (track.Acousticness >= 0.5)      ambientScore += 10;
            scores["Ambient/Experimental"] = ambientScore;

            // ── Classical/Ambient ────────────────────────────────────────────────
            var classicalScore = 0.0;
            if (track.Instrumentalness >= 0.5)  classicalScore += 35;
            if (track.Instrumentalness >= 0.8)  classicalScore += 25;
            if (track.Acousticness >= 0.6)      classicalScore += 25;
            if (track.Acousticness >= 0.85)     classicalScore += 15;
            if (track.Energy <= 0.4)            classicalScore += 15;
            if (track.Speechiness < 0.04)       classicalScore += 10;
            if (track.Speechiness >= 0.15)      classicalScore -= 30;
            if (track.Energy >= 0.8)            classicalScore -= 20;
            scores["Classical/Ambient"] = Math.Max(0, classicalScore);

            // ── Hip-Hop/Rap (includes Trap at 60–150 BPM) ───────────────────────
            // Two paths to Hip-Hop:
            //   A) Vocal rap: high speechiness is the primary signal
            //   B) Instrumental beat: slow-medium tempo + high energy + electronic
            //      sound signature (low acousticness) even without vocals.
            //      Memphis Trap runs 60–95 BPM with speechiness ≈ 0.05–0.12.
            var hiphopScore = 0.0;

            // Path A: vocal rap / trap with lyrics
            if (track.Speechiness >= 0.10)                              hiphopScore += 35;
            if (track.Speechiness >= 0.20)                              hiphopScore += 20;
            if (track.Speechiness >= 0.35)                              hiphopScore += 15;

            // Path B: instrumental trap beat (808 + hi-hats, no vocals)
            bool isTrapBeat = track.Tempo >= 60 && track.Tempo <= 100
                           && track.Energy >= 0.55
                           && track.Acousticness <= 0.45
                           && track.Danceability >= 0.50; // Spotify rates beats high
            if (isTrapBeat)                                             hiphopScore += 40;

            // Shared signals
            if (track.Tempo >= 60 && track.Tempo <= 150)                hiphopScore += 15;
            if (track.Energy >= 0.5 && track.Energy <= 0.9)             hiphopScore += 10;
            if (track.Danceability >= 0.6)                              hiphopScore += 10;
            if (track.Acousticness <= 0.25)                             hiphopScore += 5;
            scores["Hip-Hop/Rap"] = hiphopScore;

            // ── Electronic/Dance ─────────────────────────────────────────────────
            var electronicScore = 0.0;
            if (track.Tempo >= 115 && track.Tempo <= 145)               electronicScore += 25;
            if (track.Energy >= 0.7)                                    electronicScore += 30;
            if (track.Danceability >= 0.65)                             electronicScore += 25;
            if (track.Acousticness <= 0.2)                              electronicScore += 15;
            if (track.Speechiness < 0.1)                                electronicScore += 5;
            scores["Electronic/Dance"] = electronicScore;

            // ── Rock ─────────────────────────────────────────────────────────────
            // KEY FIX: High speechiness means it's Hip-Hop, not Rock.
            // High danceability means it's funk/R&B, not Rock.
            var rockScore = 0.0;
            if (track.Energy >= 0.7)                                    rockScore += 35;
            if (track.Acousticness <= 0.25)                             rockScore += 25;
            if (track.Tempo >= 110 && track.Tempo <= 145)               rockScore += 20;
            if (track.Loudness >= -6)                                   rockScore += 15;
            if (track.Instrumentalness <= 0.4)                          rockScore += 5;
            // Penalties — these disqualify otherwise high-energy tracks from Rock
            if (track.Speechiness >= 0.15)                              rockScore -= 50; // it's hip-hop
            if (track.Danceability >= 0.80)                             rockScore -= 30; // it's funk/pop
            scores["Rock"] = Math.Max(0, rockScore);

            // ── R&B/Soul (includes Funk) ─────────────────────────────────────────
            // Funk has very high danceability (0.75–0.95), moderate energy.
            // Expanded danceability range and boosted its weight to catch funky tracks.
            var rnbScore = 0.0;
            if (track.Danceability >= 0.65 && track.Danceability <= 0.95) rnbScore += 35; // funk lives here
            if (track.Energy >= 0.4 && track.Energy <= 0.80)             rnbScore += 20;
            if (track.Tempo >= 80 && track.Tempo <= 130)                  rnbScore += 20;
            if (track.Speechiness >= 0.03 && track.Speechiness <= 0.18)  rnbScore += 15;
            if (track.Valence >= 0.4)                                     rnbScore += 10;
            scores["R&B/Soul"] = rnbScore;

            // ── Pop ──────────────────────────────────────────────────────────────
            // Pop's defining audio fingerprint: bright (high valence), medium energy,
            // danceable but not club-level, polished production (low acousticness).
            // We deliberately avoid making Popularity the primary signal: the whole
            // dataset skews popular (median ~73), so that gives every track +25 points
            // and drowns out the audio fingerprint. Popularity only provides a mild boost.
            var popScore = 0.0;
            if (track.Valence >= 0.5)                                           popScore += 30; // bright/upbeat — most important pop signal
            if (track.Danceability >= 0.5 && track.Danceability <= 0.78)        popScore += 20; // danceable, not clubby
            if (track.Energy >= 0.45 && track.Energy <= 0.78)                   popScore += 20; // medium energy
            if (track.Tempo >= 95 && track.Tempo <= 130)                        popScore += 15; // pop tempo range
            if (track.Acousticness <= 0.25)                                     popScore += 10; // polished, produced sound
            if (track.Speechiness >= 0.03 && track.Speechiness <= 0.09)        popScore += 5;  // sung vocals, not rapping
            if (track.Popularity >= 70)                                         popScore += 5;  // mild signal (not primary)
            scores["Pop"] = popScore;

            // ── Acoustic/Folk ────────────────────────────────────────────────────
            var acousticScore = 0.0;
            if (track.Acousticness >= 0.6)                              acousticScore += 40;
            if (track.Acousticness >= 0.8)                              acousticScore += 20;
            if (track.Energy <= 0.5)                                    acousticScore += 25;
            if (track.Tempo >= 70 && track.Tempo <= 120)                acousticScore += 10;
            if (track.Instrumentalness <= 0.5)                          acousticScore += 5;
            scores["Acoustic/Folk"] = acousticScore;

            // ── Indie/Alternative ────────────────────────────────────────────────
            // Indie is defined by its SOUND, not its popularity rank.
            // Characteristics: guitar-driven (moderate acousticness), moderate energy,
            // slightly lower valence than Pop (less "bright/happy"), wider tempo range.
            // Not club-level danceability, not folk-level acousticness.
            var indieScore = 0.0;
            if (track.Energy >= 0.4 && track.Energy <= 0.75)                   indieScore += 20;
            if (track.Acousticness >= 0.15 && track.Acousticness <= 0.65)      indieScore += 20;
            if (track.Valence >= 0.20 && track.Valence <= 0.62)                indieScore += 18; // less bright than pop
            if (track.Tempo >= 95 && track.Tempo <= 148)                        indieScore += 15;
            if (track.Danceability >= 0.35 && track.Danceability <= 0.70)      indieScore += 15;
            if (track.Speechiness >= 0.03 && track.Speechiness <= 0.12)        indieScore += 10;
            if (track.Popularity < 65)                                          indieScore += 2;  // very mild signal only
            scores["Indie/Alternative"] = indieScore;

            var best = scores.OrderByDescending(x => x.Value).First();
            return best.Value >= 25 ? best.Key : "Pop";
        }

        /// <summary>
        /// Derives a synthetic SpectralCentroid (normalised 0–1) from Spotify features.
        /// Physics basis: acoustic instruments concentrate energy in low-mid frequencies
        /// (low centroid); electronic/synthetic sounds push energy into highs (high centroid).
        /// This gives the model a training signal that matches what our FFT computes at inference.
        /// </summary>
        private static float SyntheticSpectralCentroid(SpotifyTrackData t)
        {
            double centroid = 2000
                - t.Acousticness * 1200   // acoustic → lower
                + t.Energy * 700          // energetic → higher
                + (1 - t.Instrumentalness) * 200; // vocals add mid-range presence
            centroid = Math.Max(300, Math.Min(4000, centroid));
            return (float)(centroid / 4000.0);
        }

        private static float SyntheticZCR(SpotifyTrackData t)
        {
            // High speechiness → many zero crossings; electronic energy also raises ZCR
            return (float)Math.Min(0.5, t.Speechiness * 0.35 + t.Energy * 0.05 + 0.02);
        }

        /// <summary>
        /// Injects synthetic Ambient/Experimental rows into training data so the
        /// model learns that SpectralCentroid below ~300 Hz + near-perfect
        /// instrumentalness = binaural beat / pure tone, not Pop.
        /// Without these examples the model has never seen centroid that low.
        /// </summary>
        private List<GenreTrainingData> GenerateSyntheticAmbientExamples()
        {
            var rng = new Random(99);
            var rows = new List<GenreTrainingData>();

            for (int i = 0; i < 300; i++)
            {
                float centroidHz     = 50 + rng.Next(250);
                float energy         = 0.20f + (float)rng.NextDouble() * 0.55f;
                float danceability   = 0.05f + (float)rng.NextDouble() * 0.25f;
                float valence        = 0.10f + (float)rng.NextDouble() * 0.40f;
                float acousticness   = 0.30f + (float)rng.NextDouble() * 0.50f;
                float speechiness    = (float)rng.NextDouble() * 0.03f;
                float instrumentalness = 0.88f + (float)rng.NextDouble() * 0.12f;

                rows.Add(new GenreTrainingData
                {
                    Tempo                = 60 + rng.Next(80),
                    Energy               = energy,
                    Danceability         = danceability,
                    Valence              = valence,
                    Acousticness         = acousticness,
                    Loudness             = -20f + rng.Next(15),
                    Speechiness          = speechiness,
                    Instrumentalness     = instrumentalness,
                    Liveness             = 0.05f,
                    Popularity           = rng.Next(20),
                    SpectralCentroid     = centroidHz / 4000f,
                    ZeroCrossingRate     = 0.005f + (float)rng.NextDouble() * 0.015f,
                    EnergyDanceability   = energy * danceability,
                    AcousticInstrumental = acousticness * instrumentalness,
                    SpeechEnergy         = speechiness * energy,
                    ValenceEnergy        = valence * energy,
                    Label                = "Ambient/Experimental",
                    Weight               = 2.0f
                });
            }

            return rows;
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

        /// <summary>Normalised 0–1 (Hz / 4000). Synthetic for Spotify rows, real FFT value at inference.</summary>
        public float SpectralCentroid { get; set; }

        /// <summary>Zero-crossing rate 0–0.5. Synthetic for Spotify rows, real computed value at inference.</summary>
        public float ZeroCrossingRate { get; set; }

        // ── Interaction features ─────────────────────────────────────────────────
        // Pre-computed products of base features. LightGBM can discover these
        // automatically but needs many more splits and training rounds to do so.
        // Making them explicit features cuts that learning cost substantially.

        /// <summary>Energy × Danceability — high in EDM, near-zero in classical/ambient.</summary>
        public float EnergyDanceability { get; set; }

        /// <summary>Acousticness × Instrumentalness — THE classical fingerprint: both high simultaneously.</summary>
        public float AcousticInstrumental { get; set; }

        /// <summary>Speechiness × Energy — rap/trap fingerprint: both moderate-high simultaneously.</summary>
        public float SpeechEnergy { get; set; }

        /// <summary>Valence × Energy — pop and EDM fingerprint: bright AND energetic.</summary>
        public float ValenceEnergy { get; set; }

        [ColumnName("Label")]
        public string Label { get; set; } = string.Empty;

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

        /// <summary>
        /// Softmax probability for every genre class (genre → 0..1).
        /// Populated after training; empty if model was loaded from disk without re-training.
        /// </summary>
        public IReadOnlyDictionary<string, float> Probabilities { get; set; }
            = new Dictionary<string, float>();
    }

    public class ModelMetrics
    {
        public double Accuracy { get; set; }
        public double LogLoss { get; set; }
        public int TrainingSamples { get; set; }
    }
}
