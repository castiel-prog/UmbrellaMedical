using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using UmbrellaMedical.Api.Settings;

namespace UmbrellaMedical.Api.Services;

/// <summary>A ready email. A one-time code in the body is written as [[123456]] and shown in a code box.</summary>
public record EmailContent(string Subject, string Body, string Lang = "en");

public interface IEmailSender
{
    /// <summary>Sends an email; <paramref name="lang"/> is the reader's language for the email's frame (header, footer).</summary>
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default, string? lang = null);
}

public class SmtpEmailSender : IEmailSender
{
    private readonly EmailSettings _settings;
    private readonly IClinicText _text;

    public SmtpEmailSender(IOptions<EmailSettings> options, IClinicText text)
    {
        _settings = options.Value;
        _text = text;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default, string? lang = null)
    {
        if (string.IsNullOrWhiteSpace(_settings.Username) || string.IsNullOrWhiteSpace(_settings.Password))
            throw new InvalidOperationException("Email:Username and Email:Password are not configured.");

        var fromAddress = string.IsNullOrWhiteSpace(_settings.FromAddress) ? _settings.Username : _settings.FromAddress;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;

        var builder = new BodyBuilder { TextBody = body.Replace("[[", "").Replace("]]", "") };

        var logo = builder.LinkedResources.Add("logo.png", EmailLogo.Bytes, new ContentType("image", "png"));
        logo.ContentId = MimeKit.Utils.MimeUtils.GenerateMessageId();
        logo.ContentDisposition = new ContentDisposition(ContentDisposition.Inline);

        builder.HtmlBody = EmailHtml.Wrap(subject, body, logo.ContentId, new Localizer(_text, lang));
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

    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default, string? lang = null)
    {
        _logger.LogWarning("DEV EMAIL (not sent) to {To} | {Subject}{NewLine}{Body}", to, subject, Environment.NewLine, body);
        return Task.CompletedTask;
    }
}

public static class EmailLogo
{
    // The Umbrella logo (5-panel umbrella), 224x224 PNG with a transparent background. Used in emails and PDFs.
    public static readonly byte[] Bytes = Convert.FromBase64String(
        "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" +
        "AwcO0uDBQ6Q51TPPPCuJk9euXUs1ji8CH3nkEerYsaOBVJcunSl//vwGuK8BKCOWVKDsKV36MRoyZCgdPHgo1WRQl0OGDKbDh/8J" +
        "Gzt2TKtHHim4net8NS/f1E414n0QeL8yYBjPS1pGR8dsr1y54hrWOj61f/8+euONbhQdHe2w2aGlHD9+PFWrVk0ycJ85c8Yhvj8C" +
        "qlatYko2PDycfCmKmiaiA6I+xo0bR1WrVpXE1QkTJqSqZWWmY2XQGzy33Mda4zlPV6hQ8TceEdlEP6cjfd94w+6bkqYUlBmvanR0" +
        "zJbnn2+59Ndff6n822+b6Pnnnyd04BQUg7Vs2TJJOwktJUY9jH4GpAABIiMjHaaUOXOMwzB/B+zff4A+/HCwJBFAk4s6c5Qm6rpl" +
        "y+dpy5bNrN1dVbtFi+dXcJtsQ9s4inOvwu8bBuTGLRATEzO3fPkK2zZv/r0aq82pVq1aDtv19u3b0mL644+Xo5deepnnXL85xA0F" +
        "aGsAa5moM9Td7Nmz6c6dO1oElQ9tgLZAm6BteJScg7ZSodzTzrB7unS2wkWzmDM0W7bs/0yZMuWl33//TZQvX94WYvKPNTXszcR6" +
        "We/eb9Lx48dNsEIgV2oAdderV28qUaKktN81NS0w2gRtw2uSL6OtuNEGcxqO5wMceC889zIDClawvBQdHfNPp06vDfnrr73Rr732" +
        "GoWFmRcZneXtt9+WOsvw4SMI6vh7oYHTQhlQl6hTMCKWN7BpwCxfaJvXX3+d9u7dE92hQ8dhaLtMmWJeYFzB5p58zHtjOi8qizCY" +
        "522tWLH8XBZtCkyZMply5MhhWqrt27dLi9DlypWnmTM/J4iepoghoNc1kJCQQFjgL1v2cWmxf+fOnWT2y5kzJ02fPo02btxQoGzZ" +
        "Mt8yI25Fm5rhpnfYPcWA3EgFeA4xN2vWbNt4/akaFCwQbcwa6dSpU9S+/QtUv/6T0jYsZ2taZjRCMM9qAHWNjQl169ajF154kaBN" +
        "NaNUuXJl2rp1C7F2tRralNvW8/mhWQJpAHbPMGB0dHRFIcK28EL4S3v27BYQZSDS6OsYCgHM8SpWrEQ///yzPjjkD3AN/PTTT1S+" +
        "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" +
        "AEY2DwpPtgB8AAAAAElFTkSuQmCC");
}

