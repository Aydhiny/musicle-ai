"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { resolveApiUrl } from "@/lib/api-url";

interface DayEntry {
  date: string;
  total: number;
  avgConfidence: number;
  genres: Record<string, number>;
}

interface GenreEntry {
  genre: string;
  count: number;
  pct: number;
  avgConf: number;
}

interface DriftSignal {
  genre: string;
  pctFirst: number;
  pctSecond: number;
  delta: number;
}

interface DriftData {
  days: number;
  total: number;
  since: string;
  timeline: DayEntry[];
  genreBreakdown: GenreEntry[];
  driftSignals: DriftSignal[];
  driftDetected: boolean;
}

const GENRE_COLORS: Record<string, string> = {
  "Pop":               "#ec4899",
  "Electronic/Dance":  "#06b6d4",
  "Hip-Hop/Rap":       "#f59e0b",
  "Rock":              "#ef4444",
  "Acoustic/Folk":     "#10b981",
  "R&B/Soul":          "#a855f7",
  "Indie/Alternative": "#84cc16",
  "Classical/Ambient": "#60a5fa",
  "Ambient/Experimental": "#94a3b8",
};

export function GenreDriftChart() {
  const [data, setData]     = useState<DriftData | null>(null);
  const [days, setDays]     = useState(30);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(resolveApiUrl(`/api/ml/genre-drift?days=${d}`));
      if (res.ok) setData(await res.json());
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetch_(days); }, [days, fetch_]);

  if (loading) return <p className="text-xs text-white/40 text-center py-6">Loading drift data…</p>;

  if (!data || data.total === 0) {
    return (
      <p className="text-xs text-white/40 text-center py-8">
        No analysed tracks yet. Upload some tracks to see genre distribution trends.
      </p>
    );
  }

  const maxDay = Math.max(...data.timeline.map((d) => d.total), 1);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50">Time window:</span>
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              days === d
                ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {d}d
          </button>
        ))}
        <span className="ml-auto text-[10px] text-white/30">{data.total} total tracks</span>
      </div>

      {/* Daily bar chart */}
      {data.timeline.length > 0 && (
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">
            Uploads per Day
          </div>
          <div className="flex items-end gap-1 h-16">
            {data.timeline.map((day, i) => (
              <motion.div
                key={day.date}
                title={`${day.date}: ${day.total} tracks`}
                initial={{ height: 0 }}
                animate={{ height: `${(day.total / maxDay) * 100}%` }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                className="flex-1 bg-violet-500/40 hover:bg-violet-500/60 rounded-t cursor-default transition-colors min-h-[2px]"
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-white/20 mt-1">
            <span>{data.since}</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Genre breakdown */}
      <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">
          Genre Distribution ({data.since} → now)
        </div>
        <div className="space-y-1.5">
          {data.genreBreakdown.slice(0, 8).map((g, i) => (
            <div key={g.genre} className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: GENRE_COLORS[g.genre] ?? "#6b7280" }}
              />
              <div className="w-28 text-xs text-white/70 truncate shrink-0">{g.genre}</div>
              <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${g.pct}%` }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                  className="h-full rounded-full"
                  style={{ background: GENRE_COLORS[g.genre] ?? "#6b7280" }}
                />
              </div>
              <div className="w-12 text-right text-[11px] text-white/50">{g.pct}%</div>
              <div className="w-8 text-right text-[10px] text-white/30">{g.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Drift signals */}
      {data.driftDetected && (
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Concept Drift Detected (first half vs second half)
          </div>
          <div className="space-y-1">
            {data.driftSignals.slice(0, 5).map((s) => (
              <div key={s.genre} className="flex items-center gap-2 text-xs">
                {s.delta > 0
                  ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                <span className="text-white/70 w-28 truncate shrink-0">{s.genre}</span>
                <span className="text-white/40">{s.pctFirst}% → {s.pctSecond}%</span>
                <span className={`ml-1 font-medium ${s.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  ({s.delta > 0 ? "+" : ""}{s.delta}pp)
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/20 mt-2">
            Concept drift = distribution shift in uploaded genres over time.
            A large delta (&gt;10pp) is a signal to retrain the model on recent data.
          </p>
        </div>
      )}

      {!data.driftDetected && data.total > 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-400/70">
          <Minus className="w-3.5 h-3.5" />
          No significant genre drift detected in the past {data.days} days.
        </div>
      )}
    </div>
  );
}
