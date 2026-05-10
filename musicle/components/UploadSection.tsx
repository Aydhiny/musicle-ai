// src/components/UploadSection.tsx
import React, { useRef } from "react";
import { Upload, Loader2, Brain, Activity, Target } from "lucide-react";

interface UploadSectionProps {
  isUploading: boolean;
  progress: number;
  error: string | null;
  onFileSelect: (file: File) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ isUploading, progress, error, onFileSelect }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onFileSelect(file);
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="text-center mb-12 space-y-6 animate-fade-in">
        <h1 className="text-7xl font-bold leading-tight">
          <span className="bg-gradient-to-t from-purple-700 to-purple-300 bg-clip-text text-transparent">MUSICLE</span>
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto">
          Upload your track for instant ML-powered analysis with genre detection, commercial scoring, and actionable insights
        </p>
      </div>

      <div className="w-full max-w-5xl" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <div className="bg-gradient-to-br from-[#121212] to-[#1a1a2e] border-2 border-dashed border-gray-700 rounded-3xl p-24 text-center hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300">
          {isUploading ? (
            <div className="flex flex-col items-center gap-8">
              <div className="relative">
                <Loader2 className="w-20 h-20 text-purple-400 animate-spin" />
                <Brain className="w-10 h-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-300" />
                <div className="absolute inset-0 bg-purple-400/20 blur-2xl rounded-full animate-pulse"></div>
              </div>
              <div>
                <p className="text-2xl font-bold mb-2">Analyzing Your Track</p>
                <p className="text-purple-400 font-mono text-sm mb-4">Processing audio features...</p>
                <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-2">{Math.round(progress)}% complete</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8">
              <div className="relative">
                <Upload className="w-20 h-20 text-purple-400" />
                <div className="absolute inset-0 bg-purple-400/20 blur-2xl rounded-full"></div>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  Drop audio file or{" "}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
                  >
                    browse
                  </button>
                </h3>
                <p className="text-gray-500">Supports MP3, WAV, OGG, M4A • Max 50MB</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  Waveform Analysis
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-3 h-3" />
                  ML Classification
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3" />
                  Market Insights
                </div>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            className="hidden"
            accept="audio/*"
          />
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 max-w-md">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};
