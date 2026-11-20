using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// Emails a copy of new in-app notifications to people who turned on "Email me my notifications" in their profile.
/// Each notification is handled once (EmailedAt is set even when no email is wanted), and only fresh ones are sent,
/// so turning the setting on never floods anyone with old messages.
/// </summary>
public class NotificationEmailWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan MaxAge = TimeSpan.FromMinutes(30);
    private const int BatchSize = 50;

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<NotificationEmailWorker> _logger;

    public NotificationEmailWorker(IServiceScopeFactory scopes, ILogger<NotificationEmailWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
            using var timer = new PeriodicTimer(Interval);
            do
            {
                try { await SendBatchAsync(stoppingToken); }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception ex) { _logger.LogError(ex, "The notification email job failed and will try again."); }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) { }
    }

    private async Task SendBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<UmbrellaDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailSender>();

        var now = DateTime.UtcNow;
        var pending = await db.Notifications
            .Include(n => n.User)
            .Where(n => n.EmailedAt == null)
            .OrderBy(n => n.Id)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);
        if (pending.Count == 0) return;

        var sent = 0;
        foreach (var n in pending)
        {
            var fresh = n.SentAt is DateTime at && now - at <= MaxAge;
            if (fresh && n.User.EmailNotifications && n.User.IsActive)
            {
                try
                {
                    await email.SendAsync(n.User.Email, n.Title + " - Umbrella Medical Center",
                        n.Message + Environment.NewLine + Environment.NewLine +
                        "You get these emails because you turned on \"Email me my notifications\". You can turn them off in My profile.",
                        cancellationToken);
                    sent++;
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex) { _logger.LogWarning(ex, "Could not email notification {NotificationId}.", n.Id); }
            }
            n.EmailedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        if (sent > 0) _logger.LogInformation("Emailed {Count} notification(s).", sent);
    }
}
