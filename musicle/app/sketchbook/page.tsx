"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { PitchDetector } from "pitchy";
import { Midi } from "@tonejs/midi";
import {
  Mic,
  Play,
  Pause,
  Trash2,
  Download,
  Share2,
  Sparkles,
  Music,
  Clock,
  Search,
  Grid3x3,
  List,
  Heart,
  ChevronDown,
  StopCircle,
  X,
  Check,
  AudioLines,
  Wand2,
  Layers,
  SlidersHorizontal,
  BookOpen,
  Upload,
  FileMusic,
  Info,
  Zap,
} from "lucide-react";

import {
  useSketchbook,
  nextHue,
  TYPE_CONFIG,
  HUE_STYLES,
  fmt,
  cn,
  type Sketch,
  type SketchType,
  type AnalysisResult,
  type PitchNote,
} from "@/context/SketchbookContext";

import { useAuth } from "@/context/AuthContext";
import { resolveApiUrl } from "@/lib/api-url";

type SortKey = "recent" | "oldest" | "name" | "bpm" | "duration";
type FilterKey = "all" | "favorites" | SketchType;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function freqToMidi(freq: number) {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

function detectBPM(raw: Float32Array, sr: number): { bpm: number; beats: number[] } {
  const frameSize = 1024;
  const hopSize = 512;
  const frames = Math.floor((raw.length - frameSize) / hopSize);
  const energy: number[] = [];
  for (let i = 0; i < frames; i++) {
    let e = 0;
    for (let j = 0; j < frameSize; j++) e += raw[i * hopSize + j] ** 2;
    energy.push(e / frameSize);
  }
  const onsets: number[] = [0];
  for (let i = 1; i < energy.length; i++) {
    onsets.push(Math.max(0, energy[i] - energy[i - 1]));
  }
  const minBPM = 60,
    maxBPM = 200;
  const minLag = Math.round(((60 / maxBPM) * sr) / hopSize);
  const maxLag = Math.round(((60 / minBPM) * sr) / hopSize);
  let bestLag = minLag,
    bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < onsets.length - lag; i++) corr += onsets[i] * onsets[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  const bpm = Math.round((60 * sr) / (bestLag * hopSize));
  const beatHop = bestLag;
  const firstOnset = onsets.indexOf(Math.max(...onsets.slice(0, beatHop * 2)));
  const beats: number[] = [];
  for (let i = firstOnset; i < onsets.length; i += beatHop) {
    beats.push((i * hopSize) / sr);
  }
  return { bpm, beats };
}

function detectKey(raw: Float32Array, sr: number): { key: string; scale: string } {
  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const frameSize = 4096;
  const chroma = new Float32Array(12).fill(0);
  let frameCount = 0;
  for (let offset = 0; offset + frameSize < raw.length; offset += frameSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = raw[offset + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    }
    for (let bin = 1; bin < frameSize / 2; bin++) {
      const freq = (bin * sr) / frameSize;
      if (freq < 80 || freq > 4000) continue;
      const midi = 12 * Math.log2(freq / 440) + 69;
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += frame[bin] * frame[bin];
    }
    frameCount++;
  }
  if (frameCount === 0) return { key: "C", scale: "major" };
  const maxC = Math.max(...chroma);
  if (maxC > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxC;
  function pearson(a: number[], b: Float32Array | number[]): number {
    const n = a.length;
    const ma = a.reduce((s, v) => s + v, 0) / n;
    const mb = (b as number[]).reduce((s: number, v: number) => s + v, 0) / n;
    let num = 0,
      da = 0,
      db = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * ((b as number[])[i] - mb);
      da += (a[i] - ma) ** 2;
      db += ((b as number[])[i] - mb) ** 2;
    }
    return num / (Math.sqrt(da) * Math.sqrt(db) + 1e-10);
  }
  let bestKey = 0,
    bestScale = "major",
    bestScore = -Infinity;
  for (let k = 0; k < 12; k++) {
    const rotated = [...Array(12)].map((_, i) => chroma[(i + k) % 12]);
    const majorScore = pearson(MAJOR_PROFILE, rotated);
    const minorScore = pearson(MINOR_PROFILE, rotated);
    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestKey = k;
      bestScale = "major";
    }
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestKey = k;
      bestScale = "minor";
    }
  }
  return { key: NOTE_NAMES[bestKey], scale: bestScale };
}

async function analyzeBuffer(buf: AudioBuffer, onProgress: (n: number) => void): Promise<AnalysisResult> {
  onProgress(10);
  const sr = buf.sampleRate;
  const raw: Float32Array =
    buf.numberOfChannels > 1 ? buf.getChannelData(0).map((v, i) => (v + buf.getChannelData(1)[i]) / 2) : buf.getChannelData(0);
  onProgress(20);
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));
  const { bpm, beats } = detectBPM(raw, sr);
  onProgress(50);
  await tick();
  const { key, scale } = detectKey(raw, sr);
  onProgress(70);
  await tick();
  const frameSize = 2048;
  const hopSize = 512;
  const detector = PitchDetector.forFloat32Array(frameSize);
  const frameBuf = new Float32Array(frameSize);
  const pitchNotes: PitchNote[] = [];
  let prevMidi = -1,
    noteStart = 0,
    lastFreq = 0;
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
  onProgress(88);
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

