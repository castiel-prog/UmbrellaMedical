using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class AuditLog : BaseEntity
    {
        public string Action { get; set; } = string.Empty;     
        public string EntityName { get; set; } = string.Empty;  
        public int? EntityId { get; set; }
        public string? Details { get; set; }
        public string? IpAddress { get; set; }

        public int? UserId { get; set; }                         
        public User? User { get; set; }
    }
}
