"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  BarChart3,
  Sparkles,
  Award,
  Mic2,
  TrendingUp,
  Loader2,
  Music,
  Clock,
  AlertCircle,
  Play,
  Pause,
  PieChart,
  Lightbulb,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { resolveApiUrl } from "@/lib/api-url";
import { GenreProbabilityBars } from "@/components/GenreProbabilityBars";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Characteristics {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  loudness: number;
  speechiness: number;
  instrumentalness: number;
  spectralCentroid: number;
  zeroCrossingRate?: number;
}

interface AnalysisData {
  trackId: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  audioUrl?: string;
  analysis?: {
    genre: string;
    subgenre: string;
    confidence: number;
    commercialScore: number;
    productionScore: number;
    viralPotential: number;
    characteristics: Characteristics;
    strengths: string[];
    improvements: string[];
    genreProbabilities?: Record<string, number>;
    analyzedAt: string;
  };
}

interface ExplainFeature {
  feature: string;
  value: number;
  expected: string;
  matches: boolean;
  importance: number;
  interpretation: string;
}

interface ExplainData {
  predictedGenre: string;
  supportingFeatures: ExplainFeature[];
  competingSignals: ExplainFeature[];
  explanation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function scoreColor(score: number) {
  if (score >= 8) return "emerald";
  if (score >= 6) return "amber";
  return "rose";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const params    = useParams();
  const router    = useRouter();
  const trackId   = params?.id as string | undefined;

  const [data, setData]         = useState<AnalysisData | null>(null);
  const [explain, setExplain]   = useState<ExplainData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch analysis data
  useEffect(() => {
    if (!trackId || trackId === "analysis") {
      setError("Invalid track ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(resolveApiUrl(`/analysis/${trackId}`));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: AnalysisData = await res.json();
        const audioCandidate = json.audioUrl ?? `/analysis/${trackId}/audio`;
        json.audioUrl = resolveApiUrl(audioCandidate);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [trackId]);

  // Fetch explainability once analysis is loaded
  const fetchExplain = useCallback(async (analysis: NonNullable<AnalysisData["analysis"]>, c: Characteristics) => {
    try {
      const res = await fetch(resolveApiUrl("/api/ml/explain"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictedGenre:  analysis.genre,
          energy:          c.energy,
          danceability:    c.danceability,
          valence:         c.valence,
          acousticness:    c.acousticness,
          speechiness:     c.speechiness,
          instrumentalness:c.instrumentalness,
          tempo:           c.tempo,
          loudness:        c.loudness,
          spectralCentroid:c.spectralCentroid ?? 2000,
          zeroCrossingRate:c.zeroCrossingRate ?? 0.1,
        }),
      });
      if (res.ok) setExplain(await res.json());
    } catch {
      // Explainability is non-critical
    }
  }, []);

  useEffect(() => {
    if (data?.analysis) {
      void fetchExplain(data.analysis, data.analysis.characteristics);
    }
  }, [data, fetchExplain]);

  // Audio player event wiring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd  = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else           { void audio.play(); setIsPlaying(true); }
  };

  // ─── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Analysing your track…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Could not load analysis</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button onClick={() => router.push("/")} className="bg-purple-500 hover:bg-purple-600 transition-colors px-6 py-3 rounded-xl text-sm font-medium">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (data.status !== "Completed" || !data.analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">Processing…</h2>
          <p className="text-gray-400 text-sm">Status: {data.status}</p>
          <p className="text-gray-500 text-xs mt-2">This usually takes 5–15 seconds. The page will update automatically.</p>
        </div>
      </div>
    );
  }

  const a = data.analysis;
  const c = a.characteristics;

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white p-4 sm:p-8">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to upload
      </button>

      <div className="max-w-7xl mx-auto">
        {/* Track header */}
        <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shrink-0">
              <Music className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{data.fileName}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(data.uploadedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left / main column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Audio player */}
            {data.audioUrl && (
              <div className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl p-5">
                <audio ref={audioRef} src={data.audioUrl} preload="metadata" />
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    setCurrentTime(t);
                    if (audioRef.current) audioRef.current.currentTime = t;
                  }}
                  className="w-full h-2 bg-gray-700 rounded-lg mb-2 cursor-pointer"
                />
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center mx-auto transition-transform hover:scale-105"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
            )}

            {/* Genre prediction */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-7">
              <div className="flex items-center gap-4">
                <Brain className="w-10 h-10 text-purple-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-400 mb-0.5">ML Genre Classification</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
                    {a.genre}
                  </div>
                  <div className="text-sm text-purple-300 mt-0.5">{a.subgenre}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-gray-400">Confidence</div>
                  <div className="text-3xl font-bold text-white">{a.confidence}%</div>
                </div>
              </div>
            </div>

            {/* Genre probabilities */}
            {a.genreProbabilities && Object.keys(a.genreProbabilities).length > 1 && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-5">
                <h3 className="font-semibold mb-4 text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4" /> Genre Probability Distribution
                </h3>
                <GenreProbabilityBars probabilities={a.genreProbabilities} predictedGenre={a.genre} />
              </div>
            )}

            {/* Characteristics */}
            <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-6">
              <h3 className="font-semibold mb-5 text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Audio Characteristics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Tempo",            value: c.tempo.toFixed(0),                 unit: "BPM" },
                  { label: "Energy",           value: (c.energy * 100).toFixed(0),         unit: "%" },
                  { label: "Danceability",     value: (c.danceability * 100).toFixed(0),   unit: "%" },
                  { label: "Valence",          value: (c.valence * 100).toFixed(0),         unit: "%" },
                  { label: "Acousticness",     value: (c.acousticness * 100).toFixed(0),    unit: "%" },
                  { label: "Speechiness",      value: (c.speechiness * 100).toFixed(0),     unit: "%" },
                  { label: "Instrumentalness", value: (c.instrumentalness * 100).toFixed(0), unit: "%" },
                  { label: "Loudness",         value: c.loudness.toFixed(1),               unit: "dB" },
                  { label: "Spectral Centroid",value: c.spectralCentroid.toFixed(0),        unit: "Hz" },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</div>
                    <div className="text-2xl font-bold text-purple-400 mt-1">{item.value}</div>
                    <div className="text-[10px] text-gray-500">{item.unit}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explainability */}
            {explain && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-5">
                <h3 className="font-semibold mb-1 text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" /> Why {a.genre}?
                </h3>
                <p className="text-xs text-white/50 mb-4 leading-relaxed">{explain.explanation}</p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold mb-2">
                      Supporting Signals
                    </div>
                    <div className="space-y-2">
                      {explain.supportingFeatures.map((f) => (
                        <div key={f.feature} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-white/70">{f.interpretation}</span>
                        </div>
                      ))}
                      {explain.supportingFeatures.length === 0 && (
                        <p className="text-xs text-white/30">No strong supporting signals detected.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold mb-2">
                      Competing Signals
                    </div>
                    <div className="space-y-2">
                      {explain.competingSignals.map((f) => (
                        <div key={f.feature} className="flex items-start gap-2 text-xs">
                          <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-white/60">{f.interpretation}</span>
                        </div>
                      ))}
                      {explain.competingSignals.length === 0 && (
                        <p className="text-xs text-white/30">No conflicting signals.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Strengths */}
            {a.strengths?.length > 0 && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-5">
                <h3 className="font-semibold mb-3 text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Strengths
                </h3>
                <div className="space-y-2">
                  {a.strengths.map((s, i) => (
                    <div key={i} className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-sm text-emerald-100">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvements */}
            {a.improvements?.length > 0 && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-5">
                <h3 className="font-semibold mb-3 text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Improvements
                </h3>
                <div className="space-y-2">
                  {a.improvements.map((imp, i) => (
                    <div key={i} className="border-l-2 border-purple-500 pl-4 py-2.5 text-sm text-gray-300 bg-white/3 rounded-r-xl">
                      {imp}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right / scores column ── */}
          <div className="space-y-4">
            {[
              { icon: Award,     label: "Commercial",  score: a.commercialScore },
              { icon: Mic2,      label: "Production",  score: a.productionScore },
              { icon: TrendingUp,label: "Viral Potential", score: a.viralPotential },
            ].map(({ icon: Icon, label, score }) => {
              const col = scoreColor(score);
              return (
                <div key={label} className={`bg-${col}-900/40 border border-${col}-500/40 p-6 rounded-2xl`}>
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5" />
                    <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
                  </div>
                  <div className={`text-5xl font-bold text-${col}-400`}>{score}<span className="text-lg text-white/40">/10</span></div>
                </div>
              );
            })}

            {/* Overall */}
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-purple-500/30">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Overall</div>
                <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {((a.commercialScore + a.productionScore + a.viralPotential) / 3).toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">out of 10</div>
              </div>
            </div>

            {/* Analysed at */}
            <div className="text-center text-xs text-white/20 pt-2">
              Analysed {new Date(a.analyzedAt).toLocaleString()}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
