using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;

namespace UmbrellaMedical.Infrastructure.Data;

/// <summary>
/// Creates demo doctors (two per specialization, each offering every service of their department,
/// with weekday working hours) and demo receptionists. People who already exist (same email or
/// license number) are skipped, so it is safe to run on every start.
/// All demo accounts share one password, taken from configuration (Seed:DemoStaffPassword).
/// </summary>
public static class DemoStaffSeeder
{
    private sealed record DemoDoctor(
        string FirstName, string LastName, string Specialization, string License, int Years,
        string Bio, string Institution, string Degree, int GraduationYear, bool WorksSaturday);

    private static readonly DemoDoctor[] Doctors =
    {
        new("Nino", "Beridze", "General Practitioner", "GP-10021", 14,
            "Family doctor focused on prevention, chronic disease care and clear explanations.",
            "Tbilisi State Medical University", "MD, Family Medicine", 2010, true),
        new("Zurab", "Kiknadze", "General Practitioner", "GP-10458", 7,
            "General practitioner with a special interest in respiratory infections and travel medicine.",
            "Tbilisi State Medical University", "MD, General Medicine", 2017, false),

        new("Tamar", "Lomidze", "Dentist", "DN-20113", 11,
            "Restorative dentist: fillings, root canals and gentle care for anxious patients.",
            "Tbilisi State Medical University", "DDS, Dentistry", 2013, true),
        new("Levan", "Gelashvili", "Dentist", "DN-20877", 5,
            "Preventive dentistry and professional teeth cleaning.",
            "David Tvildiani Medical University", "DDS, Dentistry", 2019, false),

        new("David", "Chkheidze", "Cardiologist", "CD-30245", 18,
            "Cardiologist treating hypertension, arrhythmias and heart failure.",
            "Tbilisi State Medical University", "MD, PhD, Cardiology", 2006, false),
        new("Mariam", "Javakhishvili", "Cardiologist", "CD-30612", 9,
            "Preventive cardiology, ECG interpretation and cardiovascular risk assessment.",
            "Charité – Universitätsmedizin Berlin", "MD, Cardiology", 2015, false),

        new("Ana", "Tsiklauri", "Pediatrician", "PD-40388", 12,
            "Pediatrician for newborns to teenagers: checkups, vaccinations and common illnesses.",
            "Tbilisi State Medical University", "MD, Pediatrics", 2012, true),
        new("Irakli", "Mchedlidze", "Pediatrician", "PD-40921", 6,
            "Child health with a focus on allergies and asthma.",
            "David Tvildiani Medical University", "MD, Pediatrics", 2018, false),

        new("Salome", "Kvaratskhelia", "Dermatologist", "DR-50174", 10,
            "Dermatologist for eczema, acne and skin cancer screening.",
            "Tbilisi State Medical University", "MD, Dermatology", 2014, false),
        new("Elene", "Gogua", "Dermatologist", "DR-50533", 4,
            "General and cosmetic dermatology.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Dermatology", 2020, true),

        new("Nika", "Abashidze", "Radiologist", "RD-60092", 16,
            "Radiologist specialised in ultrasound and musculoskeletal imaging.",
            "Tbilisi State Medical University", "MD, Radiology", 2008, false),
        new("Sandro", "Jorbenadze", "Radiologist", "RD-60457", 8,
            "Diagnostic radiology: X-ray and abdominal ultrasound.",
            "Tbilisi State Medical University", "MD, Radiology", 2016, true),

        new("Ketevan", "Maisuradze", "Neurologist", "NR-70118", 15,
            "Neurologist treating migraines, epilepsy and sleep disorders.",
            "Tbilisi State Medical University", "MD, PhD, Neurology", 2009, false),
        new("Giorgi", "Tsereteli", "Neurologist", "NR-70536", 6,
            "Headache, dizziness and nerve pain; runs the clinic's EEG service.",
            "David Tvildiani Medical University", "MD, Neurology", 2018, true),

        new("Levan", "Kharaishvili", "Orthopedist", "OR-71204", 17,
            "Orthopedic surgeon for knees, shoulders and sports injuries.",
            "Tbilisi State Medical University", "MD, Orthopedics and Traumatology", 2007, false),
        new("Natia", "Lobjanidze", "Orthopedist", "OR-71690", 7,
            "Back and joint pain, posture and rehabilitation planning.",
            "Tbilisi State Medical University", "MD, Orthopedics", 2017, true),

        new("Tinatin", "Gabunia", "Ophthalmologist", "OP-72057", 13,
            "Eye examinations, glaucoma screening and dry-eye care.",
            "Tbilisi State Medical University", "MD, Ophthalmology", 2011, false),
        new("Dachi", "Beridze", "Ophthalmologist", "OP-72411", 5,
            "Vision tests and eye care for children and adults.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Ophthalmology", 2019, true),

        new("Maia", "Kvirikashvili", "Otolaryngologist (ENT)", "EN-73126", 14,
            "Ear, nose and throat specialist: sinusitis, tonsils and hearing.",
            "Tbilisi State Medical University", "MD, Otolaryngology", 2010, false),
        new("Luka", "Papava", "Otolaryngologist (ENT)", "EN-73580", 6,
            "Hearing tests, allergies of the nose and voice problems.",
            "David Tvildiani Medical University", "MD, Otolaryngology", 2018, true),

        new("Eka", "Chachua", "Gynecologist", "GY-74219", 16,
            "Gynecologist for checkups, pregnancy care and women's health at every age.",
            "Tbilisi State Medical University", "MD, Obstetrics and Gynecology", 2008, false),
        new("Sopho", "Nadiradze", "Gynecologist", "GY-74765", 8,
            "Preventive gynecology and pelvic ultrasound.",
            "Tbilisi State Medical University", "MD, Gynecology", 2016, true),

        new("Rusudan", "Abuladze", "Psychiatrist", "PS-75043", 12,
            "Psychiatrist for anxiety, depression and sleep problems, with a calm, confidential approach.",
            "Tbilisi State Medical University", "MD, Psychiatry", 2012, false),
        new("Vakhtang", "Gelovani", "Psychiatrist", "PS-75398", 9,
            "Stress, burnout and follow-up therapy sessions.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Psychiatry", 2015, false),

        new("Nana", "Japaridze", "Endocrinologist", "ED-76162", 15,
            "Endocrinologist for diabetes, thyroid conditions and hormonal balance.",
            "Tbilisi State Medical University", "MD, Endocrinology", 2009, false),
        new("Otar", "Bakradze", "Endocrinologist", "ED-76604", 6,
            "Thyroid ultrasound, weight and metabolic health.",
            "David Tvildiani Medical University", "MD, Endocrinology", 2018, true),

        new("Zaza", "Khutsishvili", "Urologist", "UR-77281", 19,
            "Urologist for kidney stones, prostate health and bladder problems.",
            "Tbilisi State Medical University", "MD, Urology", 2005, false),
        new("Beka", "Toidze", "Urologist", "UR-77739", 7,
            "General urology and urinary tract ultrasound.",
            "Tbilisi State Medical University", "MD, Urology", 2017, true)
    };

