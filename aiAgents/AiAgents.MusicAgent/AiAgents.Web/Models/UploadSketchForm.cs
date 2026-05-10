using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AiAgents.Web.Models
{
    public sealed class UploadSketchForm
    {
        [Required]
        public IFormFile File { get; set; } = null!;

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
}

