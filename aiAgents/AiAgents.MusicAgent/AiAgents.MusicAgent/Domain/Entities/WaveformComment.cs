namespace AiAgents.MusicAgent.Domain.Entities
{
    public class WaveformComment
    {
        public Guid Id { get; set; }
        public Guid TrackId { get; set; }
        public Track Track { get; set; } = null!;
        public Guid AuthorId { get; set; }
        public AppUser Author { get; set; } = null!;
        public double TimeSeconds { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
