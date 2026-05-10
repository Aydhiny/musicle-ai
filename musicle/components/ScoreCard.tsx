import { getScoreColor } from "@/utils/getScoreColor";

interface ScoreCardProps {
  icon: React.ReactNode;
  title: string;
  score: number;
  subtitle: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ icon, title, score, subtitle }) => (
  <div className={`bg-gradient-to-br ${getScoreColor(score)} p-6 rounded-2xl border backdrop-blur-sm hover:scale-105 transition-all`}>
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <div className="text-xs font-semibold">{title}</div>
    </div>
    <div className="text-5xl font-bold mb-1">{score}/10</div>
    <div className="text-xs opacity-80">{subtitle}</div>
  </div>
);
