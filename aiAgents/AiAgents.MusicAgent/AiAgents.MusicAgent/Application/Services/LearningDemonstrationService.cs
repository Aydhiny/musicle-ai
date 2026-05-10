using AiAgents.MusicAgent.Domain.Dtos;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.MusicAgent.ML;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace AiAgents.MusicAgent.Application.Services
{
    /// <summary>
    /// DEMONSTRATION: Shows that the model LEARNS from user feedback
    /// 
    /// This service demonstrates:
    /// 1. Initial prediction on a track
    /// 2. User corrects the prediction (feedback)
    /// 3. Model retrains with the correction
    /// 4. Same track gets DIFFERENT prediction (proof of learning)
    /// </summary>
    public class LearningDemonstrationService
    {
        private readonly MusicAgentDbContext _db;
        private readonly IGenreClassifier _classifier;
        private readonly ILogger<LearningDemonstrationService> _logger;

        public LearningDemonstrationService(
            MusicAgentDbContext db,
            IGenreClassifier classifier,
            ILogger<LearningDemonstrationService> logger)
        {
            _db = db;
            _classifier = classifier;
            _logger = logger;
        }

        /// <summary>
        /// Run a complete learning demonstration
        /// </summary>
        public async Task<LearningDemonstrationResult> DemonstrateAsync(CancellationToken ct)
        {
            _logger.LogInformation("🎬 Starting learning demonstration...");

            // STEP 1: Create a test track with specific characteristics
            var testCharacteristics = new Characteristics
            {
                Tempo = 95,
                Energy = 0.45,
                Danceability = 0.55,
                Valence = 0.40,
                Acousticness = 0.65,
                Loudness = -8.0,
                Speechiness = 0.08,
                Instrumentalness = 0.35,
                SpectralCentroid = 2100,
                DynamicRange = 4.5
            };

            _logger.LogInformation("📊 Test characteristics: Tempo={Tempo}, Energy={Energy}, Acousticness={Acousticness}",
                testCharacteristics.Tempo, testCharacteristics.Energy, testCharacteristics.Acousticness);

            // STEP 2: Get INITIAL prediction (before learning)
            _logger.LogInformation("🔮 Getting initial prediction...");
            var initialPrediction = await _classifier.PredictAsync(testCharacteristics, ct);

            _logger.LogInformation("📝 Initial prediction: {Genre} ({Confidence}%)",
                initialPrediction.Genre, initialPrediction.Confidence);

            // STEP 3: Simulate user correction
            var correctGenre = "Indie/Alternative"; // User says it's actually Indie
            _logger.LogInformation("👤 User correction: '{Wrong}' → '{Right}'",
                initialPrediction.Genre, correctGenre);

            // Create analysis and feedback in database
            var track = new Track
            {
                Id = Guid.NewGuid(),
                FileName = "demo_track_learning_test.mp3",
                AudioData = new byte[0],
                UploadedAt = DateTime.UtcNow,
                Status = Domain.Enums.AnalysisStatus.Completed
            };

            var analysis = new Analysis
            {
                Id = Guid.NewGuid(),
                TrackId = track.Id,
                Genre = initialPrediction.Genre,
                Subgenre = "Test",
                Confidence = initialPrediction.Confidence,
                CommercialScore = 7,
                ProductionScore = 7,
                ViralPotential = 6,
                CharacteristicsJson = JsonSerializer.Serialize(testCharacteristics),
                StrengthsJson = "[]",
                ImprovementsJson = "[]",
                AnalyzedAt = DateTime.UtcNow
            };

            var feedback = new UserFeedback
            {
                Id = Guid.NewGuid(),
                AnalysisId = analysis.Id,
                CorrectedGenre = correctGenre,
                AccuracyRating = 2, // Low rating - model was wrong
                Notes = "This is clearly Indie/Alternative, not " + initialPrediction.Genre,
                SubmittedAt = DateTime.UtcNow,
                UsedInTraining = false
            };

            _db.Tracks.Add(track);
            _db.Analyses.Add(analysis);
            _db.Set<UserFeedback>().Add(feedback);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("💾 Saved feedback to database");

            // STEP 4: Count feedback before training
            var feedbackCountBefore = await _db.Set<UserFeedback>()
                .CountAsync(f => !f.UsedInTraining, ct);

            _logger.LogInformation("📊 Pending feedback: {Count} corrections", feedbackCountBefore);

            // STEP 5: RETRAIN the model (with the user's correction)
            _logger.LogInformation("🔧 Retraining model with user feedback...");
            var metrics = await _classifier.TrainAsync(ct);

            _logger.LogInformation("✅ Retraining completed - Accuracy: {Accuracy:P2}", metrics.Accuracy);

            // STEP 6: Count feedback after training (should be marked as used)
            var feedbackCountAfter = await _db.Set<UserFeedback>()
                .CountAsync(f => !f.UsedInTraining, ct);

            _logger.LogInformation("📊 Pending feedback after training: {Count}", feedbackCountAfter);

            // STEP 7: Get NEW prediction on SAME characteristics
            _logger.LogInformation("🔮 Getting prediction after learning...");
            var finalPrediction = await _classifier.PredictAsync(testCharacteristics, ct);

            _logger.LogInformation("📝 Final prediction: {Genre} ({Confidence}%)",
                finalPrediction.Genre, finalPrediction.Confidence);

            // STEP 8: Compare results
            var learned = finalPrediction.Genre != initialPrediction.Genre;
            var correctAfterLearning = finalPrediction.Genre == correctGenre;

            if (learned && correctAfterLearning)
            {
                _logger.LogInformation("🎉 SUCCESS! Model learned from feedback:");
                _logger.LogInformation("   Before: {Before} → After: {After} ✅",
                    initialPrediction.Genre, finalPrediction.Genre);
            }
            else if (learned)
            {
                _logger.LogInformation("⚠️ Model changed prediction but not to user's correction:");
                _logger.LogInformation("   Before: {Before} → After: {After} (User wanted: {Correct})",
                    initialPrediction.Genre, finalPrediction.Genre, correctGenre);
            }
            else
            {
                _logger.LogWarning("❌ Model did NOT change prediction (may need more feedback)");
                _logger.LogWarning("   Before: {Before} → After: {After}",
                    initialPrediction.Genre, finalPrediction.Genre);
            }

            return new LearningDemonstrationResult
            {
                InitialPrediction = initialPrediction.Genre,
                InitialConfidence = initialPrediction.Confidence,
                UserCorrection = correctGenre,
                FinalPrediction = finalPrediction.Genre,
                FinalConfidence = finalPrediction.Confidence,
                ModelLearned = learned,
                CorrectAfterLearning = correctAfterLearning,
                FeedbackUsedCount = feedbackCountBefore - feedbackCountAfter,
                ModelAccuracy = metrics.Accuracy,
                TestCharacteristics = testCharacteristics
            };
        }

        /// <summary>
        /// Demonstrate learning on multiple corrections
        /// </summary>
        public async Task<MultipleCorrectionsResult> DemonstrateMultipleCorrectionsAsync(
            int correctionCount,
            CancellationToken ct)
        {
            _logger.LogInformation("🎬 Demonstrating learning with {Count} corrections...", correctionCount);

            var results = new List<SingleCorrectionResult>();

            // Create several tracks with similar characteristics that should be Acoustic/Folk
            var acousticCharacteristics = new[]
            {
                new Characteristics { Tempo = 85, Energy = 0.35, Acousticness = 0.85, Valence = 0.45 },
                new Characteristics { Tempo = 92, Energy = 0.40, Acousticness = 0.78, Valence = 0.50 },
                new Characteristics { Tempo = 78, Energy = 0.32, Acousticness = 0.90, Valence = 0.38 },
            };

            foreach (var chars in acousticCharacteristics.Take(correctionCount))
            {
                // Get initial prediction
                var initial = await _classifier.PredictAsync(chars, ct);

                // Create feedback correcting to Acoustic/Folk
                var track = new Track
                {
                    Id = Guid.NewGuid(),
                    FileName = $"acoustic_demo_{Guid.NewGuid()}.mp3",
                    AudioData = new byte[0],
                    UploadedAt = DateTime.UtcNow,
                    Status = Domain.Enums.AnalysisStatus.Completed
                };

                var analysis = new Analysis
                {
                    Id = Guid.NewGuid(),
                    TrackId = track.Id,
                    Genre = initial.Genre,
                    Confidence = initial.Confidence,
                    CharacteristicsJson = JsonSerializer.Serialize(chars),
                    AnalyzedAt = DateTime.UtcNow
                };

                var feedback = new UserFeedback
                {
                    Id = Guid.NewGuid(),
                    AnalysisId = analysis.Id,
                    CorrectedGenre = "Acoustic/Folk",
                    AccuracyRating = initial.Genre == "Acoustic/Folk" ? 5 : 2,
                    SubmittedAt = DateTime.UtcNow
                };

                _db.Tracks.Add(track);
                _db.Analyses.Add(analysis);
                _db.Set<UserFeedback>().Add(feedback);

                results.Add(new SingleCorrectionResult
                {
                    InitialGenre = initial.Genre,
                    CorrectedGenre = "Acoustic/Folk"
                });
            }

            await _db.SaveChangesAsync(ct);

            // Retrain
            _logger.LogInformation("🔧 Retraining with {Count} corrections...", correctionCount);
            var metrics = await _classifier.TrainAsync(ct);

            // Test all characteristics again
            var afterCorrections = new List<string>();
            foreach (var chars in acousticCharacteristics.Take(correctionCount))
            {
                var prediction = await _classifier.PredictAsync(chars, ct);
                afterCorrections.Add(prediction.Genre);
            }

            var correctCount = afterCorrections.Count(g => g == "Acoustic/Folk");
            var learningRate = (double)correctCount / correctionCount;

            _logger.LogInformation("📊 Learning results: {Correct}/{Total} now predict correctly ({Rate:P0})",
                correctCount, correctionCount, learningRate);

            return new MultipleCorrectionsResult
            {
                TotalCorrections = correctionCount,
                CorrectAfterLearning = correctCount,
                LearningRate = learningRate,
                ModelAccuracy = metrics.Accuracy,
                Results = results
            };
        }
    }

    public class LearningDemonstrationResult
    {
        public string InitialPrediction { get; set; } = string.Empty;
        public int InitialConfidence { get; set; }
        public string UserCorrection { get; set; } = string.Empty;
        public string FinalPrediction { get; set; } = string.Empty;
        public int FinalConfidence { get; set; }
        public bool ModelLearned { get; set; }
        public bool CorrectAfterLearning { get; set; }
        public int FeedbackUsedCount { get; set; }
        public double ModelAccuracy { get; set; }
        public Characteristics TestCharacteristics { get; set; } = new();
    }

    public class MultipleCorrectionsResult
    {
        public int TotalCorrections { get; set; }
        public int CorrectAfterLearning { get; set; }
        public double LearningRate { get; set; }
        public double ModelAccuracy { get; set; }
        public List<SingleCorrectionResult> Results { get; set; } = new();
    }

    public class SingleCorrectionResult
    {
        public string InitialGenre { get; set; } = string.Empty;
        public string CorrectedGenre { get; set; } = string.Empty;
    }
}