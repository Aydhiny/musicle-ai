export interface AnalysisArtInput {
  title: string;
  genre: string;
  subgenre?: string | null;
  commercialScore: number;
  productionScore: number;
  viralScore: number;
  confidence: number;
}

const PALETTES = [
  ["#7c3aed", "#ec4899", "#0f172a"],
  ["#22d3ee", "#6366f1", "#0b1020"],
  ["#f97316", "#f43f5e", "#0f172a"],
  ["#10b981", "#3b82f6", "#0b1120"],
  ["#facc15", "#f97316", "#111827"],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickPalette(seed: string): string[] {
  const idx = hashString(seed) % PALETTES.length;
  return PALETTES[idx];
}

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildAnalysisCoverSvg(input: AnalysisArtInput): string {
  const [c1, c2, c3] = pickPalette(`${input.genre}-${input.subgenre ?? ""}`);
  const score = ((input.commercialScore + input.productionScore + input.viralScore) / 3).toFixed(1);
  const subtitle = input.subgenre ? `${input.genre} / ${input.subgenre}` : input.genre;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.2" cy="0.2" r="0.8">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" rx="64" fill="url(#bg)"/>
  <rect width="1200" height="1200" rx="64" fill="url(#glow)"/>
  <g fill="#ffffff" font-family="'DM Sans', Arial, sans-serif">
    <text x="80" y="140" font-size="36" opacity="0.7">Musicle Analysis</text>
    <text x="80" y="220" font-size="56" font-weight="700">${input.title}</text>
    <text x="80" y="280" font-size="32" opacity="0.75">${subtitle}</text>
  </g>
  <g fill="#ffffff" font-family="'DM Sans', Arial, sans-serif">
    <text x="80" y="420" font-size="22" opacity="0.7">Overall Score</text>
    <text x="80" y="500" font-size="92" font-weight="700">${score}</text>
    <text x="80" y="560" font-size="26" opacity="0.7">Confidence ${input.confidence}%</text>
  </g>
  <g fill="#ffffff" font-family="'DM Sans', Arial, sans-serif" opacity="0.9">
    <text x="80" y="700" font-size="26">Commercial ${input.commercialScore.toFixed(1)}</text>
    <text x="80" y="750" font-size="26">Production ${input.productionScore.toFixed(1)}</text>
    <text x="80" y="800" font-size="26">Viral ${input.viralScore.toFixed(1)}</text>
  </g>
</svg>`;
}

export function buildScorecardSvg(input: AnalysisArtInput): string {
  const [c1, c2] = pickPalette(input.genre);
  const subtitle = input.subgenre ? `${input.genre} / ${input.subgenre}` : input.genre;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="800" viewBox="0 0 1400 800">
  <defs>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="800" rx="48" fill="#0f172a"/>
  <rect x="40" y="40" width="1320" height="720" rx="40" fill="url(#card)" opacity="0.15"/>
  <g fill="#ffffff" font-family="'DM Sans', Arial, sans-serif">
    <text x="80" y="140" font-size="28" opacity="0.7">Musicle Scorecard</text>
    <text x="80" y="220" font-size="52" font-weight="700">${input.title}</text>
    <text x="80" y="270" font-size="30" opacity="0.75">${subtitle}</text>
  </g>
  <g fill="#ffffff" font-family="'DM Sans', Arial, sans-serif">
    <text x="80" y="380" font-size="22" opacity="0.7">Scores</text>
    <text x="80" y="450" font-size="64" font-weight="700">${input.commercialScore.toFixed(1)}</text>
    <text x="300" y="450" font-size="64" font-weight="700">${input.productionScore.toFixed(1)}</text>
    <text x="520" y="450" font-size="64" font-weight="700">${input.viralScore.toFixed(1)}</text>
    <text x="80" y="500" font-size="20" opacity="0.7">Commercial</text>
    <text x="300" y="500" font-size="20" opacity="0.7">Production</text>
    <text x="520" y="500" font-size="20" opacity="0.7">Viral</text>
  </g>
  <g fill="#ffffff" font-family="'DM Sans', Arial, sans-serif">
    <text x="80" y="610" font-size="24" opacity="0.7">Confidence</text>
    <text x="80" y="670" font-size="46" font-weight="700">${input.confidence}%</text>
  </g>
</svg>`;
}

export function makeAnalysisCoverArt(input: AnalysisArtInput): { svg: string; dataUrl: string } {
  const svg = buildAnalysisCoverSvg(input);
  return { svg, dataUrl: encodeSvg(svg) };
}

export function makeScorecard(input: AnalysisArtInput): { svg: string; dataUrl: string } {
  const svg = buildScorecardSvg(input);
  return { svg, dataUrl: encodeSvg(svg) };
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