    private static readonly (string FirstName, string LastName, string Phone)[] Receptionists =
    {
        ("Ketevan", "Natsvlishvili", "+995 555 100 201"),
        ("Luka", "Dolidze", "+995 555 100 202"),
        ("Mariam", "Shengelia", "+995 555 100 203")
    };

    // Which department's services each specialization offers.
    private static readonly Dictionary<string, string> DepartmentFor = new()
    {
        ["General Practitioner"] = "General Medicine",
        ["Dentist"] = "Dentistry",
        ["Cardiologist"] = "Cardiology",
        ["Pediatrician"] = "Pediatrics",
        ["Dermatologist"] = "Dermatology",
        ["Radiologist"] = "Radiology",
        ["Neurologist"] = "Neurology",
        ["Orthopedist"] = "Orthopedics",
        ["Ophthalmologist"] = "Ophthalmology",
        ["Otolaryngologist (ENT)"] = "ENT",
        ["Gynecologist"] = "Gynecology",
        ["Psychiatrist"] = "Psychiatry",
        ["Endocrinologist"] = "Endocrinology",
        ["Urologist"] = "Urology"
    };

    public static async Task SeedAsync(UmbrellaDbContext db, string password)
    {
        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var doctorRole = await db.Roles.FirstAsync(r => r.Name == "Doctor");
        var receptionistRole = await db.Roles.FirstAsync(r => r.Name == "Receptionist");

        var specializations = await db.Specializations.ToDictionaryAsync(s => s.Name, s => s.Id);
        var services = await db.Services
            .Where(s => s.IsActive)
            .Select(s => new { s.Id, Department = s.Department.Name })
            .ToListAsync();

        var takenEmails = (await db.Users.Select(u => u.Email).ToListAsync()).ToHashSet();
        var takenLicenses = (await db.Doctors.Select(d => d.LicenseNumber).ToListAsync()).ToHashSet();

        foreach (var d in Doctors)
        {
            if (!specializations.TryGetValue(d.Specialization, out var specializationId)) continue;

            // Skip anyone who already exists, so the seeder is safe to run on every start.
            var email = Email(d.FirstName, d.LastName);
            if (takenEmails.Contains(email) || takenLicenses.Contains(d.License)) continue;
            takenEmails.Add(email);

            var doctor = new Doctor
            {
                FirstName = d.FirstName,
                LastName = d.LastName,
                LicenseNumber = d.License,
                Email = email,
                Phone = null,
                Bio = d.Bio,
                YearsOfExperience = d.Years,
                SpecializationId = specializationId,
                User = new User { Email = email, PasswordHash = hash, RoleId = doctorRole.Id, EmailConfirmed = true }
            };

            doctor.Educations.Add(new DoctorEducation
            {
                Institution = d.Institution,
                Degree = d.Degree,
                StartYear = d.GraduationYear - 6,
                GraduationYear = d.GraduationYear
            });

            doctor.Experiences.Add(new DoctorExperience
            {
                Workplace = "Umbrella Medical Center",
                Position = d.Specialization,
                StartDate = new DateOnly(Math.Max(d.GraduationYear + 2, 2018), 9, 1),
                Description = "Outpatient consultations and follow-up care."
            });

            var department = DepartmentFor[d.Specialization];
            foreach (var service in services.Where(s => s.Department == department))
                doctor.DoctorServices.Add(new DoctorService { ServiceId = service.Id });

            // Mon–Fri 09:00–13:00 and 14:00–18:00 (lunch break), some doctors also Saturday mornings.
            foreach (var day in new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday })
            {
                doctor.Schedules.Add(new DoctorSchedule { DayOfWeek = day, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(13, 0) });
                doctor.Schedules.Add(new DoctorSchedule { DayOfWeek = day, StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(18, 0) });
            }
            if (d.WorksSaturday)
                doctor.Schedules.Add(new DoctorSchedule { DayOfWeek = DayOfWeek.Saturday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(14, 0) });

            db.Doctors.Add(doctor);
        }

