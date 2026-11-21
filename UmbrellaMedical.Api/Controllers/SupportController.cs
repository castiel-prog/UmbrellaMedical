using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

public class StartConversationRequest
{
    /// <summary>Staff: start a chat with the sender of this contact form message.</summary>
    public int? ContactMessageId { get; set; }

    /// <summary>Everyone else: what the chat is about, and the first message.</summary>
    [StringLength(120)]
    public string? Subject { get; set; }

    [StringLength(2000)]
    public string? Message { get; set; }
}

public class SendSupportMessageRequest
{
    [Required(ErrorMessage = "Write a message."), StringLength(2000, MinimumLength = 1)]
    public string Body { get; set; } = string.Empty;
}

public class HeartbeatRequest
{
    /// <summary>Seconds since the person last clicked, typed or scrolled on the site.</summary>
    [Range(0, 86400)]
    public int IdleSeconds { get; set; }
}

public class SupportConversationDto
{
    public int Id { get; set; }
    public string Subject { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime LastMessageAt { get; set; }
    public string? LastMessage { get; set; }
    public bool LastFromStaff { get; set; }
    public bool IsClosed { get; set; }
    public int Unread { get; set; }
    /// <summary>The other side: for staff the person, for the person the support team. "Online", "Away" or "Offline".</summary>
    public string OtherStatus { get; set; } = "Offline";
    public DateTime? OtherLastSeen { get; set; }
    public int? ContactMessageId { get; set; }
}

public class SupportMessageDto
{
    public int Id { get; set; }
    public bool FromStaff { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    /// <summary>True when the other side has read it.</summary>
    public bool Seen { get; set; }
}

/// <summary>
/// Support chat between people and the clinic's admins. Admins can start a chat from a contact form message;
/// anyone logged in can start one themselves. The other side's presence (online, away, offline) is shown.
/// </summary>
[ApiController]
[Route("api/support")]
[Authorize]
public class SupportController : ControllerBase
{
    private const string StaffRole = "Admin";

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly PresenceTracker _presence;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;

    public SupportController(UmbrellaDbContext db, ICurrentUser current, PresenceTracker presence, INotificationService notifications, IAuditService audit)
    {
        _db = db;
        _current = current;
        _presence = presence;
        _notifications = notifications;
        _audit = audit;
    }

    private bool IsStaff => _current.Role == StaffRole;

    // ---------------------------------------------------------------- presence

    /// <summary>Heartbeat from an open tab; keeps the person "online" (or "away" when idle 2+ minutes).</summary>
    [HttpPost("~/api/presence")]
    public IActionResult Heartbeat(HeartbeatRequest request)
    {
        if (_current.UserId is not int me) return Unauthorized();
        _presence.Heartbeat(me, request.IdleSeconds);
        return NoContent();
    }

    // ---------------------------------------------------------------- conversations

    [HttpGet("conversations")]
    public async Task<ActionResult<List<SupportConversationDto>>> Conversations([FromQuery] bool includeClosed = true)
    {
        if (_current.UserId is not int me) return Unauthorized();
        var query = _db.SupportConversations.AsNoTracking().AsQueryable();
        if (!IsStaff) query = query.Where(c => c.UserId == me);
        if (!includeClosed) query = query.Where(c => !c.IsClosed);

        var list = await Project(query.OrderByDescending(c => c.LastMessageAt).Take(200)).ToListAsync();
        await FillStatusAsync(list);
        return Ok(list);
    }

    [HttpGet("conversations/{id:int}")]
    public async Task<ActionResult<SupportConversationDto>> Conversation(int id)
    {
        if (!await CanSeeAsync(id)) return NotFound();
        var dto = await Project(_db.SupportConversations.AsNoTracking().Where(c => c.Id == id)).FirstAsync();
        await FillStatusAsync(new List<SupportConversationDto> { dto });
        return Ok(dto);
    }

    /// <summary>Total unread support messages for the current person (shown as a badge).</summary>
    [HttpGet("unread")]
    public async Task<ActionResult<object>> Unread()
    {
        if (_current.UserId is not int me) return Unauthorized();
        var count = IsStaff
            ? await _db.SupportMessages.CountAsync(m => !m.FromStaff && (m.Conversation.StaffReadAt == null || m.SentAt > m.Conversation.StaffReadAt))
            : await _db.SupportMessages.CountAsync(m => m.FromStaff && m.Conversation.UserId == me && (m.Conversation.UserReadAt == null || m.SentAt > m.Conversation.UserReadAt));
        return Ok(new { count });
    }

    /// <summary>Starts a chat. Staff start one from a contact message; anyone else starts one with a subject and a first message.</summary>
    [HttpPost("conversations")]
    public async Task<ActionResult<SupportConversationDto>> Start(StartConversationRequest request)
    {
        if (_current.UserId is not int me) return Unauthorized();
        var now = DateTime.UtcNow;

        if (IsStaff)
        {
            if (request.ContactMessageId is not int contactId)
                return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["contactMessageId"] = new[] { "Choose the message to reply to." } }));
            var contact = await _db.ContactMessages.FirstOrDefaultAsync(m => m.Id == contactId);
            if (contact is null) return NotFound();

