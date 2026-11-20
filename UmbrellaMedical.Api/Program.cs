using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerUI;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Api.Settings;
using UmbrellaMedical.Api.Swagger;
using UmbrellaMedical.Infrastructure.Data;

namespace UmbrellaMedical.Api
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.WebHost.ConfigureKestrel(o => o.AddServerHeader = false);

            builder.Services.AddControllers()
                .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

            builder.Services.AddRouting(o => o.LowercaseUrls = true);

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "Umbrella Medical Center API",
                    Version = "v1",
                    Description = "REST API of the Umbrella Medical Center clinic system: doctors, booking, payments, medical records, " +
                                  "prescriptions, pharmacy and administration.\n\n" +
                                  "**To call protected endpoints:** use POST /api/auth/login, copy the `token` from the response, " +
                                  "press **Authorize** and paste it."
                });

                c.DocumentFilter<TagOrderDocumentFilter>();

                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Description = "Paste the token from the login response (no 'Bearer' prefix needed)",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT"
                });

                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            builder.Services.AddDbContext<UmbrellaDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services.AddHttpContextAccessor();
            builder.Services.AddProblemDetails();
            builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

            builder.Services.AddHealthChecks()
                .AddDbContextCheck<UmbrellaDbContext>("database", tags: new[] { "ready" });

            builder.Services.AddScoped<ICurrentUser, CurrentUser>();
            builder.Services.AddScoped<IAuditService, AuditService>();
            builder.Services.AddScoped<IAppointmentSlotService, AppointmentSlotService>();
            builder.Services.AddScoped<IClinicalAccess, ClinicalAccess>();
            builder.Services.AddScoped<IUserTokenService, UserTokenService>();
            builder.Services.AddScoped<INotificationService, NotificationService>();
            builder.Services.AddScoped<IReminderService, ReminderService>();
            // Simulated card processor. Replace with a real provider's IPaymentGateway before taking real money.
            builder.Services.AddScoped<IPaymentGateway, TestPaymentGateway>();
            builder.Services.AddScoped<IPrepaidBookingService, PrepaidBookingService>();
            builder.Services.AddMemoryCache();
            // Help chat: the built-in assistant always works; Claude takes over when Anthropic:ApiKey is set.
            builder.Services.AddSingleton<IClinicDirectory, ClinicDirectory>();
            builder.Services.AddSingleton<ClaudeChatAssistant>();
            builder.Services.AddSingleton<RuleBasedChatAssistant>();
            builder.Services.AddSingleton<IChatAssistant, ChatAssistantRouter>();
            builder.Services.AddSingleton<IClinicClock, ClinicClock>();
            builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();
            builder.Services.AddHostedService<AppointmentReminderWorker>();
            builder.Services.AddHostedService<NotificationEmailWorker>();

            builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
            builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("Email"));
            builder.Services.Configure<ReminderSettings>(builder.Configuration.GetSection("Reminders"));
            builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();

            if (builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(builder.Configuration["Email:Password"]))
                builder.Services.AddScoped<IEmailSender, DevEmailSender>();
            else
                builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

            var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
                      ?? throw new InvalidOperationException("Missing 'Jwt' section in appsettings.json");

            if (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Length < 32)
                throw new InvalidOperationException(
                    "Jwt:Key is missing or shorter than 32 characters. Set it in User Secrets (development) or the Jwt__Key environment variable (production).");

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwt.Issuer,
                        ValidAudience = jwt.Audience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
                        RoleClaimType = ClaimTypes.Role,
                        ClockSkew = TimeSpan.Zero
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnTokenValidated = async context =>
                        {
                            var idClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                            if (!int.TryParse(idClaim, out var userId))
                            {
                                context.Fail("Invalid token.");
                                return;
                            }

                            var db = context.HttpContext.RequestServices.GetRequiredService<UmbrellaDbContext>();
                            var active = await db.Users.AsNoTracking().AnyAsync(u => u.Id == userId && u.IsActive);

                            if (!active) context.Fail("The account is not active.");
                        }
                    };
                });
            builder.Services.AddAuthorization();

            var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                                 ?? Array.Empty<string>();
            if (builder.Environment.IsDevelopment() && allowedOrigins.Length == 0)
                allowedOrigins = new[] { "http://localhost:4200" };

            builder.Services.AddCors(o => o.AddPolicy("Frontend", policy => policy
                .WithOrigins(allowedOrigins)
                .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .WithHeaders("Authorization", "Content-Type")));

            var globalPerMinute = builder.Configuration.GetValue<int?>("RateLimiting:GlobalPerMinute") ?? 200;
            var authPerMinute = builder.Configuration.GetValue<int?>("RateLimiting:AuthPerMinute") ?? 10;

            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = globalPerMinute,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));

                options.AddPolicy("auth", context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = authPerMinute,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));

                // The AI chat costs money per message, so it gets its own, tighter limit.
                var chatPerMinute = builder.Configuration.GetValue<int?>("RateLimiting:ChatPerMinute") ?? 12;
                options.AddPolicy("chat", context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = chatPerMinute,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        }));

                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Too many requests",
                        Detail = "Please wait a moment and try again."
                    }, cancellationToken);
                };
            });

            var app = builder.Build();

            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<UmbrellaDbContext>();
                await db.Database.MigrateAsync();

                // In Development every staff account shares one simple password (default "Umbrella123")
                // so testing is easy. Production never gets a default: set the secrets explicitly there.
                var isDev = app.Environment.IsDevelopment();
                var demoPassword = builder.Configuration["Seed:DemoStaffPassword"];
                if (isDev && string.IsNullOrWhiteSpace(demoPassword)) demoPassword = DemoStaffSeeder.DevelopmentPassword;

                var adminPassword = builder.Configuration["Seed:AdminPassword"];
                if (isDev && string.IsNullOrWhiteSpace(adminPassword)) adminPassword = demoPassword;
                if (string.IsNullOrWhiteSpace(adminPassword) || adminPassword.Length < 8)
                    app.Logger.LogWarning("Seed:AdminPassword is missing or shorter than 8 characters, so no admin account was created.");

                await DbSeeder.SeedAsync(db, adminPassword);

                // Demo doctors and receptionists; existing ones are skipped.
                if (!string.IsNullOrWhiteSpace(demoPassword) && demoPassword.Length >= 8)
                {
                    await DemoStaffSeeder.SeedAsync(db, demoPassword);

                    if (isDev)
                    {
                        var changed = await DemoStaffSeeder.UseSharedStaffPasswordAsync(db, demoPassword);
                        if (changed > 0)
                            app.Logger.LogInformation("Development: {Count} staff account(s) now use the shared demo password.", changed);
                    }
                }

                // Demo patients (password "Patient123") with past visits and 2-3 reviews per doctor.
                // Always in Development; on a server only when Seed:DemoPatients is true (a showcase site).
                if (isDev || builder.Configuration.GetValue<bool>("Seed:DemoPatients"))
                    await DemoReviewsSeeder.SeedAsync(db);

                // Pharmacy product photos for products that have none yet.
                var photos = await ProductImageSeeder.SeedAsync(db, scope.ServiceProvider.GetRequiredService<IFileStorage>(), app.Environment.ContentRootPath);
                if (photos > 0) app.Logger.LogInformation("Added photos to {Count} pharmacy product(s).", photos);
            }

            app.UseExceptionHandler();

            app.Use(async (context, next) =>
            {
                var timer = Stopwatch.StartNew();
                await next();
                timer.Stop();

                app.Logger.LogInformation(
                    "{Method} {Path} responded {Status} in {Elapsed} ms",
                    context.Request.Method,
                    context.Request.Path,
                    context.Response.StatusCode,
                    timer.ElapsedMilliseconds);
            });

            if (!app.Environment.IsDevelopment())
                app.UseHsts();

            app.Use(async (context, next) =>
            {
                var headers = context.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "no-referrer";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

                if (!context.Request.Path.StartsWithSegments("/swagger"))
                    headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

                await next();
            });

            // API documentation is public (also on the live site): https://<site>/swagger
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.DocumentTitle = "Umbrella Medical Center API";
                c.DocExpansion(DocExpansion.None);
                c.EnablePersistAuthorization();   // keep the pasted login token while trying endpoints
                c.EnableTryItOutByDefault();
                c.DisplayRequestDuration();
                c.EnableFilter();
            });

            app.UseHttpsRedirection();

            app.UseCors("Frontend");
            app.UseRateLimiter();

            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();

            app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
            app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

            await app.RunAsync();
        }
    }
}