using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Dtos.Medical;

public class DiagnosisDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class MedicationDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? GenericName { get; set; }
    public string? Form { get; set; }
    public string? Strength { get; set; }
}

public class AllergyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class VitalSignsDto
{
    [Range(30.0, 250.0)]
    public decimal? HeightCm { get; set; }

    [Range(1.0, 400.0)]
    public decimal? WeightKg { get; set; }

    [Range(50, 300)]
    public int? SystolicBp { get; set; }

    [Range(30, 200)]
    public int? DiastolicBp { get; set; }

    [Range(20, 300)]
    public int? HeartRate { get; set; }

    [Range(30.0, 45.0)]
    public decimal? TemperatureC { get; set; }
}

public class ToothRecordDto
{
    [Range(1, 32, ErrorMessage = "Tooth number must be between 1 and 32.")]
    public int ToothNumber { get; set; }

    [EnumDataType(typeof(ToothCondition))]
    public ToothCondition Condition { get; set; }

    [StringLength(500)]
    public string? Treatment { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }
}

public class MedicalRecordDto
{
    public int Id { get; set; }
    public DateTime RecordDate { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public int? AppointmentId { get; set; }
    public string? DiagnosisCode { get; set; }
    public string? DiagnosisName { get; set; }
    public string? Complaints { get; set; }
    public string? DiagnosisDetails { get; set; }
    public string? Treatment { get; set; }
    public string? Recommendations { get; set; }
    public string? Notes { get; set; }
    public VitalSignsDto? VitalSigns { get; set; }
    public List<ToothRecordDto> ToothRecords { get; set; } = new();
    public List<int> PrescriptionIds { get; set; } = new();
    public List<int> DocumentIds { get; set; } = new();
}

public class CreateMedicalRecordRequest
{
    public int? AppointmentId { get; set; }
    public int? DiagnosisId { get; set; }

    [StringLength(2000)]
    public string? Complaints { get; set; }

    [StringLength(2000)]
    public string? DiagnosisDetails { get; set; }

    [StringLength(2000)]
    public string? Treatment { get; set; }

    [StringLength(2000)]
    public string? Recommendations { get; set; }

    [StringLength(4000)]
    public string? Notes { get; set; }

    public VitalSignsDto? VitalSigns { get; set; }

    [MaxLength(32)]
    public List<ToothRecordDto>? ToothRecords { get; set; }
}

public class UpdateMedicalRecordRequest
{
    public int? DiagnosisId { get; set; }

    [StringLength(2000)]
    public string? Complaints { get; set; }

    [StringLength(2000)]
    public string? DiagnosisDetails { get; set; }

    [StringLength(2000)]
    public string? Treatment { get; set; }

    [StringLength(2000)]
    public string? Recommendations { get; set; }

    [StringLength(4000)]
    public string? Notes { get; set; }

    public VitalSignsDto? VitalSigns { get; set; }

    [MaxLength(32)]
    public List<ToothRecordDto>? ToothRecords { get; set; }
}

public class PatientAllergyInput
{
    [Range(1, int.MaxValue, ErrorMessage = "Allergy is required.")]
    public int AllergyId { get; set; }

    [EnumDataType(typeof(AllergySeverity))]
    public AllergySeverity Severity { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }
}

public class UpdatePatientAllergiesRequest
{
    [Required, MaxLength(50)]
    public List<PatientAllergyInput> Allergies { get; set; } = new();
}