export interface Characteristics {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  loudness: number;
  speechiness: number;
  instrumentalness: number;
  spectralCentroid: number;
  dynamicRange: number;
}

export interface AnalysisData {
  genre: string;
  subgenre: string;
  confidence: number;
  commercialScore: number;
  productionScore: number;
  viralPotential: number;
  characteristics: Characteristics;
  strengths: string[];
  improvements: string[];
  analyzedAt: string;
}

export interface AnalysisResponse {
  trackId: string;
  fileName: string;
  status: "Queued" | "Processing" | "Completed" | "Failed";
  uploadedAt: string;
  analysis?: AnalysisData;
}

export interface UploadResponse {
  trackId: string;
  fileName: string;
  status: string;
  uploadedAt: string;
}

export interface RecentTrack {
  trackId: string;
  fileName: string;
  status: string;
  uploadedAt: string;
  genre?: string;
  subgenre?: string;
  confidence?: number;
}

export interface AnalysisProgressUpdate {
  trackId: string;
  fileName: string;
  genre: string;
  subgenre: string;
  confidence: number;
  commercialScore: number;
  productionScore: number;
  viralPotential: number;
  status: string;
  processedAt: string;
}
