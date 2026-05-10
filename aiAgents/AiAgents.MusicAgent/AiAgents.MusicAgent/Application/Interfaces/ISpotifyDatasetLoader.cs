using AiAgents.MusicAgent.Data;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface ISpotifyDatasetLoader
    {
        Task<List<SpotifyTrackData>> LoadDatasetAsync(string csvPath);
        List<SpotifyTrackData> GetCachedDataset();
    }
}
