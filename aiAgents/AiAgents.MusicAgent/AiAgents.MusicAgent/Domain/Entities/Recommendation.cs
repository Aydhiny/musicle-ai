namespace AiAgents.MusicAgent.Domain.Entities
{
    public class Recommendation
    {
        public Guid Id { get; set; }
        public Guid TrackId { get; set; }
        public string SpotifySongName { get; set; } = string.Empty;
        public string SpotifyArtistName { get; set; } = string.Empty;
        public double SimilarityScore { get; set; }
        public int Popularity { get; set; }
        public DateTime CreatedAt { get; set; }

        // Navigation
        public Track Track { get; set; } = null!;
    }
}
