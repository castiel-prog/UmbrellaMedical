using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Account;
using UmbrellaMedical.Api.DTOs.Doctors;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

/// <summary>Profile pictures for every user, and the doctor's own public profile.</summary>
[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private const long MaxPhotoBytes = 2 * 1024 * 1024;
    private static readonly string[] StaffRoles = { "Admin", "Receptionist", "Doctor" };

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly IAuditService _audit;

    public ProfileController(UmbrellaDbContext db, ICurrentUser current, IFileStorage storage, IAuditService audit)
    {
        _db = db;
        _current = current;
        _storage = storage;
        _audit = audit;
    }

    [HttpPost("photo")]
    [RequestSizeLimit(MaxPhotoBytes + 64 * 1024)]
    public async Task<ActionResult<AccountInfoDto>> UploadPhoto(IFormFile? file, CancellationToken cancellationToken)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        if (file is null || file.Length == 0) return Invalid("file", "Choose a picture.");
        if (file.Length > MaxPhotoBytes) return Invalid("file", "The picture must be 2 MB or smaller.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension is not (".png" or ".jpg" or ".jpeg"))
            return Invalid("file", "Use a PNG or JPG picture.");
        if (!await SignatureMatchesAsync(file, extension, cancellationToken))
            return Invalid("file", "The file is not a valid PNG or JPG picture.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);
        if (user is null) return Unauthorized();

        string key;
        await using (var stream = file.OpenReadStream())
            key = await _storage.SaveAsync(stream, extension == ".jpeg" ? ".jpg" : extension, cancellationToken);

        var oldKey = user.PhotoKey;
        user.PhotoKey = key;
        await SyncDoctorPhotoAsync(user.Id, key);
        await _db.SaveChangesAsync(cancellationToken);

        if (oldKey is not null) await _storage.DeleteAsync(oldKey);
        await _audit.LogAsync("UpdatedProfilePhoto", nameof(User), user.Id);

        return Ok(await LoadInfoAsync(user.Id));
    }

    [HttpDelete("photo")]
    public async Task<ActionResult<AccountInfoDto>> DeletePhoto()
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        var oldKey = user.PhotoKey;
        user.PhotoKey = null;
        await SyncDoctorPhotoAsync(user.Id, null);
        await _db.SaveChangesAsync();

        if (oldKey is not null) await _storage.DeleteAsync(oldKey);
        return Ok(await LoadInfoAsync(user.Id));
    }

    /// <summary>
    /// Serves a profile picture. Doctors' pictures are public (they appear on the doctor pages);
    /// everyone else's are visible only to that user and to staff.
    /// </summary>
    [HttpGet("~/api/photos/{userId:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPhoto(int userId)
    {
        var user = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.IsActive)
            .Select(u => new { u.PhotoKey, Role = u.Role.Name })
            .FirstOrDefaultAsync();

        if (user?.PhotoKey is null) return NotFound();

        var isPublic = user.Role == "Doctor";
        if (!isPublic)
        {
            var viewer = _current.UserId;
            var allowed = viewer == userId || (_current.Role is not null && StaffRoles.Contains(_current.Role));
            if (!allowed) return NotFound();
        }

        var stream = await _storage.OpenReadAsync(user.PhotoKey);
        if (stream is null) return NotFound();

        Response.Headers.CacheControl = isPublic ? "public, max-age=300" : "private, no-store";
        var contentType = user.PhotoKey.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ? "image/png" : "image/jpeg";
        return File(stream, contentType);
    }

    [HttpPut("doctor")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> UpdateDoctorProfile(UpdateDoctorProfileRequest request)
    {
        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return NotFound();

        if (request.Educations.Any(e => e.StartYear > e.GraduationYear))
            return Invalid(nameof(request.Educations), "Each education must start before it ends.");
        if (request.Experiences.Any(x => x.EndDate is not null && x.EndDate < x.StartDate))
            return Invalid(nameof(request.Experiences), "Each job must start before it ends.");

        var doctor = await _db.Doctors
            .Include(d => d.Educations)
            .Include(d => d.Experiences)
            .FirstAsync(d => d.Id == doctorId.Value);

        doctor.Bio = Clean(request.Bio);
        doctor.Phone = Clean(request.Phone);
        doctor.YearsOfExperience = request.YearsOfExperience;

        _db.RemoveRange(doctor.Educations);
        _db.RemoveRange(doctor.Experiences);

        foreach (var e in request.Educations)
            doctor.Educations.Add(new DoctorEducation
            {
                Institution = e.Institution.Trim(),
                Degree = e.Degree.Trim(),
                StartYear = e.StartYear,
                GraduationYear = e.GraduationYear
            });

        foreach (var x in request.Experiences)
            doctor.Experiences.Add(new DoctorExperience
            {
                Workplace = x.Workplace.Trim(),
                Position = x.Position.Trim(),
                StartDate = x.StartDate,
                EndDate = x.EndDate,
                Description = Clean(x.Description)
            });

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedDoctorProfile", nameof(Doctor), doctor.Id);

        return NoContent();
    }

    // Doctors keep a public PhotoUrl so the doctor list and profile can show their picture.
    private async Task SyncDoctorPhotoAsync(int userId, string? key)
    {
        var doctor = await _db.Doctors.FirstOrDefaultAsync(d => d.UserId == userId);
        if (doctor is not null)
            doctor.PhotoUrl = key is null ? null : $"/api/photos/{userId}?v={DateTime.UtcNow.Ticks}";
    }

    private Task<AccountInfoDto?> LoadInfoAsync(int userId) =>
        _db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new AccountInfoDto
            {
                Email = u.Email,
                EmailConfirmed = u.EmailConfirmed,
                Role = u.Role.Name,
                PhotoUrl = u.PhotoKey == null ? null : "/api/photos/" + u.Id,
                DisplayName =
                    _db.Doctors.Where(d => d.UserId == u.Id).Select(d => "Dr. " + d.FirstName + " " + d.LastName).FirstOrDefault()
                    ?? _db.Patients.Where(p => p.UserId == u.Id).Select(p => p.FirstName + " " + p.LastName).FirstOrDefault()
                    ?? _db.Receptionists.Where(r => r.UserId == u.Id).Select(r => r.FirstName + " " + r.LastName).FirstOrDefault()
            })
            .FirstOrDefaultAsync();

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private static async Task<bool> SignatureMatchesAsync(IFormFile file, string extension, CancellationToken cancellationToken)
    {
        var header = new byte[8];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header.AsMemory(), header.Length, false, cancellationToken);

        return extension switch
        {
            ".png" => read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
                      && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A,
            ".jpg" or ".jpeg" => read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            _ => false
        };
    }
}
