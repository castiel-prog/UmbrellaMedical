using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// Server-side translations for emails, notifications, the help chat and PDFs. Texts are written in English and
/// looked up in SeedData/i18n/{lang}.json; anything missing falls back to English. Placeholders use {name},
/// the same convention as the website's own translations.
/// </summary>
public interface IClinicText
{
    /// <summary>The text in the given language, with {placeholders} filled from <paramref name="args"/>.</summary>
    string T(string? lang, string text, IReadOnlyDictionary<string, object?>? args = null);

    /// <summary>A supported language code ("en", "ka", ...), defaulting to English.</summary>
    string Normalize(string? lang);

    CultureInfo Culture(string? lang);
}

public sealed class ClinicText : IClinicText
{
    public static readonly string[] Languages = { "en", "ka", "de", "fr", "it", "es", "ru" };

    private static readonly Dictionary<string, string> Cultures = new()
    {
        ["en"] = "en-GB", ["ka"] = "ka-GE", ["de"] = "de-DE", ["fr"] = "fr-FR", ["it"] = "it-IT", ["es"] = "es-ES", ["ru"] = "ru-RU"
    };

    private readonly string _folder;
    private readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, string>> _dictionaries = new();
    private readonly ILogger<ClinicText> _logger;

    public ClinicText(IWebHostEnvironment env, ILogger<ClinicText> logger)
    {
        _folder = Path.Combine(env.ContentRootPath, "SeedData", "i18n");
        _logger = logger;
    }

    public string Normalize(string? lang)
    {
        var code = (lang ?? "").Trim().ToLowerInvariant();
        if (code.Length > 2) code = code[..2];
        return Array.IndexOf(Languages, code) >= 0 ? code : "en";
    }

    public CultureInfo Culture(string? lang) => CultureInfo.GetCultureInfo(Cultures[Normalize(lang)]);

    public string T(string? lang, string text, IReadOnlyDictionary<string, object?>? args = null)
    {
        var code = Normalize(lang);
        var output = code == "en" || !Load(code).TryGetValue(text, out var translated) ? text : translated;
        if (args is not null)
            foreach (var (key, value) in args)
                output = output.Replace("{" + key + "}", Convert.ToString(value, Culture(code)) ?? "");
        return output;
    }

    private IReadOnlyDictionary<string, string> Load(string code) =>
        _dictionaries.GetOrAdd(code, c =>
        {
            var file = Path.Combine(_folder, c + ".json");
            try
            {
                return File.Exists(file)
                    ? JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(file)) ?? new()
                    : new Dictionary<string, string>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not read the {Language} server translations.", c);
                return new Dictionary<string, string>();
            }
        });
}

/// <summary>Short helper for building placeholder values: Args.Of(("name", value), ...).</summary>
public static class Args
{
    public static IReadOnlyDictionary<string, object?> Of(params (string Key, object? Value)[] values) =>
        values.ToDictionary(v => v.Key, v => v.Value);
}
