using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// The "visit summary" PDF a patient (or their care team) can download for a medical record: who, when, what was
/// found, what to do next and the prescriptions written at the visit. Labels follow the reader's language.
/// </summary>
public interface IVisitSummaryPdf
{
    /// <summary>The PDF bytes and a file name, or null when the record does not exist.</summary>
    Task<(byte[] Pdf, string FileName)?> BuildAsync(int medicalRecordId, string? lang, CancellationToken cancellationToken);
}

public sealed class VisitSummaryPdf : IVisitSummaryPdf
{
    private const string Fonts = "Noto Sans";
    private const string GeorgianFonts = "Noto Sans Georgian";
    private static readonly Color Brand = Color.FromHex("#C8102E");
    private static readonly Color Muted = Color.FromHex("#5C5C63");
    private static readonly Color Line = Color.FromHex("#E3E3E8");
    private static int _fontsLoaded;

    private readonly UmbrellaDbContext _db;
    private readonly IClinicText _text;
    private readonly IClinicClock _clock;

    public VisitSummaryPdf(UmbrellaDbContext db, IClinicText text, IClinicClock clock, IWebHostEnvironment env)
    {
        _db = db;
        _text = text;
        _clock = clock;
        LoadFonts(env.ContentRootPath);
    }

    private static void LoadFonts(string contentRoot)
    {
        if (Interlocked.Exchange(ref _fontsLoaded, 1) == 1) return;
        QuestPDF.Settings.License = LicenseType.Community;
        var folder = Path.Combine(contentRoot, "SeedData", "fonts");
        if (!Directory.Exists(folder)) return;
        foreach (var file in Directory.GetFiles(folder, "*.ttf"))
        {
            using var stream = File.OpenRead(file);
            QuestPDF.Drawing.FontManager.RegisterFont(stream);
        }
    }

