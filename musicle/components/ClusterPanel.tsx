"use client";

import { motion } from "framer-motion";

interface ClusterInfo {
  clusterId: number;
  size: number;
  dominantGenre: string;
  centroid: Record<string, number>;
}

interface ClusteringSnapshot {
  k: number;
  totalPoints: number;
  inertia: number;
  clusters: ClusterInfo[];
  computedAt: string;
}

interface Props {
  data: ClusteringSnapshot;
}

const GENRE_COLORS: Record<string, string> = {
  "Pop":               "from-pink-500 to-rose-500",
  "Electronic/Dance":  "from-cyan-500 to-blue-500",
  "Hip-Hop/Rap":       "from-amber-500 to-orange-500",
  "Rock":              "from-red-500 to-rose-600",
  "Acoustic/Folk":     "from-emerald-500 to-teal-500",
  "R&B/Soul":          "from-purple-500 to-violet-500",
  "Indie/Alternative": "from-lime-500 to-green-500",
  "Classical/Ambient": "from-blue-400 to-indigo-500",
  "Ambient/Experimental": "from-slate-400 to-gray-500",
};

const KEY_FEATURES = ["Energy", "Danceability", "Valence", "Acousticness"];

export function ClusterPanel({ data }: Props) {
  const sorted = [...data.clusters].sort((a, b) => b.size - a.size);
  const maxSize = sorted[0]?.size ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-white/50">
        <span>k = {data.k} clusters</span>
        <span>·</span>
        <span>{data.totalPoints.toLocaleString()} tracks</span>
        <span>·</span>
        <span>inertia {data.inertia.toLocaleString()}</span>
        <span className="ml-auto text-white/20">
          {new Date(data.computedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {sorted.map((cluster, i) => {
          const gradClass = GENRE_COLORS[cluster.dominantGenre] ?? "from-white/20 to-white/10";
          const sizePct = (cluster.size / maxSize) * 100;

          return (
            <motion.div
              key={cluster.clusterId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${gradClass} shrink-0`} />
                <span className="text-xs font-semibold text-white">{cluster.dominantGenre}</span>
                <span className="ml-auto text-[10px] text-white/40">{cluster.size} tracks</span>
              </div>

              {/* Size bar */}
              <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${gradClass}`}
                  style={{ width: `${sizePct}%` }}
                />
              </div>

              {/* Centroid key features */}
              <div className="grid grid-cols-4 gap-1">
                {KEY_FEATURES.map((feat) => {
                  const val = cluster.centroid[feat];
                  if (val == null) return null;
                  return (
                    <div key={feat} className="text-center">
                      <div className="text-[11px] font-semibold text-white/70">
                        {(val * 100).toFixed(0)}
                        <span className="text-[9px] text-white/30">%</span>
                      </div>
                      <div className="text-[9px] text-white/30">{feat.substring(0, 4)}</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-white/25 leading-relaxed">
        K-Means++ clustering over 8 audio features (Energy, Danceability, Valence,
        Acousticness, Speechiness, Instrumentalness, Tempo, Loudness).
        Dominant genre is the most frequent genre label within each cluster — clusters
        emerge from audio similarity, not from genre labels.
      </p>
    </div>
  );
}
