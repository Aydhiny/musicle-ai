import {
  Activity,
  Award,
  BarChart3,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  History,
  Loader2,
  MessageSquare,
  Mic2,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import { ShareService } from "@/services/shareService";
import {
  addWaveformComment,
  createHighlightPost,
  createTrackRevision,
  ComparisonStats,
  getComparisonStats,
  getTrackTimeline,
  getWaveformComments,
  TrackRevision,
  submitComparisonVote,
  submitFeedback as submitFeedbackApi,
  WaveformComment,
} from "@/services/backendApi";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { resolveApiUrl } from "@/lib/api-url";
import { downloadSvg, makeAnalysisCoverArt, makeScorecard } from "@/lib/analysis-art";

// Interfaces (self-contained - extend your AudioInterfaces as needed)
interface AudioCharacteristics {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  loudness: number;
  speechiness: number;
  instrumentalness: number;
  spectralCentroid: number;
}

interface Analysis {
  /** Returned by backend as analysis.id inside the analysis object */
  id?: string;
  genre: string;
  subgenre: string;
  confidence: number;
  commercialScore: number;
  productionScore: number;
  viralPotential: number;
  characteristics: AudioCharacteristics;
  strengths: string[];
  improvements: string[];
  analyzedAt: string;
}

interface AnalysisResult {
  trackId: string;
  /** Top-level analysisId returned by GET /api/analysis/{trackId} (fixed backend) */
  analysisId?: string;
  fileName: string;
  uploadedAt: string;
  /** Optional - present once backend sets it */
  status?: string;
  audioUrl?: string;
  analysis: Analysis;
}

interface ComparisonResult extends AnalysisResult {
  error?: string | null;
}

interface RecentTrack {
  trackId: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  genre?: string;
  subgenre?: string;
  confidence?: number;
}

// Feedback types
interface FeedbackPayload {
  analysisId: string;
  correctedGenre?: string;
  correctedSubgenre?: string;
  accuracyRating?: number;
  correctedCommercialScore?: number;
  correctedProductionScore?: number;
  correctedViralPotential?: number;
  notes?: string;
}

interface FeedbackSharePayload {
  analysisId: string;
  accuracyRating: number;
  correctedGenre?: string;
  correctedSubgenre?: string;
  correctedCommercialScore?: number;
  correctedProductionScore?: number;
  correctedViralPotential?: number;
  notes?: string;
  originalGenre: string;
  originalSubgenre: string;
}

interface FeedbackFormState {
  open: boolean;
  submitted: boolean;
  loading: boolean;
  error: string | null;
  accuracyRating: number | null;
  correctedGenre: string;
  correctedSubgenre: string;
  correctedCommercial: string;
  correctedProduction: string;
  correctedViral: string;
  notes: string;
}

interface ResultsSectionProps {
  result: AnalysisResult;
  onReset: () => void;
}

// API
async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  await submitFeedbackApi(payload);
}

// Constants - computed outside component to stay pure
const CHAR_LABELS: Record<keyof AudioCharacteristics, string> = {
  tempo: "Tempo",
  energy: "Energy",
  danceability: "Danceability",
  valence: "Valence",
  acousticness: "Acousticness",
  loudness: "Loudness",
  speechiness: "Speechiness",
  instrumentalness: "Instrumentalness",
  spectralCentroid: "Spectral Centroid",
};

// Stable waveform bar heights - no Math.random inside render
const WAVEFORM_HEIGHTS: number[] = Array.from({ length: 48 }, (_, i) => Math.round(20 + Math.sin(i * 0.7) * 40 + ((i * 137) % 30)));

// Primitive sub-components

function AnimatedBar({ value, color = "from-violet-500 to-fuchsia-500" }: { value: number; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 120);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
      <div className={`h-full bg-linear-to-r ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${width}%` }} />
    </div>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDash((score / 10) * circ), 150);
    return () => clearTimeout(t);
  }, [score, circ]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[90px] h-[90px]">
        <svg width="90" height="90" className="-rotate-90 absolute inset-0">
          <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle
            cx="45"
            cy="45"
            r={r}
            fill="none"
            stroke="url(#scoreGrad)"
            strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease-out" }}
          />
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{score.toFixed(1)}</span>
      </div>
      <span className="text-[11px] text-gray-400 text-center leading-tight">{label}</span>
    </div>
  );
}

function CharacteristicRow({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value > 1 ? (value / 200) * 100 : value * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300 font-mono">{value > 1 ? value.toFixed(0) : value.toFixed(2)}</span>
      </div>
      <AnimatedBar value={pct} />
    </div>
  );
}

function deltaTone(delta: number): string {
  if (delta > 0.25) return "text-emerald-300";
  if (delta < -0.25) return "text-rose-300";
  return "text-amber-300";
}

function deltaLabel(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`;
  return delta.toFixed(1);
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(n)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 transition-colors ${(hover ?? value ?? 0) >= n ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}`}
          />
        </button>
      ))}
    </div>
  );
}

