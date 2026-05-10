namespace AiAgents.MusicAgent.Domain.Dtos
{
    public class AnalysisTickResult
    {
        public Guid TrackId { get; set; }
        public string State { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string Genre { get; set; } = string.Empty;
        public string Subgenre { get; set; } = string.Empty;
        public int Confidence { get; set; }
        public int CommercialScore { get; set; }
        public int ProductionScore { get; set; }
        public int ViralPotential { get; set; }
        public DateTime ProcessedAt { get; set; }
    }
}
