using AiAgents.MusicAgent.Application.Exceptions;
using AiAgents.MusicAgent.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardInsightsService _dashboardInsights;

        public DashboardController(IDashboardInsightsService dashboardInsights)
        {
            _dashboardInsights = dashboardInsights;
        }

        [AllowAnonymous]
        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview(CancellationToken ct)
        {
            var overview = await _dashboardInsights.GetOverviewAsync(ct);
            return Ok(overview);
        }

        [AllowAnonymous]
        [HttpGet("trends")]
        public async Task<IActionResult> GetTrends(CancellationToken ct)
        {
            var trends = await _dashboardInsights.GetTrendRadarAsync(ct);
            return Ok(trends);
        }

        [AllowAnonymous]
        [HttpGet("feedback-leaderboard")]
        public async Task<IActionResult> GetFeedbackLeaderboard([FromQuery] int take = 10, CancellationToken ct = default)
        {
            var leaderboard = await _dashboardInsights.GetFeedbackLeaderboardAsync(take, ct);
            return Ok(leaderboard);
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMyDashboard(CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var dashboard = await _dashboardInsights.GetUserDashboardAsync(userId, ct);
                return Ok(dashboard);
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
