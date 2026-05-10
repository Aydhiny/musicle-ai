using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IScoringService
    {
        public (int commercial, int production) CalculateScores(Characteristics characteristics);
        public List<string> GenerateStrengths(Characteristics c, int commercialScore, int productionScore);
        public int CalculateViralPotential(Characteristics c);
        public List<string> GenerateImprovements(Characteristics c, int commercialScore, int productionScore);
    }
}