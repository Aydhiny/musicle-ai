namespace AiAgents.Core.AbstractionHelpers
{
    public interface IPolicy<TPercept, TAction>
    {
        Task<TAction?> DecideAsync(TPercept percept, CancellationToken ct);
    }
}
