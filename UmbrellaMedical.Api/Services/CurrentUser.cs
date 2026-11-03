using System.Security.Claims;
using UmbrellaMedical.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace UmbrellaMedical.Api.Services
{
    public interface ICurrentUser
    {
        int? UserId { get; }
        string? Role { get; }
        Task<int?> GetDoctorIdAsync();
        Task<int?> GetPatientIdAsync();
    }

    public class CurrentUser : ICurrentUser
    {
        private readonly IHttpContextAccessor _accessor;
        private readonly UmbrellaDbContext _db;

        private int? _doctorId;
        private bool _doctorLoaded;
        private int? _patientId;
        private bool _patientLoaded;

        public CurrentUser(IHttpContextAccessor accessor, UmbrellaDbContext db)
        {
            _accessor = accessor;
            _db = db;
        }

        public int? UserId =>
            int.TryParse(_accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        public string? Role => _accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role);

        public async Task<int?> GetDoctorIdAsync()
        {
            if (_doctorLoaded) return _doctorId;

            var userId = UserId;
            if (userId is not null)
            {
                var uid = userId.Value;
                _doctorId = await _db.Doctors
                    .Where(d => d.UserId == uid)
                    .Select(d => (int?)d.Id)
                    .FirstOrDefaultAsync();
            }

            _doctorLoaded = true;
            return _doctorId;
        }

        public async Task<int?> GetPatientIdAsync()
        {
            if (_patientLoaded) return _patientId;

            var userId = UserId;
            if (userId is not null)
            {
                var uid = userId.Value;
                _patientId = await _db.Patients
                    .Where(p => p.UserId == uid)
                    .Select(p => (int?)p.Id)
                    .FirstOrDefaultAsync();
            }

            _patientLoaded = true;
            return _patientId;
        }
    }
}
