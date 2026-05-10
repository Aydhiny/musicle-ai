using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Rules;
using System;
using System.Collections.Generic;
using System.Linq;

namespace AiAgents.MusicAgent.Application.Services
{

    public class MusicScoringService : IMusicScoringService
    {
        private readonly ILogger<MusicScoringService> _logger;
        private readonly ISpotifyDatasetLoader _datasetLoader;

        public MusicScoringService(
            ILogger<MusicScoringService> logger,
            ISpotifyDatasetLoader datasetLoader)
        {
            _logger = logger;
            _datasetLoader = datasetLoader;
        }

        public MusicScores CalculateScores(Characteristics characteristics, string genre, int confidence)
        {
            _logger.LogInformation("Calculating scores for genre: {Genre}", genre);

            var scores = new MusicScores();

            // Calculate individual scores
            scores.CommercialScore = CalculateCommercialScore(characteristics, genre);
            scores.ProductionScore = CalculateProductionScore(characteristics);
            scores.ViralPotential = CalculateViralPotential(characteristics, genre);

            // Generate strengths and improvements
            scores.Strengths = IdentifyStrengths(characteristics, genre, scores);
            scores.Improvements = SuggestImprovements(characteristics, genre, scores);

            _logger.LogInformation("Scores calculated - Commercial: {Commercial}, Production: {Production}, Viral: {Viral}",
                scores.CommercialScore, scores.ProductionScore, scores.ViralPotential);

            return scores;
        }

        /// <summary>
        /// Calculate commercial potential (1-10) based on genre benchmarks
        /// </summary>
        private int CalculateCommercialScore(Characteristics characteristics, string genre)
        {
            var score = 5.0; // Base score

            // Compare against successful tracks in the dataset
            var dataset = _datasetLoader.GetCachedDataset();
            var popularTracks = dataset.Where(t => t.Popularity >= 70).ToList();

            if (popularTracks.Any())
            {
                var avgDanceability = popularTracks.Average(t => t.Danceability);
                var avgEnergy = popularTracks.Average(t => t.Energy);
                var avgValence = popularTracks.Average(t => t.Valence);
                var avgTempo = popularTracks.Average(t => t.Tempo);

                // Compare to successful tracks
                var danceabilityDiff = 1.0 - Math.Abs(characteristics.Danceability - avgDanceability);
                var energyDiff = 1.0 - Math.Abs(characteristics.Energy - avgEnergy);
                var valenceDiff = 1.0 - Math.Abs(characteristics.Valence - avgValence);
                var tempoDiff = 1.0 - Math.Min(1.0, Math.Abs(characteristics.Tempo - avgTempo) / 50.0);

                var similarity = (danceabilityDiff + energyDiff + valenceDiff + tempoDiff) / 4.0;
                score = 5.0 + (similarity * 5.0); // Scale to 5-10 range
            }

            // Genre-specific adjustments
            score += GetGenreCommercialBonus(characteristics, genre);

            // Clamp to 1-10
            return Math.Max(1, Math.Min(10, (int)Math.Round(score)));
        }

        private double GetGenreCommercialBonus(Characteristics characteristics, string genre)
        {
            return genre.ToLower() switch
            {
                // Pop thrives on high danceability and energy
                "pop" when characteristics.Danceability > 0.7 && characteristics.Energy > 0.6 => 1.5,
                "pop" when characteristics.Danceability < 0.5 || characteristics.Energy < 0.4 => -1.0,

                // Electronic/Dance needs high energy and danceability
                "electronic/dance" when characteristics.Energy > 0.7 && characteristics.Danceability > 0.7 => 2.0,
                "electronic/dance" when characteristics.Tempo < 100 => -1.5,

                // Hip-Hop needs good speechiness and moderate tempo
                "hip-hop/rap" when characteristics.Speechiness > 0.2 && characteristics.Tempo >= 80 && characteristics.Tempo <= 120 => 1.5,
                "hip-hop/rap" when characteristics.Speechiness < 0.1 => -1.0,

                // Acoustic/Folk benefits from high acousticness
                "acoustic/folk" when characteristics.Acousticness > 0.7 => 1.0,
                "acoustic/folk" when characteristics.Energy > 0.7 => -0.5,

                // R&B needs smooth energy and good danceability
                "r&b/soul" when characteristics.Energy >= 0.4 && characteristics.Energy <= 0.7 && characteristics.Danceability > 0.6 => 1.5,

                _ => 0
            };
        }

