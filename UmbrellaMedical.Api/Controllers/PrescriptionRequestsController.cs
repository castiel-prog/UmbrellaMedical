using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.DTOs.Store;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

/// <summary>
/// Patients ask a doctor for a prescription (about a visit or a medicine). The doctor is notified and either
/// approves it, which issues an e-prescription with a store code, or declines it with a reason.
/// </summary>
[ApiController]
[Route("api/prescription-requests")]
[Authorize]
public class PrescriptionRequestsController : ControllerBase
{
    private const int MaxPendingPerPatient = 5;

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public PrescriptionRequestsController(
        UmbrellaDbContext db, ICurrentUser current, INotificationService notifications, IAuditService audit, IClinicClock clock)
    {
        _db = db;
        _current = current;
        _notifications = notifications;
        _audit = audit;
        _clock = clock;
    }

    private static readonly Expression<Func<PrescriptionRequest, PrescriptionRequestDto>> Projection = r => new PrescriptionRequestDto
    {
        Id = r.Id,
        Status = r.Status,
        Message = r.Message,
        DecisionNote = r.DecisionNote,
        CreatedAt = r.CreatedAt,
        ReviewedAt = r.ReviewedAt,
        PatientId = r.PatientId,
        PatientName = r.Patient.FirstName + " " + r.Patient.LastName,
        DoctorId = r.DoctorId,
        DoctorName = r.Doctor.FirstName + " " + r.Doctor.LastName,
        Specialization = r.Doctor.Specialization.Name,
        AppointmentId = r.AppointmentId,
        AppointmentDate = r.Appointment != null ? r.Appointment.StartDateTime : null,
        AppointmentService = r.Appointment != null ? r.Appointment.Service.Name : null,
        MedicationId = r.MedicationId,
        MedicationName = r.Medication != null ? r.Medication.Name + " " + r.Medication.Strength : null,
        PrescriptionId = r.PrescriptionId,
        PrescriptionCode = r.Prescription != null ? r.Prescription.Code : null
    };

