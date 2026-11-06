using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Dtos.Billing;

public class InvoiceItemDto
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public int? ServiceId { get; set; }
}

public class PaymentDto
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? TransactionReference { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class InvoiceListItemDto
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public DateTime? DueDate { get; set; }
    public InvoiceStatus Status { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public int? AppointmentId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal InsuranceCoverage { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal Balance => Status == InvoiceStatus.Cancelled ? 0m : TotalAmount - PaidAmount;
}

public class InvoiceDto : InvoiceListItemDto
{
    public string? InsuranceCompany { get; set; }
    public string? PolicyNumber { get; set; }
    public decimal? CoveragePercent { get; set; }
    public List<InvoiceItemDto> Items { get; set; } = new();
    public List<PaymentDto> Payments { get; set; } = new();
}

public class InvoiceItemRequest
{
    [Required(ErrorMessage = "Description is required."), StringLength(200)]
    public string Description { get; set; } = string.Empty;

    [Range(1, 100, ErrorMessage = "Quantity must be between 1 and 100.")]
    public int Quantity { get; set; } = 1;

    [Range(0.01, 100000.0, ErrorMessage = "Unit price must be between 0.01 and 100000.")]
    public decimal UnitPrice { get; set; }
}

public class CreateInvoiceRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Appointment is required.")]
    public int AppointmentId { get; set; }

    public bool UseInsurance { get; set; } = true;

    public int? PatientInsuranceId { get; set; }

    [MaxLength(20)]
    public List<InvoiceItemRequest>? ExtraItems { get; set; }
}

public class CreatePaymentRequest
{
    [Range(0.01, 1000000.0, ErrorMessage = "Amount must be greater than zero.")]
    public decimal Amount { get; set; }

    [EnumDataType(typeof(PaymentMethod))]
    public PaymentMethod Method { get; set; }

    [StringLength(100)]
    public string? Reference { get; set; }
}

public class CancelInvoiceRequest
{
    [Required(ErrorMessage = "A reason is required."), StringLength(500, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}

public class RefundPaymentRequest
{
    [Required(ErrorMessage = "A reason is required."), StringLength(500, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}

public class ReceiptDto
{
    public string ReceiptNumber { get; set; } = string.Empty;
    public string ClinicName { get; set; } = string.Empty;
    public DateTime? PaidAt { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? TransactionReference { get; set; }
}

public class InsuranceCompanyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; }
}

public class UpsertInsuranceCompanyRequest
{
    [Required(ErrorMessage = "Name is required."), StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [Phone, StringLength(30)]
    public string? Phone { get; set; }

    [EmailAddress, StringLength(256)]
    public string? Email { get; set; }

    public bool IsActive { get; set; } = true;
}

public class PatientInsuranceDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public int InsuranceCompanyId { get; set; }
    public string InsuranceCompany { get; set; } = string.Empty;
    public string PolicyNumber { get; set; } = string.Empty;
    public decimal CoveragePercent { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; }
    public bool IsCurrent { get; set; }
}

public class CreatePatientInsuranceRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Insurance company is required.")]
    public int InsuranceCompanyId { get; set; }

    [Required(ErrorMessage = "Policy number is required."), StringLength(50)]
    public string PolicyNumber { get; set; } = string.Empty;

    [Range(0, 100, ErrorMessage = "Coverage must be between 0 and 100 percent.")]
    public decimal CoveragePercent { get; set; }

    public DateOnly ValidFrom { get; set; }

    public DateOnly ValidTo { get; set; }
}

public class UpdatePatientInsuranceRequest
{
    [Range(0, 100, ErrorMessage = "Coverage must be between 0 and 100 percent.")]
    public decimal CoveragePercent { get; set; }

    public DateOnly ValidFrom { get; set; }

    public DateOnly ValidTo { get; set; }
}