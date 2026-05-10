"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Loader2, MessageSquareHeart, Sparkles, X } from "lucide-react";
import { DashboardOverview, getDashboardOverview } from "@/services/backendApi";

export const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const topSuggestion = useMemo(() => overview?.suggestions?.[0], [overview]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getDashboardOverview();
        setOverview(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load Musicle AI data.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="w-80 h-[28rem] bg-neutral-950 border border-neutral-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-white" />
                <h3 className="text-white font-semibold text-sm">Musicle AI Assistant</h3>
              </div>
              <button className="text-white/80 hover:text-white transition" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto text-neutral-200 text-sm space-y-3">
              {loading && (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-300" />
                </div>
              )}

              {!loading && error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</div>}

              {!loading && !error && overview && (
                <>
                  <div className="rounded-lg border border-violet-400/25 bg-violet-500/10 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-violet-300 mb-1">Live insight</div>
                    <div className="text-sm font-semibold text-white">{overview.insight.headline}</div>
                    <div className="text-xs text-white/60 mt-1">{overview.insight.summary}</div>
                  </div>

                  {topSuggestion && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/40 mb-1">
                        <Sparkles className="w-3 h-3" />
                        Suggested action
                      </div>
                      <div className="text-sm font-medium text-white">{topSuggestion.title}</div>
                      <div className="text-xs text-white/55 mt-1">{topSuggestion.description}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                      <div className="text-[10px] text-white/35 uppercase">Users</div>
                      <div className="text-lg font-bold text-white">{overview.community.activeUsers.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                      <div className="text-[10px] text-white/35 uppercase">Tracks Today</div>
                      <div className="text-lg font-bold text-white">{overview.analysis.tracksAnalyzedToday.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                      <div className="text-[10px] text-white/35 uppercase">Feedback</div>
                      <div className="text-lg font-bold text-white">{overview.feedback.totalFeedback.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                      <div className="text-[10px] text-white/35 uppercase">Confidence</div>
                      <div className="text-lg font-bold text-white">{overview.analysis.averageConfidence}%</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full border border-violet-300/50 bg-gradient-to-b from-violet-500 to-fuchsia-700 shadow-lg flex items-center justify-center text-white"
          aria-label="Open Musicle AI assistant"
        >
          <MessageSquareHeart size={20} />
        </motion.button>
      )}
    </div>
  );
};