using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

/// <summary>What a patient pays up front for a visit, after their insurance share.</summary>
public sealed record BookingQuote(
    decimal Price, decimal InsuranceCoverage, decimal AmountDue,
    int? PatientInsuranceId, string? InsuranceCompany, decimal? CoveragePercent);

/// <summary>
/// Paying for a visit when it is booked online: the quote, the paid invoice created with the booking,
/// and the automatic refund when such a visit is cancelled.
/// </summary>
public interface IPrepaidBookingService
{
    Task<BookingQuote> QuoteAsync(int patientId, Service service, DateTime start);

    /// <summary>Creates a paid invoice for a just-booked visit. Saves changes.</summary>
    Task<Invoice> CreatePaidInvoiceAsync(Appointment appointment, Service service, BookingQuote quote, string? chargeReference);

    /// <summary>
    /// Refunds the card payments taken when the visit was booked and cancels its invoice.
    /// Returns the amount refunded (0 if nothing was prepaid). The caller saves changes.
    /// </summary>
    Task<decimal> RefundForCancelledVisitAsync(int appointmentId, CancellationToken cancellationToken = default);
}

public class PrepaidBookingService : IPrepaidBookingService
{
    private const int DueInDays = 0;

    private readonly UmbrellaDbContext _db;
    private readonly IPaymentGateway _gateway;
    private readonly IClinicClock _clock;
    private readonly ILogger<PrepaidBookingService> _logger;

    public PrepaidBookingService(UmbrellaDbContext db, IPaymentGateway gateway, IClinicClock clock, ILogger<PrepaidBookingService> logger)
    {
        _db = db;
        _gateway = gateway;
        _clock = clock;
        _logger = logger;
    }

    public async Task<BookingQuote> QuoteAsync(int patientId, Service service, DateTime start)
    {
        var visitDate = DateOnly.FromDateTime(start);

        // Same rule as invoices: the valid policy with the highest coverage on the visit date.
        var insurance = await _db.PatientInsurances.AsNoTracking()
            .Include(pi => pi.InsuranceCompany)
            .Where(pi => pi.PatientId == patientId
                         && pi.InsuranceCompany.IsActive
                         && pi.ValidFrom <= visitDate
                         && pi.ValidTo >= visitDate)
            .OrderByDescending(pi => pi.CoveragePercent)
            .FirstOrDefaultAsync();

        var price = BillingRules.Round(service.Price);
        var coverage = insurance is null ? 0m : BillingRules.InsuranceShare(price, insurance.CoveragePercent);

        return new BookingQuote(price, coverage, price - coverage,
            insurance?.Id, insurance?.InsuranceCompany.Name, insurance?.CoveragePercent);
    }

    public async Task<Invoice> CreatePaidInvoiceAsync(Appointment appointment, Service service, BookingQuote quote, string? chargeReference)
    {
        var issued = _clock.Now;
        var invoice = new Invoice
        {
            InvoiceNumber = "TMP-" + Guid.NewGuid().ToString("N"),
            IssueDate = issued,
            DueDate = issued.AddDays(DueInDays),
            Status = InvoiceStatus.Paid,
            Subtotal = quote.Price,
            InsuranceCoverage = quote.InsuranceCoverage,
            TotalAmount = quote.AmountDue,
            PatientId = appointment.PatientId,
            AppointmentId = appointment.Id,
            PatientInsuranceId = quote.PatientInsuranceId
        };

        invoice.Items.Add(new InvoiceItem
        {
            Description = service.Name,
            Quantity = 1,
            UnitPrice = quote.Price,
            LineTotal = quote.Price,
            ServiceId = service.Id
        });

        if (quote.AmountDue > 0 && chargeReference is not null)
            invoice.Payments.Add(new Payment
            {
                Amount = quote.AmountDue,
                Method = PaymentMethod.Card,
                Status = PaymentStatus.Completed,
                PaidAt = issued,
                TransactionReference = chargeReference
            });

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync();

        invoice.InvoiceNumber = $"INV-{issued.Year}-{invoice.Id:D6}";
        await _db.SaveChangesAsync();
        return invoice;
    }

    public async Task<decimal> RefundForCancelledVisitAsync(int appointmentId, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.AppointmentId == appointmentId && i.Status != InvoiceStatus.Cancelled, cancellationToken);

        if (invoice is null) return 0m;

        // Only online card payments are refunded automatically; desk payments are handled by staff.
        var cardPayments = invoice.Payments
            .Where(p => p.Status == PaymentStatus.Completed && p.Method == PaymentMethod.Card && p.TransactionReference != null)
            .ToList();

        var refunded = 0m;
        foreach (var payment in cardPayments)
        {
            if (await _gateway.RefundAsync(payment.TransactionReference!, payment.Amount, cancellationToken))
            {
                payment.Status = PaymentStatus.Refunded;
                refunded += payment.Amount;
            }
            else
            {
                _logger.LogError("Refund failed for payment {PaymentId} of appointment {AppointmentId}", payment.Id, appointmentId);
            }
        }

        if (invoice.Payments.All(p => p.Status != PaymentStatus.Completed))
            invoice.Status = InvoiceStatus.Cancelled;

        return refunded;
    }
}
