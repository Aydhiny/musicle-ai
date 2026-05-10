namespace AiAgents.Core.AbstractionHelpers
{
    public abstract class SoftwareAgent<TPercept, TAction, TResult, TExperience>
            where TResult : class
    {
        protected string State { get; set; } = "idle";

        /// <summary>
        /// One iteration of agent cycle: Sense → Think → Act → (Learn)
        /// Returns null if no work available
        /// </summary>
        public abstract Task<TResult?> StepAsync(CancellationToken ct);

        /// <summary>
        /// SENSE: Perceive the environment
        /// </summary>
        protected abstract Task<TPercept?> SenseAsync(CancellationToken ct);

        /// <summary>
        /// THINK: Decide on action based on perception
        /// </summary>
        protected abstract Task<TAction?> ThinkAsync(TPercept percept, CancellationToken ct);

        /// <summary>
        /// ACT: Execute the action
        /// </summary>
        protected abstract Task<TResult> ActAsync(TAction action, CancellationToken ct);

        /// <summary>
        /// LEARN: Optional - Update knowledge/metrics
        /// </summary>
        protected virtual Task LearnAsync(TExperience experience, CancellationToken ct)
        {
            return Task.CompletedTask;
        }
    }
}
