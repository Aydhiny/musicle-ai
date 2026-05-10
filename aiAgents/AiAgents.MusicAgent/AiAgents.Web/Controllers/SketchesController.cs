using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using AiAgents.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SketchesController : ControllerBase
    {
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<SketchesController> _logger;

        private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "hum",
            "voice",
            "sample",
            "upload"
        };

        public SketchesController(MusicAgentDbContext db, ILogger<SketchesController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [AllowAnonymous]
        [HttpGet("feed")]
        public async Task<IActionResult> Feed([FromQuery] int page = 1, [FromQuery] int pageSize = 24, CancellationToken ct = default)
        {
            page = page < 1 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 50);
            var skip = (page - 1) * pageSize;

            var query = _db.Sketches
                .AsNoTracking()
                .Where(s => s.IsPublic);

            var total = await query.CountAsync(ct);
            var rows = await ProjectToRows(query)
                .OrderByDescending(s => s.CreatedAt)
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync(ct);

            var sketches = rows.Select(r => ToViewDto(r, includeAudioUrl: true)).ToList();

            return Ok(new SketchFeedResultDto
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                Sketches = sketches
            });
        }

        [Authorize]
        [HttpGet("mine")]
        public async Task<IActionResult> Mine([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? type = null, CancellationToken ct = default)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            page = page < 1 ? 1 : page;
            pageSize = Math.Clamp(pageSize, 1, 100);
            var skip = (page - 1) * pageSize;

            var query = _db.Sketches
                .AsNoTracking()
                .Where(s => s.AuthorId == userId);

            if (!string.IsNullOrWhiteSpace(type))
            {
                query = query.Where(s => s.Type == type);
            }

            var total = await query.CountAsync(ct);
            var rows = await ProjectToRows(query)
                .OrderByDescending(s => s.CreatedAt)
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync(ct);

            var sketches = rows.Select(r => ToViewDto(r, includeAudioUrl: true)).ToList();

            return Ok(new SketchFeedResultDto
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                Sketches = sketches
            });
        }

        [Authorize]
        [HttpPost("upload")]
        [RequestSizeLimit(52428800)]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Upload([FromForm] UploadSketchForm form, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            if (form.File == null || form.File.Length == 0)
            {
                return BadRequest(new { error = "No file provided" });
            }

            if (!form.File.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { error = "Only audio files allowed" });
            }

            var type = form.Type?.Trim() ?? string.Empty;
            if (!AllowedTypes.Contains(type))
            {
                return BadRequest(new { error = "Invalid sketch type" });
            }

            var name = form.Name?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest(new { error = "Name is required" });
            }

            if (form.File.Length > 50 * 1024 * 1024)
            {
                return BadRequest(new { error = "File too large. Max 50MB." });
            }

            var tags = ResolveList(form.Tags, form.TagsJson);
            var waveform = ResolveList(form.Waveform, form.WaveformJson);

            using var ms = new MemoryStream();
            await form.File.CopyToAsync(ms, ct);

            var now = DateTime.UtcNow;
            var sketch = new Sketch
            {
                Id = Guid.NewGuid(),
                AuthorId = userId,
                Name = name,
                Type = type,
                DurationSeconds = form.DurationSeconds,
                Bpm = form.Bpm,
                Key = string.IsNullOrWhiteSpace(form.Key) ? null : form.Key.Trim(),
                Scale = string.IsNullOrWhiteSpace(form.Scale) ? null : form.Scale.Trim(),
                TagsJson = SerializeJson(tags),
                WaveformJson = SerializeJson(waveform),
                Hue = string.IsNullOrWhiteSpace(form.Hue) ? "purple" : form.Hue.Trim(),
                IsAi = form.IsAi,
                IsFavorite = form.IsFavorite,
                IsPublic = form.IsPublic,
                AudioData = ms.ToArray(),
                ContentType = form.File.ContentType,
                FileName = form.File.FileName,
                FileSize = form.File.Length,
                CreatedAt = now,
                UpdatedAt = now
            };

            _db.Sketches.Add(sketch);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("Sketch {SketchId} uploaded by {UserId}", sketch.Id, userId);

            var saved = await _db.Sketches
                .AsNoTracking()
                .Include(s => s.Author)
                .FirstAsync(s => s.Id == sketch.Id, ct);

            return Ok(ToViewDto(saved, includeAudioUrl: true));
        }

        [Authorize]
        [HttpPost("{sketchId:guid}/favorite")]
        public async Task<IActionResult> ToggleFavorite(Guid sketchId, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            var sketch = await _db.Sketches.FirstOrDefaultAsync(s => s.Id == sketchId && s.AuthorId == userId, ct);
            if (sketch == null)
            {
                return NotFound(new { error = "Sketch not found" });
            }

            sketch.IsFavorite = !sketch.IsFavorite;
            sketch.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Ok(new ToggleSketchFavoriteDto { SketchId = sketch.Id, IsFavorite = sketch.IsFavorite });
        }

        [Authorize]
        [HttpDelete("{sketchId:guid}")]
        public async Task<IActionResult> Delete(Guid sketchId, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            var sketch = await _db.Sketches.FirstOrDefaultAsync(s => s.Id == sketchId && s.AuthorId == userId, ct);
            if (sketch == null)
            {
                return NotFound(new { error = "Sketch not found" });
            }

            _db.Sketches.Remove(sketch);
            await _db.SaveChangesAsync(ct);

            return NoContent();
        }

        [AllowAnonymous]
        [HttpGet("{sketchId:guid}/audio")]
        public async Task<IActionResult> Audio(Guid sketchId, CancellationToken ct)
        {
            Guid? userId = null;
            if (User.Identity?.IsAuthenticated == true && TryGetCurrentUserId(out var parsed))
            {
                userId = parsed;
            }

            var sketch = await _db.Sketches
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == sketchId, ct);

            if (sketch == null)
            {
                return NotFound(new { error = "Sketch not found" });
            }

            if (!sketch.IsPublic)
            {
                if (userId == null)
                {
                    return Unauthorized(new { error = "Authentication required." });
                }

                if (sketch.AuthorId != userId.Value)
                {
                    return Forbid();
                }
            }

            if (sketch.AudioData.Length == 0)
            {
                return NotFound(new { error = "Audio not available" });
            }

            return File(sketch.AudioData, sketch.ContentType, sketch.FileName);
        }

        private static IQueryable<SketchRow> ProjectToRows(IQueryable<Sketch> query)
        {
            return query.Select(s => new SketchRow
            {
                Id = s.Id,
                AuthorId = s.AuthorId,
                AuthorUserName = s.Author.UserName,
                AuthorBio = s.Author.Bio,
                Name = s.Name,
                Type = s.Type,
                DurationSeconds = s.DurationSeconds,
                Bpm = s.Bpm,
                Key = s.Key,
                Scale = s.Scale,
                TagsJson = s.TagsJson,
                WaveformJson = s.WaveformJson,
                Hue = s.Hue,
                IsAi = s.IsAi,
                IsFavorite = s.IsFavorite,
                IsPublic = s.IsPublic,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            });
        }

        private static SketchViewDto ToViewDto(SketchRow row, bool includeAudioUrl)
        {
            return new SketchViewDto
            {
                Id = row.Id,
                Author = new SketchAuthorDto
                {
                    Id = row.AuthorId,
                    UserName = row.AuthorUserName ?? "unknown",
                    Bio = row.AuthorBio
                },
                Name = row.Name,
                Type = row.Type,
                DurationSeconds = row.DurationSeconds,
                Bpm = row.Bpm,
                Key = row.Key,
                Scale = row.Scale,
                Tags = DeserializeJson<string>(row.TagsJson),
                Waveform = DeserializeJson<int>(row.WaveformJson),
                Hue = row.Hue,
                IsAi = row.IsAi,
                IsFavorite = row.IsFavorite,
                IsPublic = row.IsPublic,
                CreatedAt = row.CreatedAt,
                UpdatedAt = row.UpdatedAt,
                AudioUrl = includeAudioUrl ? $"/api/sketches/{row.Id}/audio" : null
            };
        }

        private static SketchViewDto ToViewDto(Sketch sketch, bool includeAudioUrl)
        {
            return new SketchViewDto
            {
                Id = sketch.Id,
                Author = new SketchAuthorDto
                {
                    Id = sketch.AuthorId,
                    UserName = sketch.Author?.UserName ?? "unknown",
                    Bio = sketch.Author?.Bio
                },
                Name = sketch.Name,
                Type = sketch.Type,
                DurationSeconds = sketch.DurationSeconds,
                Bpm = sketch.Bpm,
                Key = sketch.Key,
                Scale = sketch.Scale,
                Tags = DeserializeJson<string>(sketch.TagsJson),
                Waveform = DeserializeJson<int>(sketch.WaveformJson),
                Hue = sketch.Hue,
                IsAi = sketch.IsAi,
                IsFavorite = sketch.IsFavorite,
                IsPublic = sketch.IsPublic,
                CreatedAt = sketch.CreatedAt,
                UpdatedAt = sketch.UpdatedAt,
                AudioUrl = includeAudioUrl ? $"/api/sketches/{sketch.Id}/audio" : null
            };
        }

        private static IReadOnlyList<T> ResolveList<T>(IReadOnlyList<T> list, string? json)
        {
            if (list != null && list.Count > 0)
            {
                return list;
            }

            if (!string.IsNullOrWhiteSpace(json))
            {
                return DeserializeJson<T>(json);
            }

            return Array.Empty<T>();
        }

        private static string SerializeJson<T>(IReadOnlyList<T> value)
        {
            return JsonSerializer.Serialize(value ?? Array.Empty<T>());
        }

        private static IReadOnlyList<T> DeserializeJson<T>(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return Array.Empty<T>();
            }

            try
            {
                var value = JsonSerializer.Deserialize<List<T>>(json);
                return value != null ? value : Array.Empty<T>();
            }
            catch
            {
                return Array.Empty<T>();
            }
        }

        private bool TryGetCurrentUserId(out Guid userId)
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(id, out userId);
        }

        private sealed class SketchRow
        {
            public Guid Id { get; init; }
            public Guid AuthorId { get; init; }
            public string? AuthorUserName { get; init; }
            public string? AuthorBio { get; init; }
            public string Name { get; init; } = string.Empty;
            public string Type { get; init; } = "hum";
            public double DurationSeconds { get; init; }
            public int? Bpm { get; init; }
            public string? Key { get; init; }
            public string? Scale { get; init; }
            public string TagsJson { get; init; } = "[]";
            public string WaveformJson { get; init; } = "[]";
            public string Hue { get; init; } = "purple";
            public bool IsAi { get; init; }
            public bool IsFavorite { get; init; }
            public bool IsPublic { get; init; }
            public DateTime CreatedAt { get; init; }
            public DateTime UpdatedAt { get; init; }
        }
    }
}





