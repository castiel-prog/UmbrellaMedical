using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Admin;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/departments")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IAuditService _audit;

    public DepartmentsController(UmbrellaDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist,Doctor")]
    public async Task<ActionResult<List<DepartmentDto>>> GetAll()
    {
        var items = await _db.Departments.AsNoTracking()
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentDto
            {
                Id = d.Id,
                Name = d.Name,
                Description = d.Description,
                RoomCount = d.Rooms.Count,
                ServiceCount = d.Services.Count
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<DepartmentDto>> Create(UpsertDepartmentRequest request)
    {
        var name = request.Name.Trim();

        if (await _db.Departments.AnyAsync(d => d.Name == name))
            return Duplicate();

        var department = new Department
        {
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim()
        };

        _db.Departments.Add(department);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedDepartment", nameof(Department), department.Id);

        return StatusCode(StatusCodes.Status201Created, ToDto(department, 0, 0));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<DepartmentDto>> Update(int id, UpsertDepartmentRequest request)
    {
        var department = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (department is null) return NotFound();

        var name = request.Name.Trim();

        if (await _db.Departments.AnyAsync(d => d.Name == name && d.Id != id))
            return Duplicate();

        department.Name = name;
        department.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedDepartment", nameof(Department), id);

        var rooms = await _db.Rooms.CountAsync(r => r.DepartmentId == id);
        var services = await _db.Services.CountAsync(s => s.DepartmentId == id);

        return Ok(ToDto(department, rooms, services));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var department = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id);
        if (department is null) return NotFound();

        var hasChildren = await _db.Rooms.AnyAsync(r => r.DepartmentId == id)
                          || await _db.Services.AnyAsync(s => s.DepartmentId == id);

        if (hasChildren)
            return Problem(
                detail: "This department still has rooms or services. Move or remove them first.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Department in use");

        _db.Departments.Remove(department);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DeletedDepartment", nameof(Department), id, department.Name);

        return NoContent();
    }

    private static DepartmentDto ToDto(Department d, int rooms, int services) => new()
    {
        Id = d.Id,
        Name = d.Name,
        Description = d.Description,
        RoomCount = rooms,
        ServiceCount = services
    };

    private ActionResult Duplicate() =>
        Problem(
            detail: "A department with this name already exists.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Duplicate department");
}