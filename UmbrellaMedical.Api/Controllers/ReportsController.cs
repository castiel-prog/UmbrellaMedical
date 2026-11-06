using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Reports;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "Admin")]
public class ReportsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly IClinicClock _clock;
    private readonly IAuditService _audit;

    public ReportsController(UmbrellaDbContext db, IClinicClock clock, IAuditService audit)
    {
        _db = db;
        _clock = clock;
        _audit = audit;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ReportSummaryDto>> Summary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var range = GetRange(from, to);
        if (range.Error is not null) return range.Error;

        var start = range.Start;
        var end = range.End;

        var byStatus = await _db.Appointments.AsNoTracking()
            .Where(a => a.StartDateTime >= start && a.StartDateTime < end)
            .GroupBy(a => a.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        int CountOf(AppointmentStatus status) => byStatus.FirstOrDefault(x => x.Status == status)?.Count ?? 0;

        var invoices = await _db.Invoices.AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Cancelled && i.IssueDate >= start && i.IssueDate < end)
            .Select(i => new { i.Subtotal, i.InsuranceCoverage, i.TotalAmount })
            .ToListAsync();

        var collected = await _db.Payments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Completed && p.PaidAt >= start && p.PaidAt < end)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        var refunded = await _db.Payments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Refunded && p.PaidAt >= start && p.PaidAt < end)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        var open = await _db.Invoices.AsNoTracking()
            .Where(i => i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid)
            .Select(i => new
            {
                i.TotalAmount,
                Paid = i.Payments.Where(p => p.Status == PaymentStatus.Completed).Sum(p => (decimal?)p.Amount) ?? 0m
            })
            .ToListAsync();

        var ratings = await _db.Doctors.AsNoTracking()
            .Where(d => d.ReviewCount > 0)
            .Select(d => d.AverageRating)
            .ToListAsync();

        var total = byStatus.Sum(x => x.Count);

        return Ok(new ReportSummaryDto
        {
            From = range.From,
            To = range.To,
            Appointments = new AppointmentCountsDto
            {
                Total = total,
                Scheduled = CountOf(AppointmentStatus.Scheduled),
                Completed = CountOf(AppointmentStatus.Completed),
                Cancelled = CountOf(AppointmentStatus.Cancelled),
                NoShow = CountOf(AppointmentStatus.NoShow)
            },
            NewPatients = await _db.Patients.CountAsync(p => p.CreatedAt >= start && p.CreatedAt < end),
            ActiveDoctors = await _db.Doctors.CountAsync(d => d.User.IsActive),
            AverageDoctorRating = ratings.Count == 0 ? 0m : Math.Round(ratings.Average(), 2),
            Billed = invoices.Sum(i => i.Subtotal),
            InsuranceShare = invoices.Sum(i => i.InsuranceCoverage),
            PatientShare = invoices.Sum(i => i.TotalAmount),
            Collected = collected,
            Refunded = refunded,
            OutstandingBalance = open.Sum(x => x.TotalAmount - x.Paid)
        });
    }

    [HttpGet("appointments-by-doctor")]
    public async Task<ActionResult<List<DoctorReportRowDto>>> ByDoctor([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var range = GetRange(from, to);
        if (range.Error is not null) return range.Error;

        var start = range.Start;
        var end = range.End;

        var doctors = await _db.Doctors.AsNoTracking()
            .OrderBy(d => d.LastName).ThenBy(d => d.FirstName)
            .Select(d => new { d.Id, Name = d.FirstName + " " + d.LastName, Specialization = d.Specialization.Name })
            .ToListAsync();

        var counts = await _db.Appointments.AsNoTracking()
            .Where(a => a.StartDateTime >= start && a.StartDateTime < end)
            .GroupBy(a => a.DoctorId)
            .Select(g => new
            {
                DoctorId = g.Key,
                Total = g.Count(),
                Scheduled = g.Count(a => a.Status == AppointmentStatus.Scheduled),
                Completed = g.Count(a => a.Status == AppointmentStatus.Completed),
                Cancelled = g.Count(a => a.Status == AppointmentStatus.Cancelled),
                NoShow = g.Count(a => a.Status == AppointmentStatus.NoShow)
            })
            .ToListAsync();

        var billed = await _db.Invoices.AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Cancelled
                        && i.AppointmentId != null
                        && i.Appointment!.StartDateTime >= start
                        && i.Appointment.StartDateTime < end)
            .Select(i => new { DoctorId = i.Appointment!.DoctorId, i.Subtotal })
            .ToListAsync();

        var rows = doctors
            .Select(d =>
            {
                var c = counts.FirstOrDefault(x => x.DoctorId == d.Id);

                return new DoctorReportRowDto
                {
                    DoctorId = d.Id,
                    DoctorName = d.Name,
                    Specialization = d.Specialization,
                    Total = c?.Total ?? 0,
                    Scheduled = c?.Scheduled ?? 0,
                    Completed = c?.Completed ?? 0,
                    Cancelled = c?.Cancelled ?? 0,
                    NoShow = c?.NoShow ?? 0,
                    Billed = billed.Where(b => b.DoctorId == d.Id).Sum(b => b.Subtotal)
                };
            })
            .OrderByDescending(r => r.Total)
            .ThenBy(r => r.DoctorName)
            .ToList();

        return Ok(rows);
    }

    [HttpGet("popular-services")]
    public async Task<ActionResult<List<ServiceReportRowDto>>> PopularServices(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int top = 10)
    {
        var range = GetRange(from, to);
        if (range.Error is not null) return range.Error;

        top = Math.Clamp(top, 1, 50);
        var start = range.Start;
        var end = range.End;

        var counts = await _db.Appointments.AsNoTracking()
            .Where(a => a.StartDateTime >= start && a.StartDateTime < end && a.Status != AppointmentStatus.Cancelled)
            .GroupBy(a => a.ServiceId)
            .Select(g => new { ServiceId = g.Key, Count = g.Count() })
            .ToListAsync();

        var items = await _db.InvoiceItems.AsNoTracking()
            .Where(x => x.ServiceId != null
                        && x.Invoice.Status != InvoiceStatus.Cancelled
                        && x.Invoice.IssueDate >= start
                        && x.Invoice.IssueDate < end)
            .Select(x => new { ServiceId = x.ServiceId!.Value, x.LineTotal })
            .ToListAsync();

        var serviceIds = counts.Select(c => c.ServiceId).Union(items.Select(i => i.ServiceId)).ToList();

        var services = await _db.Services.AsNoTracking()
            .Where(s => serviceIds.Contains(s.Id))
            .Select(s => new { s.Id, s.Name, Department = s.Department.Name })
            .ToListAsync();

        var rows = services
            .Select(s => new ServiceReportRowDto
            {
                ServiceId = s.Id,
                ServiceName = s.Name,
                Department = s.Department,
                Appointments = counts.FirstOrDefault(c => c.ServiceId == s.Id)?.Count ?? 0,
                Billed = items.Where(i => i.ServiceId == s.Id).Sum(i => i.LineTotal)
            })
            .OrderByDescending(r => r.Appointments)
            .ThenByDescending(r => r.Billed)
            .Take(top)
            .ToList();

        return Ok(rows);
    }

    [HttpGet("revenue")]
    public async Task<ActionResult<RevenueReportDto>> Revenue(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string groupBy = "day")
    {
        var range = GetRange(from, to);
        if (range.Error is not null) return range.Error;

        var byMonth = string.Equals(groupBy, "month", StringComparison.OrdinalIgnoreCase);
        if (!byMonth && !string.Equals(groupBy, "day", StringComparison.OrdinalIgnoreCase))
            return Invalid(nameof(groupBy), "Use groupBy=day or groupBy=month.");

        var built = await BuildRevenueAsync(range.Start, range.End, byMonth);

        return Ok(new RevenueReportDto
        {
            From = range.From,
            To = range.To,
            GroupBy = byMonth ? "month" : "day",
            Rows = built.Rows,
            Totals = Totals(built.Rows),
            ByMethod = built.Methods
        });
    }

    [HttpGet("revenue/export")]
    public async Task<IActionResult> ExportRevenue(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string groupBy = "day")
    {
        var range = GetRange(from, to);
        if (range.Error is not null) return range.Error;

        var byMonth = string.Equals(groupBy, "month", StringComparison.OrdinalIgnoreCase);
        if (!byMonth && !string.Equals(groupBy, "day", StringComparison.OrdinalIgnoreCase))
            return Invalid(nameof(groupBy), "Use groupBy=day or groupBy=month.");

        var built = await BuildRevenueAsync(range.Start, range.End, byMonth);
        var totals = Totals(built.Rows);

        var csv = new StringBuilder();
        csv.AppendLine("Period,Invoices,Billed,InsuranceShare,PatientShare,Collected");

        foreach (var row in built.Rows)
            csv.AppendLine(CsvLine(row));

        csv.AppendLine(CsvLine(totals));

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        var fileName = $"revenue-{range.From:yyyy-MM-dd}-{range.To:yyyy-MM-dd}.csv";

        await _audit.LogAsync("ExportedRevenueReport", "Report", null, $"{range.From:yyyy-MM-dd}..{range.To:yyyy-MM-dd}");

        return File(bytes, "text/csv; charset=utf-8", fileName);
    }

    private async Task<(List<RevenueRowDto> Rows, List<MethodRowDto> Methods)> BuildRevenueAsync(
        DateTime start, DateTime end, bool byMonth)
    {
        var invoices = await _db.Invoices.AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Cancelled && i.IssueDate >= start && i.IssueDate < end)
            .Select(i => new { i.IssueDate, i.Subtotal, i.InsuranceCoverage, i.TotalAmount })
            .ToListAsync();

        var payments = await _db.Payments.AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Completed && p.PaidAt != null && p.PaidAt >= start && p.PaidAt < end)
            .Select(p => new { p.PaidAt, p.Amount, p.Method })
            .ToListAsync();

        string Key(DateTime value) => value.ToString(byMonth ? "yyyy-MM" : "yyyy-MM-dd", CultureInfo.InvariantCulture);

        var invoiceGroups = invoices.GroupBy(i => Key(i.IssueDate)).ToDictionary(g => g.Key, g => g.ToList());
        var paymentGroups = payments.GroupBy(p => Key(p.PaidAt!.Value)).ToDictionary(g => g.Key, g => g.ToList());

        var rows = invoiceGroups.Keys
            .Union(paymentGroups.Keys)
            .OrderBy(k => k)
            .Select(k =>
            {
                invoiceGroups.TryGetValue(k, out var inv);
                paymentGroups.TryGetValue(k, out var pay);

                return new RevenueRowDto
                {
                    Period = k,
                    Invoices = inv?.Count ?? 0,
                    Billed = inv?.Sum(x => x.Subtotal) ?? 0m,
                    InsuranceShare = inv?.Sum(x => x.InsuranceCoverage) ?? 0m,
                    PatientShare = inv?.Sum(x => x.TotalAmount) ?? 0m,
                    Collected = pay?.Sum(x => x.Amount) ?? 0m
                };
            })
            .ToList();

        var methods = payments
            .GroupBy(p => p.Method)
            .Select(g => new MethodRowDto { Method = g.Key, Payments = g.Count(), Amount = g.Sum(x => x.Amount) })
            .OrderByDescending(m => m.Amount)
            .ToList();

        return (rows, methods);
    }

    private static RevenueRowDto Totals(List<RevenueRowDto> rows) => new()
    {
        Period = "Total",
        Invoices = rows.Sum(r => r.Invoices),
        Billed = rows.Sum(r => r.Billed),
        InsuranceShare = rows.Sum(r => r.InsuranceShare),
        PatientShare = rows.Sum(r => r.PatientShare),
        Collected = rows.Sum(r => r.Collected)
    };

    private static string CsvLine(RevenueRowDto row) =>
        string.Join(",",
            row.Period,
            row.Invoices.ToString(CultureInfo.InvariantCulture),
            row.Billed.ToString("0.00", CultureInfo.InvariantCulture),
            row.InsuranceShare.ToString("0.00", CultureInfo.InvariantCulture),
            row.PatientShare.ToString("0.00", CultureInfo.InvariantCulture),
            row.Collected.ToString("0.00", CultureInfo.InvariantCulture));

    private (DateTime Start, DateTime End, DateOnly From, DateOnly To, ActionResult? Error) GetRange(DateOnly? from, DateOnly? to)
    {
        var today = DateOnly.FromDateTime(_clock.Now);
        var f = from ?? today.AddDays(-29);
        var t = to ?? today;

        if (t < f)
            return (default, default, f, t, Invalid("to", "The end date cannot be before the start date."));

        if (t.DayNumber - f.DayNumber > 365)
            return (default, default, f, t, Invalid("to", "A report can cover at most one year."));

        return (f.ToDateTime(TimeOnly.MinValue), t.AddDays(1).ToDateTime(TimeOnly.MinValue), f, t, null);
    }

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }
}