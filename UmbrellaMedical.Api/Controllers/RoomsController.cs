using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Admin;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/rooms")]
[Authorize]
public class RoomsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IAuditService _audit;

    public RoomsController(UmbrellaDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist,Doctor")]
    public async Task<ActionResult<List<RoomDto>>> GetAll(
        [FromQuery] int? departmentId, [FromQuery] RoomType? type, [FromQuery] bool? isActive)
    {
        var query = _db.Rooms.AsNoTracking().AsQueryable();

        if (departmentId is not null) query = query.Where(r => r.DepartmentId == departmentId);
        if (type is not null) query = query.Where(r => r.Type == type);
        if (isActive is not null) query = query.Where(r => r.IsActive == isActive);

        var items = await query
            .OrderBy(r => r.Department.Name).ThenBy(r => r.Floor).ThenBy(r => r.Number)
            .Select(r => new RoomDto
            {
                Id = r.Id,
                Number = r.Number,
                Floor = r.Floor,
                Type = r.Type,
                IsActive = r.IsActive,
                DepartmentId = r.DepartmentId,
                Department = r.Department.Name
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<RoomDto>> Create(UpsertRoomRequest request)
    {
        if (!await _db.Departments.AnyAsync(d => d.Id == request.DepartmentId))
            return Invalid(nameof(request.DepartmentId), "This department does not exist.");

        var number = request.Number.Trim();

        if (await _db.Rooms.AnyAsync(r => r.DepartmentId == request.DepartmentId && r.Number == number))
            return Duplicate();

        var room = new Room
        {
            Number = number,
            Floor = request.Floor,
            Type = request.Type,
            IsActive = request.IsActive,
            DepartmentId = request.DepartmentId
        };

        _db.Rooms.Add(room);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedRoom", nameof(Room), room.Id);

        return StatusCode(StatusCodes.Status201Created, await LoadAsync(room.Id));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<RoomDto>> Update(int id, UpsertRoomRequest request)
    {
        var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == id);
        if (room is null) return NotFound();

        if (!await _db.Departments.AnyAsync(d => d.Id == request.DepartmentId))
            return Invalid(nameof(request.DepartmentId), "This department does not exist.");

        var number = request.Number.Trim();

        if (await _db.Rooms.AnyAsync(r => r.DepartmentId == request.DepartmentId && r.Number == number && r.Id != id))
            return Duplicate();

        room.Number = number;
        room.Floor = request.Floor;
        room.Type = request.Type;
        room.IsActive = request.IsActive;
        room.DepartmentId = request.DepartmentId;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedRoom", nameof(Room), id);

        return Ok(await LoadAsync(id));
    }

    private Task<RoomDto?> LoadAsync(int id) =>
        _db.Rooms.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new RoomDto
            {
                Id = r.Id,
                Number = r.Number,
                Floor = r.Floor,
                Type = r.Type,
                IsActive = r.IsActive,
                DepartmentId = r.DepartmentId,
                Department = r.Department.Name
            })
            .FirstOrDefaultAsync();

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private ActionResult Duplicate() =>
        Problem(
            detail: "This department already has a room with this number.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Duplicate room");
}