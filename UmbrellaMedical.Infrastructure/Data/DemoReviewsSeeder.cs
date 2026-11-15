using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Infrastructure.Data;

/// <summary>
/// Development demo data: patients with past, completed visits and the reviews they left (2-3 per doctor).
/// Reviews need a completed visit, so each review comes with its own visit, as in real use.
/// Demo patients use @example.com addresses, which never receive mail. Safe to run on every start.
/// </summary>
public static class DemoReviewsSeeder
{
    public const string PatientPassword = "Patient123";

    private sealed record DemoPatient(string First, string Last, Gender Gender, int BirthYear, string PersonalNumber);

    private static readonly DemoPatient[] Patients =
    {
        new("Mariam", "Kapanadze", Gender.Female, 1987, "60001000101"),
        new("Davit", "Lomidze", Gender.Male, 1979, "60001000102"),
        new("Nino", "Gelashvili", Gender.Female, 1992, "60001000103"),
        new("Giorgi", "Maisuradze", Gender.Male, 1985, "60001000104"),
        new("Ana", "Tsiklauri", Gender.Female, 1998, "60001000105"),
        new("Luka", "Bakradze", Gender.Male, 1990, "60001000106"),
        new("Tamar", "Javakhishvili", Gender.Female, 1975, "60001000107"),
        new("Irakli", "Gogua", Gender.Male, 1968, "60001000108"),
        new("Salome", "Chkheidze", Gender.Female, 2001, "60001000109"),
        new("Levan", "Abashidze", Gender.Male, 1982, "60001000110"),
        new("Ketevan", "Beridze", Gender.Female, 1995, "60001000111"),
        new("Nikoloz", "Japaridze", Gender.Male, 1972, "60001000112"),
        new("Elene", "Khutsishvili", Gender.Female, 1989, "60001000113"),
        new("Sandro", "Papava", Gender.Male, 1999, "60001000114"),
        new("Natia", "Toidze", Gender.Female, 1983, "60001000115")
    };

    private static readonly string[] FiveStar =
    {
        "Very attentive and professional. Explained everything clearly and answered all my questions.",
        "Excellent doctor. I felt listened to, and the treatment plan was easy to follow.",
        "Calm, kind and thorough. The visit started on time and I left with clear next steps.",
        "Best experience I've had at a clinic. Highly recommend.",
        "Took the time to understand my problem instead of rushing. Thank you!",
        "Very knowledgeable and friendly. Booking online and paying in advance made it really easy.",
        "Explained the results in plain language and didn't make me feel silly for asking questions.",
        "Professional from start to finish. I'll definitely come back.",
        "Made me feel at ease right away. Clear advice and a quick follow-up.",
        "Great experience overall: punctual, careful and genuinely caring."
    };

    private static readonly string[] FourStar =
    {
        "Good doctor and helpful advice. I waited about ten minutes, but the visit itself was great.",
        "Clear explanations and a friendly manner. Would book again.",
        "Very competent. The appointment felt a little short, but all my questions were answered.",
        "Helpful and polite. The prescription and instructions were clear.",
        "Good visit overall, and it was easy to find a free time online.",
        "Knowledgeable and reassuring. Small wait at reception, otherwise excellent."
    };

    private static readonly string[] ThreeStar =
    {
        "The doctor was competent, but the visit started 20 minutes late.",
        "Okay visit. I would have liked a bit more time to discuss my options."
    };

