using System.Net;
using System.Text.RegularExpressions;
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

        var builder = new BodyBuilder
        {
            TextBody = body,
            HtmlBody = EmailHtml.Wrap(body)
        };
        message.Body = builder.ToMessageBody();

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

public static class EmailHtml
{
    private const string CodeStyle =
        "display:inline-block;margin:8px 0;padding:8px 18px;background:#0b0b0c;color:#ffffff;" +
        "font-size:26px;letter-spacing:6px;font-weight:700;border-radius:6px;";

    public static string Wrap(string body)
    {
        var encoded = WebUtility.HtmlEncode(body);

        var highlighted = Regex.Replace(
            encoded,
            @"\b\d{6}\b",
            match => $"<span style=\"{CodeStyle}\">{match.Value}</span>");

        var paragraphs = highlighted
            .Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => "<p style=\"margin:0 0 14px;\">" + p.Replace("\r\n", "<br>").Replace("\n", "<br>") + "</p>");

        return
            "<div style=\"background:#f3f3f4;padding:24px;font-family:Arial,Helvetica,sans-serif;\">" +
            "<div style=\"max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;\">" +
            "<div style=\"background:#0b0b0c;padding:16px 24px;border-bottom:4px solid #c8102e;\">" +
            "<span style=\"color:#ffffff;font-size:18px;font-weight:700;letter-spacing:3px;\">UMBRELLA MEDICAL CENTER</span>" +
            "</div>" +
            "<div style=\"padding:24px;color:#111113;font-size:15px;line-height:1.5;\">" + string.Concat(paragraphs) + "</div>" +
            "<div style=\"padding:12px 24px;background:#f3f3f4;color:#5c5c63;font-size:12px;\">This is an automated message. Please do not reply.</div>" +
            "</div></div>";
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