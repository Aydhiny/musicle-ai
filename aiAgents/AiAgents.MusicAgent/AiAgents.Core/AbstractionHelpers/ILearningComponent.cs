namespace AiAgents.Core.AbstractionHelpers
{
    public interface ILearningComponent<TExperience>
    {
        Task LearnFromAsync(TExperience experience, CancellationToken ct);
        Task<bool> ShouldLearnAsync(CancellationToken ct);
    }
}
