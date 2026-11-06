using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using UmbrellaMedical.Api.Dtos.Billing;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IAuditService _audit;

    public PaymentsController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit)
    {
        _db = db;
        _current = current;
        _audit = audit;
    }

    public static readonly Expression<Func<Payment, PaymentDto>> Projection = p => new PaymentDto
    {
        Id = p.Id,
        InvoiceId = p.InvoiceId,
        InvoiceNumber = p.Invoice.InvoiceNumber,
        PatientId = p.Invoice.PatientId,
        PatientName = p.Invoice.Patient.FirstName + " " + p.Invoice.Patient.LastName,
        Amount = p.Amount,
        Method = p.Method,
        Status = p.Status,
        PaidAt = p.PaidAt,
        TransactionReference = p.TransactionReference,
        CreatedAt = p.CreatedAt
    };

    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<PagedResult<PaymentDto>>> GetAll(
        [FromQuery] int? invoiceId, [FromQuery] int? patientId,
        [FromQuery] PaymentMethod? method, [FromQuery] PaymentStatus? status,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Payments.AsNoTracking().AsQueryable();

        if (invoiceId is not null) query = query.Where(p => p.InvoiceId == invoiceId);
        if (patientId is not null) query = query.Where(p => p.Invoice.PatientId == patientId);
        if (method is not null) query = query.Where(p => p.Method == method);
        if (status is not null) query = query.Where(p => p.Status == status);

        if (from is not null)
        {
            var fromDate = from.Value.ToDateTime(TimeOnly.MinValue);
            query = query.Where(p => p.CreatedAt >= fromDate);
        }
        if (to is not null)
        {
            var toDate = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
            query = query.Where(p => p.CreatedAt < toDate);
        }

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(Projection)
            .ToListAsync();

        return Ok(new PagedResult<PaymentDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpGet("{id:int}/receipt")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<ReceiptDto>> GetReceipt(int id)
    {
        var payment = await _db.Payments.AsNoTracking()
            .Include(p => p.Invoice).ThenInclude(i => i.Patient)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (payment is null) return NotFound();

        if (_current.Role == "Patient" && payment.Invoice.PatientId != await _current.GetPatientIdAsync())
            return Forbid();

        if (payment.Status != PaymentStatus.Completed)
            return Problem(
                detail: "Receipts are available only for completed payments.",
                statusCode: StatusCodes.Status409Conflict,
                title: "No receipt");

        return Ok(new ReceiptDto
        {
            ReceiptNumber = $"RCT-{payment.Id:D6}",
            ClinicName = "Umbrella Medical Center",
            PaidAt = payment.PaidAt,
            PatientName = payment.Invoice.Patient.FirstName + " " + payment.Invoice.Patient.LastName,
            InvoiceNumber = payment.Invoice.InvoiceNumber,
            Amount = payment.Amount,
            Method = payment.Method,
            TransactionReference = payment.TransactionReference
        });
    }

    [HttpPost("{id:int}/refund")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PaymentDto>> Refund(int id, RefundPaymentRequest request)
    {
        var payment = await _db.Payments
            .Include(p => p.Invoice).ThenInclude(i => i.Payments)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (payment is null) return NotFound();

        if (payment.Status != PaymentStatus.Completed)
            return Problem(
                detail: "Only completed payments can be refunded.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Cannot refund");

        payment.Status = PaymentStatus.Refunded;

        var invoice = payment.Invoice;
        if (invoice.Status != InvoiceStatus.Cancelled)
        {
            var paid = invoice.Payments.Where(p => p.Status == PaymentStatus.Completed).Sum(p => p.Amount);
            invoice.Status = BillingRules.StatusFor(invoice.TotalAmount, paid);
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync("RefundedPayment", nameof(Payment), id, request.Reason.Trim());

        var dto = await _db.Payments.AsNoTracking().Where(p => p.Id == id).Select(Projection).FirstAsync();
        return Ok(dto);
    }
}