namespace AiAgents.MusicAgent.Domain.Entities
{
    public class ComparisonVote
    {
        public Guid Id { get; set; }
        public Guid TrackAId { get; set; }
        public Track TrackA { get; set; } = null!;
        public Guid TrackBId { get; set; }
        public Track TrackB { get; set; } = null!;
        public Guid WinnerTrackId { get; set; }
        public Track WinnerTrack { get; set; } = null!;
        public Guid VoterId { get; set; }
        public AppUser Voter { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
    }
}
