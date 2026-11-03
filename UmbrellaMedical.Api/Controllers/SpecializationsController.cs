using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UmbrellaMedical.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
namespace UmbrellaMedical.Api.Controllers
{

    [ApiController]
    [Route("api/[controller]")]
    public class SpecializationsController : ControllerBase
    {
        private readonly UmbrellaDbContext _db;

        public SpecializationsController(UmbrellaDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            var items = await _db.Specializations
                .AsNoTracking()
                .OrderBy(s => s.Name)
                .Select(s => new { s.Id, s.Name, s.Description })
                .ToListAsync();

            return Ok(items);
        }
    }
}