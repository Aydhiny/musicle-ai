namespace AiAgents.MusicAgent.Application.Options
{
    public sealed class JwtSettings
    {
        public const string SectionName = "Jwt";

        public string SigningKey { get; set; } = string.Empty;
        public string Issuer { get; set; } = "AiAgents.MusicAgent";
        public string Audience { get; set; } = "AiAgents.MusicAgent.Client";
        public int ExpiryMinutes { get; set; } = 120;
    }
}
