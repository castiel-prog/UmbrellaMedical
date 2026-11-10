namespace UmbrellaMedical.Api.Dtos.Notifications;

public class NotificationDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
    public int? AppointmentId { get; set; }
}

public class UnreadCountDto
{
    public int Count { get; set; }
}

public class ReminderRunResultDto
{
    public int RemindersSent { get; set; }
}