// essentia.d.ts
// Place this in your project root or src/ folder.
// essentia.js ships no bundled .d.ts so we declare the modules manually.

declare module "essentia.js/dist/essentia-wasm.web.js" {
  const EssentiaWASM: () => Promise<unknown>;
  export default EssentiaWASM;
}

declare module "essentia.js" {
  export class Essentia {
    constructor(wasmModule: unknown);
    arrayToVector(array: Float32Array): unknown;
    vectorToArray(vector: unknown): Float32Array;
    RhythmExtractor2013(signal: unknown, sampleRate: number): { bpm: number; ticks: unknown; confidence: number };
    KeyExtractor(
      signal: unknown,
      averageDetuningCorrection: boolean,
      frameSize: number,
      hopSize: number,
      hpcp_size: number,
      maxFrequency: number,
      maximumSpectralPeaks: number,
      minFrequency: number,
      pcpSize: number,
      profileType: string,
      sampleRate: number,
      spectralPeaksThreshold: number,
      tuningFrequency: number,
      weightType: number,
      windowType: string,
    ): { key: string; scale: string; strength: number };
  }
}
