using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

public sealed record DirectoryService(string Name, decimal Price, int Minutes, string Department);

public sealed record DirectoryShift(DayOfWeek Day, TimeOnly Start, TimeOnly End);

public sealed record DirectoryDoctor(
    int Id, string FirstName, string LastName, string Specialization, int Years,
    decimal Rating, int Reviews, string? Bio,
    IReadOnlyList<DirectoryService> Services, IReadOnlyList<DirectoryShift> Hours)
{
    public string FullName => $"Dr. {FirstName} {LastName}";
}

public sealed record DirectorySpecialization(string Name, string? Description);

/// <summary>Public facts about the clinic: who works here, what it offers and when. No patient data.</summary>
public sealed record ClinicSnapshot(
    DateTime Now,
    IReadOnlyList<DirectorySpecialization> Specializations,
    IReadOnlyList<DirectoryService> Services,
    IReadOnlyList<DirectoryDoctor> Doctors,
    IReadOnlyList<string> Insurers);

public interface IClinicDirectory
{
    Task<ClinicSnapshot> GetAsync(CancellationToken cancellationToken);
}

/// <summary>Loads the public clinic facts from the database and caches them for a few minutes.</summary>
public class ClinicDirectory : IClinicDirectory
{
    private const string CacheKey = "clinic:directory";
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopes;
    private readonly IMemoryCache _cache;

    public ClinicDirectory(IServiceScopeFactory scopes, IMemoryCache cache)
    {
        _scopes = scopes;
        _cache = cache;
    }

    public async Task<ClinicSnapshot> GetAsync(CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(CacheKey, out ClinicSnapshot? cached) && cached is not null) return cached;

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<UmbrellaDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClinicClock>();

        var doctorRows = await db.Doctors.AsNoTracking()
            .Where(d => d.User.IsActive)
            .OrderBy(d => d.Specialization.Name).ThenBy(d => d.LastName)
            .Select(d => new
            {
                d.Id, d.FirstName, d.LastName, Specialization = d.Specialization.Name, d.YearsOfExperience,
                d.AverageRating, d.ReviewCount, d.Bio,
                Services = d.DoctorServices.Where(ds => ds.Service.IsActive)
                    .Select(ds => new { ds.Service.Name, ds.Service.Price, ds.Service.DurationMinutes, Department = ds.Service.Department.Name })
                    .ToList(),
                Hours = d.Schedules.Where(s => s.IsActive)
                    .Select(s => new { s.DayOfWeek, s.StartTime, s.EndTime })
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        var doctors = doctorRows.Select(d => new DirectoryDoctor(
                d.Id, d.FirstName, d.LastName, d.Specialization, d.YearsOfExperience, d.AverageRating, d.ReviewCount, d.Bio,
                d.Services.Select(s => new DirectoryService(s.Name, s.Price, s.DurationMinutes, s.Department)).ToList(),
                d.Hours.Select(h => new DirectoryShift(h.DayOfWeek, h.StartTime, h.EndTime)).ToList()))
            .ToList();

        var specializations = await db.Specializations.AsNoTracking().OrderBy(s => s.Name)
            .Select(s => new DirectorySpecialization(s.Name, s.Description))
            .ToListAsync(cancellationToken);

        var services = await db.Services.AsNoTracking().Where(s => s.IsActive)
            .OrderBy(s => s.Department.Name).ThenBy(s => s.Name)
            .Select(s => new DirectoryService(s.Name, s.Price, s.DurationMinutes, s.Department.Name))
            .ToListAsync(cancellationToken);

        var insurers = await db.InsuranceCompanies.AsNoTracking().Where(i => i.IsActive)
            .OrderBy(i => i.Name).Select(i => i.Name)
            .ToListAsync(cancellationToken);

        var snapshot = new ClinicSnapshot(clock.Now, specializations, services, doctors, insurers);
        _cache.Set(CacheKey, snapshot, Lifetime);
        return snapshot;
    }

    /// <summary>"Mon-Fri 09:00-13:00, 14:00-18:00; Sat 10:00-14:00" (consecutive days with the same hours are joined).</summary>
    public static string DescribeHours(IEnumerable<DirectoryShift> hours)
    {
        var days = hours
            .GroupBy(h => h.Day)
            .Select(g => (Order: ((int)g.Key + 6) % 7, Name: g.Key.ToString()[..3],
                          Shifts: string.Join(", ", g.OrderBy(h => h.Start).Select(h => $"{h.Start:HH\\:mm}-{h.End:HH\\:mm}"))))
            .OrderBy(d => d.Order)   // Monday first
            .ToList();
        if (days.Count == 0) return "not set yet";

        var parts = new List<string>();
        var i = 0;
        while (i < days.Count)
        {
            var j = i;
            while (j + 1 < days.Count && days[j + 1].Order == days[j].Order + 1 && days[j + 1].Shifts == days[i].Shifts) j++;
            var label = j > i ? $"{days[i].Name}-{days[j].Name}" : days[i].Name;
            parts.Add($"{label} {days[i].Shifts}");
            i = j + 1;
        }
        return string.Join("; ", parts);
    }
}
