using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ComparisonsController : ControllerBase
    {
        private readonly MusicAgentDbContext _db;

        public ComparisonsController(MusicAgentDbContext db)
        {
            _db = db;
        }

        [Authorize]
        [HttpPost("vote")]
        public async Task<IActionResult> Vote([FromBody] ComparisonVoteRequestDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            if (dto.TrackAId == dto.TrackBId)
            {
                return BadRequest(new { error = "Tracks must be different." });
            }

            if (dto.WinnerTrackId != dto.TrackAId && dto.WinnerTrackId != dto.TrackBId)
            {
                return BadRequest(new { error = "Winner must be one of the compared tracks." });
            }

            var trackIds = new[] { dto.TrackAId, dto.TrackBId }.OrderBy(id => id).ToArray();
            var trackAId = trackIds[0];
            var trackBId = trackIds[1];

            var exists = await _db.Tracks
                .AsNoTracking()
                .CountAsync(t => t.Id == trackAId || t.Id == trackBId, ct);

            if (exists != 2)
            {
                return NotFound(new { error = "One or more tracks not found." });
            }

            var existing = await _db.ComparisonVotes
                .FirstOrDefaultAsync(v => v.VoterId == userId && v.TrackAId == trackAId && v.TrackBId == trackBId, ct);

            if (existing is null)
            {
                _db.ComparisonVotes.Add(new ComparisonVote
                {
                    Id = Guid.NewGuid(),
                    TrackAId = trackAId,
                    TrackBId = trackBId,
                    WinnerTrackId = dto.WinnerTrackId,
                    VoterId = userId,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.WinnerTrackId = dto.WinnerTrackId;
                existing.CreatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);

            var stats = await GetStatsInternalAsync(trackAId, trackBId, ct);

            return Ok(new ComparisonVoteResultDto
            {
                TrackAId = trackAId,
                TrackBId = trackBId,
                WinnerTrackId = dto.WinnerTrackId,
                TotalVotes = stats.TotalVotes
            });
        }

        [AllowAnonymous]
        [HttpGet("{trackAId:guid}/{trackBId:guid}")]
        public async Task<IActionResult> GetStats(Guid trackAId, Guid trackBId, CancellationToken ct)
        {
            if (trackAId == trackBId)
            {
                return BadRequest(new { error = "Tracks must be different." });
            }

            var trackIds = new[] { trackAId, trackBId }.OrderBy(id => id).ToArray();
            var normalizedA = trackIds[0];
            var normalizedB = trackIds[1];

            var stats = await GetStatsInternalAsync(normalizedA, normalizedB, ct);
            return Ok(stats);
        }

        private async Task<ComparisonStatsDto> GetStatsInternalAsync(Guid trackAId, Guid trackBId, CancellationToken ct)
        {
            var votes = await _db.ComparisonVotes
                .AsNoTracking()
                .Where(v => v.TrackAId == trackAId && v.TrackBId == trackBId)
                .GroupBy(v => v.WinnerTrackId)
                .Select(g => new { WinnerId = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var votesA = votes.FirstOrDefault(v => v.WinnerId == trackAId)?.Count ?? 0;
            var votesB = votes.FirstOrDefault(v => v.WinnerId == trackBId)?.Count ?? 0;

            return new ComparisonStatsDto
            {
                TrackAId = trackAId,
                TrackBId = trackBId,
                VotesForTrackA = votesA,
                VotesForTrackB = votesB,
                TotalVotes = votesA + votesB
            };
        }

        private bool TryGetCurrentUserId(out Guid userId)
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(id, out userId);
        }
    }
}
