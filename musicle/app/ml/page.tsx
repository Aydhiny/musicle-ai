"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Zap,
  BarChart3,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  Lightbulb,
  FlaskConical,
  Target,
  Cpu,
} from "lucide-react";
import { resolveApiUrl } from "@/lib/api-url";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
}

interface ModelSnapshot {
  name: string;
  activeLibrary: string;
  isReady: boolean;
  rSquared?: number;
  rmse?: number;
  mae?: number;
  accuracy?: number;
  macroF1?: number;
  logLoss?: number;
  trainingSamples: number;
  trainedAt?: string;
  inputFeatures: string[];
  outputTargets: string[];
  description: string;
  expansionTips: string[];
  perClassMetrics?: Record<string, ClassMetrics>;
}

interface PipelineStage {
  step: number;
  name: string;
  description: string;
}

interface LibraryOption {
  id: string;
  name: string;
  description: string;
  badge: string;
}

interface StatusResponse {
  activeLibrary: string;
  availableLibraries: LibraryOption[];
  models: ModelSnapshot[];
  pipeline: { stages: PipelineStage[] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function MetricBadge({ label, value, unit = "" }: { label: string; value?: number | null; unit?: string }) {
  if (value == null) return null;
  const display = value < 1 && unit !== "%" ? value.toFixed(3) : value.toFixed(2);
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
      <div className="text-lg font-bold text-white">
        {display}
        {unit}
      </div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function StatusDot({ ready }: { ready: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ready ? "bg-emerald-400" : "bg-yellow-400 animate-pulse"}`} />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MlDashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const apiUrl = useCallback((path: string) => resolveApiUrl(path), []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/ml/status"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ML status");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSwitch = async (libraryId: string) => {
    if (status?.activeLibrary === libraryId || switching || retraining) return;
    setSwitching(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(apiUrl("/api/ml/library"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ library: libraryId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      await fetchStatus();
      setSuccessMsg(`Switched to ${libraryId} and retrained all models.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Switch failed");
    } finally {
      setSwitching(false);
    }
  };

  const handleRetrain = async () => {
    if (retraining || switching) return;
    setRetraining(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(apiUrl("/api/ml/retrain"), { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
      setSuccessMsg("All models retrained successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retrain failed");
    } finally {
      setRetraining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading ML status…
      </div>
    );
  }

  const isBusy = switching || retraining;

  return (
    <div className="min-h-screen text-white mt-20" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-widest mb-2">
              <Brain className="w-4 h-4" />
              ML Engine
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Model Dashboard</h1>
            <p className="mt-2 text-sm text-white/40 max-w-xl">
              Live view of every model powering Musicle&apos;s genre classification, feature enrichment, and commercial scoring.
              Switch libraries or retrain at any time.
            </p>
          </div>
          <button
            onClick={() => void handleRetrain()}
            disabled={isBusy}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${retraining ? "animate-spin" : ""}`} />
            {retraining ? "Retraining…" : "Retrain All"}
          </button>
        </div>

        {/* ── Alerts ── */}
        <AnimatePresence>
          {(error || successMsg) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${
                error
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
              {error ?? successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Library Switcher ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            Active Library
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {status?.availableLibraries.map((lib) => {
              const isActive = status.activeLibrary === lib.id;
              return (
                <motion.button
                  key={lib.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => void handleSwitch(lib.id)}
                  disabled={isBusy}
                  className={`relative text-left p-4 rounded-2xl border transition-all ${
                    isActive
                      ? "border-violet-500/50 bg-violet-500/10"
                      : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-white">{lib.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            lib.badge === "Default"
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                              : "border-orange-500/30 bg-orange-500/10 text-orange-300"
                          }`}
                        >
                          {lib.badge}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">{lib.description}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive ? "border-violet-400 bg-violet-400" : "border-white/20"
                      }`}
                    >
                      {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  {switching && !isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin text-white/60" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
          {isBusy && (
            <p className="text-xs text-yellow-400/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Training in progress — this takes 15–60 s. The API remains available during training.
            </p>
          )}
        </section>

        {/* ── Model Cards ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider font-semibold">
            <Layers className="w-3.5 h-3.5" />
            Models
          </div>
          <div className="space-y-3">
            {status?.models.map((model) => {
              const isExpanded = expandedModel === model.name;
              return (
                <motion.div
                  key={model.name}
                  layout
                  className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden"
                >
                  {/* Card header */}
                  <button
                    className="w-full text-left p-5 flex items-center gap-4"
                    onClick={() => setExpandedModel(isExpanded ? null : model.name)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusDot ready={model.isReady} />
                        <span className="font-semibold text-white">{model.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/50">
                          {model.activeLibrary}
                        </span>
                        {model.trainedAt && (
                          <span className="text-[10px] text-white/30">
                            trained {new Date(model.trainedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-1 line-clamp-1">{model.description}</p>
                    </div>

                    {/* Quick metric */}
                    <div className="shrink-0 text-right hidden sm:block">
                      {model.accuracy != null && (
                        <div className="text-lg font-bold text-emerald-400">{(model.accuracy * 100).toFixed(1)}%</div>
                      )}
                      {model.rSquared != null && model.accuracy == null && (
                        <div className="text-lg font-bold text-violet-400">R²&nbsp;{model.rSquared.toFixed(3)}</div>
                      )}
                      <div className="text-[10px] text-white/30">
                        {model.trainingSamples.toLocaleString()} samples
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 text-white/30 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-5 border-t border-white/6 pt-4">
                          {/* Metrics row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {model.accuracy != null && (
                              <MetricBadge label="Macro Accuracy" value={model.accuracy * 100} unit="%" />
                            )}
                            {model.macroF1 != null && model.accuracy == null && (
                              <MetricBadge label="Macro F1" value={model.macroF1 * 100} unit="%" />
                            )}
                            {model.logLoss != null && (
                              <MetricBadge label="Log-Loss" value={model.logLoss} />
                            )}
                            {model.rSquared != null && (
                              <MetricBadge label="R²" value={model.rSquared} />
                            )}
                            {model.rmse != null && (
                              <MetricBadge label="RMSE" value={model.rmse} />
                            )}
                            {model.mae != null && (
                              <MetricBadge label="MAE" value={model.mae} />
                            )}
                          </div>

                          {/* Features & targets */}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">
                                Input Features ({model.inputFeatures.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {model.inputFeatures.map((f) => (
                                  <span
                                    key={f}
                                    className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300"
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">
                                What It Predicts
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {model.outputTargets.map((t) => (
                                  <span
                                    key={t}
                                    className="text-[11px] px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* How it learns */}
                          <div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
                              <FlaskConical className="w-3 h-3" /> How It Learns
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed">{model.description}</p>
                          </div>

                          {/* Expansion tips */}
                          <div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
                              <Lightbulb className="w-3 h-3" /> How to Expand It
                            </div>
                            <ul className="space-y-1.5">
                              {model.expansionTips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                                  <ArrowRight className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Per-class breakdown (genre classifier only) */}
                          {model.perClassMetrics && Object.keys(model.perClassMetrics).length > 0 && (
                            <div>
                              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
                                <BarChart3 className="w-3 h-3" /> Per-Class Metrics
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(model.perClassMetrics).map(([cls, m]) => (
                                  <div key={cls} className="bg-white/4 rounded-lg p-2 text-[11px]">
                                    <div className="font-medium text-white/70 mb-1">{cls}</div>
                                    <div className="flex gap-2 text-white/40">
                                      <span>P {(m.precision * 100).toFixed(0)}%</span>
                                      <span>R {(m.recall * 100).toFixed(0)}%</span>
                                      <span className="text-emerald-400">F1 {(m.f1 * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── Pipeline Visualization ── */}
        {status?.pipeline && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider font-semibold">
              <Zap className="w-3.5 h-3.5" />
              Inference Pipeline
            </div>
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-transparent hidden sm:block" />
              <div className="space-y-2">
                {status.pipeline.stages.map((stage, idx) => (
                  <motion.div
                    key={stage.step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-4 p-4 bg-white/3 border border-white/6 rounded-xl sm:ml-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                      {stage.step}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white mb-0.5">{stage.name}</div>
                      <p className="text-xs text-white/50 leading-relaxed">{stage.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Global Expansion Guide ── */}
        <section className="bg-gradient-to-br from-violet-500/8 to-blue-500/8 border border-violet-500/15 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
            <Target className="w-4 h-4" />
            How to Grow the ML System
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-xs text-white/60 leading-relaxed">
            <div className="space-y-3">
              <div>
                <div className="text-white/80 font-semibold mb-1">Better Labels (Biggest Impact)</div>
                <p>
                  Genre labels currently come from heuristics on Spotify features. Importing MusicBrainz or Discogs tags
                  as ground-truth labels would be the single highest-ROI improvement — it turns synthetic labels into
                  real ones.
                </p>
              </div>
              <div>
                <div className="text-white/80 font-semibold mb-1">Richer Audio Features</div>
                <p>
                  NAudio gives us 6 signals. Adding 13-band MFCC, chroma (12-bin), spectral flux, and onset strength
                  would give models 30+ features and close the gap between our extraction and Spotify&apos;s.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-white/80 font-semibold mb-1">Active Learning Loop</div>
                <p>
                  Low-confidence predictions (&lt;60%) should be surfaced to users for correction instead of silently
                  using the model&apos;s best guess. Each correction is stored as 3× weighted training data and fed back
                  on the next retrain.
                </p>
              </div>
              <div>
                <div className="text-white/80 font-semibold mb-1">Subgenre &amp; Multi-label</div>
                <p>
                  Add a second classification head on top of genre to predict subgenre (e.g. Hip-Hop → Trap, Lo-fi).
                  Multi-label output (a track can be both Electronic and Ambient) would also improve accuracy for
                  crossover tracks.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
