using AiAgents.MusicAgent.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.MusicAgent.Web.Controllers
{
    /// <summary>
    /// Controller for demonstrating the learning mechanism
    /// Shows that the model changes behavior based on user feedback
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class LearningController : ControllerBase
    {
        private readonly LearningDemonstrationService _demo;
        private readonly ILogger<LearningController> _logger;

        public LearningController(
            LearningDemonstrationService demo,
            ILogger<LearningController> logger)
        {
            _demo = demo;
            _logger = logger;
        }

        /// <summary>
        /// Demonstrate that the model learns from a single user correction
        /// 
        /// This endpoint:
        /// 1. Makes an initial prediction
        /// 2. Simulates user correction
        /// 3. Retrains the model
        /// 4. Makes a new prediction on the same input
        /// 5. Shows the prediction changed (proof of learning)
        /// </summary>
        [HttpPost("demonstrate")]
        public async Task<IActionResult> Demonstrate(CancellationToken ct)
        {
            try
            {
                _logger.LogInformation("🎯 Learning demonstration requested via API");

                var result = await _demo.DemonstrateAsync(ct);

                return Ok(new
                {
                    success = true,
                    demonstration = new
                    {
                        step1_InitialPrediction = new
                        {
                            genre = result.InitialPrediction,
                            confidence = result.InitialConfidence
                        },
                        step2_UserCorrection = new
                        {
                            correctedGenre = result.UserCorrection,
                            message = $"User says this is actually '{result.UserCorrection}', not '{result.InitialPrediction}'"
                        },
                        step3_Retraining = new
                        {
                            message = "Model retrained with user feedback",
                            feedbackUsed = result.FeedbackUsedCount,
                            newAccuracy = $"{result.ModelAccuracy:P2}"
                        },
                        step4_FinalPrediction = new
                        {
                            genre = result.FinalPrediction,
                            confidence = result.FinalConfidence
                        },
                        results = new
                        {
                            modelLearned = result.ModelLearned,
                            correctAfterLearning = result.CorrectAfterLearning,
                            summary = result.ModelLearned
                                ? $"✅ SUCCESS! Model changed from '{result.InitialPrediction}' to '{result.FinalPrediction}'"
                                : $"❌ Model did not learn (same prediction: '{result.InitialPrediction}')"
                        }
                    },
                    testCharacteristics = result.TestCharacteristics
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in learning demonstration");
                return StatusCode(500, new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }

        /// <summary>
        /// Demonstrate learning with multiple corrections
        /// Shows cumulative learning effect
        /// </summary>
        [HttpPost("demonstrate-multiple")]
        public async Task<IActionResult> DemonstrateMultiple(
            [FromQuery] int corrections = 3,
            CancellationToken ct = default)
        {
            try
            {
                if (corrections < 1 || corrections > 10)
                    return BadRequest(new { error = "Corrections must be between 1 and 10" });

                _logger.LogInformation("🎯 Multiple corrections demonstration with {Count} corrections", corrections);

                var result = await _demo.DemonstrateMultipleCorrectionsAsync(corrections, ct);

                return Ok(new
                {
                    success = true,
                    totalCorrections = result.TotalCorrections,
                    correctAfterLearning = result.CorrectAfterLearning,
                    learningRate = $"{result.LearningRate:P0}",
                    modelAccuracy = $"{result.ModelAccuracy:P2}",
                    message = $"After {result.TotalCorrections} corrections, {result.CorrectAfterLearning} predictions are now correct ({result.LearningRate:P0} success rate)",
                    details = result.Results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in multiple corrections demonstration");
                return StatusCode(500, new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}