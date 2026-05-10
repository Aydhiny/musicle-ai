namespace AiAgents.Shared.Dtos
{
    public sealed class DashboardOverviewDto
    {
        public DateTime GeneratedAtUtc { get; set; }
        public CommunityCountsDto Community { get; set; } = new();
        public AnalysisSnapshotDto Analysis { get; set; } = new();
        public SocialSnapshotDto Social { get; set; } = new();
        public FeedbackSnapshotDto Feedback { get; set; } = new();
        public IReadOnlyList<GenreCountDto> TopGenres { get; set; } = Array.Empty<GenreCountDto>();
        public IReadOnlyList<ThemeCountDto> TopImprovementThemes { get; set; } = Array.Empty<ThemeCountDto>();
        public IReadOnlyList<AiSuggestionDto> Suggestions { get; set; } = Array.Empty<AiSuggestionDto>();
        public AiInsightDto Insight { get; set; } = new();
        public IReadOnlyList<RecentCommentDto> RecentComments { get; set; } = Array.Empty<RecentCommentDto>();
        public IReadOnlyList<RecentFeedbackDto> RecentFeedback { get; set; } = Array.Empty<RecentFeedbackDto>();
    }

    public sealed class CommunityCountsDto
    {
        public int TotalUsers { get; set; }
        public int ActiveUsers { get; set; }
        public int ActiveUsersLast30Days { get; set; }
    }

    public sealed class AnalysisSnapshotDto
    {
        public int TotalTracks { get; set; }
        public int CompletedTracks { get; set; }
        public int ProcessingTracks { get; set; }
        public int QueuedTracks { get; set; }
        public int TracksAnalyzedToday { get; set; }
        public int TracksAnalyzedThisWeek { get; set; }
        public double AverageConfidence { get; set; }
        public double AverageCommercialScore { get; set; }
        public double AverageProductionScore { get; set; }
        public double AverageViralPotential { get; set; }
    }

    public sealed class SocialSnapshotDto
    {
        public int TotalPosts { get; set; }
        public int TotalComments { get; set; }
        public int TotalPostLikes { get; set; }
        public int TotalCommentLikes { get; set; }
    }

    public sealed class FeedbackSnapshotDto
    {
        public int TotalFeedback { get; set; }
        public int PendingFeedback { get; set; }
        public int UsedInTraining { get; set; }
        public double AverageAccuracyRating { get; set; }
    }

    public sealed class GenreCountDto
    {
        public string Genre { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public sealed class ThemeCountDto
    {
        public string Theme { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public sealed class AiSuggestionDto
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = "info";
    }

    public sealed class AiInsightDto
    {
        public string Headline { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string SuggestedAction { get; set; } = string.Empty;
    }

    public sealed class RecentCommentDto
    {
        public Guid CommentId { get; set; }
        public Guid PostId { get; set; }
        public string AuthorUserName { get; set; } = string.Empty;
        public string ContentPreview { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public sealed class RecentFeedbackDto
    {
        public Guid FeedbackId { get; set; }
        public Guid AnalysisId { get; set; }
        public string? CorrectedGenre { get; set; }
        public int? AccuracyRating { get; set; }
        public string? NotesPreview { get; set; }
        public DateTime SubmittedAt { get; set; }
    }

    public sealed class UserDashboardDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public DateTime MemberSince { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public int PostsPublished { get; set; }
        public int CommentsWritten { get; set; }
        public int PostsLiked { get; set; }
        public int CommentsLiked { get; set; }
        public int PostLikesReceived { get; set; }
        public int CommentLikesReceived { get; set; }
        public int EngagementScore { get; set; }
        public IReadOnlyList<UserRecentPostDto> RecentPosts { get; set; } = Array.Empty<UserRecentPostDto>();
    }

    public sealed class UserRecentPostDto
    {
        public Guid PostId { get; set; }
        public string ContentPreview { get; set; } = string.Empty;
        public int LikeCount { get; set; }
        public int CommentCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}