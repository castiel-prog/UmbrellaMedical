using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class Allergy : BaseEntity
    {
        public string Name { get; set; } = string.Empty;     
        public string? Description { get; set; }
    }
}
