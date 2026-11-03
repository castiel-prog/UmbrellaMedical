using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Domain.Entities
{
    public class TimeOff : BaseEntity
    {
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public TimeOffType Type { get; set; }
        public string? Reason { get; set; }              

      
        public TimeOffStatus Status { get; set; } = TimeOffStatus.Pending;
        public string? DeclineReason { get; set; }      
        public DateTime? ReviewedAt { get; set; }

        public int? ReviewedByUserId { get; set; }       
        public User? ReviewedByUser { get; set; }

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;
    }
}
