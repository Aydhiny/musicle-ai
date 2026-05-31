"use client";

import { useState } from "react";

interface Props {
  features: string[];
  matrix: number[][];
  sampleSize?: number;
}

function shortName(f: string): string {
  const map: Record<string, string> = {
    "Energy": "Enrg",
    "Danceability": "Dance",
    "Valence": "Val",
    "Acousticness": "Acous",
    "Speechiness": "Speech",
    "Instrumentalness": "Instr",
    "Tempo (norm)": "Tempo",
    "Loudness (norm)": "Loud",
    "Liveness": "Live",
    "Popularity (norm)": "Pop",
  };
  return map[f] ?? f.substring(0, 5);
}

function correlationColor(r: number): string {
  const abs = Math.abs(r);
  if (r > 0) {
    // Positive: white → blue
    const alpha = 0.08 + abs * 0.72;
    return `rgba(99,102,241,${alpha.toFixed(2)})`;
  } else {
    // Negative: white → rose
    const alpha = 0.08 + abs * 0.72;
    return `rgba(239,68,68,${alpha.toFixed(2)})`;
  }
}

export function CorrelationHeatmap({ features, matrix, sampleSize }: Props) {
  const [hovered, setHovered] = useState<[number, number] | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Column headers */}
          <div className="flex ml-16 mb-1">
            {features.map((f) => (
              <div
                key={f}
                className="w-10 text-center text-[9px] text-white/40 rotate-[-40deg] origin-bottom-left h-10 flex items-end justify-center pb-1"
                title={f}
              >
                {shortName(f)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {matrix.map((row, i) => (
            <div key={i} className="flex items-center mb-0.5">
              <div className="w-16 text-right pr-2 text-[9px] text-white/40 truncate shrink-0" title={features[i]}>
                {shortName(features[i] ?? `F${i}`)}
              </div>
              {row.map((val, j) => {
                const isHovered = hovered?.[0] === i && hovered?.[1] === j;
                const isDiag    = i === j;
                return (
                  <div
                    key={j}
                    className="w-10 h-8 flex items-center justify-center text-[10px] font-mono rounded cursor-default relative"
                    style={{ background: isDiag ? "rgba(139,92,246,0.25)" : correlationColor(val) }}
                    onMouseEnter={() => setHovered([i, j])}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className={isDiag ? "text-violet-300" : Math.abs(val) > 0.5 ? "text-white" : "text-white/60"}>
                      {isDiag ? "1" : val.toFixed(2).replace(/^-?0\./, (m) => m.replace("0.", "."))}
                    </span>

                    {isHovered && !isDiag && (
                      <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 bg-[#1a1a2e] border border-white/15 rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                        <div className="text-white font-medium">{features[i]} ↔ {features[j]}</div>
                        <div className={val > 0.3 ? "text-blue-400" : val < -0.3 ? "text-rose-400" : "text-white/50"}>
                          r = {val.toFixed(3)} · {
                            Math.abs(val) >= 0.7 ? "strong" :
                            Math.abs(val) >= 0.4 ? "moderate" : "weak"
                          } {val > 0 ? "positive" : "negative"} correlation
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-[9px] text-white/30">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded" style={{ background: "rgba(99,102,241,0.7)" }} />
          Positive correlation
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded" style={{ background: "rgba(239,68,68,0.7)" }} />
          Negative correlation
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          No relationship
        </div>
        {sampleSize && <span className="ml-auto">n = {sampleSize.toLocaleString()} tracks</span>}
      </div>
    </div>
  );
}
