using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Hubs;

/// <summary>
/// Real-time channel (SignalR over WebSockets) between the website and the API.
/// The server pushes support chat messages, "seen" receipts, typing indicators, presence changes and new
/// notifications, so the browser no longer has to ask every few seconds.
/// Each connection joins the group of its user; admins (the support team) also join the support group.
/// </summary>
[Authorize]
public class RealtimeHub : Hub
{
    public const string Path = "/api/hubs/realtime";
    public const string SupportGroup = "support-staff";
    public const string StaffRole = "Admin";
    public static string UserGroup(int userId) => $"user-{userId}";

    private readonly PresenceTracker _presence;
    private readonly IRealtimeNotifier _notifier;
    private readonly UmbrellaDbContext _db;

    public RealtimeHub(PresenceTracker presence, IRealtimeNotifier notifier, UmbrellaDbContext db)
    {
        _presence = presence;
        _notifier = notifier;
        _db = db;
    }

    private int? UserId => int.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private bool IsStaff => Context.User?.IsInRole(StaffRole) == true;

    public override async Task OnConnectedAsync()
    {
        if (UserId is not int me) { Context.Abort(); return; }
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(me));
        if (IsStaff) await Groups.AddToGroupAsync(Context.ConnectionId, SupportGroup);

        var before = _presence.Status(me);
        _presence.Connected(me);
        await AnnounceIfChangedAsync(me, before);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (UserId is int me)
        {
            var before = _presence.Status(me);
            _presence.Disconnected(me);
            await AnnounceIfChangedAsync(me, before);
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>Sent by each tab every ~25 seconds: how long ago the person last did something.</summary>
    public async Task Heartbeat(int idleSeconds)
    {
        if (UserId is not int me) return;
        var before = _presence.Status(me);
        _presence.Heartbeat(me, idleSeconds);
        await AnnounceIfChangedAsync(me, before);
    }

    /// <summary>The person is typing in a support conversation; the other side sees "typing…".</summary>
    public async Task Typing(int conversationId)
    {
        if (UserId is not int me) return;
        var owner = await _db.SupportConversations.AsNoTracking()
            .Where(c => c.Id == conversationId && (IsStaff || c.UserId == me))
            .Select(c => (int?)c.UserId).FirstOrDefaultAsync();
        if (owner is null) return;
        await _notifier.SupportTypingAsync(owner.Value, conversationId, IsStaff);
    }

    private Task AnnounceIfChangedAsync(int userId, PresenceStatus before)
    {
        var now = _presence.Status(userId);
        return now == before ? Task.CompletedTask : _notifier.PresenceChangedAsync(userId, now, IsStaff);
    }
}
