using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiAgents.MusicAgent.Migrations
{
    /// <inheritdoc />
    public partial class AddGenreProbabilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GenreProbabilitiesJson",
                table: "Analyses",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GenreProbabilitiesJson",
                table: "Analyses");
        }
    }
}
