namespace AiAgents.Shared.Dtos
{
    /// <summary>
    /// DTO for submitting user feedback/corrections
    /// </summary>
    public class SubmitFeedbackDto
    {
        public Guid AnalysisId { get; set; }

        /// <summary>
        /// Corrected genre if user disagrees with prediction
        /// </summary>
        public string? CorrectedGenre { get; set; }

        /// <summary>
        /// Corrected subgenre
        /// </summary>
        public string? CorrectedSubgenre { get; set; }

        /// <summary>
        /// How accurate was the prediction? (1-5 stars)
        /// </summary>
        public int? AccuracyRating { get; set; }

        /// <summary>
        /// User's opinion on commercial score (1-10)
        /// </summary>
        public int? CorrectedCommercialScore { get; set; }

        /// <summary>
        /// User's opinion on production score (1-10)
        /// </summary>
        public int? CorrectedProductionScore { get; set; }

        /// <summary>
        /// User's opinion on viral potential (1-10)
        /// </summary>
        public int? CorrectedViralPotential { get; set; }

        /// <summary>
        /// Optional notes/comments
        /// </summary>
        public string? Notes { get; set; }
    }

    /// <summary>
    /// Enhanced training data that includes user feedback
    /// </summary>
    public class EnhancedTrainingData
    {
        public Guid AnalysisId { get; set; }

        // Original characteristics
        public float Tempo { get; set; }
        public float Energy { get; set; }
        public float Danceability { get; set; }
        public float Valence { get; set; }
        public float Acousticness { get; set; }
        public float Loudness { get; set; }
        public float Speechiness { get; set; }
        public float Instrumentalness { get; set; }
        public float Liveness { get; set; }
        public float Popularity { get; set; }
        public float SpectralCentroid { get; set; }   // normalised 0–1 (Hz / 4000)
        public float ZeroCrossingRate { get; set; }

        // Gold label - corrected by user OR original prediction if validated
        public string Label { get; set; } = string.Empty;

        // Metadata
        public bool IsCorrected { get; set; } // True if user corrected
        public int? AccuracyRating { get; set; } // User's rating
        public DateTime AnalyzedAt { get; set; }
    }
}
