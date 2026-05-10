
namespace AiAgents.MusicAgent.Domain.Entities
{
    public class Analysis
    {
        public Guid Id { get; set; }
        public Guid TrackId { get; set; }
        public Track Track { get; set; } = null!;

        // Classification
        public string Genre { get; set; } = string.Empty;
        public string Subgenre { get; set; } = string.Empty;
        public int Confidence { get; set; }

        // Scores
        public int CommercialScore { get; set; }
        public int ProductionScore { get; set; }
        public int ViralPotential { get; set; }

        // JSON storage for complex data
        public string CharacteristicsJson { get; set; } = "{}";
        public string StrengthsJson { get; set; } = "[]";
        public string ImprovementsJson { get; set; } = "[]";
        public string SimilarTracksJson { get; set; } = "[]";

        public DateTime AnalyzedAt { get; set; }
        public List<string> Strengths { get; internal set; } = new();
        public List<string> Improvements { get; internal set; } = new();
    }
}
