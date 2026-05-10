namespace AiAgents.MusicAgent.Domain.Entities
{
    public class Characteristics
    {
        public double Tempo { get; set; }
        public double Energy { get; set; }
        public double Danceability { get; set; }
        public double Valence { get; set; }
        public double Acousticness { get; set; }
        public double Loudness { get; set; }
        public double Speechiness { get; set; }
        public double Instrumentalness { get; set; }
        public double SpectralCentroid { get; set; }
        public double DynamicRange { get; set; }
        public double ZeroCrossingRate { get; internal set; }
    }
}
