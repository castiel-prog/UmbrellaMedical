using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using UmbrellaMedical.Api.Dtos.Leave;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/time-off")]
[Authorize]
public class TimeOffController : ControllerBase
{
    private const int MaxDaysPerRequest = 60;

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;
    private readonly INotificationService _notifications;
    private readonly IPrepaidBookingService _prepaid;

    public TimeOffController(
        UmbrellaDbContext db, ICurrentUser current, IAuditService audit,
        IClinicClock clock, INotificationService notifications, IPrepaidBookingService prepaid)
    {
        _db = db;
        _current = current;
        _audit = audit;
        _clock = clock;
        _notifications = notifications;
        _prepaid = prepaid;
    }

    private static readonly Expression<Func<TimeOff, TimeOffDto>> Projection = t => new TimeOffDto
    {
        Id = t.Id,
        DoctorId = t.DoctorId,
        DoctorName = t.Doctor.FirstName + " " + t.Doctor.LastName,
        Specialization = t.Doctor.Specialization.Name,
        Type = t.Type,
        StartDateTime = t.StartDateTime,
        EndDateTime = t.EndDateTime,
        Reason = t.Reason,
        Status = t.Status,
        DeclineReason = t.DeclineReason,
        ReviewedAt = t.ReviewedAt,
        ConflictingAppointments = t.Status == TimeOffStatus.Pending
            ? t.Doctor.Appointments.Count(a => a.Status == AppointmentStatus.Scheduled
                                               && a.StartDateTime < t.EndDateTime
                                               && a.EndDateTime > t.StartDateTime)
            : 0
    };

