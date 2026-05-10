// src/components/RecentTracksSidebar.tsx
import React, { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { ChevronRight, ChevronLeft, Music, Clock, Loader2, RefreshCw } from "lucide-react";

interface RecentTrack {
  trackId: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  genre?: string;
  subgenre?: string;
  confidence?: number;
}

interface RecentTracksSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const RecentTracksSidebar: React.FC<RecentTracksSidebarProps> = ({ isOpen, onToggle }) => {
  const [tracks, setTracks] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  const fetchRecentTracks = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/analysis/recent?count=20`);
      if (response.ok) {
        const data = await response.json();
        setTracks(data.tracks || []);
      }
    } catch (error) {
      console.error("Failed to fetch recent tracks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecentTracks();
      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchRecentTracks, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[400px] lg:w-[420px] bg-gradient-to-br from-[#121212] to-[#1a1a2e] border-l border-white/10 backdrop-blur-xl transform transition-transform duration-500 z-50 shadow-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Music className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                  <div className="absolute inset-0 bg-purple-400/20 blur-md rounded-full"></div>
                </div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Recent Tracks
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchRecentTracks}
                  className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all"
                  disabled={loading}
                  aria-label="Refresh tracks"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={onToggle}
                  className="sm:hidden text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all"
                  aria-label="Close sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">Auto-refreshing every 10s</p>
          </div>

          {/* Tracks List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            {loading && tracks.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Music className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mb-3 sm:mb-4" />
                <p className="text-gray-400 text-sm">No tracks analyzed yet</p>
                <p className="text-gray-600 text-xs mt-2">Upload a track to get started</p>
              </div>
            ) : (
              tracks.map((track, index) => (
                <div
                  key={track.trackId}
                  className={`bg-gradient-to-br from-white/5 to-transparent rounded-xl p-3 sm:p-4 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group ${
                    selectedTrack === track.trackId ? "border-purple-500 bg-purple-500/10" : ""
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => setSelectedTrack(track.trackId === selectedTrack ? null : track.trackId)}
                >
                  {/* Track Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-xs sm:text-sm font-semibold text-white truncate mb-1 group-hover:text-purple-400 transition-colors">
                        {track.fileName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{formatTimeAgo(track.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(track.status)}`}>
                    {track.status === "Processing" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {track.status}
                  </div>

                  {/* Genre Info (if completed) */}
                  {track.status === "Completed" && track.genre && (
                    <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 mb-1">Genre</div>
                          <div className="text-sm font-semibold text-purple-400 truncate">{track.genre}</div>
                          {track.subgenre && <div className="text-xs text-gray-500 mt-0.5 truncate">{track.subgenre}</div>}
                        </div>
                        {track.confidence && (
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-gray-400 mb-1">Confidence</div>
                            <div className="text-base sm:text-lg font-bold text-white">{track.confidence}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {selectedTrack === track.trackId && (
                    <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-white/10 animate-fade-in">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/analysis/${track.trackId}`, "_blank");
                        }}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs sm:text-sm px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-semibold"
                      >
                        View Full Analysis
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Stats */}
          {tracks.length > 0 && (
            <div className="p-3 sm:p-4 border-t border-white/10">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-2.5 sm:p-3 border border-purple-500/20">
                  <div className="text-xs text-gray-400 mb-1">Total Tracks</div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{tracks.length}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg p-2.5 sm:p-3 border border-blue-500/20">
                  <div className="text-xs text-gray-400 mb-1">Completed</div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{tracks.filter((t) => t.status === "Completed").length}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button (when sidebar is closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-gradient-to-br from-purple-500 to-pink-500 text-white p-2.5 sm:p-3 rounded-l-xl shadow-2xl hover:shadow-purple-500/50 transition-all z-40 group"
          aria-label="Open recent tracks"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
      )}

      {/* Backdrop for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden" onClick={onToggle} aria-hidden="true" />}
    </>
  );
};


