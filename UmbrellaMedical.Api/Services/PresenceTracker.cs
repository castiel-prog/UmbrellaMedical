using System.Collections.Concurrent;

namespace UmbrellaMedical.Api.Services;

public enum PresenceStatus { Online, Away, Offline }

/// <summary>
/// Who is on the site right now. Each open tab sends a heartbeat every ~25 seconds saying whether the person has
/// clicked, typed or scrolled in the last two minutes.
/// Online = active in the last 2 minutes; Away = the site is open but idle for 2+ minutes; Offline = no heartbeat.
/// Kept in memory: it is live state, not data worth storing.
/// </summary>
public class PresenceTracker
{
    public static readonly TimeSpan HeartbeatTimeout = TimeSpan.FromSeconds(75);
    public static readonly TimeSpan AwayAfter = TimeSpan.FromMinutes(2);

    private readonly ConcurrentDictionary<int, (DateTime Seen, DateTime Active)> _users = new();

    /// <summary>Records a heartbeat; <paramref name="idleSeconds"/> is how long ago the person last did something on the site.</summary>
    public void Heartbeat(int userId, int idleSeconds)
    {
        var now = DateTime.UtcNow;
        var active = now.AddSeconds(-Math.Clamp(idleSeconds, 0, 3600));
        _users.AddOrUpdate(userId, (now, active), (_, old) => (now, active > old.Active ? active : old.Active));
    }

    /// <summary>Any action (like sending a chat message) counts as activity.</summary>
    public void Active(int userId) => Heartbeat(userId, 0);

    public PresenceStatus Status(int userId)
    {
        if (!_users.TryGetValue(userId, out var p)) return PresenceStatus.Offline;
        var now = DateTime.UtcNow;
        if (now - p.Seen > HeartbeatTimeout) return PresenceStatus.Offline;
        return now - p.Active > AwayAfter ? PresenceStatus.Away : PresenceStatus.Online;
    }

    /// <summary>When the person was last seen on the site (null = not since the server started).</summary>
    public DateTime? LastSeen(int userId) => _users.TryGetValue(userId, out var p) ? p.Seen : null;

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
