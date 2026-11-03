using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class Invoice : BaseEntity
    {
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateTime IssueDate { get; set; } = DateTime.UtcNow;
        public DateTime? DueDate { get; set; }
        public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;

        public decimal Subtotal { get; set; }                
        public decimal InsuranceCoverage { get; set; }      
        public decimal TotalAmount { get; set; }             

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int? AppointmentId { get; set; }
        public Appointment? Appointment { get; set; }

        public int? PatientInsuranceId { get; set; }
        public PatientInsurance? PatientInsurance { get; set; }

        public ICollection<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();
        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    }
}
