"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { resolveApiUrl } from "@/lib/api-url";

interface CvResult {
  folds: number;
  foldAccuracies: number[];
  meanAccuracy: number;
  stdAccuracy: number;
  meanLogLoss: number;
  trainingSamples: number;
  computedAt: string;
}

interface Props {
  initial?: CvResult | null;
}

export function CrossValidationPanel({ initial }: Props) {
  const [result, setResult]   = useState<CvResult | null>(initial ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [folds, setFolds]     = useState(5);

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const res = await fetch(resolveApiUrl(`/api/ml/cross-validate?folds=${folds}`), {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  };

  const maxAcc = result ? Math.max(...result.foldAccuracies) : 1;
  const minAcc = result ? Math.min(...result.foldAccuracies) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-xs text-white/50 flex-1 leading-relaxed">
          k-fold cross-validation partitions data into k equal subsets, trains k times
          (each time holding out a different subset for testing), then averages the results.
          Mean ± std tells you how stable the model is — high std = unstable / likely overfitting.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-white/50">k =</label>
          <select
            value={folds}
            onChange={(e) => setFolds(parseInt(e.target.value))}
            disabled={running}
            className="bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-sm text-white"
          >
            {[3, 5, 7, 10].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button
            onClick={() => void run()}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-xs text-violet-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
            {running ? "Running…" : "Run CV"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {running && (
        <div className="text-xs text-amber-400/80 text-center py-4">
          ⏱ Cross-validation is CPU-bound and takes 30–120 s — the API stays responsive in the meantime.
        </div>
      )}

      {result && !running && (
        <div className="space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-emerald-400">
                {(result.meanAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Mean Accuracy</div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-amber-400">
                ±{(result.stdAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Std Deviation</div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-violet-400">
                {result.meanLogLoss.toFixed(3)}
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Mean Log-Loss</div>
            </div>
          </div>

          {/* Per-fold bars */}
          <div className="space-y-2">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Per-Fold Accuracy</div>
            {result.foldAccuracies.map((acc, i) => {
              const pct = maxAcc > minAcc
                ? ((acc - minAcc) / (maxAcc - minAcc)) * 100
                : 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 text-[10px] text-white/50 shrink-0">Fold {i + 1}</div>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(10, pct)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.07 }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                    />
                  </div>
                  <div className="w-12 text-right text-[11px] text-white/60 shrink-0">
                    {(acc * 100).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-white/30">
            {result.folds}-fold · {result.trainingSamples.toLocaleString()} training samples ·
            computed {new Date(result.computedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {!result && !running && (
        <div className="text-center py-8 text-white/30 text-sm">
          Click <span className="text-violet-400">Run CV</span> to start cross-validation.
        </div>
      )}
    </div>
  );
}
