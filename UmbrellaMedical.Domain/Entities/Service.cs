using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class Service : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int DurationMinutes { get; set; }          
        public bool IsActive { get; set; } = true;

        public int DepartmentId { get; set; }
        public Department Department { get; set; } = null!;

        public ICollection<DoctorService> DoctorServices { get; set; } = new List<DoctorService>();
    }
}

