namespace AiAgents.MusicAgent.Domain.Rules
{
    public class SystemState
    {
        public int TotalAnalyses { get; set; }
        public int NewAnalysesSinceLastTrain { get; set; }
        public string LastModelVersion { get; set; } = string.Empty;
        public double LastModelAccuracy { get; set; }
        public bool RetrainEnabled { get; set; }
    }
}
