using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;
using AiAgents.MusicAgent.ML;
using NAudio.Dsp;
using NAudio.Wave;

namespace AiAgents.MusicAgent.Application.Services
{
    /// <summary>
    /// Two-stage feature extraction pipeline:
    ///   Stage 1 — Signal processing: Tempo, Energy, Loudness, ZCR, Spectral
    ///             Centroid, Instrumentalness (via FFT spectral flatness).
    ///             These are the raw physical measurements.
    ///   Stage 2 — ML enrichment: Danceability, Valence, Acousticness, Speechiness
    ///             are predicted by LightGBM regression models trained on Spotify
    ///             data rather than computed by hand-written formulas.
    /// </summary>
    public class AudioFeatureExtractor : IAudioFeatureExtractor
    {
        private const int FftSize = 4096;   // must be power of 2
        private const int FftM = 12;        // log2(4096)

        private readonly ILogger<AudioFeatureExtractor> _logger;
        private readonly AudioFeatureLearner _featureLearner;

        public AudioFeatureExtractor(
            ILogger<AudioFeatureExtractor> logger,
            AudioFeatureLearner featureLearner)
        {
            _logger = logger;
            _featureLearner = featureLearner;
        }

        public async Task<Characteristics> ExtractFeaturesAsync(byte[] audioData, string fileName)
        {
            _logger.LogInformation("Extracting features from {FileName} ({Size} bytes)", fileName, audioData.Length);

            try
            {
                using var ms = new MemoryStream(audioData);
                using var reader = GetAudioReader(ms, fileName);

                var waveFormat = reader.WaveFormat;
                _logger.LogInformation("Audio: {Encoding} {SampleRate}Hz {Channels}ch {Duration}",
                    waveFormat.Encoding, waveFormat.SampleRate, waveFormat.Channels, reader.TotalTime);

                var samples = ReadMonoSamples(reader);
                _logger.LogInformation("Read {Count} mono samples", samples.Length);

                // --- compute FFT frames once, reuse for all spectral features ---
                var spectral = ComputeSpectralFeatures(samples, waveFormat.SampleRate);

                var tempo            = EstimateTempo(samples, waveFormat.SampleRate);
                var energy           = CalculateEnergy(samples, spectral.SpectralFlatness);
                var loudness         = CalculateLoudness(samples);
                var zcr              = CalculateZeroCrossingRate(samples);
                var instrumentalness = spectral.Instrumentalness;

                // Stage 1 result — raw signals + FFT-derived instrumentalness.
                // Danceability/Valence/Acousticness/Speechiness are seeded with
                // signal-processing fallbacks; Stage 2 overwrites them with ML predictions.
                var characteristics = new Characteristics
                {
                    Tempo             = tempo,
                    Energy            = energy,
                    Loudness          = loudness,
                    Instrumentalness  = instrumentalness,
                    SpectralCentroid  = spectral.SpectralCentroid,
                    ZeroCrossingRate  = zcr,

                    // Fallbacks (overwritten by ML below if models are ready)
                    Danceability  = CalculateDanceability(tempo, energy, zcr),
                    Valence       = CalculateValence(energy, spectral.SpectralCentroid),
                    Acousticness  = CalculateAcousticness(spectral.SpectralCentroid, energy, spectral.SpectralFlatness),
                    Speechiness   = CalculateSpeechiness(zcr, spectral.SpectralCentroid, instrumentalness),
                };

                // Stage 2 — ML enrichment: replace formula-derived features with
                // LightGBM regression predictions trained on Spotify ground-truth labels.
                _featureLearner.EnrichFeatures(characteristics);

                _logger.LogInformation(
                    "Features [ML]: Tempo={Tempo:F1} Energy={Energy:F2} Danceability={Dance:F2} " +
                    "Valence={Val:F2} Acousticness={Ac:F2} Speechiness={Speech:F2} Instrumentalness={Inst:F2}",
                    tempo, energy, characteristics.Danceability, characteristics.Valence,
                    characteristics.Acousticness, characteristics.Speechiness, instrumentalness);

                return characteristics;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting features from audio");
                throw;
            }
        }

