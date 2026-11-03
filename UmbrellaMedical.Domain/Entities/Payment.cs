using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class Payment : BaseEntity
    {

        public decimal Amount { get; set; }
        public PaymentMethod Method { get; set; }
        public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
        public DateTime? PaidAt { get; set; }
        public string? TransactionReference { get; set; }    

        public int InvoiceId { get; set; }
        public Invoice Invoice { get; set; } = null!;

    }
}
