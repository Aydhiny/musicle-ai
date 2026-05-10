namespace AiAgents.MusicAgent.Domain.Entities
{
    public class CommentLike
    {
        public Guid CommentId { get; set; }
        public PostComment Comment { get; set; } = null!;
        public Guid UserId { get; set; }
        public AppUser User { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
    }
}
