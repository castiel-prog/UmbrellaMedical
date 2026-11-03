using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;

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
    }
}