namespace AiAgents.MusicAgent.Domain.Entities
{
    public class PostLike
    {
        public Guid PostId { get; set; }
        public HighlightPost Post { get; set; } = null!;
        public Guid UserId { get; set; }
        public AppUser User { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
    }
}