        foreach (var r in Receptionists)
        {
            var email = Email(r.FirstName, r.LastName);
            if (!takenEmails.Add(email)) continue;

            db.Receptionists.Add(new Receptionist
            {
                FirstName = r.FirstName,
                LastName = r.LastName,
                Phone = r.Phone,
                User = new User { Email = email, PasswordHash = hash, RoleId = receptionistRole.Id, EmailConfirmed = true }
            });
        }

        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync();
    }

    /// <summary>The shared staff password used in Development when none is configured.</summary>
    public const string DevelopmentPassword = "Umbrella123";

    /// <summary>
    /// Development only: gives every demo doctor and receptionist (@umbrella.local email) the same password.
    /// Not the admin: the database is shared with the live site, whose admin keeps its own password.
    /// Returns how many accounts were changed.
    /// </summary>
    public static async Task<int> UseSharedStaffPasswordAsync(UmbrellaDbContext db, string password)
    {
        var staff = await db.Users
            .Where(u => u.Email.EndsWith("@umbrella.local")
                        && (u.Role.Name == "Doctor" || u.Role.Name == "Receptionist"))
            .ToListAsync();

        var changed = 0;
        foreach (var user in staff.Where(u => !BCrypt.Net.BCrypt.Verify(password, u.PasswordHash)))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            changed++;
        }

        if (changed > 0) await db.SaveChangesAsync();
        return changed;
    }

    private static string Email(string firstName, string lastName) =>
        $"{firstName}.{lastName}@umbrella.local".ToLowerInvariant();
}
