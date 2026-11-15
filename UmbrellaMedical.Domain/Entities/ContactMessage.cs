using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    /// <summary>A message sent through the public contact form, answered by the clinic.</summary>
    public class ContactMessage : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Topic { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsHandled { get; set; }
        public DateTime? HandledAt { get; set; }
    }
}