            // The sender's account, found by the email they gave on the form.
            var email = contact.Email.Trim().ToLowerInvariant();
            var userId = await _db.Users.Where(u => u.Email == email && u.IsActive).Select(u => (int?)u.Id).FirstOrDefaultAsync()
                         ?? await _db.Patients.Where(p => p.Email == email && p.UserId != null).Select(p => p.UserId).FirstOrDefaultAsync();
            if (userId is null)
                return Problem(detail: "This person has no account on the site, so you can't chat with them. Reply by email instead.",
                    statusCode: StatusCodes.Status409Conflict, title: "No account");

            var existing = await _db.SupportConversations.Where(c => c.ContactMessageId == contactId).Select(c => (int?)c.Id).FirstOrDefaultAsync();
            if (existing is int found) return await Conversation(found);

            var conversation = new SupportConversation
            {
                UserId = userId.Value,
                Subject = contact.Topic,
                ContactMessageId = contactId,
                LastMessageAt = contact.CreatedAt,
                StaffReadAt = now
            };
            // The original contact message opens the chat, so the context is right there.
            conversation.Messages.Add(new SupportMessage { SenderUserId = userId.Value, FromStaff = false, Body = contact.Message, SentAt = contact.CreatedAt });
            _db.SupportConversations.Add(conversation);
            await _db.SaveChangesAsync();
            await _audit.LogAsync("StartedSupportChat", nameof(SupportConversation), conversation.Id, $"ContactMessageId={contactId}");
            return await Conversation(conversation.Id);
        }

