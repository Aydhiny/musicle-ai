"use client";

import { motion } from "framer-motion";

interface Feature {
  rank: number;
  feature: string;
  score: number;
}

interface Props {
  features: Feature[];
}

const COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

export function FeatureImportanceChart({ features }: Props) {
  const top = features.slice(0, 10);
  const max = top[0]?.score ?? 1;

  return (
    <div className="space-y-2">
      {top.map((f, i) => (
        <div key={f.feature} className="flex items-center gap-3">
          <div className="w-5 text-[10px] text-white/30 text-right shrink-0">{f.rank}</div>
          <div className="w-40 truncate text-xs text-white/70 shrink-0" title={f.feature}>
            {f.feature}
          </div>
          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(f.score / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.04 }}
              className={`h-full rounded-full bg-gradient-to-r ${COLORS[i % COLORS.length]}`}
            />
          </div>
          <div className="w-10 text-right text-[11px] text-white/50 shrink-0">
            {f.score.toFixed(1)}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-white/30 pt-1">
        ANOVA F-statistic · normalised 0–100 · higher = more discriminative across genres
      </p>
    </div>
  );
}
