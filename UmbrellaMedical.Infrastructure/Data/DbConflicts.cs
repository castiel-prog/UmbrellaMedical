using Npgsql;

namespace UmbrellaMedical.Infrastructure.Data;

/// <summary>
/// Recognises database errors that mean "two requests collided, try again":
/// a serializable transaction that lost a race (40001) or a deadlock (40P01).
/// EF Core may wrap them (DbUpdateException, InvalidOperationException), so the whole chain is checked.
/// </summary>
public static class DbConflicts
{
    public static bool IsTransientConflict(Exception? ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
        {
            if (e is PostgresException pg && (pg.SqlState == PostgresErrorCodes.SerializationFailure || pg.SqlState == PostgresErrorCodes.DeadlockDetected))
                return true;
        }
        return false;
    }
}
