using AiAgents.MusicAgent.Application.Exceptions;
using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.Shared.Dtos;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AiAgents.MusicAgent.Application.Services
{
    public class UserAuthService : IUserAuthService
    {
        private readonly MusicAgentDbContext _db;
        private readonly IPasswordHasherService _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;

        public UserAuthService(
            MusicAgentDbContext db,
            IPasswordHasherService passwordHasher,
            IJwtTokenService jwtTokenService)
        {
            _db = db;
            _passwordHasher = passwordHasher;
            _jwtTokenService = jwtTokenService;
        }

        public async Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, CancellationToken ct)
        {
            var userName = (dto.UserName ?? string.Empty).Trim();
            var email = (dto.Email ?? string.Empty).Trim();
            var password = dto.Password ?? string.Empty;
            var bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();

            if (!AuthRules.IsValidUserName(userName))
            {
                throw new AppValidationException("Username must be 3-40 chars and only contain letters, numbers, '.', '_' or '-'.");
            }

            if (!AuthRules.IsValidEmail(email))
            {
                throw new AppValidationException("Email format is invalid.");
            }

            if (!AuthRules.IsValidPassword(password))
            {
                throw new AppValidationException($"Password must have at least {AuthRules.MinPasswordLength} characters.");
            }

            if (bio is not null && bio.Length > AuthRules.MaxBioLength)
            {
                throw new AppValidationException($"Bio cannot be longer than {AuthRules.MaxBioLength} characters.");
            }

            var normalizedUserName = AuthRules.NormalizeIdentityValue(userName);
            var normalizedEmail = AuthRules.NormalizeIdentityValue(email);

            var alreadyExists = await _db.AppUsers
                .AnyAsync(u => u.NormalizedUserName == normalizedUserName || u.NormalizedEmail == normalizedEmail, ct);

            if (alreadyExists)
            {
                throw new AppValidationException("Username or email is already in use.");
            }

            var (passwordHash, passwordSalt) = _passwordHasher.HashPassword(password);
            var now = DateTime.UtcNow;

            var user = new AppUser
            {
                Id = Guid.NewGuid(),
                UserName = userName,
                NormalizedUserName = normalizedUserName,
                Email = email,
                NormalizedEmail = normalizedEmail,
                PasswordHash = passwordHash,
                PasswordSalt = passwordSalt,
                Bio = bio,
                SettingsJson = SerializeSettings(new UserSettingsDto()),
                CreatedAt = now,
                UpdatedAt = now,
                IsActive = true
            };

            _db.AppUsers.Add(user);
            await _db.SaveChangesAsync(ct);

            return BuildAuthResponse(user);
        }

        public async Task<AuthResponseDto> LoginAsync(LoginRequestDto dto, CancellationToken ct)
        {
            var loginValue = (dto.Login ?? string.Empty).Trim();
            var password = dto.Password ?? string.Empty;

            if (string.IsNullOrWhiteSpace(loginValue) || string.IsNullOrWhiteSpace(password))
            {
                throw new UnauthorizedException("Invalid credentials.");
            }

            var normalized = AuthRules.NormalizeIdentityValue(loginValue);

            var user = await _db.AppUsers
                .FirstOrDefaultAsync(
                    u => u.NormalizedUserName == normalized || u.NormalizedEmail == normalized,
                    ct);

            if (user is null || !user.IsActive)
            {
                throw new UnauthorizedException("Invalid credentials.");
            }

            if (!_passwordHasher.VerifyPassword(password, user.PasswordHash, user.PasswordSalt))
            {
                throw new UnauthorizedException("Invalid credentials.");
            }

            user.LastLoginAt = DateTime.UtcNow;
            user.UpdatedAt = user.LastLoginAt.Value;
            await _db.SaveChangesAsync(ct);

            return BuildAuthResponse(user);
        }

        public async Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct)
        {
            var user = await _db.AppUsers
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

            if (user is null)
            {
                throw new NotFoundException("User not found.");
            }

            return BuildProfile(user);
        }

        public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequestDto dto, CancellationToken ct)
        {
            var user = await _db.AppUsers
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

            if (user is null)
            {
                throw new NotFoundException("User not found.");
            }

            var changed = false;

            if (!string.IsNullOrWhiteSpace(dto.UserName))
            {
                var newUserName = dto.UserName.Trim();
                if (!AuthRules.IsValidUserName(newUserName))
                {
                    throw new AppValidationException("Username must be 3-40 chars and only contain letters, numbers, '.', '_' or '-'.");
                }

                var normalizedUserName = AuthRules.NormalizeIdentityValue(newUserName);
                var exists = await _db.AppUsers
                    .AnyAsync(u => u.Id != userId && u.NormalizedUserName == normalizedUserName, ct);
                if (exists)
                {
                    throw new AppValidationException("Username is already in use.");
                }

                user.UserName = newUserName;
                user.NormalizedUserName = normalizedUserName;
                changed = true;
            }

            if (!string.IsNullOrWhiteSpace(dto.Email))
            {
                var newEmail = dto.Email.Trim();
                if (!AuthRules.IsValidEmail(newEmail))
                {
                    throw new AppValidationException("Email format is invalid.");
                }

                var normalizedEmail = AuthRules.NormalizeIdentityValue(newEmail);
                var exists = await _db.AppUsers
                    .AnyAsync(u => u.Id != userId && u.NormalizedEmail == normalizedEmail, ct);
                if (exists)
                {
                    throw new AppValidationException("Email is already in use.");
                }

                user.Email = newEmail;
                user.NormalizedEmail = normalizedEmail;
                changed = true;
            }

            if (dto.Bio != null)
            {
                var bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();
                if (bio is not null && bio.Length > AuthRules.MaxBioLength)
                {
                    throw new AppValidationException($"Bio cannot be longer than {AuthRules.MaxBioLength} characters.");
                }

                user.Bio = bio;
                changed = true;
            }

            if (changed)
            {
                user.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }

            return BuildProfile(user);
        }

        public async Task<UserProfileDto> UpdateSettingsAsync(Guid userId, UpdateUserSettingsDto dto, CancellationToken ct)
        {
            var user = await _db.AppUsers
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

            if (user is null)
            {
                throw new NotFoundException("User not found.");
            }

            var normalized = NormalizeSettings(dto.Settings ?? new UserSettingsDto());
            user.SettingsJson = SerializeSettings(normalized);
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return BuildProfile(user);
        }

        public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequestDto dto, CancellationToken ct)
        {
            var user = await _db.AppUsers
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

            if (user is null)
            {
                throw new NotFoundException("User not found.");
            }

            if (!_passwordHasher.VerifyPassword(dto.CurrentPassword ?? string.Empty, user.PasswordHash, user.PasswordSalt))
            {
                throw new UnauthorizedException("Current password is incorrect.");
            }

            var newPassword = dto.NewPassword ?? string.Empty;
            if (!AuthRules.IsValidPassword(newPassword))
            {
                throw new AppValidationException($"Password must have at least {AuthRules.MinPasswordLength} characters.");
            }

            var (hash, salt) = _passwordHasher.HashPassword(newPassword);
            user.PasswordHash = hash;
            user.PasswordSalt = salt;
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        private AuthResponseDto BuildAuthResponse(AppUser user)
        {
            var token = _jwtTokenService.GenerateToken(user);

            return new AuthResponseDto
            {
                AccessToken = token.AccessToken,
                ExpiresAtUtc = token.ExpiresAtUtc,
                User = BuildProfile(user)
            };
        }

        private UserProfileDto BuildProfile(AppUser user)
        {
            return new UserProfileDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                Bio = user.Bio,
                Settings = DeserializeSettings(user.SettingsJson),
                CreatedAt = user.CreatedAt,
                LastLoginAt = user.LastLoginAt
            };
        }

        private static UserSettingsDto NormalizeSettings(UserSettingsDto settings)
        {
            var theme = (settings.Theme ?? "dark").Trim().ToLowerInvariant();
            var normalizedTheme = theme == "light" ? "light" : "dark";

            return new UserSettingsDto
            {
                PublicProfile = settings.PublicProfile,
                EmailNotifications = settings.EmailNotifications,
                ShowActivityStatus = settings.ShowActivityStatus,
                Theme = normalizedTheme
            };
        }

        private static string SerializeSettings(UserSettingsDto settings)
            => JsonSerializer.Serialize(settings ?? new UserSettingsDto());

        private static UserSettingsDto DeserializeSettings(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new UserSettingsDto();
            }

            try
            {
                return JsonSerializer.Deserialize<UserSettingsDto>(json) ?? new UserSettingsDto();
            }
            catch
            {
                return new UserSettingsDto();
            }
        }
    }
}
