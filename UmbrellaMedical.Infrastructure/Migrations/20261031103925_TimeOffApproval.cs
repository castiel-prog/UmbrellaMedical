using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UmbrellaMedical.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TimeOffApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeclineReason",
                table: "TimeOffs",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "TimeOffs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewedByUserId",
                table: "TimeOffs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "TimeOffs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "TimeOffs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_TimeOffs_ReviewedByUserId",
                table: "TimeOffs",
                column: "ReviewedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_TimeOffs_Users_ReviewedByUserId",
                table: "TimeOffs",
                column: "ReviewedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TimeOffs_Users_ReviewedByUserId",
                table: "TimeOffs");

            migrationBuilder.DropIndex(
                name: "IX_TimeOffs_ReviewedByUserId",
                table: "TimeOffs");

            migrationBuilder.DropColumn(
                name: "DeclineReason",
                table: "TimeOffs");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "TimeOffs");

            migrationBuilder.DropColumn(
                name: "ReviewedByUserId",
                table: "TimeOffs");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "TimeOffs");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "TimeOffs");
        }
    }
}
