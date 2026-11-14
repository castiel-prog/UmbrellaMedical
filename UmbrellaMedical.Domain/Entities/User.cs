using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class User : BaseEntity
    {
        public string Email { get; set; } = string.Empty;
        public bool EmailConfirmed { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public string? PhotoKey { get; set; }   // storage key of the profile picture; null = none

        public int RoleId { get; set; }
        public Role Role { get; set; } = null!;
        public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    }
}
