using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.DTOs.Doctors;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using DomainUser = UmbrellaMedical.Domain.Entities.User;

namespace UmbrellaMedical.Api.Controllers
{

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DoctorsController : ControllerBase
    {
        private readonly UmbrellaDbContext _db;
        private readonly ICurrentUser _current;
        private readonly IAuditService _audit;

        public DoctorsController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit)
        {
            _db = db;
            _current = current;
            _audit = audit;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<PagedResult<DoctorListItemDto>>> GetAll(
            [FromQuery] int? specializationId, [FromQuery] string? search,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Doctors.AsNoTracking().Where(d => d.User.IsActive);

            if (specializationId is not null)
                query = query.Where(d => d.SpecializationId == specializationId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(d => d.FirstName.ToLower().Contains(term) || d.LastName.ToLower().Contains(term));
            }

            var total = await query.CountAsync();

            var items = await query
                .OrderBy(d => d.LastName).ThenBy(d => d.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new DoctorListItemDto
                {
                    Id = d.Id,
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    SpecializationId = d.SpecializationId,
                    Specialization = d.Specialization.Name,
                    PhotoUrl = d.PhotoUrl,
                    YearsOfExperience = d.YearsOfExperience,
                    AverageRating = d.AverageRating,
                    ReviewCount = d.ReviewCount
                })
                .ToListAsync();

            return Ok(new PagedResult<DoctorListItemDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total
            });
        }

