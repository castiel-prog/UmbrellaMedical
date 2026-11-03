using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class Room : BaseEntity
    {
        public string Number { get; set; } = string.Empty;  
        public int Floor { get; set; }
        public RoomType Type { get; set; }
        public bool IsActive { get; set; } = true;

        public int DepartmentId { get; set; }
        public Department Department { get; set; } = null!;
    }
}
