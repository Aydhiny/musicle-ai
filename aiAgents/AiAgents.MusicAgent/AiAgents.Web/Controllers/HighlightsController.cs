using AiAgents.MusicAgent.Application.Exceptions;
using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.Shared.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HighlightsController : ControllerBase
    {
        private readonly IHighlightSocialService _socialService;

        public HighlightsController(IHighlightSocialService socialService)
        {
            _socialService = socialService;
        }

        [AllowAnonymous]
        [HttpGet("feed")]
        public async Task<IActionResult> Feed(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? mode = null,
            CancellationToken ct = default)
        {
            Guid? currentUserId = TryGetCurrentUserId(out var resolvedUserId) ? resolvedUserId : null;
            var result = await _socialService.GetFeedAsync(currentUserId, page, pageSize, mode, ct);
            return Ok(result);
        }

        [AllowAnonymous]
        [HttpGet("{postId:guid}")]
        public async Task<IActionResult> GetById(Guid postId, CancellationToken ct)
        {
            try
            {
                Guid? currentUserId = TryGetCurrentUserId(out var resolvedUserId) ? resolvedUserId : null;
                var post = await _socialService.GetPostByIdAsync(postId, currentUserId, ct);
                return Ok(post);
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateHighlightPostDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var post = await _socialService.CreatePostAsync(currentUserId, dto, ct);
                return Ok(post);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("{postId:guid}")]
        public async Task<IActionResult> Update(Guid postId, [FromBody] UpdateHighlightPostDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var post = await _socialService.UpdatePostAsync(currentUserId, postId, dto, ct);
                return Ok(post);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpDelete("{postId:guid}")]
        public async Task<IActionResult> Delete(Guid postId, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                await _socialService.DeletePostAsync(currentUserId, postId, ct);
                return NoContent();
            }
            catch (ForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("{postId:guid}/comments")]
        public async Task<IActionResult> AddComment(Guid postId, [FromBody] CreatePostCommentDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var comment = await _socialService.AddCommentAsync(currentUserId, postId, dto, ct);
                return Ok(comment);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpDelete("comments/{commentId:guid}")]
        public async Task<IActionResult> DeleteComment(Guid commentId, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                await _socialService.DeleteCommentAsync(currentUserId, commentId, ct);
                return NoContent();
            }
            catch (ForbiddenException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("{postId:guid}/likes/toggle")]
        public async Task<IActionResult> TogglePostLike(Guid postId, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var result = await _socialService.TogglePostLikeAsync(currentUserId, postId, ct);
                return Ok(result);
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("{postId:guid}/reactions/toggle")]
        public async Task<IActionResult> TogglePostReaction(Guid postId, [FromBody] ToggleReactionRequestDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var result = await _socialService.TogglePostReactionAsync(currentUserId, postId, dto.Reaction, ct);
                return Ok(result);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("comments/{commentId:guid}/likes/toggle")]
        public async Task<IActionResult> ToggleCommentLike(Guid commentId, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var currentUserId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var result = await _socialService.ToggleCommentLikeAsync(currentUserId, commentId, ct);
                return Ok(result);
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        private bool TryGetCurrentUserId(out Guid userId)
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(id, out userId);
        }
    }
}
