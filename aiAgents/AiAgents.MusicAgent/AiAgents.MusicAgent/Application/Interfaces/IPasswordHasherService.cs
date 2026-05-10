namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IPasswordHasherService
    {
        (byte[] Hash, byte[] Salt) HashPassword(string password);
        bool VerifyPassword(string password, byte[] expectedHash, byte[] salt);
    }
}
