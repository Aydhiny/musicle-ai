using AiAgents.MusicAgent.Application.Runners;

namespace AiAgents.MusicAgent.BackgroundServices
{
    public class LearningWorker : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<LearningWorker> _logger;

        public LearningWorker(IServiceProvider services, ILogger<LearningWorker> logger)
        {
            _services = services;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🧠 Learning Worker started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _services.CreateScope();
                    var learningAgent = scope.ServiceProvider.GetRequiredService<LearningAgentRunner>();

                    var result = await learningAgent.StepAsync(stoppingToken);

                    if (result?.ModelRetrained == true)
                    {
                        _logger.LogInformation("🎉 Model retrained: {Version}", result.ModelVersion);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in learning worker");
                }

                // Check every hour
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }
}
