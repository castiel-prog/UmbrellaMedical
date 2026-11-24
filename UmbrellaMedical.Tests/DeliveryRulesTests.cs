using UmbrellaMedical.Api.Services;
using Xunit;

namespace UmbrellaMedical.Tests;

public class DeliveryRulesTests
{
    [Theory]
    [InlineData(3.50, 5.00)]
    [InlineData(49.99, 5.00)]
    [InlineData(50.00, 0.00)]
    [InlineData(119.00, 0.00)]
    public void Delivery_is_free_from_50_GEL(double itemsTotal, double expectedFee)
    {
        Assert.Equal((decimal)expectedFee, DeliveryRules.FeeFor((decimal)itemsTotal));
    }

    [Theory]
    [InlineData("Tbilisi")]
    [InlineData("  tbilisi ")]
    [InlineData("TBILISI")]
    [InlineData("თბილისი")]
    [InlineData("Тбилиси")]
    public void Tbilisi_is_accepted_in_any_spelling(string city)
    {
        Assert.Equal("Tbilisi", DeliveryRules.NormalizeCity(city));
    }

    [Theory]
    [InlineData("Batumi")]
    [InlineData("")]
    [InlineData(null)]
    public void Other_cities_are_not_delivered_to(string? city)
    {
        Assert.Null(DeliveryRules.NormalizeCity(city));
    }
}
