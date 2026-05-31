"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
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
} from "lucide-react";
import { GenreProbabilityBars } from "@/components/GenreProbabilityBars";
import { resolveApiUrl } from "@/lib/api-url";

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
    characteristics: {
      tempo: number;
      energy: number;
      danceability: number;
      valence: number;
      acousticness: number;
      loudness: number;
      speechiness: number;
      instrumentalness: number;
      spectralCentroid: number;
    };
    strengths: string[];
    improvements: string[];
    genreProbabilities?: Record<string, number>;
    analyzedAt: string;
  };
}

export default function AnalysisPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const logs: string[] = [];

    const fetchData = async () => {
      try {
        // Method 1: Direct params access
        logs.push(`Method 1 - params: ${JSON.stringify(params)}`);
        logs.push(`Method 1 - params.trackId: ${params?.id}`);

        // Method 2: Pathname parsing
        logs.push(`Method 2 - pathname: ${pathname}`);
        const pathSegments = pathname?.split("/") || [];
        logs.push(`Method 2 - path segments: ${JSON.stringify(pathSegments)}`);
        const idFromPath = pathSegments[pathSegments.length - 1];
        logs.push(`Method 2 - ID from path: ${idFromPath}`);

        // Method 3: Window location
        if (typeof window !== "undefined") {
          logs.push(`Method 3 - window.location.pathname: ${window.location.pathname}`);
          const urlSegments = window.location.pathname.split("/");
          const idFromUrl = urlSegments[urlSegments.length - 1];
          logs.push(`Method 3 - ID from URL: ${idFromUrl}`);
        }

        // Method 4: Await params (Next.js 15+)
        const resolvedParams = await Promise.resolve(params);
        logs.push(`Method 4 - resolved params: ${JSON.stringify(resolvedParams)}`);
        logs.push(`Method 4 - resolved trackId: ${resolvedParams?.id}`);

        setDebugInfo([...logs]);

        // Try all methods to get trackId
        let trackId = (params as { id?: string })?.id as string;

        if (!trackId && pathname) {
          trackId = pathname.split("/").pop() || "";
          logs.push(`Using pathname method: ${trackId}`);
        }

        if (!trackId && typeof window !== "undefined") {
          trackId = window.location.pathname.split("/").pop() || "";
          logs.push(`Using window.location method: ${trackId}`);
        }

        if (!trackId && resolvedParams?.id) {
          trackId = resolvedParams?.id as string;
          logs.push(`Using resolved params method: ${trackId}`);
        }

        logs.push(`Final trackId: ${trackId}`);
        setDebugInfo([...logs]);

        if (!trackId || trackId === "analysis") {
          setError("No valid track ID found");
          setLoading(false);
          return;
        }

        const url = resolveApiUrl(`/analysis/${trackId}`);
        logs.push(`Fetching from: ${url}`);
        setDebugInfo([...logs]);

        const res = await fetch(url);
        logs.push(`Response status: ${res.status}`);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const audioCandidate = json.audioUrl ?? `/analysis/${trackId}/audio`;
        json.audioUrl = resolveApiUrl(audioCandidate);
        logs.push(`Data received successfully`);
        setDebugInfo([...logs]);
        setData(json);
      } catch (err) {
        logs.push(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
        setDebugInfo([...logs]);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params, pathname]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;

  const getColor = (score: number): string => {
    if (score >= 8) return "emerald";
    if (score >= 6) return "amber";
    return "rose";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Loading...</p>
          {debugInfo.length > 0 && (
            <div className="bg-black/50 rounded-lg p-4 text-left">
              <div className="text-xs text-gray-500 space-y-1">
                {debugInfo.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>

          {debugInfo.length > 0 && (
            <div className="bg-black/50 rounded-lg p-4 text-left mb-6">
              <div className="text-xs font-bold text-gray-400 mb-2">Debug Info:</div>
              <div className="text-xs text-gray-500 space-y-1">
                {debugInfo.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => router.push("/")} className="bg-purple-500 px-6 py-3 rounded-xl">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (data.status !== "Completed" || !data.analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Processing...</h2>
          <p className="text-gray-400">Status: {data.status}</p>
        </div>
      </div>
    );
  }

  const a = data.analysis;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0a15] to-[#0a0a0a] text-white p-8">
      <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="max-w-7xl mx-auto">
        <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Music className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{data.fileName}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                {new Date(data.uploadedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {data.audioUrl && (
              <div className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl p-6">
                <audio ref={audioRef} src={data.audioUrl} />
                <div className="mb-4">
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
                    className="w-full h-2 bg-gray-700 rounded-lg"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center mx-auto"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
            )}

            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-4">
                <Brain className="w-12 h-12 text-purple-400" />
                <div>
                  <div className="text-sm text-gray-400">Genre</div>
                  <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {a.genre}
                  </div>
                  <div className="text-lg text-purple-300">{a.subgenre}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-gray-400">Confidence</div>
                  <div className="text-3xl font-bold">{a.confidence}%</div>
                </div>
              </div>
            </div>

            {a.genreProbabilities && Object.keys(a.genreProbabilities).length > 1 && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-6">
                <h3 className="font-bold mb-4 text-sm text-gray-400 flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  GENRE PROBABILITY DISTRIBUTION
                </h3>
                <GenreProbabilityBars
                  probabilities={a.genreProbabilities}
                  predictedGenre={a.genre}
                />
              </div>
            )}

            <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-8">
              <h3 className="font-bold mb-6 text-sm text-gray-400 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                CHARACTERISTICS
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Tempo", value: a.characteristics.tempo.toFixed(0), unit: "BPM" },
                  { label: "Energy", value: (a.characteristics.energy * 100).toFixed(0), unit: "%" },
                  { label: "Dance", value: (a.characteristics.danceability * 100).toFixed(0), unit: "%" },
                  { label: "Valence", value: (a.characteristics.valence * 100).toFixed(0), unit: "%" },
                  { label: "Acoustic", value: (a.characteristics.acousticness * 100).toFixed(0), unit: "%" },
                  { label: "Loudness", value: a.characteristics.loudness.toFixed(0), unit: "dB" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="text-2xl font-bold text-purple-400">{item.value}</div>
                    <div className="text-xs text-gray-500">{item.unit}</div>
                  </div>
                ))}
              </div>
            </div>

            {a.strengths?.length > 0 && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-6">
                <h3 className="font-bold mb-4 text-sm text-gray-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  STRENGTHS
                </h3>
                <div className="space-y-3">
                  {a.strengths.map((s, i) => (
                    <div key={i} className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-100">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {a.improvements?.length > 0 && (
              <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-6">
                <h3 className="font-bold mb-4 text-sm text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  IMPROVEMENTS
                </h3>
                <div className="space-y-3">
                  {a.improvements.map((imp, i) => (
                    <div key={i} className="border-l-2 border-purple-500 pl-4 py-3 text-sm text-gray-300 bg-white/5">
                      {imp}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {[
              { icon: Award, label: "Commercial", score: a.commercialScore },
              { icon: Mic2, label: "Production", score: a.productionScore },
              { icon: TrendingUp, label: "Viral", score: a.viralPotential },
            ].map((item, i) => {
              const color = getColor(item.score);
              return (
                <div key={i} className={`bg-${color}-900/40 border border-${color}-500/40 p-6 rounded-2xl`}>
                  <div className="flex items-center gap-3 mb-2">
                    <item.icon className="w-5 h-5" />
                    <div className="text-xs font-semibold">{item.label}</div>
                  </div>
                  <div className={`text-5xl font-bold text-${color}-400`}>{item.score}/10</div>
                </div>
              );
            })}

            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-purple-500/30">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-2">OVERALL</div>
                <div className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {((a.commercialScore + a.productionScore + a.viralPotential) / 3).toFixed(1)}
                </div>
                <div className="text-xs text-gray-400">Out of 10</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



