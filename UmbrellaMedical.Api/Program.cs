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
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "Umbrella Medical API", Version = "v1" });

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
                options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

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
            builder.Services.AddSingleton<IClinicClock, ClinicClock>();
            builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();
            builder.Services.AddHostedService<AppointmentReminderWorker>();

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

                var adminPassword = builder.Configuration["Seed:AdminPassword"];
                if (string.IsNullOrWhiteSpace(adminPassword) || adminPassword.Length < 8)
                    app.Logger.LogWarning("Seed:AdminPassword is missing or shorter than 8 characters, so no admin account was created.");

                await DbSeeder.SeedAsync(db, adminPassword);
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

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI(c => c.DocExpansion(DocExpansion.None));
            }

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