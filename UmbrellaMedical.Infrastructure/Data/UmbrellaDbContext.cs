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

        // Store and prescription requests
        public DbSet<Product> Products => Set<Product>();
        public DbSet<StoreOrder> StoreOrders => Set<StoreOrder>();
        public DbSet<StoreOrderItem> StoreOrderItems => Set<StoreOrderItem>();
        public DbSet<PrescriptionRequest> PrescriptionRequests => Set<PrescriptionRequest>();
        public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
        public DbSet<SupportConversation> SupportConversations => Set<SupportConversation>();
        public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            configurationBuilder.Properties<decimal>().HavePrecision(18, 2);

            // Times are stored as clinic wall-clock times (Tbilisi), not UTC instants,
            // so PostgreSQL keeps them as "timestamp without time zone".
            // Values are written as they are, whatever their DateTimeKind (as SQL Server's datetime2 did).
            configurationBuilder.Properties<DateTime>().HaveColumnType("timestamp without time zone").HaveConversion<PlainDateTimeConverter>();
            configurationBuilder.Properties<DateTime?>().HaveColumnType("timestamp without time zone").HaveConversion<PlainDateTimeConverter>();
        }

        /// <summary>Drops the DateTimeKind before saving; PostgreSQL refuses UTC-kind values in "timestamp without time zone".</summary>
        private sealed class PlainDateTimeConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>
        {
            public PlainDateTimeConverter()
                : base(v => DateTime.SpecifyKind(v, DateTimeKind.Unspecified), v => DateTime.SpecifyKind(v, DateTimeKind.Unspecified)) { }
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
            modelBuilder.Entity<User>().Property(u => u.PhotoKey).HasMaxLength(300);
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

            // Store
            modelBuilder.Entity<Product>().Property(p => p.Name).HasMaxLength(150);
            modelBuilder.Entity<Product>().Property(p => p.Description).HasMaxLength(1000);
            modelBuilder.Entity<Product>().Property(p => p.Unit).HasMaxLength(50);
            modelBuilder.Entity<Product>().HasIndex(p => p.Name).IsUnique();
            modelBuilder.Entity<Product>().Property(p => p.ImageKey).HasMaxLength(300);
            modelBuilder.Entity<StoreOrder>().Property(o => o.OrderNumber).HasMaxLength(30);
            modelBuilder.Entity<StoreOrder>().HasIndex(o => o.OrderNumber).IsUnique();
            modelBuilder.Entity<StoreOrder>().Property(o => o.PaymentReference).HasMaxLength(100);
            modelBuilder.Entity<StoreOrder>().Property(o => o.ReviewNote).HasMaxLength(500);
            modelBuilder.Entity<StoreOrder>().Property(o => o.CustomerName).HasMaxLength(100);
            modelBuilder.Entity<User>().Property(u => u.PreferredLanguage).HasMaxLength(5);
            // Support chat
            modelBuilder.Entity<SupportConversation>().Property(c => c.Subject).HasMaxLength(120);
            modelBuilder.Entity<SupportConversation>().HasIndex(c => new { c.UserId, c.LastMessageAt });
            modelBuilder.Entity<SupportConversation>().HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SupportConversation>().HasOne(c => c.ContactMessage).WithMany().HasForeignKey(c => c.ContactMessageId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<SupportMessage>().Property(m => m.Body).HasMaxLength(2000);
            modelBuilder.Entity<SupportMessage>().HasOne(m => m.Conversation).WithMany(c => c.Messages).HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SupportMessage>().HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<User>().Property(u => u.PreferredTheme).HasMaxLength(10);
            modelBuilder.Entity<Notification>().HasIndex(n => n.EmailedAt);
            modelBuilder.Entity<StoreOrder>().Property(o => o.CustomerEmail).HasMaxLength(256);
            modelBuilder.Entity<StoreOrder>().Property(o => o.CustomerPhone).HasMaxLength(30);
            modelBuilder.Entity<StoreOrderItem>().Property(i => i.ProductName).HasMaxLength(150);
            modelBuilder.Entity<StoreOrderItem>().HasIndex(i => new { i.PrescriptionId, i.ProductId });

            // Prescriptions
            modelBuilder.Entity<Prescription>().Property(p => p.Code).HasMaxLength(20);
            modelBuilder.Entity<Prescription>().HasIndex(p => p.Code).IsUnique(); // PostgreSQL allows many NULLs in a unique index
            modelBuilder.Entity<PrescriptionRequest>().Property(r => r.Message).HasMaxLength(1000);
            modelBuilder.Entity<PrescriptionRequest>().Property(r => r.DecisionNote).HasMaxLength(500);
            modelBuilder.Entity<PrescriptionRequest>().HasIndex(r => new { r.DoctorId, r.Status });

            // Contact form
            modelBuilder.Entity<ContactMessage>().Property(m => m.Name).HasMaxLength(100);
            modelBuilder.Entity<ContactMessage>().Property(m => m.Email).HasMaxLength(256);
            modelBuilder.Entity<ContactMessage>().Property(m => m.Phone).HasMaxLength(30);
            modelBuilder.Entity<ContactMessage>().Property(m => m.Topic).HasMaxLength(60);
            modelBuilder.Entity<ContactMessage>().Property(m => m.Message).HasMaxLength(2000);
            modelBuilder.Entity<ContactMessage>().HasIndex(m => new { m.IsHandled, m.CreatedAt });
        }
    }
}
