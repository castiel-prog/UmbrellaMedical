using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.DTOs.Appointments
{

    public class AppointmentDto
    {
        public int Id { get; set; }
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public AppointmentStatus Status { get; set; }
        public string? Reason { get; set; }
        public string? Notes { get; set; }
        public string? CancellationReason { get; set; }

        public int PatientId { get; set; }
        public string PatientName { get; set; } = string.Empty;

        public int DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public string Specialization { get; set; } = string.Empty;

        public int ServiceId { get; set; }
        public string ServiceName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int DurationMinutes { get; set; }
    }

    public class CreateAppointmentRequest
    {
        [Range(1, int.MaxValue, ErrorMessage = "Doctor is required.")]
        public int DoctorId { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Service is required.")]
        public int ServiceId { get; set; }

     
        public DateTime StartDateTime { get; set; }

        [StringLength(500)]
        public string? Reason { get; set; }

        public int? PatientId { get; set; }
    }

    public class RescheduleAppointmentRequest
    {
        public DateTime StartDateTime { get; set; }
    }

    public class CompleteAppointmentRequest
    {
        [StringLength(4000)]
        public string? Notes { get; set; }
    }

    public class SlotDto
    {
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
    }

    public class SlotsResponse
    {
        public DateOnly Date { get; set; }
        public int DoctorId { get; set; }
        public int ServiceId { get; set; }
        public int DurationMinutes { get; set; }
        public List<SlotDto> Slots { get; set; } = new();
    }
}