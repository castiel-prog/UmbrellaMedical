using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Infrastructure.Data;

/// <summary>
/// Gives each completed visit of a demo patient (@example.com) the doctor's record: complaints, diagnosis, treatment,
/// advice and vital signs, plus a prescription (with a pharmacy code) where the specialty would write one.
/// Visits that already have a record are left alone, so it is safe to run on every start.
/// </summary>
public static class DemoVisitRecordsSeeder
{
    private sealed record Rx(string Medication, string Dosage, string Frequency, int Days);
    private sealed record Template(string Complaints, string? DiagnosisCode, string Details, string Treatment, string Advice, Rx? Rx = null, int? Tooth = null);

    private static readonly Dictionary<string, Template> BySpecialization = new()
    {
        ["General Practitioner"] = new("Sore throat, runny nose and a mild fever for three days.", "J06.9",
            "Viral upper respiratory infection. No signs of a bacterial infection.", "Rest, plenty of fluids and paracetamol for the fever.",
            "Come back if the fever lasts more than five days or breathing becomes difficult.", new("Paracetamol", "1 tablet", "Up to 3 times a day", 5)),
        ["Cardiologist"] = new("Raised blood pressure readings at home and occasional morning headaches.", "I10",
            "Stage 1 essential hypertension. ECG normal.", "Less salt, regular walks and amlodipine once a day.",
            "Measure your blood pressure twice a day for two weeks and bring the readings to the follow-up visit.", new("Amlodipine", "1 tablet", "Once a day, in the morning", 30)),
        ["Endocrinologist"] = new("Tiredness, thirst and a raised fasting glucose in a recent blood test.", "E11.9",
            "Type 2 diabetes, HbA1c 7.2%.", "Metformin with meals and a diet plan from the clinic nurse.",
            "Repeat the HbA1c test in three months.", new("Metformin", "1 tablet", "Twice a day with meals", 90)),
        ["Dentist"] = new("Pain on the lower left side when eating sweets.", "K02.9",
            "Caries on tooth 36.", "Composite filling placed on tooth 36.",
            "Avoid hard food for 24 hours. Brush twice a day and floss daily.", null, 36),
        ["Dermatologist"] = new("Itchy, dry patches on both elbows that come and go.", "L20.9",
            "Mild atopic dermatitis.", "Moisturiser twice a day and an antihistamine at night while it itches.",
            "Avoid hot showers and scented soaps.", new("Cetirizine", "1 tablet", "Once a day, at night", 14)),
        ["Pediatrician"] = new("Cough and wheezing at night, worse after running.", "J45.9",
            "Mild intermittent asthma. Lungs clear at rest.", "Reliever inhaler with a spacer when needed.",
            "Come back if the inhaler is needed more than twice a week.", new("Salbutamol", "2 puffs", "When needed, up to 4 times a day", 30)),
        ["Neurologist"] = new("One-sided headaches two or three times a month, with sensitivity to light.", "R51",
            "Migraine without aura. Neurological examination normal.", "Ibuprofen at the start of an attack and a headache diary.",
            "Keep regular sleep and meals. Come back in six weeks with the diary.", new("Ibuprofen", "1 tablet", "At the start of a headache, up to 3 times a day", 10)),
        ["Orthopedist"] = new("Knee pain after running for the last two weeks.", null,
            "Patellofemoral pain. No ligament damage on examination.", "Physiotherapy exercises and ice after activity.",
            "Reduce running for three weeks, then build up slowly.", new("Ibuprofen", "1 tablet", "Up to 3 times a day after food", 7)),
        ["Ophthalmologist"] = new("Dry, tired eyes after long computer work.", null,
            "Dry eye. Vision 1.0 in both eyes.", "Lubricating eye drops four times a day.",
            "Take a 20-second break from the screen every 20 minutes."),
        ["Otolaryngologist (ENT)"] = new("Blocked nose and pressure over the cheeks for ten days.", "J06.9",
            "Acute bacterial sinusitis.", "Saline nasal rinses and a course of amoxicillin.",
            "Finish the whole antibiotic course. Come back if it is not better in a week.", new("Amoxicillin", "1 capsule", "3 times a day", 7)),
        ["Gynecologist"] = new("Routine yearly check-up.", null,
            "Normal examination and pelvic ultrasound.", "No treatment needed.", "Next routine check-up in one year."),
        ["Psychiatrist"] = new("Trouble falling asleep and feeling stressed at work for two months.", null,
            "Insomnia related to stress.", "Sleep plan and short weekly talking-therapy sessions.",
            "No caffeine after midday. Follow-up visit in four weeks."),
        ["Radiologist"] = new("Referred for an abdominal ultrasound because of upper abdominal discomfort.", null,
            "Liver, gallbladder, pancreas and kidneys look normal.", "No findings that need treatment.",
            "The results were sent to the referring doctor."),
        ["Urologist"] = new("Burning when passing urine for two days.", null,
            "Uncomplicated urinary tract infection.", "A short antibiotic course and plenty of fluids.",
            "Come back if you get a fever or back pain.", new("Amoxicillin", "1 capsule", "3 times a day", 5))
    };

