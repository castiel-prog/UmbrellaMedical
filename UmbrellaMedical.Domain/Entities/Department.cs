using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class Department : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        public ICollection<Room> Rooms { get; set; } = new List<Room>();
        public ICollection<Service> Services { get; set; } = new List<Service>();
    }
}