    public static async Task SeedAsync(UmbrellaDbContext db)
    {
        var patientRole = await db.Roles.FirstAsync(r => r.Name == "Patient");
        var hash = BCrypt.Net.BCrypt.HashPassword(PatientPassword);

        // 1. Demo patients (skipped if they already exist).
        var numbers = Patients.Select(p => p.PersonalNumber).ToList();
        var existing = await db.Patients.Where(p => numbers.Contains(p.PersonalNumber)).ToDictionaryAsync(p => p.PersonalNumber);
        var takenEmails = (await db.Users.Select(u => u.Email).ToListAsync()).ToHashSet();

        foreach (var p in Patients.Where(p => !existing.ContainsKey(p.PersonalNumber)))
        {
            var email = $"{p.First}.{p.Last}@example.com".ToLowerInvariant();
            if (!takenEmails.Add(email)) continue;

            var patient = new Patient
            {
                FirstName = p.First,
                LastName = p.Last,
                PersonalNumber = p.PersonalNumber,
                DateOfBirth = new DateOnly(p.BirthYear, 1 + p.PersonalNumber[^1] % 12, 1 + p.PersonalNumber[^2] % 28),
                Gender = p.Gender,
                Email = email,
                Phone = $"+995 555 2{p.PersonalNumber[^3..]}",
                User = new User { Email = email, PasswordHash = hash, RoleId = patientRole.Id, EmailConfirmed = true }
            };
            db.Patients.Add(patient);
            existing[p.PersonalNumber] = patient;
        }
        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync();

        var demoPatients = Patients.Where(p => existing.ContainsKey(p.PersonalNumber)).Select(p => existing[p.PersonalNumber]).ToList();
        if (demoPatients.Count == 0) return;
        var demoIds = demoPatients.Select(p => p.Id).ToHashSet();

        // 2. Visits and reviews: only for doctors who don't have demo reviews yet.
        var doctors = await db.Doctors
            .Where(d => d.User.IsActive && d.DoctorServices.Any())
            .Select(d => new { d.Id, ServiceId = d.DoctorServices.Select(s => s.ServiceId).First(), Minutes = d.DoctorServices.Select(s => s.Service.DurationMinutes).First() })
            .OrderBy(d => d.Id)
            .ToListAsync();

        var reviewed = (await db.DoctorReviews.Where(r => demoIds.Contains(r.PatientId)).Select(r => r.DoctorId).Distinct().ToListAsync()).ToHashSet();
        var today = DateTime.Today;
        var changed = new List<int>();

        foreach (var doctor in doctors.Where(d => !reviewed.Contains(d.Id)))
        {
            // Fixed seed per doctor: the same doctor always gets the same demo history.
            var random = new Random(doctor.Id * 7919);
            var count = random.Next(2, 4);
            var reviewers = demoPatients.OrderBy(_ => random.Next()).Take(count).ToList();
            var usedComments = new HashSet<string>();

            foreach (var patient in reviewers)
            {
                // A weekday morning 1 to 4 months ago, within the clinic's opening hours.
                var day = today.AddDays(-random.Next(10, 120));
                while (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) day = day.AddDays(-1);
                var start = day.AddHours(9 + random.Next(0, 4)).AddMinutes(random.Next(0, 2) * 30);

                var appointment = new Appointment
                {
                    PatientId = patient.Id,
                    DoctorId = doctor.Id,
                    ServiceId = doctor.ServiceId,
                    StartDateTime = start,
                    EndDateTime = start.AddMinutes(doctor.Minutes),
                    Status = AppointmentStatus.Completed,
                    ReminderSent = true,
                    CreatedAt = start.AddDays(-random.Next(2, 10))
                };
                db.Appointments.Add(appointment);

                var rating = PickRating(random);
                var pool = rating == 5 ? FiveStar : rating == 4 ? FourStar : ThreeStar;
                var comment = pool.Where(c => !usedComments.Contains(c)).OrderBy(_ => random.Next()).First();
                usedComments.Add(comment);

                db.DoctorReviews.Add(new DoctorReview
                {
                    DoctorId = doctor.Id,
                    PatientId = patient.Id,
                    Appointment = appointment,
                    Rating = rating,
                    Comment = comment,
                    IsApproved = true,
                    CreatedAt = start.AddDays(random.Next(1, 4)).AddHours(random.Next(1, 8))
                });
            }

            changed.Add(doctor.Id);
        }

        if (changed.Count == 0) return;
        await db.SaveChangesAsync();

        // 3. Refresh each doctor's average rating and review count (approved reviews only), as the API does.
        foreach (var doctorId in changed)
        {
            var doctor = await db.Doctors.FirstAsync(d => d.Id == doctorId);
            var ratings = await db.DoctorReviews.Where(r => r.DoctorId == doctorId && r.IsApproved).Select(r => r.Rating).ToListAsync();
            doctor.ReviewCount = ratings.Count;
            doctor.AverageRating = ratings.Count == 0 ? 0 : Math.Round((decimal)ratings.Average(), 2);
        }
        await db.SaveChangesAsync();
    }

    /// <summary>Mostly happy patients, as in real clinics: 5 stars 55%, 4 stars 35%, 3 stars 10%.</summary>
    private static int PickRating(Random random)
    {
        var roll = random.Next(100);
        return roll < 55 ? 5 : roll < 90 ? 4 : 3;
    }
}
