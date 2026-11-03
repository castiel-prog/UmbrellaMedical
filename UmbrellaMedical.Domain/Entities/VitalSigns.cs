using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class VitalSigns : BaseEntity
    {
        public decimal? HeightCm { get; set; }
        public decimal? WeightKg { get; set; }
        public int? SystolicBp { get; set; }                 // top blood pressure number
        public int? DiastolicBp { get; set; }                // bottom blood pressure number
        public int? HeartRate { get; set; }
        public decimal? TemperatureC { get; set; }
        public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int? MedicalRecordId { get; set; }
        public MedicalRecord? MedicalRecord { get; set; }
    }
}
