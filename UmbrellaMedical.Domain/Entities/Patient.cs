using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class Patient : BaseEntity
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string PersonalNumber { get; set; } = string.Empty; // detect duplicates
        public DateOnly DateOfBirth { get; set; }
        public Gender Gender { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? MedicalHistory { get; set; }

        public int? UserId { get; set; }   
        public User? User { get; set; }

        public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
        public ICollection<PatientAllergy> PatientAllergies { get; set; } = new List<PatientAllergy>();
        public ICollection<MedicalRecord> MedicalRecords { get; set; } = new List<MedicalRecord>();
        public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();
        public ICollection<MedicalDocument> Documents { get; set; } = new List<MedicalDocument>();
        public ICollection<PatientInsurance> Insurances { get; set; } = new List<PatientInsurance>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public ICollection<DoctorReview> Reviews { get; set; } = new List<DoctorReview>();
        public ICollection<ToothRecord> ToothRecords { get; set; } = new List<ToothRecord>();
        public ICollection<VitalSigns> VitalSigns { get; set; } = new List<VitalSigns>();
    }
}
