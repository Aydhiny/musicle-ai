using AiAgents.MusicAgent.Application.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AiAgents.MusicAgent.Application.Services
{
    public class StalledTrackReclaimService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<StalledTrackReclaimService> _logger;

        // Configuration
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(5);  // Check every 5 minutes
        private readonly TimeSpan _stallTimeout = TimeSpan.FromMinutes(30);  // Tracks stalled for 30+ min

        public StalledTrackReclaimService(
            IServiceProvider serviceProvider,
            ILogger<StalledTrackReclaimService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation(
                "🔄 Stalled Track Reclaim Service started. Check interval: {Interval}, Timeout: {Timeout}",
                _checkInterval, _stallTimeout);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(_checkInterval, stoppingToken);

                    // Create scope to get scoped services
                    using var scope = _serviceProvider.CreateScope();
                    var queueService = scope.ServiceProvider.GetRequiredService<IQueueService>();

                    _logger.LogDebug("🔍 Checking for stalled tracks...");

                    // Reclaim tracks that have been processing for too long
                    await queueService.ReclaimStalledTracksAsync(_stallTimeout, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Normal shutdown
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error in stalled track reclaim service");
                    // Continue running despite error
                }
            }

            _logger.LogInformation("🛑 Stalled Track Reclaim Service stopped");
        }
    }
}
