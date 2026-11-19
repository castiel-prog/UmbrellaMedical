using System.Globalization;

namespace UmbrellaMedical.Api.Services;

/// <summary>Card details as typed by the patient. Never stored; only the last four digits are kept.</summary>
public sealed record CardDetails(string Number, int ExpiryMonth, int ExpiryYear, string Cvc, string HolderName);

public sealed record ChargeResult(bool Success, string? Reference, string? Error)
{
    public static ChargeResult Ok(string reference) => new(true, reference, null);
    public static ChargeResult Declined(string error) => new(false, null, error);
}

/// <summary>
/// Takes card payments. Swap <see cref="TestPaymentGateway"/> for a real provider
/// (Stripe, Bank of Georgia, TBC...) by implementing this interface and registering it in Program.cs.
/// </summary>
public interface IPaymentGateway
{
    bool IsTestMode { get; }
    Task<ChargeResult> ChargeAsync(decimal amount, CardDetails card, string description, CancellationToken cancellationToken);
    Task<bool> RefundAsync(string reference, decimal amount, CancellationToken cancellationToken);
}

/// <summary>
/// Simulated card processor for development and demos. Checks the card like a real form would
/// (number checksum, expiry, CVC) but moves no money. Test cards:
/// 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined, 4000 0000 0000 9995 has insufficient funds.
/// </summary>
public class TestPaymentGateway : IPaymentGateway
{
    private readonly IClinicClock _clock;

    public TestPaymentGateway(IClinicClock clock)
    {
        _clock = clock;
    }

    public bool IsTestMode => true;

    public Task<ChargeResult> ChargeAsync(decimal amount, CardDetails card, string description, CancellationToken cancellationToken)
    {
        var error = CardValidation.Check(card, _clock.Now);
        if (error is not null) return Task.FromResult(ChargeResult.Declined(error));

        var digits = CardValidation.Digits(card.Number);
        var result = digits switch
        {
            "4000000000000002" => ChargeResult.Declined("Your card was declined. Please use another card."),
            "4000000000009995" => ChargeResult.Declined("The card has insufficient funds."),
            _ => ChargeResult.Ok($"PAY-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()} {CardValidation.Brand(digits)} ****{digits[^4..]}")
        };

        return Task.FromResult(result);
    }

    public Task<bool> RefundAsync(string reference, decimal amount, CancellationToken cancellationToken) =>
        Task.FromResult(true);
}

public static class CardValidation
{
    public static string Digits(string value) => new(value.Where(char.IsDigit).ToArray());

    /// <summary>Returns a message describing what is wrong with the card, or null if it looks valid.</summary>
    public static string? Check(CardDetails card, DateTime now)
    {
        var digits = Digits(card.Number);
        if (digits.Length is < 12 or > 19 || !PassesLuhn(digits))
            return "The card number is not valid.";

        if (card.ExpiryMonth is < 1 or > 12)
            return "The expiry month is not valid.";

        var year = card.ExpiryYear < 100 ? 2000 + card.ExpiryYear : card.ExpiryYear;
        var lastValidDay = new DateTime(year, card.ExpiryMonth, 1).AddMonths(1);
        if (lastValidDay <= now.Date)
            return "The card has expired.";

        if (Digits(card.Cvc).Length is < 3 or > 4 || Digits(card.Cvc).Length != card.Cvc.Trim().Length)
            return "The security code (CVC) is not valid.";

        if (string.IsNullOrWhiteSpace(card.HolderName))
            return "Enter the name on the card.";

        return null;
    }

    public static string Brand(string digits) => digits[0] switch
    {
        '4' => "Visa",
        '5' or '2' => "Mastercard",
        '3' => "Amex",
        _ => "Card"
    };

    private static bool PassesLuhn(string digits)
    {
        var sum = 0;
        var doubleIt = false;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var d = digits[i] - '0';
            if (doubleIt)
            {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
            doubleIt = !doubleIt;
        }
        return sum % 10 == 0;
    }

    public static string Money(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);
}
