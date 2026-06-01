"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Users, Mic, Heart, MessageCircle, Play, Music, ArrowRight } from "lucide-react";

// 40 bars (fewer than 60) so the waveform fits on narrow screens without overflow.
// Heights are pre-computed integers — SSR and client produce identical strings,
// preventing the React hydration mismatch that caused the previous float-precision bug.
const WAVEFORM_BARS = Array.from({ length: 40 }, (_, i) => Math.round(Math.abs(Math.sin(i * 0.2) * 65 + ((i * 13) % 20) + 15)));
const SKETCH_BARS = Array.from({ length: 32 }, (_, i) => Math.round(30 + Math.abs(Math.sin(i * 0.25) * 40)));

const MusicleFeedSection = () => {
  const [playingSketch, setPlayingSketch] = useState<number | null>(null);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="border bg-[#111111] py-8 px-6 sm:px-8 mx-auto mt-16 sm:mt-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-16 sm:mb-20"
      >
        <p className="text-sm font-medium text-gray-500 mb-3 tracking-wide uppercase">Community</p>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 text-white leading-tight tracking-tight">Explore Musicle</h2>
        <p className="text-lg text-gray-400 max-w-xl">Share analyzed tracks with the community or capture musical ideas instantly</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Community Feed */}
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-8">
          {/* Section Header */}
          <motion.div variants={item} className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Community Feed</h3>
              <p className="text-gray-500">Discover analyzed tracks</p>
            </div>
          </motion.div>

          {/* Stats - Clean Data Viz */}
          <motion.div variants={item} className="grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="text-3xl font-bold text-white">12K</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Tracks</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[85%] bg-purple-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-white">8.5K</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Users</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[72%] bg-pink-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-white">45K</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Likes</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[95%] bg-blue-500 rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Feed Items */}
          <div className="space-y-4">
            {[
              { name: "Cosmic Voyage", user: "Ajdin M.", score: 67, genre: "Electronic", likes: 45, comments: 12 },
              { name: "Urban Sunset", user: "Sarah C.", score: 82, genre: "Lo-fi", likes: 89, comments: 23 },
            ].map((track, idx) => (
              <motion.div
                key={idx}
                variants={item}
                whileHover={{ x: 4 }}
                className="border border-white/5 rounded-2xl p-4 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {track.user.split(" ")[0][0]}
                    {track.user.split(" ")[1][0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{track.user}</div>
                    <div className="text-xs text-gray-600">2h ago</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Album Art - Simple gradient */}
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white mb-2 truncate">{track.name}</h4>
                    <div className="flex items-center gap-2 text-xs mb-2">
                      <span className="px-2 py-1 bg-white/5 rounded-md text-gray-400">{track.genre}</span>
                      <span className="text-green-400 font-medium">{track.score}%</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {track.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {track.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            variants={item}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 px-6 border border-purple-500/30 rounded-xl font-medium text-white hover:bg-purple-500/10 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Explore Feed</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>

        {/* Sketchbook */}
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-8">
          {/* Section Header */}
          <motion.div variants={item} className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Mic className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Musical Sketchbook</h3>
              <p className="text-gray-500">AI voice recording</p>
            </div>
          </motion.div>

          {/* Stats - Clean Data Viz */}
          <motion.div variants={item} className="grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="text-3xl font-bold text-white">3.2K</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Sketches</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[68%] bg-blue-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-white">95%</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Accuracy</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[95%] bg-cyan-500 rounded-full" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-white">
                <span className="text-2xl">Infinity</span>
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Instant</div>
              <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-full bg-purple-500 rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Waveform Visualization - Minimal */}
          <motion.div variants={item} className="relative h-32 border border-white/5 rounded-2xl bg-white/[0.02] overflow-hidden">
            <div className="absolute inset-0 flex items-end justify-center gap-[2px] px-8 pb-4">
              {WAVEFORM_BARS.map((height, i) => {
                return (
                  <motion.div
                    key={i}
                    className="w-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full origin-bottom"
                    style={{ height: `${height}%` }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: i * 0.01,
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
            </div>
          </motion.div>

          {/* Sketches */}
          <div className="space-y-4">
            {[
              { name: "Late Night Melody", type: "humming", bpm: 128, duration: "0:23" },
              { name: "Vocal Hook Draft", type: "voice", bpm: 140, duration: "0:15" },
            ].map((sketch, idx) => (
              <motion.div
                key={idx}
                variants={item}
                whileHover={{ x: 4 }}
                onClick={() => setPlayingSketch(playingSketch === idx ? null : idx)}
                className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
              >
                {/* Mini waveform header */}
                <div className="h-16 bg-gradient-to-r from-blue-500/20 to-purple-500/20 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center gap-px px-4">
                    {SKETCH_BARS.map((barHeight, i) => (
                      <div
                        key={i}
                        className={`w-0.5 rounded-full transition-all ${playingSketch === idx ? "bg-white/80" : "bg-white/40"}`}
                        style={{ height: `${barHeight}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white truncate flex-1">{sketch.name}</h4>
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Play className="w-3 h-3 text-blue-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1 capitalize">
                      {sketch.type === "humming" ? <Music className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {sketch.type}
                    </span>
                    <span>{sketch.duration}</span>
                    <span>-</span>
                    <span className="text-green-400 font-medium">{sketch.bpm} BPM</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            variants={item}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 px-6 border border-blue-500/30 rounded-xl font-medium text-white hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Open Sketchbook</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </div>

      {/* Bottom Stats Infographic - Edward Tufte Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-20 pt-12 border-t border-white/5"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: "Active Users", value: "8,542", change: "+12%" },
            { label: "Tracks Analyzed", value: "127K", change: "+8%" },
            { label: "Avg. Score", value: "74%", change: "+3%" },
            { label: "Daily Uploads", value: "1.2K", change: "+15%" },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + idx * 0.05 }}
              className="space-y-2"
            >
              <div className="text-xs text-gray-600 uppercase tracking-wider">{stat.label}</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-green-400">{stat.change}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default MusicleFeedSection;
