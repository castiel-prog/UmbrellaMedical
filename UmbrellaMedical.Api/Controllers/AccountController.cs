using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Account;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/account")]
[EnableRateLimiting("auth")]
public class AccountController : ControllerBase
{
    private const string GenericResetMessage = "If this email is registered, a code has been sent to it.";

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IUserTokenService _tokens;
    private readonly IEmailSender _email;
    private readonly IAuditService _audit;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UmbrellaDbContext db, ICurrentUser current, IUserTokenService tokens,
        IEmailSender email, IAuditService audit, ILogger<AccountController> logger)
    {
        _db = db;
        _current = current;
        _tokens = tokens;
        _email = email;
        _audit = audit;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<AccountInfoDto>> Get()
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var info = await LoadInfoAsync(userId.Value);
        return info is null ? NotFound() : Ok(info);
    }

    [HttpPost("email/send-verification")]
    [Authorize]
    public async Task<IActionResult> SendVerification()
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        if (user.EmailConfirmed)
            return Problem(
                detail: "This email is already confirmed.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Already confirmed");

        var code = await _tokens.IssueAsync(user.Id, UserTokenPurpose.EmailVerification);
        if (code is null) return TooSoon();

        if (!await TrySendAsync(user.Email, EmailTemplates.VerificationCode(code))) return SendFailed();

        return Ok(new { message = "A verification code has been sent to your email." });
    }

    [HttpPost("email/verify")]
    [Authorize]
    public async Task<ActionResult<AccountInfoDto>> VerifyEmail(VerifyEmailRequest request)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        if (!user.EmailConfirmed)
        {
            var token = await _tokens.ConsumeAsync(user.Id, UserTokenPurpose.EmailVerification, request.Code);
            if (token is null) return InvalidCode();

            user.EmailConfirmed = true;
            await _db.SaveChangesAsync();
            await _audit.LogAsync("EmailVerified", "User", user.Id);
        }

        return Ok(await LoadInfoAsync(user.Id));
    }

    [HttpPost("~/api/auth/forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email && u.IsActive);
        if (user is not null)
        {
            var code = await _tokens.IssueAsync(user.Id, UserTokenPurpose.PasswordReset);
            if (code is not null)
                await TrySendAsync(user.Email, EmailTemplates.PasswordResetCode(code));
        }

        return Ok(new { message = GenericResetMessage });
    }

    [HttpPost("~/api/auth/reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive);
        if (user is null) return InvalidCode();

        var token = await _tokens.ConsumeAsync(user.Id, UserTokenPurpose.PasswordReset, request.Code);
        if (token is null) return InvalidCode();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.EmailConfirmed = true;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("PasswordReset", "User", user.Id, $"UserId={user.Id}");

        return Ok(new { message = "Your password has been changed. You can log in now." });
    }

    [HttpPost("password/change")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return Problem(
                detail: "The current password is incorrect.",
                statusCode: StatusCodes.Status400BadRequest,
                title: "Wrong password");

        if (request.CurrentPassword == request.NewPassword)
            return Problem(
                detail: "The new password must be different from the current one.",
                statusCode: StatusCodes.Status400BadRequest,
                title: "Same password");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("PasswordChanged", "User", user.Id);

        return Ok(new { message = "Your password has been changed." });
    }

    [HttpPost("email/change/request")]
    [Authorize]
    public async Task<IActionResult> RequestEmailChange(ChangeEmailRequest request)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return Problem(
                detail: "The current password is incorrect.",
                statusCode: StatusCodes.Status400BadRequest,
                title: "Wrong password");

        var newEmail = request.NewEmail.Trim().ToLowerInvariant();

        if (newEmail == user.Email)
            return Problem(
                detail: "This is already your email.",
                statusCode: StatusCodes.Status400BadRequest,
                title: "Same email");

        if (await _db.Users.AnyAsync(u => u.Email == newEmail))
            return EmailInUse();

        var code = await _tokens.IssueAsync(user.Id, UserTokenPurpose.EmailChange, newEmail);
        if (code is null) return TooSoon();

        if (!await TrySendAsync(newEmail, EmailTemplates.EmailChangeCode(code))) return SendFailed();

        return Ok(new { message = "A confirmation code has been sent to the new email." });
    }

    [HttpPost("email/change/confirm")]
    [Authorize]
    public async Task<ActionResult<AccountInfoDto>> ConfirmEmailChange(VerifyEmailRequest request)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user is null) return Unauthorized();

        var token = await _tokens.ConsumeAsync(user.Id, UserTokenPurpose.EmailChange, request.Code);
        if (token is null || string.IsNullOrWhiteSpace(token.NewEmail)) return InvalidCode();

        var newEmail = token.NewEmail;
        if (await _db.Users.AnyAsync(u => u.Email == newEmail && u.Id != user.Id))
            return EmailInUse();

        user.Email = newEmail;
        user.EmailConfirmed = true;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return EmailInUse();
        }

        await _audit.LogAsync("EmailChanged", "User", user.Id);
        return Ok(await LoadInfoAsync(user.Id));
    }

    private Task<AccountInfoDto?> LoadInfoAsync(int userId) =>
        _db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new AccountInfoDto
            {
                Email = u.Email,
                EmailConfirmed = u.EmailConfirmed,
                Role = u.Role.Name
            })
            .FirstOrDefaultAsync();

    private async Task<bool> TrySendAsync(string to, EmailContent mail)
    {
        try
        {
            await _email.SendAsync(to, mail.Subject, mail.Body, HttpContext.RequestAborted);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send an email");
            return false;
        }
    }

    private ActionResult InvalidCode() =>
        Problem(
            detail: "The code is invalid or has expired.",
            statusCode: StatusCodes.Status400BadRequest,
            title: "Invalid code");

    private ActionResult TooSoon() =>
        Problem(
            detail: "A code was sent recently. Please wait a minute before asking for another one.",
            statusCode: StatusCodes.Status429TooManyRequests,
            title: "Please wait");

    private ActionResult SendFailed() =>
        Problem(
            detail: "The email could not be sent. Please try again later.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Email not sent");

    private ActionResult EmailInUse() =>
        Problem(
            detail: "This email is already in use.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Email in use");
}