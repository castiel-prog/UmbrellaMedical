using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.DTOs.Auth
{
    public class RegisterRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        public string LastName { get; set; } = string.Empty;

        [Required]
        public string PersonalNumber { get; set; } = string.Empty;

        public DateOnly DateOfBirth { get; set; }
        public Gender Gender { get; set; }
        [Required(ErrorMessage = "Phone number is required."), Phone(ErrorMessage = "Enter a valid phone number."), StringLength(30, MinimumLength = 6, ErrorMessage = "Enter a valid phone number.")]
        public string Phone { get; set; } = string.Empty;

        /// <summary>The site language at sign-up (en, ka, de, fr, it, es, ru): used for e-mails and saved as the preference.</summary>
        [StringLength(5)]
        public string? Language { get; set; }
    }
}
