using AiAgents.Shared.Dtos;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IDashboardInsightsService
    {
        Task<DashboardOverviewDto> GetOverviewAsync(CancellationToken ct);
        Task<UserDashboardDto> GetUserDashboardAsync(Guid userId, CancellationToken ct);
        Task<TrendRadarDto> GetTrendRadarAsync(CancellationToken ct);
        Task<FeedbackLeaderboardDto> GetFeedbackLeaderboardAsync(int take, CancellationToken ct);
    }
}
