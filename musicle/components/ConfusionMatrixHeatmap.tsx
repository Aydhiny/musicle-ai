"use client";

import { useState } from "react";

interface Props {
  labels: string[];
  matrix: number[][];
}

function shortLabel(label: string): string {
  const map: Record<string, string> = {
    "Acoustic/Folk": "Acoustic",
    "Ambient/Experimental": "Ambient",
    "Classical/Ambient": "Classical",
    "Electronic/Dance": "Electronic",
    "Hip-Hop/Rap": "Hip-Hop",
    "Indie/Alternative": "Indie",
    "Pop": "Pop",
    "R&B/Soul": "R&B",
    "Rock": "Rock",
  };
  return map[label] ?? label.split("/")[0];
}

export function ConfusionMatrixHeatmap({ labels, matrix }: Props) {
  const [hovered, setHovered] = useState<[number, number] | null>(null);

  // Row maxima for colour normalisation (per-actual-class)
  const rowMaxes = matrix.map((row) => Math.max(...row, 1));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Column headers */}
        <div className="flex mb-1 ml-14">
          {labels.map((l) => (
            <div
              key={l}
              className="w-10 text-center text-[9px] text-white/40 rotate-[-40deg] origin-bottom-left h-10 flex items-end justify-center pb-1"
              title={l}
            >
              {shortLabel(l)}
            </div>
          ))}
        </div>

        {/* Rows */}
        {matrix.map((row, actual) => (
          <div key={actual} className="flex items-center mb-0.5">
            {/* Row label */}
            <div
              className="w-14 text-right pr-2 text-[9px] text-white/40 truncate shrink-0"
              title={labels[actual]}
            >
              {shortLabel(labels[actual] ?? `C${actual}`)}
            </div>

            {row.map((count, predicted) => {
              const isHovered = hovered?.[0] === actual && hovered?.[1] === predicted;
              const isDiag = actual === predicted;
              const intensity = count / rowMaxes[actual];

              const bg = isDiag
                ? `rgba(139,92,246,${0.15 + intensity * 0.75})` // violet for correct
                : `rgba(239,68,68,${intensity * 0.6})`;          // red for errors

              return (
                <div
                  key={predicted}
                  className="w-10 h-8 flex items-center justify-center text-[10px] font-mono rounded cursor-default transition-all relative"
                  style={{ background: bg }}
                  onMouseEnter={() => setHovered([actual, predicted])}
                  onMouseLeave={() => setHovered(null)}
                >
                  {count > 0 ? count : <span className="text-white/10">·</span>}

                  {isHovered && (
                    <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 bg-[#1a1a2e] border border-white/15 rounded-lg px-2 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                      <div className="text-white/70">
                        Actual: <span className="text-white font-medium">{shortLabel(labels[actual] ?? "?")}</span>
                      </div>
                      <div className="text-white/70">
                        Predicted: <span className="text-white font-medium">{shortLabel(labels[predicted] ?? "?")}</span>
                      </div>
                      <div className={isDiag ? "text-emerald-400" : "text-rose-400"}>
                        {isDiag ? "✓ Correct" : "✗ Misclassified"} · {count}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="flex items-center gap-4 mt-3 ml-14 text-[9px] text-white/30">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "rgba(139,92,246,0.75)" }} />
            Correct (diagonal)
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: "rgba(239,68,68,0.50)" }} />
            Misclassified
          </div>
          <span>· darker = more frequent</span>
        </div>
      </div>
    </div>
  );
}
