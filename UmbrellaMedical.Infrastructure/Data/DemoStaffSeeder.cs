using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;

namespace UmbrellaMedical.Infrastructure.Data;

/// <summary>
/// Creates demo doctors (three per specialization, each offering every service of their department,
/// with weekday working hours) and demo receptionists. People who already exist (same email or
/// license number) are skipped, so it is safe to run on every start.
/// All demo accounts share one password, taken from configuration (Seed:DemoStaffPassword).
/// </summary>
public static class DemoStaffSeeder
{
    private sealed record DemoDoctor(
        string FirstName, string LastName, string Specialization, string License, int Years,
        string Bio, string Institution, string Degree, int GraduationYear, bool WorksSaturday, bool WorksSunday = false);

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
            "Tbilisi State Medical University", "MD, Urology", 2017, true),

        // Third doctor per specialization (added with the 24/7 opening hours; some also see patients on Sundays).
        new("Lasha", "Kapanadze", "General Practitioner", "GP-10733", 10,
            "Family doctor for adults and seniors: checkups, blood pressure and diabetes follow-up.",
            "Tbilisi State Medical University", "MD, Family Medicine", 2014, true, true),
        new("Nato", "Shavgulidze", "Dentist", "DN-20442", 8,
            "Dentist for children and adults, from first checkups to crowns and whitening.",
            "Tbilisi State Medical University", "DDS, Dentistry", 2016, false, true),
        new("Giorgi", "Bochorishvili", "Cardiologist", "CD-30988", 12,
            "Cardiologist focused on echocardiography, chest pain assessment and heart rhythm monitoring.",
            "Tbilisi State Medical University", "MD, Cardiology", 2012, true),
        new("Tamta", "Kobakhidze", "Pediatrician", "PD-40655", 9,
            "Pediatrician for growth, nutrition and childhood infections, with a gentle approach for little patients.",
            "Tbilisi State Medical University", "MD, Pediatrics", 2015, false, true),
        new("Mikheil", "Dvali", "Dermatologist", "DR-50812", 11,
            "Dermatologist for psoriasis, moles and hair loss, including dermatoscopy.",
            "Tbilisi State Medical University", "MD, Dermatology", 2013, false),
        new("Khatia", "Margvelashvili", "Radiologist", "RD-60714", 10,
            "Radiologist for breast, thyroid and vascular ultrasound.",
            "David Tvildiani Medical University", "MD, Radiology", 2014, false, true),
        new("Revaz", "Tsintsadze", "Neurologist", "NR-70842", 13,
            "Neurologist for back and neck pain, numbness and memory problems.",
            "Tbilisi State Medical University", "MD, Neurology", 2011, false),
        new("Ilia", "Gvenetadze", "Orthopedist", "OR-71933", 9,
            "Orthopedist for sports medicine, ankle and wrist injuries and arthritis care.",
            "Tbilisi State Medical University", "MD, Orthopedics and Traumatology", 2015, true, true),
        new("Lia", "Kurtanidze", "Ophthalmologist", "OP-72786", 15,
            "Ophthalmologist for cataract assessment, diabetic eye checks and contact lens fitting.",
            "Tbilisi State Medical University", "MD, Ophthalmology", 2009, false),
        new("Temur", "Lordkipanidze", "Otolaryngologist (ENT)", "EN-73902", 11,
            "ENT specialist for snoring, ear infections and nosebleeds.",
            "Tbilisi State Medical University", "MD, Otolaryngology", 2013, false),
        new("Marika", "Dzneladze", "Gynecologist", "GY-74981", 10,
            "Gynecologist for family planning, pregnancy follow-up and menopause care.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Obstetrics and Gynecology", 2014, false, true),
        new("Davit", "Mamaladze", "Psychiatrist", "PS-75677", 7,
            "Psychiatrist for adolescents and young adults: anxiety, ADHD and mood.",
            "Tbilisi State Medical University", "MD, Psychiatry", 2017, true),
        new("Inga", "Akhvlediani", "Endocrinologist", "ED-76938", 12,
            "Endocrinologist for type 1 and type 2 diabetes, insulin plans and osteoporosis.",
            "Tbilisi State Medical University", "MD, Endocrinology", 2012, false),
        new("Shota", "Gugushvili", "Urologist", "UR-77955", 14,
            "Urologist for men's health, urinary infections and kidney ultrasound.",
            "David Tvildiani Medical University", "MD, Urology", 2010, false, true),

        // Added to fill out the team: two more doctors per specialization.
        new("Tea", "Kakabadze", "General Practitioner", "GP-10915", 9,
            "Family doctor for adults and seniors: blood pressure, diabetes follow-up and vaccinations.",
            "Tbilisi State Medical University", "MD, Family Medicine", 2015, false),
        new("Guram", "Svanidze", "General Practitioner", "GP-10377", 21,
            "Experienced GP who coordinates care with specialists and runs annual health checks.",
            "Tbilisi State Medical University", "MD, General Medicine", 2003, true),
        new("Ekaterine", "Bregvadze", "Dentist", "DN-20659", 13,
            "Prosthodontist: crowns, bridges and dentures.",
            "Tbilisi State Medical University", "DDS, Prosthodontics", 2011, false),
        new("Tornike", "Kipiani", "Dentist", "DN-20304", 6,
            "Children's dentistry and orthodontic consultations.",
            "David Tvildiani Medical University", "DDS, Pediatric Dentistry", 2018, true),
        new("Nugzar", "Khmaladze", "Cardiologist", "CD-30471", 24,
            "Senior cardiologist for coronary artery disease and heart rhythm problems.",
            "Tbilisi State Medical University", "MD, PhD, Cardiology", 2000, false),
        new("Keti", "Mgeladze", "Cardiologist", "CD-30803", 8,
            "Echocardiography and cardiac care for women and during pregnancy.",
            "Medical University of Vienna", "MD, Cardiology", 2016, true),
        new("Natela", "Tskhadadze", "Pediatrician", "PD-40142", 19,
            "Pediatrician for newborn care, growth checks and childhood infections.",
            "Tbilisi State Medical University", "MD, Pediatrics", 2005, false),
        new("Giorgi", "Kvachadze", "Pediatrician", "PD-40786", 5,
            "Adolescent health, sports medicals and nutrition advice for children.",
            "David Tvildiani Medical University", "MD, Pediatrics", 2019, true, true),
        new("Nata", "Chikovani", "Dermatologist", "DR-50391", 11,
            "Dermatologist for psoriasis, rosacea and hair loss.",
            "Tbilisi State Medical University", "MD, Dermatology", 2013, false),
        new("Aleksandre", "Gurgenidze", "Dermatologist", "DR-50968", 7,
            "Mole checks with dermatoscopy and treatment of skin infections.",
            "Tbilisi State Medical University", "MD, Dermatology", 2017, true),
        new("Madona", "Kekelidze", "Radiologist", "RD-60283", 20,
            "Breast and thyroid ultrasound, and second opinions on imaging.",
            "Tbilisi State Medical University", "MD, Radiology", 2004, false),
        new("Dimitri", "Sharashidze", "Radiologist", "RD-60851", 4,
            "X-ray and ultrasound for emergencies, sports injuries and children.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Radiology", 2020, false, true),
        new("Lela", "Pkhakadze", "Neurologist", "NR-70274", 13,
            "Neurologist for multiple sclerosis, nerve pain and memory problems.",
            "Tbilisi State Medical University", "MD, Neurology", 2011, false),
        new("Badri", "Okujava", "Neurologist", "NR-70963", 22,
            "Stroke prevention and follow-up, Parkinson's disease and tremor.",
            "Tbilisi State Medical University", "MD, PhD, Neurology", 2002, true),
        new("Tamar", "Rukhadze", "Orthopedist", "OR-71458", 10,
            "Foot and ankle problems, flat feet and orthopedic insoles.",
            "Tbilisi State Medical University", "MD, Orthopedics", 2014, false),
        new("Vano", "Merabishvili", "Orthopedist", "OR-71819", 15,
            "Hip and knee arthritis, joint injections and recovery after surgery.",
            "Tbilisi State Medical University", "MD, Orthopedics and Traumatology", 2009, true),
        new("Manana", "Tsulukidze", "Ophthalmologist", "OP-72239", 18,
            "Cataract assessment, diabetic eye checks and retina care.",
            "Tbilisi State Medical University", "MD, Ophthalmology", 2006, false),
        new("Erekle", "Andronikashvili", "Ophthalmologist", "OP-72945", 6,
            "Contact lens fitting, children's vision and squint.",
            "David Tvildiani Medical University", "MD, Ophthalmology", 2018, true),
        new("Nestan", "Gamkrelidze", "Otolaryngologist (ENT)", "EN-73347", 12,
            "Sinus problems, allergies of the nose and voice disorders.",
            "Tbilisi State Medical University", "MD, Otorhinolaryngology", 2012, false),
        new("Koba", "Chanturia", "Otolaryngologist (ENT)", "EN-73714", 9,
            "Ear infections, hearing loss and tonsil problems in children and adults.",
            "Tbilisi State Medical University", "MD, Otorhinolaryngology", 2015, true),
        new("Ia", "Sulakvelidze", "Gynecologist", "GY-74503", 16,
            "Pregnancy care from the first scan to birth, and fertility advice.",
            "Tbilisi State Medical University", "MD, Obstetrics and Gynecology", 2008, true),
        new("Nanuka", "Zhvania", "Gynecologist", "GY-74348", 5,
            "Preventive gynecology, contraception and adolescent health.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Gynecology", 2019, false),
        new("Irina", "Kandelaki", "Psychiatrist", "PS-75216", 17,
            "Psychiatrist for depression, panic disorder and burnout.",
            "Tbilisi State Medical University", "MD, Psychiatry", 2007, false),
        new("Lado", "Asatiani", "Psychiatrist", "PS-75854", 8,
            "Sleep problems, stress and addiction; combines medication with talking therapy.",
            "University of Edinburgh", "MD, Psychiatry", 2016, true),
        new("Medea", "Lomtadze", "Endocrinologist", "ED-76457", 14,
            "Thyroid disease, PCOS and hormone problems in women.",
            "Tbilisi State Medical University", "MD, Endocrinology", 2010, false),
        new("Zviad", "Gabelia", "Endocrinologist", "ED-76781", 6,
            "Weight management, obesity and metabolic health.",
            "David Tvildiani Medical University", "MD, Endocrinology", 2018, true),
        new("Paata", "Kiladze", "Urologist", "UR-77413", 20,
            "Prostate problems, kidney stones and urological ultrasound.",
            "Tbilisi State Medical University", "MD, Urology", 2004, false),
        new("Sopo", "Meskhi", "Urologist", "UR-77168", 7,
            "Urology for women and children: bladder problems and recurring infections.",
            "Tbilisi State Medical University", "MD, Urology", 2017, true),

        // Specializations added later: three doctors each.
        new("Giorgi", "Lezhava", "Gastroenterologist", "GE-78214", 16,
            "Gastroenterologist for reflux, stomach ulcers and irritable bowel syndrome.",
            "Tbilisi State Medical University", "MD, Gastroenterology", 2008, false),
        new("Nino", "Chkhaidze", "Gastroenterologist", "GE-78563", 9,
            "Liver disease, coeliac disease and digestive problems in young adults.",
            "Tbilisi State Medical University", "MD, Gastroenterology", 2015, true),
        new("Levan", "Tsiskaridze", "Gastroenterologist", "GE-78907", 5,
            "Bloating, food intolerances and H. pylori testing and treatment.",
            "David Tvildiani Medical University", "MD, Internal Medicine and Gastroenterology", 2019, false, true),
        new("Ketevan", "Arabuli", "Pulmonologist", "PU-79145", 14,
            "Pulmonologist for asthma, COPD and long-lasting cough.",
            "Tbilisi State Medical University", "MD, Pulmonology", 2010, false),
        new("Davit", "Kipiani", "Pulmonologist", "PU-79482", 8,
            "Breathing tests, sleep apnoea and lung health for smokers who want to quit.",
            "Tbilisi State Medical University", "MD, Pulmonology", 2016, true),
        new("Elene", "Margiani", "Pulmonologist", "PU-79836", 4,
            "Recovery of the lungs after pneumonia and respiratory infections.",
            "Ivane Javakhishvili Tbilisi State University", "MD, Pulmonology", 2020, false),
        new("Tamar", "Gogiberidze", "Allergist", "AL-80271", 12,
            "Allergist for hay fever, food allergies and skin allergy testing.",
            "Tbilisi State Medical University", "MD, Allergology and Immunology", 2012, false),
        new("Irakli", "Shengelaia", "Allergist", "AL-80618", 7,
            "Allergies in children, asthma triggers and allergy treatment plans.",
            "David Tvildiani Medical University", "MD, Allergology", 2017, true),
        new("Maia", "Tchelidze", "Allergist", "AL-80952", 19,
            "Hives, drug allergies and immune system disorders.",
            "Tbilisi State Medical University", "MD, PhD, Clinical Immunology", 2005, false),
        new("Nodar", "Kikvidze", "Rheumatologist", "RH-81327", 21,
            "Rheumatologist for rheumatoid arthritis, gout and lupus.",
            "Tbilisi State Medical University", "MD, PhD, Rheumatology", 2003, false),
        new("Salome", "Japaridze", "Rheumatologist", "RH-81674", 10,
            "Joint pain and stiffness, osteoarthritis and joint ultrasound.",
            "Tbilisi State Medical University", "MD, Rheumatology", 2014, true),
        new("Tornike", "Gelashvili", "Rheumatologist", "RH-81039", 6,
            "Back stiffness, ankylosing spondylitis and autoimmune conditions in young adults.",
            "David Tvildiani Medical University", "MD, Rheumatology", 2018, false),
        new("Ana", "Mgaloblishvili", "Physiotherapist", "PT-82451", 11,
            "Physiotherapist for back and neck pain, posture and office workers.",
            "Ilia State University", "BSc, MSc Physiotherapy", 2013, true),
        new("Luka", "Chanturia", "Physiotherapist", "PT-82786", 6,
            "Sports injuries and getting back to training after knee or shoulder surgery.",
            "Georgian State Teaching University of Physical Education and Sport", "MSc Sports Physiotherapy", 2018, true, true),
        new("Mariam", "Tsintsadze", "Physiotherapist", "PT-82113", 15,
            "Rehabilitation after stroke and joint replacement, and balance training for seniors.",
            "Tbilisi State Medical University", "MSc Rehabilitation", 2009, false),
        new("Eka", "Bakhtadze", "Nutritionist", "NU-83562", 9,
            "Clinical nutritionist for weight management, diabetes diets and healthy habits.",
            "Tbilisi State Medical University", "MSc Clinical Nutrition", 2015, false),
        new("Giorgi", "Jgarkava", "Nutritionist", "NU-83207", 5,
            "Sports nutrition and meal plans for active people.",
            "Agricultural University of Georgia", "MSc Nutrition and Dietetics", 2019, true),
        new("Natia", "Kurdadze", "Nutritionist", "NU-83849", 13,
            "Nutrition for children and families, food allergies and digestive problems.",
            "Ivane Javakhishvili Tbilisi State University", "MSc Nutrition", 2011, false)
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
        ["Urologist"] = "Urology",
        ["Gastroenterologist"] = "Gastroenterology",
        ["Pulmonologist"] = "Pulmonology",
        ["Allergist"] = "Allergology",
        ["Rheumatologist"] = "Rheumatology",
        ["Physiotherapist"] = "Physiotherapy",
        ["Nutritionist"] = "Nutrition"
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
            if (d.WorksSunday)
                doctor.Schedules.Add(new DoctorSchedule { DayOfWeek = DayOfWeek.Sunday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(16, 0) });

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
