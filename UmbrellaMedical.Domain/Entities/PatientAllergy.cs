using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class PatientAllergy : BaseEntity
    {
        public AllergySeverity Severity { get; set; }
        public string? Notes { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int AllergyId { get; set; }
        public Allergy Allergy { get; set; } = null!;
    }
}
