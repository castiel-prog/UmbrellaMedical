using UmbrellaMedical.Api.Services;
using Xunit;

namespace UmbrellaMedical.Tests;

public class AccountStatusEmailTests
{
    private static readonly Localizer English = new(new EnglishText(), "en");

    [Fact]
    public void Deactivation_email_gives_the_reason_and_asks_to_visit_or_contact_the_clinic()
    {
        var mail = EmailTemplates.AccountDeactivated(English, "Nino", "Repeated missed appointments without cancelling.", "14 November 2026");

        Assert.Contains("deactivated", mail.Subject);
        Assert.Contains("Hello Nino", mail.Body);
        Assert.Contains("Reason: Repeated missed appointments without cancelling.", mail.Body);
        Assert.Contains("Date: 14 November 2026", mail.Body);
        Assert.Contains("visit our reception desk or contact the clinic", mail.Body);
        Assert.Contains("reviewed", mail.Body);
        Assert.Contains("medical records are kept safe", mail.Body);
    }

    [Fact]
    public void Deactivation_email_renders_the_reason_as_a_details_table()
    {
        var mail = EmailTemplates.AccountDeactivated(English, "Nino", "Duplicate account. Already registered under another email.", "14 November 2026");

        var html = EmailHtml.Wrap(mail.Subject, mail.Body, logoCid: null, English);

        Assert.Contains("<table", html);
        Assert.Contains("Duplicate account. Already registered under another email.", html);
    }

    [Fact]
    public void Reactivation_email_says_the_account_works_again()
    {
        var mail = EmailTemplates.AccountReactivated(English, "Nino");

        Assert.Contains("active again", mail.Subject);
        Assert.Contains("log in again", mail.Body);
    }

    [Fact]
    public void Details_table_also_works_with_georgian_labels()
    {
        var html = EmailHtml.Wrap("ტესტი", "გამარჯობა!\n\nმიზეზი: ორმაგი ანგარიში\nთარიღი: 14 ნოემბერი", logoCid: null, English);

        Assert.Contains("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:4px 0 20px;border", html);
        Assert.Contains("ორმაგი ანგარიში", html);
    }

    [Fact]
    public void One_time_codes_are_shown_in_a_code_box_in_any_language()
    {
        var mail = EmailTemplates.VerificationCode(English, "482913");
        var html = EmailHtml.Wrap(mail.Subject, mail.Body, logoCid: null, English);

        Assert.Contains("letter-spacing:10px;color:#ffffff;\">482913</span>", html);
        Assert.DoesNotContain("[[", html);
    }
}