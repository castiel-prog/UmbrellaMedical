using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class Doctor : BaseEntity
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string LicenseNumber { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Bio { get; set; }
        public string? PhotoUrl { get; set; }
        public int YearsOfExperience { get; set; }

        public decimal AverageRating { get; set; }
        public int ReviewCount { get; set; }

        public int SpecializationId { get; set; }
        public Specialization Specialization { get; set; } = null!;

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public ICollection<DoctorEducation> Educations { get; set; } = new List<DoctorEducation>();
        public ICollection<DoctorExperience> Experiences { get; set; } = new List<DoctorExperience>();
        public ICollection<DoctorService> DoctorServices { get; set; } = new List<DoctorService>();
        public ICollection<DoctorSchedule> Schedules { get; set; } = new List<DoctorSchedule>();
        public ICollection<TimeOff> TimeOffs { get; set; } = new List<TimeOff>();
        public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
        public ICollection<MedicalRecord> MedicalRecords { get; set; } = new List<MedicalRecord>();
        public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();
        public ICollection<DoctorReview> Reviews { get; set; } = new List<DoctorReview>();
    }
}


