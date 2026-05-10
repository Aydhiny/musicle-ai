namespace AiAgents.MusicAgent.Domain.Rules
{
    public class RetrainDecision
    {
        public bool ShouldRetrain { get; set; }
        public string Reason { get; set; } = string.Empty;
        public SystemState SystemState { get; set; } = null!;
    }
}
