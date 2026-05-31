"use client";

import { motion } from "framer-motion";
import { Music, TrendingUp } from "lucide-react";

interface SimilarTrack {
  rank: number;
  songName: string;
  artistName: string;
  popularity: number;
  distance: number;
  similarityPct: number;
  features: Record<string, number>;
  featureDeltas: Record<string, number>;
}

interface Props {
  tracks: SimilarTrack[];
  genre?: string;
}

const DELTA_LABELS: Record<string, string> = {
  Energy: "Enrg", Danceability: "Dance", Valence: "Val",
  Acousticness: "Acou", "Tempo (norm)": "Tempo"
};

export function KNNSimilarPanel({ tracks, genre }: Props) {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-white/40 text-center py-6">
        No similar tracks found — the dataset may not be loaded yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tracks.map((t, i) => (
        <motion.div
          key={t.rank}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="bg-white/3 border border-white/8 rounded-xl p-3 flex items-start gap-3"
        >
          {/* Rank */}
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] text-violet-300 font-bold shrink-0">
            {t.rank}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{t.songName}</div>
                <div className="text-[11px] text-white/50 truncate">{t.artistName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-emerald-400">{t.similarityPct.toFixed(1)}%</div>
                <div className="text-[10px] text-white/30">similar</div>
              </div>
            </div>

            {/* Similarity bar */}
            <div className="mt-2 w-full bg-white/5 rounded-full h-1 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${t.similarityPct}%` }}
                transition={{ duration: 0.5, delay: i * 0.06 + 0.1 }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              />
            </div>

            {/* Feature deltas: show which features are most/least similar */}
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(t.featureDeltas)
                .filter(([k]) => Object.keys(DELTA_LABELS).includes(k))
                .sort(([, a], [, b]) => a - b)
                .slice(0, 4)
                .map(([feat, delta]) => (
                  <span
                    key={feat}
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      delta < 0.05
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : delta < 0.15
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {DELTA_LABELS[feat] ?? feat} Δ{(delta * 100).toFixed(0)}%
                  </span>
                ))}
            </div>
          </div>

          {/* Popularity */}
          <div className="text-center shrink-0">
            <div className="flex items-center gap-0.5 text-[10px] text-white/40">
              <TrendingUp className="w-3 h-3" />{t.popularity}
            </div>
          </div>
        </motion.div>
      ))}

      <p className="text-[10px] text-white/25 pt-1">
        KNN · Euclidean distance in normalised 8-D feature space ·
        Δ = absolute feature difference (green = very similar, red = different)
      </p>
    </div>
  );
}
