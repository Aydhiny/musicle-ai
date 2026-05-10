namespace AiAgents.Core.AbstractionHelpers
{
    public interface IActuator<TAction, TResult>
    {
        Task<TResult> ExecuteAsync(TAction action, CancellationToken ct);
    }
}
