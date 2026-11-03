using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.DTOs.Doctors;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;



[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly UmbrellaDbContext _db;

    public ServicesController(UmbrellaDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<ServiceDto>>> GetAll([FromQuery] int? departmentId)
    {
        var query = _db.Services.AsNoTracking().Where(s => s.IsActive);
        if (departmentId is not null) query = query.Where(s => s.DepartmentId == departmentId);

        var items = await query
            .OrderBy(s => s.Department.Name).ThenBy(s => s.Name)
            .Select(s => new ServiceDto
            {
                Id = s.Id,
                Name = s.Name,
                Description = s.Description,
                Price = s.Price,
                DurationMinutes = s.DurationMinutes,
                DepartmentId = s.DepartmentId,
                Department = s.Department.Name
            })
            .ToListAsync();

        return Ok(items);
    }
}

[ApiController]
[Route("api/doctors/{doctorId:int}/services")]
[Authorize(Roles = "Admin")]
public class DoctorServicesController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IAuditService _audit;

    public DoctorServicesController(UmbrellaDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

   
    [HttpPut]
    public async Task<ActionResult<List<DoctorServiceDto>>> Replace(int doctorId, AssignServicesRequest request)
    {
        if (!await _db.Doctors.AnyAsync(d => d.Id == doctorId)) return NotFound();

        var wanted = request.ServiceIds.Distinct().ToList();

        var services = await _db.Services
            .Where(s => wanted.Contains(s.Id) && s.IsActive)
            .ToListAsync();

        if (services.Count != wanted.Count)
        {
            ModelState.AddModelError(nameof(request.ServiceIds), "One or more services do not exist or are not active.");
            return ValidationProblem(ModelState);
        }

        var existing = await _db.DoctorServices.Where(ds => ds.DoctorId == doctorId).ToListAsync();

        
        _db.DoctorServices.RemoveRange(existing.Where(ds => !wanted.Contains(ds.ServiceId)));

        var existingIds = existing.Select(ds => ds.ServiceId).ToHashSet();
        _db.DoctorServices.AddRange(
            wanted.Where(id => !existingIds.Contains(id))
                  .Select(id => new DoctorService { DoctorId = doctorId, ServiceId = id }));

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedDoctorServices", nameof(Doctor), doctorId);

        var result = services
            .OrderBy(s => s.Name)
            .Select(s => new DoctorServiceDto
            {
                ServiceId = s.Id,
                Name = s.Name,
                Price = s.Price,
                DurationMinutes = s.DurationMinutes
            })
            .ToList();

        return Ok(result);
    }
}