        /// <summary>
        /// Calculate production quality (1-10) based on technical metrics
        /// </summary>
        private int CalculateProductionScore(Characteristics characteristics)
        {
            var score = 5.0;

            // Loudness score (well-mastered tracks are typically -8 to -4 dB)
            var targetLoudness = -6.0;
            var loudnessDiff = Math.Abs(characteristics.Loudness - targetLoudness);
            var loudnessScore = Math.Max(0, 1.0 - (loudnessDiff / 10.0));
            score += loudnessScore * 2.0;

            // Spectral balance (2000-2500 Hz is a good center)
            var spectralScore = 1.0 - Math.Min(1.0, Math.Abs(characteristics.SpectralCentroid - 2250) / 2000.0);
            score += spectralScore * 2.0;

            // Energy consistency (moderate energy is often well-produced)
            if (characteristics.Energy >= 0.4 && characteristics.Energy <= 0.8)
                score += 1.0;

            // Penalize extremes that might indicate poor mixing
            if (characteristics.Loudness > -2 || characteristics.Loudness < -15)
                score -= 1.5;

            if (characteristics.Energy > 0.95 || characteristics.Energy < 0.05)
                score -= 1.0;

            return Math.Max(1, Math.Min(10, (int)Math.Round(score)));
        }

        /// <summary>
        /// Calculate viral potential (1-10) based on social media trends
        /// </summary>
        private int CalculateViralPotential(Characteristics characteristics, string genre)
        {
            var score = 5.0;

            // Viral tracks tend to have:
            // 1. High energy
            if (characteristics.Energy > 0.7)
                score += 1.5;
            else if (characteristics.Energy < 0.4)
                score -= 1.0;

            // 2. High danceability (TikTok-friendly)
            if (characteristics.Danceability > 0.7)
                score += 2.0;
            else if (characteristics.Danceability < 0.5)
                score -= 1.0;

            // 3. Catchy tempo (110-130 BPM is ideal for dance trends)
            if (characteristics.Tempo >= 110 && characteristics.Tempo <= 130)
                score += 1.5;
            else if (characteristics.Tempo < 90 || characteristics.Tempo > 150)
                score -= 0.5;

            // 4. Positive valence (happy songs perform well)
            if (characteristics.Valence > 0.6)
                score += 1.0;
            else if (characteristics.Valence < 0.3)
                score -= 0.5;

            // Genre bonuses
            var genreBonus = genre.ToLower() switch
            {
                "electronic/dance" => 1.5,
                "pop" => 1.0,
                "hip-hop/rap" => 1.0,
                "r&b/soul" => 0.5,
                _ => 0
            };
            score += genreBonus;

            return Math.Max(1, Math.Min(10, (int)Math.Round(score)));
        }

        /// <summary>
        /// Identify track strengths based on characteristics
        /// </summary>
        private List<string> IdentifyStrengths(Characteristics characteristics, string genre, MusicScores scores)
        {
            var strengths = new List<string>();

            // High energy
            if (characteristics.Energy > 0.75)
                strengths.Add($"Exceptional energy level ({characteristics.Energy:P0}) creates an engaging, dynamic listening experience");

            // High danceability
            if (characteristics.Danceability > 0.75)
                strengths.Add($"Outstanding danceability ({characteristics.Danceability:P0}) makes this track perfect for clubs and social media dance trends");

            // Good tempo
            if (characteristics.Tempo >= 115 && characteristics.Tempo <= 130)
                strengths.Add($"Optimal tempo ({characteristics.Tempo:F0} BPM) for maximum danceability and commercial appeal");

            // High valence
            if (characteristics.Valence > 0.7)
                strengths.Add($"Strong positive energy ({characteristics.Valence:P0}) creates an uplifting, feel-good vibe");

            // Well-balanced production
            if (scores.ProductionScore >= 8)
                strengths.Add("Professional production quality with excellent mixing and mastering");

            // High acousticness (if applicable)
            if (characteristics.Acousticness > 0.7)
                strengths.Add($"Rich acoustic character ({characteristics.Acousticness:P0}) provides authentic, organic sound");

            // Genre-specific strengths
            switch (genre.ToLower())
            {
                case "electronic/dance" when characteristics.Energy > 0.7:
                    strengths.Add("Perfect energy profile for electronic dance music - club-ready");
                    break;
                case "hip-hop/rap" when characteristics.Speechiness > 0.2:
                    strengths.Add($"Strong vocal presence ({characteristics.Speechiness:P0}) typical of successful hip-hop tracks");
                    break;
                case "pop" when scores.CommercialScore >= 7:
                    strengths.Add("Mainstream appeal with radio-friendly characteristics");
                    break;
            }

            // Ensure at least 2 strengths
            if (strengths.Count == 0)
            {
                strengths.Add("Unique sonic characteristics that stand out from typical productions");
                strengths.Add($"Solid {genre} foundation with genre-appropriate elements");
            }
            else if (strengths.Count == 1)
            {
                strengths.Add($"Well-executed {genre} style with authentic genre characteristics");
            }

            return strengths.Take(4).ToList();
        }