// Feedback Panel
type ScoreField = "correctedCommercial" | "correctedProduction" | "correctedViral";

const SCORE_FIELDS: { label: string; field: ScoreField }[] = [
  { label: "Commercial", field: "correctedCommercial" },
  { label: "Production", field: "correctedProduction" },
  { label: "Viral", field: "correctedViral" },
];

function FeedbackPanel({
  analysisId,
  originalGenre,
  originalSubgenre,
  onShareFeedback,
}: {
  analysisId: string;
  originalGenre: string;
  originalSubgenre: string;
  onShareFeedback?: (payload: FeedbackSharePayload) => Promise<void>;
}) {
  const [state, setState] = useState<FeedbackFormState>({
    open: false,
    submitted: false,
    loading: false,
    error: null,
    accuracyRating: null,
    correctedGenre: "",
    correctedSubgenre: "",
    correctedCommercial: "",
    correctedProduction: "",
    correctedViral: "",
    notes: "",
  });

  const [sharingFeedback, setSharingFeedback] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const set = (partial: Partial<FeedbackFormState>) => setState((s) => ({ ...s, ...partial }));

  async function handleSubmit() {
    if (!state.accuracyRating) {
      set({ error: "Please rate the accuracy first." });
      return;
    }
    set({ loading: true, error: null });
    try {
      await submitFeedback({
        analysisId,
        accuracyRating: state.accuracyRating,
        correctedGenre: state.correctedGenre || undefined,
        correctedSubgenre: state.correctedSubgenre || undefined,
        correctedCommercialScore: state.correctedCommercial ? Number(state.correctedCommercial) : undefined,
        correctedProductionScore: state.correctedProduction ? Number(state.correctedProduction) : undefined,
        correctedViralPotential: state.correctedViral ? Number(state.correctedViral) : undefined,
        notes: state.notes || undefined,
      });
      set({ submitted: true, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      set({ loading: false, error: msg });
    }
  }

  if (state.submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-emerald-300">Thank you for your feedback!</p>
          <p className="text-sm text-emerald-400/70 mt-0.5">Your corrections help train the model to improve.</p>
          {onShareFeedback && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!state.accuracyRating) {
                    setShareMessage("Please provide an accuracy rating before sharing.");
                    return;
                  }
                  setSharingFeedback(true);
                  setShareMessage(null);
                  try {
                    await onShareFeedback({
                      analysisId,
                      accuracyRating: state.accuracyRating,
                      correctedGenre: state.correctedGenre || undefined,
                      correctedSubgenre: state.correctedSubgenre || undefined,
                      correctedCommercialScore: state.correctedCommercial ? Number(state.correctedCommercial) : undefined,
                      correctedProductionScore: state.correctedProduction ? Number(state.correctedProduction) : undefined,
                      correctedViralPotential: state.correctedViral ? Number(state.correctedViral) : undefined,
                      notes: state.notes || undefined,
                      originalGenre,
                      originalSubgenre,
                    });
                    setShareMessage("Shared feedback to the community feed.");
                  } catch (err) {
                    setShareMessage(err instanceof Error ? err.message : "Failed to share feedback.");
                  } finally {
                    setSharingFeedback(false);
                  }
                }}
                disabled={sharingFeedback}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
              >
                {sharingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                {sharingFeedback ? "Sharing..." : "Share Feedback"}
              </button>
              {shareMessage && <span className="text-xs text-emerald-200/80">{shareMessage}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  const genreMarkedCorrect = state.correctedGenre === originalGenre;
  const genreMarkedWrong = state.correctedGenre === "" && state.open;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => set({ open: !state.open })}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          Give Feedback / Correct This Analysis
        </span>
        {state.open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {state.open && (
        <div className="px-6 pb-6 space-y-5 border-t border-white/8">
          {/* Star rating */}
          <div className="pt-5">
            <label className="block text-xs text-gray-400 mb-2">How accurate was this analysis?</label>
            <StarRating value={state.accuracyRating} onChange={(v) => set({ accuracyRating: v })} />
          </div>

          {/* Genre thumbs */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Genre correct?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => set({ correctedGenre: originalGenre })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  genreMarkedCorrect
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                <ThumbsUp className="w-3 h-3" /> Yes, correct
              </button>
              <button
                type="button"
                onClick={() => set({ correctedGenre: "" })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  genreMarkedWrong ? "bg-red-500/20 border-red-500/50 text-red-300" : "border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                <ThumbsDown className="w-3 h-3" /> No, it&apos;s wrong
              </button>
            </div>
          </div>

          {/* Genre / subgenre text inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Correct Genre</label>
              <input
                type="text"
                placeholder={originalGenre}
                value={genreMarkedCorrect ? "" : state.correctedGenre}
                onChange={(e) => set({ correctedGenre: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Correct Subgenre</label>
              <input
                type="text"
                placeholder={originalSubgenre}
                value={state.correctedSubgenre}
                onChange={(e) => set({ correctedSubgenre: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Score corrections */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Correct Scores (1-10, leave blank to keep)</label>
            <div className="grid grid-cols-3 gap-2">
              {SCORE_FIELDS.map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    placeholder="-"
                    value={state[field]}
                    onChange={(e) => set({ [field]: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Additional Notes</label>
            <textarea
              rows={2}
              placeholder="Anything else the model got wrong or right..."
              value={state.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
            />
          </div>

          {state.error && <p className="text-xs text-red-400">{state.error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={state.loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Feedback
          </button>
        </div>
      )}
    </div>
  );
}

// Main Component
export const ResultsSection: React.FC<ResultsSectionProps> = ({ result, onReset }) => {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const { token } = useAuth();
  const router = useRouter();
  const [compareId, setCompareId] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<ComparisonResult | null>(null);
  const [compareMessage, setCompareMessage] = useState<string | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [improvementChecks, setImprovementChecks] = useState<Record<number, boolean>>({});
  const [waveformComments, setWaveformComments] = useState<WaveformComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentTime, setCommentTime] = useState("0");
  const [timeline, setTimeline] = useState<TrackRevision[]>([]);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionPrevId, setRevisionPrevId] = useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [blindOrder, setBlindOrder] = useState<"ab" | "ba">("ab");
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Close share dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setImprovementChecks({});
  }, [result.trackId]);

  useEffect(() => {
    const loadExtras = async () => {
      setCommentLoading(true);
      try {
        const [comments, chain] = await Promise.all([
          getWaveformComments(result.trackId),
          getTrackTimeline(result.trackId),
        ]);
        setWaveformComments(comments);
        setTimeline(chain);
      } catch {
        setWaveformComments([]);
        setTimeline([]);
      } finally {
        setCommentLoading(false);
      }
    };

    loadExtras();
  }, [result.trackId]);

  useEffect(() => {
    if (!compareResult?.analysis) {
      setComparisonStats(null);
      return;
    }

    const loadStats = async () => {
      try {
        const stats = await getComparisonStats(result.trackId, compareResult.trackId);
        setComparisonStats(stats);
      } catch {
        setComparisonStats(null);
      }
    };

    setBlindOrder(Math.random() < 0.5 ? "ab" : "ba");
    loadStats();
  }, [compareResult, result.trackId]);

  useEffect(() => {
    const loadRecent = async () => {
      setLoadingRecent(true);
      try {
        const res = await fetch(resolveApiUrl("/analysis/recent?count=12"));
        if (res.ok) {
          const data = (await res.json()) as { tracks?: RecentTrack[] };
          setRecentTracks((data.tracks ?? []).filter((t) => t.trackId !== result.trackId));
        }
      } catch {
        setRecentTracks([]);
      } finally {
        setLoadingRecent(false);
      }
    };

    loadRecent();
  }, [result.trackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoaded = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setAudioDuration(duration);
      setAudioReady(duration > 0);
    };

    const handleTimeUpdate = () => {
      setAudioTime(audio.currentTime || 0);
    };

    const handlePlay = () => setAudioPlaying(true);
    const handlePause = () => setAudioPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("durationchange", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    handleLoaded();

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("durationchange", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [result.trackId]);

  // Resolve analysisId from top-level field (backend fixed version) or analysis.id
  const analysisId = result.analysisId ?? result.analysis?.id;

  const analysis = result.analysis;

  // Stable characteristic rows - memoized so key order is always consistent
  const characteristicRows = useMemo(() => {
    const c = analysis?.characteristics;
    if (!c) return [];
    return (Object.keys(CHAR_LABELS) as (keyof AudioCharacteristics)[]).map((key) => ({
      key,
      label: CHAR_LABELS[key],
      value: c[key],
    }));
  }, [analysis?.characteristics]);

  const overallScore = analysis ? (analysis.commercialScore + analysis.productionScore + analysis.viralPotential) / 3 : 0;
  const formatTimestamp = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };
  const votesForTrack = (trackId: string) => {
    if (!comparisonStats) {
      return 0;
    }
    return comparisonStats.trackAId === trackId ? comparisonStats.votesForTrackA : comparisonStats.votesForTrackB;
  };
  const audioSrc = useMemo(() => {
    if (result.audioUrl) {
      return resolveApiUrl(result.audioUrl);
    }
    return resolveApiUrl(`/analysis/${result.trackId}/audio`);
  }, [result.audioUrl, result.trackId]);
  const waveformProgress = audioDuration > 0 ? Math.min(100, (audioTime / audioDuration) * 100) : 0;
  const activeBars = Math.round((waveformProgress / 100) * WAVEFORM_HEIGHTS.length);
  const coverArt = useMemo(() => {
    if (!analysis) {
      return { svg: "", dataUrl: "" };
    }
    return makeAnalysisCoverArt({
      title: result.fileName,
      genre: analysis.genre,
      subgenre: analysis.subgenre,
      commercialScore: analysis.commercialScore,
      productionScore: analysis.productionScore,
      viralScore: analysis.viralPotential,
      confidence: analysis.confidence,
    });
  }, [analysis, result.fileName]);

  const scorecard = useMemo(() => {
    if (!analysis) {
      return { svg: "", dataUrl: "" };
    }
    return makeScorecard({
      title: result.fileName,
      genre: analysis.genre,
      subgenre: analysis.subgenre,
      commercialScore: analysis.commercialScore,
      productionScore: analysis.productionScore,
      viralScore: analysis.viralPotential,
      confidence: analysis.confidence,
    });
  }, [analysis, result.fileName]);

  if (!analysis) {
    return <div className="text-center py-20 text-gray-400">No analysis data available.</div>;
  }

  const handleShareToFeed = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (!analysisId) {
      setShareMessage("Analysis is not ready to share yet.");
      return;
    }

    setSharing(true);
    setShareMessage(null);

    const summaryLines = [
      `**${analysis.genre}${analysis.subgenre ? " / " + analysis.subgenre : ""}**`,
      `Scores: Commercial ${analysis.commercialScore.toFixed(1)} - Production ${analysis.productionScore.toFixed(1)} - Viral ${analysis.viralPotential.toFixed(1)}`,
      analysis.strengths.length > 0 ? `Top strengths: ${analysis.strengths.slice(0, 2).join(", ")}` : "",
      analysis.improvements.length > 0 ? `Focus next: ${analysis.improvements[0]}` : "",
    ].filter(Boolean);

    try {
      const mediaItems = [
        {
          type: "audio",
          url: `/api/analysis/${result.trackId}/audio`,
          label: result.fileName,
        },
      ];

      await createHighlightPost(
        {
          title: `Analysis: ${result.fileName}`,
          content: summaryLines.join("\n"),
          contentFormat: "markdown",
          analysisId,
          media: mediaItems,
        },
        token,
      );
      setShareMessage("Posted to feed.");
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : "Failed to post to feed.");
    } finally {
      setSharing(false);
    }
  };

  const shareFeedbackToFeed = async (payload: FeedbackSharePayload) => {
    if (!token) {
      router.push("/login");
      throw new Error("Login required.");
    }

    if (!analysisId) {
      throw new Error("Analysis is not ready to share yet.");
    }

    const corrections: string[] = [];

    if (payload.correctedGenre) {
      corrections.push(`Genre: ${analysis.genre} -> ${payload.correctedGenre}`);
    } else {
      corrections.push(`Genre confirmed: ${analysis.genre}`);
    }

    if (payload.correctedSubgenre) {
      corrections.push(`Subgenre: ${analysis.subgenre || "-"} -> ${payload.correctedSubgenre}`);
    } else if (analysis.subgenre) {
      corrections.push(`Subgenre confirmed: ${analysis.subgenre}`);
    }

    if (payload.correctedCommercialScore !== undefined) {
      corrections.push(`Commercial score: ${analysis.commercialScore.toFixed(1)} -> ${payload.correctedCommercialScore.toFixed(1)}`);
    }
    if (payload.correctedProductionScore !== undefined) {
      corrections.push(`Production score: ${analysis.productionScore.toFixed(1)} -> ${payload.correctedProductionScore.toFixed(1)}`);
    }
    if (payload.correctedViralPotential !== undefined) {
      corrections.push(`Viral score: ${analysis.viralPotential.toFixed(1)} -> ${payload.correctedViralPotential.toFixed(1)}`);
    }

    const lines = [
      `**AI Feedback: ${result.fileName}**`,
      `Accuracy rating: ${payload.accuracyRating}/5`,
      ...corrections,
      payload.notes ? `Notes: ${payload.notes}` : "",
    ].filter(Boolean);

    await createHighlightPost(
      {
        title: `Feedback: ${result.fileName}`,
        content: lines.join("\n"),
        contentFormat: "markdown",
        analysisId,
        media: [
          {
            type: "audio",
            url: `/api/analysis/${result.trackId}/audio`,
            label: result.fileName,
          },
        ],
      },
      token,
    );
  };

  const handleCopyLink = async () => {
    const ok = await ShareService.copyToClipboard(result.trackId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchComparison = async () => {
    const target = compareId.trim();
    if (!target) {
      setCompareError("Enter a track ID to compare.");
      setCompareMessage(null);
      return;
    }

    setCompareLoading(true);
    setCompareError(null);
    setCompareMessage(null);
    try {
      const res = await fetch(resolveApiUrl(`/analysis/${target}`));
      if (!res.ok) {
        throw new Error(`Comparison fetch failed (${res.status})`);
      }
      const json = (await res.json()) as ComparisonResult;
      setCompareResult(json);
    } catch (err) {
      setCompareResult(null);
      setCompareError(err instanceof Error ? err.message : "Failed to load comparison analysis.");
    } finally {
      setCompareLoading(false);
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) {
      return;
    }
    const clamped = Math.max(0, Math.min(seconds, audioDuration || seconds));
    audio.currentTime = clamped;
    setAudioTime(clamped);
    setCommentTime(Math.round(clamped).toString());
  };

  const handleWaveformSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioReady || audioDuration <= 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seekTo(ratio * audioDuration);
  };

  const submitWaveformComment = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    const content = commentText.trim();
    const timeValue = Number(commentTime);
    if (!content) {
      return;
    }

    try {
      const created = await addWaveformComment(
        result.trackId,
        { timeSeconds: Number.isFinite(timeValue) ? timeValue : 0, content },
        token,
      );
      setWaveformComments((prev) => [...prev, created].sort((a, b) => a.timeSeconds - b.timeSeconds));
      setCommentText("");
    } catch {
      // no-op UI errors handled via silent fail
    }
  };

  const submitRevision = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (!revisionPrevId) {
      return;
    }

    setRevisionLoading(true);
    try {
      const chain = await createTrackRevision(
        result.trackId,
        { previousTrackId: revisionPrevId, note: revisionNote.trim() || undefined },
        token,
      );
      setTimeline(chain);
      setRevisionNote("");
      setRevisionPrevId("");
    } finally {
      setRevisionLoading(false);
    }
  };

  const submitBlindVote = async (winnerTrackId: string) => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (!compareResult?.analysis) {
      return;
    }

    setVoteLoading(true);
    try {
      await submitComparisonVote(result.trackId, compareResult.trackId, winnerTrackId, token);
      const stats = await getComparisonStats(result.trackId, compareResult.trackId);
      setComparisonStats(stats);
    } finally {
      setVoteLoading(false);
    }
  };

  const shareComparisonToFeed = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (!compareResult?.analysis) {
      setCompareError("Load a comparison first.");
      setCompareMessage(null);
      return;
    }

    const deltas = {
      commercial: compareResult.analysis.commercialScore - analysis.commercialScore,
      production: compareResult.analysis.productionScore - analysis.productionScore,
      viral: compareResult.analysis.viralPotential - analysis.viralPotential,
    };

    const lines = [
      `**A/B Comparison**`,
      `A: ${result.fileName}`,
      `B: ${compareResult.fileName}`,
      `Commercial: ${analysis.commercialScore.toFixed(1)} -> ${compareResult.analysis.commercialScore.toFixed(1)} (${deltaLabel(deltas.commercial)})`,
      `Production: ${analysis.productionScore.toFixed(1)} -> ${compareResult.analysis.productionScore.toFixed(1)} (${deltaLabel(deltas.production)})`,
      `Viral: ${analysis.viralPotential.toFixed(1)} -> ${compareResult.analysis.viralPotential.toFixed(1)} (${deltaLabel(deltas.viral)})`,
    ];

    try {
      await createHighlightPost(
        {
          title: `A/B: ${result.fileName} vs ${compareResult.fileName}`,
          content: lines.join("\n"),
          contentFormat: "markdown",
          analysisId,
          media: [
            {
              type: "audio",
              url: `/api/analysis/${result.trackId}/audio`,
              label: result.fileName,
            },
            {
              type: "audio",
              url: `/api/analysis/${compareResult.trackId}/audio`,
              label: compareResult.fileName,
            },
          ],
        },
        token,
      );
      setCompareError(null);
      setCompareMessage("Comparison posted to feed.");
    } catch (err) {
      setCompareMessage(null);
      setCompareError(err instanceof Error ? err.message : "Failed to post comparison.");
    }
  };

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 mt-24 py-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold bg-linear-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent mb-1">
            Analysis Complete
          </h2>
          <p className="text-gray-500 text-sm">Powered by machine learning - {new Date(result.uploadedAt).toLocaleString()}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareToFeed}
            disabled={sharing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-200 bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 transition-all disabled:opacity-60"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sharing ? "Posting" : "Post to Feed"}
          </button>
          {/* Share dropdown */}
          <div ref={shareRef} className="relative">
            <button
              onClick={() => setShareOpen(!shareOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            {shareOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors text-left"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={() => {
                    ShareService.downloadReport(result);
                    setShareOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors text-left border-t border-white/8"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
              </div>
            )}
          </div>

          {/* Reset */}
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            New Analysis
          </button>
        </div>
        {shareMessage && (
          <div className={`text-xs text-right ${shareMessage.includes("Posted") ? "text-emerald-400" : "text-rose-400"}`}>
            {shareMessage}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-7">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex-1 min-w-0">
          <div className="w-9 h-9 bg-linear-to-br from-violet-600 to-fuchsia-600 rounded-lg flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{result.fileName}</p>
            <p className="text-xs text-gray-500 font-mono">ID: {result.trackId.substring(0, 12)}...</p>
          </div>
        </div>

        {result.status && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {result.status}
          </div>
        )}
      </div>

        <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Genre hero card */}
          <div className="rounded-2xl border border-violet-500/25 bg-linear-to-br from-violet-900/30 via-fuchsia-900/20 to-blue-900/30 p-8 backdrop-blur-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Brain className="w-12 h-12 text-violet-400 relative z-10" />
                  <div className="absolute inset-0 bg-violet-400/30 blur-xl rounded-full" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Genre Classification</p>
                  <h3 className="text-5xl font-extrabold bg-linear-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent leading-none">
                    {analysis.genre}
                  </h3>
                  <p className="text-violet-300 text-lg mt-1.5">{analysis.subgenre}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400 mb-1">Confidence</p>
                <p className="text-4xl font-bold text-white">{analysis.confidence}%</p>
              </div>
            </div>

            <AnimatedBar value={analysis.confidence} />

            {/* Decorative waveform - heights from stable pre-computed array */}
            <div className="mt-6 flex items-end gap-0.75 h-8">
              {WAVEFORM_HEIGHTS.map((h, i) => (
                <div key={i} className="flex-1 bg-violet-500/40 rounded-full" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          {/* Audio characteristics */}
          {characteristicRows.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-5">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                Audio Characteristics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {characteristicRows.map(({ key, label, value }) => (
                  <CharacteristicRow key={key} label={label} value={value} />
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Strengths
              </h3>
              <div className="space-y-2.5">
                {analysis.strengths.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-100 leading-relaxed hover:border-emerald-500/40 transition-colors"
                  >
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {analysis.improvements.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Suggested Improvements
              </h3>
              <div className="text-[11px] text-white/40 mb-3">
                Action checklist: {Object.values(improvementChecks).filter(Boolean).length} / {analysis.improvements.length} done
              </div>
              <div className="space-y-2.5">
                {analysis.improvements.map((imp, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 border-l-2 border-violet-500/60 pl-4 py-2 text-sm text-gray-300 leading-relaxed"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setImprovementChecks((prev) => ({
                          ...prev,
                          [i]: !prev[i],
                        }))
                      }
                      className={`w-6 h-6 mt-0.5 rounded-md border flex items-center justify-center shrink-0 ${
                        improvementChecks[i]
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-white/5 border-white/10 text-white/40"
                      }`}
                      aria-pressed={!!improvementChecks[i]}
                    >
                      {improvementChecks[i] ? <Check className="w-4 h-4" /> : <Zap className="w-3.5 h-3.5" />}
                    </button>
                    <span className={improvementChecks[i] ? "line-through text-white/40" : ""}>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback - only when analysisId is available from backend */}
          {analysisId && (
            <FeedbackPanel
              analysisId={analysisId}
              originalGenre={analysis.genre}
              originalSubgenre={analysis.subgenre ?? ""}
              onShareFeedback={shareFeedbackToFeed}
            />
          )}

          {/* A/B Comparison */}
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-violet-400" />
              A/B Comparison
            </h3>
            <div className="flex items-center gap-2 mb-3 text-xs text-white/50">
              <span>Blind mode</span>
              <button
                type="button"
                onClick={() => setBlindMode((prev) => !prev)}
                className={`px-2 py-1 rounded-full border ${
                  blindMode ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200" : "border-white/10 text-white/50"
                }`}
              >
                {blindMode ? "On" : "Off"}
              </button>
              {blindMode && <span className="text-[11px] text-white/40">Names and scores hidden</span>}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                placeholder="Paste another track ID"
                className="flex-1 min-w-[220px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
              <select
                value=""
                onChange={(e) => {
                  const next = e.target.value;
                  if (next) {
                    setCompareId(next);
                  }
                }}
                className="min-w-[180px] bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="" className="text-black">
                  {loadingRecent ? "Loading recent..." : "Pick recent track"}
                </option>
                {recentTracks.map((track) => (
                  <option key={track.trackId} value={track.trackId} className="text-black">
                    {track.fileName}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchComparison}
                disabled={compareLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-500/20 border border-violet-500/40 text-violet-100 hover:bg-violet-500/30 disabled:opacity-60"
              >
                {compareLoading ? "Comparing..." : "Compare"}
              </button>
            </div>
            {compareError && <p className="text-xs text-rose-400 mb-3">{compareError}</p>}
            {compareMessage && <p className="text-xs text-emerald-400 mb-3">{compareMessage}</p>}
            {compareResult?.analysis && (
              <div className="grid gap-3 md:grid-cols-2">
                {blindMode ? (
                  <>
                    <div className="rounded-xl border border-white/8 bg-white/2 p-4">
                      <div className="text-xs text-white/50 mb-1">Track A</div>
                      <audio
                        className="w-full"
                        controls
                        src={resolveApiUrl(`/analysis/${blindOrder === "ab" ? result.trackId : compareResult.trackId}/audio`)}
                      />
                      <button
                        onClick={() =>
                          submitBlindVote(blindOrder === "ab" ? result.trackId : compareResult.trackId)
                        }
                        disabled={voteLoading}
                        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
                      >
                        Vote A
                      </button>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/2 p-4">
                      <div className="text-xs text-white/50 mb-1">Track B</div>
                      <audio
                        className="w-full"
                        controls
                        src={resolveApiUrl(`/analysis/${blindOrder === "ab" ? compareResult.trackId : result.trackId}/audio`)}
                      />
                      <button
                        onClick={() =>
                          submitBlindVote(blindOrder === "ab" ? compareResult.trackId : result.trackId)
                        }
                        disabled={voteLoading}
                        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
                      >
                        Vote B
                      </button>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/2 p-4">
                      <div className="text-xs text-white/50 mb-2">Blind vote stats</div>
                      <div className="flex items-center gap-4 text-xs text-white/60">
                        <span>
                          Votes A:{" "}
                          {votesForTrack(blindOrder === "ab" ? result.trackId : compareResult.trackId)}
                        </span>
                        <span>
                          Votes B:{" "}
                          {votesForTrack(blindOrder === "ab" ? compareResult.trackId : result.trackId)}
                        </span>
                        <span>Total: {comparisonStats?.totalVotes ?? 0}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-white/8 bg-white/2 p-4">
                      <div className="text-xs text-white/50 mb-1">A - Current</div>
                      <div className="text-sm font-semibold text-white truncate">{result.fileName}</div>
                      <div className="text-xs text-white/40">{analysis.genre} / {analysis.subgenre}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-white font-semibold">{analysis.commercialScore.toFixed(1)}</div>
                          <div className="text-white/40">Commercial</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-white font-semibold">{analysis.productionScore.toFixed(1)}</div>
                          <div className="text-white/40">Production</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-white font-semibold">{analysis.viralPotential.toFixed(1)}</div>
                          <div className="text-white/40">Viral</div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                      <div className="text-xs text-violet-200/80 mb-1">B - Comparison</div>
                      <div className="text-sm font-semibold text-white truncate">{compareResult.fileName}</div>
                      <div className="text-xs text-white/40">
                        {compareResult.analysis.genre} / {compareResult.analysis.subgenre}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-white font-semibold">{compareResult.analysis.commercialScore.toFixed(1)}</div>
                          <div className="text-white/40">Commercial</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-white font-semibold">{compareResult.analysis.productionScore.toFixed(1)}</div>
                          <div className="text-white/40">Production</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <div className="text-white font-semibold">{compareResult.analysis.viralPotential.toFixed(1)}</div>
                          <div className="text-white/40">Viral</div>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/2 p-4">
                      <div className="text-xs text-white/50 mb-3">Score Delta (B - A)</div>
                      {[
                        { label: "Commercial", delta: compareResult.analysis.commercialScore - analysis.commercialScore },
                        { label: "Production", delta: compareResult.analysis.productionScore - analysis.productionScore },
                        { label: "Viral", delta: compareResult.analysis.viralPotential - analysis.viralPotential },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 text-xs mb-2">
                          <div className="w-24 text-white/60">{item.label}</div>
                          <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${item.delta >= 0 ? "bg-emerald-400/60" : "bg-rose-400/60"}`}
                              style={{ width: `${Math.min(100, Math.abs(item.delta) * 10)}%` }}
                            />
                          </div>
                          <div className={`w-14 text-right font-semibold ${deltaTone(item.delta)}`}>{deltaLabel(item.delta)}</div>
                        </div>
                      ))}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={shareComparisonToFeed}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/30"
                        >
                          Share Comparison
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Waveform Comments */}
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              Waveform Comments
            </h3>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
              <div className="flex items-center justify-between text-[11px] text-white/50 mb-3">
                <span>Waveform timeline</span>
                <span>
                  {formatTimestamp(audioTime)} / {formatTimestamp(audioDuration)}
                </span>
              </div>
              <audio ref={audioRef} className="w-full" controls src={audioSrc} />
              <div className="mt-3">
                <div
                  onClick={handleWaveformSeek}
                  className="relative h-16 rounded-xl border border-white/10 bg-white/5 overflow-hidden cursor-pointer"
                >
                  <div className="absolute inset-0 flex items-end gap-1 px-2">
                    {WAVEFORM_HEIGHTS.map((height, idx) => (
                      <div
                        key={`bar-${idx}`}
                        className={`flex-1 rounded-full transition-colors ${
                          idx < activeBars ? "bg-violet-400/80" : "bg-white/15"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-fuchsia-300/80"
                    style={{ left: `${waveformProgress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                  <span>{audioReady ? (audioPlaying ? "Playing" : "Click waveform to seek") : "Audio loading..."}</span>
                  <button
                    type="button"
                    onClick={() => seekTo(audioTime)}
                    className="text-violet-200 hover:text-white"
                  >
                    Use current time
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                value={commentTime}
                onChange={(e) => setCommentTime(e.target.value)}
                placeholder="Time (sec)"
                className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
              />
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a time-stamped note..."
                className="flex-1 min-w-[220px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={submitWaveformComment}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-violet-500/20 border border-violet-500/40 text-violet-100 hover:bg-violet-500/30"
              >
                Add Comment
              </button>
            </div>
            {commentLoading ? (
              <div className="text-xs text-white/40">Loading comments...</div>
            ) : waveformComments.length === 0 ? (
              <div className="text-xs text-white/40">No comments yet.</div>
            ) : (
              <div className="space-y-2">
                {waveformComments.map((comment) => (
                  <button
                    key={comment.id}
                    type="button"
                    onClick={() => seekTo(comment.timeSeconds)}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/70 hover:border-violet-500/40 hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                      <span>{comment.authorUserName}</span>
                      <span>{formatTimestamp(comment.timeSeconds)}</span>
                    </div>
                    <div>{comment.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Revision Timeline */}
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-violet-400" />
              Revision Timeline
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={revisionPrevId}
                onChange={(e) => setRevisionPrevId(e.target.value)}
                className="flex-1 min-w-[220px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="" className="text-black">
                  Link to previous track
                </option>
                {recentTracks.map((track) => (
                  <option key={track.trackId} value={track.trackId} className="text-black">
                    {track.fileName}
                  </option>
                ))}
              </select>
              <input
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Revision note"
                className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={submitRevision}
                disabled={revisionLoading}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60"
              >
                {revisionLoading ? "Saving..." : "Link Revision"}
              </button>
            </div>
            {timeline.length === 0 ? (
              <div className="text-xs text-white/40">No revisions linked yet.</div>
            ) : (
              <ol className="space-y-2 text-xs text-white/70">
                {timeline.map((rev, idx) => (
                  <li key={rev.trackId} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                      <span>Version {idx + 1}</span>
                      <span>{new Date(rev.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="font-semibold text-white">{rev.trackName}</div>
                    <div className="text-white/50">
                      {rev.genre ? `${rev.genre}${rev.subgenre ? ` / ${rev.subgenre}` : ""}` : "Analysis pending"}
                    </div>
                    {rev.note && <div className="text-white/60 mt-1">Note: {rev.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Analysis Cover Art</h3>
              <span className="text-[10px] text-white/40">Generated</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-white/10">
              <NextImage
                src={coverArt.dataUrl}
                alt="Analysis cover art"
                width={1200}
                height={1200}
                unoptimized
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => downloadSvg(coverArt.svg, `musicle-${result.trackId}-cover.svg`)}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              >
                Download Cover SVG
              </button>
              <button
                onClick={() => downloadSvg(scorecard.svg, `musicle-${result.trackId}-scorecard.svg`)}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-violet-500/20 border border-violet-500/40 text-violet-100 hover:bg-violet-500/30"
              >
                Download Scorecard
              </button>
            </div>
          </div>
          {/* Score rings */}
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Award className="w-4 h-4 text-yellow-400" />
              Scores
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <ScoreRing score={analysis.commercialScore} label="Commercial" />
              <ScoreRing score={analysis.productionScore} label="Production" />
              <ScoreRing score={analysis.viralPotential} label="Viral" />
            </div>
          </div>

          {/* Overall score */}
          <div className="rounded-2xl border border-violet-500/30 bg-linear-to-br from-violet-600/15 to-fuchsia-600/15 p-6 text-center shadow-lg shadow-violet-500/10">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Overall Score</p>
            <p className="text-7xl font-extrabold bg-linear-to-b from-white to-violet-300 bg-clip-text text-transparent leading-none mb-1">
              {overallScore.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">out of 10</p>
            <div className="mt-4">
              <AnimatedBar value={overallScore * 10} />
            </div>
          </div>

          {/* Score breakdown */}
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: <Award className="w-4 h-4" />, label: "Commercial", score: analysis.commercialScore, sub: "Mainstream Appeal" },
              { icon: <Mic2 className="w-4 h-4" />, label: "Production", score: analysis.productionScore, sub: "Mix & Mastering" },
              { icon: <TrendingUp className="w-4 h-4" />, label: "Viral", score: analysis.viralPotential, sub: "Social Media Ready" },
            ].map(({ icon, label, score, sub }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/2 px-4 py-3 hover:border-violet-500/30 hover:bg-white/5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-400 shrink-0 group-hover:bg-violet-500/25 transition-colors">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-[10px] text-gray-600">{sub}</p>
                </div>
                <span className="text-lg font-bold text-white">{score.toFixed(1)}</span>
              </div>
            ))}
          </div>

          {/* Metadata */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Details</h3>
            {[
              {
                icon: <Clock className="w-3 h-3" />,
                label: "Analyzed",
                value: new Date(analysis.analyzedAt ?? result.uploadedAt).toLocaleString(),
              },
              {
                icon: <Activity className="w-3 h-3" />,
                label: "Track ID",
                value: `${result.trackId.substring(0, 12)}...`,
              },
              {
                icon: <Brain className="w-3 h-3" />,
                label: "Analysis ID",
                value: analysisId ? `${analysisId.substring(0, 12)}...` : "-",
              },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-gray-600">{icon}</span>
                <span className="text-gray-600">{label}:</span>
                <span className="font-mono truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};











