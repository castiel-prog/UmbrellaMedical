using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Billing;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class InsuranceController : ControllerBase
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IAuditService _audit;
    private readonly IClinicClock _clock;

    public InsuranceController(UmbrellaDbContext db, ICurrentUser current, IAuditService audit, IClinicClock clock)
    {
        _db = db;
        _current = current;
        _audit = audit;
        _clock = clock;
    }

    private static Expression<Func<PatientInsurance, PatientInsuranceDto>> Projection(DateOnly today) => pi => new PatientInsuranceDto
    {
        Id = pi.Id,
        PatientId = pi.PatientId,
        InsuranceCompanyId = pi.InsuranceCompanyId,
        InsuranceCompany = pi.InsuranceCompany.Name,
        PolicyNumber = pi.PolicyNumber,
        CoveragePercent = pi.CoveragePercent,
        ValidFrom = pi.ValidFrom,
        ValidTo = pi.ValidTo,
        IsCurrent = pi.ValidFrom <= today && pi.ValidTo >= today && pi.InsuranceCompany.IsActive
    };

    [HttpGet("insurance-companies")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<List<InsuranceCompanyDto>>> GetCompanies()
    {
        var items = await _db.InsuranceCompanies.AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new InsuranceCompanyDto
            {
                Id = c.Id,
                Name = c.Name,
                Phone = c.Phone,
                Email = c.Email,
                IsActive = c.IsActive
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("insurance-companies")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<InsuranceCompanyDto>> CreateCompany(UpsertInsuranceCompanyRequest request)
    {
        var name = request.Name.Trim();

        if (await _db.InsuranceCompanies.AnyAsync(c => c.Name == name))
            return Problem(
                detail: "An insurance company with this name already exists.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Duplicate company");

        var company = new InsuranceCompany
        {
            Name = name,
            Phone = request.Phone,
            Email = request.Email?.Trim().ToLowerInvariant(),
            IsActive = request.IsActive
        };

        _db.InsuranceCompanies.Add(company);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CreatedInsuranceCompany", nameof(InsuranceCompany), company.Id);

        return StatusCode(StatusCodes.Status201Created, ToDto(company));
    }

    [HttpPut("insurance-companies/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<InsuranceCompanyDto>> UpdateCompany(int id, UpsertInsuranceCompanyRequest request)
    {
        var company = await _db.InsuranceCompanies.FirstOrDefaultAsync(c => c.Id == id);
        if (company is null) return NotFound();

        var name = request.Name.Trim();

        if (await _db.InsuranceCompanies.AnyAsync(c => c.Name == name && c.Id != id))
            return Problem(
                detail: "An insurance company with this name already exists.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Duplicate company");

        company.Name = name;
        company.Phone = request.Phone;
        company.Email = request.Email?.Trim().ToLowerInvariant();
        company.IsActive = request.IsActive;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedInsuranceCompany", nameof(InsuranceCompany), id);

        return Ok(ToDto(company));
    }

    [HttpGet("patients/{patientId:int}/insurances")]
    [Authorize(Roles = "Admin,Receptionist,Patient")]
    public async Task<ActionResult<List<PatientInsuranceDto>>> GetForPatient(int patientId)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();

        if (_current.Role == "Patient" && patientId != await _current.GetPatientIdAsync())
            return Forbid();

        var today = DateOnly.FromDateTime(_clock.Now);

        var items = await _db.PatientInsurances.AsNoTracking()
            .Where(pi => pi.PatientId == patientId)
            .OrderByDescending(pi => pi.ValidTo)
            .Select(Projection(today))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("patients/{patientId:int}/insurances")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<PatientInsuranceDto>> AddForPatient(int patientId, CreatePatientInsuranceRequest request)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();

        if (request.ValidTo < request.ValidFrom)
            return Invalid(nameof(request.ValidTo), "The end date cannot be before the start date.");

        var company = await _db.InsuranceCompanies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.InsuranceCompanyId);

        if (company is null || !company.IsActive)
            return Invalid(nameof(request.InsuranceCompanyId), "This insurance company does not exist or is not active.");

        var policyNumber = request.PolicyNumber.Trim();

        if (await _db.PatientInsurances.AnyAsync(pi => pi.InsuranceCompanyId == request.InsuranceCompanyId
                                                       && pi.PolicyNumber == policyNumber))
        {
            return Problem(
                detail: "This policy number is already registered for this insurer.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Duplicate policy");
        }

        if (await OverlapsAsync(patientId, request.InsuranceCompanyId, request.ValidFrom, request.ValidTo, null))
            return Problem(
                detail: "The patient already has a policy with this insurer in that period.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Overlapping policy");

        var policy = new PatientInsurance
        {
            PatientId = patientId,
            InsuranceCompanyId = request.InsuranceCompanyId,
            PolicyNumber = policyNumber,
            CoveragePercent = request.CoveragePercent,
            ValidFrom = request.ValidFrom,
            ValidTo = request.ValidTo
        };

        _db.PatientInsurances.Add(policy);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("AddedPatientInsurance", nameof(PatientInsurance), policy.Id);

        var dto = await LoadAsync(policy.Id);
        return StatusCode(StatusCodes.Status201Created, dto);
    }

    [HttpPut("patients/{patientId:int}/insurances/{id:int}")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<ActionResult<PatientInsuranceDto>> UpdateForPatient(
        int patientId, int id, UpdatePatientInsuranceRequest request)
    {
        var policy = await _db.PatientInsurances.FirstOrDefaultAsync(pi => pi.Id == id && pi.PatientId == patientId);
        if (policy is null) return NotFound();

        if (request.ValidTo < request.ValidFrom)
            return Invalid(nameof(request.ValidTo), "The end date cannot be before the start date.");

        if (await OverlapsAsync(patientId, policy.InsuranceCompanyId, request.ValidFrom, request.ValidTo, id))
            return Problem(
                detail: "The patient already has a policy with this insurer in that period.",
                statusCode: StatusCodes.Status409Conflict,
                title: "Overlapping policy");

        policy.CoveragePercent = request.CoveragePercent;
        policy.ValidFrom = request.ValidFrom;
        policy.ValidTo = request.ValidTo;

        await _db.SaveChangesAsync();
        await _audit.LogAsync("UpdatedPatientInsurance", nameof(PatientInsurance), id);

        return Ok(await LoadAsync(id));
    }

    private Task<bool> OverlapsAsync(int patientId, int companyId, DateOnly from, DateOnly to, int? excludeId) =>
        _db.PatientInsurances.AnyAsync(pi => pi.PatientId == patientId
                                             && pi.InsuranceCompanyId == companyId
                                             && pi.ValidFrom <= to
                                             && pi.ValidTo >= from
                                             && (excludeId == null || pi.Id != excludeId));

    private Task<PatientInsuranceDto?> LoadAsync(int id)
    {
        var today = DateOnly.FromDateTime(_clock.Now);
        return _db.PatientInsurances.AsNoTracking().Where(pi => pi.Id == id).Select(Projection(today)).FirstOrDefaultAsync();
    }

    private static InsuranceCompanyDto ToDto(InsuranceCompany c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Phone = c.Phone,
        Email = c.Email,
        IsActive = c.IsActive
    };

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }
}