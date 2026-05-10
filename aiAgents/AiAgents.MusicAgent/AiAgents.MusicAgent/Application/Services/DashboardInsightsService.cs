using AiAgents.MusicAgent.Application.Exceptions;
using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Enums;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AiAgents.MusicAgent.Application.Services
{
    public class DashboardInsightsService : IDashboardInsightsService
    {
        private readonly MusicAgentDbContext _db;

        public DashboardInsightsService(MusicAgentDbContext db)
        {
            _db = db;
        }

        public async Task<DashboardOverviewDto> GetOverviewAsync(CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            var weekStart = today.AddDays(-7);
            var monthStart = today.AddDays(-30);

            var community = new CommunityCountsDto
            {
                TotalUsers = await _db.AppUsers.CountAsync(ct),
                ActiveUsers = await _db.AppUsers.CountAsync(u => u.IsActive, ct),
                ActiveUsersLast30Days = await _db.AppUsers.CountAsync(
                    u => u.IsActive && ((u.LastLoginAt ?? u.CreatedAt) >= monthStart),
                    ct)
            };

            var analysis = new AnalysisSnapshotDto
            {
                TotalTracks = await _db.Tracks.CountAsync(ct),
                CompletedTracks = await _db.Tracks.CountAsync(t => t.Status == AnalysisStatus.Completed, ct),
                ProcessingTracks = await _db.Tracks.CountAsync(t => t.Status == AnalysisStatus.Processing, ct),
                QueuedTracks = await _db.Tracks.CountAsync(t => t.Status == AnalysisStatus.Queued, ct),
                TracksAnalyzedToday = await _db.Analyses.CountAsync(a => a.AnalyzedAt >= today, ct),
                TracksAnalyzedThisWeek = await _db.Analyses.CountAsync(a => a.AnalyzedAt >= weekStart, ct),
                AverageConfidence = Math.Round(await _db.Analyses.Select(a => (double?)a.Confidence).AverageAsync(ct) ?? 0, 1),
                AverageCommercialScore = Math.Round(await _db.Analyses.Select(a => (double?)a.CommercialScore).AverageAsync(ct) ?? 0, 2),
                AverageProductionScore = Math.Round(await _db.Analyses.Select(a => (double?)a.ProductionScore).AverageAsync(ct) ?? 0, 2),
                AverageViralPotential = Math.Round(await _db.Analyses.Select(a => (double?)a.ViralPotential).AverageAsync(ct) ?? 0, 2)
            };

            var social = new SocialSnapshotDto
            {
                TotalPosts = await _db.HighlightPosts.CountAsync(p => !p.IsDeleted, ct),
                TotalComments = await _db.PostComments.CountAsync(c => !c.IsDeleted, ct),
                TotalPostLikes = await _db.PostLikes.CountAsync(ct),
                TotalCommentLikes = await _db.CommentLikes.CountAsync(ct)
            };

            var feedback = new FeedbackSnapshotDto
            {
                TotalFeedback = await _db.UserFeedbacks.CountAsync(ct),
                PendingFeedback = await _db.UserFeedbacks.CountAsync(f => !f.UsedInTraining, ct),
                UsedInTraining = await _db.UserFeedbacks.CountAsync(f => f.UsedInTraining, ct),
                AverageAccuracyRating = Math.Round(
                    await _db.UserFeedbacks
                        .Where(f => f.AccuracyRating.HasValue)
                        .Select(f => (double?)f.AccuracyRating)
                        .AverageAsync(ct) ?? 0,
                    2)
            };

            var topGenres = await _db.Analyses
                .AsNoTracking()
                .Where(a => !string.IsNullOrWhiteSpace(a.Genre))
                .GroupBy(a => a.Genre)
                .Select(g => new GenreCountDto
                {
                    Genre = g.Key,
                    Count = g.Count()
                })
                .OrderByDescending(g => g.Count)
                .ThenBy(g => g.Genre)
                .Take(5)
                .ToListAsync(ct);

            var recentImprovementJson = await _db.Analyses
                .AsNoTracking()
                .OrderByDescending(a => a.AnalyzedAt)
                .Take(300)
                .Select(a => a.ImprovementsJson)
                .ToListAsync(ct);

            var topThemes = BuildTopImprovementThemes(recentImprovementJson, 5);

            var recentCommentRows = await _db.PostComments
                .AsNoTracking()
                .Where(c => !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt)
                .Take(8)
                .Select(c => new
                {
                    c.Id,
                    c.PostId,
                    AuthorUserName = c.Author.UserName,
                    c.Content,
                    c.CreatedAt
                })
                .ToListAsync(ct);

            var recentComments = recentCommentRows
                .Select(c => new RecentCommentDto
                {
                    CommentId = c.Id,
                    PostId = c.PostId,
                    AuthorUserName = c.AuthorUserName,
                    ContentPreview = ToPreview(c.Content, 120),
                    CreatedAt = c.CreatedAt
                })
                .ToList();

            var recentFeedbackRows = await _db.UserFeedbacks
                .AsNoTracking()
                .OrderByDescending(f => f.SubmittedAt)
                .Take(8)
                .Select(f => new
                {
                    f.Id,
                    f.AnalysisId,
                    f.CorrectedGenre,
                    f.AccuracyRating,
                    f.Notes,
                    f.SubmittedAt
                })
                .ToListAsync(ct);

            var recentFeedback = recentFeedbackRows
                .Select(f => new RecentFeedbackDto
                {
                    FeedbackId = f.Id,
                    AnalysisId = f.AnalysisId,
                    CorrectedGenre = f.CorrectedGenre,
                    AccuracyRating = f.AccuracyRating,
                    NotesPreview = ToPreview(f.Notes, 160),
                    SubmittedAt = f.SubmittedAt
                })
                .ToList();

            var suggestions = BuildSuggestions(analysis, social, feedback, topThemes);
            var insight = BuildInsight(analysis, topGenres, topThemes);

            return new DashboardOverviewDto
            {
                GeneratedAtUtc = now,
                Community = community,
                Analysis = analysis,
                Social = social,
                Feedback = feedback,
                TopGenres = topGenres,
                TopImprovementThemes = topThemes,
                Suggestions = suggestions,
                Insight = insight,
                RecentComments = recentComments,
                RecentFeedback = recentFeedback
            };
        }

        public async Task<UserDashboardDto> GetUserDashboardAsync(Guid userId, CancellationToken ct)
        {
            var user = await _db.AppUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

            if (user is null)
            {
                throw new NotFoundException("User not found.");
            }

            var userPosts = _db.HighlightPosts
                .AsNoTracking()
                .Where(p => !p.IsDeleted && p.AuthorId == userId);

            var postsPublished = await userPosts.CountAsync(ct);
            var commentsWritten = await _db.PostComments.CountAsync(c => !c.IsDeleted && c.AuthorId == userId, ct);
            var postsLiked = await _db.PostLikes.CountAsync(l => l.UserId == userId, ct);
            var commentsLiked = await _db.CommentLikes.CountAsync(l => l.UserId == userId, ct);

            var postLikesReceived = await _db.PostLikes
                .CountAsync(l => !l.Post.IsDeleted && l.Post.AuthorId == userId, ct);

            var commentLikesReceived = await _db.CommentLikes
                .CountAsync(l => !l.Comment.IsDeleted && l.Comment.AuthorId == userId, ct);

            var recentPostRows = await userPosts
                .OrderByDescending(p => p.CreatedAt)
                .Take(5)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    LikeCount = p.Likes.Count(),
                    CommentCount = p.Comments.Count(c => !c.IsDeleted),
                    p.CreatedAt
                })
                .ToListAsync(ct);

            var engagementScore =
                (postsPublished * 3) +
                (commentsWritten * 2) +
                postsLiked +
                commentsLiked +
                postLikesReceived +
                commentLikesReceived;

            return new UserDashboardDto
            {
                UserId = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                MemberSince = user.CreatedAt,
                LastLoginAt = user.LastLoginAt,
                PostsPublished = postsPublished,
                CommentsWritten = commentsWritten,
                PostsLiked = postsLiked,
                CommentsLiked = commentsLiked,
                PostLikesReceived = postLikesReceived,
                CommentLikesReceived = commentLikesReceived,
                EngagementScore = engagementScore,
                RecentPosts = recentPostRows
                    .Select(p => new UserRecentPostDto
                    {
                        PostId = p.Id,
                        ContentPreview = ToPreview(p.Content, 140),
                        LikeCount = p.LikeCount,
                        CommentCount = p.CommentCount,
                        CreatedAt = p.CreatedAt
                    })
                    .ToList()
            };
        }

        public async Task<TrendRadarDto> GetTrendRadarAsync(CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var cutoff = now.AddDays(-7);

            var recentImprovements = await _db.Analyses
                .AsNoTracking()
                .Where(a => a.AnalyzedAt >= cutoff)
                .OrderByDescending(a => a.AnalyzedAt)
                .Select(a => a.ImprovementsJson)
                .ToListAsync(ct);

            var recentStrengths = await _db.Analyses
                .AsNoTracking()
                .Where(a => a.AnalyzedAt >= cutoff)
                .OrderByDescending(a => a.AnalyzedAt)
                .Select(a => a.StrengthsJson)
                .ToListAsync(ct);

            var topIssues = BuildTopImprovementThemes(recentImprovements, 6)
                .Select(t => new TrendItemDto { Label = t.Theme, Count = t.Count })
                .ToList();

            var topWins = BuildTopStrengthThemes(recentStrengths, 6);

            return new TrendRadarDto
            {
                GeneratedAtUtc = now,
                TopIssues = topIssues,
                TopWins = topWins
            };
        }

        public async Task<FeedbackLeaderboardDto> GetFeedbackLeaderboardAsync(int take, CancellationToken ct)
        {
            take = Math.Clamp(take, 1, 20);
            var now = DateTime.UtcNow;

            var rows = await _db.UserFeedbacks
                .AsNoTracking()
                .Where(f => f.UserId.HasValue)
                .GroupBy(f => new { f.UserId, f.User!.UserName })
                .Select(g => new
                {
                    UserId = g.Key.UserId!.Value,
                    UserName = g.Key.UserName,
                    FeedbackCount = g.Count(),
                    AvgAccuracy = g.Where(x => x.AccuracyRating.HasValue)
                        .Select(x => (double?)x.AccuracyRating)
                        .Average() ?? 0
                })
                .OrderByDescending(x => x.FeedbackCount)
                .Take(take)
                .ToListAsync(ct);

            var entries = rows.Select(r =>
            {
                var score = Math.Round((r.FeedbackCount * 2) + r.AvgAccuracy, 2);
                return new FeedbackLeaderboardEntryDto
                {
                    UserId = r.UserId,
                    UserName = r.UserName,
                    FeedbackCount = r.FeedbackCount,
                    AverageAccuracy = Math.Round(r.AvgAccuracy, 2),
                    ReputationScore = score
                };
            }).ToList();

            return new FeedbackLeaderboardDto
            {
                GeneratedAtUtc = now,
                Entries = entries
            };
        }

        private static IReadOnlyList<ThemeCountDto> BuildTopImprovementThemes(
            IEnumerable<string?> jsonBlobs,
            int take)
        {
            var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var json in jsonBlobs)
            {
                if (string.IsNullOrWhiteSpace(json))
                {
                    continue;
                }

                List<string>? improvements;
                try
                {
                    improvements = JsonSerializer.Deserialize<List<string>>(json);
                }
                catch
                {
                    continue;
                }

                if (improvements is null)
                {
                    continue;
                }

                foreach (var improvement in improvements)
                {
                    var theme = MapImprovementToTheme(improvement);
                    if (string.IsNullOrWhiteSpace(theme))
                    {
                        continue;
                    }

                    counts[theme] = counts.TryGetValue(theme, out var current)
                        ? current + 1
                        : 1;
                }
            }

            return counts
                .OrderByDescending(kvp => kvp.Value)
                .ThenBy(kvp => kvp.Key)
                .Take(take)
                .Select(kvp => new ThemeCountDto
                {
                    Theme = kvp.Key,
                    Count = kvp.Value
                })
                .ToList();
        }

        private static IReadOnlyList<TrendItemDto> BuildTopStrengthThemes(
            IEnumerable<string?> jsonBlobs,
            int take)
        {
            var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var json in jsonBlobs)
            {
                if (string.IsNullOrWhiteSpace(json))
                {
                    continue;
                }

                List<string>? strengths;
                try
                {
                    strengths = JsonSerializer.Deserialize<List<string>>(json);
                }
                catch
                {
                    continue;
                }

                if (strengths is null)
                {
                    continue;
                }

                foreach (var strength in strengths)
                {
                    var label = MapStrengthToTheme(strength);
                    if (string.IsNullOrWhiteSpace(label))
                    {
                        continue;
                    }

                    counts[label] = counts.TryGetValue(label, out var current)
                        ? current + 1
                        : 1;
                }
            }

            return counts
                .OrderByDescending(kvp => kvp.Value)
                .ThenBy(kvp => kvp.Key)
                .Take(take)
                .Select(kvp => new TrendItemDto
                {
                    Label = kvp.Key,
                    Count = kvp.Value
                })
                .ToList();
        }

        private static string MapStrengthToTheme(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var text = value.ToLowerInvariant();

            if (text.Contains("vocal") || text.Contains("presence"))
            {
                return "Vocal clarity";
            }

            if (text.Contains("bass") || text.Contains("low"))
            {
                return "Low-end control";
            }

            if (text.Contains("stereo") || text.Contains("width"))
            {
                return "Stereo width";
            }

            if (text.Contains("dynamic") || text.Contains("punch"))
            {
                return "Dynamics and punch";
            }

            if (text.Contains("arrangement") || text.Contains("structure"))
            {
                return "Arrangement strength";
            }

            return "Overall polish";
        }

        private static string MapImprovementToTheme(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var text = value.ToLowerInvariant();

            if (text.Contains("bass") || text.Contains("low-end") || text.Contains("muddy"))
            {
                return "Low-end clarity";
            }

            if (text.Contains("vocal") || text.Contains("sibil") || text.Contains("de-ess"))
            {
                return "Vocal presence";
            }

            if (text.Contains("stereo") || text.Contains("width") || text.Contains("imaging"))
            {
                return "Stereo imaging";
            }

            if (text.Contains("loud") || text.Contains("dynamic") || text.Contains("compress"))
            {
                return "Dynamics and loudness";
            }

            if (text.Contains("eq") || text.Contains("frequency") || text.Contains("harsh") || text.Contains("bright"))
            {
                return "EQ balance";
            }

            if (text.Contains("arrangement") || text.Contains("structure") || text.Contains("section"))
            {
                return "Arrangement quality";
            }

            return "General production polish";
        }

        private static IReadOnlyList<AiSuggestionDto> BuildSuggestions(
            AnalysisSnapshotDto analysis,
            SocialSnapshotDto social,
            FeedbackSnapshotDto feedback,
            IReadOnlyList<ThemeCountDto> topThemes)
        {
            var suggestions = new List<AiSuggestionDto>();

            if (analysis.CompletedTracks > 0 && analysis.AverageConfidence < 70)
            {
                suggestions.Add(new AiSuggestionDto
                {
                    Title = "Improve classification confidence",
                    Description = "Average confidence is below 70%. Encourage users to submit genre corrections on completed analyses.",
                    Severity = "warning"
                });
            }

            if (feedback.PendingFeedback >= 10)
            {
                suggestions.Add(new AiSuggestionDto
                {
                    Title = "Retraining opportunity detected",
                    Description = $"{feedback.PendingFeedback} feedback items are pending and ready to improve model accuracy.",
                    Severity = "info"
                });
            }

            if (social.TotalPosts > 0 && social.TotalComments == 0)
            {
                suggestions.Add(new AiSuggestionDto
                {
                    Title = "Drive more discussion",
                    Description = "Posts are being created but comments are low. Prompt users with targeted discussion starters in the feed.",
                    Severity = "info"
                });
            }

            if (topThemes.Count > 0)
            {
                var primaryTheme = topThemes[0];
                suggestions.Add(new AiSuggestionDto
                {
                    Title = $"Focus coaching on {primaryTheme.Theme}",
                    Description = $"This theme appears {primaryTheme.Count} times in recent improvement notes.",
                    Severity = "info"
                });
            }

            if (suggestions.Count == 0)
            {
                suggestions.Add(new AiSuggestionDto
                {
                    Title = "System healthy",
                    Description = "No high-priority issues detected. Continue collecting feedback to improve long-term model quality.",
                    Severity = "success"
                });
            }

            return suggestions;
        }

        private static AiInsightDto BuildInsight(
            AnalysisSnapshotDto analysis,
            IReadOnlyList<GenreCountDto> topGenres,
            IReadOnlyList<ThemeCountDto> topThemes)
        {
            if (topThemes.Count > 0)
            {
                var theme = topThemes[0];
                return new AiInsightDto
                {
                    Headline = "Musicle AI trend: recurring mix issue detected",
                    Summary = $"\"{theme.Theme}\" is the top improvement signal, appearing in {theme.Count} recent recommendations.",
                    SuggestedAction = "Surface this issue first in analysis reports and highlight a one-click fix guide in the feed."
                };
            }

            if (topGenres.Count > 0)
            {
                var genre = topGenres[0];
                return new AiInsightDto
                {
                    Headline = "Musicle AI trend: genre momentum",
                    Summary = $"{genre.Genre} is currently the most analyzed genre with {genre.Count} completed analyses.",
                    SuggestedAction = "Show genre-specific tips and benchmark references for this segment."
                };
            }

            return new AiInsightDto
            {
                Headline = "Musicle AI trend: waiting for more data",
                Summary = $"{analysis.TotalTracks} tracks ingested so far. More uploads will unlock stronger trend detection.",
                SuggestedAction = "Encourage users to upload tracks and leave feedback to bootstrap insight quality."
            };
        }

        private static string ToPreview(string? value, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var normalized = value.Trim();
            return normalized.Length <= maxLength
                ? normalized
                : normalized[..(maxLength - 1)] + "…";
        }
    }
}
