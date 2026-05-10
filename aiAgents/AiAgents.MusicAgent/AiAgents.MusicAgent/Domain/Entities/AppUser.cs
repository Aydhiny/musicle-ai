namespace AiAgents.MusicAgent.Domain.Entities
{
    public class AppUser
    {
        public Guid Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string NormalizedUserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string NormalizedEmail { get; set; } = string.Empty;
        public byte[] PasswordHash { get; set; } = Array.Empty<byte>();
        public byte[] PasswordSalt { get; set; } = Array.Empty<byte>();
        public string? Bio { get; set; }
        public string SettingsJson { get; set; } = "{}";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public bool IsActive { get; set; }

        public ICollection<HighlightPost> Posts { get; set; } = new List<HighlightPost>();
        public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
        public ICollection<PostLike> PostLikes { get; set; } = new List<PostLike>();
        public ICollection<CommentLike> CommentLikes { get; set; } = new List<CommentLike>();
        public ICollection<PostReaction> PostReactions { get; set; } = new List<PostReaction>();

        public ICollection<Sketch> Sketches { get; set; } = new List<Sketch>();
    }
}
