using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class DoctorEducation : BaseEntity
    {
        public string Institution { get; set; } = string.Empty;
        public string Degree { get; set; } = string.Empty;    
        public int StartYear { get; set; }
        public int GraduationYear { get; set; }
        public string? DiplomaFileUrl { get; set; }           

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;
    }
}
