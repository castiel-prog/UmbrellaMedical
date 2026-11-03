using System.ComponentModel.DataAnnotations;

namespace UmbrellaMedical.Api.Dtos.Prescriptions;

public class PrescriptionItemDto
{
    public int MedicationId { get; set; }
    public string MedicationName { get; set; } = string.Empty;
    public string? Strength { get; set; }
    public string? Form { get; set; }
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int DurationDays { get; set; }
}

public class PrescriptionDto
{
    public int Id { get; set; }
    public DateTime IssuedDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public bool IsActive { get; set; }
    public string? Instructions { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public int? MedicalRecordId { get; set; }
    public List<PrescriptionItemDto> Items { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class CreatePrescriptionItemRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Medication is required.")]
    public int MedicationId { get; set; }

    [Required(ErrorMessage = "Dosage is required."), StringLength(100)]
    public string Dosage { get; set; } = string.Empty;

    [Required(ErrorMessage = "Frequency is required."), StringLength(100)]
    public string Frequency { get; set; } = string.Empty;

    [Range(1, 365, ErrorMessage = "Duration must be between 1 and 365 days.")]
    public int DurationDays { get; set; }
}

public class CreatePrescriptionRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Patient is required.")]
    public int PatientId { get; set; }

    public int? MedicalRecordId { get; set; }

    public DateTime? ExpiryDate { get; set; }

    [StringLength(2000)]
    public string? Instructions { get; set; }

    [Required, MinLength(1, ErrorMessage = "Add at least one medication."), MaxLength(20)]
    public List<CreatePrescriptionItemRequest> Items { get; set; } = new();
}