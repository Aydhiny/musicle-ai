using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiAgents.MusicAgent.Migrations
{
    [Migration("20260330120000_AddWaveformCommentsAndComparisons")]
    public partial class AddWaveformCommentsAndComparisons : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "UserFeedbacks",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ComparisonVotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrackAId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrackBId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WinnerTrackId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VoterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComparisonVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComparisonVotes_AppUsers_VoterId",
                        column: x => x.VoterId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ComparisonVotes_Tracks_TrackAId",
                        column: x => x.TrackAId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComparisonVotes_Tracks_TrackBId",
                        column: x => x.TrackBId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComparisonVotes_Tracks_WinnerTrackId",
                        column: x => x.WinnerTrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TrackRevisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrackId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreviousTrackId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrackRevisions_Tracks_PreviousTrackId",
                        column: x => x.PreviousTrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrackRevisions_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WaveformComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TrackId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TimeSeconds = table.Column<double>(type: "float", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(800)", maxLength: 800, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WaveformComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WaveformComments_AppUsers_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WaveformComments_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedbacks_UserId",
                table: "UserFeedbacks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ComparisonVotes_TrackAId",
                table: "ComparisonVotes",
                column: "TrackAId");

            migrationBuilder.CreateIndex(
                name: "IX_ComparisonVotes_TrackBId",
                table: "ComparisonVotes",
                column: "TrackBId");

            migrationBuilder.CreateIndex(
                name: "IX_ComparisonVotes_VoterId_TrackAId_TrackBId",
                table: "ComparisonVotes",
                columns: new[] { "VoterId", "TrackAId", "TrackBId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ComparisonVotes_WinnerTrackId",
                table: "ComparisonVotes",
                column: "WinnerTrackId");

            migrationBuilder.CreateIndex(
                name: "IX_TrackRevisions_PreviousTrackId",
                table: "TrackRevisions",
                column: "PreviousTrackId");

            migrationBuilder.CreateIndex(
                name: "IX_TrackRevisions_TrackId",
                table: "TrackRevisions",
                column: "TrackId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WaveformComments_AuthorId",
                table: "WaveformComments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_WaveformComments_CreatedAt",
                table: "WaveformComments",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_WaveformComments_TrackId",
                table: "WaveformComments",
                column: "TrackId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserFeedbacks_AppUsers_UserId",
                table: "UserFeedbacks",
                column: "UserId",
                principalTable: "AppUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserFeedbacks_AppUsers_UserId",
                table: "UserFeedbacks");

            migrationBuilder.DropTable(
                name: "ComparisonVotes");

            migrationBuilder.DropTable(
                name: "TrackRevisions");

            migrationBuilder.DropTable(
                name: "WaveformComments");

            migrationBuilder.DropIndex(
                name: "IX_UserFeedbacks_UserId",
                table: "UserFeedbacks");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "UserFeedbacks");
        }
    }
}
