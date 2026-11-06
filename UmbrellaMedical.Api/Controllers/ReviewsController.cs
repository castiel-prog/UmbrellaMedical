using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Reviews;
using UmbrellaMedical.Api.DTOs.Common;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class ReviewsController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IAuditService _audit;

    public ReviewsController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit)
    {
        _db = db;
        _current = current;
        _audit = audit;
    }

    [HttpGet("doctors/{doctorId:int}/reviews")]
    [AllowAnonymous]
    public async Task<ActionResult<DoctorReviewsResponse>> GetForDoctor(
        int doctorId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var doctor = await _db.Doctors.AsNoTracking()
            .Where(d => d.Id == doctorId)
            .Select(d => new { d.AverageRating, d.ReviewCount })
            .FirstOrDefaultAsync();

        if (doctor is null) return NotFound();

        var query = _db.DoctorReviews.AsNoTracking().Where(r => r.DoctorId == doctorId && r.IsApproved);
        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReviewDto
            {
                Id = r.Id,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                AuthorName = r.Patient.FirstName + " " + r.Patient.LastName.Substring(0, 1) + "."
            })
            .ToListAsync();

        var counts = await query
            .GroupBy(r => r.Rating)
            .Select(g => new { Rating = g.Key, Count = g.Count() })
            .ToListAsync();

        var distribution = Enumerable.Range(1, 5)
            .Reverse()
            .Select(star => new RatingCountDto
            {
                Rating = star,
                Count = counts.FirstOrDefault(c => c.Rating == star)?.Count ?? 0
            })
            .ToList();

        return Ok(new DoctorReviewsResponse
        {
            Summary = new ReviewSummaryDto
            {
                AverageRating = doctor.AverageRating,
                ReviewCount = doctor.ReviewCount,
                Stars = ToStars(doctor.AverageRating),
                Distribution = distribution
            },
            Reviews = new PagedResult<ReviewDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total
            }
        });
    }

    [HttpPost("doctors/{doctorId:int}/reviews")]
    [Authorize(Roles = "Patient")]
    public async Task<ActionResult<ReviewDto>> Create(int doctorId, CreateReviewRequest request)
    {
        if (!await _db.Doctors.AnyAsync(d => d.Id == doctorId)) return NotFound();

        var patientId = await _current.GetPatientIdAsync();
        if (patientId is null) return Forbid();

        var appointment = await _db.Appointments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId);

        if (appointment is null || appointment.PatientId != patientId.Value || appointment.DoctorId != doctorId)
            return Invalid(nameof(request.AppointmentId), "This appointment does not belong to you and this doctor.");

        if (appointment.Status != AppointmentStatus.Completed)
            return Invalid(nameof(request.AppointmentId), "You can review a doctor only after a completed appointment.");

        if (await _db.DoctorReviews.AnyAsync(r => r.AppointmentId == request.AppointmentId))
            return AlreadyReviewed();

        var review = new DoctorReview
        {
            DoctorId = doctorId,
            PatientId = patientId.Value,
            AppointmentId = request.AppointmentId,
            Rating = request.Rating,
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(),
            IsApproved = true
        };

        try
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            _db.DoctorReviews.Add(review);
            await _db.SaveChangesAsync();

            await RecalculateRatingAsync(doctorId);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
        }
        catch (DbUpdateException)
        {
            return AlreadyReviewed();
        }

        await _audit.LogAsync("CreatedReview", nameof(DoctorReview), review.Id);

        var patient = await _db.Patients.AsNoTracking()
            .Where(p => p.Id == patientId.Value)
            .Select(p => new { p.FirstName, p.LastName })
            .FirstAsync();

        return StatusCode(StatusCodes.Status201Created, new ReviewDto
        {
            Id = review.Id,
            Rating = review.Rating,
            Comment = review.Comment,
            CreatedAt = review.CreatedAt,
            AuthorName = patient.FirstName + " " + patient.LastName.Substring(0, 1) + "."
        });
    }

    [HttpGet("admin/reviews")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PagedResult<AdminReviewDto>>> GetAllForAdmin(
        [FromQuery] int? doctorId, [FromQuery] bool? isApproved,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.DoctorReviews.AsNoTracking().AsQueryable();
        if (doctorId is not null) query = query.Where(r => r.DoctorId == doctorId);
        if (isApproved is not null) query = query.Where(r => r.IsApproved == isApproved);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new AdminReviewDto
            {
                Id = r.Id,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                IsApproved = r.IsApproved,
                DoctorId = r.DoctorId,
                DoctorName = r.Doctor.FirstName + " " + r.Doctor.LastName,
                PatientId = r.PatientId,
                PatientName = r.Patient.FirstName + " " + r.Patient.LastName
            })
            .ToListAsync();

        return Ok(new PagedResult<AdminReviewDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    [HttpPut("reviews/{id:int}/visibility")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetVisibility(int id, ReviewVisibilityRequest request)
    {
        var review = await _db.DoctorReviews.FirstOrDefaultAsync(r => r.Id == id);
        if (review is null) return NotFound();

        await using var tx = await _db.Database.BeginTransactionAsync();

        review.IsApproved = request.IsApproved;
        await _db.SaveChangesAsync();

        await RecalculateRatingAsync(review.DoctorId);
        await _db.SaveChangesAsync();

        await tx.CommitAsync();

        await _audit.LogAsync(request.IsApproved ? "ShowedReview" : "HidReview", nameof(DoctorReview), id);

        return NoContent();
    }

    private async Task RecalculateRatingAsync(int doctorId)
    {
        var doctor = await _db.Doctors.FirstAsync(d => d.Id == doctorId);
        var approved = _db.DoctorReviews.Where(r => r.DoctorId == doctorId && r.IsApproved);

        var count = await approved.CountAsync();
        doctor.ReviewCount = count;
        doctor.AverageRating = count == 0
            ? 0
            : Math.Round((decimal)await approved.AverageAsync(r => (double)r.Rating), 2);
    }

    private static decimal ToStars(decimal average) =>
        Math.Round(average * 2, MidpointRounding.AwayFromZero) / 2;

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private ActionResult AlreadyReviewed() =>
        Problem(
            detail: "You have already reviewed this appointment.",
            statusCode: StatusCodes.Status409Conflict,
            title: "Already reviewed");
}