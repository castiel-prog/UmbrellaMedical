using Microsoft.Extensions.Options;
using UmbrellaMedical.Api.Settings;

namespace UmbrellaMedical.Api.Services;

public class AppointmentReminderWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ReminderSettings _settings;
    private readonly ILogger<AppointmentReminderWorker> _logger;

    public AppointmentReminderWorker(
        IServiceScopeFactory scopes, IOptions<ReminderSettings> options, ILogger<AppointmentReminderWorker> logger)
    {
        _scopes = scopes;
        _settings = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_settings.Enabled)
        {
            _logger.LogInformation("Appointment reminders are disabled.");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, _settings.CheckIntervalMinutes));

        try
        {
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

            using var timer = new PeriodicTimer(interval);

            do
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var reminders = scope.ServiceProvider.GetRequiredService<IReminderService>();
                    var sent = await reminders.SendDueRemindersAsync(stoppingToken);

                    if (sent > 0)
                        _logger.LogInformation("Sent {Count} appointment reminder(s).", sent);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "The reminder job failed and will try again at the next cycle.");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
        }
    }
}