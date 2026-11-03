using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Entities;

namespace UmbrellaMedical.Infrastructure.Data
{
    public class UmbrellaDbContext : DbContext
    {
        public UmbrellaDbContext(DbContextOptions<UmbrellaDbContext> options) : base(options) { }

        // People
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<UserToken> UserTokens => Set<UserToken>();
        public DbSet<User> Users => Set<User>();
        public DbSet<Specialization> Specializations => Set<Specialization>();
        public DbSet<Patient> Patients => Set<Patient>();
        public DbSet<Doctor> Doctors => Set<Doctor>();
        public DbSet<Receptionist> Receptionists => Set<Receptionist>();
        public DbSet<DoctorEducation> DoctorEducations => Set<DoctorEducation>();
        public DbSet<DoctorExperience> DoctorExperiences => Set<DoctorExperience>();

        // Clinic
        public DbSet<Department> Departments => Set<Department>();
        public DbSet<Room> Rooms => Set<Room>();
        public DbSet<Service> Services => Set<Service>();
        public DbSet<DoctorService> DoctorServices => Set<DoctorService>();

        // Scheduling
        public DbSet<DoctorSchedule> DoctorSchedules => Set<DoctorSchedule>();
        public DbSet<TimeOff> TimeOffs => Set<TimeOff>();
        public DbSet<Appointment> Appointments => Set<Appointment>();

        // Medical
        public DbSet<Diagnosis> Diagnoses => Set<Diagnosis>();
        public DbSet<MedicalRecord> MedicalRecords => Set<MedicalRecord>();
        public DbSet<Allergy> Allergies => Set<Allergy>();
        public DbSet<PatientAllergy> PatientAllergies => Set<PatientAllergy>();
        public DbSet<Medication> Medications => Set<Medication>();
        public DbSet<Prescription> Prescriptions => Set<Prescription>();
        public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();
        public DbSet<MedicalDocument> MedicalDocuments => Set<MedicalDocument>();
        public DbSet<ToothRecord> ToothRecords => Set<ToothRecord>();
        public DbSet<VitalSigns> VitalSigns => Set<VitalSigns>();

        // Finance and system
        public DbSet<InsuranceCompany> InsuranceCompanies => Set<InsuranceCompany>();
        public DbSet<PatientInsurance> PatientInsurances => Set<PatientInsurance>();
        public DbSet<Invoice> Invoices => Set<Invoice>();
        public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<DoctorReview> DoctorReviews => Set<DoctorReview>();

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
           
            configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);


            foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
                fk.DeleteBehavior = DeleteBehavior.Restrict;

            modelBuilder.Entity<UserToken>().HasIndex(t => new { t.UserId, t.Purpose });
            modelBuilder.Entity<UserToken>().Property(t => t.TokenHash).HasMaxLength(128);
            modelBuilder.Entity<UserToken>().Property(t => t.NewEmail).HasMaxLength(256);

            modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
            modelBuilder.Entity<Patient>().HasIndex(p => p.PersonalNumber).IsUnique();
            modelBuilder.Entity<Doctor>().HasIndex(d => d.LicenseNumber).IsUnique();
            modelBuilder.Entity<Diagnosis>().HasIndex(d => d.Code).IsUnique();
            modelBuilder.Entity<Invoice>().HasIndex(i => i.InvoiceNumber).IsUnique();

          
            modelBuilder.Entity<Doctor>().HasIndex(d => d.UserId).IsUnique();
            modelBuilder.Entity<Receptionist>().HasIndex(r => r.UserId).IsUnique();
            modelBuilder.Entity<Patient>().HasIndex(p => p.UserId).IsUnique();

            
            modelBuilder.Entity<DoctorService>().HasIndex(x => new { x.DoctorId, x.ServiceId }).IsUnique();
            modelBuilder.Entity<PatientAllergy>().HasIndex(x => new { x.PatientId, x.AllergyId }).IsUnique();

           
            modelBuilder.Entity<DoctorReview>().HasIndex(r => r.AppointmentId).IsUnique();
        }
    }
}
