using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class DoctorSchedule : BaseEntity
    {
        public DayOfWeek DayOfWeek { get; set; }     
        public TimeOnly StartTime { get; set; }      
        public TimeOnly EndTime { get; set; }       
        public bool IsActive { get; set; } = true;

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;
    }
}
