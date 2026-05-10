"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  deleteSketch as deleteSketchApi,
  getMySketches,
  getSketchFeed,
  SketchViewDto,
  toggleSketchFavorite as toggleSketchFavoriteApi,
  uploadSketch as uploadSketchApi,
} from "@/services/backendApi";

export type SketchType = "hum" | "voice" | "sample" | "upload";
export type HueKey = "purple" | "blue" | "amber" | "emerald" | "violet" | "orange";

export interface SketchAuthor {
  id: string;
  userName: string;
  bio?: string | null;
}

export interface Sketch {
  id: string;
  name: string;
  type: SketchType;
  duration: number;
  bpm: number | null;
  key: string | null;
  scale: string | null;
  created: string;
  waveform: number[];
  ai: boolean;
  tags: string[];
  fav: boolean;
  hue: HueKey;
  audioUrl?: string;
  audioFile?: File;
  audioBuffer?: AudioBuffer;
  createdAt?: string;
  isPublic?: boolean;
  author?: SketchAuthor;
}

export interface AnalysisResult {
  bpm: number;
  key: string;
  scale: string;
  duration: number;
  sampleRate: number;
  waveform: number[];
  pitchNotes: PitchNote[];
  beats: number[];
}

export interface PitchNote {
  time: number;
  note: string;
  midi: number;
  freq: number;
  duration: number;
}

export interface NewSketchInput {
  file: File;
  name: string;
  type: SketchType;
  duration: number;
  bpm?: number | null;
  key?: string | null;
  scale?: string | null;
  tags?: string[];
  waveform?: number[];
  hue?: HueKey;
  isAi?: boolean;
  isFavorite?: boolean;
  isPublic?: boolean;
}

interface SketchbookCtx {
  sketches: Sketch[];
  communitySketches: Sketch[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addSketch: (input: NewSketchInput) => Promise<Sketch | null>;
  deleteSketch: (id: string) => Promise<void>;
  updateSketch: (id: string, patch: Partial<Sketch>) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  favs: Set<string>;
  toggleFav: (id: string) => Promise<void>;
}

const Ctx = createContext<SketchbookCtx | null>(null);

export function useSketchbook() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSketchbook must be used inside SketchbookProvider");
  return ctx;
}

const HUES: HueKey[] = ["purple", "blue", "amber", "emerald", "violet", "orange"];

export function SketchbookProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [communitySketches, setCommunitySketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const favs = useMemo(() => new Set(sketches.filter((s) => s.fav).map((s) => s.id)), [sketches]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const feedPromise = getSketchFeed(1, 24);
      const minePromise = token ? getMySketches(token, 1, 100) : Promise.resolve(null);
      const [feed, mine] = await Promise.all([feedPromise, minePromise]);

      const community = feed.sketches.map((s) => mapSketchDto(s));
      setCommunitySketches(community);

      if (mine) {
        setSketches(mine.sketches.map((s) => mapSketchDto(s)));
      } else {
        setSketches([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sketchbook");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSketch = useCallback(
    async (input: NewSketchInput) => {
      if (!token) {
        setError("Sign in to save sketches.");
        return null;
      }

      const form = new FormData();
      form.append("file", input.file, input.file.name);
      form.append("Name", input.name);
      form.append("Type", input.type);
      form.append("DurationSeconds", String(input.duration));
      if (input.bpm != null) form.append("Bpm", String(input.bpm));
      if (input.key) form.append("Key", input.key);
      if (input.scale) form.append("Scale", input.scale);
      if (input.hue) form.append("Hue", input.hue);
      form.append("IsAi", String(Boolean(input.isAi)));
      form.append("IsFavorite", String(Boolean(input.isFavorite)));
      form.append("IsPublic", String(input.isPublic ?? true));
      form.append("TagsJson", JSON.stringify(input.tags ?? []));
      form.append("WaveformJson", JSON.stringify(input.waveform ?? []));

      try {
        const saved = await uploadSketchApi(form, token);
        const mapped = mapSketchDto(saved);
        setSketches((prev) => [mapped, ...prev]);
        if (mapped.isPublic) {
          setCommunitySketches((prev) => [mapped, ...prev]);
        }
        return mapped;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload sketch");
        return null;
      }
    },
    [token],
  );

  const deleteSketch = useCallback(
    async (id: string) => {
      if (!token) {
        setError("Sign in to delete sketches.");
        return;
      }

      try {
        await deleteSketchApi(id, token);
        setSketches((prev) => prev.filter((s) => s.id !== id));
        setCommunitySketches((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete sketch");
      }
    },
    [token],
  );

  const updateSketch = useCallback((id: string, patch: Partial<Sketch>) => {
    setSketches((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setCommunitySketches((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const toggleFav = useCallback(
    async (id: string) => {
      if (!token) {
        setError("Sign in to favorite sketches.");
        return;
      }

      try {
        const result = await toggleSketchFavoriteApi(id, token);
        updateSketch(id, { fav: result.isFavorite });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update favorite");
      }
    },
    [token, updateSketch],
  );

  return (
    <Ctx.Provider
      value={{
        sketches,
        communitySketches,
        loading,
        error,
        refresh,
        addSketch,
        deleteSketch,
        updateSketch,
        activeId,
        setActiveId,
        favs,
        toggleFav,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

function mapSketchDto(dto: SketchViewDto): Sketch {
  const hue = isHueKey(dto.hue) ? dto.hue : "purple";
  const createdAt = dto.createdAt ? new Date(dto.createdAt) : null;

  return {
    id: dto.id,
    name: dto.name,
    type: dto.type as SketchType,
    duration: dto.durationSeconds,
    bpm: dto.bpm ?? null,
    key: dto.key ?? null,
    scale: dto.scale ?? null,
    created: createdAt ? formatRelativeTime(createdAt) : "",
    waveform: dto.waveform ?? [],
    ai: dto.isAi,
    tags: dto.tags ?? [],
    fav: dto.isFavorite,
    hue,
    audioUrl: dto.audioUrl ?? undefined,
    createdAt: dto.createdAt,
    isPublic: dto.isPublic,
    author: dto.author
      ? {
          id: dto.author.id,
          userName: dto.author.userName,
          bio: dto.author.bio ?? null,
        }
      : undefined,
  };
}

function isHueKey(value: string): value is HueKey {
  return (HUES as string[]).includes(value);
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const HUES_LIST = HUES;

export const TYPE_CONFIG: Record<SketchType, { label: string; color: string; bg: string; border: string; hue: HueKey }> = {
  hum: { label: "Humming", color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20", hue: "purple" },
  voice: { label: "Voice", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20", hue: "blue" },
  sample: { label: "Sample", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", hue: "amber" },
  upload: { label: "Upload", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", hue: "emerald" },
};

export const HUE_STYLES: Record<HueKey, { track: string; glow: string }> = {
  purple: { track: "#a78bfa", glow: "rgba(167,139,250,0.15)" },
  blue: { track: "#38bdf8", glow: "rgba(56,189,248,0.15)" },
  amber: { track: "#fbbf24", glow: "rgba(251,191,36,0.15)" },
  emerald: { track: "#34d399", glow: "rgba(52,211,153,0.15)" },
  violet: { track: "#c084fc", glow: "rgba(192,132,252,0.15)" },
  orange: { track: "#fb923c", glow: "rgba(251,146,60,0.15)" },
};

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const cn = (...cls: (string | false | undefined | null)[]) => cls.filter(Boolean).join(" ");

export function nextHue(sketches: Sketch[]): HueKey {
  return HUES[sketches.length % HUES.length];
}
