using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Domain.Enums;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

public interface IClinicalAccess
{
    Task<bool> CanAccessAsync(int patientId);
    Task<bool> DoctorCanTreatAsync(int doctorId, int patientId);
}

public class ClinicalAccess : IClinicalAccess
{
    private readonly UmbrellaDbContext _db;
    private readonly ICurrentUser _current;

    public ClinicalAccess(UmbrellaDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<bool> CanAccessAsync(int patientId)
    {
        switch (_current.Role)
        {
            case "Admin":
                return true;

            case "Doctor":
                {
                    var doctorId = await _current.GetDoctorIdAsync();
                    return doctorId is not null && await DoctorCanTreatAsync(doctorId.Value, patientId);
                }

            case "Patient":
                {
                    var ownId = await _current.GetPatientIdAsync();
                    return ownId == patientId;
                }

            default:
                return false;
        }
    }

    public Task<bool> DoctorCanTreatAsync(int doctorId, int patientId) =>
        _db.Appointments.AnyAsync(a => a.DoctorId == doctorId
                                       && a.PatientId == patientId
                                       && a.Status != AppointmentStatus.Cancelled);
}