        // ─── Spectral analysis (FFT) ─────────────────────────────────────────────

        private record SpectralFeatures(double SpectralCentroid, double SpectralFlatness, double Instrumentalness);

        /// <summary>
        /// Computes real FFT across several windows and averages the results.
        /// Returns spectral centroid (Hz), spectral flatness (Wiener entropy),
        /// and instrumentalness derived from flatness.
        /// </summary>
        private SpectralFeatures ComputeSpectralFeatures(float[] samples, int sampleRate)
        {
            if (samples.Length < FftSize)
                return new SpectralFeatures(2000, 0.5, 0.5);

            var centroids  = new List<double>();
            var flatnesses = new List<double>();

            // Stride through the audio in 50% overlap windows
            int step = FftSize / 2;
            // Skip first and last 10% to avoid silence/fade artifacts
            int startIdx = samples.Length / 10;
            int endIdx   = samples.Length - samples.Length / 10 - FftSize;

            for (int offset = startIdx; offset < endIdx; offset += step)
            {
                var frame = new Complex[FftSize];
                for (int i = 0; i < FftSize; i++)
                {
                    // Hann window reduces spectral leakage
                    float window = 0.5f * (1f - (float)Math.Cos(2.0 * Math.PI * i / (FftSize - 1)));
                    frame[i] = new Complex { X = samples[offset + i] * window, Y = 0 };
                }

                FastFourierTransform.FFT(true, FftM, frame);

                int halfSize = FftSize / 2;
                var magnitudes = new double[halfSize];
                for (int i = 0; i < halfSize; i++)
                    magnitudes[i] = Math.Sqrt(frame[i].X * frame[i].X + frame[i].Y * frame[i].Y);

                // Spectral centroid
                double weightedFreq = 0, totalMag = 0;
                for (int i = 1; i < halfSize; i++)   // skip DC at i=0
                {
                    double freq = (double)i * sampleRate / FftSize;
                    weightedFreq += freq * magnitudes[i];
                    totalMag     += magnitudes[i];
                }
                if (totalMag > 1e-10)
                    centroids.Add(weightedFreq / totalMag);

                // Spectral flatness (Wiener entropy): geometric/arithmetic mean of spectrum
                // High flatness → noise-like (speech, percussion)
                // Low flatness  → tonal/harmonic (instruments, classical)
                double logSum = 0;
                double arithSum = 0;
                int nonZero = 0;
                for (int i = 1; i < halfSize; i++)
                {
                    double m = magnitudes[i] + 1e-12;
                    logSum   += Math.Log(m);
                    arithSum += m;
                    nonZero++;
                }
                if (nonZero > 0)
                {
                    double geoMean   = Math.Exp(logSum / nonZero);
                    double arithMean = arithSum / nonZero;
                    flatnesses.Add(arithMean > 0 ? geoMean / arithMean : 0);
                }
            }

            double centroid = centroids.Count > 0 ? centroids.Average() : 2000;
            double flatness = flatnesses.Count > 0 ? flatnesses.Average() : 0.5;

            // Instrumentalness: tonal signals have low spectral flatness.
            // Softer curve than before — 808 bass and hi-hats both look tonal
            // but a trap beat should NOT score 0.85+ instrumentalness like a
            // classical violin. Cap at 0.75 for signals with centroid > 500 Hz
            // (above pure-bass territory).  Pure classical piano/strings keep
            // their high score because their centroid is in the 800–1500 Hz range.
            double rawInstrumentalness = Math.Max(0, Math.Min(1, 1.0 - Math.Pow(flatness * 2.5, 0.6)));
            // Soften further when centroid is in the electronic/pop range (above 1200 Hz)
            // — electronic music is tonally simple but not "instrumental" in Spotify's sense
            double instrumentalness = centroid > 1200
                ? Math.Min(rawInstrumentalness, 0.65)
                : rawInstrumentalness;

            return new SpectralFeatures(centroid, flatness, instrumentalness);
        }

