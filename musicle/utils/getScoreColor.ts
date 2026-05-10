export const getScoreColor = (score: number): string => {
  if (score >= 8) return "from-emerald-900/40 to-green-900/40 border-emerald-500/40 text-emerald-400";
  if (score >= 6) return "from-amber-900/40 to-yellow-900/40 border-amber-500/40 text-amber-400";
  return "from-rose-900/40 to-red-900/40 border-rose-500/40 text-rose-400";
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const generateWaveformData = (): number[] => {
  return Array.from({ length: 50 }, () => Math.random() * 100);
};
