using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;
using Xunit;

namespace UmbrellaMedical.Tests;

public class AppointmentSlotServiceTests
{
    private static readonly DateOnly Monday = new(2026, 11, 9);
    private static readonly DateOnly Tuesday = new(2026, 11, 10);

    private static (UmbrellaDbContext Db, AppointmentSlotService Service) Setup(DateTime? now = null)
    {
        var db = TestDb.Create();
        var clock = new FakeClock(now ?? new DateTime(2026, 11, 2, 8, 0, 0));
        return (db, new AppointmentSlotService(db, clock));
    }

    private static async Task AddShiftAsync(UmbrellaDbContext db, string start, string end, bool active = true)
    {
        db.DoctorSchedules.Add(new DoctorSchedule
        {
            DoctorId = 1,
            DayOfWeek = DayOfWeek.Monday,
            StartTime = TimeOnly.Parse(start),
            EndTime = TimeOnly.Parse(end),
            IsActive = active
        });
        await db.SaveChangesAsync();
    }

    private static async Task<Appointment> AddAppointmentAsync(
        UmbrellaDbContext db, DateTime start, DateTime end, AppointmentStatus status = AppointmentStatus.Scheduled)
    {
        var appointment = new Appointment
        {
            DoctorId = 1,
            PatientId = 1,
            ServiceId = 1,
            StartDateTime = start,
            EndDateTime = end,
            Status = status
        };

        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
        return appointment;
    }

    private static async Task AddTimeOffAsync(UmbrellaDbContext db, DateTime start, DateTime end, TimeOffStatus status)
    {
        db.TimeOffs.Add(new TimeOff
        {
            DoctorId = 1,
            Type = TimeOffType.Vacation,
            StartDateTime = start,
            EndDateTime = end,
            Status = status
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task A_day_without_working_hours_has_no_slots()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");

        var slots = await service.GetFreeSlotsAsync(1, Tuesday, 30);

        Assert.Empty(slots);
    }

    [Fact]
    public async Task An_inactive_shift_is_ignored()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00", active: false);

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Empty(slots);
    }

    [Fact]
    public async Task A_shift_is_cut_into_blocks_as_long_as_the_service()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(8, slots.Count);
        Assert.Equal(new DateTime(2026, 11, 9, 9, 0, 0), slots[0].Start);
        Assert.Equal(new DateTime(2026, 11, 9, 12, 30, 0), slots[^1].Start);
        Assert.Equal(new DateTime(2026, 11, 9, 13, 0, 0), slots[^1].End);
    }

    [Fact]
    public async Task A_slot_that_would_run_past_the_end_of_the_shift_is_not_offered()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");

        var slots = await service.GetFreeSlotsAsync(1, Monday, 45);

        Assert.Equal(5, slots.Count);
        Assert.Equal(new DateTime(2026, 11, 9, 12, 0, 0), slots[^1].Start);
    }

    [Fact]
    public async Task Two_shifts_on_the_same_day_both_produce_slots()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        await AddShiftAsync(db, "14:00", "18:00");

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(16, slots.Count);
        Assert.DoesNotContain(slots, s => s.Start.Hour == 13);
    }

    [Fact]
    public async Task A_booked_appointment_removes_its_slot()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        await AddAppointmentAsync(db, new DateTime(2026, 11, 9, 10, 0, 0), new DateTime(2026, 11, 9, 10, 30, 0));

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(7, slots.Count);
        Assert.DoesNotContain(slots, s => s.Start == new DateTime(2026, 11, 9, 10, 0, 0));
    }

    [Fact]
    public async Task An_appointment_that_overlaps_two_slots_removes_both()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        await AddAppointmentAsync(db, new DateTime(2026, 11, 9, 10, 15, 0), new DateTime(2026, 11, 9, 10, 45, 0));

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(6, slots.Count);
    }

    [Fact]
    public async Task A_cancelled_appointment_does_not_block_its_slot()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        await AddAppointmentAsync(
            db, new DateTime(2026, 11, 9, 10, 0, 0), new DateTime(2026, 11, 9, 10, 30, 0), AppointmentStatus.Cancelled);

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(8, slots.Count);
    }

    [Fact]
    public async Task The_appointment_being_moved_can_be_excluded()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        var appointment = await AddAppointmentAsync(
            db, new DateTime(2026, 11, 9, 10, 0, 0), new DateTime(2026, 11, 9, 10, 30, 0));

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30, appointment.Id);

        Assert.Equal(8, slots.Count);
    }

    [Fact]
    public async Task Approved_time_off_blocks_slots()
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        await AddTimeOffAsync(
            db, new DateTime(2026, 11, 9, 9, 0, 0), new DateTime(2026, 11, 9, 11, 0, 0), TimeOffStatus.Approved);

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(4, slots.Count);
        Assert.Equal(new DateTime(2026, 11, 9, 11, 0, 0), slots[0].Start);
    }

    [Theory]
    [InlineData(TimeOffStatus.Pending)]
    [InlineData(TimeOffStatus.Declined)]
    public async Task Time_off_that_is_not_approved_does_not_block_slots(TimeOffStatus status)
    {
        var (db, service) = Setup();
        await AddShiftAsync(db, "09:00", "13:00");
        await AddTimeOffAsync(
            db, new DateTime(2026, 11, 9, 9, 0, 0), new DateTime(2026, 11, 9, 18, 0, 0), status);

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(8, slots.Count);
    }

    [Fact]
    public async Task Slots_in_the_past_are_not_offered()
    {
        var (db, service) = Setup(new DateTime(2026, 11, 9, 10, 15, 0));
        await AddShiftAsync(db, "09:00", "13:00");

        var slots = await service.GetFreeSlotsAsync(1, Monday, 30);

        Assert.Equal(5, slots.Count);
        Assert.Equal(new DateTime(2026, 11, 9, 10, 30, 0), slots[0].Start);
    }
}