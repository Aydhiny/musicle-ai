using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;

namespace AiAgents.MusicAgent.Application.Services
{
    public class ScoringService : IScoringService
    {
        public (int commercial, int production) CalculateScores(Characteristics characteristics)
        {
            var commercial = CalculateCommercialScore(characteristics);
            var production = CalculateProductionScore(characteristics);
            return (commercial, production);
        }

        private int CalculateCommercialScore(Characteristics c)
        {
            double score = 0;

            // Tempo in sweet spot (100-130 BPM)
            if (c.Tempo >= 100 && c.Tempo <= 130)
                score += 2.5;
            else if (c.Tempo >= 90 && c.Tempo <= 140)
                score += 1.5;

            // High energy
            score += c.Energy * 2.5;

            // Danceability
            score += c.Danceability * 2.5;

            // Positive valence
            if (c.Valence > 0.5)
                score += c.Valence * 1.5;
            else
                score += 0.5;

            // Not too acoustic (modern production)
            score += (1 - c.Acousticness) * 0.5;

            return Math.Clamp((int)Math.Round(score), 0, 10);
        }

        private int CalculateProductionScore(Characteristics c)
        {
            double score = 0;

            // Modern production (not too acoustic)
            score += (1 - c.Acousticness) * 3;

            // Good energy
            score += c.Energy * 2.5;

            // Competitive loudness (-8 to -4 dB is ideal)
            if (c.Loudness >= -8 && c.Loudness <= -4)
                score += 2.5;
            else if (c.Loudness >= -12)
                score += 1.5;

            // Dynamic range (3-6 is good balance)
            if (c.DynamicRange >= 3 && c.DynamicRange <= 6)
                score += 1.5;
            else if (c.DynamicRange >= 2)
                score += 0.5;

            return Math.Clamp((int)Math.Round(score), 0, 10);
        }

        public int CalculateViralPotential(Characteristics c)
        {
            double score = 0;

            // High danceability = shareable
            score += c.Danceability * 3;

            // High energy = engaging
            score += c.Energy * 2;

            // Catchy tempo range
            if (c.Tempo >= 110 && c.Tempo <= 135)
                score += 2;
            else if (c.Tempo >= 100 && c.Tempo <= 140)
                score += 1;

            // Positive vibe
            if (c.Valence > 0.5)
                score += 1.5;

            // Modern production
            if (c.Loudness > -6)
                score += 1;

            // Not too long or complex
            if (c.Instrumentalness < 0.5)
                score += 0.5;

            return Math.Clamp((int)Math.Round(score), 0, 10);
        }

        public List<string> GenerateStrengths(Characteristics c, int commercialScore, int productionScore)
        {
            var strengths = new List<string>();

            // Energy strengths
            if (c.Energy > 0.75)
                strengths.Add("Explosive energy - perfect for high-intensity moments");
            else if (c.Energy > 0.6)
                strengths.Add("Strong energy levels - engaging and dynamic");

            // Danceability strengths
            if (c.Danceability > 0.75)
                strengths.Add("Exceptional groove - club and party ready");
            else if (c.Danceability > 0.6)
                strengths.Add("Solid rhythmic foundation - moves bodies");

            // Valence strengths
            if (c.Valence > 0.7)
                strengths.Add("Uplifting vibes - feel-good anthem potential");
            else if (c.Valence > 0.5)
                strengths.Add("Positive emotional tone - accessible and warm");

            // Tempo strengths
            if (c.Tempo >= 120 && c.Tempo <= 135)
                strengths.Add("Sweet spot tempo - optimal for mainstream appeal");
            else if (c.Tempo >= 100 && c.Tempo <= 140)
                strengths.Add("Engaging tempo - keeps momentum flowing");

            // Acousticness
            if (c.Acousticness > 0.7)
                strengths.Add("Rich organic texture - authentic and intimate");
            else if (c.Acousticness < 0.3)
                strengths.Add("Polished electronic production - modern sound");

            // Loudness
            if (c.Loudness > -6)
                strengths.Add("Competitive loudness - radio and streaming ready");

            // Dynamic range
            if (c.DynamicRange > 5)
                strengths.Add("Great dynamic contrast - expressive and nuanced");

            // Speechiness
            if (c.Speechiness > 0.4)
                strengths.Add("Strong vocal presence - lyric-driven narrative");

            // Instrumentalness
            if (c.Instrumentalness > 0.6)
                strengths.Add("Rich instrumental layers - cinematic quality");

            // Scores
            if (commercialScore >= 8)
                strengths.Add("High commercial potential - mainstream ready");
            if (productionScore >= 8)
                strengths.Add("Professional production quality - competitive mix");

            // Default if no strengths found
            if (strengths.Count == 0)
                strengths.Add("Unique sound profile - explore niche markets");

            return strengths;
        }

        public List<string> GenerateImprovements(Characteristics c, int commercialScore, int productionScore)
        {
            var improvements = new List<string>();

            // Energy improvements
            if (c.Energy < 0.4)
                improvements.Add("Boost energy - add driving elements and build intensity");

            // Danceability improvements
            if (c.Danceability < 0.45)
                improvements.Add("Strengthen groove - enhance rhythmic pocket and pulse");

            // Production improvements
            if (productionScore < 6)
                improvements.Add("Elevate production - refine mix clarity and sonic depth");

            // Valence improvements
            if (c.Valence < 0.35)
                improvements.Add("Brighten the mood - inject uplifting melodic elements");

            // Tempo improvements
            if (c.Tempo < 80)
                improvements.Add("Consider uptempo version - increase pace for more energy");

            // Loudness improvements
            if (c.Loudness < -15)
                improvements.Add("Increase loudness - optimize for streaming platforms");

            // Dynamic range improvements
            if (c.DynamicRange < 2)
                improvements.Add("Add dynamic variation - create more emotional peaks");

            // Commercial improvements
            if (commercialScore < 6)
                improvements.Add("Study current trends - incorporate contemporary production techniques");

            // Speechiness improvements
            if (c.Speechiness > 0.7)
                improvements.Add("Balance vocal density - allow instrumental space to breathe");

            // Acousticness improvements
            if (c.Acousticness > 0.8 && c.Energy < 0.5)
                improvements.Add("Consider subtle electronic elements for wider appeal");

            // Default if no improvements needed
            if (improvements.Count == 0)
                improvements.Add("Solid fundamentals - fine-tuning will optimize commercial positioning");

            return improvements;
        }
    }
}
