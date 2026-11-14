using System.Net;
using System.Text;
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

        var builder = new BodyBuilder { TextBody = body };

        var logo = builder.LinkedResources.Add("logo.png", EmailLogo.Bytes, new ContentType("image", "png"));
        logo.ContentId = MimeKit.Utils.MimeUtils.GenerateMessageId();
        logo.ContentDisposition = new ContentDisposition(ContentDisposition.Inline);

        builder.HtmlBody = EmailHtml.Wrap(subject, body, logo.ContentId);
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

public static class EmailLogo
{
    public static readonly byte[] Bytes = Convert.FromBase64String(
        "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");
}

public static class EmailHtml
{
    private const string Black = "#0b0b0c";
    private const string Red = "#c8102e";

    private static readonly Regex DetailRegex = new(@"^([A-Za-z][A-Za-z ]{1,23}): (.+)$", RegexOptions.Compiled);

    public static string Wrap(string subject, string body, string? logoCid)
    {
        var blocks = body.Replace("\r\n", "\n")
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var content = new StringBuilder();
        var hasCode = false;

        foreach (var block in blocks)
        {
            var lines = block.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (lines.Length > 0 && lines.All(l => DetailRegex.IsMatch(l)))
            {
                content.Append(DetailsTable(lines));
                continue;
            }

            var codeMatch = Regex.Match(block, @"\b\d{6}\b");
            if (codeMatch.Success && block.Contains("code", StringComparison.OrdinalIgnoreCase))
            {
                hasCode = true;
                var before = WebUtility.HtmlEncode(block[..codeMatch.Index]).Replace("\n", "<br>");
                var after = WebUtility.HtmlEncode(block[(codeMatch.Index + 6)..]).Replace("\n", "<br>");
                content.Append(Paragraph(before.Trim().Length > 0 ? before.Trim() : "Your code:"));
                content.Append(CodeBox(codeMatch.Value));
                if (after.Trim().Length > 0 && after.Trim() != ".") content.Append(Paragraph(after.TrimStart('.', ' ')));
                continue;
            }

            content.Append(Paragraph(WebUtility.HtmlEncode(block).Replace("\n", "<br>")));
        }

        var logoCell = logoCid is null
            ? ""
            : $"<td width=\"64\" valign=\"middle\" style=\"padding-right:16px;\"><img src=\"cid:{logoCid}\" width=\"56\" height=\"56\" alt=\"Umbrella Medical Center\" style=\"display:block;border:0;\"></td>";

        var security = hasCode
            ? $"<tr><td style=\"padding:0 32px 24px;\"><div style=\"border-left:4px solid {Red};background:#f7f7f8;padding:12px 16px;font-size:13px;line-height:1.5;color:#3a3a40;\">" +
              "<strong style=\"color:#111113;\">Keep it private.</strong> Umbrella Medical Center staff will never ask you for this code by phone, chat or email.</div></td></tr>"
            : "";

        var year = DateTime.UtcNow.Year;

        return
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
            "<body style=\"margin:0;padding:0;background:#ececee;\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#ececee;padding:24px 12px;\"><tr><td align=\"center\">" +
            "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;\">" +

            $"<tr><td style=\"background:{Black};padding:20px 32px;border-bottom:4px solid {Red};\">" +
            "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>" +
            logoCell +
            "<td valign=\"middle\"><div style=\"color:#ffffff;font-size:20px;font-weight:700;letter-spacing:3px;line-height:1.2;\">UMBRELLA MEDICAL CENTER</div>" +
            "<div style=\"color:#a8a8b0;font-size:11px;letter-spacing:2px;margin-top:4px;\">CARE YOU CAN TRUST</div></td>" +
            "</tr></table></td></tr>" +

            $"<tr><td style=\"padding:32px 32px 8px;\"><h1 style=\"margin:0;font-size:22px;line-height:1.3;color:{Black};\">{WebUtility.HtmlEncode(subject)}</h1>" +
            $"<div style=\"width:48px;height:3px;background:{Red};margin-top:12px;\"></div></td></tr>" +

            "<tr><td style=\"padding:16px 32px 16px;color:#25252a;font-size:15px;line-height:1.6;\">" + content + "</td></tr>" +

            security +

            "<tr><td style=\"background:#f3f3f4;padding:20px 32px;color:#6a6a72;font-size:12px;line-height:1.6;\">" +
            "<strong style=\"color:#3a3a40;\">Umbrella Medical Center</strong><br>" +
            "This is an automated message, please do not reply to it. " +
            "If you did not expect this email, you can safely ignore it.<br>" +
            $"&copy; {year} Umbrella Medical Center</td></tr>" +

            $"<tr><td style=\"background:{Black};height:6px;line-height:6px;font-size:0;\">&nbsp;</td></tr>" +

            "</table></td></tr></table></body></html>";
    }

    private static string Paragraph(string html) =>
        $"<p style=\"margin:0 0 16px;\">{html}</p>";

    private static string CodeBox(string code) =>
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:4px 0 20px;\"><tr>" +
        $"<td style=\"background:{Black};border-bottom:4px solid {Red};border-radius:8px;padding:14px 28px;\">" +
        $"<span style=\"font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#ffffff;\">{code}</span>" +
        "</td></tr></table>";

