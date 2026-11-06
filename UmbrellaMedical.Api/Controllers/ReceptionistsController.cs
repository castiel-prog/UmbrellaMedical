using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Staff;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;
using DomainUser = UmbrellaMedical.Domain.Entities.User;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/receptionists")]
[Authorize(Roles = "Admin")]
public class ReceptionistsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IAuditService _audit;

    public ReceptionistsController(UmbrellaDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<List<ReceptionistDto>>> GetAll()
    {
        var items = await _db.Receptionists.AsNoTracking()
            .OrderBy(r => r.LastName).ThenBy(r => r.FirstName)
            .Select(r => new ReceptionistDto
            {
                Id = r.Id,
                FirstName = r.FirstName,
                LastName = r.LastName,
                Email = r.User.Email,
                Phone = r.Phone,
                IsActive = r.User.IsActive
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ReceptionistDto>> GetById(int id)
    {
        var item = await LoadDtoAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<ReceptionistDto>> Create(CreateReceptionistRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Problem(
                detail: "This email is already registered.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Duplicate email");

        var role = await _db.Roles.FirstAsync(r => r.Name == "Receptionist");

        var user = new DomainUser
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = role.Id
        };

        var receptionist = new Receptionist
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone,
            User = user
        };

        _db.Receptionists.Add(receptionist);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedReceptionist", nameof(Receptionist), receptionist.Id);

        return CreatedAtAction(nameof(GetById), new { id = receptionist.Id }, await LoadDtoAsync(receptionist.Id));
    }

    private Task<ReceptionistDto?> LoadDtoAsync(int id) =>
        _db.Receptionists.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new ReceptionistDto
            {
                Id = r.Id,
                FirstName = r.FirstName,
                LastName = r.LastName,
                Email = r.User.Email,
                Phone = r.Phone,
                IsActive = r.User.IsActive
            })
            .FirstOrDefaultAsync();
}