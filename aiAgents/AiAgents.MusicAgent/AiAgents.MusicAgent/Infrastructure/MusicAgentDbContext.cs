using AiAgents.MusicAgent.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiAgents.MusicAgent.Infrastructure
{
    public class MusicAgentDbContext : DbContext
    {
        public MusicAgentDbContext(DbContextOptions<MusicAgentDbContext> options)
            : base(options)
        {
        }

        public DbSet<Track> Tracks { get; set; } = null!;
        public DbSet<Analysis> Analyses { get; set; } = null!;
        public DbSet<ModelVersion> ModelVersions { get; set; } = null!;
        public DbSet<UserFeedback> UserFeedbacks { get; set; } = null!;
        public DbSet<AppUser> AppUsers { get; set; } = null!;
        public DbSet<HighlightPost> HighlightPosts { get; set; } = null!;
        public DbSet<PostComment> PostComments { get; set; } = null!;
        public DbSet<PostLike> PostLikes { get; set; } = null!;
        public DbSet<PostReaction> PostReactions { get; set; } = null!;
        public DbSet<CommentLike> CommentLikes { get; set; } = null!;
        public DbSet<Sketch> Sketches { get; set; } = null!;
        public DbSet<WaveformComment> WaveformComments { get; set; } = null!;
        public DbSet<ComparisonVote> ComparisonVotes { get; set; } = null!;
        public DbSet<TrackRevision> TrackRevisions { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<AppUser>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(40);
                entity.Property(e => e.NormalizedUserName).IsRequired().HasMaxLength(40);
                entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
                entity.Property(e => e.NormalizedEmail).IsRequired().HasMaxLength(255);
                entity.Property(e => e.PasswordHash).IsRequired();
                entity.Property(e => e.PasswordSalt).IsRequired();
                entity.Property(e => e.Bio).HasMaxLength(500);
                entity.Property(e => e.SettingsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.IsActive).HasDefaultValue(true);

                entity.HasIndex(e => e.NormalizedUserName).IsUnique();
                entity.HasIndex(e => e.NormalizedEmail).IsUnique();
                entity.HasIndex(e => e.CreatedAt);
            });

            modelBuilder.Entity<HighlightPost>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Title).HasMaxLength(120);
                entity.Property(e => e.Content).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.ContentFormat).HasMaxLength(20);
                entity.Property(e => e.MediaJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.IsDeleted).HasDefaultValue(false);

                entity.HasOne(e => e.Author)
                    .WithMany(u => u.Posts)
                    .HasForeignKey(e => e.AuthorId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Analysis)
                    .WithMany()
                    .HasForeignKey(e => e.AnalysisId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(e => e.AnalysisId);
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => new { e.IsDeleted, e.CreatedAt });
            });

            modelBuilder.Entity<PostComment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Content).IsRequired().HasMaxLength(1000);
                entity.Property(e => e.IsDeleted).HasDefaultValue(false);

                entity.HasOne(e => e.Post)
                    .WithMany(p => p.Comments)
                    .HasForeignKey(e => e.PostId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Author)
                    .WithMany(u => u.Comments)
                    .HasForeignKey(e => e.AuthorId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.ParentComment)
                    .WithMany(c => c.Replies)
                    .HasForeignKey(e => e.ParentCommentId)
                    .OnDelete(DeleteBehavior.NoAction);

                entity.HasIndex(e => e.PostId);
                entity.HasIndex(e => new { e.PostId, e.CreatedAt });
                entity.HasIndex(e => e.ParentCommentId);
            });

            modelBuilder.Entity<PostLike>(entity =>
            {
                entity.HasKey(e => new { e.PostId, e.UserId });

                entity.HasOne(e => e.Post)
                    .WithMany(p => p.Likes)
                    .HasForeignKey(e => e.PostId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany(u => u.PostLikes)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.UserId);
            });

            modelBuilder.Entity<PostReaction>(entity =>
            {
                entity.HasKey(e => new { e.PostId, e.UserId });

                entity.Property(e => e.Reaction).IsRequired().HasMaxLength(20);

                entity.HasOne(e => e.Post)
                    .WithMany(p => p.Reactions)
                    .HasForeignKey(e => e.PostId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany(u => u.PostReactions)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.Reaction);
            });

            modelBuilder.Entity<CommentLike>(entity =>
            {
                entity.HasKey(e => new { e.CommentId, e.UserId });

                entity.HasOne(e => e.Comment)
                    .WithMany(c => c.Likes)
                    .HasForeignKey(e => e.CommentId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany(u => u.CommentLikes)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.UserId);
            });

            modelBuilder.Entity<WaveformComment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Content).IsRequired().HasMaxLength(800);
                entity.HasIndex(e => e.TrackId);
                entity.HasIndex(e => e.CreatedAt);

                entity.HasOne(e => e.Track)
                    .WithMany()
                    .HasForeignKey(e => e.TrackId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Author)
                    .WithMany()
                    .HasForeignKey(e => e.AuthorId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ComparisonVote>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.VoterId, e.TrackAId, e.TrackBId }).IsUnique();
                entity.HasIndex(e => e.TrackAId);
                entity.HasIndex(e => e.TrackBId);

                entity.HasOne(e => e.TrackA)
                    .WithMany()
                    .HasForeignKey(e => e.TrackAId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.TrackB)
                    .WithMany()
                    .HasForeignKey(e => e.TrackBId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Voter)
                    .WithMany()
                    .HasForeignKey(e => e.VoterId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.WinnerTrack)
                    .WithMany()
                    .HasForeignKey(e => e.WinnerTrackId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<TrackRevision>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Note).HasMaxLength(400);
                entity.HasIndex(e => e.TrackId).IsUnique();
                entity.HasIndex(e => e.PreviousTrackId);

                entity.HasOne(e => e.Track)
                    .WithMany()
                    .HasForeignKey(e => e.TrackId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.PreviousTrack)
                    .WithMany()
                    .HasForeignKey(e => e.PreviousTrackId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Track>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.FileName).IsRequired().HasMaxLength(500);
                entity.Property(e => e.Status).IsRequired();
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.UploadedAt);
            });

            modelBuilder.Entity<Analysis>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Genre).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Subgenre).HasMaxLength(100);

                entity.Property(e => e.CharacteristicsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.StrengthsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.ImprovementsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.GenreProbabilitiesJson).HasColumnType("nvarchar(max)");

                entity.Ignore(e => e.Strengths);
                entity.Ignore(e => e.Improvements);

                entity.HasOne(a => a.Track)
                    .WithOne(t => t.Analysis)
                    .HasForeignKey<Analysis>(a => a.TrackId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ModelVersion>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ModelName).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Version).IsRequired().HasMaxLength(50);
                entity.HasIndex(e => new { e.IsActive });
            });
            modelBuilder.Entity<Sketch>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Type).IsRequired().HasMaxLength(20);
                entity.Property(e => e.Key).HasMaxLength(20);
                entity.Property(e => e.Scale).HasMaxLength(20);
                entity.Property(e => e.Hue).HasMaxLength(20);
                entity.Property(e => e.ContentType).HasMaxLength(100);
                entity.Property(e => e.FileName).HasMaxLength(255);

                entity.Property(e => e.TagsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.WaveformJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.AudioData).HasColumnType("varbinary(max)");

                entity.HasOne(e => e.Author)
                    .WithMany(u => u.Sketches)
                    .HasForeignKey(e => e.AuthorId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.AuthorId);
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.IsPublic);
            });

            modelBuilder.Entity<UserFeedback>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.CorrectedGenre).HasMaxLength(100);
                entity.Property(e => e.CorrectedSubgenre).HasMaxLength(100);
                entity.Property(e => e.Notes).HasMaxLength(2000);
                entity.Property(e => e.FirstUsedInModelVersion).HasMaxLength(50);
                entity.HasIndex(e => e.UserId);

                entity.HasOne(f => f.Analysis)
                    .WithMany()
                    .HasForeignKey(f => f.AnalysisId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(f => f.User)
                    .WithMany()
                    .HasForeignKey(f => f.UserId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(e => e.AnalysisId);
                entity.HasIndex(e => e.UsedInTraining);
                entity.HasIndex(e => e.SubmittedAt);
            });
        }
    }
}
