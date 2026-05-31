using AiAgents.MusicAgent.Data;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Pure C# K-Means clustering over the Spotify dataset's audio feature space.
    ///
    /// Algorithm:
    ///   1. K-Means++ initialisation — spreads initial centroids to reduce bad starts.
    ///   2. Assign each point to its nearest centroid (Euclidean distance).
    ///   3. Recompute centroids as the mean of assigned points.
    ///   4. Repeat until convergence (no assignments change) or max iterations.
    ///
    /// This demonstrates unsupervised learning: the model discovers structure in the
    /// data without using genre labels — clusters often align with genre groupings
    /// even though the algorithm never sees them.
    /// </summary>
    public class KMeansClusteringService
    {
        private readonly ILogger<KMeansClusteringService> _logger;
        private readonly MlMetricsStore _metricsStore;

        // Feature names in the order used by the feature vector (public for reuse by KNN/Anomaly services)
        public static readonly string[] FeatureNames =
        [
            "Energy", "Danceability", "Valence", "Acousticness",
            "Speechiness", "Instrumentalness", "Tempo (norm)", "Loudness (norm)"
        ];

        public KMeansClusteringService(
            ILogger<KMeansClusteringService> logger,
            MlMetricsStore metricsStore)
        {
            _logger = logger;
            _metricsStore = metricsStore;
        }

        /// <summary>
        /// Runs K-Means on the dataset and publishes results to MlMetricsStore.
        /// Call after the Spotify dataset is loaded (startup or retrain).
        /// </summary>
        public ClusteringSnapshot Cluster(List<SpotifyTrackData> dataset, int k = 8)
        {
            if (dataset.Count == 0)
                throw new InvalidOperationException("Dataset is empty — load Spotify CSV first.");

            k = Math.Clamp(k, 2, 20);
            _logger.LogInformation("K-Means: clustering {N} tracks into k={K}…", dataset.Count, k);

            var points = dataset.Select(ToFeatureVector).ToArray();

            // K-Means++ initialisation
            var centroids = InitialisePlusPlus(points, k, seed: 42);

            int[] assignments = new int[points.Length];
            const int MaxIterations = 100;
            bool changed = true;

            for (int iter = 0; iter < MaxIterations && changed; iter++)
            {
                changed = false;
                // Assignment step
                for (int i = 0; i < points.Length; i++)
                {
                    int best = NearestCentroid(points[i], centroids);
                    if (best != assignments[i]) { assignments[i] = best; changed = true; }
                }
                // Update step — recompute centroids as mean of assigned points
                for (int c = 0; c < k; c++)
                {
                    var clusterPts = points.Where((_, i) => assignments[i] == c).ToArray();
                    if (clusterPts.Length == 0) continue;
                    centroids[c] = MeanVector(clusterPts);
                }
            }

            // Compute inertia (total within-cluster sum of squared distances)
            double inertia = 0;
            for (int i = 0; i < points.Length; i++)
                inertia += SquaredDistance(points[i], centroids[assignments[i]]);

            // Map cluster IDs to genre labels for dominant-genre annotation
            var genreLabels = dataset.Select(DetermineGenreLabel).ToArray();

            var clusters = BuildClusterInfos(k, points, assignments, centroids, genreLabels);

            var snapshot = new ClusteringSnapshot(
                K:           k,
                TotalPoints: dataset.Count,
                Inertia:     Math.Round(inertia, 2),
                Clusters:    clusters,
                ComputedAt:  DateTimeOffset.UtcNow);

            _metricsStore.SetClustering(snapshot);
            _logger.LogInformation(
                "K-Means done — inertia={Inertia:F1}, sizes=[{Sizes}]",
                snapshot.Inertia,
                string.Join(",", clusters.Select(c => c.Size)));

            return snapshot;
        }

        // ── Algorithm internals ──────────────────────────────────────────────────

        /// <summary>
        /// K-Means++ initialisation: each new centroid is chosen with probability
        /// proportional to its squared distance from the nearest existing centroid.
        /// This spreads centroids out, giving much faster and more stable convergence
        /// than random initialisation.
        /// </summary>
        private static double[][] InitialisePlusPlus(double[][] points, int k, int seed)
        {
            var rng = new Random(seed);
            var centroids = new double[k][];

            // First centroid: pick uniformly at random
            centroids[0] = (double[])points[rng.Next(points.Length)].Clone();

            for (int c = 1; c < k; c++)
            {
                // D²-weighted sampling
                var distances = points.Select(p =>
                    Enumerable.Range(0, c).Min(j => SquaredDistance(p, centroids[j]))
                ).ToArray();

                double total = distances.Sum();
                double threshold = rng.NextDouble() * total;
                double cumulative = 0;
                int chosen = 0;
                for (int i = 0; i < distances.Length; i++)
                {
                    cumulative += distances[i];
                    if (cumulative >= threshold) { chosen = i; break; }
                }
                centroids[c] = (double[])points[chosen].Clone();
            }

            return centroids;
        }

        private static int NearestCentroid(double[] point, double[][] centroids)
        {
            int best = 0;
            double bestDist = double.MaxValue;
            for (int i = 0; i < centroids.Length; i++)
            {
                double d = SquaredDistance(point, centroids[i]);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            return best;
        }

        private static double SquaredDistance(double[] a, double[] b)
        {
            double sum = 0;
            for (int i = 0; i < a.Length; i++) { double d = a[i] - b[i]; sum += d * d; }
            return sum;
        }

        private static double[] MeanVector(double[][] points)
        {
            int dim = points[0].Length;
            var mean = new double[dim];
            foreach (var p in points)
                for (int i = 0; i < dim; i++) mean[i] += p[i];
            for (int i = 0; i < dim; i++) mean[i] /= points.Length;
            return mean;
        }

        // ── Feature extraction ───────────────────────────────────────────────────

        /// <summary>Public so KNNSimilarityService and AnomalyDetectionService can reuse the same feature space.</summary>
        public static double[] ToFeatureVector(SpotifyTrackData t) =>
        [
            t.Energy,
            t.Danceability,
            t.Valence,
            t.Acousticness,
            t.Speechiness,
            t.Instrumentalness,
            Math.Clamp(t.Tempo / 220.0, 0, 1),
            Math.Clamp((t.Loudness + 60.0) / 60.0, 0, 1)
        ];

        /// <summary>Converts a domain Characteristics object to the same 8-D feature space.</summary>
        public static double[] ToFeatureVector(Domain.Entities.Characteristics c) =>
        [
            c.Energy,
            c.Danceability,
            c.Valence,
            c.Acousticness,
            c.Speechiness,
            c.Instrumentalness,
            Math.Clamp(c.Tempo / 220.0, 0, 1),
            Math.Clamp((c.Loudness + 60.0) / 60.0, 0, 1)
        ];

        // ── Result construction ──────────────────────────────────────────────────

        private static IReadOnlyList<ClusterInfo> BuildClusterInfos(
            int k,
            double[][] points,
            int[] assignments,
            double[][] centroids,
            string[] genreLabels)
        {
            var clusters = new List<ClusterInfo>(k);
            for (int c = 0; c < k; c++)
            {
                var indices = Enumerable.Range(0, points.Length)
                    .Where(i => assignments[i] == c)
                    .ToList();

                if (indices.Count == 0)
                {
                    clusters.Add(new ClusterInfo(c, 0, "Empty",
                        FeatureNames.Zip(centroids[c]).ToDictionary(x => x.First, x => Math.Round(x.Second, 3)),
                        AvgIntraClusterDistance: 0,
                        StdIntraClusterDistance: 0));
                    continue;
                }

                // Dominant genre = most frequent genre label in this cluster
                var dominant = indices
                    .GroupBy(i => genreLabels[i])
                    .OrderByDescending(g => g.Count())
                    .First().Key;

                var centroidDict = FeatureNames
                    .Zip(centroids[c])
                    .ToDictionary(x => x.First, x => Math.Round(x.Second, 3));

                // Intra-cluster distances (for anomaly scoring)
                var distances = indices
                    .Select(i => Math.Sqrt(SquaredDistance(points[i], centroids[c])))
                    .ToArray();
                double avgDist = distances.Average();
                double stdDist = distances.Length > 1
                    ? Math.Sqrt(distances.Select(d => Math.Pow(d - avgDist, 2)).Average())
                    : 0;

                clusters.Add(new ClusterInfo(c, indices.Count, dominant, centroidDict,
                    AvgIntraClusterDistance: Math.Round(avgDist, 4),
                    StdIntraClusterDistance: Math.Round(stdDist, 4)));
            }
            return clusters;
        }

        private static string DetermineGenreLabel(SpotifyTrackData t)
        {
            if (t.Instrumentalness >= 0.8 && t.Energy <= 0.3) return "Classical/Ambient";
            if (t.Speechiness >= 0.15) return "Hip-Hop/Rap";
            if (t.Acousticness >= 0.7 && t.Energy <= 0.5) return "Acoustic/Folk";
            if (t.Energy >= 0.7 && t.Danceability >= 0.65 && t.Acousticness <= 0.2) return "Electronic/Dance";
            if (t.Energy >= 0.7 && t.Acousticness <= 0.25 && t.Speechiness < 0.1) return "Rock";
            if (t.Danceability >= 0.65 && t.Energy >= 0.4 && t.Energy <= 0.8) return "R&B/Soul";
            if (t.Valence >= 0.5 && t.Danceability >= 0.5 && t.Energy >= 0.45) return "Pop";
            if (t.Energy >= 0.4 && t.Acousticness >= 0.15 && t.Acousticness <= 0.65) return "Indie/Alternative";
            return "Pop";
        }
    }
}
