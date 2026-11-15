using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Api.DTOs.Appointments;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.DTOs.Store;

// ---------------------------------------------------------------- products

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Unit { get; set; }
    public ProductCategory Category { get; set; }
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; }
    public bool RequiresPrescription { get; set; }
    public int? MedicationId { get; set; }
    public string? MedicationName { get; set; }
    /// <summary>Product photo, or null when the site should draw the built-in illustration.</summary>
    public string? ImageUrl { get; set; }
}

public class UpsertProductRequest
{
    [Required(ErrorMessage = "Name is required."), StringLength(150)]
    public string Name { get; set; } = string.Empty;
    [StringLength(1000)]
    public string? Description { get; set; }
    [StringLength(50)]
    public string? Unit { get; set; }
    [EnumDataType(typeof(ProductCategory))]
    public ProductCategory Category { get; set; }
    [Range(0.01, 100000.0, ErrorMessage = "Price must be between 0.01 and 100000.")]
    public decimal Price { get; set; }
    [Range(0, 100000, ErrorMessage = "Stock must be between 0 and 100000.")]
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
    public bool RequiresPrescription { get; set; }
    public int? MedicationId { get; set; }
}

/// <summary>A prescription of the logged-in patient that can be used to buy a given product.</summary>
public class UsablePrescriptionDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public DateTime IssuedDate { get; set; }
    public DateTime ExpiryDate { get; set; }
}

// ---------------------------------------------------------------- orders

public class OrderLineRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Product is required.")]
    public int ProductId { get; set; }
    [Range(1, 20, ErrorMessage = "Quantity must be between 1 and 20.")]
    public int Quantity { get; set; } = 1;
    /// <summary>Prescription code for a prescription-only product (e.g. RX-000042-K7QD).</summary>
    [StringLength(30)]
    public string? PrescriptionCode { get; set; }
}

public class CreateStoreOrderRequest
{
    [Required, MinLength(1, ErrorMessage = "The cart is empty."), MaxLength(30)]
    public List<OrderLineRequest> Items { get; set; } = new();

    /// <summary>A prescription file the patient uploaded (document of type Prescription) for lines without a code.</summary>
    public int? PrescriptionDocumentId { get; set; }

    public PaymentCardRequest? Card { get; set; }
}

public class StoreOrderItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public bool RequiresPrescription { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
    public string? PrescriptionCode { get; set; }
}

public class StoreOrderDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public StoreOrderStatus Status { get; set; }
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentReference { get; set; }
    public bool Refunded { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientPersonalNumber { get; set; } = string.Empty;
    public int? PrescriptionDocumentId { get; set; }
    public string? PrescriptionFileName { get; set; }
    public string? ReviewNote { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<StoreOrderItemDto> Items { get; set; } = new();
}

public class ReviewOrderRequest
{
    [StringLength(500)]
    public string? Note { get; set; }
}

public class RejectOrderRequest
{
    [Required(ErrorMessage = "A reason is required."), StringLength(500, MinimumLength = 5, ErrorMessage = "Give a reason of at least 5 characters.")]
    public string Reason { get; set; } = string.Empty;
}

// ---------------------------------------------------------------- prescription requests

public class CreatePrescriptionRequestRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Choose a doctor.")]
    public int DoctorId { get; set; }
    public int? AppointmentId { get; set; }
    public int? MedicationId { get; set; }
    [Required(ErrorMessage = "Tell the doctor what you need."), StringLength(1000, MinimumLength = 10, ErrorMessage = "Write at least 10 characters.")]
    public string Message { get; set; } = string.Empty;
}

public class PrescriptionRequestDto
{
    public int Id { get; set; }
    public PrescriptionRequestStatus Status { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? DecisionNote { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public int? AppointmentId { get; set; }
    public DateTime? AppointmentDate { get; set; }
    public string? AppointmentService { get; set; }
    public int? MedicationId { get; set; }
    public string? MedicationName { get; set; }
    public int? PrescriptionId { get; set; }
    public string? PrescriptionCode { get; set; }
}

public class ApprovePrescriptionRequestRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Medication is required.")]
    public int MedicationId { get; set; }
    [Required(ErrorMessage = "Dosage is required."), StringLength(100)]
    public string Dosage { get; set; } = string.Empty;
    [Required(ErrorMessage = "Frequency is required."), StringLength(100)]
    public string Frequency { get; set; } = string.Empty;
    [Range(1, 365, ErrorMessage = "Duration must be between 1 and 365 days.")]
    public int DurationDays { get; set; }
    [Range(1, 365, ErrorMessage = "Validity must be between 1 and 365 days.")]
    public int ValidDays { get; set; } = 30;
    [StringLength(2000)]
    public string? Instructions { get; set; }
}

public class DeclinePrescriptionRequestRequest
{
    [Required(ErrorMessage = "A reason is required."), StringLength(500, MinimumLength = 5, ErrorMessage = "Give a reason of at least 5 characters.")]
    public string Reason { get; set; } = string.Empty;
}
