using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using UmbrellaMedical.Api.Dtos.Prescriptions;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class PrescriptionsController : ControllerBase
{
    private static readonly Dictionary<string, string[]> RelatedDrugs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Penicillin"] = new[] { "penicillin", "amoxicillin", "ampicillin" }
    };

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IClinicalAccess _access;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public PrescriptionsController(
        UmbrellaDbContext db, ICurrentUser current, IClinicalAccess access,
        IAuditService audit, IClinicClock clock)
    {
        _db = db;
        _current = current;
        _access = access;
        _audit = audit;
        _clock = clock;
    }

    private Expression<Func<Prescription, PrescriptionDto>> Projection(DateTime now) => p => new PrescriptionDto
    {
        Id = p.Id,
        IssuedDate = p.IssuedDate,
        ExpiryDate = p.ExpiryDate,
        IsActive = p.ExpiryDate >= now,
        Instructions = p.Instructions,
        Code = p.Code,
        UsedFor = _db.StoreOrderItems
            .Where(i => i.PrescriptionId == p.Id
                        && i.StoreOrder.Status != StoreOrderStatus.Cancelled
                        && i.StoreOrder.Status != StoreOrderStatus.Rejected)
            .Select(i => i.ProductName)
            .ToList(),
        PatientId = p.PatientId,
        PatientName = p.Patient.FirstName + " " + p.Patient.LastName,
        DoctorId = p.DoctorId,
        DoctorName = p.Doctor.FirstName + " " + p.Doctor.LastName,
        MedicalRecordId = p.MedicalRecordId,
        Items = p.Items
            .Select(i => new PrescriptionItemDto
            {
                MedicationId = i.MedicationId,
                MedicationName = i.Medication.Name,
                Strength = i.Medication.Strength,
                Form = i.Medication.Form,
                Dosage = i.Dosage,
                Frequency = i.Frequency,
                DurationDays = i.DurationDays
            })
            .ToList()
    };

    /// <summary>
    /// Prescription history. Patients see their own; reception and admins see all; doctors see those they wrote and
    /// those of their patients (a visit that was not cancelled, or a prescription request sent to them).
    /// </summary>
    [HttpGet("prescriptions")]
    [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
    public async Task<ActionResult<PagedResult<PrescriptionDto>>> GetAll(
        [FromQuery] int? patientId, [FromQuery] bool? activeOnly, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var now = _clock.Now;
        var query = _db.Prescriptions.AsNoTracking().AsQueryable();

        if (_current.Role == "Patient")
        {
            var ownId = await _current.GetPatientIdAsync();
            if (ownId is null) return Forbid();
            query = query.Where(p => p.PatientId == ownId.Value);
        }
        else
        {
            if (_current.Role == "Doctor")
            {
                var doctorId = await _current.GetDoctorIdAsync();
                if (doctorId is null) return Forbid();
                var did = doctorId.Value;
                query = query.Where(p => p.DoctorId == did
                                         || _db.Appointments.Any(a => a.PatientId == p.PatientId && a.DoctorId == did && a.Status != AppointmentStatus.Cancelled)
                                         || _db.PrescriptionRequests.Any(r => r.PatientId == p.PatientId && r.DoctorId == did));
            }

            if (patientId is not null) query = query.Where(p => p.PatientId == patientId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                var code = PrescriptionCodes.Normalize(term);
                query = query.Where(p => (p.Patient.FirstName + " " + p.Patient.LastName).Contains(term)
                                         || p.Patient.PersonalNumber.Contains(term)
                                         || (p.Code != null && p.Code.Contains(code)));
            }

            await _audit.LogAsync("ViewedPrescriptionList", nameof(Prescription), null, search);
        }

        if (activeOnly == true) query = query.Where(p => p.ExpiryDate >= now);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(p => p.IssuedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection(now))
            .ToListAsync();

        return Ok(new PagedResult<PrescriptionDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpGet("prescriptions/{id:int}")]
    [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
    public async Task<ActionResult<PrescriptionDto>> GetById(int id)
    {
        var patientId = await _db.Prescriptions.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => (int?)p.PatientId)
            .FirstOrDefaultAsync();

        if (patientId is null) return NotFound();
        if (!await CanViewPrescriptionsAsync(patientId.Value)) return Forbid();

        if (_current.Role != "Patient")
            await _audit.LogAsync("ViewedPrescription", nameof(Prescription), id);

        return Ok(await LoadDtoAsync(id));
    }

    [HttpGet("patients/{patientId:int}/prescriptions")]
    [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
    public async Task<ActionResult<PagedResult<PrescriptionDto>>> GetForPatient(
        int patientId, [FromQuery] bool? activeOnly,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();
        if (!await CanViewPrescriptionsAsync(patientId)) return Forbid();

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var now = _clock.Now;
        var query = _db.Prescriptions.AsNoTracking().Where(p => p.PatientId == patientId);
        if (activeOnly == true) query = query.Where(p => p.ExpiryDate >= now);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(p => p.IssuedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection(now))
            .ToListAsync();

        if (_current.Role != "Patient")
            await _audit.LogAsync("ViewedPrescriptions", nameof(Patient), patientId);

        return Ok(new PagedResult<PrescriptionDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpPost("prescriptions")]
    [Authorize(Roles = "Doctor")]
    public async Task<ActionResult<PrescriptionDto>> Create(CreatePrescriptionRequest request)
    {
        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return Forbid();

        if (!await _db.Patients.AnyAsync(p => p.Id == request.PatientId))
            return Invalid(nameof(request.PatientId), "This patient does not exist.");

        if (!await _access.DoctorCanTreatAsync(doctorId.Value, request.PatientId)) return Forbid();

        if (request.MedicalRecordId is not null)
        {
            var record = await _db.MedicalRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == request.MedicalRecordId);

            if (record is null || record.PatientId != request.PatientId || record.DoctorId != doctorId.Value)
                return Invalid(nameof(request.MedicalRecordId), "This medical record does not belong to you and this patient.");
        }

        var medicationIds = request.Items.Select(i => i.MedicationId).Distinct().ToList();
        if (medicationIds.Count != request.Items.Count)
            return Invalid(nameof(request.Items), "Each medication can appear only once.");

        var medications = await _db.Medications.AsNoTracking()
            .Where(m => medicationIds.Contains(m.Id))
            .ToListAsync();

        if (medications.Count != medicationIds.Count)
            return Invalid(nameof(request.Items), "One or more medications do not exist.");

        var issued = _clock.Now;
        var expiry = request.ExpiryDate is null ? issued.AddDays(30) : _clock.ToClinicTime(request.ExpiryDate.Value);

        if (expiry <= issued || expiry > issued.AddDays(365))
            return Invalid(nameof(request.ExpiryDate), "The expiry date must be in the future and within one year.");

        var prescription = new Prescription
        {
            PatientId = request.PatientId,
            DoctorId = doctorId.Value,
            MedicalRecordId = request.MedicalRecordId,
            IssuedDate = issued,
            ExpiryDate = expiry,
            Instructions = string.IsNullOrWhiteSpace(request.Instructions) ? null : request.Instructions.Trim()
        };

        foreach (var item in request.Items)
        {
            prescription.Items.Add(new PrescriptionItem
            {
                MedicationId = item.MedicationId,
                Dosage = item.Dosage.Trim(),
                Frequency = item.Frequency.Trim(),
                DurationDays = item.DurationDays
            });
        }

        var warnings = await BuildAllergyWarningsAsync(_db, request.PatientId, medications);

        _db.Prescriptions.Add(prescription);
        await _db.SaveChangesAsync();
        prescription.Code = PrescriptionCodes.For(prescription.Id);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("IssuedPrescription", nameof(Prescription), prescription.Id);

        var dto = await LoadDtoAsync(prescription.Id);
        dto!.Warnings = warnings;

        return CreatedAtAction(nameof(GetById), new { id = prescription.Id }, dto);
    }

    /// <summary>Reception and admins see every patient's prescriptions; doctors their patients and those who asked them; patients their own.</summary>
    private async Task<bool> CanViewPrescriptionsAsync(int patientId)
    {
        if (_current.Role == "Receptionist") return true;
        if (await _access.CanAccessAsync(patientId)) return true;

        if (_current.Role == "Doctor")
        {
            var doctorId = await _current.GetDoctorIdAsync();
            return doctorId is not null
                   && await _db.PrescriptionRequests.AnyAsync(r => r.PatientId == patientId && r.DoctorId == doctorId.Value);
        }

        return false;
    }

    /// <summary>Warnings when a patient's recorded allergies clash with the medicines being prescribed.</summary>
    public static async Task<List<string>> BuildAllergyWarningsAsync(UmbrellaDbContext db, int patientId, List<Medication> medications)
    {
        var allergyNames = await db.PatientAllergies.AsNoTracking()
            .Where(pa => pa.PatientId == patientId)
            .Select(pa => pa.Allergy.Name)
            .ToListAsync();

        var warnings = new List<string>();

        foreach (var allergy in allergyNames)
        {
            var related = RelatedDrugs.TryGetValue(allergy, out var names) ? names : Array.Empty<string>();

            foreach (var medication in medications)
            {
                var name = medication.Name.ToLowerInvariant();
                var generic = medication.GenericName?.ToLowerInvariant();

                var matches = string.Equals(allergy, medication.Name, StringComparison.OrdinalIgnoreCase)
                              || string.Equals(allergy, medication.GenericName, StringComparison.OrdinalIgnoreCase)
                              || related.Contains(name)
                              || (generic is not null && related.Contains(generic));

                if (matches)
                    warnings.Add($"The patient has a recorded {allergy} allergy: check {medication.Name} before use.");
            }
        }

        return warnings.Distinct().ToList();
    }

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private Task<PrescriptionDto?> LoadDtoAsync(int id) =>
        _db.Prescriptions.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(Projection(_clock.Now))
            .FirstOrDefaultAsync();
}