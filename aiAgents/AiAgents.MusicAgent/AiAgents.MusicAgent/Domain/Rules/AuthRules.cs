using System.Text.RegularExpressions;

namespace AiAgents.MusicAgent.Domain.Rules
{
    public static class AuthRules
    {
        public const int MinPasswordLength = 8;
        public const int MaxUserNameLength = 40;
        public const int MinUserNameLength = 3;
        public const int MaxEmailLength = 255;
        public const int MaxBioLength = 500;

        private static readonly Regex UserNameRegex = new("^[a-zA-Z0-9._-]+$", RegexOptions.Compiled);

        public static bool IsValidUserName(string userName)
            => !string.IsNullOrWhiteSpace(userName)
               && userName.Length >= MinUserNameLength
               && userName.Length <= MaxUserNameLength
               && UserNameRegex.IsMatch(userName);

        public static bool IsValidEmail(string email)
            => !string.IsNullOrWhiteSpace(email)
               && email.Length <= MaxEmailLength
               && email.Contains('@');

        public static bool IsValidPassword(string password)
            => !string.IsNullOrWhiteSpace(password)
               && password.Length >= MinPasswordLength;

        public static string NormalizeIdentityValue(string value)
            => value.Trim().ToUpperInvariant();
    }
}
