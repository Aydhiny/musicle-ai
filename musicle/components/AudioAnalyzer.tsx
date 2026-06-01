"use client";

/**
 * AudioAnalyzer.tsx
 *
 * npm i essentia.js pitchy @tonejs/midi wavesurfer.js
 *
 * Drop essentia.d.ts in your project root so TS knows the module shapes.
 * Import path uses the @ alias — configure in tsconfig.json:
 *   "paths": { "@/*": ["./*"] }
 */

import { useState, useRef, useEffect, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { PitchDetector } from "pitchy";
import { Midi } from "@tonejs/midi";
import EssentiaWASM from "essentia.js/dist/essentia-wasm.web.js";
import { Essentia } from "essentia.js";

import {
  Upload,
  Play,
  Pause,
  Square,
  Download,
  X,
  Activity,
  Music,
  Zap,
  AudioLines,
  Wand2,
  FileMusic,
  Info,
  ChevronRight,
  RefreshCw,
  Check,
  Sparkles,
} from "lucide-react";

import { useSketchbook, nextHue, fmt, cn, type AnalysisResult, type PitchNote, type Sketch } from "@/context/SketchbookContext";

// ─── Essentia singleton ───────────────────────────────────────────────────────
// Typed as Promise<Essentia> (never null after first call) via lazy init pattern

let _essentiaPromise: Promise<Essentia> | undefined;

function getEssentia(): Promise<Essentia> {
  if (!_essentiaPromise) {
    _essentiaPromise = (EssentiaWASM() as Promise<unknown>).then((wasm) => new Essentia(wasm));
  }
  return _essentiaPromise;
}

// ─── Note helpers ─────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

// ─── Core analysis ────────────────────────────────────────────────────────────

async function analyzeBuffer(buf: AudioBuffer, onProgress: (n: number) => void): Promise<AnalysisResult> {
  const essentia = await getEssentia();
  onProgress(15);

  const sr = buf.sampleRate;

  // Mono mix-down
  const raw: Float32Array =
    buf.numberOfChannels > 1 ? buf.getChannelData(0).map((v, i) => (v + buf.getChannelData(1)[i]) / 2) : buf.getChannelData(0);

  const vec = essentia.arrayToVector(raw);

  // BPM — RhythmExtractor2013 is the most accurate essentia algo
  const rhythm = essentia.RhythmExtractor2013(vec, sr);
  const bpm = Math.round(rhythm.bpm);
  const beats: number[] = Array.from(essentia.vectorToArray(rhythm.ticks));
  onProgress(40);

  // Key — KeyExtractor with bgate profile (best for modern music)
  const keyResult = essentia.KeyExtractor(vec, true, 4096, 4096, 12, 3500, 60, 25, 0.2, "bgate", sr, 440, 60, 6, "hann");
  const key: string = keyResult.key;
  const scale: string = keyResult.scale;
  onProgress(60);

  // Pitch — pitchy McLeod Pitch Method
  const frameSize = 2048;
  const hopSize = 512;
  const detector = PitchDetector.forFloat32Array(frameSize);
  const frameBuf = new Float32Array(frameSize);
  const pitchNotes: PitchNote[] = [];
  let prevMidi = -1;
  let noteStart = 0;
  let lastFreq = 0;

  for (let offset = 0; offset + frameSize < raw.length; offset += hopSize) {
    frameBuf.set(raw.subarray(offset, offset + frameSize));
    const [freq, clarity] = detector.findPitch(frameBuf, sr);
    const time = offset / sr;

    if (clarity > 0.85 && freq > 60 && freq < 2000) {
      const midi = freqToMidi(freq);
      if (midi !== prevMidi) {
        if (prevMidi >= 0 && time - noteStart > 0.05) {
          pitchNotes.push({
            time: noteStart,
            note: midiToNote(prevMidi),
            midi: prevMidi,
            freq: Math.round(lastFreq * 10) / 10,
            duration: time - noteStart,
          });
        }
        prevMidi = midi;
        noteStart = time;
      }
      lastFreq = freq;
    } else {
      if (prevMidi >= 0 && time - noteStart > 0.05) {
        pitchNotes.push({
          time: noteStart,
          note: midiToNote(prevMidi),
          midi: prevMidi,
          freq: Math.round(lastFreq * 10) / 10,
          duration: time - noteStart,
        });
      }
      prevMidi = -1;
    }
  }
  onProgress(82);

  // 200-bar waveform preview (normalised 0-100)
  const bars = 200;
  const step = Math.floor(raw.length / bars);
  const waveform: number[] = Array.from({ length: bars }, (_, i) => {
    let max = 0;
    for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(raw[i * step + j] ?? 0));
    return Math.round(max * 100);
  });

  onProgress(100);
  return { bpm, key, scale, duration: buf.duration, sampleRate: sr, waveform, pitchNotes, beats };
}

