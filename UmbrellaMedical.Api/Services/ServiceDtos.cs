using System.ComponentModel.DataAnnotations;

namespace UmbrellaMedical.Api.Services
{
    public class ServiceDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int DurationMinutes { get; set; }
        public int DepartmentId { get; set; }
        public string Department { get; set; } = string.Empty;
    }

    public class AssignServicesRequest
    {
        [Required, MaxLength(50)]
        public List<int> ServiceIds { get; set; } = new();
    }
}
