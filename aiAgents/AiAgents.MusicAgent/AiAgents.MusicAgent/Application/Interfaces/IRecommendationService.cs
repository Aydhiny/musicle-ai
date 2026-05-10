using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IRecommendationService
    {
        Task<List<SpotifyTrackDto>> FindSimilarTracksAsync(Characteristics characteristics, CancellationToken ct);
    }

    public class SpotifyTrackDto
    {
        public string SongName { get; set; } = string.Empty;
        public string ArtistName { get; set; } = string.Empty;
        public double Tempo { get; set; }
        public double Energy { get; set; }
        public double Danceability { get; set; }
        public double SimilarityScore { get; set; }
        public int Popularity { get; set; }
    }
}
