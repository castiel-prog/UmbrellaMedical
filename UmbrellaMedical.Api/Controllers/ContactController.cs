using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

public class ContactRequest
{
    [Required(ErrorMessage = "Please enter your name."), StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please enter your email."), EmailAddress(ErrorMessage = "Enter a valid email address."), StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required."), Phone(ErrorMessage = "Enter a valid phone number."), StringLength(30, MinimumLength = 6, ErrorMessage = "Enter a valid phone number.")]
    public string Phone { get; set; } = string.Empty;

    [Required, StringLength(60)]
    public string Topic { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please write a message."), StringLength(2000, MinimumLength = 10, ErrorMessage = "Please write at least 10 characters.")]
    public string Message { get; set; } = string.Empty;
}

public class ContactMessageDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsHandled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? HandledAt { get; set; }
}

/// <summary>Public contact form; the clinic reads and closes the messages in Administration.</summary>
[ApiController]
[Route("api")]
public class ContactController : ControllerBase
{
    private static readonly string[] Topics = { "Appointments", "Billing and payments", "Prescriptions", "Store orders", "Feedback", "Other" };

    private readonly UmbrellaDbContext _db;
    private readonly IEmailSender _email;
    private readonly IConfiguration _config;
    private readonly IClinicClock _clock;
    private readonly ILogger<ContactController> _logger;

    public ContactController(UmbrellaDbContext db, IEmailSender email, IConfiguration config, IClinicClock clock, ILogger<ContactController> logger)
    {
        _db = db;
        _email = email;
        _config = config;
        _clock = clock;
        _logger = logger;
    }

    [HttpPost("contact")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Send(ContactRequest request)
    {
        var topic = Topics.FirstOrDefault(t => t.Equals(request.Topic.Trim(), StringComparison.OrdinalIgnoreCase)) ?? "Other";
        var message = new ContactMessage
        {
            Name = request.Name.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = request.Phone.Trim(),
            Topic = topic,
            Message = request.Message.Trim()
        };
        _db.ContactMessages.Add(message);
        await _db.SaveChangesAsync();

        // Emails are a courtesy: the message is already saved, so a mail problem never loses it.
        var clinicInbox = _config["Clinic:ContactEmail"];
        if (!string.IsNullOrWhiteSpace(clinicInbox))
            await TrySend(clinicInbox, $"Contact form: {topic} — {message.Name}",
                $"New message from the website contact form.\n\nName: {message.Name}\nEmail: {message.Email}\nPhone: {message.Phone}\nTopic: {topic}\nReceived: {_clock.Now:dd MMM yyyy, HH:mm}\n\n{message.Message}\n\nReply to {message.Email}, or see it in Administration → Messages.");

        await TrySend(message.Email, "We received your message — Umbrella Medical Center",
            $"Hello {message.Name}, thank you for contacting Umbrella Medical Center.\n\nWe received your message about \"{topic}\" and will reply within one working day.\n\nYour message:\n{message.Message}\n\nFor urgent medical help call 112.");

        return Ok(new { message = "Thank you! Your message was sent. We will reply within one working day." });
    }

    [HttpGet("admin/contact-messages")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<PagedResult<ContactMessageDto>>> List([FromQuery] bool? handled, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.ContactMessages.AsNoTracking().AsQueryable();
        if (handled is not null) query = query.Where(m => m.IsHandled == handled);

        var total = await query.CountAsync();
        var items = await query.OrderBy(m => m.IsHandled).ThenByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(m => new ContactMessageDto
            {
                Id = m.Id, Name = m.Name, Email = m.Email, Phone = m.Phone, Topic = m.Topic, Message = m.Message,
                IsHandled = m.IsHandled, CreatedAt = m.CreatedAt, HandledAt = m.HandledAt
            })
            .ToListAsync();

        return Ok(new PagedResult<ContactMessageDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total });
    }

    [HttpPut("admin/contact-messages/{id:int}/handled")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<IActionResult> SetHandled(int id, [FromQuery] bool value = true)
    {
        var message = await _db.ContactMessages.FirstOrDefaultAsync(m => m.Id == id);
        if (message is null) return NotFound();
        message.IsHandled = value;
        message.HandledAt = value ? DateTime.UtcNow : null;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task TrySend(string to, string subject, string body)
    {
        try { await _email.SendAsync(to, subject, body, HttpContext.RequestAborted); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Contact form email to {To} could not be sent.", to);
        }
    }
}
