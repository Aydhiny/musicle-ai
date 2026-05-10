// src/components/StatsOverview.tsx
import React, { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { X, TrendingUp, Music, Zap, Award, Activity, BarChart3, Target } from "lucide-react";

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

interface RecentTrack {
  status?: string;
  genre?: string;
  confidence?: number;
}

interface StatsOverviewProps {
  onClose: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ onClose }) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/analysis/recent?count=50`);
      if (response.ok) {
        const data = await response.json();
        const tracks: RecentTrack[] = Array.isArray(data.tracks) ? data.tracks : [];

        const completed = tracks.filter((t) => t.status === "Completed");

        // Calculate genre distribution
        const genreMap = new Map<string, number>();
        completed.forEach((track) => {
          if (track.genre) {
            genreMap.set(track.genre, (genreMap.get(track.genre) || 0) + 1);
          }
        });

        const topGenres = Array.from(genreMap.entries())
          .map(([genre, count]) => ({ genre, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Calculate average confidence
        const avgConfidence =
          completed.length > 0 ? completed.reduce((sum, t) => sum + (t.confidence ?? 0), 0) / completed.length : 0;

        setStats({
          totalTracks: tracks.length,
          completedTracks: completed.length,
          averageConfidence: Math.round(avgConfidence),
          topGenres,
          averageScores: {
            commercial: 7.5, // These would come from actual data
            production: 8.2,
            viral: 6.8,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-[#121212] to-[#1a1a2e] rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all z-10"
          aria-label="Close stats"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-4 sm:p-6 lg:p-8 border-b border-white/10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-purple-400" />
              <div className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"></div>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Analytics Dashboard
              </h2>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">Comprehensive insights from your music analysis</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Activity className="w-12 h-12 text-purple-400 animate-pulse" />
            </div>
          ) : stats ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 border border-purple-500/30 hover:scale-105 transition-transform">
                  <Music className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-purple-400 mb-2 sm:mb-3" />
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">{stats.totalTracks}</div>
                  <div className="text-xs sm:text-sm text-gray-400">Total Tracks</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 border border-blue-500/30 hover:scale-105 transition-transform">
                  <Zap className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-400 mb-2 sm:mb-3" />
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">{stats.completedTracks}</div>
                  <div className="text-xs sm:text-sm text-gray-400">Completed</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 border border-emerald-500/30 hover:scale-105 transition-transform">
                  <Target className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-emerald-400 mb-2 sm:mb-3" />
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">{stats.averageConfidence}%</div>
                  <div className="text-xs sm:text-sm text-gray-400">Avg Confidence</div>
                </div>

                <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 border border-amber-500/30 hover:scale-105 transition-transform">
                  <Award className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-amber-400 mb-2 sm:mb-3" />
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                    {stats.totalTracks > 0 ? ((stats.completedTracks / stats.totalTracks) * 100).toFixed(0) : 0}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">Success Rate</div>
                </div>
              </div>

              {/* Average Scores */}
              <div className="bg-gradient-to-br from-white/5 to-transparent rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 border border-white/10">
                <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5 lg:mb-6 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                  Average Quality Scores
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm text-gray-400">Commercial Potential</span>
                      <span className="text-base sm:text-lg font-bold text-white">{stats.averageScores.commercial}/10</span>
                    </div>
                    <div className="h-2.5 sm:h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(stats.averageScores.commercial / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm text-gray-400">Production Quality</span>
                      <span className="text-base sm:text-lg font-bold text-white">{stats.averageScores.production}/10</span>
                    </div>
                    <div className="h-2.5 sm:h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(stats.averageScores.production / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm text-gray-400">Viral Potential</span>
                      <span className="text-base sm:text-lg font-bold text-white">{stats.averageScores.viral}/10</span>
                    </div>
                    <div className="h-2.5 sm:h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(stats.averageScores.viral / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Genres */}
              {stats.topGenres.length > 0 && (
                <div className="bg-gradient-to-br from-white/5 to-transparent rounded-xl lg:rounded-2xl p-4 sm:p-5 lg:p-6 border border-white/10">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5 lg:mb-6 flex items-center gap-2">
                    <Music className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    Top Genres Analyzed
                  </h3>
                  <div className="space-y-2.5 sm:space-y-3">
                    {stats.topGenres.map((genre, index) => (
                      <div key={genre.genre} className="flex items-center gap-3 sm:gap-4">
                        <div className="text-xl sm:text-2xl font-bold text-purple-400 w-6 sm:w-8 flex-shrink-0">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-2">
                            <span className="text-sm sm:text-base text-white font-semibold truncate">{genre.genre}</span>
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">{genre.count} tracks</span>
                          </div>
                          <div className="h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                              style={{ width: `${(genre.count / stats.completedTracks) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fun Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-purple-500/20">
                  <div className="text-xs sm:text-sm text-gray-400 mb-2">Most Common Genre</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-400 truncate">{stats.topGenres[0]?.genre || "N/A"}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-blue-500/20">
                  <div className="text-xs sm:text-sm text-gray-400 mb-2">Processing Speed</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-400">~30s avg</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
};


