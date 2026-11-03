using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class PrescriptionItem : BaseEntity
    {
        public string Dosage { get; set; } = string.Empty;       
        public string Frequency { get; set; } = string.Empty;    
        public int DurationDays { get; set; }

        public int PrescriptionId { get; set; }
        public Prescription Prescription { get; set; } = null!;

        public int MedicationId { get; set; }
        public Medication Medication { get; set; } = null!;
    }
}
