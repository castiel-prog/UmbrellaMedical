using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class DoctorReview : BaseEntity
    {
        public int Rating { get; set; }                   
        public string? Comment { get; set; }
        public bool IsApproved { get; set; } = true;        

        public int DoctorId { get; set; }
        public Doctor Doctor { get; set; } = null!;

        public int PatientId { get; set; }
        public Patient Patient { get; set; } = null!;

        public int AppointmentId { get; set; }              
        public Appointment Appointment { get; set; } = null!;
    }
}
