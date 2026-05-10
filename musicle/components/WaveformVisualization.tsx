import { generateWaveformData } from "@/utils/getScoreColor";
import { useState } from "react";

export const WaveformVisualization: React.FC = () => {
  const [waveformData] = useState(() => generateWaveformData());

  return (
    <div className="mt-6 p-4 bg-black/30 rounded-xl border border-white/10">
      <div className="flex items-end justify-between h-24 gap-1">
        {waveformData.map((height, i) => (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-purple-600 to-pink-500 rounded-t-sm opacity-70 hover:opacity-100 transition-opacity"
            style={{
              height: `${height}%`,
              animationDelay: `${i * 20}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
