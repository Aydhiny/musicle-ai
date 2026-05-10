export interface AudioCharacteristics {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  loudness: number;
  speechiness: number;
  instrumentalness: number;
  spectralCentroid: number;
}

export interface Analysis {
  genre: string;
  subgenre: string;
  confidence: number;
  commercialScore: number;
  productionScore: number;
  viralPotential: number;
  characteristics: AudioCharacteristics;
  strengths: string[];
  improvements: string[];
  analyzedAt: string;
}

export interface AnalysisResult {
  trackId: string;
  fileName: string;
  uploadedAt: string;
  audioUrl?: string;
  analysis: Analysis;
}
