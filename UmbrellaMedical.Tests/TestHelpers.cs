using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Tests;

public static class TestDb
{
    public static UmbrellaDbContext Create()
    {
        var options = new DbContextOptionsBuilder<UmbrellaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new UmbrellaDbContext(options);
    }
}

public class FakeClock : IClinicClock
{
    public FakeClock(DateTime now)
    {
        Now = now;
    }

    public DateTime Now { get; set; }

    public DateTime ToClinicTime(DateTime value) => value;
}

public class FakeEmailSender : IEmailSender
{
    public List<(string To, string Subject, string Body)> Sent { get; } = new();

    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        Sent.Add((to, subject, body));
        return Task.CompletedTask;
    }
}

public class FailingEmailSender : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("The mail server is down.");
}