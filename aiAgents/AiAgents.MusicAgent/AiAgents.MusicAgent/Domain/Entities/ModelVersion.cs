namespace AiAgents.MusicAgent.Domain.Entities
{
    public class ModelVersion
    {
        public Guid Id { get; set; }
        public string ModelName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public DateTime TrainedAt { get; set; }
        public bool IsActive { get; set; }
        public int TracksUsedForTraining { get; set; }
        public double Accuracy { get; set; }
        public string MetricsJson { get; set; } = "{}";
    }
}
