using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Enums;
using Xunit;

namespace UmbrellaMedical.Tests;

public class BillingRulesTests
{
    [Theory]
    [InlineData(40, 80, 32.00)]
    [InlineData(65, 80, 52.00)]
    [InlineData(100, 0, 0.00)]
    [InlineData(100, 100, 100.00)]
    [InlineData(33.33, 50, 16.67)]
    public void Insurance_share_is_calculated_and_rounded(double subtotal, double percent, double expected)
    {
        var share = BillingRules.InsuranceShare((decimal)subtotal, (decimal)percent);

        Assert.Equal((decimal)expected, share);
    }

    [Theory]
    [InlineData(8, 0, InvoiceStatus.Issued)]
    [InlineData(8, 5, InvoiceStatus.PartiallyPaid)]
    [InlineData(8, 8, InvoiceStatus.Paid)]
    [InlineData(8, 9, InvoiceStatus.Paid)]
    [InlineData(0, 0, InvoiceStatus.Paid)]
    public void Invoice_status_follows_the_amount_paid(double total, double paid, InvoiceStatus expected)
    {
        var status = BillingRules.StatusFor((decimal)total, (decimal)paid);

        Assert.Equal(expected, status);
    }

    [Fact]
    public void Rounding_goes_away_from_zero()
    {
        Assert.Equal(0.03m, BillingRules.Round(0.025m));
        Assert.Equal(0.02m, BillingRules.Round(0.024m));
    }
}