        // ─── Tempo ──────────────────────────────────────────────────────────────

        /// <summary>
        /// Estimates BPM via energy-envelope onset detection.
        /// Classical music with complex rhythms will give wider variance; the
        /// clamping prevents absurd values but the BPM may still be imprecise —
        /// that's OK because the genre model doesn't rely on BPM alone.
        /// </summary>
        private double EstimateTempo(float[] samples, int sampleRate)
        {
            if (samples.Length == 0) return 120.0;

            int windowSize = sampleRate / 10; // 100ms windows
            var envelope = new List<float>();

            for (int i = 0; i < samples.Length; i += windowSize)
            {
                int end = Math.Min(i + windowSize, samples.Length);
                float rms = 0;
                for (int j = i; j < end; j++) rms += samples[j] * samples[j];
                envelope.Add((float)Math.Sqrt(rms / (end - i)));
            }

            if (envelope.Count < 10) return 120.0;

            var peaks = FindPeaks(envelope.ToArray());
            if (peaks.Count < 2) return 120.0;

            var intervals = new List<double>();
            for (int i = 1; i < Math.Min(peaks.Count, 20); i++)
                intervals.Add(peaks[i] - peaks[i - 1]);

            if (intervals.Count == 0) return 120.0;

            double avgInterval = intervals.Average();
            double bpm = 60.0 / (avgInterval * windowSize / (double)sampleRate);
            bpm = Math.Max(60, Math.Min(200, bpm));
            if (bpm > 160) bpm /= 2;
            if (bpm < 70)  bpm *= 2;

            return Math.Round(bpm, 1);
        }

        private List<int> FindPeaks(float[] signal)
        {
            if (signal.Length < 3) return new List<int>();

            float avg  = signal.Average();
            float mad  = signal.Select(s => Math.Abs(s - avg)).Average();
            float threshold = avg + mad * 0.5f;

            var peaks = new List<int>();
            for (int i = 1; i < signal.Length - 1; i++)
            {
                if (signal[i] > threshold &&
                    signal[i] > signal[i - 1] &&
                    signal[i] > signal[i + 1] &&
                    (peaks.Count == 0 || i - peaks[^1] > 2))
                {
                    peaks.Add(i);
                }
            }
            return peaks;
        }

        // ─── Simple waveform-level features ─────────────────────────────────────

        /// <summary>
        /// Energy calibrated to better match Spotify's perceptual definition.
        /// Spotify Energy weighs perceived loudness + onset density + spectral
        /// entropy — not just RMS amplitude.  Tonal signals (low spectral flatness)
        /// are scaled down because pure tones feel less "intense" than noise/drums
        /// at the same RMS level.  The 0.7 floor prevents over-suppression for
        /// genuinely energetic acoustic tracks like flamenco guitar.
        /// </summary>
        private double CalculateEnergy(float[] samples, double spectralFlatness = 0.5)
        {
            if (samples.Length == 0) return 0.5;
            double rms = Math.Sqrt(samples.Average(s => (double)(s * s)));
            double rawEnergy = Math.Min(1.0, rms * 10);

            // Tonal correction: pure tones (flatness ≈ 0) feel less energetic
            // than noise (flatness ≈ 1) at the same amplitude.  Cap correction at 0.3.
            double tonalPenalty = Math.Max(0, 0.3 * (1.0 - Math.Min(1.0, spectralFlatness * 5.0)));
            return Math.Max(0, Math.Min(1.0, rawEnergy - tonalPenalty));
        }

        private double CalculateLoudness(float[] samples)
        {
            if (samples.Length == 0) return -10;
            double rms = Math.Sqrt(samples.Average(s => (double)(s * s)));
            if (rms < 1e-10) return -60;
            return Math.Max(-60, Math.Min(0, 20 * Math.Log10(rms)));
        }