        [HttpGet("me")]
        [Authorize(Roles = "Doctor")]
        public async Task<ActionResult<DoctorDetailsDto>> GetMe()
        {
            var doctorId = await _current.GetDoctorIdAsync();
            if (doctorId is null) return NotFound();

            var dto = await BuildDetailsAsync(doctorId.Value);
            if (dto is null) return NotFound();

            // The phone number is private: only the doctor sees it, for editing their profile.
            dto.Phone = await _db.Doctors.Where(d => d.Id == doctorId.Value).Select(d => d.Phone).FirstOrDefaultAsync();
            return Ok(dto);
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<DoctorDetailsDto>> GetById(int id)
        {
            var dto = await BuildDetailsAsync(id);
            return dto is null ? NotFound() : Ok(dto);
        }
 
       
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<DoctorDetailsDto>> Create(CreateDoctorRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var license = request.LicenseNumber.Trim();

            if (await _db.Users.AnyAsync(u => u.Email == email))
                return Problem(
                    detail: "This email is already registered.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Duplicate email");

            if (await _db.Doctors.AnyAsync(d => d.LicenseNumber == license))
                return Problem(
                    detail: "A doctor with this license number already exists.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Duplicate license number");

            if (!await _db.Specializations.AnyAsync(s => s.Id == request.SpecializationId))
            {
                ModelState.AddModelError(nameof(request.SpecializationId), "This specialization does not exist.");
                return ValidationProblem(ModelState);
            }

            var doctorRole = await _db.Roles.FirstAsync(r => r.Name == "Doctor");

            var user = new DomainUser
            {
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                RoleId = doctorRole.Id
            };

            var doctor = new Doctor
            {
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                LicenseNumber = license,
                Phone = request.Phone,
                Email = email,
                Bio = request.Bio,
                YearsOfExperience = request.YearsOfExperience,
                SpecializationId = request.SpecializationId,
                User = user
            };

            _db.Doctors.Add(doctor);
            await _db.SaveChangesAsync();
            await _audit.LogAsync("CreatedDoctor", nameof(Doctor), doctor.Id);

            var dto = await BuildDetailsAsync(doctor.Id);
            return CreatedAtAction(nameof(GetById), new { id = doctor.Id }, dto);
        }

        [HttpGet("{id:int}/schedule")]
        [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
        public async Task<ActionResult<List<ScheduleItemDto>>> GetSchedule(int id)
        {
            if (!await _db.Doctors.AnyAsync(d => d.Id == id)) return NotFound();

            
            if (_current.Role == "Doctor" && await _current.GetDoctorIdAsync() != id)
                return Forbid();

            var query = _db.DoctorSchedules.AsNoTracking().Where(s => s.DoctorId == id);

           
            if (_current.Role == "Patient")
                query = query.Where(s => s.IsActive);

            var items = await query
                .OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
                .Select(s => new ScheduleItemDto
                {
                    DayOfWeek = s.DayOfWeek,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime,
                    IsActive = s.IsActive
                })
                .ToListAsync();

            return Ok(items);
        }

       
        [HttpPut("{id:int}/schedule")]
        [Authorize(Roles = "Admin,Doctor")]
        public async Task<ActionResult<List<ScheduleItemDto>>> UpdateSchedule(int id, UpdateScheduleRequest request)
        {
            if (!await _db.Doctors.AnyAsync(d => d.Id == id)) return NotFound();

            if (_current.Role == "Doctor" && await _current.GetDoctorIdAsync() != id)
                return Forbid();

          
            if (request.Items.Any(i => i.StartTime >= i.EndTime))
            {
                ModelState.AddModelError(nameof(request.Items), "Each start time must be earlier than its end time.");
                return ValidationProblem(ModelState);
            }

       
            foreach (var day in request.Items.Where(i => i.IsActive).GroupBy(i => i.DayOfWeek))
            {
                var ordered = day.OrderBy(i => i.StartTime).ToList();
                for (var i = 1; i < ordered.Count; i++)
                {
                    if (ordered[i].StartTime < ordered[i - 1].EndTime)
                    {
                        ModelState.AddModelError(nameof(request.Items), $"Working hours overlap on {day.Key}.");
                        return ValidationProblem(ModelState);
                    }
                }
            }

            var existing = await _db.DoctorSchedules.Where(s => s.DoctorId == id).ToListAsync();
            _db.DoctorSchedules.RemoveRange(existing);

            _db.DoctorSchedules.AddRange(request.Items.Select(i => new DoctorSchedule
            {
                DoctorId = id,
                DayOfWeek = i.DayOfWeek,
                StartTime = i.StartTime,
                EndTime = i.EndTime,
                IsActive = i.IsActive
            }));

            await _db.SaveChangesAsync();
            await _audit.LogAsync("UpdatedDoctorSchedule", nameof(Doctor), id);

            return Ok(request.Items.OrderBy(i => i.DayOfWeek).ThenBy(i => i.StartTime).ToList());
        }

        private Task<DoctorDetailsDto?> BuildDetailsAsync(int id)
        {
            return _db.Doctors
                .AsNoTracking()
                 .Where(d => d.Id == id && d.User.IsActive)
                .Select(d => new DoctorDetailsDto
                {
                    Id = d.Id,
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    SpecializationId = d.SpecializationId,
                    Specialization = d.Specialization.Name,
                    PhotoUrl = d.PhotoUrl,
                    YearsOfExperience = d.YearsOfExperience,
                    AverageRating = d.AverageRating,
                    ReviewCount = d.ReviewCount,
                    Bio = d.Bio,
                    LicenseNumber = d.LicenseNumber,
                    MemberSince = d.CreatedAt,
                    Educations = d.Educations
                        .OrderByDescending(e => e.GraduationYear)
                        .Select(e => new EducationDto
                        {
                            Institution = e.Institution,
                            Degree = e.Degree,
                            StartYear = e.StartYear,
                            GraduationYear = e.GraduationYear
                        })
                        .ToList(),
                    Experiences = d.Experiences
                        .OrderByDescending(x => x.StartDate)
                        .Select(x => new ExperienceDto
                        {
                            Workplace = x.Workplace,
                            Position = x.Position,
                            StartDate = x.StartDate,
                            EndDate = x.EndDate,
                            Description = x.Description
                        })
                        .ToList(),
                    Services = d.DoctorServices
                        .Where(ds => ds.Service.IsActive)
                        .Select(ds => new DoctorServiceDto
                        {
                            ServiceId = ds.ServiceId,
                            Name = ds.Service.Name,
                            Price = ds.Service.Price,
                            DurationMinutes = ds.Service.DurationMinutes
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();
        }
    }
}