using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;
using AiAgents.MusicAgent.ML;

namespace AiAgents.MusicAgent.Application.Services
{

    /// <summary>
    /// Genre classification service using ML.NET trained model
    /// Falls back to rule-based classification if ML model not available
    /// </summary>
    public class GenreClassificationService : IGenreClassificationService
    {
        private readonly IGenreClassifier _mlClassifier;
        private readonly ILogger<GenreClassificationService> _logger;
        private readonly Dictionary<string, GenreProfile> _profiles;

        public GenreClassificationService(
            IGenreClassifier mlClassifier,
            ILogger<GenreClassificationService> logger)
        {
            _mlClassifier = mlClassifier;
            _logger = logger;

            // Rule-based profiles as fallback
            _profiles = new Dictionary<string, GenreProfile>
            {
                ["Electronic/Dance"] = new() { TempoMin = 115, TempoMax = 140, Energy = 0.7, Danceability = 0.7 },
                ["Hip-Hop/Rap"] = new() { TempoMin = 75, TempoMax = 110, Energy = 0.6, Speechiness = 0.25 },
                ["Pop"] = new() { TempoMin = 100, TempoMax = 130, Energy = 0.65, Valence = 0.55 },
                ["Rock"] = new() { TempoMin = 110, TempoMax = 140, Energy = 0.75, Acousticness = 0.2 },
                ["Acoustic/Folk"] = new() { TempoMin = 70, TempoMax = 110, Energy = 0.4, Acousticness = 0.7 },
                ["R&B/Soul"] = new() { TempoMin = 80, TempoMax = 120, Energy = 0.5, Danceability = 0.6 },
                ["Indie/Alternative"] = new() { TempoMin = 90, TempoMax = 130, Energy = 0.55, Acousticness = 0.45 },
                ["Classical/Ambient"] = new() { TempoMin = 60, TempoMax = 100, Energy = 0.3, Acousticness = 0.8 },
            };
        }

        public async Task<GenreDecision> ClassifyAsync(Characteristics chars, CancellationToken ct)
        {
            try
            {
                // Try ML.NET prediction first
                _logger.LogDebug("Attempting ML.NET genre prediction");
                var mlPrediction = await _mlClassifier.PredictAsync(chars, ct);

                if (mlPrediction != null && !string.IsNullOrEmpty(mlPrediction.Genre))
                {
                    _logger.LogInformation("ML prediction: {Genre} ({Confidence}%)",
                        mlPrediction.Genre, mlPrediction.Confidence);

                    var subgenre = DetermineSubgenre(mlPrediction.Genre, chars);

                    return new GenreDecision
                    {
                        Genre = mlPrediction.Genre,
                        Subgenre = subgenre,
                        Confidence = mlPrediction.Confidence
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ML prediction failed, falling back to rule-based classification");
            }

            // Fallback to rule-based classification
            return await ClassifyRuleBasedAsync(chars, ct);
        }

        private async Task<GenreDecision> ClassifyRuleBasedAsync(Characteristics chars, CancellationToken ct)
        {
            _logger.LogDebug("Using rule-based genre classification");

            await Task.CompletedTask; // Make it async

            var scores = new Dictionary<string, int>();

            foreach (var (genre, profile) in _profiles)
            {
                int score = 0;

                if (chars.Tempo >= profile.TempoMin && chars.Tempo <= profile.TempoMax)
                    score += 25;

                if (Math.Abs(chars.Energy - profile.Energy) < 0.2)
                    score += 20;

                if (profile.Danceability > 0 && Math.Abs(chars.Danceability - profile.Danceability) < 0.2)
                    score += 15;

                if (profile.Acousticness > 0 && Math.Abs(chars.Acousticness - profile.Acousticness) < 0.3)
                    score += 15;

                if (profile.Speechiness > 0 && Math.Abs(chars.Speechiness - profile.Speechiness) < 0.2)
                    score += 15;

                if (profile.Valence > 0 && Math.Abs(chars.Valence - profile.Valence) < 0.2)
                    score += 10;

                scores[genre] = score;
            }

            var bestGenre = scores.OrderByDescending(x => x.Value).First();
            var confidence = Math.Min(95, Math.Max(60, bestGenre.Value));
            var subgenre = DetermineSubgenre(bestGenre.Key, chars);

            _logger.LogInformation("Rule-based prediction: {Genre} ({Confidence}%)",
                bestGenre.Key, confidence);

            return new GenreDecision
            {
                Genre = bestGenre.Key,
                Subgenre = subgenre,
                Confidence = confidence
            };
        }

        private string DetermineSubgenre(string genre, Characteristics chars)
        {
            return genre switch
            {
                "Electronic/Dance" when chars.Tempo > 130 => "Techno/Trance",
                "Electronic/Dance" when chars.Energy > 0.8 => "Big Room/Festival",
                "Electronic/Dance" when chars.Danceability > 0.75 => "House",
                "Electronic/Dance" => "Electronic Pop",

                "Hip-Hop/Rap" when chars.Speechiness > 0.4 => "Rap",
                "Hip-Hop/Rap" when chars.Energy < 0.5 => "Lo-fi Hip-Hop",
                "Hip-Hop/Rap" => "Contemporary Hip-Hop",

                "Pop" when chars.Danceability > 0.7 => "Dance Pop",
                "Pop" when chars.Acousticness > 0.4 => "Acoustic Pop",
                "Pop" when chars.Energy > 0.7 => "Power Pop",
                "Pop" => "Contemporary Pop",

                "Rock" when chars.Energy > 0.8 => "Hard Rock",
                "Rock" when chars.Acousticness > 0.3 => "Folk Rock",
                "Rock" => "Alternative Rock",

                "Acoustic/Folk" when chars.Instrumentalness > 0.6 => "Instrumental Folk",
                "Acoustic/Folk" => "Singer-Songwriter",

                "R&B/Soul" when chars.Tempo < 90 => "Neo-Soul",
                "R&B/Soul" => "Contemporary R&B",

                "Indie/Alternative" when chars.Acousticness > 0.6 => "Indie Folk",
                "Indie/Alternative" => "Indie Rock",

                "Classical/Ambient" when chars.Instrumentalness > 0.8 => "Classical",
                "Classical/Ambient" => "Ambient",

                _ => $"Contemporary {genre}"
            };
        }

        private class GenreProfile
        {
            public double TempoMin { get; set; }
            public double TempoMax { get; set; }
            public double Energy { get; set; }
            public double Danceability { get; set; }
            public double Valence { get; set; }
            public double Acousticness { get; set; }
            public double Speechiness { get; set; }
        }
    }
}
