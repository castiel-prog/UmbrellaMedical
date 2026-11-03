namespace UmbrellaMedical.Api.Services
{
    public interface IClinicClock
    {
      
        DateTime Now { get; }

        
        DateTime ToClinicTime(DateTime value);
    }

    public class ClinicClock : IClinicClock
    {
        private readonly TimeZoneInfo _zone;

        public ClinicClock(IConfiguration configuration)
        {
            var zoneId = configuration["Clinic:TimeZone"] ?? "Asia/Tbilisi";
            _zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        }

        public DateTime Now => Unspecified(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _zone));

        public DateTime ToClinicTime(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => Unspecified(TimeZoneInfo.ConvertTimeFromUtc(value, _zone)),
            DateTimeKind.Local => Unspecified(TimeZoneInfo.ConvertTimeFromUtc(value.ToUniversalTime(), _zone)),
            _ => value
        };

        private static DateTime Unspecified(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Unspecified);
    }
}