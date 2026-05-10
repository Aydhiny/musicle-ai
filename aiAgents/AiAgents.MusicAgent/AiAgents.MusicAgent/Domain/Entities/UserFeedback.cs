namespace AiAgents.MusicAgent.Domain.Entities
{
    /// <summary>
    /// Stores user corrections/feedback as "gold" labels for model retraining
    /// This is the LEARNING signal - when users correct the model's predictions
    /// </summary>
    public class UserFeedback
    {
        public Guid Id { get; set; }

        public Guid? UserId { get; set; }
        public AppUser? User { get; set; }

        /// <summary>
        /// Which analysis this feedback is for
        /// </summary>
        public Guid AnalysisId { get; set; }
        public Analysis Analysis { get; set; } = null!;

        /// <summary>
        /// User-corrected genre (if different from predicted)
        /// This becomes the "gold label" for retraining
        /// </summary>
        public string? CorrectedGenre { get; set; }

        /// <summary>
        /// User-corrected subgenre (optional)
        /// </summary>
        public string? CorrectedSubgenre { get; set; }

        /// <summary>
        /// User rating of the prediction accuracy (1-5)
        /// </summary>
        public int? AccuracyRating { get; set; }

        /// <summary>
        /// User-adjusted commercial score (1-10)
        /// </summary>
        public int? CorrectedCommercialScore { get; set; }

        /// <summary>
        /// User-adjusted production score (1-10)
        /// </summary>
        public int? CorrectedProductionScore { get; set; }

        /// <summary>
        /// User-adjusted viral potential (1-10)
        /// </summary>
        public int? CorrectedViralPotential { get; set; }

        /// <summary>
        /// Free text feedback/notes
        /// </summary>
        public string? Notes { get; set; }

        /// <summary>
        /// When this feedback was submitted
        /// </summary>
        public DateTime SubmittedAt { get; set; }

        /// <summary>
        /// Whether this feedback has been incorporated into training
        /// </summary>
        public bool UsedInTraining { get; set; }

        /// <summary>
        /// Which model version first used this feedback
        /// </summary>
        public string? FirstUsedInModelVersion { get; set; }
    }
}
