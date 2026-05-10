using AiAgents.Core.AbstractionHelpers;
using AiAgents.MusicAgent.Domain.Dtos;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.MusicAgent.ML;
using Microsoft.EntityFrameworkCore;

namespace AiAgents.MusicAgent.Application.Runners
{
    /// <summary>
    /// Learning Agent: Monitors completed analyses and retrains ML model when needed
    /// 
    /// SENSE: Check system state (number of new analyses since last training)
    /// THINK: Decide if retraining is needed (threshold check)
    /// ACT: Trigger REAL ML model retraining using ML.NET
    /// LEARN: Update model version, activate new model
    /// </summary>
    public class LearningAgentRunner : SoftwareAgent<SystemState, RetrainDecision, LearningTickResult, ModelVersion>
    {
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<LearningAgentRunner> _logger;
        private readonly IGenreClassifier _classifier;

        // Configuration
        private const int RETRAIN_THRESHOLD = 50; // Retrain after 50 new analyses (lowered for demo)
        private const bool RETRAIN_ENABLED = true;

        public LearningAgentRunner(
            MusicAgentDbContext db,
            ILogger<LearningAgentRunner> logger,
            IGenreClassifier classifier)
        {
            _db = db;
            _logger = logger;
            _classifier = classifier;
        }

        public override async Task<LearningTickResult?> StepAsync(CancellationToken ct)
        {
            try
            {
                // SENSE: Check system state
                State = "sensing";
                var systemState = await SenseAsync(ct);
                if (systemState == null)
                {
                    State = "idle";
                    return null;
                }

                // THINK: Should we retrain?
                State = "thinking";
                var decision = await ThinkAsync(systemState, ct);
                if (decision == null || !decision.ShouldRetrain)
                {
                    State = "idle";
                    return new LearningTickResult
                    {
                        Action = "checked",
                        ModelRetrained = false,
                        Timestamp = DateTime.UtcNow
                    };
                }

                // ACT: Execute REAL ML training
                State = "acting";
                var result = await ActAsync(decision, ct);

                // LEARN: Update model version and activate
                if (result.ModelRetrained && !string.IsNullOrEmpty(result.ModelVersion))
                {
                    State = "learning";
                    var modelVersion = await _db.Set<ModelVersion>()
                        .FirstOrDefaultAsync(m => m.Version == result.ModelVersion, ct);

                    if (modelVersion != null)
                    {
                        await LearnAsync(modelVersion, ct);
                    }
                }

                State = "idle";
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in learning tick");
                State = "error";
                return null;
            }
        }

        protected override async Task<SystemState?> SenseAsync(CancellationToken ct)
        {
            // SENSE: Read system state from database
            var completedCount = await _db.Analyses.CountAsync(ct);
            var lastModel = await _db.Set<ModelVersion>()
                .OrderByDescending(m => m.TrainedAt)
                .FirstOrDefaultAsync(ct);

            var newAnalysesSinceLastTrain = lastModel != null
                ? await _db.Analyses.CountAsync(a => a.AnalyzedAt > lastModel.TrainedAt, ct)
                : completedCount;

            _logger.LogDebug("System state: {Total} total analyses, {New} new since last train",
                completedCount, newAnalysesSinceLastTrain);

            return new SystemState
            {
                TotalAnalyses = completedCount,
                NewAnalysesSinceLastTrain = newAnalysesSinceLastTrain,
                LastModelVersion = lastModel?.Version ?? "none",
                LastModelAccuracy = lastModel?.Accuracy ?? 0.0,
                RetrainEnabled = RETRAIN_ENABLED
            };
        }

        protected override Task<RetrainDecision?> ThinkAsync(SystemState state, CancellationToken ct)
        {
            // THINK: Apply business rule - should we retrain?
            var shouldRetrain = state.RetrainEnabled
                && state.NewAnalysesSinceLastTrain >= RETRAIN_THRESHOLD;

            _logger.LogInformation(
                "Learning decision: {NewCount} new analyses (threshold: {Threshold}) - Retrain: {ShouldRetrain}",
                state.NewAnalysesSinceLastTrain, RETRAIN_THRESHOLD, shouldRetrain);

            var decision = new RetrainDecision
            {
                ShouldRetrain = shouldRetrain,
                Reason = shouldRetrain
                    ? $"Threshold reached: {state.NewAnalysesSinceLastTrain} >= {RETRAIN_THRESHOLD} new analyses"
                    : $"Not enough data: {state.NewAnalysesSinceLastTrain} < {RETRAIN_THRESHOLD} analyses",
                SystemState = state
            };

            return Task.FromResult<RetrainDecision?>(decision);
        }

