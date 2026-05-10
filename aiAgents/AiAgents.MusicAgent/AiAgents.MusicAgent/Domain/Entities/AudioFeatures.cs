namespace AiAgents.MusicAgent.Domain.Entities
{
    public class AudioFeatures
    {
        public double Duration { get; set; }
        public int SampleRate { get; set; }
        public double AvgEnergy { get; set; }
        public int ZeroCrossings { get; set; }
        public List<double> Peaks { get; set; } = new();
        public List<double> SpectralData { get; set; } = new();
    }
}
