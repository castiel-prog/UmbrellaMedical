# Umbrella Medical Center

A clinic management system: patient registration, doctors and schedules, online appointment booking with free-slot checking, medical records, e-prescriptions, document uploads, billing with insurance, reminders and reports.

The name and logo are inspired by Resident Evil's Umbrella Corporation. The system itself is an ordinary, professional clinic application.

## Technology
- ASP.NET Core Web API on .NET 10, C#
- Entity Framework Core 10 with SQL Server
- JWT authentication, BCrypt password hashing, role-based authorization
- Swagger (Swashbuckle) for documentation and testing
- xUnit tests
- Planned: Angular front-end, Docker, GitHub Actions, DigitalOcean deployment

## Solution structure
```
UmbrellaMedical.sln
  UmbrellaMedical.Domain          entities and enums, no dependencies
  UmbrellaMedical.Infrastructure  DbContext, migrations, seed data
  UmbrellaMedical.Api             controllers, DTOs, services, Program.cs
  UmbrellaMedical.Tests           unit tests
database/schema.sql               full SQL schema generated from the migrations
```
The dependency direction is Api -> Infrastructure -> Domain.

## Roles
| Role | What they can do |
|---|---|
| Guest | See doctors, ratings, specializations and services |
| Patient | Register, book, move or cancel their own visits (not within 2 hours of the start), see their own records, prescriptions, files, invoices and notifications, review a doctor after a completed visit |
| Doctor | Manage their own working hours, see their own appointments, write records and prescriptions for patients they treat, upload files, request time off |
| Receptionist | Register patients, book and change appointments, manage patient insurance, create invoices and record payments. No access to medical records |
| Admin | Everything above plus staff and clinic setup, time-off approval, review moderation, refunds and reports |

## Main features
- Patients: profile, allergies, duplicate detection by personal number
- Appointments: free slots from working hours minus bookings and approved leave, conflict-safe booking, reschedule, cancel, complete, no-show
- Medical records: diagnoses from an ICD-10 list, vital signs, dentist tooth chart, e-prescriptions with an allergy warning, PDF/PNG/JPG uploads
- Time off: doctors request, admins approve or decline (a decline needs a reason)
- Reviews: one per completed visit, 1 to 5 stars, average shown in half stars, admin moderation
- Billing: invoices from completed visits, insurance share, partial payments, receipts, refunds
- Reminders: a background job emails patients 24 hours before a visit, plus an in-app notification inbox
- Admin: departments, rooms, services, user activation, staff schedule overview, reports with CSV export
- Audit log of access to and changes of sensitive data

## Security
- Passwords are hashed with BCrypt; verification codes are stored only as keyed hashes, expire after 10 minutes, work once and lock after 5 wrong tries
- Short-lived JWTs; deactivated accounts are rejected on the next request
- Ownership checks on every endpoint that takes an id
- Rate limiting, security headers, CORS limited to the front-end origin, Swagger only in Development
- Uploaded files are checked by extension, size and content signature and are never served as static files
- Secrets come from User Secrets or environment variables, never from the repository

## Run it locally
1. Install the .NET 10 SDK and SQL Server LocalDB (included with Visual Studio).
2. Set the secrets. In Visual Studio, right-click UmbrellaMedical.Api and choose Manage User Secrets, then add:
   ```json
   {
     "Jwt": { "Key": "a random string of at least 32 characters" },
     "Seed": { "AdminPassword": "a strong password" }
   }
   ```
3. Check the connection string `ConnectionStrings:DefaultConnection` in `appsettings.json` (override it in User Secrets if your LocalDB instance has another name).
4. Create the database:
   ```
   dotnet tool restore
   dotnet ef database update --project UmbrellaMedical.Infrastructure --startup-project UmbrellaMedical.Api
   ```
5. Run the API (F5 or `dotnet run --project UmbrellaMedical.Api`) and open `/swagger`.

The admin account is `admin@umbrella.local` with the password from `Seed:AdminPassword`. In Development, emails are printed to the console instead of being sent.

### Demo staff
In Development the API creates demo staff on start: two doctors per specialization (each offering every service of their department, working Mon–Fri 09:00–13:00 and 14:00–18:00, some also Saturday 10:00–14:00) and three receptionists. Existing people are skipped.

