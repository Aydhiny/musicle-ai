namespace AiAgents.MusicAgent.Domain.Entities
{
    public class TrackRevision
    {
        public Guid Id { get; set; }
        public Guid TrackId { get; set; }
        public Track Track { get; set; } = null!;
        public Guid PreviousTrackId { get; set; }
        public Track PreviousTrack { get; set; } = null!;
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
