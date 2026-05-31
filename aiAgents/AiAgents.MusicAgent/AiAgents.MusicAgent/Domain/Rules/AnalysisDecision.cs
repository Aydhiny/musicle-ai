using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Domain.Rules
{
    public class AnalysisDecision
    {
        public Track Track { get; set; } = null!;
        public Characteristics Characteristics { get; set; } = null!;
        public string Genre { get; set; } = string.Empty;
        public string Subgenre { get; set; } = string.Empty;
        public int Confidence { get; set; }
        public int CommercialScore { get; set; }
        public int ProductionScore { get; set; }
        public int ViralPotential { get; set; }
        public List<SpotifyTrackDto> Recommendations { get; set; } = new();
        public List<string> Strengths { get; set; } = new();
        public List<string> Improvements { get; set; } = new();
        public IReadOnlyDictionary<string, float>? GenreProbabilities { get; set; }
    }
}
