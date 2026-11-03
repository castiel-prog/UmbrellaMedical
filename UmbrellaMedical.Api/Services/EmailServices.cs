using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using UmbrellaMedical.Api.Settings;

namespace UmbrellaMedical.Api.Services;

public record EmailContent(string Subject, string Body);

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}

public class SmtpEmailSender : IEmailSender
{
    private readonly EmailSettings _settings;

    public SmtpEmailSender(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.Username) || string.IsNullOrWhiteSpace(_settings.Password))
            throw new InvalidOperationException("Email:Username and Email:Password are not configured.");

        var fromAddress = string.IsNullOrWhiteSpace(_settings.FromAddress) ? _settings.Username : _settings.FromAddress;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(_settings.Username, _settings.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}

public class DevEmailSender : IEmailSender
{
    private readonly ILogger<DevEmailSender> _logger;

    public DevEmailSender(ILogger<DevEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("DEV EMAIL (not sent) to {To} | {Subject}{NewLine}{Body}", to, subject, Environment.NewLine, body);
        return Task.CompletedTask;
    }
}

public static class EmailTemplates
{
    public static EmailContent VerificationCode(string code) => new(
        "Your Umbrella Medical Center verification code",
        $"Your verification code is {code}.{Environment.NewLine}{Environment.NewLine}It expires in {UserTokenService.CodeLifetimeMinutes} minutes. If you did not request it, you can ignore this email.");

    public static EmailContent PasswordResetCode(string code) => new(
        "Reset your Umbrella Medical Center password",
        $"Your password reset code is {code}.{Environment.NewLine}{Environment.NewLine}It expires in {UserTokenService.CodeLifetimeMinutes} minutes. If you did not request a reset, you can ignore this email and your password will stay the same.");

    public static EmailContent EmailChangeCode(string code) => new(
        "Confirm your new email for Umbrella Medical Center",
        $"Your code to confirm this email address is {code}.{Environment.NewLine}{Environment.NewLine}It expires in {UserTokenService.CodeLifetimeMinutes} minutes. If you did not request this change, you can ignore this email.");
}