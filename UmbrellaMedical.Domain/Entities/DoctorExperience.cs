using System;
using System.Collections.Generic;
using System.Text;
using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    public class DoctorExperience : BaseEntity
    {
     public string Workplace { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }   // empty = still working there
    public string? Description { get; set; }

    public int DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;
}
}
