using UmbrellaMedical.Api.Services;
using Xunit;

namespace UmbrellaMedical.Tests;

public class PresenceTrackerTests
{
    [Fact]
    public void Unknown_person_is_offline()
    {
        Assert.Equal(PresenceStatus.Offline, new PresenceTracker().Status(1));
    }

    [Fact]
    public void Opening_the_site_makes_the_person_online()
    {
        var presence = new PresenceTracker();
        presence.Connected(1);
        Assert.Equal(PresenceStatus.Online, presence.Status(1));
    }

    [Fact]
    public void Closing_the_last_tab_makes_the_person_offline_at_once()
    {
        var presence = new PresenceTracker();
        presence.Connected(1);
        presence.Disconnected(1);

        Assert.Equal(PresenceStatus.Offline, presence.Status(1));
        Assert.NotNull(presence.LastSeen(1));
    }

    [Fact]
    public void Closing_one_of_two_tabs_keeps_the_person_online()
    {
        var presence = new PresenceTracker();
        presence.Connected(1);
        presence.Connected(1);
        presence.Disconnected(1);

        Assert.Equal(PresenceStatus.Online, presence.Status(1));
    }

    [Fact]
    public void Idle_for_more_than_two_minutes_is_away()
    {
        var presence = new PresenceTracker();
        presence.Connected(1);
        presence.Heartbeat(1, idleSeconds: 0);
        Assert.Equal(PresenceStatus.Online, presence.Status(1));

        var idle = new PresenceTracker();
        idle.Heartbeat(2, idleSeconds: 150);
        Assert.Equal(PresenceStatus.Away, idle.Status(2));
    }

    [Fact]
    public void A_heartbeat_after_leaving_brings_the_person_back()
    {
        var presence = new PresenceTracker();
        presence.Connected(1);
        presence.Disconnected(1);
        Thread.Sleep(5);
        presence.Heartbeat(1, 0);

        Assert.Equal(PresenceStatus.Online, presence.Status(1));
    }

    [Fact]
    public void Best_status_of_a_team_is_online_if_anyone_is()
    {
        var presence = new PresenceTracker();
        presence.Heartbeat(2, idleSeconds: 300);
        presence.Connected(3);

        Assert.Equal(PresenceStatus.Online, presence.Best(new[] { 1, 2, 3 }));
        Assert.Equal(PresenceStatus.Away, presence.Best(new[] { 1, 2 }));
        Assert.Equal(PresenceStatus.Offline, presence.Best(new[] { 1 }));
    }
}
