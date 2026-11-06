using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Dtos.Leave;

public class TimeOffDto
{
    public int Id { get; set; }
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public TimeOffType Type { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public string? Reason { get; set; }
    public TimeOffStatus Status { get; set; }
    public string? DeclineReason { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int ConflictingAppointments { get; set; }
}

public class CreateTimeOffRequest
{
    [EnumDataType(typeof(TimeOffType))]
    public TimeOffType Type { get; set; }

    public DateTime StartDateTime { get; set; }

    public DateTime EndDateTime { get; set; }

    [StringLength(500)]
    public string? Reason { get; set; }
}

public class ApproveTimeOffRequest
{
    public bool CancelConflictingAppointments { get; set; }
}

public class DeclineTimeOffRequest
{
    [Required(ErrorMessage = "A reason is required when declining."), StringLength(500, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}

public class ConflictingAppointmentDto
{
    public int Id { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
}