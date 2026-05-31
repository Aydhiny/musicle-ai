using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Pearson correlation matrix over audio features in the Spotify dataset.
    ///
    /// The Pearson correlation coefficient r(x,y) ∈ [−1,+1] measures the linear
    /// relationship between two features:
    ///   +1  = perfectly positively correlated (when one goes up, so does the other)
    ///   0   = no linear relationship
    ///   −1  = perfectly negatively correlated
    ///
    /// r(x,y) = [Σ(xi−x̄)(yi−ȳ)] / [√(Σ(xi−x̄)²) · √(Σ(yi−ȳ)²)]
    ///
    /// This reveals multicollinearity (e.g. Energy and Loudness are often correlated),
    /// which explains why some features may have low ANOVA F-scores despite being
    /// physically meaningful — their information is already captured by another feature.
    ///
    /// Results are cached as a singleton after first computation.
    /// </summary>
    public class FeatureCorrelationService
    {
        private readonly ISpotifyDatasetLoader _datasetLoader;
        private readonly MlMetricsStore _metricsStore;
        private readonly ILogger<FeatureCorrelationService> _logger;

        public static readonly string[] Features =
        [
            "Energy", "Danceability", "Valence", "Acousticness",
            "Speechiness", "Instrumentalness", "Tempo (norm)", "Loudness (norm)",
            "Liveness", "Popularity (norm)"
        ];

        public FeatureCorrelationService(
            ISpotifyDatasetLoader datasetLoader,
            MlMetricsStore metricsStore,
            ILogger<FeatureCorrelationService> logger)
        {
            _datasetLoader = datasetLoader;
            _metricsStore  = metricsStore;
            _logger        = logger;
        }

        /// <summary>
        /// Computes the Pearson correlation matrix from the cached Spotify dataset
        /// and stores it in MlMetricsStore. Safe to call at startup.
        /// </summary>
        public FeatureCorrelationSnapshot Compute()
        {
            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
                throw new InvalidOperationException("Dataset not loaded.");

            _logger.LogInformation("Computing Pearson correlation matrix on {N} tracks…", dataset.Count);

            // Build feature matrix: rows = tracks, cols = features
            var matrix = dataset.Select(ToVector).ToArray();
            int n = matrix.Length;
            int d = Features.Length;

            // Compute column means
            var means = new double[d];
            for (int j = 0; j < d; j++)
                means[j] = matrix.Average(row => row[j]);

            // Compute column std deviations
            var stds = new double[d];
            for (int j = 0; j < d; j++)
            {
                double variance = matrix.Average(row => Math.Pow(row[j] - means[j], 2));
                stds[j] = Math.Sqrt(variance);
            }

            // Pearson correlation r[i][j]
            var corr = new double[d][];
            for (int i = 0; i < d; i++)
            {
                corr[i] = new double[d];
                for (int j = 0; j < d; j++)
                {
                    if (i == j) { corr[i][j] = 1.0; continue; }
                    if (stds[i] < 1e-10 || stds[j] < 1e-10) { corr[i][j] = 0; continue; }

                    double cov = matrix.Average(row => (row[i] - means[i]) * (row[j] - means[j]));
                    corr[i][j] = Math.Round(cov / (stds[i] * stds[j]), 3);
                }
            }

            // Log top 5 highest-magnitude off-diagonal correlations
            var topPairs = (from i in Enumerable.Range(0, d)
                            from j in Enumerable.Range(i + 1, d - i - 1)
                            orderby Math.Abs(corr[i][j]) descending
                            select $"{Features[i]}↔{Features[j]}: {corr[i][j]:+0.000;-0.000}")
                           .Take(5);
            _logger.LogInformation("Top feature correlations: {Pairs}", string.Join(", ", topPairs));

            var snapshot = new FeatureCorrelationSnapshot(
                Features:    Features,
                Matrix:      corr.Select(row => (IReadOnlyList<double>)row).ToList(),
                SampleSize:  n,
                ComputedAt:  DateTimeOffset.UtcNow);

            _metricsStore.SetCorrelations(snapshot);
            return snapshot;
        }

        /// <summary>Returns cached result or re-computes if not yet available.</summary>
        public FeatureCorrelationSnapshot GetOrCompute()
        {
            return _metricsStore.GetCorrelations() ?? Compute();
        }

        private static double[] ToVector(SpotifyTrackData t) =>
        [
            t.Energy,
            t.Danceability,
            t.Valence,
            t.Acousticness,
            t.Speechiness,
            t.Instrumentalness,
            Math.Clamp(t.Tempo / 220.0, 0, 1),
            Math.Clamp((t.Loudness + 60.0) / 60.0, 0, 1),
            t.Liveness,
            t.Popularity / 100.0
        ];
    }
}
