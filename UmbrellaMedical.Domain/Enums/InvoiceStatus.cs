using System;
using System.Collections.Generic;
using System.Text;

namespace UmbrellaMedical.Domain.Enums
{
    public enum InvoiceStatus
    {
        Draft = 1,
        Issued = 2,
        PartiallyPaid = 3,
        Paid = 4,
        Cancelled = 5
    }
}
