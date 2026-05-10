using System.ComponentModel.DataAnnotations;

namespace AiAgents.Shared.Dtos
{
    public sealed class RegisterRequestDto
    {
        [Required]
        [StringLength(40, MinimumLength = 3)]
        public string UserName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Bio { get; set; }
    }

    public sealed class LoginRequestDto
    {
        [Required]
        [StringLength(255)]
        public string Login { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public sealed class UpdateProfileRequestDto
    {
        [StringLength(40, MinimumLength = 3)]
        public string? UserName { get; set; }

        [EmailAddress]
        [StringLength(255)]
        public string? Email { get; set; }

        [StringLength(500)]
        public string? Bio { get; set; }
    }

    public sealed class ChangePasswordRequestDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public sealed class UserSettingsDto
    {
        public bool PublicProfile { get; set; } = true;
        public bool EmailNotifications { get; set; } = true;
        public bool ShowActivityStatus { get; set; } = true;
        [StringLength(20)]
        public string Theme { get; set; } = "dark";
    }

    public sealed class UpdateUserSettingsDto
    {
        [Required]
        public UserSettingsDto Settings { get; set; } = new();
    }

    public sealed class UserProfileDto
    {
        public Guid Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Bio { get; set; }
        public UserSettingsDto Settings { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
    }

    public sealed class AuthResponseDto
    {
        public string AccessToken { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
        public UserProfileDto User { get; set; } = new();
    }
}
