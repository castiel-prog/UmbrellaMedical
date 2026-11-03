using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services
{

    public interface IAuditService
    {
        Task LogAsync(string action, string entityName, int? entityId, string? details = null);
    }

    public class AuditService : IAuditService
    {
        private readonly UmbrellaDbContext _db;
        private readonly ICurrentUser _current;
        private readonly IHttpContextAccessor _accessor;

        public AuditService(UmbrellaDbContext db, ICurrentUser current, IHttpContextAccessor accessor)
        {
            _db = db;
            _current = current;
            _accessor = accessor;
        }

        public async Task LogAsync(string action, string entityName, int? entityId, string? details = null)
        {
            _db.AuditLogs.Add(new AuditLog
            {
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                Details = details,
                UserId = _current.UserId,
                IpAddress = _accessor.HttpContext?.Connection.RemoteIpAddress?.ToString()
            });

            await _db.SaveChangesAsync();
        }
    }
}