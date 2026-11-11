using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Api.Settings;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;
using Xunit;

namespace UmbrellaMedical.Tests;

public class ReminderServiceTests
{
    private static readonly DateTime Now = new(2026, 11, 2, 8, 0, 0);

    private static async Task<UmbrellaDbContext> SeedAsync(int? patientUserId, params (int Id, DateTime Start, AppointmentStatus Status)[] appointments)
    {
        var db = TestDb.Create();

        db.Patients.Add(new Patient
        {
            Id = 1,
            FirstName = "Ana",
            LastName = "Gelashvili",
            PersonalNumber = "01009876543",
            Email = "ana@example.com",
            UserId = patientUserId
        });
        db.Doctors.Add(new Doctor { Id = 1, FirstName = "Giorgi", LastName = "Kapanadze", LicenseNumber = "LIC-1" });
        db.Services.Add(new Service { Id = 1, Name = "Dental checkup", Price = 40, DurationMinutes = 30 });

        foreach (var a in appointments)
        {
            db.Appointments.Add(new Appointment
            {
                Id = a.Id,
                PatientId = 1,
                DoctorId = 1,
                ServiceId = 1,
                StartDateTime = a.Start,
                EndDateTime = a.Start.AddMinutes(30),
                Status = a.Status
            });
        }

        await db.SaveChangesAsync();
        return db;
    }

    private static ReminderService CreateService(UmbrellaDbContext db, IEmailSender sender) =>
        new(db, sender, new FakeClock(Now), Options.Create(new ReminderSettings()), NullLogger<ReminderService>.Instance);

    [Fact]
    public async Task A_due_appointment_is_reminded_once()
    {
        var db = await SeedAsync(null, (1, Now.AddHours(4), AppointmentStatus.Scheduled));
        var sender = new FakeEmailSender();
        var service = CreateService(db, sender);

        var first = await service.SendDueRemindersAsync();
        var second = await service.SendDueRemindersAsync();

        Assert.Equal(1, first);
        Assert.Equal(0, second);
        Assert.Single(sender.Sent);
        Assert.Equal("ana@example.com", sender.Sent[0].To);
        Assert.True((await db.Appointments.SingleAsync()).ReminderSent);
    }

    [Fact]
    public async Task An_appointment_more_than_a_day_away_is_not_reminded()
    {
        var db = await SeedAsync(null, (1, Now.AddHours(30), AppointmentStatus.Scheduled));
        var sender = new FakeEmailSender();

        var handled = await CreateService(db, sender).SendDueRemindersAsync();

        Assert.Equal(0, handled);
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task A_past_appointment_is_not_reminded()
    {
        var db = await SeedAsync(null, (1, Now.AddHours(-1), AppointmentStatus.Scheduled));
        var sender = new FakeEmailSender();

        var handled = await CreateService(db, sender).SendDueRemindersAsync();

        Assert.Equal(0, handled);
        Assert.Empty(sender.Sent);
    }

    [Theory]
    [InlineData(AppointmentStatus.Cancelled)]
    [InlineData(AppointmentStatus.Completed)]
    [InlineData(AppointmentStatus.NoShow)]
    public async Task Appointments_that_are_not_scheduled_are_not_reminded(AppointmentStatus status)
    {
        var db = await SeedAsync(null, (1, Now.AddHours(4), status));
        var sender = new FakeEmailSender();

        var handled = await CreateService(db, sender).SendDueRemindersAsync();

        Assert.Equal(0, handled);
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task A_patient_with_a_login_also_gets_an_in_app_notification()
    {
        var db = await SeedAsync(7, (1, Now.AddHours(4), AppointmentStatus.Scheduled));

        await CreateService(db, new FakeEmailSender()).SendDueRemindersAsync();

        var notification = await db.Notifications.SingleAsync();
        Assert.Equal(7, notification.UserId);
        Assert.Equal(1, notification.AppointmentId);
    }

    [Fact]
    public async Task A_patient_without_a_login_gets_no_in_app_notification()
    {
        var db = await SeedAsync(null, (1, Now.AddHours(4), AppointmentStatus.Scheduled));

        await CreateService(db, new FakeEmailSender()).SendDueRemindersAsync();

        Assert.Empty(db.Notifications);
    }

    [Fact]
    public async Task A_failing_mail_server_leaves_the_appointment_for_the_next_cycle()
    {
        var db = await SeedAsync(null, (1, Now.AddHours(4), AppointmentStatus.Scheduled));

        var handled = await CreateService(db, new FailingEmailSender()).SendDueRemindersAsync();

        Assert.Equal(0, handled);
        Assert.False((await db.Appointments.SingleAsync()).ReminderSent);
    }
}