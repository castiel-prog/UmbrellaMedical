namespace UmbrellaMedical.Domain.Enums
{
    public enum ProductCategory
    {
        Medicines = 1,
        Vitamins = 2,
        PersonalCare = 3,
        Hygiene = 4,
        FirstAid = 5,
        Devices = 6
    }

    public enum StoreOrderStatus
    {
        /// <summary>Paid, waiting for staff to check an uploaded prescription.</summary>
        AwaitingReview = 1,
        /// <summary>Paid and ready to collect at the clinic pharmacy desk.</summary>
        ReadyForPickup = 2,
        /// <summary>Collected by the patient.</summary>
        Completed = 3,
        /// <summary>The uploaded prescription was not accepted; refunded.</summary>
        Rejected = 4,
        /// <summary>Cancelled by the patient or staff before pickup; refunded.</summary>
        Cancelled = 5
    }

    public enum PrescriptionRequestStatus
    {
        Pending = 1,
        Approved = 2,
        Declined = 3,
        Withdrawn = 4
    }
}
