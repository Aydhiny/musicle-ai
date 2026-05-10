namespace AiAgents.MusicAgent.Domain.Entities
{
    public class HighlightPost
    {
        public Guid Id { get; set; }
        public Guid AuthorId { get; set; }
        public AppUser Author { get; set; } = null!;
        public Guid? AnalysisId { get; set; }
        public Analysis? Analysis { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string ContentFormat { get; set; } = "markdown";
        public string MediaJson { get; set; } = "[]";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }

        public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
        public ICollection<PostLike> Likes { get; set; } = new List<PostLike>();
        public ICollection<PostReaction> Reactions { get; set; } = new List<PostReaction>();
    }
}
