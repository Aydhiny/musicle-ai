namespace AiAgents.MusicAgent.Domain.Rules
{
    public static class GenreClassificationRules
    {
        public const int MinConfidenceThreshold = 60;
        public const int HighConfidenceThreshold = 80;

        public static bool IsHighConfidence(int confidence)
            => confidence >= HighConfidenceThreshold;

        public static bool IsValidConfidence(int confidence)
            => confidence >= MinConfidenceThreshold;
    }
}
