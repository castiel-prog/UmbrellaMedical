using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Services;

public static class BillingRules
{
    public static decimal Round(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal InsuranceShare(decimal subtotal, decimal coveragePercent) =>
        Round(subtotal * coveragePercent / 100m);

    public static InvoiceStatus StatusFor(decimal total, decimal paid)
    {
        if (total <= 0 || paid >= total) return InvoiceStatus.Paid;
        if (paid <= 0) return InvoiceStatus.Issued;
        return InvoiceStatus.PartiallyPaid;
    }
}