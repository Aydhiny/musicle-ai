"use client";

import { motion } from "framer-motion";

interface Props {
  probabilities: Record<string, number>;
  predictedGenre: string;
}

export function GenreProbabilityBars({ probabilities, predictedGenre }: Props) {
  const sorted = Object.entries(probabilities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const max = sorted[0]?.[1] ?? 1;

  return (
    <div className="space-y-2">
      {sorted.map(([genre, prob], i) => {
        const isPredicted = genre === predictedGenre;
        const pct = ((prob / max) * 100).toFixed(0);
        const pctRaw = (prob * 100).toFixed(1);

        return (
          <div key={genre} className="flex items-center gap-2">
            <div
              className={`w-28 truncate text-xs shrink-0 ${
                isPredicted ? "text-violet-300 font-semibold" : "text-white/60"
              }`}
              title={genre}
            >
              {genre}
            </div>
            <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                className={`h-full rounded-full ${
                  isPredicted
                    ? "bg-gradient-to-r from-violet-500 to-purple-400"
                    : "bg-white/20"
                }`}
              />
            </div>
            <div
              className={`w-10 text-right text-[11px] shrink-0 ${
                isPredicted ? "text-violet-300 font-semibold" : "text-white/40"
              }`}
            >
              {pctRaw}%
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-white/30 pt-1">
        Softmax probabilities from the GBDT classifier across all genre classes
      </p>
    </div>
  );
}
