using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Api.Dtos.Documents;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private const long MaxFileBytes = 10 * 1024 * 1024;

    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg"
    };

    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IClinicalAccess _access;
    private readonly IFileStorage _storage;
    private readonly IAuditService _audit;

    public DocumentsController(
        UmbrellaDbContext db, ICurrentUser current, IClinicalAccess access,
        IFileStorage storage, IAuditService audit)
    {
        _db = db;
        _current = current;
        _access = access;
        _storage = storage;
        _audit = audit;
    }

    [HttpPost("patients/{patientId:int}/documents")]
    [Authorize(Roles = "Doctor,Patient")]
    [RequestSizeLimit(11_000_000)]
    public async Task<ActionResult<DocumentDto>> Upload(
        int patientId, [FromForm] UploadDocumentRequest request, CancellationToken cancellationToken)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();
        if (!await _access.CanAccessAsync(patientId)) return Forbid();

        var userId = _current.UserId;
        if (userId is null) return Unauthorized();

        if (_current.Role == "Patient")
        {
            // Patients may also upload a paper prescription, e.g. to buy a prescription-only medicine in the store.
            if (request.Type is not (DocumentType.LabResult or DocumentType.Other or DocumentType.Prescription))
                return Invalid(nameof(request.Type), "Patients can upload only lab results, prescriptions or other documents.");

            if (request.MedicalRecordId is not null)
                return Invalid(nameof(request.MedicalRecordId), "Patients cannot attach files to a doctor's record.");
        }

        var file = request.File;
        if (file.Length == 0)
            return Invalid("file", "The file is empty.");
        if (file.Length > MaxFileBytes)
            return Invalid("file", "The file is larger than 10 MB.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!ContentTypes.TryGetValue(extension, out var contentType))
            return Invalid("file", "Only PDF, PNG and JPG files are allowed.");

        if (!await SignatureMatchesAsync(file, extension, cancellationToken))
            return Invalid("file", "The file content does not match its extension.");

        if (request.MedicalRecordId is not null
            && !await _db.MedicalRecords.AnyAsync(r => r.Id == request.MedicalRecordId && r.PatientId == patientId))
        {
            return Invalid(nameof(request.MedicalRecordId), "This medical record does not belong to this patient.");
        }

        string key;
        await using (var stream = file.OpenReadStream())
        {
            key = await _storage.SaveAsync(stream, extension, cancellationToken);
        }

        var document = new MedicalDocument
        {
            Type = request.Type,
            FileName = SafeFileName(file.FileName, extension),
            FileUrl = key,
            ContentType = contentType,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            PatientId = patientId,
            MedicalRecordId = request.MedicalRecordId,
            UploadedByUserId = userId.Value
        };

        _db.MedicalDocuments.Add(document);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("UploadedDocument", nameof(MedicalDocument), document.Id);

        return CreatedAtAction(nameof(GetForPatient), new { patientId }, ToDto(document));
    }

    [HttpGet("patients/{patientId:int}/documents")]
    [Authorize(Roles = "Admin,Doctor,Patient")]
    public async Task<ActionResult<List<DocumentDto>>> GetForPatient(int patientId)
    {
        if (!await _db.Patients.AnyAsync(p => p.Id == patientId)) return NotFound();
        if (!await _access.CanAccessAsync(patientId)) return Forbid();

        var items = await _db.MedicalDocuments.AsNoTracking()
            .Where(d => d.PatientId == patientId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new DocumentDto
            {
                Id = d.Id,
                Type = d.Type,
                FileName = d.FileName,
                ContentType = d.ContentType,
                Description = d.Description,
                PatientId = d.PatientId,
                MedicalRecordId = d.MedicalRecordId,
                UploadedByUserId = d.UploadedByUserId,
                UploadedAt = d.CreatedAt
            })
            .ToListAsync();

        if (_current.Role != "Patient")
            await _audit.LogAsync("ViewedDocuments", nameof(Patient), patientId);

        return Ok(items);
    }

    [HttpGet("documents/{id:int}/download")]
    [Authorize(Roles = "Admin,Doctor,Patient")]
    public async Task<IActionResult> Download(int id)
    {
        var document = await _db.MedicalDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
        if (document is null) return NotFound();
        if (!await _access.CanAccessAsync(document.PatientId)) return Forbid();

        var stream = await _storage.OpenReadAsync(document.FileUrl);
        if (stream is null) return NotFound();

        if (_current.Role != "Patient")
            await _audit.LogAsync("DownloadedDocument", nameof(MedicalDocument), id);

        Response.Headers.CacheControl = "private, no-store";
        return File(stream, document.ContentType, document.FileName);
    }

    private ActionResult Invalid(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private static DocumentDto ToDto(MedicalDocument d) => new()
    {
        Id = d.Id,
        Type = d.Type,
        FileName = d.FileName,
        ContentType = d.ContentType,
        Description = d.Description,
        PatientId = d.PatientId,
        MedicalRecordId = d.MedicalRecordId,
        UploadedByUserId = d.UploadedByUserId,
        UploadedAt = d.CreatedAt
    };

    private static string SafeFileName(string original, string extension)
    {
        var name = Path.GetFileName(original.Replace('\\', '/'));
        name = new string(name.Where(c => !char.IsControl(c)).ToArray());

        if (name.Length > 150) name = name[^150..];
        if (string.IsNullOrWhiteSpace(name)) name = "document" + extension;

        return name;
    }

    private static async Task<bool> SignatureMatchesAsync(IFormFile file, string extension, CancellationToken cancellationToken)
    {
        var header = new byte[8];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header.AsMemory(), header.Length, false, cancellationToken);

        return extension switch
        {
            ".pdf" => read >= 4 && header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46,
            ".png" => read >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
                      && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A,
            ".jpg" or ".jpeg" => read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            _ => false
        };
    }
}