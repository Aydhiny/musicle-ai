import { Check, Copy, Download } from "lucide-react";

interface ShareMenuProps {
  show: boolean;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ show, onCopy, onDownload, copied }) => {
  if (!show) return null;

  return (
    <div className="absolute right-0 top-full mt-2 bg-gradient-to-br from-[#121212] to-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px] z-50">
      <button onClick={onCopy} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-all">
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
      <button
        onClick={onDownload}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-all border-t border-white/10"
      >
        <Download className="w-4 h-4" />
        Download Report
      </button>
    </div>
  );
};