        /// <summary>
        /// Suggest improvements based on weaknesses
        /// </summary>
        private List<string> SuggestImprovements(Characteristics characteristics, string genre, MusicScores scores)
        {
            var improvements = new List<string>();

            // Low energy
            if (characteristics.Energy < 0.4 && genre.ToLower() != "acoustic/folk" && genre.ToLower() != "classical/ambient")
                improvements.Add($"Consider boosting energy levels (currently {characteristics.Energy:P0}) to increase engagement and danceability");

            // Low danceability
            if (characteristics.Danceability < 0.5 && !genre.ToLower().Contains("ambient") && !genre.ToLower().Contains("classical"))
                improvements.Add($"Enhance rhythmic elements to improve danceability (currently {characteristics.Danceability:P0}) - add groove or syncopation");

            // Tempo issues
            if (characteristics.Tempo < 90 && !genre.ToLower().Contains("ambient"))
                improvements.Add($"Current tempo ({characteristics.Tempo:F0} BPM) is quite slow - consider increasing to 100-120 BPM for broader appeal");
            else if (characteristics.Tempo > 160 && genre.ToLower() != "electronic/dance")
                improvements.Add($"Tempo ({characteristics.Tempo:F0} BPM) may be too fast - consider moderating to 120-140 BPM for mainstream accessibility");

            // Production issues
            if (characteristics.Loudness < -12)
                improvements.Add($"Increase overall loudness (currently {characteristics.Loudness:F1} dB) through better mastering to compete with commercial releases");
            else if (characteristics.Loudness > -3)
                improvements.Add($"Reduce excessive loudness (currently {characteristics.Loudness:F1} dB) to avoid distortion and listener fatigue");

            // Low valence
            if (characteristics.Valence < 0.3)
                improvements.Add($"Consider adding more uplifting elements (current mood score: {characteristics.Valence:P0}) - positive emotions tend to drive streams and shares");

            // Spectral issues
            if (characteristics.SpectralCentroid < 1500)
                improvements.Add("Add brightness and high-frequency content to make the mix more exciting and modern");
            else if (characteristics.SpectralCentroid > 3500)
                improvements.Add("Balance the high frequencies to avoid harshness - add warmth in the mid-range");

            // Commercial score low
            if (scores.CommercialScore < 6)
                improvements.Add("Study current chart-topping songs in your genre and identify key characteristics that resonate with audiences");

            // Viral potential low
            if (scores.ViralPotential < 6)
                improvements.Add("Create a memorable hook or section that listeners will want to share on social media - focus on the first 15 seconds");

            // Genre-specific suggestions
            switch (genre.ToLower())
            {
                case "pop" when characteristics.Danceability < 0.6:
                    improvements.Add("Pop music benefits from high danceability - strengthen the beat and rhythmic structure");
                    break;
                case "electronic/dance" when characteristics.Energy < 0.7:
                    improvements.Add("Electronic dance tracks need higher energy - boost the intensity and build more climactic drops");
                    break;
                case "hip-hop/rap" when characteristics.Speechiness < 0.15:
                    improvements.Add("Increase vocal presence and clarity - hip-hop relies on strong vocal delivery");
                    break;
            }

            // Ensure at least 2 improvements
            if (improvements.Count == 0)
            {
                improvements.Add("Experiment with different arrangements to create more dynamic contrast throughout the track");
                improvements.Add("Consider A/B testing different versions with focus groups to identify the most engaging elements");
            }
            else if (improvements.Count == 1)
            {
                improvements.Add("Refine the mix balance to ensure all elements sit well together in the frequency spectrum");
            }

            return improvements.Take(5).ToList();
        }
    }
}