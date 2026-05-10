namespace AiAgents.MusicAgent.Domain.Rules
{
    public static class SocialRules
    {
        public const int MaxPostLength = 2000;
        public const int MaxPostTitleLength = 120;
        public const int MaxCommentLength = 1000;
        public const int MaxMediaItems = 3;

        public static readonly IReadOnlyList<string> AllowedReactions = new List<string>
        {
            "like",
            "fire",
            "spark",
            "clap",
            "insight",
            "wow"
        };

        public static string NormalizePostContent(string content)
            => (content ?? string.Empty).Trim();

        public static string NormalizePostTitle(string? title)
            => (title ?? string.Empty).Trim();

        public static bool IsValidPostContent(string content)
            => !string.IsNullOrWhiteSpace(content) && content.Length <= MaxPostLength;

        public static bool IsValidPostTitle(string? title)
            => string.IsNullOrWhiteSpace(title) || NormalizePostTitle(title).Length <= MaxPostTitleLength;

        public static string NormalizeCommentContent(string content)
            => (content ?? string.Empty).Trim();

        public static bool IsValidCommentContent(string content)
            => !string.IsNullOrWhiteSpace(content) && content.Length <= MaxCommentLength;

        public static string NormalizeContentFormat(string? format)
        {
            var normalized = (format ?? "markdown").Trim().ToLowerInvariant();
            return normalized == "plain" ? "plain" : "markdown";
        }

        public static string NormalizeReaction(string? reaction)
            => (reaction ?? string.Empty).Trim().ToLowerInvariant();

        public static bool IsAllowedReaction(string? reaction)
        {
            var normalized = NormalizeReaction(reaction);
            return AllowedReactions.Contains(normalized);
        }
    }
}
