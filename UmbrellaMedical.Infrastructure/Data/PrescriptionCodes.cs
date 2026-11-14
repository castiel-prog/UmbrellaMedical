using System.Security.Cryptography;

namespace UmbrellaMedical.Infrastructure.Data;

/// <summary>Prescription codes such as RX-000042-K7QD: the prescription number plus a random part that can't be guessed.</summary>
public static class PrescriptionCodes
{
    // No 0/O or 1/I/L, so codes are easy to read and type.
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static string For(int prescriptionId)
    {
        Span<char> random = stackalloc char[4];
        for (var i = 0; i < random.Length; i++)
            random[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        return $"RX-{prescriptionId:D6}-{new string(random)}";
    }

    /// <summary>Upper-case, trimmed, with spaces removed, so "rx-000042-k7qd " matches.</summary>
    public static string Normalize(string code) => code.Trim().Replace(" ", "").ToUpperInvariant();
}
