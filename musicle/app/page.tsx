"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Loader2,
  X,
  History,
  TrendingUp,
  Info,
} from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight-new";
import { Cover } from "@/components/ui/cover";
import { FeaturesSectionDemo } from "@/components/FeaturesSectionDemo";
import MusicleFeedSection from "@/components/MusicleFeedSection";
import { ResultsSection } from "@/components/ResultsSection";
import { motion } from "framer-motion";
import GradientText from "@/components/GradientText";
import Link from "next/link";
import { IconMusicStar } from "@tabler/icons-react";
import { resolveApiUrl } from "@/lib/api-url";

// --- Interfaces ---
interface AudioCharacteristics {
  tempo: number;
  key: string;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  loudness: number;
}

interface Analysis {
  genre: string;
  subgenre: string;
  analysisId?: string;
  confidence: number;
  commercialScore: number;
  productionScore: number;
  viralPotential: number;
  characteristics: AudioCharacteristics;
  strengths?: string[];
  improvements?: string[];
}

interface AnalysisResult {
  trackId: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  audioUrl?: string;
  analysis?: Analysis;
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

interface StatsData {
  totalTracks: number;
  completedTracks: number;
  averageConfidence: number;
  topGenres: { genre: string; count: number }[];
  averageScores: {
    commercial: number;
    production: number;
    viral: number;
  };
}

interface Track {
  status: string;
  genre?: string;
  confidence?: number;
}

export default function HomePage() {
  // --- State Management ---
  const [step, setStep] = useState<"upload" | "results">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const apiUrl = useCallback((path: string) => resolveApiUrl(path), []);

  const fetchRecentTracks = useCallback(async () => {
    setLoadingTracks(true);
    try {
      const response = await fetch(apiUrl("/api/analysis/recent?count=20"));
      if (response.ok) {
        const data = await response.json();
        setRecentTracks(data.tracks || []);
      }
    } catch (error) {
      console.error("Failed to fetch recent tracks:", error);
    } finally {
      setLoadingTracks(false);
    }
  }, [apiUrl]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await fetch(apiUrl("/api/analysis/recent?count=50"));
      if (response.ok) {
        const data = await response.json();
        const tracks = data.tracks || [];
        const completed = tracks.filter((t: Track) => t.status === "Completed");

        const genreMap = new Map<string, number>();
        completed.forEach((track: Track) => {
          if (track.genre) {
            genreMap.set(track.genre, (genreMap.get(track.genre) || 0) + 1);
          }
        });

        const topGenres = Array.from(genreMap.entries())
          .map(([genre, count]) => ({ genre, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const avgConfidence =
          completed.length > 0 ? completed.reduce((sum: number, t: Track) => sum + (t.confidence || 0), 0) / completed.length : 0;

        setStats({
          totalTracks: tracks.length,
          completedTracks: completed.length,
          averageConfidence: Math.round(avgConfidence),
          topGenres,
          averageScores: {
            commercial: 7.5,
            production: 8.2,
            viral: 6.8,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (showSidebar) {
      fetchRecentTracks();
      const interval = setInterval(fetchRecentTracks, 10000);
      return () => clearInterval(interval);
    }
  }, [showSidebar, fetchRecentTracks]);

  useEffect(() => {
    if (showStats) fetchStats();
  }, [showStats, fetchStats]);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File too large. Maximum size is 50MB");
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const trackId = response.trackId;
          const pollInterval = setInterval(async () => {
            try {
              const statusResponse = await fetch(apiUrl(`/api/analysis/${trackId}`));
              if (statusResponse.ok) {
                const result = await statusResponse.json();
                if (result.status === "Completed") {
                  clearInterval(pollInterval);
                  setAnalysisResult(result);
                  setIsUploading(false);
                  setStep("results");
                } else if (result.status === "Failed") {
                  clearInterval(pollInterval);
                  setError("Analysis failed. Please try again.");
                  setIsUploading(false);
                }
              }
            } catch (error) {
              console.error("Polling error:", error);
            }
          }, 2000);
        } else {
          setError("Upload failed. Please try again.");
          setIsUploading(false);
        }
      });

      xhr.addEventListener("error", () => {
        setError("Upload failed. Please try again.");
        setIsUploading(false);
      });

      xhr.open("POST", apiUrl("/api/analysis/upload"));
      xhr.send(formData);
    } catch (error) {
      console.error("Upload error:", error);
      setError("Upload failed. Please try again.");
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setAnalysisResult(null);
    setProgress(0);
    setError(null);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Processing":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Queued":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <>
      {/* --- Main Content --- */}
      {step === "upload" ? (
        <div className="relative z-10 flex flex-col items-center justify-center pt-8 sm:pt-12 lg:pt-16 pb-24 sm:pb-32 px-4 sm:px-6 min-h-[calc(100vh-120px)] md:min-h-[85vh]">
          {/* Hero Typography */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-16 relative w-full max-w-4xl mx-auto">
            {/* Rotating Badge with Icons */}
            <div className="mb-6 sm:mb-8 inline-flex">
              <Spotlight />
              <button className="bg-slate-800 no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6  text-white inline-block">
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                </span>
                <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10 ">
                  <IconMusicStar className="w-4 h-auto" />
                  <span>{`Advanced Music Analysis`}</span>
                </div>
                <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6 justify-center text-center items-center">
              <h1 className="text-3xl justify-center text-center items-center sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                <GradientText colors={["#ffffff", "#d69cff", "#ff9cff"]} animationSpeed={25} showBorder={false} className="custom-class">
                  Upload Your Track
                </GradientText>
                <br />
                <div className="flex items-center rotate-[0.5deg] justify-center mx-auto w-fit">
                  <Cover>
                    <span className="inline-block bg-linear-to-t text-center items-center justify-center from-[#6d6d6d] via-[#ffffff] to-[#ffffff] bg-clip-text text-transparent">
                      Improve Your Mix Today
                    </span>
                  </Cover>
                </div>
              </h1>

              <div className="space-y-3">
                <p className="text-sm text-neutral-400 max-w-2xl py-4 mx-auto leading-relaxed">
                  Get instant feedback on audio characteristics, commercial potential, production quality, and actionable recommendations to
                  elevate your sound.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/sketchbook"
                    className="px-8 py-2 rounded-sm relative backdrop-blur-md bg-gradient-to-r from-neutral-950 via-neutral-900 text-white text-sm hover:shadow-2xl hover:shadow-white/[0.1] transition duration-200 border border-neutral-800"
                  >
                    <div className="absolute inset-x-0 h-px w-1/2 mx-auto -top-px shadow-2xl bg-gradient-to-r from-transparent via-pink-500 to-transparent" />
                    <span className="relative z-20">Musical Sketchbook</span>
                  </Link>
                  <motion.button
                    whileHover={{
                      scale: 1.06,
                      y: -2,
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="
                      relative px-8 py-2 cursor-pointer rounded-sm text-white
                      bg-gradient-to-b text-xs from-pink-400 via-pink-500 to-pink-600
                      border border-pink-300/40
                      shadow-lg shadow-pink-500/30
                      overflow-hidden
                    "
                  >
                    Pricing
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Container */}
          <div className="relative w-full max-w-2xl lg:max-w-4xl mx-auto px-0">
            {/*             <GlowingEffect
              className="rounded-xl"
              blur={0}
              borderWidth={1}
              spread={150}
              glow={true}
              disabled={false}
              proximity={1000}
              inactiveZone={0.01}
            /> */}
            {/* Upload Area */}
            <div
              className="relative bg-[#11111134] backdrop-blur-xl border border-dashed border-gray-300/50 rounded-lg sm:rounded-xl lg:rounded-2xl h-56 sm:h-64 md:h-72 lg:h-80 w-full flex flex-col items-center justify-center cursor-pointer hover:border-[#BCAAF9]/50 hover:bg-[#161616] transition-all group overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file);
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload audio file"
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                aria-label="File input"
              />

              {isUploading ? (
                <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-sm px-4 sm:px-8">
                  <div className="relative">
                    <Loader2 className="w-10 sm:w-12 h-10 sm:h-12 text-[#BCAAF9] animate-spin" />
                  </div>
                  <div className="w-full space-y-2 sm:space-y-3 text-center">
                    <p className="text-base sm:text-lg font-medium">Analyzing Track</p>
                    <div className="h-1 sm:h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#f0aaf9] transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 font-mono">{Math.round(progress)}%</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-full border border-neutral-600 shadow-lg shadow-purple-400/30 border-b-pink-400 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-4 sm:w-5 h-4 sm:h-5 text-[#f0aaf9]" />
                  </div>
                  <div className="text-center space-y-1 sm:space-y-2 px-4">
                    <p className="text-sm sm:text-base md:text-lg text-gray-200 font-medium">
                      Drag and Drop file here or <span className="text-[#f9aae1] font-semibold">Choose file</span>
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">Supported formats: MP3, WAV, OGG, AVI</p>
                  </div>
                </>
              )}

              {/* Error Toast */}
              {error && (
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 bg-red-500/10 border border-red-500/20 text-red-400 px-3 sm:px-4 py-2 rounded text-xs sm:text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mx-auto w-full max-w-6xl">
            <MusicleFeedSection />
          </div>
        </div>
      ) : (
        analysisResult && <ResultsSection result={analysisResult} onReset={handleReset} />
      )}

      {/* --- Stats Modal --- */}
      {showStats && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121212] w-full max-w-2xl lg:max-w-4xl rounded-lg sm:rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowStats(false)}
              className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
              aria-label="Close stats"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-4 sm:p-6 lg:p-8 border-b border-white/10 bg-linear-to-r from-[#1a1a1a] to-transparent">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                <TrendingUp className="w-5 sm:w-6 h-5 sm:h-6 text-[#BCAAF9] shrink-0" /> Analytics Dashboard
              </h2>
            </div>

            <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
              {loadingStats ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#BCAAF9]" />
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white/5 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-white/5">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.totalTracks}</div>
                    <div className="text-xs text-gray-500 uppercase font-medium">Total Tracks</div>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-white/5">
                    <div className="text-2xl sm:text-3xl font-bold text-[#BCAAF9] mb-1">{stats.completedTracks}</div>
                    <div className="text-xs text-gray-500 uppercase font-medium">Completed</div>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-white/5">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.averageConfidence}%</div>
                    <div className="text-xs text-gray-500 uppercase font-medium">Avg. Confidence</div>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-white/5">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {stats.totalTracks > 0 ? ((stats.completedTracks / stats.totalTracks) * 100).toFixed(0) : 0}%
                    </div>
                    <div className="text-xs text-gray-500 uppercase font-medium">Success Rate</div>
                  </div>

                  {stats.topGenres.length > 0 && (
                    <div className="col-span-full mt-4 sm:mt-6">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-400 mb-3 sm:mb-4 uppercase">Top Genres</h3>
                      <div className="space-y-2 sm:space-y-3">
                        {stats.topGenres.map((g, i) => (
                          <div key={i} className="flex items-center gap-3 sm:gap-4">
                            <div className="w-14 sm:w-16 text-xs sm:text-sm text-gray-400 truncate">{g.genre}</div>
                            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-linear-to-r from-[#BCAAF9] to-[#9f85f6]"
                                style={{ width: `${(g.count / stats.completedTracks) * 100}%` }}
                              />
                            </div>
                            <div className="text-xs sm:text-sm font-bold w-6 text-right">{g.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8 text-sm">No stats available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Recent Sidebar --- */}
      <div
        className="fixed top-0 right-0 h-full w-80 sm:w-96 max-w-[calc(100vw-20px)] bg-[#111] border-l border-white/10 z-50 transform transition-transform duration-300 shadow-2xl overflow-hidden"
        style={{ transform: showSidebar ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-[#BCAAF9] shrink-0" /> Recent Tracks
          </h2>
          <button
            onClick={() => setShowSidebar(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 sm:p-4 overflow-y-auto h-[calc(100%-80px)] space-y-2 sm:space-y-3">
          {loadingTracks ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : recentTracks.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">No recent tracks found.</div>
          ) : (
            recentTracks.map((track) => (
              <div
                key={track.trackId}
                className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-lg sm:rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                  <div className="font-medium text-xs sm:text-sm truncate flex-1 group-hover:text-[#BCAAF9] transition-colors">
                    {track.fileName}
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0 whitespace-nowrap">{formatTimeAgo(track.uploadedAt)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(track.status)}`}>{track.status}</span>
                  {track.genre && <span className="text-[10px] text-gray-400 truncate">{track.genre}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-[#171717] w-fit mx-auto shadow-2xl p-12 border-t border-neutral-700">
        <h1 className="text-3xl justify-center text-center items-center sm:text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-neutral-100 via-neutral-300 to-neutral-600">
          Features
        </h1>
        <p className="mt-6 text-center text-sm md:text-base text-neutral-500 max-w-xl mx-auto leading-relaxed">
          Musicle listens deeper than humans. Analyze balance, clarity, dynamics, and mix decisions using AI trained on real-world music
          standards. No guessing. Just precision.
        </p>
        <FeaturesSectionDemo />
      </div>

      {/* Waitlist Section */}
      <div className="m-24">
        <div className="relative h-160 border-t border-neutral-700 shadow-2xl w-full overflow-hidden rounded-sm bg-[#171717] flex items-center justify-center">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_50%)]" />

          <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-neutral-100 via-neutral-300 to-neutral-600">
              Join the Waitlist
            </h1>

            <p className="mt-4 text-lg md:text-xl text-neutral-400">AI-powered music mix & analysis</p>

            <p className="mt-6 text-sm md:text-base text-neutral-500 max-w-xl mx-auto leading-relaxed">
              Musicle listens deeper than humans. Analyze balance, clarity, dynamics, and mix decisions using AI trained on real-world music
              standards. No guessing. Just precision.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <input
                type="email"
                placeholder="you@studio.com"
                className="w-full sm:w-80 rounded-lg border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500/60"
              />

              <button className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition-colors">
                Join the waitlist
              </button>
            </div>

            <p className="mt-4 text-xs text-neutral-600">Early access. No spam. Just signal.</p>
          </div>
        </div>
      </div>
    </>
  );
}


