using System.Collections.Concurrent;

namespace UmbrellaMedical.Api.Services;

public enum PresenceStatus { Online, Away, Offline }

/// <summary>
/// Who is on the site right now.
/// - A live SignalR connection (any open tab) makes the person present; when their last connection closes they are
///   offline immediately.
/// - Each tab also reports, every ~25 seconds, how long ago the person last clicked, typed or scrolled.
///   Online = active in the last 2 minutes; Away = the site is open but idle for 2+ minutes.
/// - Without a live connection (e.g. WebSockets blocked) the heartbeat alone keeps them present; no heartbeat for
///   75 seconds = offline.
/// Kept in memory: it is live state, not data worth storing.
/// </summary>
public class PresenceTracker
{
    public static readonly TimeSpan HeartbeatTimeout = TimeSpan.FromSeconds(75);
    public static readonly TimeSpan AwayAfter = TimeSpan.FromMinutes(2);

    private readonly ConcurrentDictionary<int, (DateTime Seen, DateTime Active)> _users = new();
    private readonly ConcurrentDictionary<int, int> _connections = new();
    private readonly ConcurrentDictionary<int, DateTime> _leftAt = new();

    /// <summary>Records a heartbeat; <paramref name="idleSeconds"/> is how long ago the person last did something on the site.</summary>
    public void Heartbeat(int userId, int idleSeconds)
    {
        var now = DateTime.UtcNow;
        var active = now.AddSeconds(-Math.Clamp(idleSeconds, 0, 3600));
        _users.AddOrUpdate(userId, (now, active), (_, old) => (now, active > old.Active ? active : old.Active));
    }

    /// <summary>Any action (like sending a chat message) counts as activity.</summary>
    public void Active(int userId) => Heartbeat(userId, 0);

    /// <summary>A tab opened a live connection.</summary>
    public void Connected(int userId)
    {
        _connections.AddOrUpdate(userId, 1, (_, n) => n + 1);
        _leftAt.TryRemove(userId, out _);
        Active(userId);
    }

    /// <summary>A tab closed its live connection; with no tab left the person is offline at once.</summary>
    public void Disconnected(int userId)
    {
        var left = _connections.AddOrUpdate(userId, 0, (_, n) => Math.Max(0, n - 1));
        if (left == 0)
        {
            _connections.TryRemove(userId, out _);
            _leftAt[userId] = DateTime.UtcNow;
        }
    }

    public PresenceStatus Status(int userId)
    {
        if (!_users.TryGetValue(userId, out var p)) return PresenceStatus.Offline;
        // Closed the last tab, and no heartbeat came in after that.
        if (_leftAt.TryGetValue(userId, out var left) && left >= p.Seen) return PresenceStatus.Offline;

        var now = DateTime.UtcNow;
        var live = _connections.ContainsKey(userId);
        if (!live && now - p.Seen > HeartbeatTimeout) return PresenceStatus.Offline;
        return now - p.Active > AwayAfter ? PresenceStatus.Away : PresenceStatus.Online;
    }

    /// <summary>When the person was last seen on the site (null = not since the server started).</summary>
    public DateTime? LastSeen(int userId)
    {
        if (!_users.TryGetValue(userId, out var p)) return null;
        return _leftAt.TryGetValue(userId, out var left) && left > p.Seen ? left : p.Seen;
    }

    /// <summary>The best status among several people (e.g. "is any support agent online?").</summary>
    public PresenceStatus Best(IEnumerable<int> userIds)
    {
        var best = PresenceStatus.Offline;
        foreach (var id in userIds)
        {
            var s = Status(id);
            if (s < best) best = s;
            if (best == PresenceStatus.Online) break;
        }
        return best;
    }
}
