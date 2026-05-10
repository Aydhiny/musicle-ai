namespace AiAgents.MusicAgent.Domain.Rules
{
    public class GenreDecision
    {
        public string Genre { get; set; } = string.Empty;
        public string Subgenre { get; set; } = string.Empty;
        public int Confidence { get; set; }
    }
}
