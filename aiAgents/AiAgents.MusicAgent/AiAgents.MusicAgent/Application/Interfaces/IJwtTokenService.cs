using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IJwtTokenService
    {
        JwtTokenResult GenerateToken(AppUser user);
    }

    public sealed class JwtTokenResult
    {
        public string AccessToken { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
    }
}
