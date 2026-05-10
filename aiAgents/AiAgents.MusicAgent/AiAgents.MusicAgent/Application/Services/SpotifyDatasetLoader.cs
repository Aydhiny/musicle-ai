using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Data;
using CsvHelper;
using CsvHelper.Configuration;
using System.Formats.Asn1;
using System.Globalization;

namespace AiAgents.MusicAgent.Application.Services
{

    public class SpotifyDatasetLoader : ISpotifyDatasetLoader
    {
        private readonly ILogger<SpotifyDatasetLoader> _logger;
        private List<SpotifyTrackData>? _cachedDataset;
        private readonly object _lock = new object();

        public SpotifyDatasetLoader(ILogger<SpotifyDatasetLoader> logger)
        {
            _logger = logger;
        }

        public async Task<List<SpotifyTrackData>> LoadDatasetAsync(string csvPath)
        {
            if (_cachedDataset != null)
            {
                _logger.LogInformation("Returning cached Spotify dataset with {Count} tracks", _cachedDataset.Count);
                return _cachedDataset;
            }

            lock (_lock)
            {
                if (_cachedDataset != null)
                    return _cachedDataset;

                _logger.LogInformation("Loading Spotify dataset from {Path}", csvPath);

                try
                {
                    var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                    {
                        HeaderValidated = null,
                        MissingFieldFound = null,
                    };

                    using var reader = new StreamReader(csvPath);
                    using var csv = new CsvReader(reader, config);

                    _cachedDataset = csv.GetRecords<SpotifyTrackData>().ToList();

                    _logger.LogInformation("Successfully loaded {Count} tracks from Spotify dataset", _cachedDataset.Count);

                    return _cachedDataset;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error loading Spotify dataset");
                    throw;
                }
            }
        }

        public List<SpotifyTrackData> GetCachedDataset()
        {
            if (_cachedDataset == null)
                throw new InvalidOperationException("Dataset not loaded. Call LoadDatasetAsync first.");

            return _cachedDataset;
        }
    }
}
