namespace AiAgents.MusicAgent.Domain.Entities
{
    public class PostReaction
    {
        public Guid PostId { get; set; }
        public HighlightPost Post { get; set; } = null!;
        public Guid UserId { get; set; }
        public AppUser User { get; set; } = null!;
        public string Reaction { get; set; } = "like";
        public DateTime CreatedAt { get; set; }
    }
}
