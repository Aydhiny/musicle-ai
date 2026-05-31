"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, ShieldQuestion } from "lucide-react";

interface AnomalyResult {
  anomalyScore: number;
  isAnomaly: boolean;
  zScore: number;
  nearestClusterGenre: string;
  distanceToCentroid: number;
  avgClusterDistance: number;
  interpretation: string;
}

interface Props {
  result: AnomalyResult;
}

export function AnomalyBadge({ result }: Props) {
  const color = result.isAnomaly
    ? "amber"
    : result.anomalyScore > 40
    ? "yellow"
    : "emerald";

  const Icon = result.isAnomaly
    ? AlertTriangle
    : result.anomalyScore > 40
    ? ShieldQuestion
    : CheckCircle;

  return (
    <div className={`rounded-2xl border p-5 ${
      result.isAnomaly
        ? "border-amber-500/40 bg-amber-500/8"
        : result.anomalyScore > 40
        ? "border-yellow-500/30 bg-yellow-500/5"
        : "border-emerald-500/30 bg-emerald-500/5"
    }`}>
      <div className="flex items-start gap-4">
        {/* Score ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
            <motion.circle
              cx="28" cy="28" r="22" fill="none"
              stroke={result.isAnomaly ? "#f59e0b" : result.anomalyScore > 40 ? "#eab308" : "#10b981"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - result.anomalyScore / 100) }}
              transition={{ duration: 0.8 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${
              result.isAnomaly ? "text-amber-400" :
              result.anomalyScore > 40 ? "text-yellow-400" : "text-emerald-400"
            }`}>{result.anomalyScore}</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 shrink-0 ${
              result.isAnomaly ? "text-amber-400" :
              result.anomalyScore > 40 ? "text-yellow-400" : "text-emerald-400"
            }`} />
            <span className="text-sm font-semibold text-white">
              {result.isAnomaly ? "Anomalous Track" : result.anomalyScore > 40 ? "Edge-Case Track" : "Typical Track"}
            </span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">{result.interpretation}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-white/40">
            <div>Nearest cluster: <span className="text-white/70">{result.nearestClusterGenre}</span></div>
            <div>z-score: <span className={result.zScore > 2 ? "text-amber-400" : "text-white/70"}>{result.zScore.toFixed(2)}σ</span></div>
            <div>Track distance: <span className="text-white/70">{result.distanceToCentroid.toFixed(3)}</span></div>
            <div>Cluster avg: <span className="text-white/70">{result.avgClusterDistance.toFixed(3)}</span></div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-white/20 mt-3">
        Distance-based anomaly detection · z = (dist − µ) / σ · z &gt; 2 = anomaly (top 2.5% most unusual)
      </p>
    </div>
  );
}
