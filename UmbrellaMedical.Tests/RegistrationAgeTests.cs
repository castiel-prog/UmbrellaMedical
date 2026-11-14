using UmbrellaMedical.Api.Controllers;
using Xunit;

namespace UmbrellaMedical.Tests;

public class RegistrationAgeTests
{
    private static readonly DateOnly Today = new(2026, 11, 14);

    [Theory]
    [InlineData("2008-11-14")]   // 18th birthday today
    [InlineData("2008-11-13")]   // turned 18 yesterday
    [InlineData("1990-05-05")]
    [InlineData("1930-01-01")]
    public void Adults_can_register(string dateOfBirth)
    {
        Assert.Null(AuthController.CheckAge(DateOnly.Parse(dateOfBirth), Today));
    }

    [Theory]
    [InlineData("2008-11-15")]   // turns 18 tomorrow
    [InlineData("2010-01-01")]
    [InlineData("2026-11-14")]   // born today
    public void Under_18s_cannot_register(string dateOfBirth)
    {
        var error = AuthController.CheckAge(DateOnly.Parse(dateOfBirth), Today);

        Assert.NotNull(error);
        Assert.Contains("at least 18", error);
    }

    [Fact]
    public void Future_dates_are_rejected()
    {
        var error = AuthController.CheckAge(new DateOnly(2027, 1, 1), Today);

        Assert.Equal("The date of birth cannot be in the future.", error);
    }

    [Fact]
    public void Missing_or_unrealistic_dates_are_rejected()
    {
        Assert.NotNull(AuthController.CheckAge(default, Today));
        Assert.NotNull(AuthController.CheckAge(new DateOnly(1890, 1, 1), Today));
    }
}