public static class EmailHtml
{
    private const string Black = "#0b0b0c";
    private const string Red = "#c8102e";

    // "Label: value" lines become a table; labels may be in any alphabet (Georgian, Cyrillic...).
    private static readonly Regex DetailRegex = new(@"^(\p{L}[\p{L} ]{1,30}): (.+)$", RegexOptions.Compiled);

    public static string Wrap(string subject, string body, string? logoCid, Localizer l)
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

            var codeMatch = Regex.Match(block, @"\[\[(\d{4,8})\]\]");
            if (codeMatch.Success)
            {
                hasCode = true;
                var before = WebUtility.HtmlEncode(block[..codeMatch.Index]).Replace("\n", "<br>");
                var after = WebUtility.HtmlEncode(block[(codeMatch.Index + codeMatch.Length)..]).Replace("\n", "<br>");
                content.Append(Paragraph(before.Trim().Length > 0 ? before.Trim() : WebUtility.HtmlEncode(l.T("Your code:"))));
                content.Append(CodeBox(codeMatch.Groups[1].Value));
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
              $"<strong style=\"color:#111113;\">{WebUtility.HtmlEncode(l.T("Keep it private."))}</strong> {WebUtility.HtmlEncode(l.T("Umbrella Medical Center staff will never ask you for this code by phone, chat or email."))}</div></td></tr>"
            : "";

        var year = DateTime.UtcNow.Year;

        return
            $"<!DOCTYPE html><html lang=\"{l.Lang}\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
            "<body style=\"margin:0;padding:0;background:#ececee;\">" +
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#ececee;padding:24px 12px;\"><tr><td align=\"center\">" +
            "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;\">" +

            $"<tr><td style=\"background:{Black};padding:20px 32px;border-bottom:4px solid {Red};\">" +
            "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>" +
            logoCell +
            "<td valign=\"middle\"><div style=\"color:#ffffff;font-size:20px;font-weight:700;letter-spacing:3px;line-height:1.2;\">UMBRELLA MEDICAL CENTER</div>" +
            $"<div style=\"color:#a8a8b0;font-size:11px;letter-spacing:2px;margin-top:4px;\">{WebUtility.HtmlEncode(l.T("CARE YOU CAN TRUST"))}</div></td>" +
            "</tr></table></td></tr>" +

            $"<tr><td style=\"padding:32px 32px 8px;\"><h1 style=\"margin:0;font-size:22px;line-height:1.3;color:{Black};\">{WebUtility.HtmlEncode(subject)}</h1>" +
            $"<div style=\"width:48px;height:3px;background:{Red};margin-top:12px;\"></div></td></tr>" +

            "<tr><td style=\"padding:16px 32px 16px;color:#25252a;font-size:15px;line-height:1.6;\">" + content + "</td></tr>" +

            security +

            "<tr><td style=\"background:#f3f3f4;padding:20px 32px;color:#6a6a72;font-size:12px;line-height:1.6;\">" +
            "<strong style=\"color:#3a3a40;\">Umbrella Medical Center</strong><br>" +
            WebUtility.HtmlEncode(l.T("This is an automated message, please do not reply to it. If you did not expect this email, you can safely ignore it.")) + "<br>" +
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

/// <summary>The clinic's emails, written in the reader's language (see SeedData/i18n).</summary>
public static class EmailTemplates
{
    private const string Nl = "\n";
    private static int Minutes => UserTokenService.CodeLifetimeMinutes;

    public static EmailContent VerificationCode(Localizer l, string code) => new(
        l.T("Your Umbrella Medical Center verification code"),
        l.T("Use this code to confirm your email address and finish setting up your account.") + Nl + Nl +
        l.T("Your verification code is {code}.", ("code", $"[[{code}]]")) + Nl + Nl +
        l.T("It expires in {minutes} minutes. If you did not request it, you can ignore this email.", ("minutes", Minutes)), l.Lang);

    public static EmailContent PasswordResetCode(Localizer l, string code) => new(
        l.T("Reset your Umbrella Medical Center password"),
        l.T("We received a request to reset the password of your account.") + Nl + Nl +
        l.T("Your password reset code is {code}.", ("code", $"[[{code}]]")) + Nl + Nl +
        l.T("It expires in {minutes} minutes. If you did not request a reset, you can ignore this email and your password will stay the same.", ("minutes", Minutes)), l.Lang);

    public static EmailContent EmailChangeCode(Localizer l, string code) => new(
        l.T("Confirm your new email for Umbrella Medical Center"),
        l.T("Someone asked to use this address for an Umbrella Medical Center account.") + Nl + Nl +
        l.T("Your code to confirm this email address is {code}.", ("code", $"[[{code}]]")) + Nl + Nl +
        l.T("It expires in {minutes} minutes. If you did not request this change, you can ignore this email.", ("minutes", Minutes)), l.Lang);

    public static EmailContent Welcome(Localizer l, string firstName) => new(
        l.T("Welcome to Umbrella Medical Center"),
        l.T("Hello {name}, your account is ready.", ("name", firstName)) + Nl + Nl +
        l.T("You can now find a doctor, book visits online, see your appointment history, prescriptions and documents, and leave reviews after your visits.") + Nl + Nl +
        l.T("We look forward to taking care of you."), l.Lang);

    public static EmailContent AppointmentConfirmed(Localizer l, string patient, string doctor, string service, string when, string room) => new(
        l.T("Your appointment is confirmed"),
        l.T("Hello {name}, your visit has been booked.", ("name", patient)) + Nl + Nl +
        l.T("Doctor") + ": " + doctor + Nl + l.T("Service") + ": " + service + Nl + l.T("Date and time") + ": " + when + Nl + l.T("Room") + ": " + room + Nl + Nl +
        l.T("Please arrive 10 minutes early. You can cancel or reschedule from your account."), l.Lang);

    public static EmailContent AppointmentReminder(Localizer l, string patient, string doctor, string service, string when) => new(
        l.T("Reminder: your appointment is coming up"),
        l.T("Hello {name}, this is a friendly reminder about your upcoming visit.", ("name", patient)) + Nl + Nl +
        l.T("Doctor") + ": " + doctor + Nl + l.T("Service") + ": " + service + Nl + l.T("Date and time") + ": " + when + Nl + Nl +
        l.T("If you cannot come, please cancel or reschedule so another patient can use the slot."), l.Lang);

    public static EmailContent AppointmentCancelled(Localizer l, string patient, string doctor, string when) => new(
        l.T("Your appointment was cancelled"),
        l.T("Hello {name}, the following appointment was cancelled.", ("name", patient)) + Nl + Nl +
        l.T("Doctor") + ": " + doctor + Nl + l.T("Date and time") + ": " + when + Nl + Nl +
        l.T("You can book a new time at any moment from your account."), l.Lang);

    public static EmailContent TimeOffDecision(Localizer l, string doctor, bool approved, string period, string? reason) => new(
        approved ? l.T("Your time-off request was approved") : l.T("Your time-off request was declined"),
        (approved ? l.T("Hello {name}, your request was approved.", ("name", doctor)) : l.T("Hello {name}, your request was declined.", ("name", doctor))) + Nl + Nl +
        l.T("Period") + ": " + period + Nl + l.T("Decision") + ": " + (approved ? l.T("Approved") : l.T("Declined")) +
        (string.IsNullOrWhiteSpace(reason) ? "" : Nl + l.T("Reason") + ": " + reason), l.Lang);

    public static EmailContent InvoiceIssued(Localizer l, string patient, string number, string total, string due) => new(
        l.T("Your invoice from Umbrella Medical Center"),
        l.T("Hello {name}, a new invoice was issued for your visit.", ("name", patient)) + Nl + Nl +
        l.T("Invoice number") + ": " + number + Nl + l.T("Total") + ": " + total + Nl + l.T("Due date") + ": " + due + Nl + Nl +
        l.T("You can see the details and payments in your account."), l.Lang);

    public static EmailContent AccountDeactivated(Localizer l, string name, string reason, string date) => new(
        l.T("Your Umbrella Medical Center account has been deactivated"),
        l.T("Hello {name}, we are writing to let you know that your Umbrella Medical Center account has been deactivated. You can no longer log in, book or manage visits online.", ("name", name)) + Nl + Nl +
        l.T("Reason") + ": " + reason + Nl + l.T("Date") + ": " + date + Nl + Nl +
        l.T("If you believe this is a mistake, or you would like this decision reviewed, please visit our reception desk or contact the clinic. Please bring a photo ID so we can confirm your identity.") + Nl + Nl +
        l.T("Your medical records are kept safe and have not been deleted."), l.Lang);

    public static EmailContent AccountReactivated(Localizer l, string name) => new(
        l.T("Your Umbrella Medical Center account is active again"),
        l.T("Hello {name}, after reviewing your account we have reactivated it.", ("name", name)) + Nl + Nl +
        l.T("You can log in again and book or manage your visits online. Thank you for your patience."), l.Lang);

    public static EmailContent PaymentReceipt(Localizer l, string patient, string number, string amount, string method) => new(
        l.T("Payment received, thank you"),
        l.T("Hello {name}, we received your payment.", ("name", patient)) + Nl + Nl +
        l.T("Invoice number") + ": " + number + Nl + l.T("Amount paid") + ": " + amount + Nl + l.T("Method") + ": " + method + Nl + Nl +
        l.T("Keep this email as your receipt."), l.Lang);
}