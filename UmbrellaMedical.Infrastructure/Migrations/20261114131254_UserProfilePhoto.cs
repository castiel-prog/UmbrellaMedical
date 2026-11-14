using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UmbrellaMedical.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UserProfilePhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhotoKey",
                table: "Users",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoKey",
                table: "Users");
        }
    }
}
