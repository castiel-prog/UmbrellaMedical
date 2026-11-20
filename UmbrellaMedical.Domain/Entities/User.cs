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

        /// <summary>Site language chosen by the user (en, ka, de, fr, it, es, ru); null = not chosen yet.</summary>
        public string? PreferredLanguage { get; set; }
        /// <summary>"light" or "dark"; null = follow the device.</summary>
        public string? PreferredTheme { get; set; }
        /// <summary>Email a reminder before each appointment.</summary>
        public bool EmailReminders { get; set; } = true;
        /// <summary>Email a copy of each in-app notification (orders, prescriptions, appointment changes).</summary>
        public bool EmailNotifications { get; set; }

        public int RoleId { get; set; }
        public Role Role { get; set; } = null!;
        public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    }
}
