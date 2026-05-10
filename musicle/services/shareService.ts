import { AnalysisResult } from "@/interfaces/AudioInterfaces";

export class ShareService {
  static async copyToClipboard(trackId: string): Promise<boolean> {
    const shareUrl = `${window.location.origin}/analysis/${trackId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch (err) {
      console.error("Failed to copy:", err);
      return false;
    }
  }

  static downloadReport(result: AnalysisResult): void {
    const report = {
      fileName: result.fileName,
      analysis: {
        genre: result.analysis.genre,
        subgenre: result.analysis.subgenre,
        confidence: result.analysis.confidence,
        scores: {
          commercial: result.analysis.commercialScore,
          production: result.analysis.productionScore,
          viral: result.analysis.viralPotential,
        },
        characteristics: result.analysis.characteristics,
        strengths: result.analysis.strengths,
        improvements: result.analysis.improvements,
      },
      analyzedAt: result.analysis.analyzedAt,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.fileName}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
