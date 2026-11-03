using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class MedicalDocument : BaseEntity
    {
        public DocumentType Type { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;  // magalitad .pdf, .png
        public string? Description { get; set; }

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int? MedicalRecordId { get; set; }
        public MedicalRecord? MedicalRecord { get; set; }

        public int UploadedByUserId { get; set; }
        public User UploadedByUser { get; set; } = null!;
    }
}
