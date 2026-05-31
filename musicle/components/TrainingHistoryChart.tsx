"use client";

import { motion } from "framer-motion";

interface TrainingRun {
  trainedAt: string;
  library: string;
  accuracy: number;
  logLoss: number;
  samples: number;
}

interface Props {
  runs: TrainingRun[];
}

export function TrainingHistoryChart({ runs }: Props) {
  if (runs.length < 2) {
    return (
      <p className="text-xs text-white/40 text-center py-4">
        Need at least 2 training runs to show a learning curve. Retrain after uploading more tracks or submitting feedback.
      </p>
    );
  }

  const maxAcc = Math.max(...runs.map((r) => r.accuracy));
  const minAcc = Math.min(...runs.map((r) => r.accuracy));
  const range  = Math.max(maxAcc - minAcc, 0.01);

  const W = 100;
  const H = 60;
  const pad = 4;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const toX = (i: number) => pad + (i / (runs.length - 1)) * innerW;
  const toY = (acc: number) => pad + innerH - ((acc - minAcc) / range) * innerH;

  const points = runs.map((r, i) => `${toX(i).toFixed(1)},${toY(r.accuracy).toFixed(1)}`).join(" ");

  return (
    <div className="space-y-3">
      {/* Sparkline SVG */}
      <div className="bg-white/3 rounded-xl p-4 border border-white/6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-24"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={pad} y1={pad + innerH * (1 - t)}
              x2={W - pad} y2={pad + innerH * (1 - t)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />
          ))}

          {/* Area fill */}
          <defs>
            <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline
            points={`${toX(0).toFixed(1)},${H - pad} ${points} ${toX(runs.length - 1).toFixed(1)},${H - pad}`}
            fill="url(#accGrad)"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {runs.map((r, i) => (
            <circle
              key={i}
              cx={toX(i)} cy={toY(r.accuracy)}
              r="1.5"
              fill={r.library === "LightGBM" ? "#a78bfa" : "#fb923c"}
            />
          ))}
        </svg>

        <div className="flex justify-between text-[9px] text-white/30 mt-1">
          <span>Run 1</span>
          <span className="text-white/50 font-medium">Macro Accuracy over training runs</span>
          <span>Run {runs.length}</span>
        </div>
      </div>

      {/* Table of last 5 runs */}
      <div className="space-y-1">
        {runs.slice(-5).reverse().map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 text-xs py-1.5 px-3 bg-white/3 rounded-lg border border-white/5"
          >
            <span className="text-white/30 shrink-0">
              {new Date(r.trainedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                r.library === "LightGBM"
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-orange-500/30 bg-orange-500/10 text-orange-300"
              }`}
            >
              {r.library}
            </span>
            <span className="text-emerald-400 font-semibold">
              {(r.accuracy * 100).toFixed(1)}%
            </span>
            <span className="text-white/30">loss {r.logLoss.toFixed(3)}</span>
            <span className="text-white/20 ml-auto">{r.samples.toLocaleString()} samples</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
