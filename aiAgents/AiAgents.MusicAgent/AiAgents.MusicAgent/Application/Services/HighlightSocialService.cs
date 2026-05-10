using AiAgents.MusicAgent.Application.Exceptions;
using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AiAgents.MusicAgent.Application.Services
{
    public class HighlightSocialService : IHighlightSocialService
    {
        private readonly MusicAgentDbContext _db;

        public HighlightSocialService(MusicAgentDbContext db)
        {
            _db = db;
        }

        public async Task<FeedResultDto> GetFeedAsync(Guid? currentUserId, int page, int pageSize, string? mode, CancellationToken ct)
        {
            page = page < 1 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 50);
            var skip = (page - 1) * pageSize;

            var normalizedMode = NormalizeFeedMode(mode);
            var now = DateTime.UtcNow;
            var baseQuery = _db.HighlightPosts
                .AsNoTracking()
                .Where(p => !p.IsDeleted);

            IQueryable<Guid> orderedIds;
            if (normalizedMode == "trending" || normalizedMode == "for-you")
            {
                if (normalizedMode == "trending")
                {
                    var cutoff = now.AddDays(-14);
                    baseQuery = baseQuery.Where(p => p.CreatedAt >= cutoff);
                }

                var scored = baseQuery.Select(p => new
                {
                    p.Id,
                    Score = (p.Likes.Count() * 3)
                            + (p.Comments.Count(c => !c.IsDeleted) * 2)
                            + (p.Reactions.Count() * 1)
                            - (EF.Functions.DateDiffHour(p.CreatedAt, now) * 0.15)
                });

                orderedIds = scored
                    .OrderByDescending(s => s.Score)
                    .ThenByDescending(s => s.Id)
                    .Select(s => s.Id);
            }
            else
            {
                orderedIds = baseQuery
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => p.Id);
            }

            var postIds = await orderedIds
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync(ct);

            var posts = await LoadPostsAsync(postIds, currentUserId, commentsLimit: 3, ct);

            return new FeedResultDto
            {
                Page = page,
                PageSize = pageSize,
                Posts = posts
            };
        }

        public async Task<HighlightPostViewDto> GetPostByIdAsync(Guid postId, Guid? currentUserId, CancellationToken ct)
        {
            var posts = await LoadPostsAsync(new List<Guid> { postId }, currentUserId, commentsLimit: 100, ct);
            var post = posts.FirstOrDefault();

            if (post is null)
            {
                throw new NotFoundException("Post not found.");
            }

            return post;
        }

        public async Task<HighlightPostViewDto> CreatePostAsync(Guid currentUserId, CreateHighlightPostDto dto, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);
            await ValidateOptionalAnalysisAsync(dto.AnalysisId, ct);

            var content = SocialRules.NormalizePostContent(dto.Content);
            if (!SocialRules.IsValidPostContent(content))
            {
                throw new AppValidationException($"Post content is required and must be at most {SocialRules.MaxPostLength} characters.");
            }

            var title = SocialRules.NormalizePostTitle(dto.Title);
            if (!SocialRules.IsValidPostTitle(title))
            {
                throw new AppValidationException($"Post title must be at most {SocialRules.MaxPostTitleLength} characters.");
            }

            var contentFormat = SocialRules.NormalizeContentFormat(dto.ContentFormat);
            var media = NormalizeMedia(dto.Media);

            var now = DateTime.UtcNow;
            var post = new HighlightPost
            {
                Id = Guid.NewGuid(),
                AuthorId = currentUserId,
                AnalysisId = dto.AnalysisId,
                Title = title,
                Content = content,
                ContentFormat = contentFormat,
                MediaJson = SerializeJson(media),
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _db.HighlightPosts.Add(post);
            await _db.SaveChangesAsync(ct);

            return await GetPostByIdAsync(post.Id, currentUserId, ct);
        }

        public async Task<HighlightPostViewDto> UpdatePostAsync(Guid currentUserId, Guid postId, UpdateHighlightPostDto dto, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);
            await ValidateOptionalAnalysisAsync(dto.AnalysisId, ct);

            var post = await _db.HighlightPosts
                .FirstOrDefaultAsync(p => p.Id == postId && !p.IsDeleted, ct);

            if (post is null)
            {
                throw new NotFoundException("Post not found.");
            }

            if (post.AuthorId != currentUserId)
            {
                throw new ForbiddenException("You can only edit your own posts.");
            }

            var content = SocialRules.NormalizePostContent(dto.Content);
            if (!SocialRules.IsValidPostContent(content))
            {
                throw new AppValidationException($"Post content is required and must be at most {SocialRules.MaxPostLength} characters.");
            }

            var title = SocialRules.NormalizePostTitle(dto.Title);
            if (!SocialRules.IsValidPostTitle(title))
            {
                throw new AppValidationException($"Post title must be at most {SocialRules.MaxPostTitleLength} characters.");
            }

            var contentFormat = SocialRules.NormalizeContentFormat(dto.ContentFormat);
            var media = NormalizeMedia(dto.Media);

            post.Title = title;
            post.Content = content;
            post.ContentFormat = contentFormat;
            post.MediaJson = SerializeJson(media);
            post.AnalysisId = dto.AnalysisId;
            post.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return await GetPostByIdAsync(postId, currentUserId, ct);
        }

        public async Task DeletePostAsync(Guid currentUserId, Guid postId, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);

            var post = await _db.HighlightPosts
                .FirstOrDefaultAsync(p => p.Id == postId && !p.IsDeleted, ct);

            if (post is null)
            {
                throw new NotFoundException("Post not found.");
            }

            if (post.AuthorId != currentUserId)
            {
                throw new ForbiddenException("You can only delete your own posts.");
            }

            post.IsDeleted = true;
            post.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        public async Task<PostCommentViewDto> AddCommentAsync(Guid currentUserId, Guid postId, CreatePostCommentDto dto, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);

            var postExists = await _db.HighlightPosts
                .AnyAsync(p => p.Id == postId && !p.IsDeleted, ct);

            if (!postExists)
            {
                throw new NotFoundException("Post not found.");
            }

            var content = SocialRules.NormalizeCommentContent(dto.Content);
            if (!SocialRules.IsValidCommentContent(content))
            {
                throw new AppValidationException($"Comment content is required and must be at most {SocialRules.MaxCommentLength} characters.");
            }

            if (dto.ParentCommentId.HasValue)
            {
                var parentExists = await _db.PostComments
                    .AnyAsync(c => c.Id == dto.ParentCommentId.Value && c.PostId == postId && !c.IsDeleted, ct);

                if (!parentExists)
                {
                    throw new AppValidationException("Parent comment is invalid for this post.");
                }
            }

            var now = DateTime.UtcNow;
            var comment = new PostComment
            {
                Id = Guid.NewGuid(),
                PostId = postId,
                AuthorId = currentUserId,
                ParentCommentId = dto.ParentCommentId,
                Content = content,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _db.PostComments.Add(comment);
            await _db.SaveChangesAsync(ct);

            var created = await _db.PostComments
                .AsNoTracking()
                .Where(c => c.Id == comment.Id)
                .Select(c => new PostCommentViewDto
                {
                    Id = c.Id,
                    PostId = c.PostId,
                    ParentCommentId = c.ParentCommentId,
                    Content = c.Content,
                    Author = new SocialUserSummaryDto
                    {
                        Id = c.Author.Id,
                        UserName = c.Author.UserName,
                        Bio = c.Author.Bio
                    },
                    LikeCount = c.Likes.Count(),
                    IsLikedByCurrentUser = false,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt
                })
                .FirstAsync(ct);

            return created;
        }

        public async Task DeleteCommentAsync(Guid currentUserId, Guid commentId, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);

            var comment = await _db.PostComments
                .Include(c => c.Post)
                .FirstOrDefaultAsync(c => c.Id == commentId && !c.IsDeleted, ct);

            if (comment is null)
            {
                throw new NotFoundException("Comment not found.");
            }

            var isCommentOwner = comment.AuthorId == currentUserId;
            var isPostOwner = comment.Post.AuthorId == currentUserId;
            if (!isCommentOwner && !isPostOwner)
            {
                throw new ForbiddenException("You can only delete your own comments or comments on your own post.");
            }

            comment.IsDeleted = true;
            comment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        public async Task<ToggleLikeResultDto> TogglePostLikeAsync(Guid currentUserId, Guid postId, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);

            var postExists = await _db.HighlightPosts
                .AnyAsync(p => p.Id == postId && !p.IsDeleted, ct);

            if (!postExists)
            {
                throw new NotFoundException("Post not found.");
            }

            var existing = await _db.PostLikes
                .FirstOrDefaultAsync(l => l.PostId == postId && l.UserId == currentUserId, ct);

            var isLiked = false;
            if (existing is null)
            {
                _db.PostLikes.Add(new PostLike
                {
                    PostId = postId,
                    UserId = currentUserId,
                    CreatedAt = DateTime.UtcNow
                });
                isLiked = true;
            }
            else
            {
                _db.PostLikes.Remove(existing);
            }

            await _db.SaveChangesAsync(ct);

            var totalLikes = await _db.PostLikes.CountAsync(l => l.PostId == postId, ct);

            return new ToggleLikeResultDto
            {
                TargetId = postId,
                TargetType = "post",
                IsLiked = isLiked,
                TotalLikes = totalLikes
            };
        }

        public async Task<ToggleLikeResultDto> ToggleCommentLikeAsync(Guid currentUserId, Guid commentId, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);

            var commentExists = await _db.PostComments
                .AnyAsync(c => c.Id == commentId && !c.IsDeleted, ct);

            if (!commentExists)
            {
                throw new NotFoundException("Comment not found.");
            }

            var existing = await _db.CommentLikes
                .FirstOrDefaultAsync(l => l.CommentId == commentId && l.UserId == currentUserId, ct);

            var isLiked = false;
            if (existing is null)
            {
                _db.CommentLikes.Add(new CommentLike
                {
                    CommentId = commentId,
                    UserId = currentUserId,
                    CreatedAt = DateTime.UtcNow
                });
                isLiked = true;
            }
            else
            {
                _db.CommentLikes.Remove(existing);
            }

            await _db.SaveChangesAsync(ct);

            var totalLikes = await _db.CommentLikes.CountAsync(l => l.CommentId == commentId, ct);

            return new ToggleLikeResultDto
            {
                TargetId = commentId,
                TargetType = "comment",
                IsLiked = isLiked,
                TotalLikes = totalLikes
            };
        }

        public async Task<ToggleReactionResultDto> TogglePostReactionAsync(Guid currentUserId, Guid postId, string reaction, CancellationToken ct)
        {
            await EnsureActiveUserExistsAsync(currentUserId, ct);

            var normalized = SocialRules.NormalizeReaction(reaction);
            if (!SocialRules.IsAllowedReaction(normalized))
            {
                throw new AppValidationException("Invalid reaction type.");
            }

            var postExists = await _db.HighlightPosts
                .AnyAsync(p => p.Id == postId && !p.IsDeleted, ct);

            if (!postExists)
            {
                throw new NotFoundException("Post not found.");
            }

            var existing = await _db.PostReactions
                .FirstOrDefaultAsync(r => r.PostId == postId && r.UserId == currentUserId, ct);

            var isActive = false;
            if (existing is null)
            {
                _db.PostReactions.Add(new PostReaction
                {
                    PostId = postId,
                    UserId = currentUserId,
                    Reaction = normalized,
                    CreatedAt = DateTime.UtcNow
                });
                isActive = true;
            }
            else if (existing.Reaction == normalized)
            {
                _db.PostReactions.Remove(existing);
            }
            else
            {
                existing.Reaction = normalized;
                existing.CreatedAt = DateTime.UtcNow;
                isActive = true;
            }

            await _db.SaveChangesAsync(ct);

            var counts = await _db.PostReactions
                .Where(r => r.PostId == postId)
                .GroupBy(r => r.Reaction)
                .Select(g => new { Reaction = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var dict = SocialRules.AllowedReactions.ToDictionary(r => r, _ => 0);
            foreach (var item in counts)
            {
                if (dict.ContainsKey(item.Reaction))
                {
                    dict[item.Reaction] = item.Count;
                }
            }

            return new ToggleReactionResultDto
            {
                PostId = postId,
                Reaction = normalized,
                IsActive = isActive,
                ReactionCounts = dict
            };
        }

        private async Task<List<HighlightPostViewDto>> LoadPostsAsync(
            List<Guid> postIds,
            Guid? currentUserId,
            int commentsLimit,
            CancellationToken ct)
        {
            if (postIds.Count == 0)
            {
                return new List<HighlightPostViewDto>();
            }

            var rows = await BuildPostProjection(currentUserId, commentsLimit)
                .Where(r => postIds.Contains(r.Post.Id))
                .ToListAsync(ct);

            var orderMap = postIds
                .Select((id, index) => new { id, index })
                .ToDictionary(x => x.id, x => x.index);

            var posts = rows
                .Select(row =>
                {
                    var post = row.Post;
                    post.Media = DeserializeMedia(row.MediaJson);
                    return post;
                })
                .OrderBy(p => orderMap.TryGetValue(p.Id, out var idx) ? idx : int.MaxValue)
                .ToList();

            await PopulateReactionsAsync(posts, currentUserId, ct);

            return posts;
        }

        private async Task PopulateReactionsAsync(
            List<HighlightPostViewDto> posts,
            Guid? currentUserId,
            CancellationToken ct)
        {
            if (posts.Count == 0)
            {
                return;
            }

            var postIds = posts.Select(p => p.Id).ToList();

            var counts = await _db.PostReactions
                .Where(r => postIds.Contains(r.PostId))
                .GroupBy(r => new { r.PostId, r.Reaction })
                .Select(g => new { g.Key.PostId, g.Key.Reaction, Count = g.Count() })
                .ToListAsync(ct);

            var lookup = counts
                .GroupBy(c => c.PostId)
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var dict = SocialRules.AllowedReactions.ToDictionary(r => r, _ => 0);
                        foreach (var item in g)
                        {
                            if (dict.ContainsKey(item.Reaction))
                            {
                                dict[item.Reaction] = item.Count;
                            }
                        }
                        return (IReadOnlyDictionary<string, int>)dict;
                    });

            var currentMap = new Dictionary<Guid, string>();
            if (currentUserId.HasValue)
            {
                var current = await _db.PostReactions
                    .Where(r => r.UserId == currentUserId && postIds.Contains(r.PostId))
                    .Select(r => new { r.PostId, r.Reaction })
                    .ToListAsync(ct);

                currentMap = current.ToDictionary(c => c.PostId, c => c.Reaction);
            }

            foreach (var post in posts)
            {
                post.ReactionCounts = lookup.TryGetValue(post.Id, out var dict)
                    ? dict
                    : SocialRules.AllowedReactions.ToDictionary(r => r, _ => 0);

                post.CurrentUserReaction = currentMap.TryGetValue(post.Id, out var reaction)
                    ? reaction
                    : null;
            }
        }

        private IQueryable<PostRow> BuildPostProjection(Guid? currentUserId, int commentsLimit)
        {
            var hasCurrentUser = currentUserId.HasValue;
            var currentUserValue = currentUserId ?? Guid.Empty;

            return _db.HighlightPosts
                .AsNoTracking()
                .Where(p => !p.IsDeleted)
                .Select(p => new PostRow
                {
                    MediaJson = p.MediaJson,
                    Post = new HighlightPostViewDto
                    {
                        Id = p.Id,
                        AnalysisId = p.AnalysisId,
                        Author = new SocialUserSummaryDto
                        {
                            Id = p.Author.Id,
                            UserName = p.Author.UserName,
                            Bio = p.Author.Bio
                        },
                        Title = p.Title,
                        Content = p.Content,
                        ContentFormat = p.ContentFormat,
                        LikeCount = p.Likes.Count(),
                        IsLikedByCurrentUser = hasCurrentUser && p.Likes.Any(l => l.UserId == currentUserValue),
                        CommentCount = p.Comments.Count(c => !c.IsDeleted),
                        CreatedAt = p.CreatedAt,
                        UpdatedAt = p.UpdatedAt,
                        Analysis = p.Analysis == null
                            ? null
                            : new AnalysisShareDto
                            {
                                AnalysisId = p.Analysis.Id,
                                TrackId = p.Analysis.TrackId,
                                Genre = p.Analysis.Genre,
                                Subgenre = p.Analysis.Subgenre,
                                Confidence = p.Analysis.Confidence,
                                CommercialScore = p.Analysis.CommercialScore,
                                ProductionScore = p.Analysis.ProductionScore,
                                ViralPotential = p.Analysis.ViralPotential,
                                AnalyzedAt = p.Analysis.AnalyzedAt,
                                AudioUrl = $"/api/analysis/{p.Analysis.TrackId}/audio"
                            },
                        Comments = p.Comments
                            .Where(c => !c.IsDeleted)
                            .OrderByDescending(c => c.CreatedAt)
                            .Take(commentsLimit)
                            .Select(c => new PostCommentViewDto
                            {
                                Id = c.Id,
                                PostId = c.PostId,
                                ParentCommentId = c.ParentCommentId,
                                Content = c.Content,
                                Author = new SocialUserSummaryDto
                                {
                                    Id = c.Author.Id,
                                    UserName = c.Author.UserName,
                                    Bio = c.Author.Bio
                                },
                                LikeCount = c.Likes.Count(),
                                IsLikedByCurrentUser = hasCurrentUser && c.Likes.Any(l => l.UserId == currentUserValue),
                                CreatedAt = c.CreatedAt,
                                UpdatedAt = c.UpdatedAt
                            })
                            .ToList()
                    }
                });
        }

        private static string NormalizeFeedMode(string? mode)
        {
            var normalized = (mode ?? string.Empty).Trim().ToLowerInvariant();
            return normalized switch
            {
                "trending" => "trending",
                "for-you" => "for-you",
                "foryou" => "for-you",
                "recent" => "recent",
                "latest" => "recent",
                _ => "recent"
            };
        }

        private static IReadOnlyList<PostMediaDto> NormalizeMedia(IReadOnlyList<PostMediaDto>? media)
        {
            if (media == null || media.Count == 0)
            {
                return Array.Empty<PostMediaDto>();
            }

            if (media.Count > SocialRules.MaxMediaItems)
            {
                throw new AppValidationException($"You can attach up to {SocialRules.MaxMediaItems} media items.");
            }

            var normalized = new List<PostMediaDto>();

            foreach (var item in media)
            {
                if (item is null)
                {
                    continue;
                }

                var type = (item.Type ?? string.Empty).Trim().ToLowerInvariant();
                if (type != "image" && type != "audio" && type != "link")
                {
                    throw new AppValidationException("Media type must be image, audio, or link.");
                }

                var url = (item.Url ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(url))
                {
                    throw new AppValidationException("Media URL is required.");
                }

                normalized.Add(new PostMediaDto
                {
                    Type = type,
                    Url = url,
                    Label = string.IsNullOrWhiteSpace(item.Label) ? null : item.Label.Trim(),
                    ContentType = string.IsNullOrWhiteSpace(item.ContentType) ? null : item.ContentType.Trim(),
                    DurationSeconds = item.DurationSeconds
                });
            }

            return normalized;
        }

        private static IReadOnlyList<PostMediaDto> DeserializeMedia(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return Array.Empty<PostMediaDto>();
            }

            try
            {
                var items = JsonSerializer.Deserialize<List<PostMediaDto>>(json);
                return items ?? new List<PostMediaDto>();
            }
            catch
            {
                return Array.Empty<PostMediaDto>();
            }
        }

        private static string SerializeJson(IReadOnlyList<PostMediaDto>? value)
            => JsonSerializer.Serialize(value ?? Array.Empty<PostMediaDto>());

        private async Task EnsureActiveUserExistsAsync(Guid userId, CancellationToken ct)
        {
            var exists = await _db.AppUsers.AnyAsync(u => u.Id == userId && u.IsActive, ct);
            if (!exists)
            {
                throw new UnauthorizedException("User account is not active.");
            }
        }

        private async Task ValidateOptionalAnalysisAsync(Guid? analysisId, CancellationToken ct)
        {
            if (!analysisId.HasValue)
            {
                return;
            }

            var exists = await _db.Analyses.AnyAsync(a => a.Id == analysisId.Value, ct);
            if (!exists)
            {
                throw new AppValidationException("Referenced analysis does not exist.");
            }
        }

        private sealed class PostRow
        {
            public HighlightPostViewDto Post { get; init; } = new();
            public string MediaJson { get; init; } = "[]";
        }
    }
}

