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

        /// <summary>The visit's active invoice, if any (prepaid online or billed at the desk).</summary>
        public int? InvoiceId { get; set; }
        /// <summary>How much has been paid on that invoice.</summary>
        public decimal AmountPaid { get; set; }
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

        /// <summary>Card used to pay up front. Required when a patient books online and something is due.</summary>
        public PaymentCardRequest? Card { get; set; }
    }

    public class PaymentCardRequest
    {
        [Required(ErrorMessage = "Card number is required."), StringLength(25)]
        public string Number { get; set; } = string.Empty;

        [Range(1, 12, ErrorMessage = "Expiry month must be between 1 and 12.")]
        public int ExpiryMonth { get; set; }

        [Range(0, 2100, ErrorMessage = "Expiry year is not valid.")]
        public int ExpiryYear { get; set; }

        [Required(ErrorMessage = "Security code is required."), StringLength(4, MinimumLength = 3, ErrorMessage = "The security code must be 3 or 4 digits.")]
        public string Cvc { get; set; } = string.Empty;

        [Required(ErrorMessage = "Name on the card is required."), StringLength(100)]
        public string HolderName { get; set; } = string.Empty;
    }

    public class BookingQuoteDto
    {
        public decimal Price { get; set; }
        public decimal InsuranceCoverage { get; set; }
        public decimal AmountDue { get; set; }
        public string? InsuranceCompany { get; set; }
        public decimal? CoveragePercent { get; set; }
        /// <summary>True when the patient must pay by card to complete an online booking.</summary>
        public bool PaymentRequired { get; set; }
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