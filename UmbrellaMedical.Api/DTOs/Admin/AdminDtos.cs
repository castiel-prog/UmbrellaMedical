using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Api.DTOs.Doctors;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Dtos.Admin;

public class DepartmentDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int RoomCount { get; set; }
    public int ServiceCount { get; set; }
}

public class UpsertDepartmentRequest
{
    [Required(ErrorMessage = "Name is required."), StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }
}

public class RoomDto
{
    public int Id { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Floor { get; set; }
    public RoomType Type { get; set; }
    public bool IsActive { get; set; }
    public int DepartmentId { get; set; }
    public string Department { get; set; } = string.Empty;
}

public class UpsertRoomRequest
{
    [Required(ErrorMessage = "Room number is required."), StringLength(30)]
    public string Number { get; set; } = string.Empty;

    [Range(-5, 100, ErrorMessage = "Floor must be between -5 and 100.")]
    public int Floor { get; set; }

    [EnumDataType(typeof(RoomType))]
    public RoomType Type { get; set; }

    public bool IsActive { get; set; } = true;

    [Range(1, int.MaxValue, ErrorMessage = "Department is required.")]
    public int DepartmentId { get; set; }
}

public class AdminServiceDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; }
    public int DepartmentId { get; set; }
    public string Department { get; set; } = string.Empty;
    public int DoctorCount { get; set; }
}

public class UpsertServiceRequest
{
    [Required(ErrorMessage = "Name is required."), StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [Range(0.01, 100000.0, ErrorMessage = "Price must be between 0.01 and 100000.")]
    public decimal Price { get; set; }

    [Range(5, 480, ErrorMessage = "Duration must be between 5 and 480 minutes.")]
    public int DurationMinutes { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Department is required.")]
    public int DepartmentId { get; set; }

    public bool IsActive { get; set; } = true;
}

public class UserListItemDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public bool IsActive { get; set; }
    public bool EmailConfirmed { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserStatusRequest
{
    public bool IsActive { get; set; }

    [StringLength(500)]
    public string? Reason { get; set; }
}

public class TimeOffPeriodDto
{
    public int Id { get; set; }
    public TimeOffType Type { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
}

public class ScheduleDayDto
{
    public DateOnly Date { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public List<string> Shifts { get; set; } = new();
    public bool OnLeave { get; set; }
    public int ScheduledAppointments { get; set; }
}

public class DoctorScheduleOverviewDto
{
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public List<ScheduleItemDto> WeeklyHours { get; set; } = new();
    public List<TimeOffPeriodDto> TimeOff { get; set; } = new();
    public List<ScheduleDayDto> Days { get; set; } = new();
}