using System.Globalization;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

public static class NotificationText
{
    public static string When(DateTime value) =>
        value.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
}

public interface INotificationService
{
    void Queue(int userId, string title, string message, int? appointmentId = null);
}

public class NotificationService : INotificationService
{
    private readonly UmbrellaDbContext _db;

    public NotificationService(UmbrellaDbContext db)
    {
        _db = db;
    }

    public void Queue(int userId, string title, string message, int? appointmentId = null)
    {
        _db.Notifications.Add(new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Channel = NotificationChannel.InApp,
            Status = NotificationStatus.Sent,
            SentAt = DateTime.UtcNow,
            AppointmentId = appointmentId
        });
    }
}