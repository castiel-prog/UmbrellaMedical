using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Dtos.Reports;

public class AppointmentCountsDto
{
    public int Total { get; set; }
    public int Scheduled { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
}

public class ReportSummaryDto
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public AppointmentCountsDto Appointments { get; set; } = new();
    public int NewPatients { get; set; }
    public int ActiveDoctors { get; set; }
    public decimal AverageDoctorRating { get; set; }
    public decimal Billed { get; set; }
    public decimal InsuranceShare { get; set; }
    public decimal PatientShare { get; set; }
    public decimal Collected { get; set; }
    public decimal Refunded { get; set; }
    public decimal OutstandingBalance { get; set; }
}

public class DoctorReportRowDto
{
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Scheduled { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
    public decimal Billed { get; set; }
}

public class ServiceReportRowDto
{
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public int Appointments { get; set; }
    public decimal Billed { get; set; }
}

public class RevenueRowDto
{
    public string Period { get; set; } = string.Empty;
    public int Invoices { get; set; }
    public decimal Billed { get; set; }
    public decimal InsuranceShare { get; set; }
    public decimal PatientShare { get; set; }
    public decimal Collected { get; set; }
}

public class MethodRowDto
{
    public PaymentMethod Method { get; set; }
    public int Payments { get; set; }
    public decimal Amount { get; set; }
}

public class RevenueReportDto
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public string GroupBy { get; set; } = "day";
    public List<RevenueRowDto> Rows { get; set; } = new();
    public RevenueRowDto Totals { get; set; } = new();
    public List<MethodRowDto> ByMethod { get; set; } = new();
}