// ─── MIDI export via @tonejs/midi ─────────────────────────────────────────────

function exportMidi(notes: PitchNote[], bpm: number, filename: string) {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const track = midi.addTrack();
  for (const n of notes) {
    track.addNote({
      midi: n.midi,
      time: n.time,
      duration: Math.max(0.05, n.duration),
      velocity: 0.8,
    });
  }
  // toArray() returns a regular Uint8Array — cast buffer to ArrayBuffer
  // so the Blob constructor is happy under strict TS lib settings
  const raw = midi.toArray();
  const blob = new Blob([raw.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Piano Roll ──────────────────────────────────────────────────────────────

function PianoRoll({ notes, duration, beats }: { notes: PitchNote[]; duration: number; beats: number[] }) {
  if (!notes.length) {
    return <div className="flex items-center justify-center h-28 text-sm text-white/20">No pitched notes detected</div>;
  }

  const midiVals = notes.map((n) => n.midi);
  const midiMin = Math.max(21, Math.min(...midiVals) - 2);
  const midiMax = Math.min(108, Math.max(...midiVals) + 2);
  const noteRange = midiMax - midiMin + 1;
  const H = Math.max(120, noteRange * 9);
  const COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#fb923c", "#f472b6"];

  return (
    <div className="relative overflow-x-auto rounded-xl bg-[#080808] border border-white/6">
      <svg width="100%" height={H} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="block">
        {/* Black-key row tints */}
        {Array.from({ length: noteRange }, (_, i) => {
          const midi = midiMin + i;
          if (![1, 3, 6, 8, 10].includes(midi % 12)) return null;
          const y = H - ((i + 1) / noteRange) * H;
          return <rect key={midi} x={0} y={y} width={1000} height={H / noteRange} fill="rgba(255,255,255,0.022)" />;
        })}
        {/* Beat grid */}
        {beats.slice(0, 200).map((b, i) => (
          <line
            key={i}
            x1={(b / duration) * 1000}
            y1={0}
            x2={(b / duration) * 1000}
            y2={H}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {/* C lines */}
        {Array.from({ length: noteRange }, (_, i) => {
          const midi = midiMin + i;
          if (midi % 12 !== 0) return null;
          const y = H - ((i + 1) / noteRange) * H;
          return <line key={midi} x1={0} y1={y} x2={1000} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />;
        })}
        {/* Notes */}
        {notes.map((n, i) => {
          const x = (n.time / duration) * 1000;
          const w = Math.max(4, (n.duration / duration) * 1000);
          const row = n.midi - midiMin;
          const y = H - ((row + 1) / noteRange) * H;
          const h = (H / noteRange) * 0.75;
          return <rect key={i} x={x} y={y} width={w} height={h} rx={2} fill={COLORS[n.midi % COLORS.length]} opacity={0.85} />;
        })}
      </svg>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between pointer-events-none py-1">
        {[midiMax, Math.round((midiMin + midiMax) / 2), midiMin].map((m) => (
          <span key={m} className="text-[9px] text-white/25 font-mono px-1">
            {midiToNote(m)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── WaveSurfer player ────────────────────────────────────────────────────────

function WaveformPlayer({ file, beats }: { file: File; beats: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(167,139,250,0.35)",
      progressColor: "#a78bfa",
      cursorColor: "rgba(255,255,255,0.6)",
      cursorWidth: 2,
      height: 72,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });

    ws.loadBlob(file);
    ws.on("ready", () => {
      setReady(true);
      setDuration(ws.getDuration());
    });
    ws.on("audioprocess", (t: number) => setCurrentTime(t));
    ws.on("finish", () => {
      setPlaying(false);
      setCurrentTime(0);
    });
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));

    wsRef.current = ws;
    return () => ws.destroy();
  }, [file]);

  return (
    <div>
      <div ref={containerRef} className="rounded-xl overflow-hidden bg-[#080808] border border-white/6" />
      {!ready && (
        <div className="h-18 flex items-center justify-center text-xs text-white/25 -mt-18 relative z-10 pointer-events-none">
          Loading waveform…
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          className="w-9 h-9 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-30 flex items-center justify-center text-white transition-all"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            wsRef.current?.stop();
            setPlaying(false);
            setCurrentTime(0);
          }}
          disabled={!ready}
          className="w-9 h-9 rounded-xl bg-white/6 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white/50 hover:text-white transition-all"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 text-xs text-white/30 font-mono text-right">
          {fmt(currentTime)} / {fmt(duration)}
        </div>
      </div>

      {/* Beat ruler */}
      {ready && beats.length > 0 && (
        <div className="relative h-1 mt-2 bg-white/4 rounded-full overflow-hidden">
          {beats.slice(0, 300).map((b, i) => (
            <div key={i} className="absolute top-0 w-px h-full bg-amber-400/50" style={{ left: `${(b / duration) * 100}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AudioAnalyzer() {
  const { addSketch, sketches } = useSketchbook();

  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"waveform" | "pianoroll" | "notes">("waveform");
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("audio/")) {
      setError("Please upload an audio file (MP3, WAV, FLAC, OGG, AAC…)");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    setSaved(false);
    setAnalyzing(true);
    setProgress(5);
    try {
      const arrayBuf = await f.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      setAudioBuffer(audioBuf);
      setProgress(14);
      const res = await analyzeBuffer(audioBuf, setProgress);
      setResult(res);
    } catch (e) {
      setError(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const saveToSketchbook = useCallback(() => {
    if (!result || !file) return;
    // addSketch expects NewSketchInput (the creation shape), not the full Sketch entity
    const input: import("@/context/SketchbookContext").NewSketchInput = {
      file,
      name: file.name.replace(/\.[^.]+$/, ""),
      type: "upload",
      duration: result.duration,
      bpm: result.bpm,
      key: result.key,
      scale: result.scale,
      waveform: result.waveform,
      tags: [result.scale, `${result.bpm}bpm`],
      hue: nextHue(sketches),
      isAi: false,
    };
    addSketch(input);
    setSaved(true);
  }, [result, file, audioBuffer, addSketch, sketches]);

  const reset = useCallback(() => {
    setFile(null);
    setAudioBuffer(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setProgress(0);
  }, []);

  const progressLabel =
    progress < 20
      ? "Decoding audio…"
      : progress < 45
        ? "RhythmExtractor2013…"
        : progress < 65
          ? "KeyExtractor…"
          : progress < 85
            ? "Pitchy MPM pitch tracking…"
            : "Building preview…";

  return (
    <div className="min-h-screen bg-[#060606] text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Audio Analyzer</h1>
            <p className="text-xs text-white/30 mt-0.5">
              essentia.js BPM &amp; key · pitchy MPM · wavesurfer · @tonejs/midi export · saves to Sketchbook
            </p>
          </div>
        </div>

        {/* Drop zone */}
        {!file && !analyzing && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer select-none transition-all duration-200",
              isDragging ? "border-violet-400 bg-violet-400/5" : "border-white/8 hover:border-white/20 hover:bg-white/2",
            )}
          >
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
                isDragging ? "bg-violet-500/15 scale-110" : "bg-white/4",
              )}
            >
              <Upload className={cn("w-7 h-7 transition-colors", isDragging ? "text-violet-400" : "text-white/25")} />
            </div>
            <div className="text-center">
              <div className="font-semibold text-white/70 mb-1">Drop an audio file here</div>
              <div className="text-sm text-white/25">MP3, WAV, OGG, FLAC, AAC, M4A</div>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {["MP3", "WAV", "FLAC", "OGG", "AAC", "M4A"].map((ext) => (
                <span key={ext} className="px-2.5 py-1 rounded-lg bg-white/4 border border-white/6 text-xs text-white/25 font-mono">
                  {ext}
                </span>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <X className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
            </button>
          </div>
        )}

        {/* Progress */}
        {analyzing && (
          <div className="mt-6 bg-white/3 border border-white/6 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <Activity className="w-4 h-4 text-violet-400 animate-pulse" />
              <div>
                <div className="text-sm font-semibold text-white truncate">{file?.name}</div>
                <div className="text-xs text-white/30 mt-0.5">{progressLabel}</div>
              </div>
            </div>
            <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-right text-xs text-white/20">{progress}%</div>
          </div>
        )}

        {/* Results */}
        {result && file && (
          <div className="space-y-4">
            {/* File bar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white/3 border border-white/6 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <FileMusic className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{file.name}</div>
                <div className="text-xs text-white/30">
                  {fmt(result.duration)} · {(result.sampleRate / 1000).toFixed(1)}kHz
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => exportMidi(result.pitchNotes, result.bpm, `${file.name.replace(/\.[^.]+$/, "")}.mid`)}
                  className="h-8 px-3 rounded-lg bg-white/6 hover:bg-white/10 text-xs text-white/60 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> MIDI
                </button>
                {saved ? (
                  <div className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Saved to Sketchbook
                  </div>
                ) : (
                  <button
                    onClick={saveToSketchbook}
                    className="h-8 px-3 rounded-lg bg-violet-500 hover:bg-violet-400 text-xs text-white font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Save to Sketchbook
                  </button>
                )}
                <button
                  onClick={reset}
                  className="w-8 h-8 rounded-lg bg-white/6 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "BPM", value: String(result.bpm), sub: "RhythmExtractor2013", icon: Zap, color: "#a78bfa" },
                { label: "Key", value: result.key, sub: result.scale, icon: Music, color: "#38bdf8" },
                { label: "Duration", value: fmt(result.duration), sub: `${result.beats.length} beats`, icon: Activity, color: "#34d399" },
                { label: "Notes", value: String(result.pitchNotes.length), sub: "pitchy MPM", icon: AudioLines, color: "#fbbf24" },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="bg-white/3 border border-white/6 rounded-xl px-4 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">{label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white leading-none mb-1">{value}</div>
                  <div className="text-[11px] text-white/25 capitalize">{sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="bg-white/3 border border-white/6 rounded-2xl overflow-hidden">
              <div className="flex items-center border-b border-white/6 px-4 pt-3 gap-1">
                {(["waveform", "pianoroll", "notes"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "text-sm font-medium pb-3 pr-5 border-b-2 -mb-px transition-all capitalize",
                      activeTab === tab ? "border-violet-400 text-white" : "border-transparent text-white/30 hover:text-white/60",
                    )}
                  >
                    {tab === "pianoroll" ? "Piano Roll" : tab === "notes" ? "Note List" : "Waveform"}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === "waveform" && <WaveformPlayer file={file} beats={result.beats} />}

                {activeTab === "pianoroll" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-white/20" />
                      <span className="text-xs text-white/25">
                        pitchy MPM · clarity &gt; 0.85 · {result.pitchNotes.length} notes detected
                      </span>
                    </div>
                    <PianoRoll notes={result.pitchNotes} duration={result.duration} beats={result.beats} />
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="max-h-72 overflow-y-auto space-y-0.5">
                    {result.pitchNotes.length === 0 && (
                      <div className="text-sm text-white/25 text-center py-8">No pitched notes detected</div>
                    )}
                    {result.pitchNotes.slice(0, 100).map((n, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/3 text-xs">
                        <span className="font-mono text-violet-400 w-8 shrink-0">{n.note}</span>
                        <span className="text-white/30 w-16 shrink-0">{n.freq.toFixed(1)} Hz</span>
                        <div className="flex-1 h-1 bg-white/4 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-400/40 rounded-full"
                            style={{ width: `${Math.min(100, (n.duration / result.duration) * 100 * 8)}%` }}
                          />
                        </div>
                        <span className="text-white/20 font-mono w-12 text-right shrink-0">{n.time.toFixed(2)}s</span>
                      </div>
                    ))}
                    {result.pitchNotes.length > 100 && (
                      <div className="text-xs text-white/20 text-center py-2">
                        +{result.pitchNotes.length - 100} more — all exported to MIDI
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* MIDI hint */}
            <div className="flex items-start gap-3 px-4 py-3 bg-violet-500/6 border border-violet-500/20 rounded-xl">
              <ChevronRight className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
              <p className="text-sm text-white/40">
                <span className="text-violet-400 font-medium">Export MIDI</span> uses <span className="text-white/60">@tonejs/midi</span> to
                write a proper Type-1 .mid at {result.bpm} BPM with {result.pitchNotes.length} notes — drag into Ableton, Logic, FL Studio
                or GarageBand.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
