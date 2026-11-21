using UmbrellaMedical.Domain.Common;

namespace UmbrellaMedical.Domain.Entities
{
    /// <summary>A support chat between one person (patient or other user) and the clinic's support staff (admins).</summary>
    public class SupportConversation : BaseEntity
    {
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string Subject { get; set; } = string.Empty;

        /// <summary>The contact form message the chat was started from, if any.</summary>
        public int? ContactMessageId { get; set; }
        public ContactMessage? ContactMessage { get; set; }

        public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
        public bool IsClosed { get; set; }

        /// <summary>When each side last read the conversation (for unread counts).</summary>
        public DateTime? UserReadAt { get; set; }
        public DateTime? StaffReadAt { get; set; }

        public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
    }

    public class SupportMessage : BaseEntity
    {
        public int ConversationId { get; set; }
        public SupportConversation Conversation { get; set; } = null!;

        public int SenderUserId { get; set; }
        public User Sender { get; set; } = null!;

        /// <summary>True when written by support staff.</summary>
        public bool FromStaff { get; set; }
        public string Body { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}