    /// <summary>Patients: their own requests. Doctors: requests sent to them. Reception and admins: all.</summary>
    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
    public async Task<ActionResult<PagedResult<PrescriptionRequestDto>>> GetAll(
        [FromQuery] PrescriptionRequestStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.PrescriptionRequests.AsNoTracking().AsQueryable();

        if (_current.Role == "Patient")
        {
            var own = await _current.GetPatientIdAsync();
            if (own is null) return Forbid();
            query = query.Where(r => r.PatientId == own.Value);
        }
        else if (_current.Role == "Doctor")
        {
            var own = await _current.GetDoctorIdAsync();
            if (own is null) return Forbid();
            query = query.Where(r => r.DoctorId == own.Value);
        }

        if (status is not null) query = query.Where(r => r.Status == status);

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(r => r.Status == PrescriptionRequestStatus.Pending ? 0 : 1)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(Projection)
            .ToListAsync();

        return Ok(new PagedResult<PrescriptionRequestDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total });
    }

    [HttpPost]
    [Authorize(Roles = "Patient")]
    public async Task<ActionResult<PrescriptionRequestDto>> Create(CreatePrescriptionRequestRequest request)
    {
        var patientId = await _current.GetPatientIdAsync();
        if (patientId is null) return Forbid();

        var doctor = await _db.Doctors.AsNoTracking()
            .Where(d => d.Id == request.DoctorId && d.User.IsActive)
            .Select(d => new { d.Id, d.UserId })
            .FirstOrDefaultAsync();
        if (doctor is null) return Invalid(nameof(request.DoctorId), "This doctor does not exist.");

        if (request.AppointmentId is not null
            && !await _db.Appointments.AnyAsync(a => a.Id == request.AppointmentId
                                                     && a.PatientId == patientId.Value
                                                     && a.DoctorId == request.DoctorId
                                                     && a.Status != AppointmentStatus.Cancelled))
            return Invalid(nameof(request.AppointmentId), "This visit is not yours with this doctor, or it was cancelled.");

        if (request.MedicationId is not null && !await _db.Medications.AnyAsync(m => m.Id == request.MedicationId))
            return Invalid(nameof(request.MedicationId), "This medicine does not exist.");

        var pending = await _db.PrescriptionRequests.CountAsync(r => r.PatientId == patientId.Value && r.Status == PrescriptionRequestStatus.Pending);
        if (pending >= MaxPendingPerPatient)
            return Problem(
                detail: $"You already have {pending} requests waiting for an answer. Please wait for a doctor to reply.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Too many open requests");

        var entity = new PrescriptionRequest
        {
            PatientId = patientId.Value,
            DoctorId = request.DoctorId,
            AppointmentId = request.AppointmentId,
            MedicationId = request.MedicationId,
            Message = request.Message.Trim()
        };
        _db.PrescriptionRequests.Add(entity);
        await _db.SaveChangesAsync();

        var patientName = await _db.Patients.Where(p => p.Id == patientId.Value).Select(p => p.FirstName + " " + p.LastName).FirstAsync();
        var medicine = request.MedicationId is null ? "" :
            " for " + await _db.Medications.Where(m => m.Id == request.MedicationId).Select(m => m.Name + " " + m.Strength).FirstAsync();
        _notifications.Queue(doctor.UserId, "New prescription request",
            $"{patientName} asked you for a prescription{medicine}: \"{Shorten(entity.Message, 160)}\" Open Prescriptions to answer.");
        await _db.SaveChangesAsync();

        await _audit.LogAsync("RequestedPrescription", nameof(PrescriptionRequest), entity.Id);
        return Ok(await LoadAsync(entity.Id));
    }

    /// <summary>The doctor approves: an e-prescription with a store code is issued and the patient is notified.</summary>
    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "Doctor")]
    public async Task<ActionResult<PrescriptionRequestDto>> Approve(int id, ApprovePrescriptionRequestRequest request)
    {
        var entity = await LoadForDoctorAsync(id);
        if (entity is null) return NotFound();
        if (entity.Status != PrescriptionRequestStatus.Pending) return AlreadyAnswered();

        var medication = await _db.Medications.AsNoTracking().FirstOrDefaultAsync(m => m.Id == request.MedicationId);
        if (medication is null) return Invalid(nameof(request.MedicationId), "This medication does not exist.");

        var issued = _clock.Now;
        var prescription = new Prescription
        {
            PatientId = entity.PatientId,
            DoctorId = entity.DoctorId,
            IssuedDate = issued,
            ExpiryDate = issued.AddDays(request.ValidDays),
            Instructions = string.IsNullOrWhiteSpace(request.Instructions) ? null : request.Instructions.Trim()
        };
        prescription.Items.Add(new PrescriptionItem
        {
            MedicationId = medication.Id,
            Dosage = request.Dosage.Trim(),
            Frequency = request.Frequency.Trim(),
            DurationDays = request.DurationDays
        });

        _db.Prescriptions.Add(prescription);
        await _db.SaveChangesAsync();
        prescription.Code = PrescriptionCodes.For(prescription.Id);

        entity.Status = PrescriptionRequestStatus.Approved;
        entity.PrescriptionId = prescription.Id;
        entity.ReviewedAt = issued;
        entity.DecisionNote = prescription.Instructions;

        if (entity.Patient.UserId is int patientUserId)
            _notifications.Queue(patientUserId, "Prescription request approved",
                $"Dr. {entity.Doctor.FirstName} {entity.Doctor.LastName} approved your request and prescribed {medication.Name} {medication.Strength}. " +
                $"Your prescription code is {prescription.Code} (valid until {issued.AddDays(request.ValidDays):d MMM yyyy}). " +
                "Use it in the pharmacy to buy the medicine; you'll also find it under My health > Prescriptions.");

        await _db.SaveChangesAsync();
        await _audit.LogAsync("ApprovedPrescriptionRequest", nameof(PrescriptionRequest), id, $"PrescriptionId={prescription.Id}");

        var dto = await LoadAsync(id);
        return Ok(dto);
    }

    [HttpPost("{id:int}/decline")]
    [Authorize(Roles = "Doctor")]
    public async Task<ActionResult<PrescriptionRequestDto>> Decline(int id, DeclinePrescriptionRequestRequest request)
    {
        var entity = await LoadForDoctorAsync(id);
        if (entity is null) return NotFound();
        if (entity.Status != PrescriptionRequestStatus.Pending) return AlreadyAnswered();

        entity.Status = PrescriptionRequestStatus.Declined;
        entity.DecisionNote = request.Reason.Trim();
        entity.ReviewedAt = _clock.Now;

        if (entity.Patient.UserId is int patientUserId)
            _notifications.Queue(patientUserId, "Prescription request declined",
                $"Dr. {entity.Doctor.FirstName} {entity.Doctor.LastName} could not approve your prescription request. Reason: {entity.DecisionNote} " +
                "You can book a visit if you'd like to discuss it.");

        await _db.SaveChangesAsync();
        await _audit.LogAsync("DeclinedPrescriptionRequest", nameof(PrescriptionRequest), id);
        return Ok(await LoadAsync(id));
    }

    /// <summary>The patient withdraws a request that has not been answered yet.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> Withdraw(int id)
    {
        var patientId = await _current.GetPatientIdAsync();
        var entity = await _db.PrescriptionRequests.FirstOrDefaultAsync(r => r.Id == id && r.PatientId == patientId);
        if (entity is null) return NotFound();
        if (entity.Status != PrescriptionRequestStatus.Pending) return AlreadyAnswered();

        entity.Status = PrescriptionRequestStatus.Withdrawn;
        entity.ReviewedAt = _clock.Now;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<PrescriptionRequest?> LoadForDoctorAsync(int id)
    {
        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return null;
        return await _db.PrescriptionRequests
            .Include(r => r.Patient)
            .Include(r => r.Doctor)
            .FirstOrDefaultAsync(r => r.Id == id && r.DoctorId == doctorId.Value);
    }

    private Task<PrescriptionRequestDto> LoadAsync(int id) =>
        _db.PrescriptionRequests.AsNoTracking().Where(r => r.Id == id).Select(Projection).FirstAsync();

    private ActionResult AlreadyAnswered() =>
        Problem(detail: "This request has already been answered or withdrawn.", statusCode: StatusCodes.Status409Conflict, title: "Already answered");

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private static string Shorten(string text, int max) => text.Length <= max ? text : text[..(max - 1)] + "…";
}
