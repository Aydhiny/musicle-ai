using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Distance-based anomaly detection using K-Means cluster geometry.
    ///
    /// Algorithm:
    ///   1. Project the new track into the same 8-D feature space as the clusters.
    ///   2. Find its nearest cluster centroid.
    ///   3. Compute the Euclidean distance from the track to that centroid.
    ///   4. Compare that distance against the cluster's mean intra-cluster distance
    ///      (µ) and standard deviation (σ) — both computed during K-Means training.
    ///   5. z-score = (distance − µ) / σ  → how many σ above the cluster mean.
    ///
    /// A z-score > 2 means the track is farther from its nearest centroid than
    /// 97.5% of the tracks that actually belong to that cluster.
    /// This is a principled unsupervised outlier metric — no labels needed.
    ///
    /// Note: this is sensitive to k (number of clusters). More clusters → smaller
    /// clusters → more sensitive detection. Default k=8 is a reasonable trade-off.
    /// </summary>
    public class AnomalyDetectionService
    {
        private readonly MlMetricsStore _metricsStore;
        private readonly ILogger<AnomalyDetectionService> _logger;

        public AnomalyDetectionService(
            MlMetricsStore metricsStore,
            ILogger<AnomalyDetectionService> logger)
        {
            _metricsStore = metricsStore;
            _logger = logger;
        }

        /// <summary>
        /// Scores a track for anomalousness given the current cluster snapshot.
        /// Returns null if no clustering has been computed yet.
        /// </summary>
        public AnomalyResult? Score(Characteristics characteristics)
        {
            var clustering = _metricsStore.GetClustering();
            if (clustering == null)
            {
                _logger.LogWarning("Anomaly: no cluster snapshot available");
                return null;
            }

            var query = KMeansClusteringService.ToFeatureVector(characteristics);

            // Find nearest cluster
            ClusterInfo? nearest = null;
            double nearestDist = double.MaxValue;

            foreach (var cluster in clustering.Clusters)
            {
                if (cluster.Size == 0) continue;
                var centroid = KMeansClusteringService.FeatureNames
                    .Select(f => cluster.Centroid.TryGetValue(f, out var v) ? v : 0.0)
                    .ToArray();
                double dist = EuclideanDistance(query, centroid);
                if (dist < nearestDist) { nearestDist = dist; nearest = cluster; }
            }

            if (nearest == null)
                return null;

            // Z-score relative to this cluster's intra-cluster distance distribution
            double mu    = nearest.AvgIntraClusterDistance;
            double sigma = nearest.StdIntraClusterDistance;
            double z     = sigma > 1e-8 ? (nearestDist - mu) / sigma : 0;

            // Anomaly score: sigmoid-ish mapping of z into [0,100]
            // z=0 → 0 (exactly average), z=2 → ~75, z=3+ → ~95
            double rawScore = Math.Max(0, Math.Min(100, (z / 4.0) * 100));
            int anomalyScore = (int)Math.Round(rawScore);

            bool isAnomaly = z > 2.0;

            string interpretation = z switch
            {
                < -1  => $"Highly typical {nearest.DominantGenre} track — very close to the cluster centre.",
                < 0   => $"Typical {nearest.DominantGenre} sound — slightly below average distance from the cluster centre.",
                < 1   => $"Normal variation within the {nearest.DominantGenre} cluster.",
                < 2   => $"Somewhat atypical — sits at the edge of the {nearest.DominantGenre} cluster.",
                < 3   => $"Unusual track — more than 2σ from the nearest cluster centre. Crosses genre boundaries.",
                _     => $"Highly anomalous — this track doesn't fit neatly into any of the {clustering.K} discovered clusters."
            };

            _logger.LogDebug(
                "Anomaly score: dist={Dist:F4} µ={Mu:F4} σ={Sigma:F4} z={Z:F2} → {Score}",
                nearestDist, mu, sigma, z, anomalyScore);

            return new AnomalyResult(
                AnomalyScore:          anomalyScore,
                IsAnomaly:             isAnomaly,
                ZScore:                Math.Round(z, 2),
                NearestClusterGenre:   nearest.DominantGenre,
                DistanceToCentroid:    Math.Round(nearestDist, 4),
                AvgClusterDistance:    Math.Round(mu, 4),
                Interpretation:        interpretation);
        }

        private static double EuclideanDistance(double[] a, double[] b)
        {
            double sum = 0;
            for (int i = 0; i < Math.Min(a.Length, b.Length); i++)
            {
                double d = a[i] - b[i];
                sum += d * d;
            }
            return Math.Sqrt(sum);
        }
    }

    public record AnomalyResult(
        int AnomalyScore,
        bool IsAnomaly,
        double ZScore,
        string NearestClusterGenre,
        double DistanceToCentroid,
        double AvgClusterDistance,
        string Interpretation);
}
