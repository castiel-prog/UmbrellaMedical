using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class PatientInsurance : BaseEntity
    {
        public string PolicyNumber { get; set; } = string.Empty;
        public decimal CoveragePercent { get; set; }        
        public DateOnly ValidFrom { get; set; }
        public DateOnly ValidTo { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int InsuranceCompanyId { get; set; }
        public InsuranceCompany InsuranceCompany { get; set; } = null!;
    }
}
