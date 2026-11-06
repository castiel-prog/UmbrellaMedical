using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace UmbrellaMedical.Api.Swagger;


public class TagOrderDocumentFilter : IDocumentFilter
{
    private static readonly string[] Order =
    {
"Auth", "Account", "Patients", "Doctors", "DoctorServices", "Services", "Specializations", "Appointments", "TimeOff", "Reviews", "Receptionists", "MedicalRecords", "Prescriptions", "Documents", "Catalog", "PatientAllergies", "Invoices", "Payments", "Insurance", "Departments", "Rooms", "AdminServices", "AdminUsers", "StaffSchedule", "Reports"   };

    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        var used = context.ApiDescriptions
            .Select(d => d.ActionDescriptor.RouteValues.TryGetValue("controller", out var name) ? name : null)
            .OfType<string>()
            .Distinct()
            .ToList();

   
        var ordered = Order.Where(used.Contains)
            .Concat(used.Where(n => !Order.Contains(n)).OrderBy(n => n));

        swaggerDoc.Tags = ordered.Select(n => new OpenApiTag { Name = n }).ToList();
    }
}