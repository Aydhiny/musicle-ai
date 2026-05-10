namespace AiAgents.MusicAgent.Data
{
    public class SpotifyTrackData
    {
        public string SongName { get; set; } = string.Empty;
        public string ArtistName { get; set; } = string.Empty;
        public int Popularity { get; set; }
        public float Danceability { get; set; }
        public float Energy { get; set; }
        public int Key { get; set; }
        public float Loudness { get; set; }
        public int Mode { get; set; }
        public float Speechiness { get; set; }
        public float Acousticness { get; set; }
        public float Instrumentalness { get; set; }
        public float Liveness { get; set; }
        public float Valence { get; set; }
        public float Tempo { get; set; }
        public int Duration_ms { get; set; }
    }

}
