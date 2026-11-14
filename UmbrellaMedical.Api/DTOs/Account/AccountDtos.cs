using System.ComponentModel.DataAnnotations;

namespace UmbrellaMedical.Api.Dtos.Account;

public class AccountInfoDto
{
    public string Email { get; set; } = string.Empty;
    public bool EmailConfirmed { get; set; }
    public string Role { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? PhotoUrl { get; set; }
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