    public static async Task SeedAsync(UmbrellaDbContext db)
    {
        var visits = await db.Appointments
            .Where(a => a.Status == AppointmentStatus.Completed
                        && a.Patient.User != null && a.Patient.User.Email.EndsWith("@example.com")
                        && !db.MedicalRecords.Any(r => r.AppointmentId == a.Id))
            .Select(a => new { a.Id, a.PatientId, a.DoctorId, a.StartDateTime, Specialization = a.Doctor.Specialization.Name })
            .ToListAsync();
        if (visits.Count == 0) return;

        var diagnoses = await db.Diagnoses.ToDictionaryAsync(d => d.Code, d => d.Id);
        var medications = await db.Medications.ToDictionaryAsync(m => m.Name, m => m.Id, StringComparer.OrdinalIgnoreCase);
        var prescriptions = new List<Prescription>();

        foreach (var v in visits)
        {
            if (!BySpecialization.TryGetValue(v.Specialization, out var t)) continue;
            var random = new Random(v.Id * 104729);

            var record = new MedicalRecord
            {
                PatientId = v.PatientId,
                DoctorId = v.DoctorId,
                AppointmentId = v.Id,
                RecordDate = v.StartDateTime.AddMinutes(20),
                Complaints = t.Complaints,
                DiagnosisId = t.DiagnosisCode is not null && diagnoses.TryGetValue(t.DiagnosisCode, out var dId) ? dId : null,
                DiagnosisDetails = t.Details,
                Treatment = t.Treatment,
                Recommendations = t.Advice,
                CreatedAt = v.StartDateTime.AddMinutes(25)
            };

            record.VitalSigns.Add(new VitalSigns
            {
                PatientId = v.PatientId,
                RecordedAt = v.StartDateTime.AddMinutes(5),
                SystolicBp = t.DiagnosisCode == "I10" ? random.Next(142, 152) : random.Next(112, 132),
                DiastolicBp = t.DiagnosisCode == "I10" ? random.Next(90, 96) : random.Next(70, 84),
                HeartRate = random.Next(62, 86),
                TemperatureC = t.DiagnosisCode == "J06.9" ? 37.8m : 36.4m + random.Next(0, 5) / 10m,
                HeightCm = random.Next(158, 188),
                WeightKg = random.Next(55, 92)
            });

            if (t.Tooth is int tooth)
                record.ToothRecords.Add(new ToothRecord { PatientId = v.PatientId, ToothNumber = tooth, Condition = ToothCondition.Filled, Treatment = "Composite filling" });

            if (t.Rx is { } rx && medications.TryGetValue(rx.Medication, out var medicationId))
            {
                var prescription = new Prescription
                {
                    PatientId = v.PatientId,
                    DoctorId = v.DoctorId,
                    IssuedDate = record.RecordDate,
                    // Valid for six months, so the code can still be used in the pharmacy in a demo.
                    ExpiryDate = record.RecordDate.AddMonths(6),
                    Instructions = "Take as described. Ask the pharmacist if anything is unclear.",
                    MedicalRecord = record
                };
                prescription.Items.Add(new PrescriptionItem { MedicationId = medicationId, Dosage = rx.Dosage, Frequency = rx.Frequency, DurationDays = rx.Days });
                prescriptions.Add(prescription);
                db.Prescriptions.Add(prescription);
            }

            db.MedicalRecords.Add(record);
        }

        await db.SaveChangesAsync();

        // Pharmacy codes need the database id.
        foreach (var p in prescriptions) p.Code = PrescriptionCodes.For(p.Id);
        if (prescriptions.Count > 0) await db.SaveChangesAsync();
    }
}