        protected override async Task<LearningTickResult> ActAsync(RetrainDecision decision, CancellationToken ct)
        {
            // ACT: Perform REAL ML model retraining
            _logger.LogInformation("🤖 Starting REAL ML model training: {Reason}", decision.Reason);

            try
            {
                // Get training data from database (our analyzed tracks)
                var trainingData = await _db.Analyses
                    .Include(a => a.Track)
                    .Where(a => a.Confidence >= 60) // Only use reasonably confident analyses
                    .ToListAsync(ct);

                _logger.LogInformation("📊 Training with {Count} analyzed tracks from database", trainingData.Count);

                // Train ML.NET model on Spotify dataset
                var startTime = DateTime.UtcNow;
                var metrics = await _classifier.TrainAsync(ct);
                var trainingDuration = DateTime.UtcNow - startTime;

                _logger.LogInformation(
                    "✅ Model training completed in {Duration}s - Accuracy: {Accuracy:P2}",
                    trainingDuration.TotalSeconds, metrics.Accuracy);

                // Create new model version record
                var newVersion = new ModelVersion
                {
                    Id = Guid.NewGuid(),
                    ModelName = "MLNet_GenreClassifier",
                    Version = $"v{DateTime.UtcNow:yyyyMMdd-HHmmss}",
                    TrainedAt = DateTime.UtcNow,
                    IsActive = true,
                    TracksUsedForTraining = metrics.TrainingSamples,
                    Accuracy = metrics.Accuracy,
                    MetricsJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        accuracy = metrics.Accuracy,
                        logLoss = metrics.LogLoss,
                        trainingSamples = metrics.TrainingSamples,
                        trainingDuration = trainingDuration.TotalSeconds,
                        databaseSamples = trainingData.Count
                    })
                };

                // Deactivate old models
                var oldModels = await _db.Set<ModelVersion>()
                    .Where(m => m.IsActive)
                    .ToListAsync(ct);

                foreach (var oldModel in oldModels)
                {
                    oldModel.IsActive = false;
                    _logger.LogInformation("📦 Deactivated old model: {Version}", oldModel.Version);
                }

                // Save new model version
                _db.Set<ModelVersion>().Add(newVersion);
                await _db.SaveChangesAsync(ct);

                _logger.LogInformation(
                    "🎉 Model {Version} is now active - Accuracy: {Accuracy:P2}, Samples: {Samples}",
                    newVersion.Version, newVersion.Accuracy, newVersion.TracksUsedForTraining);

                return new LearningTickResult
                {
                    Action = "retrained",
                    ModelRetrained = true,
                    ModelVersion = newVersion.Version,
                    Accuracy = newVersion.Accuracy,
                    TracksUsed = newVersion.TracksUsedForTraining,
                    Timestamp = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Model training failed");

                return new LearningTickResult
                {
                    Action = "training_failed",
                    ModelRetrained = false,
                    Timestamp = DateTime.UtcNow
                };
            }
        }

        protected override async Task LearnAsync(ModelVersion modelVersion, CancellationToken ct)
        {
            // LEARN: Post-training activities
            _logger.LogInformation("📚 Learning phase: Model {Version} is now active", modelVersion.Version);

            // Additional learning activities:
            // 1. Update performance metrics
            // 2. Send notifications
            // 3. Log to analytics
            // 4. Update dashboard

            // For now, just log success
            _logger.LogInformation(
                "✨ Model activated successfully - Ready for predictions with {Accuracy:P2} accuracy",
                modelVersion.Accuracy);

            await Task.CompletedTask;
        }
    }

    /// <summary>
    /// System state perceived by the learning agent
    /// </summary>

    /// <summary>
    /// Decision whether to retrain the model
    /// </summary>
}
