using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UmbrellaMedical.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PharmacyDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeliveryAddress",
                table: "StoreOrders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryCity",
                table: "StoreOrders",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DeliveryFee",
                table: "StoreOrders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryNotes",
                table: "StoreOrders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryPhone",
                table: "StoreOrders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DispatchedAt",
                table: "StoreOrders",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Fulfilment",
                table: "StoreOrders",
                type: "integer",
                nullable: false,
                defaultValue: 1); // existing orders were all collected at the clinic (Pickup)
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryAddress",
                table: "StoreOrders");

            migrationBuilder.DropColumn(
                name: "DeliveryCity",
                table: "StoreOrders");

            migrationBuilder.DropColumn(
                name: "DeliveryFee",
                table: "StoreOrders");

            migrationBuilder.DropColumn(
                name: "DeliveryNotes",
                table: "StoreOrders");

            migrationBuilder.DropColumn(
                name: "DeliveryPhone",
                table: "StoreOrders");

            migrationBuilder.DropColumn(
                name: "DispatchedAt",
                table: "StoreOrders");

            migrationBuilder.DropColumn(
                name: "Fulfilment",
                table: "StoreOrders");
        }
    }
}
