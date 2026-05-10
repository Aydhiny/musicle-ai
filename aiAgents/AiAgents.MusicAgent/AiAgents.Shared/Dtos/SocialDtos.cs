using System.ComponentModel.DataAnnotations;

namespace AiAgents.Shared.Dtos
{
    public sealed class PostMediaDto
    {
        [Required]
        [StringLength(20)]
        public string Type { get; set; } = "image";

        [Required]
        [StringLength(2048)]
        public string Url { get; set; } = string.Empty;

        [StringLength(200)]
        public string? Label { get; set; }

        [StringLength(100)]
        public string? ContentType { get; set; }

        public double? DurationSeconds { get; set; }
    }

    public sealed class AnalysisShareDto
    {
        public Guid AnalysisId { get; set; }
        public Guid TrackId { get; set; }
        public string Genre { get; set; } = string.Empty;
        public string Subgenre { get; set; } = string.Empty;
        public int Confidence { get; set; }
        public int CommercialScore { get; set; }
        public int ProductionScore { get; set; }
        public int ViralPotential { get; set; }
        public DateTime AnalyzedAt { get; set; }
        public string? AudioUrl { get; set; }
    }

    public sealed class CreateHighlightPostDto
    {
        [Required]
        [StringLength(2000)]
        public string Content { get; set; } = string.Empty;

        [StringLength(120)]
        public string? Title { get; set; }

        [StringLength(20)]
        public string? ContentFormat { get; set; }

        public Guid? AnalysisId { get; set; }

        public IReadOnlyList<PostMediaDto> Media { get; set; } = Array.Empty<PostMediaDto>();
    }

    public sealed class UpdateHighlightPostDto
    {
        [Required]
        [StringLength(2000)]
        public string Content { get; set; } = string.Empty;

        [StringLength(120)]
        public string? Title { get; set; }

        [StringLength(20)]
        public string? ContentFormat { get; set; }

        public Guid? AnalysisId { get; set; }

        public IReadOnlyList<PostMediaDto> Media { get; set; } = Array.Empty<PostMediaDto>();
    }

    public sealed class CreatePostCommentDto
    {
        [Required]
        [StringLength(1000)]
        public string Content { get; set; } = string.Empty;

        public Guid? ParentCommentId { get; set; }
    }

    public sealed class ToggleReactionRequestDto
    {
        [Required]
        [StringLength(20)]
        public string Reaction { get; set; } = string.Empty;
    }

    public sealed class ToggleReactionResultDto
    {
        public Guid PostId { get; set; }
        public string Reaction { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public IReadOnlyDictionary<string, int> ReactionCounts { get; set; } = new Dictionary<string, int>();
    }

    public sealed class SocialUserSummaryDto
    {
        public Guid Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? Bio { get; set; }
    }

    public sealed class PostCommentViewDto
    {
        public Guid Id { get; set; }
        public Guid PostId { get; set; }
        public Guid? ParentCommentId { get; set; }
        public SocialUserSummaryDto Author { get; set; } = new();
        public string Content { get; set; } = string.Empty;
        public int LikeCount { get; set; }
        public bool IsLikedByCurrentUser { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public sealed class HighlightPostViewDto
    {
        public Guid Id { get; set; }
        public Guid? AnalysisId { get; set; }
        public SocialUserSummaryDto Author { get; set; } = new();
        public string? Title { get; set; }
        public string Content { get; set; } = string.Empty;
        public string ContentFormat { get; set; } = "markdown";
        public IReadOnlyList<PostMediaDto> Media { get; set; } = Array.Empty<PostMediaDto>();
        public AnalysisShareDto? Analysis { get; set; }
        public int LikeCount { get; set; }
        public bool IsLikedByCurrentUser { get; set; }
        public int CommentCount { get; set; }
        public IReadOnlyDictionary<string, int> ReactionCounts { get; set; } = new Dictionary<string, int>();
        public string? CurrentUserReaction { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public IReadOnlyList<PostCommentViewDto> Comments { get; set; } = Array.Empty<PostCommentViewDto>();
    }

    public sealed class ToggleLikeResultDto
    {
        public Guid TargetId { get; set; }
        public string TargetType { get; set; } = string.Empty;
        public bool IsLiked { get; set; }
        public int TotalLikes { get; set; }
    }

    public sealed class FeedResultDto
    {
        public int Page { get; set; }
        public int PageSize { get; set; }
        public IReadOnlyList<HighlightPostViewDto> Posts { get; set; } = Array.Empty<HighlightPostViewDto>();
    }
}
