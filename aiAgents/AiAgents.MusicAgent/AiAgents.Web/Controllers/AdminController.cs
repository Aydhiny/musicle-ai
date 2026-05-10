using AiAgents.MusicAgent.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/admin/moderation")]
    public class AdminController : ControllerBase
    {
        private readonly MusicAgentDbContext _db;
        private readonly string _adminToken;

        public AdminController(MusicAgentDbContext db, IConfiguration configuration)
        {
            _db = db;
            _adminToken = configuration["Admin:Token"] ?? string.Empty;
        }

        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 30,
            [FromQuery] bool includeDeleted = false,
            [FromQuery] string? search = null,
            CancellationToken ct = default)
        {
            if (!IsAdminRequest())
            {
                return Unauthorized(new { error = "Admin token missing or invalid." });
            }

            page = page < 1 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 100);
            var skip = (page - 1) * pageSize;

            var query = _db.HighlightPosts.AsNoTracking();
            if (!includeDeleted)
            {
                query = query.Where(p => !p.IsDeleted);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(p => p.Title.Contains(term) || p.Content.Contains(term) || p.Author.UserName.Contains(term));
            }

            var total = await query.CountAsync(ct);

            var rows = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip(skip)
                .Take(pageSize)
                .Select(p => new
                {
                    p.Id,
                    p.AnalysisId,
                    p.Title,
                    p.Content,
                    p.ContentFormat,
                    p.MediaJson,
                    p.CreatedAt,
                    p.UpdatedAt,
                    p.IsDeleted,
                    AuthorUserName = p.Author.UserName,
                    CommentCount = p.Comments.Count(c => !c.IsDeleted),
                    LikeCount = p.Likes.Count(),
                    ReactionCount = p.Reactions.Count()
                })
                .ToListAsync(ct);

            var posts = rows.Select(p => new
            {
                p.Id,
                p.AnalysisId,
                p.Title,
                contentPreview = p.Content.Length > 200 ? p.Content.Substring(0, 200) + "..." : p.Content,
                p.ContentFormat,
                p.CreatedAt,
                p.UpdatedAt,
                p.IsDeleted,
                p.AuthorUserName,
                p.CommentCount,
                p.LikeCount,
                p.ReactionCount
            }).ToList();

            return Ok(new
            {
                page,
                pageSize,
                total,
                posts
            });
        }

        [HttpPost("posts/{postId:guid}/delete")]
        public async Task<IActionResult> DeletePost(Guid postId, CancellationToken ct)
        {
            if (!IsAdminRequest())
            {
                return Unauthorized(new { error = "Admin token missing or invalid." });
            }

            var post = await _db.HighlightPosts.FirstOrDefaultAsync(p => p.Id == postId, ct);
            if (post == null)
            {
                return NotFound(new { error = "Post not found." });
            }

            if (!post.IsDeleted)
            {
                post.IsDeleted = true;
                post.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }

            return Ok(new { postId, status = "deleted" });
        }

        [HttpGet("comments")]
        public async Task<IActionResult> GetComments(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 40,
            [FromQuery] bool includeDeleted = false,
            [FromQuery] Guid? postId = null,
            [FromQuery] string? search = null,
            CancellationToken ct = default)
        {
            if (!IsAdminRequest())
            {
                return Unauthorized(new { error = "Admin token missing or invalid." });
            }

            page = page < 1 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 150);
            var skip = (page - 1) * pageSize;

            var query = _db.PostComments.AsNoTracking();
            if (!includeDeleted)
            {
                query = query.Where(c => !c.IsDeleted);
            }

            if (postId.HasValue)
            {
                query = query.Where(c => c.PostId == postId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(c => c.Content.Contains(term) || c.Author.UserName.Contains(term));
            }

            var total = await query.CountAsync(ct);

            var rows = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip(skip)
                .Take(pageSize)
                .Select(c => new
                {
                    c.Id,
                    c.PostId,
                    c.ParentCommentId,
                    c.Content,
                    c.CreatedAt,
                    c.UpdatedAt,
                    c.IsDeleted,
                    AuthorUserName = c.Author.UserName,
                    PostTitle = c.Post.Title
                })
                .ToListAsync(ct);

            var comments = rows.Select(c => new
            {
                c.Id,
                c.PostId,
                c.ParentCommentId,
                contentPreview = c.Content.Length > 200 ? c.Content.Substring(0, 200) + "..." : c.Content,
                c.CreatedAt,
                c.UpdatedAt,
                c.IsDeleted,
                c.AuthorUserName,
                c.PostTitle
            }).ToList();

            return Ok(new
            {
                page,
                pageSize,
                total,
                comments
            });
        }

        [HttpPost("comments/{commentId:guid}/delete")]
        public async Task<IActionResult> DeleteComment(Guid commentId, CancellationToken ct)
        {
            if (!IsAdminRequest())
            {
                return Unauthorized(new { error = "Admin token missing or invalid." });
            }

            var comment = await _db.PostComments.FirstOrDefaultAsync(c => c.Id == commentId, ct);
            if (comment == null)
            {
                return NotFound(new { error = "Comment not found." });
            }

            if (!comment.IsDeleted)
            {
                comment.IsDeleted = true;
                comment.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }

            return Ok(new { commentId, status = "deleted" });
        }

        [HttpGet("waveform-comments")]
        public async Task<IActionResult> GetWaveformComments(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 40,
            [FromQuery] Guid? trackId = null,
            [FromQuery] string? search = null,
            CancellationToken ct = default)
        {
            if (!IsAdminRequest())
            {
                return Unauthorized(new { error = "Admin token missing or invalid." });
            }

            page = page < 1 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 150);
            var skip = (page - 1) * pageSize;

            var query = _db.WaveformComments
                .Include(c => c.Author)
                .AsNoTracking();

            if (trackId.HasValue)
            {
                query = query.Where(c => c.TrackId == trackId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(c => c.Content.Contains(term) || c.Author.UserName.Contains(term));
            }

            var total = await query.CountAsync(ct);

            var comments = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip(skip)
                .Take(pageSize)
                .Select(c => new
                {
                    c.Id,
                    c.TrackId,
                    AuthorUserName = c.Author.UserName,
                    c.TimeSeconds,
                    c.Content,
                    c.CreatedAt
                })
                .ToListAsync(ct);

            return Ok(new
            {
                page,
                pageSize,
                total,
                comments
            });
        }

        [HttpPost("waveform-comments/{commentId:guid}/delete")]
        public async Task<IActionResult> DeleteWaveformComment(Guid commentId, CancellationToken ct)
        {
            if (!IsAdminRequest())
            {
                return Unauthorized(new { error = "Admin token missing or invalid." });
            }

            var comment = await _db.WaveformComments.FirstOrDefaultAsync(c => c.Id == commentId, ct);
            if (comment == null)
            {
                return NotFound(new { error = "Waveform comment not found." });
            }

            _db.WaveformComments.Remove(comment);
            await _db.SaveChangesAsync(ct);

            return Ok(new { commentId, status = "deleted" });
        }

        private bool IsAdminRequest()
        {
            if (string.IsNullOrWhiteSpace(_adminToken))
            {
                return false;
            }

            if (!Request.Headers.TryGetValue("X-Admin-Token", out var provided))
            {
                return false;
            }

            return string.Equals(provided.ToString(), _adminToken, StringComparison.Ordinal);
        }
    }
}
