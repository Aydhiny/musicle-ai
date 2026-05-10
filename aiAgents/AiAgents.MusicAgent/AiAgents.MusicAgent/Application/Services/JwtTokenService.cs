using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Application.Options;
using AiAgents.MusicAgent.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AiAgents.MusicAgent.Application.Services
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly JwtSettings _settings;
        private readonly JwtSecurityTokenHandler _handler = new();

        public JwtTokenService(IOptions<JwtSettings> options)
        {
            _settings = options.Value;
        }

        public JwtTokenResult GenerateToken(AppUser user)
        {
            if (string.IsNullOrWhiteSpace(_settings.SigningKey))
            {
                throw new InvalidOperationException("JWT signing key is missing.");
            }

            var now = DateTime.UtcNow;
            var expiresAt = now.AddMinutes(_settings.ExpiryMinutes <= 0 ? 120 : _settings.ExpiryMinutes);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.UserName),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SigningKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                notBefore: now,
                expires: expiresAt,
                signingCredentials: credentials);

            return new JwtTokenResult
            {
                AccessToken = _handler.WriteToken(token),
                ExpiresAtUtc = expiresAt
            };
        }
    }
}
