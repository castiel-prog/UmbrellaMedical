using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Medical;
using UmbrellaMedical.Api.DTOs.Patients;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class CatalogController : ControllerBase
{
    private readonly UmbrellaDbContext _db;

    public CatalogController(UmbrellaDbContext db)
    {
        _db = db;
    }

    [HttpGet("diagnoses")]
    public async Task<ActionResult<List<DiagnosisDto>>> GetDiagnoses([FromQuery] string? search)
    {
        var query = _db.Diagnoses.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(d => d.Code.ToLower().Contains(term) || d.Name.ToLower().Contains(term));
        }

        var items = await query
            .OrderBy(d => d.Code)
            .Take(50)
            .Select(d => new DiagnosisDto { Id = d.Id, Code = d.Code, Name = d.Name })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("medications")]
    public async Task<ActionResult<List<MedicationDto>>> GetMedications([FromQuery] string? search)
    {
        var query = _db.Medications.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(m => m.Name.ToLower().Contains(term) || (m.GenericName != null && m.GenericName.ToLower().Contains(term)));
        }

        var items = await query
            .OrderBy(m => m.Name)
            .Take(50)
            .Select(m => new MedicationDto
            {
                Id = m.Id,
                Name = m.Name,
                GenericName = m.GenericName,
                Form = m.Form,
                Strength = m.Strength
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("allergies")]
    public async Task<ActionResult<List<AllergyDto>>> GetAllergies()
    {
        var items = await _db.Allergies.AsNoTracking()
            .OrderBy(a => a.Name)
            .Select(a => new AllergyDto { Id = a.Id, Name = a.Name })
            .ToListAsync();

        return Ok(items);
    }
}

[ApiController]
[Route("api/patients/{patientId:int}/allergies")]
[Authorize(Roles = "Admin,Doctor,Patient")]
public class PatientAllergiesController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IClinicalAccess _access;
    private readonly IAuditService _audit;

    public PatientAllergiesController(UmbrellaDbContext db, IClinicalAccess access, IAuditService audit)
    {
        _db = db;
        _access = access;
        _audit = audit;
    }

    [HttpPut]
    public async Task<ActionResult<List<PatientAllergyDto>>> Replace(int patientId, UpdatePatientAllergiesRequest request)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();
        if (!await _access.CanAccessAsync(patientId)) return Forbid();

        var wanted = request.Allergies.GroupBy(a => a.AllergyId).Select(g => g.Last()).ToList();
        var ids = wanted.Select(a => a.AllergyId).ToList();

        var known = await _db.Allergies.Where(a => ids.Contains(a.Id)).Select(a => a.Id).ToListAsync();
        if (known.Count != ids.Count)
        {
            ModelState.AddModelError(nameof(request.Allergies), "One or more allergies do not exist.");
            return ValidationProblem(ModelState);
        }

        var existing = await _db.PatientAllergies.Where(pa => pa.PatientId == patientId).ToListAsync();

        _db.PatientAllergies.RemoveRange(existing.Where(e => !ids.Contains(e.AllergyId)));

        foreach (var item in wanted)
        {
            var current = existing.FirstOrDefault(e => e.AllergyId == item.AllergyId);

            if (current is null)
            {
                _db.PatientAllergies.Add(new PatientAllergy
                {
                    PatientId = patientId,
                    AllergyId = item.AllergyId,
                    Severity = item.Severity,
                    Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim()
                });
            }
            else
            {
                current.Severity = item.Severity;
                current.Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim();
            }
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedPatientAllergies", nameof(Patient), patientId);

        var result = await _db.PatientAllergies.AsNoTracking()
            .Where(pa => pa.PatientId == patientId)
            .OrderBy(pa => pa.Allergy.Name)
            .Select(pa => new PatientAllergyDto
            {
                AllergyId = pa.AllergyId,
                Name = pa.Allergy.Name,
                Severity = pa.Severity,
                Notes = pa.Notes
            })
            .ToListAsync();

        return Ok(result);
    }
}