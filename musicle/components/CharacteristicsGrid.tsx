import { AudioCharacteristics } from "@/interfaces/AudioInterfaces";

interface CharacteristicsGridProps {
  characteristics: AudioCharacteristics;
}

export const CharacteristicsGrid: React.FC<CharacteristicsGridProps> = ({ characteristics }) => {
  const items = [
    { label: "Tempo", value: characteristics.tempo.toFixed(0), unit: "BPM", color: "purple" },
    { label: "Energy", value: (characteristics.energy * 100).toFixed(0), unit: "%", color: "pink" },
    { label: "Danceability", value: (characteristics.danceability * 100).toFixed(0), unit: "%", color: "blue" },
    { label: "Valence", value: (characteristics.valence * 100).toFixed(0), unit: "%", color: "emerald" },
    { label: "Acousticness", value: (characteristics.acousticness * 100).toFixed(0), unit: "%", color: "amber" },
    { label: "Loudness", value: characteristics.loudness.toFixed(0), unit: "dB", color: "rose" },
    { label: "Speechiness", value: (characteristics.speechiness * 100).toFixed(0), unit: "%", color: "cyan" },
    { label: "Instrumental", value: (characteristics.instrumentalness * 100).toFixed(0), unit: "%", color: "violet" },
    { label: "Spectral", value: characteristics.spectralCentroid.toFixed(0), unit: "Hz", color: "fuchsia" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-gradient-to-br from-white/5 to-transparent rounded-xl p-5 border border-white/5 hover:border-purple-500/30 transition-all group"
        >
          <div className="text-xs text-gray-500 mb-2">{item.label}</div>
          <div className={`text-3xl font-bold text-${item.color}-400 group-hover:scale-110 transition-transform`}>{item.value}</div>
          <div className="text-xs text-gray-500 mt-1">{item.unit}</div>
        </div>
      ))}
    </div>
  );
};
