using UmbrellaMedical.Domain.Entities;

namespace UmbrellaMedical.Api.Services
{
    public interface IJwtTokenService
    {
        string CreateToken(User user);
    }
}
