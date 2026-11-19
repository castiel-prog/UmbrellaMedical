using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// Gives each pharmacy product without a photo the matching photo shipped with the API
/// (SeedData/products/{name-as-slug}.jpg). Photos an admin uploaded are never replaced. Safe to run on every start.
/// </summary>
public static partial class ProductImageSeeder
{
    public static async Task<int> SeedAsync(UmbrellaDbContext db, IFileStorage storage, string contentRoot, CancellationToken cancellationToken = default)
    {
        var folder = Path.Combine(contentRoot, "SeedData", "products");
        if (!Directory.Exists(folder)) return 0;

        var products = await db.Products.Where(p => p.ImageKey == null).ToListAsync(cancellationToken);
        var added = 0;
        foreach (var product in products)
        {
            var file = Path.Combine(folder, Slug(product.Name) + ".jpg");
            if (!File.Exists(file)) continue;

            await using var stream = File.OpenRead(file);
            product.ImageKey = await storage.SaveAsync(stream, ".jpg", cancellationToken);
            product.ImageVersion++;
            added++;
        }

        if (added > 0) await db.SaveChangesAsync(cancellationToken);
        return added;
    }

    /// <summary>"Iron + folic acid" -> "iron-folic-acid".</summary>
    public static string Slug(string name) => NonAlphanumeric().Replace(name.ToLowerInvariant(), "-").Trim('-');

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphanumeric();
}
