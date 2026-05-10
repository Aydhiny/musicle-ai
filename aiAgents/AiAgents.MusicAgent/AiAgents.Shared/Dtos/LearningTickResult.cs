namespace AiAgents.MusicAgent.Domain.Dtos
{
    /// <summary>
    /// Result of one learning tick (model retraining)
    /// </summary>
    public class LearningTickResult
    {
        public string Action { get; set; } = string.Empty;
        public bool ModelRetrained { get; set; }
        public string ModelVersion { get; set; } = string.Empty;
        public double Accuracy { get; set; }
        public int TracksUsed { get; set; }
        public DateTime Timestamp { get; set; }
    }
}
