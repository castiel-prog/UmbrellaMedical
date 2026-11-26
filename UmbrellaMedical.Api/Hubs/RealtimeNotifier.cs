using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Runtime.CompilerServices;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;

namespace UmbrellaMedical.Api.Hubs;

/// <summary>Pushes events to connected browsers. Sending never throws: real-time updates are a bonus, the data is already saved.</summary>
public interface IRealtimeNotifier
{
    Task SupportMessageAsync(int conversationUserId, int conversationId, object message);
    Task SupportReadAsync(int conversationUserId, int conversationId, bool byStaff);
    Task SupportChangedAsync(int conversationUserId, int conversationId);
    Task SupportTypingAsync(int conversationUserId, int conversationId, bool fromStaff);
    Task PresenceChangedAsync(int userId, PresenceStatus status, bool isStaff);
    Task NotificationsAsync(IEnumerable<int> userIds);
}

/// <summary>Event names the website listens to.</summary>
public static class RealtimeEvents
{
    public const string SupportMessage = "support:message";
    public const string SupportRead = "support:read";
    public const string SupportChanged = "support:changed";
    public const string SupportTyping = "support:typing";
    public const string Presence = "presence";
    public const string Notification = "notification";
}

public class RealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<RealtimeHub> _hub;
    private readonly ILogger<RealtimeNotifier> _logger;

    public RealtimeNotifier(IHubContext<RealtimeHub> hub, ILogger<RealtimeNotifier> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    // Support events go to the person in the conversation and to the support team.
    private IClientProxy BothSides(int conversationUserId) =>
        _hub.Clients.Groups(RealtimeHub.UserGroup(conversationUserId), RealtimeHub.SupportGroup);

    public Task SupportMessageAsync(int conversationUserId, int conversationId, object message) =>
        Safe(() => BothSides(conversationUserId).SendAsync(RealtimeEvents.SupportMessage, new { conversationId, message }));

    public Task SupportReadAsync(int conversationUserId, int conversationId, bool byStaff) =>
        Safe(() => BothSides(conversationUserId).SendAsync(RealtimeEvents.SupportRead, new { conversationId, byStaff }));

    public Task SupportChangedAsync(int conversationUserId, int conversationId) =>
        Safe(() => BothSides(conversationUserId).SendAsync(RealtimeEvents.SupportChanged, new { conversationId }));

    public Task SupportTypingAsync(int conversationUserId, int conversationId, bool fromStaff) =>
        Safe(() => (fromStaff ? _hub.Clients.Group(RealtimeHub.UserGroup(conversationUserId)) : _hub.Clients.Group(RealtimeHub.SupportGroup))
            .SendAsync(RealtimeEvents.SupportTyping, new { conversationId, fromStaff }));

    /// <summary>
    /// A patient's status matters to the support team; the support team's status matters to everyone who chats with it.
    /// </summary>
    public Task PresenceChangedAsync(int userId, PresenceStatus status, bool isStaff) =>
        Safe(() => (isStaff ? _hub.Clients.All : _hub.Clients.Group(RealtimeHub.SupportGroup))
            .SendAsync(RealtimeEvents.Presence, new { userId, status = status.ToString(), isStaff }));

    public Task NotificationsAsync(IEnumerable<int> userIds)
    {
        var groups = userIds.Distinct().Select(RealtimeHub.UserGroup).ToList();
        return groups.Count == 0 ? Task.CompletedTask : Safe(() => _hub.Clients.Groups(groups).SendAsync(RealtimeEvents.Notification, new { }));
    }

    private async Task Safe(Func<Task> send)
    {
        try { await send(); }
        catch (Exception ex) { _logger.LogWarning(ex, "Could not push a real-time update."); }
    }
}

/// <summary>
/// After a successful save, tells the browsers of everyone who just received a notification, wherever in the code it
/// was created (bookings, orders, prescriptions, the reminder job...). One hook instead of a call at every place.
/// </summary>
public class NotificationPushInterceptor : SaveChangesInterceptor
{
    private readonly IRealtimeNotifier _notifier;
    private readonly ConditionalWeakTable<DbContext, List<int>> _pending = new();

    public NotificationPushInterceptor(IRealtimeNotifier notifier) => _notifier = notifier;

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Remember(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Remember(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        var users = Take(eventData.Context);
        if (users.Count > 0) _ = _notifier.NotificationsAsync(users);
        return result;
    }

    public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        var users = Take(eventData.Context);
        if (users.Count > 0) await _notifier.NotificationsAsync(users);
        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => Take(eventData.Context);

    private void Remember(DbContext? context)
    {
        if (context is null) return;
        var users = context.ChangeTracker.Entries<Notification>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity.UserId)
            .ToList();
        if (users.Count > 0) _pending.AddOrUpdate(context, users);
    }

    private List<int> Take(DbContext? context)
    {
        if (context is null || !_pending.TryGetValue(context, out var users)) return new List<int>();
        _pending.Remove(context);
        return users;
    }
}
