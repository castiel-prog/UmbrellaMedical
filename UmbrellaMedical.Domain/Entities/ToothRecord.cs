using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class ToothRecord : BaseEntity
    {
        public int ToothNumber { get; set; }                 
        public ToothCondition Condition { get; set; }
        public string? Treatment { get; set; }
        public string? Notes { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int? MedicalRecordId { get; set; }           
        public MedicalRecord? MedicalRecord { get; set; }
    }
}
