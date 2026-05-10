using AiAgents.MusicAgent.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace AiAgents.MusicAgent.Domain.Entities
{
    public class Track
    {
        public Guid Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] AudioData { get; set; } = Array.Empty<byte>();
        public DateTime UploadedAt { get; set; }
        public AnalysisStatus Status { get; set; }

        // ✅ NEW: Concurrency control fields

        /// <summary>
        /// When was this track claimed by a worker?
        /// Used to detect stalled processing
        /// </summary>
        public DateTime? ClaimedAt { get; set; }

        /// <summary>
        /// Which worker claimed this track?
        /// Helps with debugging and load balancing
        /// </summary>
        public string? ClaimedByWorker { get; set; }

        /// <summary>
        /// When was processing completed?
        /// </summary>
        public DateTime? CompletedAt { get; set; }

        /// <summary>
        /// OPTIMISTIC CONCURRENCY: Row version for detecting concurrent updates
        /// EF Core will automatically check this on updates
        /// If another process changed the row, update will fail with DbUpdateConcurrencyException
        /// </summary>
        [Timestamp]
        public byte[]? RowVersion { get; set; }

        // Navigation property
        public Analysis? Analysis { get; set; }
    }
}
