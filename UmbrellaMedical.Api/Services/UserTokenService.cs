using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using UmbrellaMedical.Api.Settings;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

public interface IUserTokenService
{
    Task<string?> IssueAsync(int userId, UserTokenPurpose purpose, string? newEmail = null);
    Task<UserToken?> ConsumeAsync(int userId, UserTokenPurpose purpose, string code);
}

public class UserTokenService : IUserTokenService
{
    public const int CodeLifetimeMinutes = 10;
    private const int MaxAttempts = 5;
    private const int ResendCooldownSeconds = 60;

    private readonly UmbrellaDbContext _db;
    private readonly byte[] _key;

    public UserTokenService(UmbrellaDbContext db, IOptions<JwtSettings> jwt)
    {
        _db = db;
        _key = SHA256.HashData(Encoding.UTF8.GetBytes("user-token-codes:" + jwt.Value.Key));
    }

    public async Task<string?> IssueAsync(int userId, UserTokenPurpose purpose, string? newEmail = null)
    {
        var now = DateTime.UtcNow;

        var open = await _db.UserTokens
            .Where(t => t.UserId == userId && t.Purpose == purpose && t.UsedAt == null && t.ExpiresAt > now)
            .ToListAsync();

        if (open.Any(t => now - t.CreatedAt < TimeSpan.FromSeconds(ResendCooldownSeconds)))
            return null;

        foreach (var old in open) old.UsedAt = now;

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        _db.UserTokens.Add(new UserToken
        {
            UserId = userId,
            Purpose = purpose,
            TokenHash = Hash(userId, purpose, code),
            ExpiresAt = now.AddMinutes(CodeLifetimeMinutes),
            NewEmail = newEmail
        });

        await _db.SaveChangesAsync();
        return code;
    }

    public async Task<UserToken?> ConsumeAsync(int userId, UserTokenPurpose purpose, string code)
    {
        var now = DateTime.UtcNow;

        var token = await _db.UserTokens
            .Where(t => t.UserId == userId
                        && t.Purpose == purpose
                        && t.UsedAt == null
                        && t.ExpiresAt > now
                        && t.FailedAttempts < MaxAttempts)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();

        if (token is null) return null;

        var expected = Convert.FromHexString(token.TokenHash);
        var actual = Convert.FromHexString(Hash(userId, purpose, code));

        if (!CryptographicOperations.FixedTimeEquals(expected, actual))
        {
            token.FailedAttempts++;
            await _db.SaveChangesAsync();
            return null;
        }

        token.UsedAt = now;
        return token;
    }

    private string Hash(int userId, UserTokenPurpose purpose, string code)
    {
        var data = Encoding.UTF8.GetBytes($"{userId}:{(int)purpose}:{code}");
        return Convert.ToHexString(HMACSHA256.HashData(_key, data));
    }
}