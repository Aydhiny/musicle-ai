using AiAgents.MusicAgent.Application.Interfaces;
using System.Security.Cryptography;

namespace AiAgents.MusicAgent.Application.Services
{
    public class PasswordHasherService : IPasswordHasherService
    {
        private const int SaltSize = 16;
        private const int HashSize = 32;
        private const int Iterations = 100_000;

        public (byte[] Hash, byte[] Salt) HashPassword(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(SaltSize);
            var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
            return (hash, salt);
        }

        public bool VerifyPassword(string password, byte[] expectedHash, byte[] salt)
        {
            var actualHash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
    }
}