    public async Task<(byte[] Pdf, string FileName)?> BuildAsync(int medicalRecordId, string? lang, CancellationToken cancellationToken)
    {
        lang = _text.Normalize(lang);
        var culture = _text.Culture(lang);
        string T(string text, params (string, object?)[] args) => _text.T(lang, text, args.Length == 0 ? null : Args.Of(args));

        var r = await _db.MedicalRecords.AsNoTracking()
            .Where(m => m.Id == medicalRecordId)
            .Select(m => new
            {
                m.Id, m.RecordDate, m.Complaints, m.DiagnosisDetails, m.Treatment, m.Recommendations,
                Patient = new { m.Patient.FirstName, m.Patient.LastName, m.Patient.PersonalNumber, m.Patient.DateOfBirth },
                Doctor = new { m.Doctor.FirstName, m.Doctor.LastName, Specialization = m.Doctor.Specialization.Name },
                Service = m.Appointment != null ? m.Appointment.Service.Name : null,
                VisitStart = m.Appointment != null ? (DateTime?)m.Appointment.StartDateTime : null,
                Diagnosis = m.Diagnosis != null ? m.Diagnosis.Code + " · " + m.Diagnosis.Name : null,
                Vitals = m.VitalSigns.OrderByDescending(v => v.RecordedAt)
                    .Select(v => new { v.HeightCm, v.WeightKg, v.SystolicBp, v.DiastolicBp, v.HeartRate, v.TemperatureC }).FirstOrDefault(),
                Teeth = m.ToothRecords.OrderBy(t => t.ToothNumber).Select(t => new { t.ToothNumber, Condition = t.Condition.ToString(), t.Treatment }).ToList(),
                Prescriptions = m.Prescriptions.OrderBy(p => p.IssuedDate).Select(p => new
                {
                    p.Code, p.ExpiryDate, p.Instructions,
                    Items = p.Items.Select(i => new { i.Medication.Name, i.Medication.Strength, i.Dosage, i.Frequency, i.DurationDays }).ToList()
                }).ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (r is null) return null;

        var visitDate = r.VisitStart ?? r.RecordDate;
        string Date(DateTime d) => d.ToString("d MMMM yyyy", culture);

        var pdf = Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(s => s.FontFamily(Fonts, GeorgianFonts).FontSize(10).FontColor(Colors.Black));

            page.Header().Column(head =>
            {
                head.Item().Row(row =>
                {
                    row.ConstantItem(42).Image(EmailLogo.Bytes);
                    row.ConstantItem(10);
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Umbrella Medical Center").FontSize(15).Bold();
                        c.Item().Text("12 Shota Rustaveli Avenue, 0108 Tbilisi · +995 32 255 12 12 · umbrellaclinic.xyz").FontSize(8).FontColor(Muted);
                    });
                    row.AutoItem().AlignRight().Column(c =>
                    {
                        c.Item().AlignRight().Text(T("Visit summary")).FontSize(15).Bold().FontColor(Brand);
                        c.Item().AlignRight().Text(Date(visitDate)).FontSize(9).FontColor(Muted);
                    });
                });
                head.Item().PaddingTop(8).LineHorizontal(2).LineColor(Brand);
            });

            page.Content().PaddingTop(14).Column(col =>
            {
                col.Spacing(12);

                // Who and when
                col.Item().Border(1).BorderColor(Line).Padding(10).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        Field(c, T("Patient"), $"{r.Patient.FirstName} {r.Patient.LastName}");
                        Field(c, T("Personal number"), r.Patient.PersonalNumber);
                        Field(c, T("Date of birth"), r.Patient.DateOfBirth.ToString("d MMMM yyyy", culture));
                    });
                    row.ConstantItem(16);
                    row.RelativeItem().Column(c =>
                    {
                        Field(c, T("Doctor"), $"Dr. {r.Doctor.FirstName} {r.Doctor.LastName}");
                        Field(c, T("Specialization"), T(r.Doctor.Specialization));
                        Field(c, T("Visit"), r.Service is null ? Date(visitDate) : $"{r.Service} · {visitDate.ToString("d MMMM yyyy, HH:mm", culture)}");
                    });
                });

                Section(col, T("Complaints"), r.Complaints);
                if (r.Diagnosis is not null || !string.IsNullOrWhiteSpace(r.DiagnosisDetails))
                    col.Item().Column(c =>
                    {
                        Heading(c, T("Diagnosis"));
                        if (r.Diagnosis is not null) c.Item().Text(r.Diagnosis).Bold();
                        if (!string.IsNullOrWhiteSpace(r.DiagnosisDetails)) c.Item().Text(r.DiagnosisDetails);
                    });
                Section(col, T("Treatment"), r.Treatment);
                Section(col, T("Recommendations"), r.Recommendations);

                if (r.Vitals is { } v)
                {
                    var vitals = new List<(string, string)>();
                    if (v.SystolicBp is not null && v.DiastolicBp is not null) vitals.Add((T("Blood pressure"), $"{v.SystolicBp}/{v.DiastolicBp} mmHg"));
                    if (v.HeartRate is not null) vitals.Add((T("Heart rate"), $"{v.HeartRate} bpm"));
                    if (v.TemperatureC is not null) vitals.Add((T("Temperature"), $"{v.TemperatureC.Value.ToString("0.0", culture)} °C"));
                    if (v.HeightCm is not null) vitals.Add((T("Height"), $"{v.HeightCm.Value.ToString("0.#", culture)} cm"));
                    if (v.WeightKg is not null) vitals.Add((T("Weight"), $"{v.WeightKg.Value.ToString("0.#", culture)} kg"));
                    if (vitals.Count > 0)
                        col.Item().Column(c =>
                        {
                            Heading(c, T("Vital signs"));
                            c.Item().Row(row =>
                            {
                                foreach (var (label, value) in vitals)
                                    row.RelativeItem().Border(1).BorderColor(Line).Padding(6).Column(cell =>
                                    {
                                        cell.Item().Text(label).FontSize(8).FontColor(Muted);
                                        cell.Item().Text(value).Bold();
                                    });
                            });
                        });
                }

                if (r.Teeth.Count > 0)
                    col.Item().Column(c =>
                    {
                        Heading(c, T("Dental chart"));
                        foreach (var t in r.Teeth)
                            c.Item().Text(text =>
                            {
                                text.Span(T("Tooth {n}", ("n", t.ToothNumber)) + ": ").Bold();
                                text.Span(T(t.Condition));
                                if (!string.IsNullOrWhiteSpace(t.Treatment)) text.Span(" · " + t.Treatment);
                            });
                    });

                if (r.Prescriptions.Count > 0)
                    col.Item().Column(c =>
                    {
                        Heading(c, T("Prescriptions"));
                        foreach (var p in r.Prescriptions)
                            c.Item().PaddingBottom(8).Border(1).BorderColor(Line).Padding(8).Column(pc =>
                            {
                                pc.Item().Row(row =>
                                {
                                    row.RelativeItem().Text(p.Code is null ? T("Prescription") : T("Pharmacy code") + ": " + p.Code).Bold();
                                    row.AutoItem().Text(T("valid until {date}", ("date", Date(p.ExpiryDate)))).FontSize(9).FontColor(Muted);
                                });
                                pc.Item().PaddingTop(4).Table(table =>
                                {
                                    table.ColumnsDefinition(d => { d.RelativeColumn(3); d.RelativeColumn(2); d.RelativeColumn(2); d.RelativeColumn(1); });
                                    table.Header(h =>
                                    {
                                        foreach (var label in new[] { T("Medicine"), T("Dose"), T("How often"), T("Days") })
                                            h.Cell().BorderBottom(1).BorderColor(Line).PaddingBottom(3).Text(label).FontSize(8).FontColor(Muted);
                                    });
                                    foreach (var i in p.Items)
                                    {
                                        table.Cell().PaddingVertical(3).Text(string.IsNullOrWhiteSpace(i.Strength) ? i.Name : $"{i.Name} {i.Strength}");
                                        table.Cell().PaddingVertical(3).Text(i.Dosage);
                                        table.Cell().PaddingVertical(3).Text(i.Frequency);
                                        table.Cell().PaddingVertical(3).Text(i.DurationDays.ToString(culture));
                                    }
                                });
                                if (!string.IsNullOrWhiteSpace(p.Instructions))
                                    pc.Item().PaddingTop(4).Text(T("Instructions") + ": " + p.Instructions).FontSize(9);
                            });
                    });
            });

            page.Footer().Column(foot =>
            {
                foot.Item().LineHorizontal(1).LineColor(Line);
                foot.Item().PaddingTop(4).Row(row =>
                {
                    row.RelativeItem().Text(T("Created {date}. This summary is for your information; follow your doctor's advice.",
                        ("date", _clock.Now.ToString("d MMMM yyyy, HH:mm", culture)))).FontSize(7).FontColor(Muted);
                    row.AutoItem().Text(t =>
                    {
                        t.DefaultTextStyle(s => s.FontSize(7).FontColor(Muted));
                        t.CurrentPageNumber();
                        t.Span(" / ");
                        t.TotalPages();
                    });
                });
            });
        })).GeneratePdf();

        var fileName = $"visit-summary-{visitDate:yyyy-MM-dd}-{r.Id}.pdf";
        return (pdf, fileName);

        static void Field(ColumnDescriptor c, string label, string value)
        {
            c.Item().Text(label).FontSize(8).FontColor(Muted);
            c.Item().PaddingBottom(5).Text(value).SemiBold();
        }

        static void Heading(ColumnDescriptor c, string text) =>
            c.Item().PaddingBottom(3).Text(text).FontSize(11).Bold().FontColor(Brand);

        static void Section(ColumnDescriptor col, string title, string? body)
        {
            if (string.IsNullOrWhiteSpace(body)) return;
            col.Item().Column(c =>
            {
                Heading(c, title);
                c.Item().Text(body);
            });
        }
    }
}
