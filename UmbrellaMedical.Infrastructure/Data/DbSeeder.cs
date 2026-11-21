using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(UmbrellaDbContext db, string? adminPassword = null)
    {
        if (!await db.Roles.AnyAsync())
        {
            db.Roles.AddRange(
                new Role { Name = "Admin" },
                new Role { Name = "Doctor" },
                new Role { Name = "Receptionist" },
                new Role { Name = "Patient" });
            await db.SaveChangesAsync();
        }

        if (!string.IsNullOrWhiteSpace(adminPassword)
            && adminPassword.Length >= 8
            && !await db.Users.AnyAsync(u => u.Role.Name == "Admin"))
        {
            var adminRole = await db.Roles.FirstAsync(r => r.Name == "Admin");
            db.Users.Add(new User
            {
                Email = "admin@umbrella.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                RoleId = adminRole.Id,
                EmailConfirmed = true
            });
            await db.SaveChangesAsync();
        }

        if (!await db.Specializations.AnyAsync())
        {
            db.Specializations.AddRange(
                new Specialization { Name = "General Practitioner", Description = "Primary care and general checkups" },
                new Specialization { Name = "Dentist", Description = "Teeth, gums and oral health" },
                new Specialization { Name = "Cardiologist", Description = "Heart and blood vessels" },
                new Specialization { Name = "Pediatrician", Description = "Children's health" },
                new Specialization { Name = "Dermatologist", Description = "Skin, hair and nails" },
                new Specialization { Name = "Radiologist", Description = "Imaging: X-ray, ultrasound" });
            await db.SaveChangesAsync();
        }

        if (!await db.Departments.AnyAsync())
        {
            var departments = new List<Department>
            {
                new() { Name = "General Medicine" },
                new() { Name = "Dentistry" },
                new() { Name = "Cardiology" },
                new() { Name = "Pediatrics" },
                new() { Name = "Dermatology" },
                new() { Name = "Radiology" }
            };
            db.Departments.AddRange(departments);
            await db.SaveChangesAsync();

            var dept = departments.ToDictionary(d => d.Name, d => d.Id);

            db.Services.AddRange(
                new Service { Name = "General consultation", Price = 50, DurationMinutes = 30, DepartmentId = dept["General Medicine"] },
                new Service { Name = "Dental checkup", Price = 40, DurationMinutes = 30, DepartmentId = dept["Dentistry"] },
                new Service { Name = "Teeth cleaning", Price = 80, DurationMinutes = 45, DepartmentId = dept["Dentistry"] },
                new Service { Name = "Tooth filling", Price = 120, DurationMinutes = 60, DepartmentId = dept["Dentistry"] },
                new Service { Name = "Cardiology consultation", Price = 90, DurationMinutes = 30, DepartmentId = dept["Cardiology"] },
                new Service { Name = "ECG", Price = 60, DurationMinutes = 20, DepartmentId = dept["Cardiology"] },
                new Service { Name = "Pediatric consultation", Price = 60, DurationMinutes = 30, DepartmentId = dept["Pediatrics"] },
                new Service { Name = "Skin examination", Price = 70, DurationMinutes = 30, DepartmentId = dept["Dermatology"] },
                new Service { Name = "X-ray", Price = 50, DurationMinutes = 20, DepartmentId = dept["Radiology"] },
                new Service { Name = "Ultrasound", Price = 80, DurationMinutes = 30, DepartmentId = dept["Radiology"] });
            await db.SaveChangesAsync();
        }

        await EnsureCatalogAsync(db);

        if (!await db.Diagnoses.AnyAsync())
        {
            db.Diagnoses.AddRange(
                new Diagnosis { Code = "J06.9", Name = "Acute upper respiratory infection, unspecified" },
                new Diagnosis { Code = "I10", Name = "Essential (primary) hypertension" },
                new Diagnosis { Code = "E11.9", Name = "Type 2 diabetes mellitus without complications" },
                new Diagnosis { Code = "K02.9", Name = "Dental caries, unspecified" },
                new Diagnosis { Code = "L20.9", Name = "Atopic dermatitis, unspecified" },
                new Diagnosis { Code = "J45.9", Name = "Asthma, unspecified" },
                new Diagnosis { Code = "R51", Name = "Headache" });
            await db.SaveChangesAsync();
        }

        if (!await db.Allergies.AnyAsync())
        {
            db.Allergies.AddRange(
                new Allergy { Name = "Penicillin" },
                new Allergy { Name = "Peanuts" },
                new Allergy { Name = "Latex" },
                new Allergy { Name = "Pollen" },
                new Allergy { Name = "Dust mites" },
                new Allergy { Name = "Lactose" });
            await db.SaveChangesAsync();
        }

        if (!await db.Medications.AnyAsync())
        {
            db.Medications.AddRange(
                new Medication { Name = "Paracetamol", GenericName = "Paracetamol", Form = "Tablet", Strength = "500 mg" },
                new Medication { Name = "Ibuprofen", GenericName = "Ibuprofen", Form = "Tablet", Strength = "400 mg" },
                new Medication { Name = "Amoxicillin", GenericName = "Amoxicillin", Form = "Capsule", Strength = "500 mg" },
                new Medication { Name = "Omeprazole", GenericName = "Omeprazole", Form = "Capsule", Strength = "20 mg" },
                new Medication { Name = "Cetirizine", GenericName = "Cetirizine", Form = "Tablet", Strength = "10 mg" });
            await db.SaveChangesAsync();
        }

        if (!await db.InsuranceCompanies.AnyAsync())
        {
            db.InsuranceCompanies.AddRange(
                new InsuranceCompany { Name = "SafeLife Insurance" },
                new InsuranceCompany { Name = "HealthShield" });
            await db.SaveChangesAsync();
        }

        await EnsureMedicationsAsync(db);
        await EnsureStoreAsync(db);
        await EnsurePrescriptionCodesAsync(db);
    }

    /// <summary>Prescription-only medicines added with the store.</summary>
    private static readonly (string Name, string Generic, string Form, string Strength)[] ExtraMedications =
    {
        ("Azithromycin", "Azithromycin", "Tablet", "500 mg"),
        ("Metformin", "Metformin", "Tablet", "850 mg"),
        ("Atorvastatin", "Atorvastatin", "Tablet", "20 mg"),
        ("Sertraline", "Sertraline", "Tablet", "50 mg"),
        ("Levothyroxine", "Levothyroxine", "Tablet", "50 mcg"),
        ("Amlodipine", "Amlodipine", "Tablet", "5 mg"),
        ("Lisinopril", "Lisinopril", "Tablet", "10 mg"),
        ("Losartan", "Losartan", "Tablet", "50 mg"),
        ("Salbutamol", "Salbutamol", "Inhaler", "100 mcg"),
        ("Prednisolone", "Prednisolone", "Tablet", "5 mg"),
        ("Ciprofloxacin", "Ciprofloxacin", "Tablet", "500 mg"),
        ("Pantoprazole", "Pantoprazole", "Tablet", "40 mg"),
        ("Bisoprolol", "Bisoprolol", "Tablet", "5 mg"),
        ("Montelukast", "Montelukast", "Tablet", "10 mg"),
        ("Clopidogrel", "Clopidogrel", "Tablet", "75 mg")
    };

    private static async Task EnsureMedicationsAsync(UmbrellaDbContext db)
    {
        var existing = (await db.Medications.Select(m => m.Name).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var m in ExtraMedications.Where(m => !existing.Contains(m.Name)))
            db.Medications.Add(new Medication { Name = m.Name, GenericName = m.Generic, Form = m.Form, Strength = m.Strength });
        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync();
    }

    private sealed record SeedProduct(
        string Name, ProductCategory Category, decimal Price, int Stock, string Unit, string Description, string? RxMedication = null);

    private static readonly SeedProduct[] StoreProducts =
    {
        // Over-the-counter medicines
        new("Paracetamol 500 mg", ProductCategory.Medicines, 3.50m, 120, "20 tablets", "For pain and fever. Follow the dose on the pack."),
        new("Ibuprofen 400 mg", ProductCategory.Medicines, 5.90m, 90, "20 tablets", "Anti-inflammatory pain relief. Take with food."),
        new("Cetirizine 10 mg", ProductCategory.Medicines, 6.40m, 60, "10 tablets", "Antihistamine for hay fever and allergy symptoms."),
        new("Omeprazole 20 mg", ProductCategory.Medicines, 8.20m, 50, "14 capsules", "Short-term relief of heartburn."),
        new("Throat lozenges", ProductCategory.Medicines, 4.80m, 80, "24 lozenges", "Honey and lemon lozenges for a sore throat."),
        new("Saline nasal spray", ProductCategory.Medicines, 7.50m, 40, "20 ml", "Gentle saline spray to clear a blocked nose."),

        // Prescription-only medicines
        new("Amoxicillin 500 mg", ProductCategory.Medicines, 9.80m, 40, "21 capsules", "Antibiotic. Prescription required.", "Amoxicillin"),
        new("Azithromycin 500 mg", ProductCategory.Medicines, 14.50m, 30, "3 tablets", "Antibiotic. Prescription required.", "Azithromycin"),
        new("Metformin 850 mg", ProductCategory.Medicines, 7.90m, 50, "60 tablets", "For type 2 diabetes. Prescription required.", "Metformin"),
        new("Atorvastatin 20 mg", ProductCategory.Medicines, 12.30m, 40, "30 tablets", "Lowers cholesterol. Prescription required.", "Atorvastatin"),
        new("Sertraline 50 mg", ProductCategory.Medicines, 16.90m, 25, "28 tablets", "Antidepressant. Prescription required.", "Sertraline"),
        new("Levothyroxine 50 mcg", ProductCategory.Medicines, 8.60m, 35, "50 tablets", "Thyroid hormone. Prescription required.", "Levothyroxine"),
        new("Amlodipine 5 mg", ProductCategory.Medicines, 6.90m, 40, "30 tablets", "For high blood pressure. Prescription required.", "Amlodipine"),

        // Vitamins
        new("Vitamin C 1000 mg", ProductCategory.Vitamins, 11.90m, 70, "20 effervescent tablets", "Orange-flavoured vitamin C."),
        new("Vitamin D3 2000 IU", ProductCategory.Vitamins, 13.50m, 60, "60 capsules", "Supports bones and the immune system."),
        new("Magnesium + B6", ProductCategory.Vitamins, 12.80m, 50, "30 tablets", "Helps reduce tiredness."),

        // Personal care
        new("Unscented deodorant", ProductCategory.PersonalCare, 8.90m, 45, "50 ml roll-on", "Gentle 48-hour roll-on for sensitive skin."),
        new("Sensitive toothpaste", ProductCategory.PersonalCare, 6.50m, 60, "75 ml", "For sensitive teeth, with fluoride."),
        new("SPF 50 sunscreen", ProductCategory.PersonalCare, 24.90m, 30, "50 ml", "High protection for face and body."),
        new("Moisturising hand cream", ProductCategory.PersonalCare, 7.20m, 40, "75 ml", "For dry and cracked hands."),

        // Hygiene
        new("Cotton pads", ProductCategory.Hygiene, 3.20m, 150, "100 pads", "Soft round cotton pads."),
        new("Cotton swabs", ProductCategory.Hygiene, 2.80m, 120, "200 swabs", "Paper-stem cotton buds."),
        new("Hand sanitiser gel", ProductCategory.Hygiene, 5.50m, 100, "100 ml", "70% alcohol, kills 99.9% of germs."),
        new("Wet wipes", ProductCategory.Hygiene, 3.90m, 90, "72 wipes", "Fragrance-free, for sensitive skin."),
        new("Face masks", ProductCategory.Hygiene, 6.00m, 200, "10 masks", "3-ply disposable face masks."),

        // First aid
        new("Plasters assortment", ProductCategory.FirstAid, 4.50m, 100, "40 plasters", "Assorted sizes, water-resistant."),
        new("Elastic bandage", ProductCategory.FirstAid, 5.80m, 50, "8 cm x 4 m", "Support for sprains and strains."),
        new("Antiseptic solution", ProductCategory.FirstAid, 4.20m, 70, "100 ml", "For cleaning small cuts and grazes."),
        new("Sterile gauze pads", ProductCategory.FirstAid, 3.60m, 80, "10 pads", "Individually wrapped, 10 x 10 cm."),

        // Devices
        new("Digital thermometer", ProductCategory.Devices, 14.90m, 30, "1 piece", "Fast 10-second reading with fever alarm."),
        new("Upper-arm blood pressure monitor", ProductCategory.Devices, 89.00m, 12, "1 piece", "Automatic monitor with memory for two users."),
        new("Pulse oximeter", ProductCategory.Devices, 39.90m, 15, "1 piece", "Measures oxygen saturation and pulse at the fingertip."),

        // Added with the pharmacy update
        new("Loratadine 10 mg", ProductCategory.Medicines, 5.60m, 60, "10 tablets", "Non-drowsy antihistamine for allergies."),
        new("Antacid chewable tablets", ProductCategory.Medicines, 4.90m, 70, "24 tablets", "Fast relief of heartburn and indigestion."),
        new("Cough syrup", ProductCategory.Medicines, 9.40m, 45, "150 ml", "Soothing syrup for dry and tickly coughs."),
        new("Oral rehydration salts", ProductCategory.Medicines, 6.20m, 60, "10 sachets", "Replaces fluids and salts lost through diarrhoea or heat."),
        new("Lubricating eye drops", ProductCategory.Medicines, 11.50m, 40, "10 ml", "Artificial tears for dry, tired eyes."),
        new("Diclofenac gel 1%", ProductCategory.Medicines, 10.80m, 50, "50 g", "Pain-relief gel for muscles and joints."),
        new("Lisinopril 10 mg", ProductCategory.Medicines, 7.40m, 40, "30 tablets", "For high blood pressure. Prescription required.", "Lisinopril"),
        new("Losartan 50 mg", ProductCategory.Medicines, 9.20m, 40, "30 tablets", "For high blood pressure. Prescription required.", "Losartan"),
        new("Salbutamol inhaler 100 mcg", ProductCategory.Medicines, 13.80m, 30, "200 doses", "Reliever inhaler for asthma. Prescription required.", "Salbutamol"),

        new("Multivitamin for adults", ProductCategory.Vitamins, 18.90m, 60, "30 tablets", "Daily vitamins and minerals in one tablet."),
        new("Omega-3 fish oil 1000 mg", ProductCategory.Vitamins, 22.50m, 40, "60 capsules", "EPA and DHA for heart and brain health."),
        new("Zinc 25 mg", ProductCategory.Vitamins, 9.90m, 50, "30 tablets", "Supports the immune system."),
        new("Iron + folic acid", ProductCategory.Vitamins, 10.40m, 40, "30 tablets", "Helps reduce tiredness caused by low iron."),
        new("Probiotic capsules", ProductCategory.Vitamins, 24.00m, 35, "30 capsules", "Friendly bacteria for digestive health."),
        new("Calcium + vitamin D3", ProductCategory.Vitamins, 12.20m, 45, "60 tablets", "For strong bones and teeth."),

        new("Lip balm SPF 15", ProductCategory.PersonalCare, 4.50m, 80, "4.8 g", "Protects and soothes dry lips."),
        new("Anti-dandruff shampoo", ProductCategory.PersonalCare, 14.80m, 35, "250 ml", "Medicated shampoo that reduces flakes and itching."),
        new("Body lotion for dry skin", ProductCategory.PersonalCare, 13.90m, 40, "400 ml", "Fragrance-free daily moisturiser."),

        new("Antibacterial liquid soap", ProductCategory.Hygiene, 4.70m, 90, "300 ml", "Gentle hand wash that removes germs."),
        new("Soft toothbrush", ProductCategory.Hygiene, 3.90m, 100, "1 piece", "Soft bristles for sensitive gums."),
        new("Dental floss", ProductCategory.Hygiene, 3.50m, 80, "50 m", "Mint waxed floss."),
        new("Nitrile examination gloves", ProductCategory.Hygiene, 12.00m, 60, "50 gloves", "Powder-free, latex-free disposable gloves."),

        new("First aid kit", ProductCategory.FirstAid, 34.90m, 25, "1 kit", "Plasters, bandages, gauze and scissors for home or car."),
        new("Medical adhesive tape", ProductCategory.FirstAid, 3.80m, 70, "2.5 cm x 5 m", "Breathable tape for dressings."),

        new("Blood glucose meter", ProductCategory.Devices, 59.00m, 15, "1 kit", "Meter with 10 strips and a lancing device."),
        new("Compressor nebuliser", ProductCategory.Devices, 119.00m, 8, "1 piece", "For inhaled medicines at home, for adults and children."),
        new("Digital bathroom scale", ProductCategory.Devices, 49.00m, 12, "1 piece", "Accurate to 100 g, with a large display."),

        // Second pharmacy expansion
        new("Aspirin 500 mg", ProductCategory.Medicines, 4.20m, 100, "20 tablets", "For headache, pain and fever. Not for children under 16."),
        new("Naproxen 220 mg", ProductCategory.Medicines, 7.80m, 60, "20 tablets", "Long-lasting relief for period pain, back pain and toothache."),
        new("Loperamide 2 mg", ProductCategory.Medicines, 5.40m, 70, "12 capsules", "Stops sudden diarrhoea. For adults and children over 12."),
        new("Antibiotic ointment", ProductCategory.Medicines, 9.60m, 45, "28 g", "Helps prevent infection in minor cuts, scrapes and burns."),
        new("Nicotine patches", ProductCategory.Medicines, 39.00m, 25, "14 patches", "24-hour patches that help you stop smoking."),
        new("Allergy eye drops", ProductCategory.Medicines, 10.90m, 40, "10 ml", "Relieves itchy, watery eyes caused by hay fever."),
        new("Motion sickness tablets", ProductCategory.Medicines, 6.80m, 50, "10 tablets", "Prevents travel sickness. Take 30 minutes before the journey."),
        new("Children's paracetamol syrup", ProductCategory.Medicines, 8.50m, 60, "100 ml", "Strawberry-flavoured syrup for fever and pain, from 3 months."),
        new("Prednisolone 5 mg", ProductCategory.Medicines, 6.50m, 30, "30 tablets", "Corticosteroid for inflammation and allergies. Prescription required.", "Prednisolone"),
        new("Ciprofloxacin 500 mg", ProductCategory.Medicines, 11.20m, 30, "10 tablets", "Antibiotic. Prescription required.", "Ciprofloxacin"),
        new("Pantoprazole 40 mg", ProductCategory.Medicines, 10.60m, 40, "28 tablets", "For stomach ulcers and reflux. Prescription required.", "Pantoprazole"),
        new("Bisoprolol 5 mg", ProductCategory.Medicines, 8.10m, 35, "30 tablets", "For high blood pressure and heart rhythm. Prescription required.", "Bisoprolol"),
        new("Montelukast 10 mg", ProductCategory.Medicines, 15.80m, 30, "28 tablets", "Prevents asthma attacks and allergy symptoms. Prescription required.", "Montelukast"),
        new("Clopidogrel 75 mg", ProductCategory.Medicines, 13.40m, 30, "28 tablets", "Helps prevent blood clots. Prescription required.", "Clopidogrel"),

        new("Vitamin B12 1000 mcg", ProductCategory.Vitamins, 12.60m, 50, "60 tablets", "Supports energy and the nervous system."),
        new("Melatonin 3 mg", ProductCategory.Vitamins, 14.20m, 45, "30 tablets", "Helps you fall asleep, also after travel across time zones."),
        new("Biotin for hair and nails", ProductCategory.Vitamins, 16.50m, 40, "60 capsules", "Biotin, zinc and selenium for healthy hair and nails."),
        new("Vitamin E 400 IU", ProductCategory.Vitamins, 13.80m, 40, "30 softgels", "Antioxidant that protects cells."),
        new("Electrolyte effervescent tablets", ProductCategory.Vitamins, 9.30m, 60, "20 tablets", "Replaces salts after exercise or on hot days."),
        new("Cod liver oil capsules", ProductCategory.Vitamins, 15.90m, 35, "90 capsules", "Omega-3 with vitamins A and D."),

        new("Aloe vera gel", ProductCategory.PersonalCare, 9.80m, 50, "200 ml", "Cools and soothes sunburn and dry skin."),
        new("Nappy rash cream", ProductCategory.PersonalCare, 8.40m, 55, "100 g", "Zinc oxide cream that protects babies' skin."),
        new("Insect repellent spray", ProductCategory.PersonalCare, 12.90m, 40, "100 ml", "Protects against mosquitoes and ticks for up to 8 hours."),
        new("Contact lens case", ProductCategory.PersonalCare, 3.90m, 60, "1 piece", "Leak-proof case for storing soft contact lenses. Replace every 3 months."),
        new("Gentle facial cleanser", ProductCategory.PersonalCare, 13.20m, 40, "250 ml", "Soap-free cleanser for sensitive skin."),

        new("Antiseptic mouthwash", ProductCategory.Hygiene, 8.70m, 60, "500 ml", "Kills germs that cause bad breath and plaque."),
        new("Reusable cloth pads", ProductCategory.Hygiene, 18.50m, 30, "3 pads", "Soft washable cotton pads, a low-waste choice for normal flow."),
        new("Disinfectant wipes", ProductCategory.Hygiene, 6.40m, 70, "60 wipes", "Cleans and disinfects surfaces at home and work."),
        new("Baby shampoo", ProductCategory.Hygiene, 7.60m, 50, "300 ml", "No-tears formula for babies and children."),
        new("Blister plasters", ProductCategory.FirstAid, 7.90m, 60, "6 plasters", "Cushioning gel plasters that relieve blister pain."),
        new("Hot water bottle", ProductCategory.FirstAid, 12.50m, 30, "2 litres", "Rubber bottle with a soft cover for aches and cramps."),
        new("Weekly pill organiser", ProductCategory.Devices, 6.90m, 60, "1 piece", "Seven days, morning and evening compartments."),
        new("Knee support brace", ProductCategory.Devices, 29.00m, 25, "1 piece, size M/L", "Adjustable support for weak or painful knees."),
        new("Wrist blood pressure monitor", ProductCategory.Devices, 65.00m, 15, "1 piece", "Compact automatic monitor, easy to take on trips."),
        new("Adjustable walking stick", ProductCategory.Devices, 34.00m, 15, "1 piece", "Lightweight aluminium stick with a soft grip."),
        new("Pregnancy test", ProductCategory.Devices, 8.90m, 50, "2 tests", "Early result from the day your period is due.")
    };

    /// <summary>Adds any missing store product by name. Existing products (and their prices or stock) are left alone.</summary>
    private static async Task EnsureStoreAsync(UmbrellaDbContext db)
    {
        var existing = (await db.Products.Select(p => p.Name).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var medications = await db.Medications.ToDictionaryAsync(m => m.Name, m => m.Id, StringComparer.OrdinalIgnoreCase);

        foreach (var p in StoreProducts.Where(p => !existing.Contains(p.Name)))
        {
            db.Products.Add(new Product
            {
                Name = p.Name,
                Category = p.Category,
                Price = p.Price,
                Stock = p.Stock,
                Unit = p.Unit,
                Description = p.Description,
                RequiresPrescription = p.RxMedication is not null,
                MedicationId = p.RxMedication is not null && medications.TryGetValue(p.RxMedication, out var medId) ? medId : null
            });
        }

        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync();
    }

    /// <summary>Gives a store code to prescriptions written before codes existed.</summary>
    private static async Task EnsurePrescriptionCodesAsync(UmbrellaDbContext db)
    {
        var missing = await db.Prescriptions.Where(p => p.Code == null).ToListAsync();
        foreach (var p in missing) p.Code = PrescriptionCodes.For(p.Id);
        if (missing.Count > 0) await db.SaveChangesAsync();
    }

    private sealed record CatalogEntry(
        string Specialization, string SpecializationDescription, string Department,
        (string Name, decimal Price, int Minutes)[] Services);

    /// <summary>Specializations added after the first release, each with its department and services.</summary>
    private static readonly CatalogEntry[] ExtraCatalog =
    {
        new("Neurologist", "Brain, nerves, headaches and sleep problems", "Neurology",
            new[] { ("Neurology consultation", 90m, 30), ("EEG", 110m, 45) }),
        new("Orthopedist", "Bones, joints, back and sports injuries", "Orthopedics",
            new[] { ("Orthopedic consultation", 85m, 30), ("Joint injection", 120m, 30) }),
        new("Ophthalmologist", "Eyes and vision", "Ophthalmology",
            new[] { ("Eye examination", 70m, 30), ("Vision test", 40m, 20) }),
        new("Otolaryngologist (ENT)", "Ear, nose and throat", "ENT",
            new[] { ("ENT consultation", 70m, 30), ("Hearing test", 60m, 30) }),
        new("Gynecologist", "Women's health and pregnancy care", "Gynecology",
            new[] { ("Gynecological consultation", 80m, 30), ("Pelvic ultrasound", 90m, 30) }),
        new("Psychiatrist", "Mental health: anxiety, depression, sleep and stress", "Psychiatry",
            new[] { ("Psychiatric consultation", 100m, 50), ("Follow-up therapy session", 90m, 50) }),
        new("Endocrinologist", "Hormones, diabetes and thyroid", "Endocrinology",
            new[] { ("Endocrinology consultation", 85m, 30), ("Thyroid ultrasound", 80m, 30) }),
        new("Urologist", "Kidneys, bladder and men's health", "Urology",
            new[] { ("Urology consultation", 80m, 30), ("Urinary tract ultrasound", 85m, 30) })
    };

    /// <summary>Adds any missing specialization, department or service by name. Existing rows are left alone.</summary>
    private static async Task EnsureCatalogAsync(UmbrellaDbContext db)
    {
        var specializations = await db.Specializations.Select(s => s.Name).ToListAsync();
        var departments = await db.Departments.ToDictionaryAsync(d => d.Name, d => d);
        var services = (await db.Services.Select(s => s.Name).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in ExtraCatalog)
        {
            if (!specializations.Contains(entry.Specialization, StringComparer.OrdinalIgnoreCase))
                db.Specializations.Add(new Specialization { Name = entry.Specialization, Description = entry.SpecializationDescription });

            if (!departments.TryGetValue(entry.Department, out var department))
            {
                department = new Department { Name = entry.Department };
                db.Departments.Add(department);
                departments[entry.Department] = department;
            }

            foreach (var (name, price, minutes) in entry.Services)
                if (services.Add(name))
                    db.Services.Add(new Service { Name = name, Price = price, DurationMinutes = minutes, Department = department });
        }

        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync();
    }
}