    [HttpPost]
    [Authorize(Roles = "Doctor")]
    public async Task<ActionResult<TimeOffDto>> Create(CreateTimeOffRequest request)
    {
        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return Forbid();

        var now = _clock.Now;
        var start = _clock.ToClinicTime(request.StartDateTime);
        var end = _clock.ToClinicTime(request.EndDateTime);

        if (end <= start)
            return Invalid(nameof(request.EndDateTime), "The end must be later than the start.");
        if (start <= now)
            return Invalid(nameof(request.StartDateTime), "Time off must start in the future.");
        if (start > now.AddDays(365))
            return Invalid(nameof(request.StartDateTime), "Time off can be requested up to one year ahead.");
        if ((end - start).TotalDays > MaxDaysPerRequest)
            return Invalid(nameof(request.EndDateTime), $"One request can cover at most {MaxDaysPerRequest} days.");

        var did = doctorId.Value;
        var overlaps = await _db.TimeOffs.AnyAsync(t => t.DoctorId == did
                                                        && (t.Status == TimeOffStatus.Pending || t.Status == TimeOffStatus.Approved)
                                                        && t.StartDateTime < end
                                                        && t.EndDateTime > start);
        if (overlaps)
            return Problem(
                detail: "You already have a pending or approved time-off request that overlaps this period.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Overlapping request");

        var timeOff = new TimeOff
        {
            DoctorId = did,
            Type = request.Type,
            StartDateTime = start,
            EndDateTime = end,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            Status = TimeOffStatus.Pending
        };

        _db.TimeOffs.Add(timeOff);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("RequestedTimeOff", nameof(TimeOff), timeOff.Id);

        return CreatedAtAction(nameof(GetById), new { id = timeOff.Id }, await LoadDtoAsync(timeOff.Id));
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Doctor")]
    public async Task<ActionResult<PagedResult<TimeOffDto>>> GetAll(
        [FromQuery] int? doctorId, [FromQuery] TimeOffStatus? status,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.TimeOffs.AsNoTracking().AsQueryable();

        if (_current.Role == "Doctor")
        {
            var own = await _current.GetDoctorIdAsync();
            if (own is null) return Forbid();
            query = query.Where(t => t.DoctorId == own.Value);
        }
        else if (doctorId is not null)
        {
            query = query.Where(t => t.DoctorId == doctorId);
        }

        if (status is not null) query = query.Where(t => t.Status == status);
        if (from is not null)
        {
            var fromDate = from.Value.ToDateTime(TimeOnly.MinValue);
            query = query.Where(t => t.EndDateTime >= fromDate);
        }
        if (to is not null)
        {
            var toDate = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
            query = query.Where(t => t.StartDateTime < toDate);
        }

        var total = await query.CountAsync();

        var items = await query
            .OrderBy(t => t.Status == TimeOffStatus.Pending ? 0 : 1)
            .ThenBy(t => t.StartDateTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection)
            .ToListAsync();

        return Ok(new PagedResult<TimeOffDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Doctor")]
    public async Task<ActionResult<TimeOffDto>> GetById(int id)
    {
        var timeOff = await _db.TimeOffs.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (timeOff is null) return NotFound();
        if (!await CanViewAsync(timeOff)) return Forbid();

        return Ok(await LoadDtoAsync(id));
    }

    [HttpGet("{id:int}/appointments")]
    [Authorize(Roles = "Admin,Doctor")]
    public async Task<ActionResult<List<ConflictingAppointmentDto>>> GetConflicts(int id)
    {
        var timeOff = await _db.TimeOffs.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (timeOff is null) return NotFound();
        if (!await CanViewAsync(timeOff)) return Forbid();

        var doctorId = timeOff.DoctorId;
        var start = timeOff.StartDateTime;
        var end = timeOff.EndDateTime;

        var items = await _db.Appointments.AsNoTracking()
            .Where(a => a.DoctorId == doctorId
                        && a.Status == AppointmentStatus.Scheduled
                        && a.StartDateTime < end
                        && a.EndDateTime > start)
            .OrderBy(a => a.StartDateTime)
            .Select(a => new ConflictingAppointmentDto
            {
                Id = a.Id,
                StartDateTime = a.StartDateTime,
                EndDateTime = a.EndDateTime,
                PatientName = a.Patient.FirstName + " " + a.Patient.LastName,
                ServiceName = a.Service.Name
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<TimeOffDto>> Approve(int id, ApproveTimeOffRequest request)
    {
        var timeOff = await _db.TimeOffs.FirstOrDefaultAsync(t => t.Id == id);
        if (timeOff is null) return NotFound();

        if (timeOff.Status != TimeOffStatus.Pending)
            return Problem(
                detail: "Only pending requests can be approved.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Request already reviewed");

        var doctorId = timeOff.DoctorId;
        var start = timeOff.StartDateTime;
        var end = timeOff.EndDateTime;

        var conflicts = await _db.Appointments
            .Include(a => a.Patient)
            .Where(a => a.DoctorId == doctorId
                        && a.Status == AppointmentStatus.Scheduled
                        && a.StartDateTime < end
                        && a.EndDateTime > start)
            .ToListAsync();

        if (conflicts.Count > 0 && !request.CancelConflictingAppointments)
            return Problem(
                detail: $"The doctor has {conflicts.Count} scheduled appointment(s) in this period. Review them with GET /api/time-off/{id}/appointments, then approve again with cancelConflictingAppointments set to true.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Appointments in this period");

        foreach (var appointment in conflicts)
        {
            appointment.Status = AppointmentStatus.Cancelled;
            appointment.CancellationReason = "The doctor is on leave";

            // Visits paid online are refunded in full.
            var refunded = await _prepaid.RefundForCancelledVisitAsync(appointment.Id, HttpContext.RequestAborted);
            var refundText = refunded > 0 ? $" Your payment of {CardValidation.Money(refunded)} GEL was refunded to your card." : "";

            if (appointment.Patient.UserId is int patientUserId)
                _notifications.Queue(
                    patientUserId,
                    "Appointment cancelled",
                    $"Your appointment on {NotificationText.When(appointment.StartDateTime)} was cancelled because the doctor is on leave. Please book a new time.{refundText}",
                    appointment.Id);
        }

        var doctorUserId = await _db.Doctors
            .Where(d => d.Id == doctorId)
            .Select(d => d.UserId)
            .FirstAsync();

        _notifications.Queue(
            doctorUserId,
            "Time off approved",
            $"Your time off from {NotificationText.When(start)} to {NotificationText.When(end)} was approved.");

        timeOff.Status = TimeOffStatus.Approved;
        timeOff.DeclineReason = null;
        timeOff.ReviewedAt = DateTime.UtcNow;
        timeOff.ReviewedByUserId = _current.UserId;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("ApprovedTimeOff", nameof(TimeOff), id, $"CancelledAppointments={conflicts.Count}");

        return Ok(await LoadDtoAsync(id));
    }

    [HttpPost("{id:int}/decline")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<TimeOffDto>> Decline(int id, DeclineTimeOffRequest request)
    {
        var timeOff = await _db.TimeOffs.FirstOrDefaultAsync(t => t.Id == id);
        if (timeOff is null) return NotFound();

        if (timeOff.Status != TimeOffStatus.Pending)
            return Problem(
                detail: "Only pending requests can be declined.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Request already reviewed");

        var doctorUserId = await _db.Doctors
            .Where(d => d.Id == timeOff.DoctorId)
            .Select(d => d.UserId)
            .FirstAsync();

        _notifications.Queue(
            doctorUserId,
            "Time off declined",
            $"Your time off from {NotificationText.When(timeOff.StartDateTime)} to {NotificationText.When(timeOff.EndDateTime)} was declined. Reason: {request.Reason.Trim()}");

        timeOff.Status = TimeOffStatus.Declined;
        timeOff.DeclineReason = request.Reason.Trim();
        timeOff.ReviewedAt = DateTime.UtcNow;
        timeOff.ReviewedByUserId = _current.UserId;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("DeclinedTimeOff", nameof(TimeOff), id);

        return Ok(await LoadDtoAsync(id));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> Withdraw(int id)
    {
        var doctorId = await _current.GetDoctorIdAsync();
        if (doctorId is null) return Forbid();

        var timeOff = await _db.TimeOffs.FirstOrDefaultAsync(t => t.Id == id);
        if (timeOff is null) return NotFound();
        if (timeOff.DoctorId != doctorId.Value) return Forbid();

        if (timeOff.Status != TimeOffStatus.Pending)
            return Problem(
                detail: "Only pending requests can be withdrawn.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Request already reviewed");

        _db.TimeOffs.Remove(timeOff);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("WithdrewTimeOff", nameof(TimeOff), id);

        return NoContent();
    }

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private async Task<bool> CanViewAsync(TimeOff timeOff)
    {
        if (_current.Role == "Admin") return true;
        if (_current.Role == "Doctor") return timeOff.DoctorId == await _current.GetDoctorIdAsync();
        return false;
    }

    private Task<TimeOffDto?> LoadDtoAsync(int id) =>
        _db.TimeOffs.AsNoTracking().Where(t => t.Id == id).Select(Projection).FirstOrDefaultAsync();
}