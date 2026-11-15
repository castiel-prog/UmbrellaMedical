using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    /// <summary>Something sold in the clinic store (medicines, personal care, first aid...).</summary>
    public class Product : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>Pack size, e.g. "20 tablets" or "150 ml".</summary>
        public string? Unit { get; set; }
        public ProductCategory Category { get; set; }
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public bool IsActive { get; set; } = true;

        /// <summary>Prescription-only: can be bought only with a valid prescription.</summary>
        public bool RequiresPrescription { get; set; }

        /// <summary>The medication a prescription must contain for this product (prescription-only products).</summary>
        public int? MedicationId { get; set; }
        public Medication? Medication { get; set; }

        /// <summary>Storage key of the product photo uploaded by an admin; null = show the built-in illustration.</summary>
        public string? ImageKey { get; set; }
        /// <summary>Changes on every new photo so browsers fetch the new one.</summary>
        public int ImageVersion { get; set; }
    }

    public class StoreOrder : BaseEntity
    {
        public string OrderNumber { get; set; } = string.Empty;
        public StoreOrderStatus Status { get; set; }
        public decimal Total { get; set; }

        public string? PaymentReference { get; set; }
        public DateTime? PaidAt { get; set; }
        public bool Refunded { get; set; }

        /// <summary>Prescription file the patient uploaded with the order, checked by staff.</summary>
        public int? PrescriptionDocumentId { get; set; }
        public MedicalDocument? PrescriptionDocument { get; set; }

        public string? ReviewNote { get; set; }
        public int? ReviewedByUserId { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? CompletedAt { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public ICollection<StoreOrderItem> Items { get; set; } = new List<StoreOrderItem>();
    }

    public class StoreOrderItem : BaseEntity
    {
        public int StoreOrderId { get; set; }
        public StoreOrder StoreOrder { get; set; } = null!;

        public int ProductId { get; set; }
        public Product Product { get; set; } = null!;

        public string ProductName { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal LineTotal { get; set; }

        /// <summary>The e-prescription used for this line (prescription-only products bought with a code).</summary>
        public int? PrescriptionId { get; set; }
        public Prescription? Prescription { get; set; }
    }

    /// <summary>A patient asking a doctor for a prescription, optionally about a visit or a store product.</summary>
    public class PrescriptionRequest : BaseEntity
    {
        public PrescriptionRequestStatus Status { get; set; } = PrescriptionRequestStatus.Pending;
        public string Message { get; set; } = string.Empty;
        public string? DecisionNote { get; set; }
        public DateTime? ReviewedAt { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;

        public int? AppointmentId { get; set; }
        public Appointment? Appointment { get; set; }

        public int? MedicationId { get; set; }
        public Medication? Medication { get; set; }

        /// <summary>The prescription the doctor issued when approving.</summary>
        public int? PrescriptionId { get; set; }
        public Prescription? Prescription { get; set; }
    }
}
