using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api.Services;

/// <summary>
/// Patients must confirm their e-mail address before they can book a visit or buy something, so every booking and
/// order belongs to a real, reachable person. Staff accounts are not affected (reception can still book for a patient).
/// Answers 403 with <c>code = "email_not_confirmed"</c>, which the website uses to show the confirmation box.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireConfirmedEmailAttribute : Attribute, IAsyncActionFilter
{
    public const string ErrorCode = "email_not_confirmed";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;
        if (user.IsInRole("Patient") && int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            var db = context.HttpContext.RequestServices.GetRequiredService<UmbrellaDbContext>();
            var confirmed = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.EmailConfirmed).FirstOrDefaultAsync();
            if (!confirmed)
            {
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Email not confirmed",
                    Detail = "Confirm your email address before booking a visit or placing an order. We sent a 6-digit code to your email; you can ask for a new one."
                };
                problem.Extensions["code"] = ErrorCode;
                context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }
        }

        await next();
    }
}
