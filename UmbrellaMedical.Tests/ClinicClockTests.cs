using Microsoft.Extensions.Configuration;
using UmbrellaMedical.Api.Services;
using Xunit;

namespace UmbrellaMedical.Tests;

public class ClinicClockTests
{
    private static ClinicClock CreateClock()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Clinic:TimeZone"] = "Asia/Tbilisi" })
            .Build();

        return new ClinicClock(config);
    }

    [Fact]
    public void Utc_values_are_converted_to_clinic_time()
    {
        var clock = CreateClock();

        var result = clock.ToClinicTime(new DateTime(2026, 11, 2, 6, 0, 0, DateTimeKind.Utc));

        Assert.Equal(new DateTime(2026, 11, 2, 10, 0, 0), result);
    }

    [Fact]
    public void Unspecified_values_are_left_as_they_are()
    {
        var clock = CreateClock();
        var value = new DateTime(2026, 11, 2, 10, 0, 0, DateTimeKind.Unspecified);

        Assert.Equal(value, clock.ToClinicTime(value));
    }

    [Fact]
    public void Now_has_an_unspecified_kind()
    {
        var clock = CreateClock();

        Assert.Equal(DateTimeKind.Unspecified, clock.Now.Kind);
    }
}