using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class Medication : BaseEntity
    {
        public string Name { get; set; } = string.Empty;        
        public string? GenericName { get; set; }                
        public string? Form { get; set; }                        
        public string? Strength { get; set; }                   
        public string? Manufacturer { get; set; }

    }
}
