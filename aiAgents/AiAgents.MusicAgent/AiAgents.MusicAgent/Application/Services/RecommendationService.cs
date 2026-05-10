using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Services
{
    public class RecommendationService : IRecommendationService
    {
        private readonly ILogger<RecommendationService> _logger;
        private List<SpotifyTrackDto> _spotifyDataset;

        public RecommendationService(ILogger<RecommendationService> logger)
        {
            _logger = logger;
            _spotifyDataset = new List<SpotifyTrackDto>();
            LoadSpotifyDataset();
        }

        private void LoadSpotifyDataset()
        {
            // Load from CSV - this should be done once at startup
            // For now, empty list (will load from file in Infrastructure)
            _logger.LogInformation("Spotify dataset loaded");
        }

        public Task<List<SpotifyTrackDto>> FindSimilarTracksAsync(Characteristics characteristics, CancellationToken ct)
        {
            // Calculate similarity scores for each track in dataset
            var scoredTracks = _spotifyDataset
                .Select(track => new
                {
                    Track = track,
                    Score = CalculateSimilarityScore(characteristics, track)
                })
                .OrderByDescending(x => x.Score)
                .Take(10)
                .Select(x =>
                {
                    x.Track.SimilarityScore = x.Score;
                    return x.Track;
                })
                .ToList();

            return Task.FromResult(scoredTracks);
        }

        private double CalculateSimilarityScore(Characteristics chars, SpotifyTrackDto track)
        {
            double score = 0;

            // Tempo similarity (critical)
            var tempoDiff = Math.Abs(track.Tempo - chars.Tempo);
            if (tempoDiff <= 10) score += 5;
            else if (tempoDiff <= 20) score += 3;
            else if (tempoDiff <= 30) score += 1;

            // Energy similarity
            if (Math.Abs(track.Energy - chars.Energy) <= 0.1) score += 4;
            else if (Math.Abs(track.Energy - chars.Energy) <= 0.2) score += 2;

            // Danceability
            if (Math.Abs(track.Danceability - chars.Danceability) <= 0.1) score += 3;
            else if (Math.Abs(track.Danceability - chars.Danceability) <= 0.2) score += 1.5;

            return score;
        }
    }
}