        var subject = request.Subject?.Trim();
        var message = request.Message?.Trim();
        if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(message))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["message"] = new[] { "Write a subject and a message." } }));

        var own = new SupportConversation { UserId = me, Subject = subject, LastMessageAt = now, UserReadAt = now };
        own.Messages.Add(new SupportMessage { SenderUserId = me, FromStaff = false, Body = message, SentAt = now });
        _db.SupportConversations.Add(own);
        await _db.SaveChangesAsync();
        _presence.Active(me);
        return await Conversation(own.Id);
    }

    [HttpPost("conversations/{id:int}/close")]
    [Authorize(Roles = StaffRole)]
    public async Task<ActionResult<SupportConversationDto>> Close(int id, [FromQuery] bool value = true)
    {
        var conversation = await _db.SupportConversations.FirstOrDefaultAsync(c => c.Id == id);
        if (conversation is null) return NotFound();
        conversation.IsClosed = value;
        await _db.SaveChangesAsync();
        return await Conversation(id);
    }

    // ---------------------------------------------------------------- messages

    /// <summary>Messages of a conversation; pass afterId to get only new ones (the chat polls with it).</summary>
    [HttpGet("conversations/{id:int}/messages")]
    public async Task<ActionResult<List<SupportMessageDto>>> Messages(int id, [FromQuery] int afterId = 0)
    {
        if (!await CanSeeAsync(id)) return NotFound();
        var conversation = await _db.SupportConversations.AsNoTracking().Where(c => c.Id == id)
            .Select(c => new { c.UserReadAt, c.StaffReadAt }).FirstAsync();

        var rows = await _db.SupportMessages.AsNoTracking()
            .Where(m => m.ConversationId == id && m.Id > afterId)
            .OrderBy(m => m.Id)
            .Take(300)
            .Select(m => new { m.Id, m.FromStaff, m.SenderUserId, m.Body, m.SentAt })
            .ToListAsync();

        var names = await NamesAsync(rows.Select(r => r.SenderUserId).Distinct().ToList());
        return Ok(rows.Select(m => new SupportMessageDto
        {
            Id = m.Id,
            FromStaff = m.FromStaff,
            SenderName = m.FromStaff ? "Umbrella support" : names.GetValueOrDefault(m.SenderUserId, ""),
            Body = m.Body,
            SentAt = m.SentAt,
            Seen = m.FromStaff ? conversation.UserReadAt >= m.SentAt : conversation.StaffReadAt >= m.SentAt
        }).ToList());
    }

    [HttpPost("conversations/{id:int}/messages")]
    public async Task<ActionResult<SupportMessageDto>> Send(int id, SendSupportMessageRequest request)
    {
        if (_current.UserId is not int me) return Unauthorized();
        if (!await CanSeeAsync(id)) return NotFound();
        var conversation = await _db.SupportConversations.FirstAsync(c => c.Id == id);
        if (conversation.IsClosed && !IsStaff)
            return Problem(detail: "This conversation was closed. Start a new one if you need more help.", statusCode: StatusCodes.Status409Conflict, title: "Conversation closed");

        var now = DateTime.UtcNow;
        var message = new SupportMessage { ConversationId = id, SenderUserId = me, FromStaff = IsStaff, Body = request.Body.Trim(), SentAt = now };
        _db.SupportMessages.Add(message);
        conversation.LastMessageAt = now;
        conversation.IsClosed = false;
        if (IsStaff) conversation.StaffReadAt = now; else conversation.UserReadAt = now;

        // A person who is not on the site right now also gets a notification (and an email, if they asked for those).
        if (IsStaff && _presence.Status(conversation.UserId) != PresenceStatus.Online)
            _notifications.Queue(conversation.UserId, t => (t.T("New message from Umbrella support"),
                t.T("You have a new reply about \"{subject}\". Open Support chat to read it.", ("subject", conversation.Subject))));

        await _db.SaveChangesAsync();
        _presence.Active(me);
        return Ok(new SupportMessageDto { Id = message.Id, FromStaff = message.FromStaff, SenderName = IsStaff ? "Umbrella support" : "", Body = message.Body, SentAt = now });
    }

    [HttpPost("conversations/{id:int}/read")]
    public async Task<IActionResult> Read(int id)
    {
        if (!await CanSeeAsync(id)) return NotFound();
        var conversation = await _db.SupportConversations.FirstAsync(c => c.Id == id);
        if (IsStaff) conversation.StaffReadAt = DateTime.UtcNow; else conversation.UserReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---------------------------------------------------------------- helpers

    private async Task<bool> CanSeeAsync(int id)
    {
        if (_current.UserId is not int me) return false;
        return await _db.SupportConversations.AnyAsync(c => c.Id == id && (IsStaff || c.UserId == me));
    }

    private IQueryable<SupportConversationDto> Project(IQueryable<SupportConversation> query)
    {
        var staff = IsStaff;
        return query.Select(c => new SupportConversationDto
        {
            Id = c.Id,
            Subject = c.Subject,
            UserId = c.UserId,
            UserName = _db.Patients.Where(p => p.UserId == c.UserId).Select(p => p.FirstName + " " + p.LastName).FirstOrDefault()
                       ?? _db.Doctors.Where(d => d.UserId == c.UserId).Select(d => "Dr. " + d.FirstName + " " + d.LastName).FirstOrDefault()
                       ?? _db.Receptionists.Where(r => r.UserId == c.UserId).Select(r => r.FirstName + " " + r.LastName).FirstOrDefault()
                       ?? c.User.Email,
            UserEmail = c.User.Email,
            UserRole = c.User.Role.Name,
            CreatedAt = c.CreatedAt,
            LastMessageAt = c.LastMessageAt,
            LastMessage = c.Messages.OrderByDescending(m => m.Id).Select(m => m.Body).FirstOrDefault(),
            LastFromStaff = c.Messages.OrderByDescending(m => m.Id).Select(m => m.FromStaff).FirstOrDefault(),
            IsClosed = c.IsClosed,
            Unread = staff
                ? c.Messages.Count(m => !m.FromStaff && (c.StaffReadAt == null || m.SentAt > c.StaffReadAt))
                : c.Messages.Count(m => m.FromStaff && (c.UserReadAt == null || m.SentAt > c.UserReadAt)),
            ContactMessageId = c.ContactMessageId
        });
    }

    private async Task FillStatusAsync(List<SupportConversationDto> list)
    {
        if (IsStaff)
        {
            foreach (var c in list)
            {
                c.OtherStatus = _presence.Status(c.UserId).ToString();
                c.OtherLastSeen = _presence.LastSeen(c.UserId);
            }
            return;
        }

        // For the person, "the other side" is the support team: online if any admin is.
        var admins = await _db.Users.Where(u => u.Role.Name == StaffRole && u.IsActive).Select(u => u.Id).ToListAsync();
        var status = _presence.Best(admins).ToString();
        var lastSeen = admins.Select(a => _presence.LastSeen(a)).Where(s => s is not null).DefaultIfEmpty().Max();
        foreach (var c in list) { c.OtherStatus = status; c.OtherLastSeen = lastSeen; }
    }

    private async Task<Dictionary<int, string>> NamesAsync(List<int> userIds)
    {
        var names = new Dictionary<int, string>();
        foreach (var p in await _db.Patients.Where(p => p.UserId != null && userIds.Contains(p.UserId.Value)).Select(p => new { Id = p.UserId!.Value, Name = p.FirstName + " " + p.LastName }).ToListAsync()) names[p.Id] = p.Name;
        foreach (var d in await _db.Doctors.Where(d => userIds.Contains(d.UserId)).Select(d => new { Id = d.UserId, Name = "Dr. " + d.FirstName + " " + d.LastName }).ToListAsync()) names[d.Id] = d.Name;
        foreach (var r in await _db.Receptionists.Where(r => userIds.Contains(r.UserId)).Select(r => new { Id = r.UserId, Name = r.FirstName + " " + r.LastName }).ToListAsync()) names[r.Id] = r.Name;
        return names;
    }
}
