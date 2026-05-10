using Microsoft.AspNetCore.SignalR;
using AiAgents.MusicAgent.Application.Runners;
using AiAgents.Web.Hubs;

namespace AiAgents.MusicAgent.BackgroundServices
{
    /// <summary>
    /// Background worker that orchestrates the Analysis Agent
    /// 
    /// CRITICAL: This is a THIN layer - no business logic!
    /// - Creates scope per iteration
    /// - Calls runner.StepAsync() for ONE tick
    /// - Emits SignalR events
    /// - Handles delays and backoff
    /// 
    /// All agent logic (Sense-Think-Act) is in AnalysisAgentRunner
    /// </summary>
    public class AnalysisWorker : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly IHubContext<AnalysisHub> _hub;
        private readonly ILogger<AnalysisWorker> _logger;

        public AnalysisWorker(
            IServiceProvider services,
            IHubContext<AnalysisHub> hub,
            ILogger<AnalysisWorker> logger)
        {
            _services = services;
            _hub = hub;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            _logger.LogInformation("Analysis Worker started");

            // Main worker loop
            while (!ct.IsCancellationRequested)
            {
                // Create new scope for this iteration (important for DbContext lifecycle)
                using var scope = _services.CreateScope();
                var runner = scope.ServiceProvider.GetRequiredService<AnalysisAgentRunner>();

                try
                {
                    // ONE TICK of the agent cycle
                    // Runner handles all logic: Sense → Think → Act
                    var result = await runner.StepAsync(ct);

                    if (result != null)
                    {
                        // Work was done - emit real-time update via SignalR
                        await _hub.Clients.Group($"track_{result.TrackId}")
                            .SendAsync("AnalysisCompleted", new
                            {
                                trackId = result.TrackId,
                                fileName = result.FileName,
                                genre = result.Genre,
                                subgenre = result.Subgenre,
                                confidence = result.Confidence,
                                commercialScore = result.CommercialScore,
                                productionScore = result.ProductionScore,
                                viralPotential = result.ViralPotential,
                                status = "Completed",
                                processedAt = result.ProcessedAt
                            }, ct);

                        _logger.LogInformation("Track {TrackId} analyzed: {Genre} ({Confidence}%)",
                            result.TrackId, result.Genre, result.Confidence);

                        // Small delay after successful work
                        await Task.Delay(500, ct);
                    }
                    else
                    {
                        // No work available - backoff strategy
                        _logger.LogDebug("No tracks in queue, waiting...");
                        await Task.Delay(2000, ct);
                    }
                }
                catch (OperationCanceledException)
                {
                    // Expected during shutdown
                    _logger.LogInformation("Analysis Worker shutting down");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in worker iteration");
                    // Longer delay after error to avoid hammering
                    await Task.Delay(5000, ct);
                }
            }

            _logger.LogInformation("Analysis Worker stopped");
        }
    }
}