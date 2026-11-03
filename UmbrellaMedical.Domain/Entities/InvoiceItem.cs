using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class InvoiceItem : BaseEntity
    {
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }              

        public int InvoiceId { get; set; }
        public Invoice Invoice { get; set; } = null!;

        public int? ServiceId { get; set; }
        public Service? Service { get; set; }
    }
}