    private static string DetailsTable(IEnumerable<string> lines)
    {
        var sb = new StringBuilder();
        sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:4px 0 20px;border:1px solid #e3e3e6;border-radius:8px;border-collapse:separate;overflow:hidden;\">");
        var first = true;
        foreach (var line in lines)
        {
            var m = DetailRegex.Match(line);
            var border = first ? "" : "border-top:1px solid #ececee;";
            sb.Append("<tr>");
            sb.Append($"<td width=\"38%\" style=\"{border}background:#f7f7f8;padding:10px 14px;font-size:13px;color:#6a6a72;\">{WebUtility.HtmlEncode(m.Groups[1].Value)}</td>");
            sb.Append($"<td style=\"{border}padding:10px 14px;font-size:14px;font-weight:700;color:#111113;\">{WebUtility.HtmlEncode(m.Groups[2].Value)}</td>");
            sb.Append("</tr>");
            first = false;
        }
        sb.Append("</table>");
        return sb.ToString();
    }
}

public static class EmailTemplates
{
    private static string Nl => Environment.NewLine;

    public static EmailContent VerificationCode(string code) => new(
        "Your Umbrella Medical Center verification code",
        $"Use this code to confirm your email address and finish setting up your account.{Nl}{Nl}Your verification code is {code}.{Nl}{Nl}It expires in {UserTokenService.CodeLifetimeMinutes} minutes. If you did not request it, you can ignore this email.");

    public static EmailContent PasswordResetCode(string code) => new(
        "Reset your Umbrella Medical Center password",
        $"We received a request to reset the password of your account.{Nl}{Nl}Your password reset code is {code}.{Nl}{Nl}It expires in {UserTokenService.CodeLifetimeMinutes} minutes. If you did not request a reset, you can ignore this email and your password will stay the same.");

    public static EmailContent EmailChangeCode(string code) => new(
        "Confirm your new email for Umbrella Medical Center",
        $"Someone asked to use this address for an Umbrella Medical Center account.{Nl}{Nl}Your code to confirm this email address is {code}.{Nl}{Nl}It expires in {UserTokenService.CodeLifetimeMinutes} minutes. If you did not request this change, you can ignore this email.");

    public static EmailContent Welcome(string firstName) => new(
        "Welcome to Umbrella Medical Center",
        $"Hello {firstName}, your account is ready.{Nl}{Nl}You can now find a doctor, book visits online, see your appointment history, prescriptions and documents, and leave reviews after your visits.{Nl}{Nl}We look forward to taking care of you.");

    public static EmailContent AppointmentConfirmed(string patient, string doctor, string service, string when, string room) => new(
        "Your appointment is confirmed",
        $"Hello {patient}, your visit has been booked.{Nl}{Nl}Doctor: {doctor}{Nl}Service: {service}{Nl}Date and time: {when}{Nl}Room: {room}{Nl}{Nl}Please arrive 10 minutes early. You can cancel or reschedule from your account.");

    public static EmailContent AppointmentReminder(string patient, string doctor, string when, string room) => new(
        "Reminder: your appointment is coming up",
        $"Hello {patient}, this is a friendly reminder about your upcoming visit.{Nl}{Nl}Doctor: {doctor}{Nl}Date and time: {when}{Nl}Room: {room}{Nl}{Nl}If you cannot come, please cancel or reschedule so another patient can use the slot.");

    public static EmailContent AppointmentCancelled(string patient, string doctor, string when) => new(
        "Your appointment was cancelled",
        $"Hello {patient}, the following appointment was cancelled.{Nl}{Nl}Doctor: {doctor}{Nl}Date and time: {when}{Nl}{Nl}You can book a new time at any moment from your account.");

    public static EmailContent TimeOffDecision(string doctor, bool approved, string period, string? reason) => new(
        approved ? "Your time-off request was approved" : "Your time-off request was declined",
        $"Hello {doctor}, your request was {(approved ? "approved" : "declined")}.{Nl}{Nl}Period: {period}{Nl}Decision: {(approved ? "Approved" : "Declined")}{(string.IsNullOrWhiteSpace(reason) ? "" : $"{Nl}Reason: {reason}")}");

    public static EmailContent InvoiceIssued(string patient, string number, string total, string due) => new(
        "Your invoice from Umbrella Medical Center",
        $"Hello {patient}, a new invoice was issued for your visit.{Nl}{Nl}Invoice number: {number}{Nl}Total: {total}{Nl}Due date: {due}{Nl}{Nl}You can see the details and payments in your account.");

    public static EmailContent AccountDeactivated(string name, string reason, string date) => new(
        "Your Umbrella Medical Center account has been deactivated",
        $"Hello {name}, we are writing to let you know that your Umbrella Medical Center account has been deactivated. " +
        $"You can no longer log in, book or manage visits online.{Nl}{Nl}" +
        $"Reason: {reason}{Nl}Date: {date}{Nl}{Nl}" +
        $"If you believe this is a mistake, or you would like this decision reviewed, please visit our reception desk or contact the clinic. " +
        $"Please bring a photo ID so we can confirm your identity.{Nl}{Nl}" +
        $"Your medical records are kept safe and have not been deleted.");

    public static EmailContent AccountReactivated(string name) => new(
        "Your Umbrella Medical Center account is active again",
        $"Hello {name}, after reviewing your account we have reactivated it.{Nl}{Nl}" +
        $"You can log in again and book or manage your visits online. Thank you for your patience.");

    public static EmailContent PaymentReceipt(string patient, string number, string amount, string method) => new(
        "Payment received, thank you",
        $"Hello {patient}, we received your payment.{Nl}{Nl}Invoice number: {number}{Nl}Amount paid: {amount}{Nl}Method: {method}{Nl}{Nl}Keep this email as your receipt.");
}