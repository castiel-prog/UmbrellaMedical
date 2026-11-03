using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using UmbrellaMedical.Api.Dtos.Medical;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class MedicalRecordsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IClinicalAccess _access;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public MedicalRecordsController(
        UmbrellaDbContext db, ICurrentUser current, IClinicalAccess access,
        IAuditService audit, IClinicClock clock)
    {
        _db = db;
        _current = current;
        _access = access;
        _audit = audit;
        _clock = clock;
    }

    private static readonly Expression<Func<MedicalRecord, MedicalRecordDto>> Projection = r => new MedicalRecordDto
    {
        Id = r.Id,
        RecordDate = r.RecordDate,
        PatientId = r.PatientId,
        PatientName = r.Patient.FirstName + " " + r.Patient.LastName,
        DoctorId = r.DoctorId,
        DoctorName = r.Doctor.FirstName + " " + r.Doctor.LastName,
        Specialization = r.Doctor.Specialization.Name,
        AppointmentId = r.AppointmentId,
        DiagnosisCode = r.Diagnosis != null ? r.Diagnosis.Code : null,
        DiagnosisName = r.Diagnosis != null ? r.Diagnosis.Name : null,
        Complaints = r.Complaints,
        DiagnosisDetails = r.DiagnosisDetails,
        Treatment = r.Treatment,
        Recommendations = r.Recommendations,
        Notes = r.Notes,
        VitalSigns = r.VitalSigns
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new VitalSignsDto
            {
                HeightCm = v.HeightCm,
                WeightKg = v.WeightKg,
                SystolicBp = v.SystolicBp,
                DiastolicBp = v.DiastolicBp,
                HeartRate = v.HeartRate,
                TemperatureC = v.TemperatureC
            })
            .FirstOrDefault(),
        ToothRecords = r.ToothRecords
            .OrderBy(t => t.ToothNumber)
            .Select(t => new ToothRecordDto
            {
                ToothNumber = t.ToothNumber,
                Condition = t.Condition,
                Treatment = t.Treatment,
                Notes = t.Notes
            })
            .ToList(),
        PrescriptionIds = r.Prescriptions.Select(p => p.Id).ToList(),
        DocumentIds = r.Documents.Select(d => d.Id).ToList()
    };

    [HttpGet("patients/{patientId:int}/medical-records")]
    [Authorize(Roles = "Admin,Doctor,Patient")]
    public async Task<ActionResult<PagedResult<MedicalRecordDto>>> GetForPatient(
        int patientId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();
        if (!await _access.CanAccessAsync(patientId)) return Forbid();

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.MedicalRecords.AsNoTracking().Where(r => r.PatientId == patientId);
        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.RecordDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection)
            .ToListAsync();

        if (_current.Role != "Patient")
            await _audit.LogAsync("ViewedMedicalRecords", nameof(Patient), patientId);

        return Ok(new PagedResult<MedicalRecordDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpGet("medical-records/{id:int}")]
    [Authorize(Roles = "Admin,Doctor,Patient")]
    public async Task<ActionResult<MedicalRecordDto>> GetById(int id)
    {
        var patientId = await _db.MedicalRecords.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => (int?)r.PatientId)
            .FirstOrDefaultAsync();

        if (patientId is null) return NotFound();
        if (!await _access.CanAccessAsync(patientId.Value)) return Forbid();

        if (_current.Role != "Patient")
            await _audit.LogAsync("ViewedMedicalRecord", nameof(MedicalRecord), id);

        return Ok(await LoadDtoAsync(id));
    }

    [HttpPost("patients/{patientId:int}/medical-records")]
    [Authorize(Roles = "Doctor")]
    public async Task<ActionResult<MedicalRecordDto>> Create(int patientId, CreateMedicalRecordRequest request)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();

        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return Forbid();
        if (!await _access.DoctorCanTreatAsync(doctorId.Value, patientId)) return Forbid();

        if (IsEmptyRecord(request.Complaints, request.DiagnosisDetails, request.Treatment, request.DiagnosisId))
            return Invalid("complaints", "Add at least a complaint, a diagnosis or a treatment.");

        if (request.DiagnosisId is not null && !await _db.Diagnoses.AnyAsync(d => d.Id == request.DiagnosisId))
            return Invalid(nameof(request.DiagnosisId), "This diagnosis does not exist.");

        if (request.AppointmentId is not null)
        {
            var appointment = await _db.Appointments.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == request.AppointmentId);

            if (appointment is null
                || appointment.PatientId != patientId
                || appointment.DoctorId != doctorId.Value
                || appointment.Status == AppointmentStatus.Cancelled)
            {
                return Invalid(nameof(request.AppointmentId),
                    "This appointment does not belong to you and this patient, or it was cancelled.");
            }
        }

        var teethError = CheckTeeth(request.ToothRecords);
        if (teethError is not null) return teethError;

        var record = new MedicalRecord
        {
            PatientId = patientId,
            DoctorId = doctorId.Value,
            AppointmentId = request.AppointmentId,
            DiagnosisId = request.DiagnosisId,
            RecordDate = _clock.Now,
            Complaints = Clean(request.Complaints),
            DiagnosisDetails = Clean(request.DiagnosisDetails),
            Treatment = Clean(request.Treatment),
            Recommendations = Clean(request.Recommendations),
            Notes = Clean(request.Notes)
        };

        var vitals = BuildVitals(patientId, request.VitalSigns);
        if (vitals is not null) record.VitalSigns.Add(vitals);

        foreach (var tooth in BuildTeeth(patientId, request.ToothRecords))
            record.ToothRecords.Add(tooth);

        _db.MedicalRecords.Add(record);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedMedicalRecord", nameof(MedicalRecord), record.Id);

        return CreatedAtAction(nameof(GetById), new { id = record.Id }, await LoadDtoAsync(record.Id));
    }

    [HttpPut("medical-records/{id:int}")]
    [Authorize(Roles = "Doctor")]
    public async Task<ActionResult<MedicalRecordDto>> Update(int id, UpdateMedicalRecordRequest request)
    {
        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return Forbid();

        var record = await _db.MedicalRecords
            .Include(r => r.VitalSigns)
            .Include(r => r.ToothRecords)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (record is null) return NotFound();
        if (record.DoctorId != doctorId.Value) return Forbid();

        if (IsEmptyRecord(request.Complaints, request.DiagnosisDetails, request.Treatment, request.DiagnosisId))
            return Invalid("complaints", "Add at least a complaint, a diagnosis or a treatment.");

        if (request.DiagnosisId is not null && !await _db.Diagnoses.AnyAsync(d => d.Id == request.DiagnosisId))
            return Invalid(nameof(request.DiagnosisId), "This diagnosis does not exist.");

        var teethError = CheckTeeth(request.ToothRecords);
        if (teethError is not null) return teethError;

        record.DiagnosisId = request.DiagnosisId;
        record.Complaints = Clean(request.Complaints);
        record.DiagnosisDetails = Clean(request.DiagnosisDetails);
        record.Treatment = Clean(request.Treatment);
        record.Recommendations = Clean(request.Recommendations);
        record.Notes = Clean(request.Notes);

        if (request.ToothRecords is not null)
        {
            _db.ToothRecords.RemoveRange(record.ToothRecords.ToList());
            foreach (var tooth in BuildTeeth(record.PatientId, request.ToothRecords))
            {
                tooth.MedicalRecordId = record.Id;
                _db.ToothRecords.Add(tooth);
            }
        }

        if (request.VitalSigns is not null)
        {
            _db.VitalSigns.RemoveRange(record.VitalSigns.ToList());
            var vitals = BuildVitals(record.PatientId, request.VitalSigns);
            if (vitals is not null)
            {
                vitals.MedicalRecordId = record.Id;
                _db.VitalSigns.Add(vitals);
            }
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedMedicalRecord", nameof(MedicalRecord), id);

        return Ok(await LoadDtoAsync(id));
    }

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool IsEmptyRecord(string? complaints, string? details, string? treatment, int? diagnosisId) =>
        string.IsNullOrWhiteSpace(complaints)
        && string.IsNullOrWhiteSpace(details)
        && string.IsNullOrWhiteSpace(treatment)
        && diagnosisId is null;

    private ActionResult? CheckTeeth(List<ToothRecordDto>? teeth)
    {
        if (teeth is null) return null;

        if (teeth.Select(t => t.ToothNumber).Distinct().Count() != teeth.Count)
            return Invalid("toothRecords", "Each tooth can appear only once.");

        return null;
    }

    private VitalSigns? BuildVitals(int patientId, VitalSignsDto? dto)
    {
        if (dto is null) return null;

        var hasValue = dto.HeightCm is not null || dto.WeightKg is not null || dto.SystolicBp is not null
                       || dto.DiastolicBp is not null || dto.HeartRate is not null || dto.TemperatureC is not null;
        if (!hasValue) return null;

        return new VitalSigns
        {
            PatientId = patientId,
            HeightCm = dto.HeightCm,
            WeightKg = dto.WeightKg,
            SystolicBp = dto.SystolicBp,
            DiastolicBp = dto.DiastolicBp,
            HeartRate = dto.HeartRate,
            TemperatureC = dto.TemperatureC,
            RecordedAt = _clock.Now
        };
    }

    private static List<ToothRecord> BuildTeeth(int patientId, List<ToothRecordDto>? teeth) =>
        (teeth ?? new List<ToothRecordDto>())
            .Select(t => new ToothRecord
            {
                PatientId = patientId,
                ToothNumber = t.ToothNumber,
                Condition = t.Condition,
                Treatment = Clean(t.Treatment),
                Notes = Clean(t.Notes)
            })
            .ToList();

    private Task<MedicalRecordDto?> LoadDtoAsync(int id) =>
        _db.MedicalRecords.AsNoTracking().Where(r => r.Id == id).Select(Projection).FirstOrDefaultAsync();
}