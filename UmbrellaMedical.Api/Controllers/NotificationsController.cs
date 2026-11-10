using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Notifications;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;

    public NotificationsController(UmbrellaDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<NotificationDto>>> GetAll(
        [FromQuery] bool? unreadOnly, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var uid = userId.Value;
        var query = _db.Notifications.AsNoTracking()
            .Where(n => n.UserId == uid && n.Channel == NotificationChannel.InApp);

        if (unreadOnly == true) query = query.Where(n => !n.IsRead);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Title = n.Title,
                Message = n.Message,
                CreatedAt = n.CreatedAt,
                IsRead = n.IsRead,
                AppointmentId = n.AppointmentId
            })
            .ToListAsync();

        return Ok(new PagedResult<NotificationDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountDto>> UnreadCount()
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var uid = userId.Value;
        var count = await _db.Notifications.AsNoTracking()
            .CountAsync(n => n.UserId == uid && n.Channel == NotificationChannel.InApp && !n.IsRead);

        return Ok(new UnreadCountDto { Count = count });
    }

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var uid = userId.Value;
        var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == uid);
        if (notification is null) return NotFound();

        notification.IsRead = true;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<UnreadCountDto>> MarkAllRead()
    {
        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        var uid = userId.Value;
        await _db.Notifications
            .Where(n => n.UserId == uid && n.Channel == NotificationChannel.InApp && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return Ok(new UnreadCountDto { Count = 0 });
    }
}

[ApiController]
[Route("api/admin/reminders")]
[Authorize(Roles = "Admin")]
public class AdminRemindersController : ControllerBase
{
    private readonly IReminderService _reminders;
    private readonly IAuditService _audit;

    public AdminRemindersController(IReminderService reminders, IAuditService audit)
    {
        _reminders = reminders;
        _audit = audit;
    }

    [HttpPost("run")]
    public async Task<ActionResult<ReminderRunResultDto>> Run(CancellationToken cancellationToken)
    {
        var sent = await _reminders.SendDueRemindersAsync(cancellationToken);
        await _audit.LogAsync("RanReminderJob", "Reminder", null, $"Sent={sent}");

        return Ok(new ReminderRunResultDto { RemindersSent = sent });
    }
}