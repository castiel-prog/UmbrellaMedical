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

/// <summary>Builds texts in one person's language: translations, dates and money.</summary>
public sealed class Localizer
{
    private readonly IClinicText _text;
    private readonly CultureInfo _culture;

    public Localizer(IClinicText text, string? lang)
    {
        _text = text;
        Lang = text.Normalize(lang);
        _culture = text.Culture(Lang);
    }

    public string Lang { get; }

    public CultureInfo Culture => _culture;

    public string T(string text, params (string Key, object? Value)[] args) =>
        _text.T(Lang, text, args.Length == 0 ? null : Args.Of(args));

    /// <summary>"21 November 2026, 10:30" in the person's language.</summary>
    public string When(DateTime value) => value.ToString("d MMMM yyyy, HH:mm", _culture);

    public string Date(DateTime value) => value.ToString("d MMMM yyyy", _culture);

    public string Money(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture) + " GEL";
}

public interface INotificationService
{
    /// <summary>
    /// Adds an in-app notification for the user, written in their saved language: <paramref name="build"/> gets a
    /// localizer for that language and returns the title and message.
    /// </summary>
    void Queue(int userId, Func<Localizer, (string Title, string Message)> build, int? appointmentId = null);

    /// <summary>A localizer for the user's saved language (for emails sent alongside a notification).</summary>
    Localizer For(int userId);
}

public class NotificationService : INotificationService
{
    private readonly UmbrellaDbContext _db;
    private readonly IClinicText _text;

    public NotificationService(UmbrellaDbContext db, IClinicText text)
    {
        _db = db;
        _text = text;
    }

    public Localizer For(int userId) =>
        new(_text, _db.Users.Where(u => u.Id == userId).Select(u => u.PreferredLanguage).FirstOrDefault());

    public void Queue(int userId, Func<Localizer, (string Title, string Message)> build, int? appointmentId = null)
    {
        var (title, message) = build(For(userId));
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
