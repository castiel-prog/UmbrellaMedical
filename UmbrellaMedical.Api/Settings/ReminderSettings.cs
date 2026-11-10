namespace UmbrellaMedical.Api.Settings
{
    public class ReminderSettings
    {
        public bool Enabled { get; set; } = true;
        public int HoursBefore { get; set; } = 24;
        public int CheckIntervalMinutes { get; set; } = 5;
        public int BatchSize { get; set; } = 50;
    }
}