function doExportMidi(notes: PitchNote[], bpm: number, filename: string) {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const track = midi.addTrack();
  for (const n of notes) {
    track.addNote({ midi: n.midi, time: n.time, duration: Math.max(0.05, n.duration), velocity: 0.8 });
  }
  const raw = midi.toArray();
  const blob = new Blob([raw.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MiniWaveform({
  data,
  active,
  color = "#a78bfa",
  height = 40,
}: {
  data: number[];
  active: boolean;
  color?: string;
  height?: number;
}) {
  return (
    <div className="flex items-center gap-[1.5px]" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full shrink-0"
          style={{
            height: `${Math.max(4, v)}%`,
            background: active ? `linear-gradient(to top, ${color}, ${color}88)` : `linear-gradient(to top, ${color}55, ${color}22)`,
          }}
        />
      ))}
    </div>
  );
}

function RecordingPulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
    </span>
  );
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-0.5">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/40"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

function PianoRoll({ notes, duration, beats }: { notes: PitchNote[]; duration: number; beats: number[] }) {
  if (!notes.length) return <div className="flex items-center justify-center h-40 text-sm text-white/20">No pitched notes detected</div>;
  const midiVals = notes.map((n) => n.midi);
  const midiMin = Math.max(21, Math.min(...midiVals) - 2);
  const midiMax = Math.min(108, Math.max(...midiVals) + 2);
  const noteRange = midiMax - midiMin + 1;
  const H = Math.max(160, noteRange * 10);
  const COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#fb923c", "#f472b6"];
  return (
    <div className="relative rounded-xl bg-[#080808] border border-white/6 overflow-hidden">
      <svg width="100%" height={H} viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="block">
        {Array.from({ length: noteRange }, (_, i) => {
          const midi = midiMin + i;
          if (![1, 3, 6, 8, 10].includes(midi % 12)) return null;
          const y = H - ((i + 1) / noteRange) * H;
          return <rect key={midi} x={0} y={y} width={1000} height={H / noteRange} fill="rgba(255,255,255,0.022)" />;
        })}
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
        {Array.from({ length: noteRange }, (_, i) => {
          const midi = midiMin + i;
          if (midi % 12 !== 0) return null;
          const y = H - ((i + 1) / noteRange) * H;
          return <line key={midi} x1={0} y1={y} x2={1000} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />;
        })}
        {notes.map((n, i) => {
          const x = (n.time / duration) * 1000;
          const w = Math.max(4, (n.duration / duration) * 1000);
          const row = n.midi - midiMin;
          const y = H - ((row + 1) / noteRange) * H;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={(H / noteRange) * 0.75}
              rx={2}
              fill={COLORS[n.midi % COLORS.length]}
              opacity={0.85}
            />
          );
        })}
      </svg>
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

function WaveformPlayer({ file, beats }: { file: File; beats: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(167,139,250,0.35)",
      progressColor: "#a78bfa",
      cursorColor: "rgba(255,255,255,0.6)",
      cursorWidth: 2,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    ws.loadBlob(file);
    ws.on("ready", () => {
      setReady(true);
      setDur(ws.getDuration());
    });
    ws.on("audioprocess", (t: number) => setCur(t));
    ws.on("finish", () => {
      setPlaying(false);
      setCur(0);
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
        <div className="h-20 flex items-center justify-center text-xs text-white/25 -mt-20 relative z-10 pointer-events-none">
          Loading waveform...
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
            setCur(0);
          }}
          disabled={!ready}
          className="w-9 h-9 rounded-xl bg-white/6 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white/50 hover:text-white transition-all"
        >
          <StopCircle className="w-4 h-4" />
        </button>
        <span className="flex-1 text-right text-xs text-white/25 font-mono">
          {fmt(cur)} / {fmt(dur)}
        </span>
      </div>
      {ready && beats.length > 0 && (
        <div className="relative h-px mt-3 bg-white/6 rounded-full overflow-hidden">
          {beats.slice(0, 300).map((b, i) => (
            <div key={i} className="absolute top-0 w-px h-full bg-amber-400/60" style={{ left: `${(b / dur) * 100}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyzerModal({ onClose, seed }: { onClose: () => void; seed?: { blob: Blob; name: string } | null }) {
  const { addSketch, sketches } = useSketchbook();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"wave" | "roll" | "notes">("wave");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBlob = useCallback(async (blob: Blob, name: string) => {
    const f = new File([blob], `${name}.webm`, { type: blob.type });
    setFile(f);
    setResult(null);
    setError(null);
    setSaved(false);
    setAnalyzing(true);
    setProgress(5);
    try {
      const ab = await blob.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(ab);
      setProgress(14);
      const res = await analyzeBuffer(audioBuf, setProgress);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    if (seed) handleBlob(seed.blob, seed.name);
  }, [seed, handleBlob]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith("audio/")) {
      setError("Not an audio file");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    setSaved(false);
    setAnalyzing(true);
    setProgress(5);
    try {
      const ab = await f.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(ab);
      setProgress(14);
      const res = await analyzeBuffer(audioBuf, setProgress);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const save = useCallback(async () => {
    if (!result || !file) return;
    const isRecording = seed != null;
    const sketchType: SketchType = isRecording
      ? seed?.name.startsWith("hum")
        ? "hum"
        : seed?.name.startsWith("voice")
          ? "voice"
          : "sample"
      : "upload";
    const displayName =
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/^(hum|voice|sample)-/, "")
        .replace(/-/g, " ")
        .trim() || "Recording";
    setSaving(true);
    const created = await addSketch({
      file,
      name: displayName,
      type: sketchType,
      duration: result.duration,
      bpm: result.bpm,
      key: result.key,
      scale: result.scale,
      waveform: result.waveform,
      tags: [result.scale, `${result.bpm}bpm`],
      hue: nextHue(sketches),
      isAi: false,
      isFavorite: false,
      isPublic: true,
    });
    setSaving(false);
    if (created) setSaved(true);
  }, [result, file, addSketch, sketches, seed]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setProgress(0);
  }, []);

  const progressLabel =
    progress < 20
      ? "Decoding audio..."
      : progress < 45
        ? "BPM detection..."
        : progress < 65
          ? "Key detection..."
          : progress < 85
            ? "Pitch tracking..."
            : "Finalising...";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              {seed ? <Mic className="w-4 h-4 text-violet-400" /> : <AudioLines className="w-4 h-4 text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{seed ? "Recording Analysis" : "Audio Analyzer"}</h2>
              <p className="text-[11px] text-white/30">BPM  -  Key  -  Pitch detection  -  MIDI export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!file && !analyzing && (
            <div className="p-6">
              {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  <X className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError(null)}>
                    <X className="w-3.5 h-3.5 opacity-50" />
                  </button>
                </div>
              )}
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
                  "flex flex-col items-center gap-4 py-20 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-150",
                  isDragging ? "border-emerald-400 bg-emerald-400/5" : "border-white/10 hover:border-white/20 hover:bg-white/2",
                )}
              >
                <div
                  className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
                    isDragging ? "bg-emerald-400/15 scale-110" : "bg-white/4",
                  )}
                >
                  <Upload className={cn("w-7 h-7 transition-colors", isDragging ? "text-emerald-400" : "text-white/25")} />
                </div>
                <div className="text-center">
                  <div className="text-base font-medium text-white/60">Drop audio file here</div>
                  <div className="text-sm text-white/25 mt-1">MP3  -  WAV  -  FLAC  -  OGG  -  AAC</div>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/6 border border-white/8 text-sm text-white/40 hover:text-white/70 transition-all">
                  Browse files
                </div>
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

          {analyzing && (
            <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-6">
              <div className="flex items-center gap-3">
                <FileMusic className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm text-white">{file?.name}</span>
              </div>
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-xs text-white/30 mb-2">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-white/6 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="text-xs text-white/20">This may take a few seconds...</div>
            </div>
          )}

          {result && file && (
            <div className="flex flex-col">
              <div className="px-6 py-5 border-b border-white/6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileMusic className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-white">{file.name.replace(/\.[^.]+$/, "")}</span>
                  </div>
                  <button
                    onClick={reset}
                    className="h-7 px-2.5 rounded-lg bg-white/6 hover:bg-white/10 flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-all"
                  >
                    <Upload className="w-3 h-3" /> New file
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "BPM", value: String(result.bpm), color: "#a78bfa", Icon: Zap },
                    { label: "Key", value: `${result.key} ${result.scale}`, color: "#38bdf8", Icon: Music },
                    { label: "Duration", value: fmt(result.duration), color: "#34d399", Icon: Clock },
                    { label: "Notes", value: String(result.pitchNotes.length), color: "#fbbf24", Icon: AudioLines },
                  ].map(({ label, value, color, Icon }) => (
                    <div key={label} className="bg-white/3 rounded-xl px-4 py-3 border border-white/5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                        <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">{label}</span>
                      </div>
                      <div className="text-xl font-bold text-white leading-none capitalize">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex border-b border-white/6 px-6 gap-1 pt-4">
                {(
                  [
                    ["wave", "Waveform"],
                    ["roll", "Piano Roll"],
                    ["notes", "Note List"],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "text-sm font-medium pb-3 pr-5 border-b-2 -mb-px transition-all",
                      tab === t ? "border-violet-400 text-white" : "border-transparent text-white/30 hover:text-white/60",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {tab === "wave" && <WaveformPlayer file={file} beats={result.beats} />}

                {tab === "roll" && (
                  <div className="space-y-3">
                    <p className="text-xs text-white/25 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      pitchy MPM algorithm  -  {result.pitchNotes.length} detected notes  -  clarity threshold 0.85
                    </p>
                    <PianoRoll notes={result.pitchNotes} duration={result.duration} beats={result.beats} />
                  </div>
                )}

                {tab === "notes" && (
                  <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {result.pitchNotes.length === 0 && (
                      <div className="text-sm text-white/25 text-center py-12">No pitched notes detected</div>
                    )}
                    {result.pitchNotes.slice(0, 80).map((n, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/3 text-xs">
                        <span className="font-mono text-violet-400 w-8 shrink-0 text-sm font-semibold">{n.note}</span>
                        <span className="text-white/30 w-16 shrink-0">{n.freq.toFixed(0)} Hz</span>
                        <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-400/50 rounded-full"
                            style={{ width: `${Math.min(100, (n.duration / result.duration) * 100 * 8)}%` }}
                          />
                        </div>
                        <span className="text-white/20 font-mono w-12 text-right shrink-0">{n.time.toFixed(2)}s</span>
                        <span className="text-white/15 font-mono w-14 text-right shrink-0">{n.duration.toFixed(2)}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => doExportMidi(result.pitchNotes, result.bpm, `${file.name.replace(/\.[^.]+$/, "")}.mid`)}
                  className="flex-1 h-10 rounded-xl bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white flex items-center justify-center gap-2 transition-all border border-white/8"
                >
                  <Download className="w-4 h-4" /> Export MIDI
                </button>
                {saved ? (
                  <div className="flex-1 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-sm text-emerald-400 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Saved to Sketchbook
                  </div>
                ) : (
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 h-10 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> {saving ? "Saving..." : "Save to Sketchbook"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TYPE_ICON_MAP: Record<SketchType, React.ComponentType<{ className?: string }>> = {
  hum: Music,
  voice: Mic,
  upload: Upload,
  sample: AudioLines,
};

function SketchCard({
  sketch,
  active,
  fav,
  selected,
  onPlay,
  onFav,
  onSelect,
  onDelete,
}: {
  sketch: Sketch;
  active: boolean;
  fav: boolean;
  selected: boolean;
  canDelete: boolean;
  onPlay: () => void;
  onFav: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const cfg = TYPE_CONFIG[sketch.type];
  const hue = HUE_STYLES[sketch.hue];
  const Icon = TYPE_ICON_MAP[sketch.type] ?? AudioLines;
  return (
    <div
      className={cn(
        "group relative bg-[#0f0f0f] rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer",
        selected ? "border-white/30 ring-1 ring-white/10" : "border-white/6 hover:border-white/12",
      )}
      style={{ boxShadow: active ? `0 0 0 1px ${hue.track}33, 0 8px 32px ${hue.glow}` : undefined }}
    >
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${hue.track}88, transparent)` }} />
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={cn(
                "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                selected ? "bg-white border-white" : "border-white/15 group-hover:border-white/30",
              )}
            >
              {selected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
            </button>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border",
                cfg.bg,
                cfg.border,
                cfg.color,
              )}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            {sketch.ai && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/5 border border-white/8 text-white/50">
                <Wand2 className="w-3 h-3" /> AI
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFav();
            }}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0",
              fav ? "text-rose-400" : "text-white/20 hover:text-white/50",
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", fav && "fill-current")} />
          </button>
        </div>
        <h3 className="font-semibold text-[15px] text-white leading-tight mb-1 truncate">{sketch.name}</h3>
        <p className="text-xs text-white/35 mb-4">{sketch.author?.userName ? `by ${sketch.author.userName} - ` : ""}{sketch.created}</p>
        <div className="h-10">
          <MiniWaveform data={sketch.waveform.slice(0, 40)} active={active} color={hue.track} height={40} />
        </div>
      </div>
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-3 text-xs text-white/35">
        <span>{fmt(sketch.duration)}</span>
        {sketch.bpm && (
          <>
            <span className="w-0.75 h-0.75 rounded-full bg-white/20" />
            <span>{sketch.bpm} bpm</span>
          </>
        )}
        {sketch.key && (
          <>
            <span className="w-0.75 h-0.75 rounded-full bg-white/20" />
            <span>
              {sketch.key} {sketch.scale}
            </span>
          </>
        )}
        <div className="ml-auto flex gap-1">
          {sketch.tags.slice(0, 2).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/30">
              #{t}
            </span>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="flex-1 h-9 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          style={{
            background: active ? hue.track : undefined,
            color: active ? "#000" : hue.track,
            border: active ? "none" : `1px solid ${hue.track}33`,
          }}
        >
          {active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {active ? "Pause" : "Play"}
        </button>
        <button className="h-9 w-9 rounded-xl bg-white/4 hover:bg-white/8 flex items-center justify-center transition-all text-white/40 hover:text-white/70">
          <Download className="w-3.5 h-3.5" />
        </button>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-9 w-9 rounded-xl bg-white/4 hover:bg-red-500/20 flex items-center justify-center transition-all text-white/40 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function SketchRow({
  sketch,
  active,
  fav,
  selected,
  onPlay,
  onFav,
  onSelect,
  onDelete,
}: {
  sketch: Sketch;
  active: boolean;
  fav: boolean;
  selected: boolean;
  canDelete: boolean;
  onPlay: () => void;
  onFav: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const cfg = TYPE_CONFIG[sketch.type];
  const hue = HUE_STYLES[sketch.hue];
  const Icon = TYPE_ICON_MAP[sketch.type] ?? AudioLines;
  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-150",
        selected ? "border-white/20 bg-white/4" : "border-transparent hover:bg-white/3",
        active && "border-white/10 bg-white/3",
      )}
    >
      <button
        onClick={onSelect}
        className={cn(
          "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
          selected ? "bg-white border-white" : "border-white/15 group-hover:border-white/30",
        )}
      >
        {selected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
      </button>
      <button
        onClick={onPlay}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
        style={{ background: active ? hue.track : "rgba(255,255,255,0.06)", color: active ? "#000" : hue.track }}
      >
        {active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="w-24 shrink-0 h-8 hidden sm:block">
        <MiniWaveform data={sketch.waveform.slice(0, 24)} active={active} color={hue.track} height={32} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-white truncate mb-1">{sketch.name}</div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
              cfg.bg,
              cfg.border,
              cfg.color,
            )}
          >
            <Icon className="w-2.5 h-2.5" />
            {cfg.label}
          </span>
          {sketch.tags.slice(0, 2).map((t) => (
            <span key={t} className="hidden md:inline px-1.5 py-0.5 rounded-md text-[10px] bg-white/5 text-white/30">
              #{t}
            </span>
          ))}
        </div>
      </div>
      <div className="hidden lg:flex items-center gap-6 text-xs text-white/35 shrink-0">
        <span className="font-mono">{fmt(sketch.duration)}</span>
        {sketch.bpm && <span>{sketch.bpm} bpm</span>}
        {sketch.key && (
          <span>
            {sketch.key} {sketch.scale}
          </span>
        )}
        <span className="text-white/20">{sketch.author?.userName ? `${sketch.author.userName} - ` : ""}{sketch.created}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onFav}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            fav ? "text-rose-400" : "text-white/25 hover:text-white/60",
          )}
        >
          <Heart className={cn("w-3.5 h-3.5", fav && "fill-current")} />
        </button>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 transition-all">
          <Download className="w-3.5 h-3.5" />
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function RecordingModal({
  format,
  onDone,
  onCancel,
}: {
  format: SketchType;
  onDone: (blob: Blob, name: string) => void;
  onCancel: () => void;
}) {
  const cfg = TYPE_CONFIG[format];
  const Icon = TYPE_ICON_MAP[format] ?? AudioLines;

  type Phase = "requesting" | "recording" | "paused" | "error";
  const [phase, setPhase] = useState<Phase>("requesting");
  const [duration, setDuration] = useState(0);
  const [errMsg, setErrMsg] = useState("");
  const [liveBars, setLiveBars] = useState<number[]>(Array(48).fill(2));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/ogg";

        const mr = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.start(100);

        setPhase("recording");

        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        function drawFrame() {
          animFrameRef.current = requestAnimationFrame(drawFrame);
          analyser.getByteFrequencyData(dataArr);
          const bars = Array.from({ length: 48 }, (_, i) => {
            const idx = Math.floor((i / 48) * dataArr.length);
            return Math.max(2, (dataArr[idx] / 255) * 100);
          });
          setLiveBars(bars);
        }
        drawFrame();
      } catch (e) {
        if (!cancelled) {
          setErrMsg(e instanceof Error ? e.message : "Microphone access denied");
          setPhase("error");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopAll();
    };
  }, [stopAll]);

  const handlePause = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (phase === "recording") {
      mr.pause();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setLiveBars(Array(48).fill(2));
      setPhase("paused");
    } else if (phase === "paused") {
      mr.resume();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      const analyser = analyserRef.current!;
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      function drawFrame() {
        animFrameRef.current = requestAnimationFrame(drawFrame);
        analyser.getByteFrequencyData(dataArr);
        setLiveBars(
          Array.from({ length: 48 }, (_, i) => {
            const idx = Math.floor((i / 48) * dataArr.length);
            return Math.max(2, (dataArr[idx] / 255) * 100);
          }),
        );
      }
      drawFrame();
      setPhase("recording");
    }
  };

  const handleStop = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      const mimeType = mr.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stopAll();
      const name = `${format}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;
      onDone(blob, name);
    };
    mr.stop();
  };

  const handleCancel = () => {
    stopAll();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={handleCancel} />
      <div className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {phase === "requesting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center animate-pulse">
              <Mic className="w-6 h-6 text-violet-400" />
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-white mb-1">Allow Microphone</div>
              <div className="text-sm text-white/40">Grant mic access in your browser to start recording</div>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
              <Mic className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-white mb-1">Microphone Error</div>
              <div className="text-sm text-red-400/80">{errMsg}</div>
            </div>
            <button
              onClick={handleCancel}
              className="h-10 px-5 rounded-xl bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all"
            >
              Close
            </button>
          </div>
        )}

        {(phase === "recording" || phase === "paused") && (
          <>
            <div className="flex items-center gap-2.5 mb-6">
              {phase === "recording" ? <RecordingPulse /> : <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
              <span className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                {phase === "recording" ? "Recording" : "Paused"} <Icon className="w-3.5 h-3.5" /> {cfg.label}
              </span>
            </div>

            <div className="text-center mb-6">
              <div className="text-6xl font-mono font-light tracking-tighter text-white mb-1">{fmt(duration)}</div>
              <div className="text-sm text-white/30">
                {format === "hum"
                  ? "Hum or sing your melody clearly"
                  : format === "voice"
                    ? "Sing or speak your idea"
                    : "Play your instrument"}
              </div>
            </div>

            <div className="h-16 mb-6 flex items-end justify-center gap-[2px] px-2">
              {liveBars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${h}%`,
                    background:
                      phase === "recording" ? `hsl(${260 + (h / 100) * 40}, 80%, ${50 + (h / 100) * 20}%)` : "rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>

            {duration >= 3 && (
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 text-xs text-white/30">
                  <Info className="w-3 h-3" />
                  {duration < 10
                    ? "Keep going for better analysis..."
                    : duration >= 55
                      ? "Approaching 60s limit"
                      : "Good length  -  stop when ready"}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handlePause}
                className="flex-1 h-12 rounded-xl bg-white/8 hover:bg-white/12 font-medium transition-all flex items-center justify-center gap-2 text-white/70 hover:text-white"
              >
                {phase === "paused" ? (
                  <>
                    <Play className="w-4 h-4" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                )}
              </button>
              <button
                onClick={handleStop}
                disabled={duration < 1}
                className="flex-1 h-12 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all flex items-center justify-center gap-2"
              >
                <StopCircle className="w-4 h-4" /> Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MusicalSketchbook() {
  const { sketches, communitySketches, deleteSketch, activeId, setActiveId, favs, toggleFav, loading, error, refresh } = useSketchbook();
  const { token } = useAuth();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [scope, setScope] = useState<"mine" | "community">("mine");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [showSort, setShowSort] = useState(false);
  const [recordingFormat, setRecordingFormat] = useState<SketchType | null>(null);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [analyzerSeed, setAnalyzerSeed] = useState<{ blob: Blob; name: string } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "g") setView((v) => (v === "grid" ? "list" : "grid"));
      if (e.key === "Escape") {
        setSelected(new Set());
        setActiveId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveId]);

  const handleScopeChange = (next: "mine" | "community") => {
    setScope(next);
    setSelected(new Set());
    setActiveId(null);
  };

  const startRecording = (format: SketchType) => setRecordingFormat(format);

  const handleRecordingDone = useCallback((blob: Blob, name: string) => {
    setRecordingFormat(null);
    setAnalyzerSeed({ blob, name });
    setShowAnalyzer(true);
  }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  const clearSelected = () => setSelected(new Set());

  const currentSketches = scope === "mine" ? sketches : communitySketches;

  const filtered = currentSketches
    .filter((s) => {
      if (filter === "favorites" && !favs.has(s.id)) return false;
      if (filter !== "all" && filter !== "favorites" && s.type !== filter) return false;
      if (query && !s.name.toLowerCase().includes(query.toLowerCase()) && !s.tags.some((t) => t.includes(query.toLowerCase())))
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "bpm") return (b.bpm ?? 0) - (a.bpm ?? 0);
      if (sort === "duration") return b.duration - a.duration;
      return 0;
    });

  const favoriteCount = currentSketches.filter((s) => favs.has(s.id)).length;
  const stats = [
    { label: "Total", value: currentSketches.length, icon: BookOpen },
    { label: "AI", value: currentSketches.filter((s) => s.ai).length, icon: Sparkles },
    { label: "Favorites", value: favoriteCount, icon: Heart },
    { label: "Duration", value: `${Math.round(currentSketches.reduce((a, s) => a + s.duration, 0))}s`, icon: Clock },
  ];

  const filterOptions = [
    { key: "all" as FilterKey, label: "All sketches", count: currentSketches.length },
    { key: "hum" as FilterKey, label: "Humming", count: currentSketches.filter((s) => s.type === "hum").length },
    { key: "voice" as FilterKey, label: "Voice", count: currentSketches.filter((s) => s.type === "voice").length },
    { key: "sample" as FilterKey, label: "Samples", count: currentSketches.filter((s) => s.type === "sample").length },
    { key: "upload" as FilterKey, label: "Uploads", count: currentSketches.filter((s) => s.type === "upload").length },
    { key: "favorites" as FilterKey, label: "Favorites", count: favoriteCount },
  ];

  const activeSketch = activeId ? (currentSketches.find((s) => s.id === activeId) ?? null) : null;
  const canDelete = scope === "mine";

  useEffect(() => {
    const cleanup = () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };

    if (!activeSketch) {
      cleanup();
      return;
    }

    const play = async () => {
      cleanup();

      if (activeSketch.audioFile) {
        const url = URL.createObjectURL(activeSketch.audioFile);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setActiveId(null);
        try {
          await audio.play();
        } catch {
          return;
        }
        return;
      }

      if (!activeSketch.audioUrl) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const headers: HeadersInit = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(resolveApiUrl(activeSketch.audioUrl), {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const blob = await response.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setActiveId(null);
        await audio.play();
      } catch {
        return;
      }
    };

    void play();
    return cleanup;
  }, [activeSketch, token, setActiveId]);

  return (
    <div className="min-h-screen pt-12 text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes pbar { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>

      <div className="max-w-350 mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sketchbook</h1>
            <p className="text-sm text-white/35 mt-0.5">Capture ideas before they escape</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleScopeChange("mine")}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-semibold transition-all border",
                  scope === "mine" ? "bg-white/15 text-white border-white/20" : "bg-white/5 text-white/50 border-white/10 hover:text-white",
                )}
              >
                My Sketches
              </button>
              <button
                onClick={() => handleScopeChange("community")}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-semibold transition-all border",
                  scope === "community" ? "bg-white/15 text-white border-white/20" : "bg-white/5 text-white/50 border-white/10 hover:text-white",
                )}
              >
                Community
              </button>
              <button
                onClick={refresh}
                className="h-8 px-3 rounded-lg text-xs font-semibold transition-all border bg-white/5 text-white/50 border-white/10 hover:text-white"
              >
                Refresh
              </button>
              {loading && <span className="text-xs text-white/30">Syncing...</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAnalyzer(true)}
              className="h-9 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 font-semibold text-sm transition-all flex items-center gap-2"
            >
              <AudioLines className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analyze Audio</span>
            </button>
            <button
              onClick={() => startRecording("hum")}
              className="h-9 px-4 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Record</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-rose-200">{error}</span>
            <button
              onClick={refresh}
              className="text-xs font-semibold text-rose-100/80 hover:text-rose-100 underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/3 border border-white/6 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon className="w-4 h-4 text-white/25 shrink-0" />
              <div>
                <div className="text-lg font-bold text-white leading-none">{value}</div>
                <div className="text-[11px] text-white/30 mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-64 xl:w-72 shrink-0 space-y-4">
            <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">New Recording</div>
              <div className="space-y-2">
                {(["hum", "voice", "sample"] as SketchType[]).map((type) => {
                  const cfg = TYPE_CONFIG[type];
                  const Icon = TYPE_ICON_MAP[type] ?? AudioLines;
                  return (
                    <button
                      key={type}
                      onClick={() => startRecording(type)}
                      className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all group", cfg.bg, cfg.border)}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/10", cfg.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</div>
                        <div className="text-[11px] text-white/30">
                          {type === "hum" ? "AI converts melody" : type === "voice" ? "Capture vocals" : "Record instruments"}
                        </div>
                      </div>
                      <Mic className={cn("w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity", cfg.color)} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-white/6">
                <button
                  onClick={() => setShowAnalyzer(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 hover:bg-emerald-500/15 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-400">
                    <AudioLines className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-emerald-400">Analyze File</div>
                    <div className="text-[11px] text-white/30">BPM  -  Key  -  MIDI export</div>
                  </div>
                  <Upload className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
                </button>
              </div>
            </div>

            <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Filter</div>
              <div className="space-y-0.5">
                {filterOptions.map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                      filter === key ? "bg-white/8 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/4",
                    )}
                  >
                    <span>{label}</span>
                    <span
                      className={cn("text-xs px-1.5 py-0.5 rounded-md", filter === key ? "bg-white/10 text-white/60" : "text-white/25")}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Shortcuts</div>
              <div className="space-y-2">
                {[
                  { keys: ["/"], label: "Search" },
                  { keys: ["G"], label: "Toggle view" },
                  { keys: ["Esc"], label: "Clear" },
                ].map(({ keys, label }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-white/30">{label}</span>
                    <Kbd keys={keys} />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search sketches, tags..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-10 bg-white/4 border border-white/8 rounded-xl pl-10 pr-4 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-all"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowSort(!showSort)}
                  className="h-10 px-3 rounded-xl bg-white/4 border border-white/8 text-sm text-white/50 hover:text-white/80 flex items-center gap-2 transition-all"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="capitalize">{sort}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showSort && "rotate-180")} />
                </button>
                {showSort && (
                  <div className="absolute right-0 top-full mt-1.5 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                    {(
                      [
                        ["recent", "Recent"],
                        ["oldest", "Oldest"],
                        ["name", "Name A-Z"],
                        ["bpm", "BPM"],
                        ["duration", "Duration"],
                      ] as [SortKey, string][]
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => {
                          setSort(val);
                          setShowSort(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-all",
                          sort === val ? "text-violet-400" : "text-white/50",
                        )}
                      >
                        {lbl}
                        {sort === val && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center bg-white/4 border border-white/8 rounded-xl p-1">
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      view === v ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60",
                    )}
                  >
                    {v === "grid" ? <Grid3x3 className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {canDelete && selected.size > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-white/4 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearSelected}
                    className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-white/50 hover:text-white transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm text-white/60">
                    <span className="text-white font-medium">{selected.size}</span> selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="h-8 px-3 rounded-lg bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                  <button className="h-8 px-3 rounded-lg bg-white/6 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Merge
                  </button>
                  <button
                    onClick={() => {
                      selected.forEach((id) => void deleteSketch(id));
                      clearSelected();
                    }}
                    className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-sm text-red-400 hover:text-red-300 transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}

            {query && (
              <div className="text-xs text-white/30 px-1">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} for <span className="text-white/50">&ldquo;{query}&rdquo;</span>
              </div>
            )}

            {view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((s) => (
                  <SketchCard
                    key={s.id}
                    sketch={s}
                    active={activeId === s.id}
                    fav={favs.has(s.id)}
                    selected={selected.has(s.id)}
                    canDelete={canDelete}
                    onPlay={() => setActiveId(activeId === s.id ? null : s.id)}
                    onFav={() => void toggleFav(s.id)}
                    onSelect={() => toggleSelect(s.id)}
                    onDelete={() => void deleteSketch(s.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white/2 border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4">
                {filtered.map((s) => (
                  <SketchRow
                    key={s.id}
                    sketch={s}
                    active={activeId === s.id}
                    fav={favs.has(s.id)}
                    selected={selected.has(s.id)}
                    canDelete={canDelete}
                    onPlay={() => setActiveId(activeId === s.id ? null : s.id)}
                    onFav={() => void toggleFav(s.id)}
                    onSelect={() => toggleSelect(s.id)}
                    onDelete={() => void deleteSketch(s.id)}
                  />
                ))}
              </div>
            )}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
                  <Music className="w-7 h-7 text-white/20" />
                </div>
                <h3 className="text-lg font-semibold text-white/70 mb-1">{query ? "No results found" : scope === "community" ? "No community sketches yet" : "No sketches yet"}</h3>
                <p className="text-sm text-white/30 mb-6 max-w-xs">
                  {query ? "Try a different search term" : scope === "community" ? "Share a public sketch to get the feed started" : "Record a melody or analyze an audio file to get started"}
                </p>
                {!query && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startRecording("hum")}
                      className="h-9 px-4 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm transition-all flex items-center gap-2"
                    >
                      <Mic className="w-3.5 h-3.5" /> Record
                    </button>
                    <button
                      onClick={() => setShowAnalyzer(true)}
                      className="h-9 px-4 rounded-xl bg-white/6 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white font-medium text-sm transition-all flex items-center gap-2"
                    >
                      <AudioLines className="w-3.5 h-3.5" /> Analyze File
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {recordingFormat && (
        <RecordingModal format={recordingFormat} onDone={handleRecordingDone} onCancel={() => setRecordingFormat(null)} />
      )}
      {showAnalyzer && (
        <AnalyzerModal
          onClose={() => {
            setShowAnalyzer(false);
            setAnalyzerSeed(null);
          }}
          seed={analyzerSeed}
        />
      )}

      {activeSketch &&
        (() => {
          const hue = HUE_STYLES[activeSketch.hue];
          return (
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="max-w-350 mx-auto px-4 pb-4">
                <div
                  className="rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-4 backdrop-blur-xl"
                  style={{ background: "rgba(12,12,12,0.95)", boxShadow: `0 -1px 0 ${hue.track}22, 0 -16px 40px rgba(0,0,0,0.5)` }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${hue.track}22`, border: `1px solid ${hue.track}33` }}
                  >
                    <Music className="w-4 h-4" style={{ color: hue.track }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{activeSketch.name}</div>
                    <div className="text-xs text-white/35">
                      {[activeSketch.bpm && `${activeSketch.bpm} bpm`, activeSketch.key && `${activeSketch.key} ${activeSketch.scale}`]
                        .filter(Boolean)
                        .join("  -  ")}
                    </div>
                  </div>
                  <div className="hidden md:block w-48 h-8">
                    <MiniWaveform data={activeSketch.waveform.slice(0, 40)} active={true} color={hue.track} height={32} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveId(null)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveId(null)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}







