**All staff accounts (admin, doctors, receptionists with an `@umbrella.local` email) share the password `Umbrella123` in Development** — set `Seed:DemoStaffPassword` to use a different one. Logins use `firstname.lastname@umbrella.local` plus the person's first and last name, for example `nino.beridze@umbrella.local` / Nino / Beridze / Umbrella123. The admin is `admin@umbrella.local` (any name). Outside Development nothing is defaulted: demo staff are only created when `Seed:DemoStaffPassword` is set.

### Online payment (test mode)
Patients pay for a visit by card when they book online (their share after insurance). The visit, a paid invoice and the payment are created together; cancelling it (or the clinic cancelling it) refunds the card automatically. Visits booked by staff are paid at the desk as before.

Payments currently go through `TestPaymentGateway`, which moves no money. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds; any future expiry and any CVC. To take real payments, implement `IPaymentGateway` for your provider (Stripe, Bank of Georgia, TBC, ...) and register it in `Program.cs` instead.

### Help chat
The "Ask us" chat answers questions about doctors, services, prices, booking, payments and using the site. It never gives diagnoses or medicine advice, points emergencies to 112, and only uses public clinic facts from the database (never patient data).

- **Without any key (default):** the built-in assistant (`RuleBasedChatAssistant`) recognises common questions by keywords, maps everyday symptoms to the right specialty, finds doctors by name and services by name, and answers from the live database. Free, instant, works offline. Labelled "AUTO".
- **With a Claude API key (optional):** the chat switches to Claude (`claude-opus-5-5`) for free-form questions in any language, and falls back to the built-in assistant if a request fails. Labelled "AI". Add the key to User Secrets:
  ```json
  { "Anthropic": { "ApiKey": "sk-ant-..." } }
  ```

To teach the built-in assistant new words, edit the keyword lists at the top of `UmbrellaMedical.Api/Services/RuleBasedChatAssistant.cs`.

## Configuration
| Setting | Purpose |
|---|---|
| `ConnectionStrings:DefaultConnection` | SQL Server connection |
| `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpiryMinutes` | Token signing (the key is a secret) |
| `Seed:AdminPassword` | Password of the first admin account |
| `Seed:DemoStaffPassword` | Shared password for demo staff. Defaults to `Umbrella123` in Development only; leave unset in production unless you want demo staff there |
| `Email:Host`, `Email:Port`, `Email:Username`, `Email:Password`, `Email:FromAddress` | SMTP (for Gmail use an app password) |
| `Clinic:TimeZone` | Clinic time zone, default `Asia/Tbilisi` |
| `Reminders:Enabled`, `Reminders:HoursBefore`, `Reminders:CheckIntervalMinutes` | Appointment reminders |
| `Cors:AllowedOrigins` | Origins allowed to call the API from a browser |
| `Anthropic:ApiKey` | Optional. Claude API key for the AI help chat (or set `ANTHROPIC_API_KEY`). Without it the chat shows "not available". A secret: keep it in User Secrets or environment variables |
| `RateLimiting:ChatPerMinute` | AI chat messages allowed per IP per minute (default 12) |
| `RateLimiting:GlobalPerMinute`, `RateLimiting:AuthPerMinute` | Rate limits per IP |
| `Storage:RootPath` | Folder for uploaded files, default `App_Data/uploads` |

In production, set these as environment variables with a double underscore, for example `Jwt__Key`.

## Tests
```
dotnet test
```
The tests cover free-slot calculation, billing maths, verification codes and the reminder job.

## Database
`database/schema.sql` is generated with:
```
dotnet ef migrations script --idempotent --project UmbrellaMedical.Infrastructure --startup-project UmbrellaMedical.Api --output database/schema.sql
```
Starter data (roles, specializations, departments, services, diagnoses, medications, allergies, insurers) is added by the seeder at startup.

## Health checks
- `GET /health/live`: the service is running
- `GET /health/ready`: the service can reach the database

## Status
The back-end is complete. The Angular front-end, Docker setup, CI and DigitalOcean deployment are next.
