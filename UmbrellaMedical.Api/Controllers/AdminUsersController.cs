using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Admin;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;
using DomainUser = UmbrellaMedical.Domain.Entities.User;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public AdminUsersController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit, IClinicClock clock)
    {
        _db = db;
        _current = current;
        _audit = audit;
        _clock = clock;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListItemDto>>> GetAll(
        [FromQuery] string? role, [FromQuery] bool? isActive, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(role)) query = query.Where(u => u.Role.Name == role);
        if (isActive is not null) query = query.Where(u => u.IsActive == isActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u => u.Email.Contains(term)
                                     || _db.Doctors.Any(d => d.UserId == u.Id && (d.FirstName.Contains(term) || d.LastName.Contains(term)))
                                     || _db.Receptionists.Any(r => r.UserId == u.Id && (r.FirstName.Contains(term) || r.LastName.Contains(term)))
                                     || _db.Patients.Any(p => p.UserId == u.Id && (p.FirstName.Contains(term) || p.LastName.Contains(term))));
        }

        var total = await query.CountAsync();

        var page_ = query.OrderBy(u => u.Role.Name).ThenBy(u => u.Email).Skip((page - 1) * pageSize).Take(pageSize);
        var items = await Project(page_).ToListAsync();

        return Ok(new PagedResult<UserListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, UserStatusRequest request)
    {
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();

        if (user.Id == _current.UserId)
            return Problem(
                detail: "You cannot change the status of your own account.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Not allowed");

        if (request.IsActive != user.IsActive)
        {
            if (!request.IsActive)
            {
                if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
                {
                    ModelState.AddModelError(nameof(request.Reason), "A reason is required when deactivating an account.");
                    return ValidationProblem(ModelState);
                }

                if (user.Role.Name == "Admin"
                    && !await _db.Users.AnyAsync(u => u.Id != id && u.IsActive && u.Role.Name == "Admin"))
                {
                    return Problem(
                        detail: "At least one active administrator must remain.",
                        statusCode: StatusCodes.Status409Conflict,
                        title: "Last administrator");
                }
            }

            user.IsActive = request.IsActive;
            await _db.SaveChangesAsync();
            await _audit.LogAsync(
                request.IsActive ? "ActivatedUser" : "DeactivatedUser",
                "User", id,
                request.IsActive ? null : request.Reason!.Trim());
        }

        var now = _clock.Now;
        var future = 0;

        if (user.Role.Name == "Doctor")
        {
            var doctorId = await _db.Doctors.Where(d => d.UserId == id).Select(d => (int?)d.Id).FirstOrDefaultAsync();
            if (doctorId is not null)
                future = await _db.Appointments.CountAsync(a => a.DoctorId == doctorId
                                                                && a.Status == AppointmentStatus.Scheduled
                                                                && a.StartDateTime > now);
        }
        else if (user.Role.Name == "Patient")
        {
            var patientId = await _db.Patients.Where(p => p.UserId == id).Select(p => (int?)p.Id).FirstOrDefaultAsync();
            if (patientId is not null)
                future = await _db.Appointments.CountAsync(a => a.PatientId == patientId
                                                                && a.Status == AppointmentStatus.Scheduled
                                                                && a.StartDateTime > now);
        }

        var item = await Project(_db.Users.AsNoTracking().Where(u => u.Id == id)).FirstAsync();

        return Ok(new { user = item, futureAppointments = future });
    }

    private IQueryable<UserListItemDto> Project(IQueryable<DomainUser> query) =>
        query.Select(u => new UserListItemDto
        {
            Id = u.Id,
            Email = u.Email,
            Role = u.Role.Name,
            IsActive = u.IsActive,
            EmailConfirmed = u.EmailConfirmed,
            CreatedAt = u.CreatedAt,
            FullName = _db.Doctors.Where(d => d.UserId == u.Id).Select(d => d.FirstName + " " + d.LastName).FirstOrDefault()
                       ?? _db.Receptionists.Where(r => r.UserId == u.Id).Select(r => r.FirstName + " " + r.LastName).FirstOrDefault()
                       ?? _db.Patients.Where(p => p.UserId == u.Id).Select(p => p.FirstName + " " + p.LastName).FirstOrDefault()
        });
}