using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Api.DTOs.Common;

namespace UmbrellaMedical.Api.Dtos.Reviews;

public class CreateReviewRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Appointment is required.")]
    public int AppointmentId { get; set; }

    [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5.")]
    public int Rating { get; set; }

    [StringLength(1000)]
    public string? Comment { get; set; }
}

public class ReviewDto
{
    public int Id { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
    public string AuthorName { get; set; } = string.Empty;
}

public class RatingCountDto
{
    public int Rating { get; set; }
    public int Count { get; set; }
}

public class ReviewSummaryDto
{
    public decimal AverageRating { get; set; }
    public int ReviewCount { get; set; }
    public decimal Stars { get; set; }
    public List<RatingCountDto> Distribution { get; set; } = new();
}

public class DoctorReviewsResponse
{
    public ReviewSummaryDto Summary { get; set; } = new();
    public PagedResult<ReviewDto> Reviews { get; set; } = new();
}

public class AdminReviewDto
{
    public int Id { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsApproved { get; set; }
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
}

public class ReviewVisibilityRequest
{
    public bool IsApproved { get; set; }
}