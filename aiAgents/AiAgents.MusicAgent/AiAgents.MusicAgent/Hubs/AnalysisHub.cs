using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace AiAgents.Web.Hubs
{
    public class AnalysisHub : Hub
    {
        public async Task SubscribeToTrack(string trackId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"track_{trackId}");
        }

        public async Task UnsubscribeFromTrack(string trackId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"track_{trackId}");
        }
    }
}