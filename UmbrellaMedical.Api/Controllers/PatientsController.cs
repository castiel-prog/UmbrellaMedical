using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.DTOs.Patients;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace UmbrellaMedical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PatientsController : ControllerBase
    {
        private readonly UmbrellaDbContext _db;
        private readonly ICurrentUser _current;
        private readonly IAuditService _audit;

        public PatientsController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit)
        {
            _db = db;
            _current = current;
            _audit = audit;
        }

        
        [HttpGet]
        [Authorize(Roles = "Admin,Receptionist,Doctor")]
        public async Task<ActionResult<PagedResult<PatientListItemDto>>> GetAll(
            [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Patients.AsNoTracking().AsQueryable();

            if (_current.Role == "Doctor")
            {
                var doctorId = await _current.GetDoctorIdAsync();
                if (doctorId is null) return Forbid();
                var did = doctorId.Value;
                query = query.Where(p => p.Appointments.Any(a => a.DoctorId == did));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(p =>
                    p.FirstName.Contains(term) ||
                    p.LastName.Contains(term) ||
                    p.PersonalNumber.Contains(term));
            }

            var total = await query.CountAsync();

            var items = await query
                .OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new PatientListItemDto
                {
                    Id = p.Id,
                    FirstName = p.FirstName,
                    LastName = p.LastName,
                    PersonalNumber = p.PersonalNumber,
                    DateOfBirth = p.DateOfBirth,
                    Gender = p.Gender,
                    Phone = p.Phone
                })
                .ToListAsync();

            return Ok(new PagedResult<PatientListItemDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total
            });
        }

        [HttpGet("me")]
        [Authorize(Roles = "Patient")]
        public async Task<ActionResult<PatientDetailsDto>> GetMe()
        {
            var patientId = await _current.GetPatientIdAsync();
            if (patientId is null) return NotFound();

            var dto = await BuildDetailsAsync(patientId.Value);
            return dto is null ? NotFound() : Ok(dto);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
        public async Task<ActionResult<PatientDetailsDto>> GetById(int id)
        {
            var dto = await BuildDetailsAsync(id);
            if (dto is null) return NotFound();

            if (!await CanAccessPatientAsync(id)) return Forbid();

            if (_current.Role != "Patient")
                await _audit.LogAsync("ViewedPatient", nameof(Patient), id);

            return Ok(dto);
        }

        
        [HttpPost]
        [Authorize(Roles = "Admin,Receptionist")]
        public async Task<ActionResult<PatientDetailsDto>> Create(CreatePatientRequest request)
        {
            if (!BirthDateIsValid(request.DateOfBirth))
                return ValidationProblem(ModelState);

            var personalNumber = request.PersonalNumber.Trim();

            if (await _db.Patients.AnyAsync(p => p.PersonalNumber == personalNumber))
                return Problem(
                    detail: "A patient with this personal number already exists.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Duplicate patient");

            var patient = new Patient
            {
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                PersonalNumber = personalNumber,
                DateOfBirth = request.DateOfBirth,
                Gender = request.Gender,
                Phone = request.Phone,
                Email = request.Email?.Trim().ToLowerInvariant(),
                Address = request.Address,
                MedicalHistory = request.MedicalHistory
            };

            _db.Patients.Add(patient);
            await _db.SaveChangesAsync();
            await _audit.LogAsync("CreatedPatient", nameof(Patient), patient.Id);

            var dto = await BuildDetailsAsync(patient.Id);
            return CreatedAtAction(nameof(GetById), new { id = patient.Id }, dto);
        }

        
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin,Receptionist")]
        public async Task<ActionResult<PatientDetailsDto>> Update(int id, UpdatePatientRequest request)
        {
            if (!BirthDateIsValid(request.DateOfBirth))
                return ValidationProblem(ModelState);

            var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == id);
            if (patient is null) return NotFound();

            patient.FirstName = request.FirstName.Trim();
            patient.LastName = request.LastName.Trim();
            patient.DateOfBirth = request.DateOfBirth;
            patient.Gender = request.Gender;
            patient.Phone = request.Phone;
            patient.Email = request.Email?.Trim().ToLowerInvariant();
            patient.Address = request.Address;
            patient.MedicalHistory = request.MedicalHistory;

            await _db.SaveChangesAsync();
            await _audit.LogAsync("UpdatedPatient", nameof(Patient), id);

            return Ok(await BuildDetailsAsync(id));
        }

        
        [HttpPut("me")]
        [Authorize(Roles = "Patient")]
        public async Task<ActionResult<PatientDetailsDto>> UpdateMyContact(UpdatePatientContactRequest request)
        {
            var patientId = await _current.GetPatientIdAsync();
            if (patientId is null) return NotFound();

            var patient = await _db.Patients.FirstAsync(p => p.Id == patientId.Value);
            patient.Phone = request.Phone;
            patient.Email = request.Email?.Trim().ToLowerInvariant();
            patient.Address = request.Address;

            await _db.SaveChangesAsync();
            return Ok(await BuildDetailsAsync(patient.Id));
        }

        

        private bool BirthDateIsValid(DateOnly dateOfBirth)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (dateOfBirth > today || dateOfBirth < today.AddYears(-130))
            {
                ModelState.AddModelError(nameof(dateOfBirth), "Date of birth is not valid.");
                return false;
            }
            return true;
        }

        private async Task<bool> CanAccessPatientAsync(int patientId)
        {
            switch (_current.Role)
            {
                case "Admin":
                case "Receptionist":
                    return true;

                case "Doctor":
                    {
                        var doctorId = await _current.GetDoctorIdAsync();
                        if (doctorId is null) return false;
                        var did = doctorId.Value;
                        return await _db.Appointments.AnyAsync(a => a.PatientId == patientId && a.DoctorId == did);
                    }

                case "Patient":
                    {
                        var userId = _current.UserId;
                        if (userId is null) return false;
                        var uid = userId.Value;
                        return await _db.Patients.AnyAsync(p => p.Id == patientId && p.UserId == uid);
                    }

                default:
                    return false;
            }
        }

        private Task<PatientDetailsDto?> BuildDetailsAsync(int id)
        {
            return _db.Patients
                .AsNoTracking()
                .Where(p => p.Id == id)
                .Select(p => new PatientDetailsDto
                {
                    Id = p.Id,
                    FirstName = p.FirstName,
                    LastName = p.LastName,
                    PersonalNumber = p.PersonalNumber,
                    DateOfBirth = p.DateOfBirth,
                    Gender = p.Gender,
                    Phone = p.Phone,
                    Email = p.Email,
                    Address = p.Address,
                    MedicalHistory = p.MedicalHistory,
                    CreatedAt = p.CreatedAt,
                    Allergies = p.PatientAllergies
                        .Select(pa => new PatientAllergyDto
                        {
                            AllergyId = pa.AllergyId,
                            Name = pa.Allergy.Name,
                            Severity = pa.Severity,
                            Notes = pa.Notes
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();
        }
    }
}