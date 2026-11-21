using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using UmbrellaMedical.Api.Settings;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

public interface IReminderService
{
    Task<int> SendDueRemindersAsync(CancellationToken cancellationToken = default);
}

public class ReminderService : IReminderService
{
    private readonly UmbrellaDbContext _db;
    private readonly IEmailSender _email;
    private readonly IClinicClock _clock;
    private readonly IClinicText _text;
    private readonly ReminderSettings _settings;
    private readonly ILogger<ReminderService> _logger;

    public ReminderService(
        UmbrellaDbContext db, IEmailSender email, IClinicClock clock,
        IOptions<ReminderSettings> options, ILogger<ReminderService> logger, IClinicText text)
    {
        _db = db;
        _email = email;
        _clock = clock;
        _text = text;
        _settings = options.Value;
        _logger = logger;
    }

    public async Task<int> SendDueRemindersAsync(CancellationToken cancellationToken = default)
    {
        var hours = Math.Clamp(_settings.HoursBefore, 1, 168);
        var batch = Math.Clamp(_settings.BatchSize, 1, 500);
        var now = _clock.Now;
        var until = now.AddHours(hours);

        var due = await _db.Appointments
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Include(a => a.Doctor)
            .Include(a => a.Service)
            .Where(a => a.Status == AppointmentStatus.Scheduled
                        && !a.ReminderSent
                        && a.StartDateTime > now
                        && a.StartDateTime <= until)
            .OrderBy(a => a.StartDateTime)
            .Take(batch)
            .ToListAsync(cancellationToken);

        var handled = 0;

        foreach (var appointment in due)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var l = new Localizer(_text, appointment.Patient.User?.PreferredLanguage);
            var when = l.When(appointment.StartDateTime);
            var doctorName = $"Dr. {appointment.Doctor.FirstName} {appointment.Doctor.LastName}";
            // Patients with an account can turn reminder emails off in their profile.
            var wantsEmail = appointment.Patient.User?.EmailReminders ?? true;
            var address = wantsEmail ? FirstNonEmpty(appointment.Patient.Email, appointment.Patient.User?.Email) : null;

            if (address is not null)
            {
                var mail = EmailTemplates.AppointmentReminder(l, appointment.Patient.FirstName, doctorName, appointment.Service.Name, when);

                try
                {
                    await _email.SendAsync(address, mail.Subject, mail.Body, cancellationToken, mail.Lang);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not send the reminder for appointment {AppointmentId}", appointment.Id);
                    continue;
                }
            }

            if (appointment.Patient.UserId is int userId)
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = userId,
                    Title = l.T("Appointment reminder"),
                    Message = l.T("{service} with {doctor} on {when}.", ("service", appointment.Service.Name), ("doctor", doctorName), ("when", when)),
                    Channel = NotificationChannel.InApp,
                    Status = NotificationStatus.Sent,
                    SentAt = DateTime.UtcNow,
                    EmailedAt = DateTime.UtcNow,   // reminders have their own email (or the person turned them off)
                    AppointmentId = appointment.Id
                });
            }

            appointment.ReminderSent = true;
            await _db.SaveChangesAsync(cancellationToken);
            handled++;
        }

        return handled;
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();
}