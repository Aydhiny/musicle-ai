// src/services/api.service.ts
import axios from "axios";
import { AnalysisResponse, UploadResponse, RecentTrack } from "../types/analysis.types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:5001";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const analysisApi = {
  /**
   * Upload audio file for analysis
   */
  async uploadTrack(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<UploadResponse>("/api/analysis/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  /**
   * Get analysis result for a specific track
   */
  async getAnalysis(trackId: string): Promise<AnalysisResponse> {
    const response = await api.get<AnalysisResponse>(`/api/analysis/${trackId}`);
    return response.data;
  },

  /**
   * Get recently uploaded tracks
   */
  async getRecentTracks(count: number = 10): Promise<{ tracks: RecentTrack[]; count: number }> {
    const response = await api.get<{ tracks: RecentTrack[]; count: number }>(`/api/analysis/recent?count=${count}`);
    return response.data;
  },

  /**
   * Delete a track
   */
  async deleteTrack(trackId: string): Promise<void> {
    await api.delete(`/api/analysis/${trackId}`);
  },
};
