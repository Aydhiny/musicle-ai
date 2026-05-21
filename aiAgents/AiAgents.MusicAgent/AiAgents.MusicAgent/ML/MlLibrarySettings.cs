namespace AiAgents.MusicAgent.ML
{
    /// <summary>
    /// Which gradient-boosted-tree library the ML pipeline uses.
    ///
    /// LightGBM  — Microsoft.ML.LightGbm (current default; leaf-wise splitting, fast on large datasets).
    /// FastTree  — Microsoft.ML.FastTree  (MART / gradient boosted trees; same algorithm family as XGBoost,
    ///             level-wise splitting, slightly more stable on small datasets).
    ///
    /// Both live inside ML.NET's pipeline so switching is transparent to callers.
    /// </summary>
    public enum MlLibrary
    {
        LightGBM,
        FastTree   // XGBoost-family — MART gradient boosted decision trees
    }

    /// <summary>
    /// Singleton that tracks the active ML library for all three models.
    /// Volatile write ensures the new value is visible to all threads immediately
    /// (no lock needed for a single-field enum swap).
    /// </summary>
    public class MlLibrarySettings
    {
        private volatile int _activeLibrary = (int)MlLibrary.LightGBM;

        public MlLibrary ActiveLibrary => (MlLibrary)_activeLibrary;

        public void Switch(MlLibrary library)
        {
            Interlocked.Exchange(ref _activeLibrary, (int)library);
        }
    }
}
