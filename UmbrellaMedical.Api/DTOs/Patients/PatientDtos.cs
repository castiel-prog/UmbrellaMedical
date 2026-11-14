using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.DTOs.Patients
{
   public class PatientListItemDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string PersonalNumber { get; set; } = string.Empty;
        public DateOnly DateOfBirth { get; set; }
        public Gender Gender { get; set; }
        public string? Phone { get; set; }
    }

    public class PatientAllergyDto
    {
        public int AllergyId { get; set; }
        public string Name { get; set; } = string.Empty;
        public AllergySeverity Severity { get; set; }
        public string? Notes { get; set; }
    }

    public class PatientDetailsDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string PersonalNumber { get; set; } = string.Empty;
        public DateOnly DateOfBirth { get; set; }
        public Gender Gender { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? MedicalHistory { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? PhotoUrl { get; set; }
        public List<PatientAllergyDto> Allergies { get; set; } = new();
    }

    public class CreatePatientRequest
    {
        [Required(ErrorMessage = "First name is required."), StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Last name is required."), StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Personal number is required."), StringLength(20, MinimumLength = 5)]
        public string PersonalNumber { get; set; } = string.Empty;

        public DateOnly DateOfBirth { get; set; }

        [EnumDataType(typeof(Gender))]
        public Gender Gender { get; set; }

        [Phone, StringLength(30)]
        public string? Phone { get; set; }

        [EmailAddress, StringLength(256)]
        public string? Email { get; set; }

        [StringLength(300)]
        public string? Address { get; set; }

        [StringLength(4000)]
        public string? MedicalHistory { get; set; }
    }

  
    public class UpdatePatientRequest
    {
        [Required(ErrorMessage = "First name is required."), StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Last name is required."), StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        public DateOnly DateOfBirth { get; set; }

        [EnumDataType(typeof(Gender))]
        public Gender Gender { get; set; }

        [Phone, StringLength(30)]
        public string? Phone { get; set; }

        [EmailAddress, StringLength(256)]
        public string? Email { get; set; }

        [StringLength(300)]
        public string? Address { get; set; }

        [StringLength(4000)]
        public string? MedicalHistory { get; set; }
    }

    
    public class UpdatePatientContactRequest
    {
        [Phone, StringLength(30)]
        public string? Phone { get; set; }

        [EmailAddress, StringLength(256)]
        public string? Email { get; set; }

        [StringLength(300)]
        public string? Address { get; set; }
    }
}
