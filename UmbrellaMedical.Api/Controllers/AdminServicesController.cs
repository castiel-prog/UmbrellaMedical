using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Admin;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/admin/services")]
[Authorize]
public class AdminServicesController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IAuditService _audit;

    public AdminServicesController(UmbrellaDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<List<AdminServiceDto>>> GetAll(
        [FromQuery] int? departmentId, [FromQuery] bool? isActive, [FromQuery] string? search)
    {
        var query = _db.Services.AsNoTracking().AsQueryable();

        if (departmentId is not null) query = query.Where(s => s.DepartmentId == departmentId);
        if (isActive is not null) query = query.Where(s => s.IsActive == isActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(term));
        }

        var items = await query
            .OrderBy(s => s.Department.Name).ThenBy(s => s.Name)
            .Select(s => new AdminServiceDto
            {
                Id = s.Id,
                Name = s.Name,
                Description = s.Description,
                Price = s.Price,
                DurationMinutes = s.DurationMinutes,
                IsActive = s.IsActive,
                DepartmentId = s.DepartmentId,
                Department = s.Department.Name,
                DoctorCount = s.DoctorServices.Count
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AdminServiceDto>> Create(UpsertServiceRequest request)
    {
        var problem = await ValidateAsync(request, null);
        if (problem is not null) return problem;

        var service = new Service
        {
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Price = request.Price,
            DurationMinutes = request.DurationMinutes,
            DepartmentId = request.DepartmentId,
            IsActive = request.IsActive
        };

        _db.Services.Add(service);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedService", nameof(Service), service.Id);

        return StatusCode(StatusCodes.Status201Created, await LoadAsync(service.Id));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AdminServiceDto>> Update(int id, UpsertServiceRequest request)
    {
        var service = await _db.Services.FirstOrDefaultAsync(s => s.Id == id);
        if (service is null) return NotFound();

        var problem = await ValidateAsync(request, id);
        if (problem is not null) return problem;

        var oldPrice = service.Price;

        service.Name = request.Name.Trim();
        service.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        service.Price = request.Price;
        service.DurationMinutes = request.DurationMinutes;
        service.DepartmentId = request.DepartmentId;
        service.IsActive = request.IsActive;

        await _db.SaveChangesAsync();

        var details = oldPrice == request.Price
            ? null
            : $"Price {oldPrice.ToString("0.00", CultureInfo.InvariantCulture)} -> {request.Price.ToString("0.00", CultureInfo.InvariantCulture)}";

        await _audit.LogAsync("UpdatedService", nameof(Service), id, details);

        return Ok(await LoadAsync(id));
    }

    private async Task<ActionResult?> ValidateAsync(UpsertServiceRequest request, int? excludeId)
    {
        if (decimal.Round(request.Price, 2) != request.Price)
            return Invalid(nameof(request.Price), "The price can have at most two decimal places.");

        if (request.DurationMinutes % 5 != 0)
            return Invalid(nameof(request.DurationMinutes), "The duration must be a multiple of 5 minutes.");

        if (!await _db.Departments.AnyAsync(d => d.Id == request.DepartmentId))
            return Invalid(nameof(request.DepartmentId), "This department does not exist.");

        var name = request.Name.Trim();

        if (await _db.Services.AnyAsync(s => s.DepartmentId == request.DepartmentId && s.Name == name && s.Id != excludeId))
            return Problem(
                detail: "This department already has a service with this name.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Duplicate service");

        return null;
    }

    private Task<AdminServiceDto?> LoadAsync(int id) =>
        _db.Services.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new AdminServiceDto
            {
                Id = s.Id,
                Name = s.Name,
                Description = s.Description,
                Price = s.Price,
                DurationMinutes = s.DurationMinutes,
                IsActive = s.IsActive,
                DepartmentId = s.DepartmentId,
                Department = s.Department.Name,
                DoctorCount = s.DoctorServices.Count
            })
            .FirstOrDefaultAsync();

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }
}