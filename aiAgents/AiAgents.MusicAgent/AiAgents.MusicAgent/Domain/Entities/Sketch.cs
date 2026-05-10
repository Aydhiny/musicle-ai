namespace AiAgents.MusicAgent.Domain.Entities
{
    public class Sketch
    {
        public Guid Id { get; set; }
        public Guid AuthorId { get; set; }
        public AppUser Author { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = "hum";
        public double DurationSeconds { get; set; }
        public int? Bpm { get; set; }
        public string? Key { get; set; }
        public string? Scale { get; set; }

        public string WaveformJson { get; set; } = "[]";
        public string TagsJson { get; set; } = "[]";
        public string Hue { get; set; } = "purple";
        public bool IsAi { get; set; }
        public bool IsFavorite { get; set; }
        public bool IsPublic { get; set; }

        public byte[] AudioData { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = "audio/webm";
        public string FileName { get; set; } = string.Empty;
        public long FileSize { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}