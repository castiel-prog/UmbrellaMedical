using System.ComponentModel.DataAnnotations;

namespace UmbrellaMedical.Api.Dtos.Account;

public class AccountInfoDto
{
    public string Email { get; set; } = string.Empty;
    public bool EmailConfirmed { get; set; }
    public string Role { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? PhotoUrl { get; set; }

    /// <summary>Personal details; null for accounts without a personal record (the admin).</summary>
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    /// <summary>Patients only.</summary>
    public string? Address { get; set; }

    public string? PreferredLanguage { get; set; }
    public string? PreferredTheme { get; set; }
    public bool EmailReminders { get; set; }
    public bool EmailNotifications { get; set; }
}

public class UpdateAccountDetailsRequest
{
    [Required(ErrorMessage = "First name is required."), StringLength(100, MinimumLength = 1)]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required."), StringLength(100, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    [StringLength(30), RegularExpression(@"^\+?[0-9 ()\-]{6,30}$", ErrorMessage = "Enter a valid phone number.")]
    public string? Phone { get; set; }

    [StringLength(300)]
    public string? Address { get; set; }
}

public class UpdatePreferencesRequest
{
    [RegularExpression("^(en|ka|de|fr|it|es|ru)$", ErrorMessage = "Unknown language.")]
    public string? Language { get; set; }

    [RegularExpression("^(light|dark)$", ErrorMessage = "Theme must be light or dark.")]
    public string? Theme { get; set; }

    public bool EmailReminders { get; set; } = true;
    public bool EmailNotifications { get; set; }
}

public class VerifyEmailRequest
{
    [Required(ErrorMessage = "Code is required.")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "The code must be 6 digits.")]
    public string Code { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    [Required(ErrorMessage = "Email is required."), EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    [Required(ErrorMessage = "Email is required."), EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Code is required.")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "The code must be 6 digits.")]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "New password is required."), StringLength(100, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "New password is required."), StringLength(100, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangeEmailRequest
{
    [Required(ErrorMessage = "New email is required."), EmailAddress, StringLength(256)]
    public string NewEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = string.Empty;
}