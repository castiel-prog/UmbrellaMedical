using UmbrellaMedical.Api.Services;
using Xunit;

namespace UmbrellaMedical.Tests;

public class AccountStatusEmailTests
{
    [Fact]
    public void Deactivation_email_gives_the_reason_and_asks_to_visit_or_contact_the_clinic()
    {
        var mail = EmailTemplates.AccountDeactivated("Nino", "Repeated missed appointments without cancelling.", "14 November 2026");

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
        var mail = EmailTemplates.AccountDeactivated("Nino", "Duplicate account. Already registered under another email.", "14 November 2026");

        var html = EmailHtml.Wrap(mail.Subject, mail.Body, logoCid: null);

        Assert.Contains("<table", html);
        Assert.Contains("Duplicate account. Already registered under another email.", html);
    }

    [Fact]
    public void Reactivation_email_says_the_account_works_again()
    {
        var mail = EmailTemplates.AccountReactivated("Nino");

        Assert.Contains("active again", mail.Subject);
        Assert.Contains("log in again", mail.Body);
    }
}