        private double CalculateZeroCrossingRate(float[] samples)
        {
            if (samples.Length < 2) return 0.1;
            int crossings = 0;
            for (int i = 1; i < samples.Length; i++)
            {
                if ((samples[i] >= 0) != (samples[i - 1] >= 0))
                    crossings++;
            }
            return (double)crossings / samples.Length;
        }

        // ─── Derived features ────────────────────────────────────────────────────

        /// <summary>
        /// Speechiness uses ZCR and spectral centroid as before, but is now
        /// modulated by instrumentalness: a highly instrumental signal cannot
        /// also be highly speech-like.
        /// </summary>
        private double CalculateSpeechiness(double zcr, double spectralCentroid, double instrumentalness)
        {
            double zcrScore  = Math.Min(1.0, zcr * 100);
            double freqScore = Math.Max(0, 1.0 - Math.Abs(spectralCentroid - 2000) / 2000.0);
            double raw = zcrScore * 0.6 + freqScore * 0.4;
            // Suppress if the signal is detected as tonal/instrumental
            return Math.Max(0, Math.Min(1, raw * (1.0 - instrumentalness * 0.7)));
        }

        private double CalculateDanceability(double tempo, double energy, double zcr)
        {
            // Ideal dance tempo 110–130 BPM
            double tempoScore = Math.Max(0, Math.Min(1, 1.0 - Math.Abs(tempo - 120) / 60.0));
            return Math.Max(0, Math.Min(1, tempoScore * 0.5 + energy * 0.5));
        }

        private double CalculateValence(double energy, double spectralCentroid)
        {
            // Brighter + more energetic → more positive
            double brightnessScore = Math.Min(1.0, spectralCentroid / 3000.0);
            return Math.Max(0, Math.Min(1, energy * 0.6 + brightnessScore * 0.4));
        }

        /// <summary>
        /// Acousticness is now informed by spectral flatness as well.
        /// Acoustic/classical instruments have low flatness (tonal) AND
        /// typically a lower spectral centroid than synthetic sounds.
        /// </summary>
        private double CalculateAcousticness(double spectralCentroid, double energy, double spectralFlatness)
        {
            // Lower centroid → more bass/mid heavy → more acoustic feel
            double centroidScore = 1.0 - Math.Min(1.0, spectralCentroid / 4000.0);
            // Low energy (gentle playing) → acoustic
            double energyScore = 1.0 - energy;
            // Low spectral flatness → tonal → acoustic instruments
            double toналScore = 1.0 - Math.Min(1.0, spectralFlatness * 4.0);

            return Math.Max(0, Math.Min(1,
                centroidScore * 0.4 + energyScore * 0.2 + toналScore * 0.4));
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        private WaveStream GetAudioReader(Stream stream, string fileName)
        {
            return Path.GetExtension(fileName).ToLowerInvariant() switch
            {
                ".mp3"           => new Mp3FileReader(stream),
                ".wav"           => new WaveFileReader(stream),
                ".aiff" or ".aif" => new AiffFileReader(stream),
                var ext          => throw new NotSupportedException($"Audio format '{ext}' not supported")
            };
        }

        private float[] ReadMonoSamples(WaveStream reader)
        {
            var sampleProvider = reader.ToSampleProvider();
            var buffer    = new float[reader.WaveFormat.SampleRate];
            var allSamples = new List<float>();
            int read;

            while ((read = sampleProvider.Read(buffer, 0, buffer.Length)) > 0)
                for (int i = 0; i < read; i++)
                    allSamples.Add(buffer[i]);

            // Stereo → mono by averaging channels
            if (reader.WaveFormat.Channels == 2)
            {
                var mono = new List<float>(allSamples.Count / 2);
                for (int i = 0; i + 1 < allSamples.Count; i += 2)
                    mono.Add((allSamples[i] + allSamples[i + 1]) * 0.5f);
                return mono.ToArray();
            }

            return allSamples.ToArray();
        }
    }
}
