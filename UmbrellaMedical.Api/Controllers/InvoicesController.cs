using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Globalization;
using System.Linq.Expressions;
using UmbrellaMedical.Api.Dtos.Billing;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private const int DueInDays = 14;

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public InvoicesController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit, IClinicClock clock)
    {
        _db = db;
        _current = current;
        _audit = audit;
        _clock = clock;
    }

    private static readonly Expression<Func<Invoice, InvoiceListItemDto>> ListProjection = i => new InvoiceListItemDto
    {
        Id = i.Id,
        InvoiceNumber = i.InvoiceNumber,
        IssueDate = i.IssueDate,
        DueDate = i.DueDate,
        Status = i.Status,
        PatientId = i.PatientId,
        PatientName = i.Patient.FirstName + " " + i.Patient.LastName,
        AppointmentId = i.AppointmentId,
        Subtotal = i.Subtotal,
        InsuranceCoverage = i.InsuranceCoverage,
        TotalAmount = i.TotalAmount,
        PaidAmount = i.Payments.Where(p => p.Status == PaymentStatus.Completed).Sum(p => (decimal?)p.Amount) ?? 0m
    };

    private static readonly Expression<Func<Invoice, InvoiceDto>> DetailProjection = i => new InvoiceDto
    {
        Id = i.Id,
        InvoiceNumber = i.InvoiceNumber,
        IssueDate = i.IssueDate,
        DueDate = i.DueDate,
        Status = i.Status,
        PatientId = i.PatientId,
        PatientName = i.Patient.FirstName + " " + i.Patient.LastName,
        AppointmentId = i.AppointmentId,
        Subtotal = i.Subtotal,
        InsuranceCoverage = i.InsuranceCoverage,
        TotalAmount = i.TotalAmount,
        PaidAmount = i.Payments.Where(p => p.Status == PaymentStatus.Completed).Sum(p => (decimal?)p.Amount) ?? 0m,
        InsuranceCompany = i.PatientInsurance != null ? i.PatientInsurance.InsuranceCompany.Name : null,
        PolicyNumber = i.PatientInsurance != null ? i.PatientInsurance.PolicyNumber : null,
        CoveragePercent = i.PatientInsurance != null ? i.PatientInsurance.CoveragePercent : (decimal?)null,
        Items = i.Items
            .OrderBy(x => x.Id)
            .Select(x => new InvoiceItemDto
            {
                Id = x.Id,
                Description = x.Description,
                Quantity = x.Quantity,
                UnitPrice = x.UnitPrice,
                LineTotal = x.LineTotal,
                ServiceId = x.ServiceId
            })
            .ToList(),
        Payments = i.Payments
            .OrderBy(p => p.Id)
            .Select(p => new PaymentDto
            {
                Id = p.Id,
                InvoiceId = p.InvoiceId,
                InvoiceNumber = i.InvoiceNumber,
                PatientId = i.PatientId,
                PatientName = i.Patient.FirstName + " " + i.Patient.LastName,
                Amount = p.Amount,
                Method = p.Method,
                Status = p.Status,
                PaidAt = p.PaidAt,
                TransactionReference = p.TransactionReference,
                CreatedAt = p.CreatedAt
            })
            .ToList()
    };

    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<PagedResult<InvoiceListItemDto>>> GetAll(
        [FromQuery] int? patientId, [FromQuery] InvoiceStatus? status, [FromQuery] string? search,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Invoices.AsNoTracking().AsQueryable();

        if (_current.Role == "Patient")
        {
            var ownId = await _current.GetPatientIdAsync();
            if (ownId is null) return Forbid();
            query = query.Where(i => i.PatientId == ownId.Value);
        }
        else if (patientId is not null)
        {
            query = query.Where(i => i.PatientId == patientId);
        }

        if (status is not null) query = query.Where(i => i.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i => i.InvoiceNumber.ToLower().Contains(term)
                                     || i.Patient.FirstName.ToLower().Contains(term)
                                     || i.Patient.LastName.ToLower().Contains(term));
        }

        if (from is not null)
        {
            var fromDate = from.Value.ToDateTime(TimeOnly.MinValue);
            query = query.Where(i => i.IssueDate >= fromDate);
        }
        if (to is not null)
        {
            var toDate = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
            query = query.Where(i => i.IssueDate < toDate);
        }

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(i => i.IssueDate).ThenByDescending(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ListProjection)
            .ToListAsync();

        return Ok(new PagedResult<InvoiceListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<InvoiceDto>> GetById(int id)
    {
        var patientId = await _db.Invoices.AsNoTracking()
            .Where(i => i.Id == id)
            .Select(i => (int?)i.PatientId)
            .FirstOrDefaultAsync();

        if (patientId is null) return NotFound();
        if (!await CanViewAsync(patientId.Value)) return Forbid();

        return Ok(await LoadDetailAsync(id));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<InvoiceDto>> Create(CreateInvoiceRequest request)
    {
        var appointment = await _db.Appointments.AsNoTracking()
            .Include(a => a.Service)
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId);

        if (appointment is null)
            return Invalid(nameof(request.AppointmentId), "This appointment does not exist.");

        if (appointment.Status != AppointmentStatus.Completed)
            return Problem(
                detail: "Only completed appointments can be invoiced.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Appointment not completed");

        var visitDate = DateOnly.FromDateTime(appointment.StartDateTime);
        PatientInsurance? insurance = null;

        if (request.UseInsurance)
        {
            if (request.PatientInsuranceId is not null)
            {
                insurance = await _db.PatientInsurances.AsNoTracking()
                    .Include(pi => pi.InsuranceCompany)
                    .FirstOrDefaultAsync(pi => pi.Id == request.PatientInsuranceId && pi.PatientId == appointment.PatientId);

                if (insurance is null
                    || !insurance.InsuranceCompany.IsActive
                    || insurance.ValidFrom > visitDate
                    || insurance.ValidTo < visitDate)
                {
                    return Invalid(nameof(request.PatientInsuranceId),
                        "This policy does not belong to the patient, or it was not valid on the visit date.");
                }
            }
            else
            {
                insurance = await _db.PatientInsurances.AsNoTracking()
                    .Include(pi => pi.InsuranceCompany)
                    .Where(pi => pi.PatientId == appointment.PatientId
                                 && pi.InsuranceCompany.IsActive
                                 && pi.ValidFrom <= visitDate
                                 && pi.ValidTo >= visitDate)
                    .OrderByDescending(pi => pi.CoveragePercent)
                    .FirstOrDefaultAsync();
            }
        }

        var lines = new List<InvoiceItem>
        {
            new()
            {
                Description = appointment.Service.Name,
                Quantity = 1,
                UnitPrice = appointment.Service.Price,
                LineTotal = BillingRules.Round(appointment.Service.Price),
                ServiceId = appointment.ServiceId
            }
        };

        foreach (var extra in request.ExtraItems ?? new List<InvoiceItemRequest>())
        {
            if (decimal.Round(extra.UnitPrice, 2) != extra.UnitPrice)
                return Invalid("extraItems", "Prices can have at most two decimal places.");

            lines.Add(new InvoiceItem
            {
                Description = extra.Description.Trim(),
                Quantity = extra.Quantity,
                UnitPrice = extra.UnitPrice,
                LineTotal = BillingRules.Round(extra.UnitPrice * extra.Quantity)
            });
        }

        var subtotal = lines.Sum(l => l.LineTotal);
        var coverage = insurance is null ? 0m : BillingRules.InsuranceShare(subtotal, insurance.CoveragePercent);
        var total = subtotal - coverage;
        var issued = _clock.Now;
        int newId;

        try
        {
            await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            var alreadyInvoiced = await _db.Invoices
                .AnyAsync(i => i.AppointmentId == appointment.Id && i.Status != InvoiceStatus.Cancelled);

            if (alreadyInvoiced)
                return Problem(
                    detail: "This appointment already has an active invoice.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Already invoiced");

            var invoice = new Invoice
            {
                InvoiceNumber = "TMP-" + Guid.NewGuid().ToString("N"),
                IssueDate = issued,
                DueDate = issued.AddDays(DueInDays),
                Status = BillingRules.StatusFor(total, 0m),
                Subtotal = subtotal,
                InsuranceCoverage = coverage,
                TotalAmount = total,
                PatientId = appointment.PatientId,
                AppointmentId = appointment.Id,
                PatientInsuranceId = insurance?.Id
            };

            foreach (var line in lines) invoice.Items.Add(line);

            _db.Invoices.Add(invoice);
            await _db.SaveChangesAsync();

            invoice.InvoiceNumber = $"INV-{issued.Year}-{invoice.Id:D6}";
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
            newId = invoice.Id;
        }
        catch (Exception ex) when (DbConflicts.IsTransientConflict(ex))
        {
            return Problem(
                detail: "Another change was happening at the same time. Please try again.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Please retry");
        }

        await _audit.LogAsync("CreatedInvoice", nameof(Invoice), newId);
        return CreatedAtAction(nameof(GetById), new { id = newId }, await LoadDetailAsync(newId));
    }

    [HttpPost("{id:int}/payments")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<PaymentDto>> AddPayment(int id, CreatePaymentRequest request)
    {
        var amount = request.Amount;
        if (decimal.Round(amount, 2) != amount)
            return Invalid(nameof(request.Amount), "The amount can have at most two decimal places.");

        var reference = string.IsNullOrWhiteSpace(request.Reference)
            ? "PAY-" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant()
            : request.Reference.Trim();

        int paymentId;

        try
        {
            await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            var invoice = await _db.Invoices.Include(i => i.Payments).FirstOrDefaultAsync(i => i.Id == id);
            if (invoice is null) return NotFound();

            if (invoice.Status == InvoiceStatus.Cancelled)
                return Problem(
                    detail: "This invoice was cancelled.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Invoice cancelled");

            var paid = invoice.Payments.Where(p => p.Status == PaymentStatus.Completed).Sum(p => p.Amount);
            var balance = invoice.TotalAmount - paid;

            if (balance <= 0)
                return Problem(
                    detail: "This invoice is already fully paid.",
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Already paid");

            if (amount > balance)
                return Invalid(nameof(request.Amount),
                    $"The amount exceeds the remaining balance of {balance.ToString("0.00", CultureInfo.InvariantCulture)}.");

            var payment = new Payment
            {
                InvoiceId = invoice.Id,
                Amount = amount,
                Method = request.Method,
                Status = PaymentStatus.Completed,
                PaidAt = _clock.Now,
                TransactionReference = reference
            };

            _db.Payments.Add(payment);
            invoice.Status = BillingRules.StatusFor(invoice.TotalAmount, paid + amount);

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            paymentId = payment.Id;
        }
        catch (Exception ex) when (DbConflicts.IsTransientConflict(ex))
        {
            return Problem(
                detail: "Another change was happening at the same time. Please try again.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Please retry");
        }

        await _audit.LogAsync("RecordedPayment", nameof(Payment), paymentId);

        var dto = await _db.Payments.AsNoTracking()
            .Where(p => p.Id == paymentId)
            .Select(PaymentsController.Projection)
            .FirstAsync();

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    [HttpPost("{id:int}/cancel")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<InvoiceDto>> Cancel(int id, CancelInvoiceRequest request)
    {
        var invoice = await _db.Invoices.Include(i => i.Payments).FirstOrDefaultAsync(i => i.Id == id);
        if (invoice is null) return NotFound();

        if (invoice.Status == InvoiceStatus.Cancelled)
            return Problem(
                detail: "This invoice is already cancelled.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Already cancelled");

        if (invoice.Payments.Any(p => p.Status == PaymentStatus.Completed))
            return Problem(
                detail: "This invoice has completed payments. Refund them first.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Invoice has payments");

        invoice.Status = InvoiceStatus.Cancelled;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("CancelledInvoice", nameof(Invoice), id, request.Reason.Trim());

        return Ok(await LoadDetailAsync(id));
    }

    private async Task<bool> CanViewAsync(int patientId)
    {
        switch (_current.Role)
        {
            case "Admin":
            case "Receptionist":
                return true;
            case "Patient":
                return patientId == await _current.GetPatientIdAsync();
            default:
                return false;
        }
    }

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private Task<InvoiceDto?> LoadDetailAsync(int id) =>
        _db.Invoices.AsNoTracking().Where(i => i.Id == id).Select(DetailProjection).FirstOrDefaultAsync();
}