using System.Data;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.DTOs.Appointments;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AppointmentsController : ControllerBase
    {
        private const int MaxDaysAhead = 90;
        private const int MinHoursBeforeChange = 2;

        private readonly UmbrellaDbContext _db;
        private readonly ICurrentUser _current;
        private readonly IAuditService _audit;
        private readonly IClinicClock _clock;
        private readonly IAppointmentSlotService _slots;
        private readonly INotificationService _notifications;
        private readonly IPrepaidBookingService _prepaid;
        private readonly IPaymentGateway _gateway;
        private readonly ILogger<AppointmentsController> _logger;

        public AppointmentsController(
            UmbrellaDbContext db, ICurrentUser current, IAuditService audit,
            IClinicClock clock, IAppointmentSlotService slots, INotificationService notifications,
            IPrepaidBookingService prepaid, IPaymentGateway gateway, ILogger<AppointmentsController> logger)
        {
            _db = db;
            _current = current;
            _audit = audit;
            _clock = clock;
            _slots = slots;
            _notifications = notifications;
            _prepaid = prepaid;
            _gateway = gateway;
            _logger = logger;
        }

        // Instance (not static) so the query can look up the visit's invoice in the same SQL statement.
        private Expression<Func<Appointment, AppointmentDto>> Projection => a => new AppointmentDto
        {
            Id = a.Id,
            StartDateTime = a.StartDateTime,
            EndDateTime = a.EndDateTime,
            Status = a.Status,
            Reason = a.Reason,
            Notes = a.Notes,
            CancellationReason = a.CancellationReason,
            PatientId = a.PatientId,
            PatientName = a.Patient.FirstName + " " + a.Patient.LastName,
            DoctorId = a.DoctorId,
            DoctorName = a.Doctor.FirstName + " " + a.Doctor.LastName,
            Specialization = a.Doctor.Specialization.Name,
            ServiceId = a.ServiceId,
            ServiceName = a.Service.Name,
            Price = a.Service.Price,
            DurationMinutes = a.Service.DurationMinutes,
            InvoiceId = _db.Invoices
                .Where(i => i.AppointmentId == a.Id && i.Status != InvoiceStatus.Cancelled)
                .Select(i => (int?)i.Id)
                .FirstOrDefault(),
            AmountPaid = _db.Payments
                .Where(p => p.Invoice.AppointmentId == a.Id
                            && p.Invoice.Status != InvoiceStatus.Cancelled
                            && p.Status == PaymentStatus.Completed)
                .Sum(p => (decimal?)p.Amount) ?? 0m
        };

        /// <summary>What the patient will pay up front for this service at this time (after insurance).</summary>
        [HttpGet("quote")]
        [Authorize(Roles = "Admin,Receptionist,Patient")]
        public async Task<ActionResult<BookingQuoteDto>> Quote(
            [FromQuery] int serviceId, [FromQuery] DateTime startDateTime, [FromQuery] int? patientId)
        {
            int resolvedPatientId;
            if (_current.Role == "Patient")
            {
                var own = await _current.GetPatientIdAsync();
                if (own is null) return Forbid();
                resolvedPatientId = own.Value;
            }
            else
            {
                if (patientId is null) return Invalid(nameof(patientId), "Patient is required.");
                resolvedPatientId = patientId.Value;
            }

            var service = await _db.Services.AsNoTracking().FirstOrDefaultAsync(s => s.Id == serviceId && s.IsActive);
            if (service is null) return Invalid(nameof(serviceId), "This service does not exist or is not active.");

            var quote = await _prepaid.QuoteAsync(resolvedPatientId, service, _clock.ToClinicTime(startDateTime));
            return Ok(new BookingQuoteDto
            {
                Price = quote.Price,
                InsuranceCoverage = quote.InsuranceCoverage,
                AmountDue = quote.AmountDue,
                InsuranceCompany = quote.InsuranceCompany,
                CoveragePercent = quote.CoveragePercent,
                PaymentRequired = _current.Role == "Patient" && quote.AmountDue > 0
            });
        }

        [HttpGet("~/api/doctors/{doctorId:int}/slots")]
        public async Task<ActionResult<SlotsResponse>> GetSlots(
            int doctorId, [FromQuery] DateOnly date, [FromQuery] int serviceId)
        {
            if (!await _db.Doctors.AnyAsync(d => d.Id == doctorId && d.User.IsActive)) return NotFound();

            var service = await _db.Services.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == serviceId && s.IsActive);
            if (service is null) return Invalid(nameof(serviceId), "This service does not exist or is not active.");

            if (!await _db.DoctorServices.AnyAsync(ds => ds.DoctorId == doctorId && ds.ServiceId == serviceId))
                return Invalid(nameof(serviceId), "This doctor does not offer this service.");

            var today = DateOnly.FromDateTime(_clock.Now);
            if (date < today || date > today.AddDays(MaxDaysAhead))
                return Invalid(nameof(date), $"Choose a date from today up to {MaxDaysAhead} days ahead.");

            var slots = await _slots.GetFreeSlotsAsync(doctorId, date, service.DurationMinutes);

            return Ok(new SlotsResponse
            {
                Date = date,
                DoctorId = doctorId,
                ServiceId = serviceId,
                DurationMinutes = service.DurationMinutes,
                Slots = slots
            });
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
        public async Task<ActionResult<PagedResult<AppointmentDto>>> GetAll(
            [FromQuery] int? doctorId, [FromQuery] int? patientId, [FromQuery] AppointmentStatus? status,
            [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _db.Appointments.AsNoTracking().AsQueryable();

            if (_current.Role == "Patient")
            {
                var ownPatientId = await _current.GetPatientIdAsync();
                if (ownPatientId is null) return Forbid();
                query = query.Where(a => a.PatientId == ownPatientId.Value);
            }
            else if (_current.Role == "Doctor")
            {
                var ownDoctorId = await _current.GetDoctorIdAsync();
                if (ownDoctorId is null) return Forbid();
                query = query.Where(a => a.DoctorId == ownDoctorId.Value);
            }
            else
            {
                if (doctorId is not null) query = query.Where(a => a.DoctorId == doctorId);
                if (patientId is not null) query = query.Where(a => a.PatientId == patientId);
            }

            // Cancelled visits are gone for doctors and reception; only admins (and the patient, in their own history) see them.
            if (!CanSeeCancelled())
                query = query.Where(a => a.Status != AppointmentStatus.Cancelled);

            if (status is not null) query = query.Where(a => a.Status == status);
            if (from is not null)
            {
                var fromDate = from.Value.ToDateTime(TimeOnly.MinValue);
                query = query.Where(a => a.StartDateTime >= fromDate);
            }
            if (to is not null)
            {
                var toDate = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
                query = query.Where(a => a.StartDateTime < toDate);
            }

            var total = await query.CountAsync();

            var items = await query
                .OrderBy(a => a.StartDateTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(Projection)
                .ToListAsync();

            return Ok(new PagedResult<AppointmentDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total
            });
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
        public async Task<ActionResult<AppointmentDto>> GetById(int id)
        {
            var appointment = await _db.Appointments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null) return NotFound();
            if (appointment.Status == AppointmentStatus.Cancelled && !CanSeeCancelled()) return NotFound();
            if (!await CanAccessAsync(appointment)) return Forbid();

            return Ok(await LoadDtoAsync(id));
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Receptionist,Patient")]
        public async Task<ActionResult<AppointmentDto>> Create(CreateAppointmentRequest request)
        {
            int patientId;
            if (_current.Role == "Patient")
            {
                var own = await _current.GetPatientIdAsync();
                if (own is null) return Forbid();
                patientId = own.Value;
            }
            else
            {
                if (request.PatientId is null)
                    return Invalid(nameof(request.PatientId), "Patient is required when booking for someone else.");

                patientId = request.PatientId.Value;
                if (!await _db.Patients.AnyAsync(p => p.Id == patientId))
                    return Invalid(nameof(request.PatientId), "This patient does not exist.");
            }

            if (!await _db.Doctors.AnyAsync(d => d.Id == request.DoctorId && d.User.IsActive))
                return Invalid(nameof(request.DoctorId), "This doctor does not exist.");

            var service = await _db.Services.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == request.ServiceId && s.IsActive);
            if (service is null)
                return Invalid(nameof(request.ServiceId), "This service does not exist or is not active.");

            if (!await _db.DoctorServices.AnyAsync(ds => ds.DoctorId == request.DoctorId && ds.ServiceId == request.ServiceId))
                return Invalid(nameof(request.ServiceId), "This doctor does not offer this service.");

            var start = _clock.ToClinicTime(request.StartDateTime);
            var windowError = ValidateWindow(start);
            if (windowError is not null) return windowError;

            var end = start.AddMinutes(service.DurationMinutes);

            // Patients booking online pay up front (their share after insurance). Staff bookings are paid at the desk.
            var prepaid = _current.Role == "Patient";
            var quote = prepaid ? await _prepaid.QuoteAsync(patientId, service, start) : null;
            if (quote is { AmountDue: > 0 } && request.Card is null)
                return Invalid("card", "Please pay for the visit to complete the booking.");

            int newId;
            string? chargeReference = null;
            var committed = false;

            try
            {
                await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

                var free = await _slots.GetFreeSlotsAsync(request.DoctorId, DateOnly.FromDateTime(start), service.DurationMinutes);
                if (!free.Any(s => s.Start == start))
                    return SlotTaken();

                if (await PatientHasOverlapAsync(patientId, start, end, null))
                    return Problem(
                        detail: "This patient already has an appointment at this time.",
                        statusCode: StatusCodes.Status409Conflict,
                        title: "Overlapping appointment");

                // Charge only once the time is confirmed free, so a taken slot never costs the patient anything.
                if (quote is { AmountDue: > 0 })
                {
                    var card = request.Card!;
                    var charge = await _gateway.ChargeAsync(
                        quote.AmountDue,
                        new CardDetails(card.Number, card.ExpiryMonth, card.ExpiryYear, card.Cvc, card.HolderName),
                        $"{service.Name} on {NotificationText.When(start)}",
                        HttpContext.RequestAborted);

                    if (!charge.Success)
                        return Problem(
                            detail: charge.Error,
                            statusCode: StatusCodes.Status402PaymentRequired,
                            title: "Payment failed");

                    chargeReference = charge.Reference;
                }

                var appointment = new Appointment
                {
                    PatientId = patientId,
                    DoctorId = request.DoctorId,
                    ServiceId = request.ServiceId,
                    StartDateTime = start,
                    EndDateTime = end,
                    Status = AppointmentStatus.Scheduled,
                    Reason = request.Reason?.Trim()
                };

                if (_current.Role != "Patient")
                    await QueueForPatientAsync(patientId, "Appointment booked", $"An appointment was booked for you on {NotificationText.When(start)}.", null);

                _db.Appointments.Add(appointment);
                await _db.SaveChangesAsync();

                if (quote is not null)
                    await _prepaid.CreatePaidInvoiceAsync(appointment, service, quote, chargeReference);

                // Tell the doctor about the new visit (saved in the same transaction).
                var patientName = await PatientNameAsync(patientId);
                var what = _current.Role == "Patient"
                    ? $"{patientName} booked {service.Name} with you"
                    : $"The clinic booked {service.Name} for {patientName} with you";
                var reasonText = string.IsNullOrWhiteSpace(appointment.Reason) ? "" : $" Reason: {appointment.Reason}";
                if (await QueueForDoctorAsync(appointment.DoctorId, "New appointment booked",
                        $"{what} on {NotificationText.When(start)}.{reasonText}",
                        appointment.Id))
                    await _db.SaveChangesAsync();

                await tx.CommitAsync();
                committed = true;
                newId = appointment.Id;
            }
            catch (Exception ex) when (DbConflicts.IsTransientConflict(ex))
            {
                return SlotTaken();
            }
            finally
            {
                // The card was charged but the booking did not go through: give the money back.
                if (!committed && chargeReference is not null && quote is not null)
                {
                    var refunded = await _gateway.RefundAsync(chargeReference, quote.AmountDue, CancellationToken.None);
                    if (!refunded)
                        _logger.LogError("Booking failed after charging {Reference}, and the automatic refund failed.", chargeReference);
                }
            }

            await _audit.LogAsync("CreatedAppointment", nameof(Appointment), newId);
            return CreatedAtAction(nameof(GetById), new { id = newId }, await LoadDtoAsync(newId));
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin,Receptionist,Patient")]
        public async Task<ActionResult<AppointmentDto>> Reschedule(int id, RescheduleAppointmentRequest request)
        {
            var appointment = await _db.Appointments.Include(a => a.Service).FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null) return NotFound();
            if (!await CanAccessAsync(appointment)) return Forbid();

            if (appointment.Status != AppointmentStatus.Scheduled)
                return Problem(
                    detail: "Only scheduled appointments can be changed.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Appointment is not scheduled");

            var cutoff = CheckChangeCutoff(appointment);
            if (cutoff is not null) return cutoff;

            var start = _clock.ToClinicTime(request.StartDateTime);
            var windowError = ValidateWindow(start);
            if (windowError is not null) return windowError;

            var end = start.AddMinutes(appointment.Service.DurationMinutes);

            try
            {
                await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

                var free = await _slots.GetFreeSlotsAsync(
                    appointment.DoctorId, DateOnly.FromDateTime(start), appointment.Service.DurationMinutes, appointment.Id);
                if (!free.Any(s => s.Start == start))
                    return SlotTaken();

                if (await PatientHasOverlapAsync(appointment.PatientId, start, end, appointment.Id))
                    return Problem(
                        detail: "This patient already has an appointment at this time.",
                        statusCode: StatusCodes.Status409Conflict,
                        title: "Overlapping appointment");

                var previousStart = appointment.StartDateTime;
                appointment.StartDateTime = start;
                appointment.EndDateTime = end;
                appointment.ReminderSent = false;

                if (_current.Role != "Patient")
                    await QueueForPatientAsync(appointment.PatientId, "Appointment rescheduled", $"Your appointment was moved to {NotificationText.When(start)}.", appointment.Id);

                await QueueForDoctorAsync(appointment.DoctorId, "Appointment rescheduled",
                    $"{await PatientNameAsync(appointment.PatientId)}'s {appointment.Service.Name} visit moved from {NotificationText.When(previousStart)} to {NotificationText.When(start)}.",
                    appointment.Id);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch (Exception ex) when (DbConflicts.IsTransientConflict(ex))
            {
                return SlotTaken();
            }

            await _audit.LogAsync("RescheduledAppointment", nameof(Appointment), id);
            return Ok(await LoadDtoAsync(id));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin,Receptionist,Doctor,Patient")]
        public async Task<IActionResult> Cancel(int id, [FromQuery] string? reason)
        {
            if (reason is { Length: > 500 })
                return Invalid(nameof(reason), "The reason must be 500 characters or fewer.");

            var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null) return NotFound();
            if (!await CanAccessAsync(appointment)) return Forbid();

            if (appointment.Status != AppointmentStatus.Scheduled)
                return Problem(
                    detail: "Only scheduled appointments can be cancelled.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Appointment is not scheduled");

            var cutoff = CheckChangeCutoff(appointment);
            if (cutoff is not null) return cutoff;

            appointment.Status = AppointmentStatus.Cancelled;
            appointment.CancellationReason = string.IsNullOrWhiteSpace(reason)
                ? $"Cancelled by {_current.Role}"
                : reason.Trim();

            // A visit paid online is refunded in full when it is cancelled.
            var refunded = await _prepaid.RefundForCancelledVisitAsync(appointment.Id, HttpContext.RequestAborted);
            var refundText = refunded > 0 ? $" Your payment of {CardValidation.Money(refunded)} GEL was refunded to your card." : "";

            await QueueForPatientAsync(appointment.PatientId, "Appointment cancelled",
                _current.Role == "Patient"
                    ? $"You cancelled your appointment on {NotificationText.When(appointment.StartDateTime)}.{refundText}"
                    : $"Your appointment on {NotificationText.When(appointment.StartDateTime)} was cancelled. Reason: {appointment.CancellationReason}.{refundText}",
                appointment.Id);

            await QueueForDoctorAsync(appointment.DoctorId, "Appointment cancelled",
                $"{await PatientNameAsync(appointment.PatientId)}'s visit on {NotificationText.When(appointment.StartDateTime)} was cancelled. Reason: {appointment.CancellationReason}",
                appointment.Id);

            await _db.SaveChangesAsync();
            await _audit.LogAsync("CancelledAppointment", nameof(Appointment), id);

            return NoContent();
        }

        [HttpPost("{id:int}/complete")]
        [Authorize(Roles = "Admin,Doctor")]
        public async Task<ActionResult<AppointmentDto>> Complete(int id, CompleteAppointmentRequest request)
        {
            var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null) return NotFound();
            if (!await CanAccessAsync(appointment)) return Forbid();

            if (appointment.Status != AppointmentStatus.Scheduled)
                return Problem(
                    detail: "Only scheduled appointments can be completed.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Appointment is not scheduled");

            if (_clock.Now < appointment.StartDateTime)
                return Problem(
                    detail: "An appointment cannot be completed before it starts.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Too early");

            appointment.Status = AppointmentStatus.Completed;
            if (!string.IsNullOrWhiteSpace(request.Notes)) appointment.Notes = request.Notes.Trim();

            await _db.SaveChangesAsync();
            await _audit.LogAsync("CompletedAppointment", nameof(Appointment), id);

            return Ok(await LoadDtoAsync(id));
        }

        [HttpPost("{id:int}/no-show")]
        [Authorize(Roles = "Admin,Receptionist,Doctor")]
        public async Task<ActionResult<AppointmentDto>> NoShow(int id)
        {
            var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null) return NotFound();
            if (!await CanAccessAsync(appointment)) return Forbid();

            if (appointment.Status != AppointmentStatus.Scheduled)
                return Problem(
                    detail: "Only scheduled appointments can be marked as no-show.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Appointment is not scheduled");

            if (_clock.Now < appointment.StartDateTime)
                return Problem(
                    detail: "An appointment cannot be marked as no-show before it starts.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Too early");

            appointment.Status = AppointmentStatus.NoShow;

            await _db.SaveChangesAsync();
            await _audit.LogAsync("MarkedNoShow", nameof(Appointment), id);

            return Ok(await LoadDtoAsync(id));
        }

        private ActionResult Invalid(string field, string message)
        {
            ModelState.AddModelError(field, message);
            return ValidationProblem(ModelState);
        }

        private ActionResult SlotTaken() =>
            Problem(
                detail: "This time is not available. Pick one of the free slots from GET /api/doctors/{doctorId}/slots.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Time slot not available");

        private ActionResult? ValidateWindow(DateTime start)
        {
            var now = _clock.Now;
            if (start <= now)
                return Invalid("startDateTime", "The appointment must be in the future.");
            if (start > now.AddDays(MaxDaysAhead))
                return Invalid("startDateTime", $"Appointments can be booked up to {MaxDaysAhead} days ahead.");
            return null;
        }

        private ActionResult? CheckChangeCutoff(Appointment appointment)
        {
            if (_current.Role == "Patient"
                && appointment.StartDateTime - _clock.Now < TimeSpan.FromHours(MinHoursBeforeChange))
            {
                return Problem(
                    detail: $"Patients cannot change or cancel an appointment less than {MinHoursBeforeChange} hours before it starts. Please contact the clinic.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Too late to change");
            }
            return null;
        }

        /// <summary>Admins see every visit; patients see their own history. Doctors and reception never see cancelled visits.</summary>
        private bool CanSeeCancelled() => _current.Role is "Admin" or "Patient";

        private Task<bool> PatientHasOverlapAsync(int patientId, DateTime start, DateTime end, int? excludeId) =>
            _db.Appointments.AnyAsync(a => a.PatientId == patientId
                                           && a.Status != AppointmentStatus.Cancelled
                                           && a.StartDateTime < end
                                           && a.EndDateTime > start
                                           && (excludeId == null || a.Id != excludeId));

        private async Task<bool> CanAccessAsync(Appointment appointment)
        {
            switch (_current.Role)
            {
                case "Admin":
                case "Receptionist":
                    return true;
                case "Doctor":
                    return appointment.DoctorId == await _current.GetDoctorIdAsync();
                case "Patient":
                    return appointment.PatientId == await _current.GetPatientIdAsync();
                default:
                    return false;
            }
        }

        private async Task QueueForPatientAsync(int patientId, string title, string message, int? appointmentId)
        {
            var userId = await _db.Patients
                .Where(p => p.Id == patientId)
                .Select(p => p.UserId)
                .FirstOrDefaultAsync();

            if (userId is not null)
                _notifications.Queue(userId.Value, title, message, appointmentId);
        }

        /// <summary>
        /// Queues a notification for the doctor's account, unless the doctor made the change themselves.
        /// Returns true when a notification was queued.
        /// </summary>
        private async Task<bool> QueueForDoctorAsync(int doctorId, string title, string message, int? appointmentId)
        {
            var userId = await _db.Doctors
                .Where(d => d.Id == doctorId)
                .Select(d => (int?)d.UserId)
                .FirstOrDefaultAsync();

            if (userId is null || userId == _current.UserId) return false;

            _notifications.Queue(userId.Value, title, message, appointmentId);
            return true;
        }

        private async Task<string> PatientNameAsync(int patientId) =>
            await _db.Patients
                .Where(p => p.Id == patientId)
                .Select(p => p.FirstName + " " + p.LastName)
                .FirstOrDefaultAsync() ?? "A patient";

        private Task<AppointmentDto?> LoadDtoAsync(int id) =>
            _db.Appointments.AsNoTracking().Where(a => a.Id == id).Select(Projection).FirstOrDefaultAsync();
    }
}