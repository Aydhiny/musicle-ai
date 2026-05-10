namespace AiAgents.Shared.Dtos
{
    public sealed class WaveformCommentDto
    {
        public Guid Id { get; set; }
        public Guid TrackId { get; set; }
        public Guid AuthorId { get; set; }
        public string AuthorUserName { get; set; } = string.Empty;
        public double TimeSeconds { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public sealed class CreateWaveformCommentDto
    {
        public double TimeSeconds { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    public sealed class ComparisonVoteRequestDto
    {
        public Guid TrackAId { get; set; }
        public Guid TrackBId { get; set; }
        public Guid WinnerTrackId { get; set; }
    }

    public sealed class ComparisonVoteResultDto
    {
        public Guid TrackAId { get; set; }
        public Guid TrackBId { get; set; }
        public Guid WinnerTrackId { get; set; }
        public int TotalVotes { get; set; }
    }

    public sealed class ComparisonStatsDto
    {
        public Guid TrackAId { get; set; }
        public Guid TrackBId { get; set; }
        public int VotesForTrackA { get; set; }
        public int VotesForTrackB { get; set; }
        public int TotalVotes { get; set; }
    }

    public sealed class TrackRevisionDto
    {
        public Guid TrackId { get; set; }
        public string TrackName { get; set; } = string.Empty;
        public Guid? AnalysisId { get; set; }
        public string? Genre { get; set; }
        public string? Subgenre { get; set; }
        public int? Confidence { get; set; }
        public DateTime UploadedAt { get; set; }
        public string? Note { get; set; }
    }

    public sealed class CreateTrackRevisionDto
    {
        public Guid PreviousTrackId { get; set; }
        public string? Note { get; set; }
    }

    public sealed class TrendItemDto
    {
        public string Label { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public sealed class TrendRadarDto
    {
        public DateTime GeneratedAtUtc { get; set; }
        public IReadOnlyList<TrendItemDto> TopIssues { get; set; } = Array.Empty<TrendItemDto>();
        public IReadOnlyList<TrendItemDto> TopWins { get; set; } = Array.Empty<TrendItemDto>();
    }

    public sealed class FeedbackLeaderboardEntryDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public int FeedbackCount { get; set; }
        public double AverageAccuracy { get; set; }
        public double ReputationScore { get; set; }
    }

    public sealed class FeedbackLeaderboardDto
    {
        public DateTime GeneratedAtUtc { get; set; }
        public IReadOnlyList<FeedbackLeaderboardEntryDto> Entries { get; set; } = Array.Empty<FeedbackLeaderboardEntryDto>();
    }
}
