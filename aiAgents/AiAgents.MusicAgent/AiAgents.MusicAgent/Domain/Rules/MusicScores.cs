namespace AiAgents.MusicAgent.Domain.Rules
{
    public class MusicScores
    {
        public int CommercialScore { get; set; }
        public int ProductionScore { get; set; }
        public int ViralPotential { get; set; }
        public List<string> Strengths { get; set; } = new();
        public List<string> Improvements { get; set; } = new();
    }
}
