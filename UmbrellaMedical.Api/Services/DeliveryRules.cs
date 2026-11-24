namespace UmbrellaMedical.Api.Services;

/// <summary>
/// Home delivery of pharmacy orders: where we deliver, what it costs and how long it takes.
/// The website reads these from GET /api/store/delivery, so the numbers live in one place.
/// </summary>
public static class DeliveryRules
{
    /// <summary>Delivery charge in GEL.</summary>
    public const decimal Fee = 5.00m;

    /// <summary>Orders whose items cost at least this much (GEL) are delivered for free.</summary>
    public const decimal FreeFrom = 50.00m;

    /// <summary>Cities the courier delivers to.</summary>
    public static readonly IReadOnlyList<string> Cities = new[] { "Tbilisi" };

    /// <summary>Promised delivery time, in hours from when the order is ready.</summary>
    public const int WithinHours = 24;

    /// <summary>The delivery charge for items costing <paramref name="itemsTotal"/>.</summary>
    public static decimal FeeFor(decimal itemsTotal) => itemsTotal >= FreeFrom ? 0m : Fee;

    /// <summary>The supported city with its standard spelling, or null when we don't deliver there.</summary>
    public static string? NormalizeCity(string? city)
    {
        var value = city?.Trim();
        if (string.IsNullOrEmpty(value)) return null;
        // Also accept the Georgian and Russian names of Tbilisi.
        if (value.Equals("თბილისი", StringComparison.Ordinal) || value.Equals("Тбилиси", StringComparison.OrdinalIgnoreCase)) return "Tbilisi";
        return Cities.FirstOrDefault(c => c.Equals(value, StringComparison.OrdinalIgnoreCase));
    }
}
