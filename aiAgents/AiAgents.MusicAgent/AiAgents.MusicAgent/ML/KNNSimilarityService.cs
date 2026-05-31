using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// K-Nearest Neighbours similarity search over the Spotify dataset.
    ///
    /// Given a track's audio feature vector, returns the k most similar Spotify tracks
    /// measured by normalised Euclidean distance in the same 8-D feature space used
    /// by K-Means clustering.
    ///
    /// Why Euclidean distance?
    ///   Each feature is already in [0,1] after normalisation, so Euclidean distance
    ///   treats every dimension equally — no feature dominates due to scale.
    ///   Cosine similarity would ignore magnitude, which matters here (a quiet acoustic
    ///   track vs a loud acoustic track are genuinely different).
    ///
    /// This is a brute-force KNN (O(n · d) per query) — acceptable for the Spotify
    /// dataset (~10 k tracks). For millions of tracks you'd use an ANN index (HNSW/Faiss).
    /// </summary>
    public class KNNSimilarityService
    {
        private readonly ISpotifyDatasetLoader _datasetLoader;
        private readonly ILogger<KNNSimilarityService> _logger;

        public static readonly string[] FeatureNames = KMeansClusteringService.FeatureNames;

        public KNNSimilarityService(
            ISpotifyDatasetLoader datasetLoader,
            ILogger<KNNSimilarityService> logger)
        {
            _datasetLoader = datasetLoader;
            _logger = logger;
        }

        /// <summary>
        /// Returns the k nearest Spotify tracks to the given characteristics vector.
        /// Results are sorted by ascending distance (most similar first).
        /// </summary>
        public IReadOnlyList<SimilarTrack> FindSimilar(Characteristics characteristics, int k = 5)
        {
            k = Math.Clamp(k, 1, 20);
            var dataset = _datasetLoader.GetCachedDataset();
            if (dataset.Count == 0)
            {
                _logger.LogWarning("KNN: dataset not loaded");
                return Array.Empty<SimilarTrack>();
            }

            var query = KMeansClusteringService.ToFeatureVector(characteristics);

            // Brute-force: compute distance to every track, take k smallest
            var results = dataset
                .Select(t =>
                {
                    var vec  = KMeansClusteringService.ToFeatureVector(t);
                    double dist = EuclideanDistance(query, vec);
                    double sim  = Math.Max(0, 1.0 - dist / Math.Sqrt(query.Length)); // normalise to [0,1]
                    return new { Track = t, Distance = dist, Similarity = sim };
                })
                .OrderBy(x => x.Distance)
                .Take(k)
                .Select((x, rank) =>
                {
                    // Per-feature delta so the frontend can show which dimensions are similar
                    var queryVec = KMeansClusteringService.ToFeatureVector(characteristics);
                    var trackVec = KMeansClusteringService.ToFeatureVector(x.Track);
                    var deltas   = FeatureNames
                        .Zip(queryVec.Zip(trackVec))
                        .ToDictionary(
                            p => p.First,
                            p => Math.Round(Math.Abs(p.Second.First - p.Second.Second), 3));

                    return new SimilarTrack(
                        Rank:         rank + 1,
                        SongName:     x.Track.SongName,
                        ArtistName:   x.Track.ArtistName,
                        Popularity:   x.Track.Popularity,
                        Distance:     Math.Round(x.Distance, 4),
                        SimilarityPct: Math.Round(x.Similarity * 100, 1),
                        Features:     new Dictionary<string, double>
                        {
                            ["Energy"]           = x.Track.Energy,
                            ["Danceability"]     = x.Track.Danceability,
                            ["Valence"]          = x.Track.Valence,
                            ["Acousticness"]     = x.Track.Acousticness,
                            ["Tempo"]            = x.Track.Tempo,
                        },
                        FeatureDeltas: deltas);
                })
                .ToList();

            _logger.LogDebug("KNN: found {K} similar tracks (nearest dist={D:F4})", results.Count, results[0].Distance);
            return results;
        }

        private static double EuclideanDistance(double[] a, double[] b)
        {
            double sum = 0;
            for (int i = 0; i < a.Length; i++) { double d = a[i] - b[i]; sum += d * d; }
            return Math.Sqrt(sum);
        }
    }

    public record SimilarTrack(
        int Rank,
        string SongName,
        string ArtistName,
        int Popularity,
        double Distance,
        double SimilarityPct,
        IReadOnlyDictionary<string, double> Features,
        IReadOnlyDictionary<string, double> FeatureDeltas);
}
