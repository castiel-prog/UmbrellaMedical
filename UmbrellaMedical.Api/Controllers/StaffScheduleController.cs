using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Admin;
using UmbrellaMedical.Api.DTOs.Doctors;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/admin/staff-schedule")]
[Authorize(Roles = "Admin,Receptionist")]
public class StaffScheduleController : ControllerBase
{
    private const int MaxDays = 31;

    private readonly UmbrellaDbContext _db;
    private readonly IClinicClock _clock;

    public StaffScheduleController(UmbrellaDbContext db, IClinicClock clock)
    {
        _db = db;
        _clock = clock;
    }

    [HttpGet]
    public async Task<ActionResult<List<DoctorScheduleOverviewDto>>> Get(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int? doctorId)
    {
        var today = DateOnly.FromDateTime(_clock.Now);
        var start = from ?? today;
        var end = to ?? start.AddDays(6);

        if (end < start)
        {
            ModelState.AddModelError(nameof(to), "The end date cannot be before the start date.");
            return ValidationProblem(ModelState);
        }

        if (end.DayNumber - start.DayNumber + 1 > MaxDays)
        {
            ModelState.AddModelError(nameof(to), $"Choose at most {MaxDays} days.");
            return ValidationProblem(ModelState);
        }

        var rangeStart = start.ToDateTime(TimeOnly.MinValue);
        var rangeEnd = end.AddDays(1).ToDateTime(TimeOnly.MinValue);

        var doctors = await _db.Doctors.AsNoTracking()
            .Where(d => d.User.IsActive && (doctorId == null || d.Id == doctorId))
            .OrderBy(d => d.LastName).ThenBy(d => d.FirstName)
            .Select(d => new { d.Id, Name = d.FirstName + " " + d.LastName, Specialization = d.Specialization.Name })
            .ToListAsync();

        var ids = doctors.Select(d => d.Id).ToList();

        var schedules = await _db.DoctorSchedules.AsNoTracking()
            .Where(s => ids.Contains(s.DoctorId) && s.IsActive)
            .OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
            .ToListAsync();

        var timeOffs = await _db.TimeOffs.AsNoTracking()
            .Where(t => ids.Contains(t.DoctorId)
                        && t.Status == TimeOffStatus.Approved
                        && t.StartDateTime < rangeEnd
                        && t.EndDateTime > rangeStart)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

        var appointments = await _db.Appointments.AsNoTracking()
            .Where(a => ids.Contains(a.DoctorId)
                        && a.Status == AppointmentStatus.Scheduled
                        && a.StartDateTime >= rangeStart
                        && a.StartDateTime < rangeEnd)
            .Select(a => new { a.DoctorId, a.StartDateTime })
            .ToListAsync();

        var result = new List<DoctorScheduleOverviewDto>();

        foreach (var doctor in doctors)
        {
            var weekly = schedules.Where(s => s.DoctorId == doctor.Id).ToList();
            var leave = timeOffs.Where(t => t.DoctorId == doctor.Id).ToList();
            var booked = appointments.Where(a => a.DoctorId == doctor.Id).ToList();

            var days = new List<ScheduleDayDto>();

            for (var date = start; date <= end; date = date.AddDays(1))
            {
                var dayStart = date.ToDateTime(TimeOnly.MinValue);
                var dayEnd = dayStart.AddDays(1);
                var weekday = date.DayOfWeek;

                days.Add(new ScheduleDayDto
                {
                    Date = date,
                    DayOfWeek = weekday,
                    Shifts = weekly
                        .Where(s => s.DayOfWeek == weekday)
                        .Select(s => s.StartTime.ToString("HH:mm") + "-" + s.EndTime.ToString("HH:mm"))
                        .ToList(),
                    OnLeave = leave.Any(t => t.StartDateTime < dayEnd && t.EndDateTime > dayStart),
                    ScheduledAppointments = booked.Count(a => a.StartDateTime >= dayStart && a.StartDateTime < dayEnd)
                });
            }

            result.Add(new DoctorScheduleOverviewDto
            {
                DoctorId = doctor.Id,
                DoctorName = doctor.Name,
                Specialization = doctor.Specialization,
                WeeklyHours = weekly
                    .Select(s => new ScheduleItemDto
                    {
                        DayOfWeek = s.DayOfWeek,
                        StartTime = s.StartTime,
                        EndTime = s.EndTime,
                        IsActive = s.IsActive
                    })
                    .ToList(),
                TimeOff = leave
                    .Select(t => new TimeOffPeriodDto
                    {
                        Id = t.Id,
                        Type = t.Type,
                        StartDateTime = t.StartDateTime,
                        EndDateTime = t.EndDateTime
                    })
                    .ToList(),
                Days = days
            });
        }

        return Ok(result);
    }
}