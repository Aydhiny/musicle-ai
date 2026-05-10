// AiAgents.MusicAgent/Application/Runners/AnalysisAgentRunner.cs
using AiAgents.Core.AbstractionHelpers;
using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Application.Services;
using AiAgents.MusicAgent.Data;
using AiAgents.MusicAgent.Domain.Dtos;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.Domain.Enums;
using AiAgents.MusicAgent.Domain.Rules;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.MusicAgent.ML;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AiAgents.MusicAgent.Application.Runners
{
    /// <summary>
    /// COMPLETE FIX: Direct audio feature extraction to ensure different results
    /// </summary>
    public class AnalysisAgentRunner : SoftwareAgent<Track, AnalysisDecision, AnalysisTickResult, object>
    {
        private readonly Interfaces.IQueueService _queueService;
        private readonly MusicAgentDbContext _db;
        private readonly ILogger<AnalysisAgentRunner> _logger;

        // DIRECT DEPENDENCIES - Not wrapped services
        private readonly IAudioFeatureExtractor _featureExtractor;
        private readonly IGenreClassifier _genreClassifier;
        private readonly IMusicScoringService _scoringService;
        private readonly ISpotifyDatasetLoader _datasetLoader;

        public AnalysisAgentRunner(
            Interfaces.IQueueService queueService,
            MusicAgentDbContext db,
            ILogger<AnalysisAgentRunner> logger,
            IAudioFeatureExtractor featureExtractor,
            IGenreClassifier genreClassifier,
            IMusicScoringService scoringService,
            ISpotifyDatasetLoader datasetLoader)
        {
            _queueService = queueService;
            _db = db;
            _logger = logger;
            _featureExtractor = featureExtractor;
            _genreClassifier = genreClassifier;
            _scoringService = scoringService;
            _datasetLoader = datasetLoader;
        }

        public override async Task<AnalysisTickResult?> StepAsync(CancellationToken ct)
        {
            try
            {
                State = "sensing";
                var track = await SenseAsync(ct);
                if (track == null)
                {
                    State = "idle";
                    return null;
                }

                State = "thinking";
                var decision = await ThinkAsync(track, ct);
                if (decision == null)
                {
                    await _queueService.UpdateStatusAsync(track.Id, AnalysisStatus.Failed, ct);
                    State = "idle";
                    return null;
                }

                State = "acting";
                var result = await ActAsync(decision, ct);

                State = "idle";
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in analysis tick");
                State = "error";
                throw;
            }
        }

        protected override async Task<Track?> SenseAsync(CancellationToken ct)
        {
            return await _queueService.DequeueNextAsync(ct);
        }

        protected override async Task<AnalysisDecision?> ThinkAsync(Track track, CancellationToken ct)
        {
            try
            {
                _logger.LogInformation("Starting analysis for track {TrackId}: {FileName}", track.Id, track.FileName);

                // STEP 1: EXTRACT REAL AUDIO FEATURES
                _logger.LogInformation("Extracting audio features from {FileName}...", track.FileName);
                var characteristics = await _featureExtractor.ExtractFeaturesAsync(track.AudioData, track.FileName);

                _logger.LogInformation("Features extracted: Tempo={Tempo:F1} BPM, Energy={Energy:P0}, Danceability={Danceability:P0}, Speechiness={Speechiness:P0}",
                    characteristics.Tempo, characteristics.Energy, characteristics.Danceability, characteristics.Speechiness);

                // STEP 2: PREDICT GENRE USING ML
                _logger.LogInformation("Predicting genre...");
                var genrePrediction = await _genreClassifier.PredictAsync(characteristics, ct);

                _logger.LogInformation("Genre predicted: {Genre} (Confidence: {Confidence}%)",
                    genrePrediction.Genre, genrePrediction.Confidence);

                // STEP 3: DETERMINE SUBGENRE
                var subgenre = DetermineSubgenre(genrePrediction.Genre, characteristics);

                // STEP 4: CALCULATE SCORES
                _logger.LogInformation("Calculating scores...");
                var scores = _scoringService.CalculateScores(characteristics, genrePrediction.Genre, genrePrediction.Confidence);

                _logger.LogInformation("Scores calculated: Commercial={Commercial}/10, Production={Production}/10, Viral={Viral}/10",
                    scores.CommercialScore, scores.ProductionScore, scores.ViralPotential);

                // STEP 5: FIND SIMILAR TRACKS (optional)
                var recommendations = FindSimilarTracks(characteristics);

                return new AnalysisDecision
                {
                    Track = track,
                    Characteristics = characteristics,
                    Genre = genrePrediction.Genre,
                    Subgenre = subgenre,
                    Confidence = genrePrediction.Confidence,
                    CommercialScore = scores.CommercialScore,
                    ProductionScore = scores.ProductionScore,
                    ViralPotential = scores.ViralPotential,
                    Recommendations = recommendations,
                    Strengths = scores.Strengths,
                    Improvements = scores.Improvements
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Think phase for track {TrackId}", track.Id);
                return null;
            }
        }

        protected override async Task<AnalysisTickResult> ActAsync(AnalysisDecision decision, CancellationToken ct)
        {
            var analysis = new Analysis
            {
                Id = Guid.NewGuid(),
                TrackId = decision.Track.Id,
                Genre = decision.Genre,
                Subgenre = decision.Subgenre,
                Confidence = decision.Confidence,
                CommercialScore = decision.CommercialScore,
                ProductionScore = decision.ProductionScore,
                ViralPotential = decision.ViralPotential,
                CharacteristicsJson = JsonSerializer.Serialize(decision.Characteristics),
                SimilarTracksJson = JsonSerializer.Serialize(decision.Recommendations),
                Strengths = decision.Strengths ?? new List<string>(),
                Improvements = decision.Improvements ?? new List<string>(),
                AnalyzedAt = DateTime.UtcNow
            };

            _db.Analyses.Add(analysis);
            await _queueService.UpdateStatusAsync(decision.Track.Id, AnalysisStatus.Completed, ct);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("✅ Completed analysis for track {TrackId}: {Genre} ({Confidence}%) - Commercial: {Commercial}/10, Production: {Production}/10, Viral: {Viral}/10",
                decision.Track.Id, decision.Genre, decision.Confidence,
                decision.CommercialScore, decision.ProductionScore, decision.ViralPotential);

            return new AnalysisTickResult
            {
                TrackId = decision.Track.Id,
                State = "completed",
                FileName = decision.Track.FileName,
                Genre = decision.Genre,
                Subgenre = decision.Subgenre,
                Confidence = decision.Confidence,
                CommercialScore = decision.CommercialScore,
                ProductionScore = decision.ProductionScore,
                ViralPotential = decision.ViralPotential,
                ProcessedAt = DateTime.UtcNow
            };
        }

        private string DetermineSubgenre(string genre, Characteristics characteristics)
        {
            return genre.ToLower() switch
            {
                "electronic/dance" => characteristics.Tempo switch
                {
                    >= 128 and <= 135 => "House",
                    >= 140 and <= 150 => "Techno",
                    >= 160 => "Drum & Bass",
                    _ => "EDM"
                },
                "hip-hop/rap" => characteristics.Energy switch
                {
                    >= 0.7 => "Trap",
                    < 0.5 => "Lo-fi Hip Hop",
                    _ => "Contemporary Hip Hop"
                },
                "pop" => characteristics.Danceability switch
                {
                    >= 0.7 => "Dance Pop",
                    _ when characteristics.Acousticness > 0.5 => "Acoustic Pop",
                    _ => "Synth Pop"
                },
                "rock" => characteristics.Energy switch
                {
                    >= 0.8 => "Hard Rock",
                    _ when characteristics.Acousticness > 0.4 => "Alternative Rock",
                    _ => "Rock"
                },
                "acoustic/folk" => characteristics.Valence switch
                {
                    >= 0.6 => "Folk",
                    _ => "Singer-Songwriter"
                },
                "r&b/soul" => characteristics.Tempo switch
                {
                    >= 100 => "Contemporary R&B",
                    _ => "Soul"
                },
                "indie/alternative" => characteristics.Energy switch
                {
                    >= 0.6 => "Indie Rock",
                    _ => "Indie Pop"
                },
                "classical/ambient" => characteristics.Instrumentalness switch
                {
                    >= 0.8 => "Ambient",
                    _ => "Neo-Classical"
                },
                _ => "General"
            };
        }

        private List<SpotifyTrackDto> FindSimilarTracks(Characteristics characteristics)
        {
            try
            {
                var dataset = _datasetLoader.GetCachedDataset();

                // Find tracks with similar characteristics
                var similar = dataset
                    .Select(track => new
                    {
                        Track = track,
                        Similarity = CalculateSimilarity(characteristics, track)
                    })
                    .OrderByDescending(x => x.Similarity)
                    .Take(5)
                    .Select(x => new SpotifyTrackDto
                    {
                        SongName = x.Track.SongName,
                        ArtistName = x.Track.ArtistName,
                        Popularity = x.Track.Popularity,
                        Tempo = x.Track.Tempo,
                        Energy = x.Track.Energy,
                        Danceability = x.Track.Danceability
                    })
                    .ToList();

                return similar;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error finding similar tracks");
                return new List<SpotifyTrackDto>();
            }
        }

        private double CalculateSimilarity(Characteristics c, SpotifyTrackData track)
        {
            // Calculate similarity score based on feature differences
            var tempoDiff = 1.0 - Math.Min(1.0, Math.Abs(c.Tempo - track.Tempo) / 50.0);
            var energyDiff = 1.0 - Math.Abs(c.Energy - track.Energy);
            var danceabilityDiff = 1.0 - Math.Abs(c.Danceability - track.Danceability);
            var valenceDiff = 1.0 - Math.Abs(c.Valence - track.Valence);

            return (tempoDiff + energyDiff + danceabilityDiff + valenceDiff) / 4.0;
        }
    }
}