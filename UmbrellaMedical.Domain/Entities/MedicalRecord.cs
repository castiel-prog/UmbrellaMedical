using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class MedicalRecord : BaseEntity
    {
        public DateTime RecordDate { get; set; } = DateTime.UtcNow;
        public string? Complaints { get; set; }              // what the patient reported
        public string? DiagnosisDetails { get; set; }        // the doctor's extra notes on the diagnosis
        public string? Treatment { get; set; }
        public string? Recommendations { get; set; }
        public string? Notes { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;

        public int? AppointmentId { get; set; }             
        public Appointment? Appointment { get; set; }

        public int? DiagnosisId { get; set; }
        public Diagnosis? Diagnosis { get; set; }

        public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();
        public ICollection<MedicalDocument> Documents { get; set; } = new List<MedicalDocument>();
        public ICollection<ToothRecord> ToothRecords { get; set; } = new List<ToothRecord>();
        public ICollection<VitalSigns> VitalSigns { get; set; } = new List<VitalSigns>();

    }
}
