// src/hooks/useAnalysis.ts
import { analysisApi } from "@/services/api";
import { signalRService } from "@/services/signalr";
import { AnalysisProgressUpdate, AnalysisResponse } from "@/types/analysis.types";
import { useState, useEffect, useCallback } from "react";

export const useAnalysis = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const getUploadErrorMessage = (err: unknown) => {
    if (typeof err === "object" && err !== null) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      if (response?.data?.error) return response.data.error;
    }
    if (err instanceof Error) return err.message;
    return "Upload failed";
  };

  // Connect to SignalR on mount
  useEffect(() => {
    let isMounted = true;

    const connect = async () => {
      try {
        await signalRService.connect();
        if (isMounted) {
          setIsConnected(true);
        }
      } catch (err) {
        console.error("Failed to connect SignalR:", err);
        if (isMounted) {
          setError("Failed to connect to real-time updates");
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      signalRService.disconnect();
    };
  }, []);

  // Handle SignalR updates
  useEffect(() => {
    if (!isConnected || !currentTrackId) return;

    const handleAnalysisCompleted = async (data: AnalysisProgressUpdate) => {
      console.log("Analysis completed:", data);

      if (data.trackId === currentTrackId) {
        setProgress(100);
        // Fetch full analysis result
        try {
          const result = await analysisApi.getAnalysis(data.trackId);
          setAnalysisResult(result);
          setIsUploading(false);
        } catch (err) {
          console.error("Failed to fetch analysis:", err);
          setError("Failed to fetch analysis results");
          setIsUploading(false);
        }
      }
    };

    signalRService.onAnalysisCompleted(handleAnalysisCompleted);

    return () => {
      signalRService.offAnalysisCompleted(handleAnalysisCompleted);
    };
  }, [isConnected, currentTrackId]);

  const fetchAnalysis = useCallback(async (trackId: string) => {
    try {
      const result = await analysisApi.getAnalysis(trackId);
      setAnalysisResult(result);
      return result;
    } catch (err) {
      console.error("Failed to fetch analysis:", err);
      setError("Failed to fetch analysis results");
      return null;
    }
  }, []);

  const uploadTrack = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);
      setAnalysisResult(null);
      setProgress(0);

      try {
        // Upload file
        const { trackId } = await analysisApi.uploadTrack(file);
        setCurrentTrackId(trackId);
        setProgress(10);

        // Subscribe to real-time updates
        if (signalRService.isConnected()) {
          await signalRService.subscribeToTrack(trackId);
        }

        // Simulate progress
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + Math.random() * 10, 90));
        }, 500);

        // Poll for result while waiting
        const pollInterval = setInterval(async () => {
          try {
            const result = await analysisApi.getAnalysis(trackId);

            if (result.status === "Completed") {
              clearInterval(pollInterval);
              clearInterval(progressInterval);
              setProgress(100);
              setAnalysisResult(result);
              setIsUploading(false);
            } else if (result.status === "Failed") {
              clearInterval(pollInterval);
              clearInterval(progressInterval);
              setError("Analysis failed");
              setIsUploading(false);
            }
          } catch {
            // Still processing, continue polling
          }
        }, 2000);

        // Cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          clearInterval(progressInterval);
          if (isUploading) {
            setError("Analysis timeout - please try again");
            setIsUploading(false);
          }
        }, 5 * 60 * 1000);
      } catch (err: unknown) {
        console.error("Upload failed:", err);
        setError(getUploadErrorMessage(err));
        setIsUploading(false);
        setProgress(0);
      }
    },
    [isUploading]
  );

  const reset = useCallback(async () => {
    if (currentTrackId && signalRService.isConnected()) {
      await signalRService.unsubscribeFromTrack(currentTrackId);
    }
    setCurrentTrackId(null);
    setAnalysisResult(null);
    setError(null);
    setIsUploading(false);
    setProgress(0);
  }, [currentTrackId]);

  return {
    isConnected,
    isUploading,
    progress,
    analysisResult,
    error,
    uploadTrack,
    fetchAnalysis,
    reset,
  };
};
