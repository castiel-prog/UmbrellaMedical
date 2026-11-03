using UmbrellaMedical.Api.DTOs.Appointments;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace UmbrellaMedical.Api.Services
{
    public interface IAppointmentSlotService
    {
        Task<List<SlotDto>> GetFreeSlotsAsync(int doctorId, DateOnly date, int durationMinutes, int? excludeAppointmentId = null);
    }

    public class AppointmentSlotService : IAppointmentSlotService
    {
        private readonly UmbrellaDbContext _db;
        private readonly IClinicClock _clock;

        public AppointmentSlotService(UmbrellaDbContext db, IClinicClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<List<SlotDto>> GetFreeSlotsAsync(
            int doctorId, DateOnly date, int durationMinutes, int? excludeAppointmentId = null)
        {
            var slots = new List<SlotDto>();
            var duration = TimeSpan.FromMinutes(durationMinutes);

            var dayStart = date.ToDateTime(TimeOnly.MinValue);
            var dayEnd = dayStart.AddDays(1);

           
            var shifts = await _db.DoctorSchedules
                .AsNoTracking()
                .Where(s => s.DoctorId == doctorId && s.IsActive && s.DayOfWeek == date.DayOfWeek)
                .OrderBy(s => s.StartTime)
                .ToListAsync();

            if (shifts.Count == 0) return slots;

           
            var appointments = await _db.Appointments
                .AsNoTracking()
                .Where(a => a.DoctorId == doctorId
                            && a.Status != AppointmentStatus.Cancelled
                            && a.StartDateTime < dayEnd
                            && a.EndDateTime > dayStart
                            && (excludeAppointmentId == null || a.Id != excludeAppointmentId))
                .Select(a => new { Start = a.StartDateTime, End = a.EndDateTime })
                .ToListAsync();

           
            var timeOff = await _db.TimeOffs
                .AsNoTracking()
                .Where(t => t.DoctorId == doctorId
                            && t.Status == TimeOffStatus.Approved
                            && t.StartDateTime < dayEnd
                            && t.EndDateTime > dayStart)
                .Select(t => new { Start = t.StartDateTime, End = t.EndDateTime })
                .ToListAsync();

            var blocked = appointments.Concat(timeOff).ToList();
            var now = _clock.Now;

            foreach (var shift in shifts)
            {
                var shiftStart = dayStart + shift.StartTime.ToTimeSpan();
                var shiftEnd = dayStart + shift.EndTime.ToTimeSpan();

                for (var start = shiftStart; start + duration <= shiftEnd; start += duration)
                {
                    var end = start + duration;

                    if (start <= now) continue;                                   // already past
                    if (blocked.Any(b => start < b.End && end > b.Start)) continue; // overlaps something

                    slots.Add(new SlotDto { Start = start, End = end });
                }
            }

            return slots;
        }
    }
}