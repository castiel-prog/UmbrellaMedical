using System.ComponentModel.DataAnnotations;

namespace UmbrellaMedical.Api.DTOs.Doctors
{
    public class DoctorListItemDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public int SpecializationId { get; set; }
        public string Specialization { get; set; } = string.Empty;
        public string? PhotoUrl { get; set; }
        public int YearsOfExperience { get; set; }
        public decimal AverageRating { get; set; }
        public int ReviewCount { get; set; }
    }

    public class EducationDto
    {
        public string Institution { get; set; } = string.Empty;
        public string Degree { get; set; } = string.Empty;
        public int StartYear { get; set; }
        public int GraduationYear { get; set; }
    }

    public class ExperienceDto
    {
        public string Workplace { get; set; } = string.Empty;
        public string Position { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly? EndDate { get; set; }
        public string? Description { get; set; }
    }

    public class DoctorServiceDto
    {
        public int ServiceId { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int DurationMinutes { get; set; }
    }

    public class DoctorDetailsDto : DoctorListItemDto
    {
        public string? Bio { get; set; }
        public List<EducationDto> Educations { get; set; } = new();
        public List<ExperienceDto> Experiences { get; set; } = new();
        public List<DoctorServiceDto> Services { get; set; } = new();
    }

    public class CreateDoctorRequest
    {
        [Required(ErrorMessage = "Email is required."), EmailAddress, StringLength(256)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required."), StringLength(100, MinimumLength = 8)]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "First name is required."), StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Last name is required."), StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required(ErrorMessage = "License number is required."), StringLength(50)]
        public string LicenseNumber { get; set; } = string.Empty;

        [Range(1, int.MaxValue, ErrorMessage = "Specialization is required.")]
        public int SpecializationId { get; set; }

        [Phone, StringLength(30)]
        public string? Phone { get; set; }

        [StringLength(2000)]
        public string? Bio { get; set; }

        [Range(0, 60)]
        public int YearsOfExperience { get; set; }
    }

    public class ScheduleItemDto
    {
        public DayOfWeek DayOfWeek { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdateScheduleRequest
    {
        [Required, MaxLength(30)]
        public List<ScheduleItemDto> Items { get; set; } = new();
    }
}
