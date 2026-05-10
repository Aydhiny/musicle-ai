using AiAgents.Shared.Dtos;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IUserAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, CancellationToken ct);
        Task<AuthResponseDto> LoginAsync(LoginRequestDto dto, CancellationToken ct);
        Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct);
        Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequestDto dto, CancellationToken ct);
        Task<UserProfileDto> UpdateSettingsAsync(Guid userId, UpdateUserSettingsDto dto, CancellationToken ct);
        Task ChangePasswordAsync(Guid userId, ChangePasswordRequestDto dto, CancellationToken ct);
    }
}
