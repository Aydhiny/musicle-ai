namespace AiAgents.MusicAgent.Domain.Entities
{
    public class PostComment
    {
        public Guid Id { get; set; }
        public Guid PostId { get; set; }
        public HighlightPost Post { get; set; } = null!;
        public Guid AuthorId { get; set; }
        public AppUser Author { get; set; } = null!;
        public Guid? ParentCommentId { get; set; }
        public PostComment? ParentComment { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }

        public ICollection<PostComment> Replies { get; set; } = new List<PostComment>();
        public ICollection<CommentLike> Likes { get; set; } = new List<CommentLike>();
    }
}
