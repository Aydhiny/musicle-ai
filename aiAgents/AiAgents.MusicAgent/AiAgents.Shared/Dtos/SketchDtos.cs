using System.ComponentModel.DataAnnotations;

namespace AiAgents.Shared.Dtos
{
    public sealed class CreateSketchRequestDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string Type { get; set; } = "hum";

        [Range(0, 3600)]
        public double DurationSeconds { get; set; }

        public int? Bpm { get; set; }

        [StringLength(20)]
        public string? Key { get; set; }

        [StringLength(20)]
        public string? Scale { get; set; }

        public IReadOnlyList<string> Tags { get; set; } = Array.Empty<string>();
        public IReadOnlyList<int> Waveform { get; set; } = Array.Empty<int>();

        public string? TagsJson { get; set; }
        public string? WaveformJson { get; set; }

        [StringLength(20)]
        public string Hue { get; set; } = "purple";

        public bool IsAi { get; set; }
        public bool IsFavorite { get; set; }
        public bool IsPublic { get; set; } = true;
    }

    public sealed class SketchAuthorDto
    {
        public Guid Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? Bio { get; set; }
    }

    public sealed class SketchViewDto
    {
        public Guid Id { get; set; }
        public SketchAuthorDto Author { get; set; } = new();
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = "hum";
        public double DurationSeconds { get; set; }
        public int? Bpm { get; set; }
        public string? Key { get; set; }
        public string? Scale { get; set; }
        public IReadOnlyList<string> Tags { get; set; } = Array.Empty<string>();
        public IReadOnlyList<int> Waveform { get; set; } = Array.Empty<int>();
        public string Hue { get; set; } = "purple";
        public bool IsAi { get; set; }
        public bool IsFavorite { get; set; }
        public bool IsPublic { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? AudioUrl { get; set; }
    }

    public sealed class SketchFeedResultDto
    {
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public IReadOnlyList<SketchViewDto> Sketches { get; set; } = Array.Empty<SketchViewDto>();
    }

    public sealed class ToggleSketchFavoriteDto
    {
        public Guid SketchId { get; set; }
        public bool IsFavorite { get; set; }
    }
}
