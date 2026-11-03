using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class Prescription : BaseEntity
    {
        public DateTime IssuedDate { get; set; } = DateTime.UtcNow;
        public DateTime ExpiryDate { get; set; }
        public string? Instructions { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;

        public int? MedicalRecordId { get; set; }
        public MedicalRecord? MedicalRecord { get; set; }

        public ICollection<PrescriptionItem> Items { get; set; } = new List<PrescriptionItem>();
    
}
}
