using Microsoft.Extensions.Options;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Api.Settings;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;
using Xunit;

namespace UmbrellaMedical.Tests;

public class UserTokenServiceTests
{
    private static (UmbrellaDbContext Db, UserTokenService Service) Setup()
    {
        var db = TestDb.Create();
        var settings = Options.Create(new JwtSettings { Key = "unit-test-signing-key-0123456789-abcdef" });
        return (db, new UserTokenService(db, settings));
    }

    private static string WrongCodeFor(string code) => code == "000000" ? "111111" : "000000";

    [Fact]
    public async Task A_code_has_six_digits()
    {
        var (_, service) = Setup();

        var code = await service.IssueAsync(1, UserTokenPurpose.EmailVerification);

        Assert.NotNull(code);
        Assert.Equal(6, code!.Length);
        Assert.All(code, c => Assert.True(char.IsDigit(c)));
    }

    [Fact]
    public async Task The_code_itself_is_never_stored()
    {
        var (db, service) = Setup();

        var code = await service.IssueAsync(1, UserTokenPurpose.PasswordReset);

        var stored = Assert.Single(db.UserTokens);
        Assert.DoesNotContain(code!, stored.TokenHash);
        Assert.NotEqual(code, stored.TokenHash);
    }

    [Fact]
    public async Task A_correct_code_works_only_once()
    {
        var (db, service) = Setup();
        var code = await service.IssueAsync(1, UserTokenPurpose.EmailVerification);

        var first = await service.ConsumeAsync(1, UserTokenPurpose.EmailVerification, code!);
        await db.SaveChangesAsync();
        var second = await service.ConsumeAsync(1, UserTokenPurpose.EmailVerification, code!);

        Assert.NotNull(first);
        Assert.Null(second);
    }

    [Fact]
    public async Task A_wrong_code_is_rejected_and_counted()
    {
        var (db, service) = Setup();
        var code = await service.IssueAsync(1, UserTokenPurpose.EmailVerification);

        var result = await service.ConsumeAsync(1, UserTokenPurpose.EmailVerification, WrongCodeFor(code!));

        Assert.Null(result);
        Assert.Equal(1, Assert.Single(db.UserTokens).FailedAttempts);
    }

    [Fact]
    public async Task The_code_is_locked_after_five_wrong_attempts()
    {
        var (_, service) = Setup();
        var code = await service.IssueAsync(1, UserTokenPurpose.PasswordReset);

        for (var i = 0; i < 5; i++)
            await service.ConsumeAsync(1, UserTokenPurpose.PasswordReset, WrongCodeFor(code!));

        var result = await service.ConsumeAsync(1, UserTokenPurpose.PasswordReset, code!);

        Assert.Null(result);
    }

    [Fact]
    public async Task Asking_again_straight_away_is_refused()
    {
        var (_, service) = Setup();

        var first = await service.IssueAsync(1, UserTokenPurpose.EmailVerification);
        var second = await service.IssueAsync(1, UserTokenPurpose.EmailVerification);

        Assert.NotNull(first);
        Assert.Null(second);
    }

    [Fact]
    public async Task A_code_does_not_work_for_another_purpose_or_user()
    {
        var (_, service) = Setup();
        var code = await service.IssueAsync(1, UserTokenPurpose.EmailVerification);

        var otherPurpose = await service.ConsumeAsync(1, UserTokenPurpose.PasswordReset, code!);
        var otherUser = await service.ConsumeAsync(2, UserTokenPurpose.EmailVerification, code!);

        Assert.Null(otherPurpose);
        Assert.Null(otherUser);
    }

    [Fact]
    public async Task An_expired_code_is_rejected()
    {
        var (db, service) = Setup();
        var code = await service.IssueAsync(1, UserTokenPurpose.PasswordReset);

        db.UserTokens.Single().ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        var result = await service.ConsumeAsync(1, UserTokenPurpose.PasswordReset, code!);

        Assert.Null(result);
    }

    [Fact]
    public async Task The_new_email_is_kept_with_an_email_change_code()
    {
        var (_, service) = Setup();
        var code = await service.IssueAsync(1, UserTokenPurpose.EmailChange, "new@example.com");

        var token = await service.ConsumeAsync(1, UserTokenPurpose.EmailChange, code!);

        Assert.NotNull(token);
        Assert.Equal("new@example.com", token!.NewEmail);
    }
}