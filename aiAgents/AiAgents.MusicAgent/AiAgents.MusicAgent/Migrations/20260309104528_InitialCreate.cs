using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiAgents.MusicAgent.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    PasswordSalt = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Bio = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SettingsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModelName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TrainedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TracksUsedForTraining = table.Column<int>(type: "int", nullable: false),
                    Accuracy = table.Column<double>(type: "float", nullable: false),
                    MetricsJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelVersions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AudioData = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ClaimedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ClaimedByWorker = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tracks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sketches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DurationSeconds = table.Column<double>(type: "float", nullable: false),
                    Bpm = table.Column<int>(type: "int", nullable: true),
                    Key = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Scale = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    WaveformJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TagsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Hue = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsAi = table.Column<bool>(type: "bit", nullable: false),
                    IsFavorite = table.Column<bool>(type: "bit", nullable: false),
                    IsPublic = table.Column<bool>(type: "bit", nullable: false),
                    AudioData = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sketches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sketches_AppUsers_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Analyses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrackId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Genre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Subgenre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Confidence = table.Column<int>(type: "int", nullable: false),
                    CommercialScore = table.Column<int>(type: "int", nullable: false),
                    ProductionScore = table.Column<int>(type: "int", nullable: false),
                    ViralPotential = table.Column<int>(type: "int", nullable: false),
                    CharacteristicsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StrengthsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ImprovementsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SimilarTracksJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AnalyzedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Analyses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Analyses_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HighlightPosts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnalysisId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    ContentFormat = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MediaJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HighlightPosts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HighlightPosts_Analyses_AnalysisId",
                        column: x => x.AnalysisId,
                        principalTable: "Analyses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HighlightPosts_AppUsers_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserFeedbacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AnalysisId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CorrectedGenre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CorrectedSubgenre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AccuracyRating = table.Column<int>(type: "int", nullable: true),
                    CorrectedCommercialScore = table.Column<int>(type: "int", nullable: true),
                    CorrectedProductionScore = table.Column<int>(type: "int", nullable: true),
                    CorrectedViralPotential = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedInTraining = table.Column<bool>(type: "bit", nullable: false),
                    FirstUsedInModelVersion = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserFeedbacks_Analyses_AnalysisId",
                        column: x => x.AnalysisId,
                        principalTable: "Analyses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PostId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentCommentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Content = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PostComments_AppUsers_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PostComments_HighlightPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "HighlightPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostComments_PostComments_ParentCommentId",
                        column: x => x.ParentCommentId,
                        principalTable: "PostComments",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PostLikes",
                columns: table => new
                {
                    PostId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostLikes", x => new { x.PostId, x.UserId });
                    table.ForeignKey(
                        name: "FK_PostLikes_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostLikes_HighlightPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "HighlightPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostReactions",
                columns: table => new
                {
                    PostId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reaction = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostReactions", x => new { x.PostId, x.UserId });
                    table.ForeignKey(
                        name: "FK_PostReactions_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostReactions_HighlightPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "HighlightPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CommentLikes",
                columns: table => new
                {
                    CommentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommentLikes", x => new { x.CommentId, x.UserId });
                    table.ForeignKey(
                        name: "FK_CommentLikes_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CommentLikes_PostComments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "PostComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Analyses_TrackId",
                table: "Analyses",
                column: "TrackId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppUsers_CreatedAt",
                table: "AppUsers",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AppUsers_NormalizedEmail",
                table: "AppUsers",
                column: "NormalizedEmail",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppUsers_NormalizedUserName",
                table: "AppUsers",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CommentLikes_UserId",
                table: "CommentLikes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_HighlightPosts_AnalysisId",
                table: "HighlightPosts",
                column: "AnalysisId");

            migrationBuilder.CreateIndex(
                name: "IX_HighlightPosts_AuthorId",
                table: "HighlightPosts",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_HighlightPosts_CreatedAt",
                table: "HighlightPosts",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_HighlightPosts_IsDeleted_CreatedAt",
                table: "HighlightPosts",
                columns: new[] { "IsDeleted", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ModelVersions_IsActive",
                table: "ModelVersions",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_AuthorId",
                table: "PostComments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_ParentCommentId",
                table: "PostComments",
                column: "ParentCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_PostId",
                table: "PostComments",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_PostComments_PostId_CreatedAt",
                table: "PostComments",
                columns: new[] { "PostId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PostLikes_UserId",
                table: "PostLikes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PostReactions_Reaction",
                table: "PostReactions",
                column: "Reaction");

            migrationBuilder.CreateIndex(
                name: "IX_PostReactions_UserId",
                table: "PostReactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Sketches_AuthorId",
                table: "Sketches",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_Sketches_CreatedAt",
                table: "Sketches",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Sketches_IsPublic",
                table: "Sketches",
                column: "IsPublic");

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_Status",
                table: "Tracks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_UploadedAt",
                table: "Tracks",
                column: "UploadedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedbacks_AnalysisId",
                table: "UserFeedbacks",
                column: "AnalysisId");

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedbacks_SubmittedAt",
                table: "UserFeedbacks",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedbacks_UsedInTraining",
                table: "UserFeedbacks",
                column: "UsedInTraining");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CommentLikes");

            migrationBuilder.DropTable(
                name: "ModelVersions");

            migrationBuilder.DropTable(
                name: "PostLikes");

            migrationBuilder.DropTable(
                name: "PostReactions");

            migrationBuilder.DropTable(
                name: "Sketches");

            migrationBuilder.DropTable(
                name: "UserFeedbacks");

            migrationBuilder.DropTable(
                name: "PostComments");

            migrationBuilder.DropTable(
                name: "HighlightPosts");

            migrationBuilder.DropTable(
                name: "Analyses");

            migrationBuilder.DropTable(
                name: "AppUsers");

            migrationBuilder.DropTable(
                name: "Tracks");
        }
    }
}
