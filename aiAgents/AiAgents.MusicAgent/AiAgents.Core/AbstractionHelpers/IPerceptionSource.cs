namespace AiAgents.Core.AbstractionHelpers
{
    public interface IPerceptionSource<T>
    {
        Task<T?> GetNextPerceptAsync(CancellationToken ct);
        Task<bool> HasWorkAsync(CancellationToken ct);
    }
}
