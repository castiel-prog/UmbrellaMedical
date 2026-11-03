using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using UmbrellaMedical.Api.DTOs.Auth;
using UmbrellaMedical.Api.Services;
using UmbrellaMedical.Domain.Entities;
using UmbrellaMedical.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;

namespace UmbrellaMedical.Api.Controllers
{
  
    [ApiController]
        [Route("api/[controller]")]
           public class AuthController : ControllerBase
        {
            private readonly UmbrellaDbContext _db;
            private readonly IJwtTokenService _tokenService;

            public AuthController(UmbrellaDbContext db, IJwtTokenService tokenService)
            {
                _db = db;
                _tokenService = tokenService;
            }

           
            [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
            {
                var email = request.Email.Trim().ToLowerInvariant();

                if (await _db.Users.AnyAsync(u => u.Email == email))
                    return Conflict(new { message = "This email is already registered." });

                if (await _db.Patients.AnyAsync(p => p.PersonalNumber == request.PersonalNumber))
                    return Conflict(new { message = "A patient with this personal number already exists." });

                var patientRole = await _db.Roles.FirstAsync(r => r.Name == "Patient");

                var user = new User
                {
                    Email = email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                    RoleId = patientRole.Id
                };

                var patient = new Patient
                {
                    FirstName = request.FirstName.Trim(),
                    LastName = request.LastName.Trim(),
                    PersonalNumber = request.PersonalNumber.Trim(),
                    DateOfBirth = request.DateOfBirth,
                    Gender = request.Gender,
                    Phone = request.Phone,
                    Email = email,
                    User = user
                };

                _db.Patients.Add(patient);   
                await _db.SaveChangesAsync();

                user.Role = patientRole;
                return Ok(BuildResponse(user));
            }

            [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
            {
                var email = request.Email.Trim().ToLowerInvariant();

                var user = await _db.Users
                    .Include(u => u.Role)
                    .FirstOrDefaultAsync(u => u.Email == email);

                if (user is null
                    || !user.IsActive
                    || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)
                    || !await NamesMatchAsync(user, request.FirstName, request.LastName))
                {
                    return Unauthorized(new { message = "Invalid login details." });
                }

                return Ok(BuildResponse(user));
            }

            
            [Authorize]
            [HttpGet("me")]
            public IActionResult Me()
            {
                return Ok(new
                {
                    id = User.FindFirstValue(ClaimTypes.NameIdentifier),
                    email = User.FindFirstValue(ClaimTypes.Email),
                    role = User.FindFirstValue(ClaimTypes.Role)
                });
            }


            private async Task<bool> NamesMatchAsync(User user, string firstName, string lastName)
            {
                var first = firstName.Trim().ToLower();
                var last = lastName.Trim().ToLower();

                return user.Role.Name switch
                {
                    "Patient" => await _db.Patients.AnyAsync(p =>
                        p.UserId == user.Id && p.FirstName.ToLower() == first && p.LastName.ToLower() == last),
                    "Doctor" => await _db.Doctors.AnyAsync(d =>
                        d.UserId == user.Id && d.FirstName.ToLower() == first && d.LastName.ToLower() == last),
                    "Receptionist" => await _db.Receptionists.AnyAsync(r =>
                        r.UserId == user.Id && r.FirstName.ToLower() == first && r.LastName.ToLower() == last),
                    _ => true 
                };
            }

            private AuthResponse BuildResponse(User user) => new()
            {
                Token = _tokenService.CreateToken(user),
                Email = user.Email,
                Role = user.Role.Name
            };
        }
    }
