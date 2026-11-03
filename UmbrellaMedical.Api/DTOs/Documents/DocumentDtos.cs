using System.ComponentModel.DataAnnotations;
using UmbrellaMedical.Domain.Enums;

namespace UmbrellaMedical.Api.Dtos.Documents;

public class DocumentDto
{
    public int Id { get; set; }
    public DocumentType Type { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PatientId { get; set; }
    public int? MedicalRecordId { get; set; }
    public int UploadedByUserId { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class UploadDocumentRequest
{
    [Required(ErrorMessage = "A file is required.")]
    public IFormFile File { get; set; } = null!;

    [EnumDataType(typeof(DocumentType))]
    public DocumentType Type { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }

    public int? MedicalRecordId { get; set; }
}