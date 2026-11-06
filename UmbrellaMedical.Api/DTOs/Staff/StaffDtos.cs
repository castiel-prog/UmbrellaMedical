using System.ComponentModel.DataAnnotations;

namespace UmbrellaMedical.Api.Dtos.Staff;

public class CreateReceptionistRequest
{
    [Required(ErrorMessage = "Email is required."), EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required."), StringLength(100, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "First name is required."), StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required."), StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Phone, StringLength(30)]
    public string? Phone { get; set; }
}

public class ReceptionistDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsActive { get; set; }
}