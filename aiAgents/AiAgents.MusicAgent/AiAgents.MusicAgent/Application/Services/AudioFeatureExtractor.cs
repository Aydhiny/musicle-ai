using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Domain.Entities;
using NAudio.Wave;

namespace AiAgents.MusicAgent.Application.Services
{
    /// <summary>
    /// FIXED VERSION - Extracts audio features from uploaded audio files
    /// Uses NAudio for waveform analysis with proper sample reading
    /// </summary>
    public class AudioFeatureExtractor : IAudioFeatureExtractor
    {
        private readonly ILogger<AudioFeatureExtractor> _logger;

        public AudioFeatureExtractor(ILogger<AudioFeatureExtractor> logger)
        {
            _logger = logger;
        }

        public async Task<Characteristics> ExtractFeaturesAsync(byte[] audioData, string fileName)
        {
            _logger.LogInformation("Extracting features from {FileName} ({Size} bytes)", fileName, audioData.Length);

            try
            {
                using var ms = new MemoryStream(audioData);

                // Determine reader based on file extension
                WaveStream reader = GetAudioReader(ms, fileName);

                using (reader)
                {
                    var waveFormat = reader.WaveFormat;
                    var duration = reader.TotalTime;

                    _logger.LogInformation("Audio format: {Format}, Sample Rate: {SampleRate}, Duration: {Duration}",
                        waveFormat.Encoding, waveFormat.SampleRate, duration);

                    // Read audio samples
                    var samples = ReadAllSamples(reader);

                    _logger.LogInformation("Read {Count} samples", samples.Length);

                    // Extract features
                    var tempo = EstimateTempo(samples, waveFormat.SampleRate);
                    var energy = CalculateEnergy(samples);
                    var loudness = CalculateLoudness(samples);
                    var spectralCentroid = CalculateSpectralCentroid(samples, waveFormat.SampleRate);
                    var zeroCrossingRate = CalculateZeroCrossingRate(samples);

                    // Derive other features
                    var danceability = CalculateDanceability(tempo, energy, zeroCrossingRate);
                    var valence = CalculateValence(energy, spectralCentroid);
                    var acousticness = CalculateAcousticness(spectralCentroid, energy);
                    var speechiness = CalculateSpeechiness(zeroCrossingRate, spectralCentroid);
                    var instrumentalness = CalculateInstrumentalness(speechiness);

                    _logger.LogInformation("Features extracted: Tempo={Tempo:F1}, Energy={Energy:P0}, Danceability={Danceability:P0}",
                        tempo, energy, danceability);

                    return new Characteristics
                    {
                        Tempo = tempo,
                        Energy = energy,
                        Danceability = danceability,
                        Valence = valence,
                        Acousticness = acousticness,
                        Loudness = loudness,
                        Speechiness = speechiness,
                        Instrumentalness = instrumentalness,
                        SpectralCentroid = spectralCentroid,
                        ZeroCrossingRate = zeroCrossingRate
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting features from audio");
                throw;
            }
        }

        private WaveStream GetAudioReader(Stream stream, string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLower();

            return extension switch
            {
                ".mp3" => new Mp3FileReader(stream),
                ".wav" => new WaveFileReader(stream),
                ".aiff" or ".aif" => new AiffFileReader(stream),
                _ => throw new NotSupportedException($"Audio format {extension} not supported")
            };
        }

        private float[] ReadAllSamples(WaveStream reader)
        {
            var samples = new List<float>();

            // Convert to ISampleProvider for consistent float sample reading
            var sampleProvider = reader.ToSampleProvider();
            var buffer = new float[reader.WaveFormat.SampleRate];
            int samplesRead;

            while ((samplesRead = sampleProvider.Read(buffer, 0, buffer.Length)) > 0)
            {
                samples.AddRange(buffer.Take(samplesRead));
            }

            // If stereo, convert to mono by averaging channels
            if (reader.WaveFormat.Channels == 2)
            {
                var mono = new List<float>();
                for (int i = 0; i < samples.Count; i += 2)
                {
                    if (i + 1 < samples.Count)
                        mono.Add((samples[i] + samples[i + 1]) / 2f);
                    else
                        mono.Add(samples[i]);
                }
                return mono.ToArray();
            }

            return samples.ToArray();
        }

        /// <summary>
        /// Estimate tempo using beat detection (simplified autocorrelation)
        /// </summary>
        private double EstimateTempo(float[] samples, int sampleRate)
        {
            if (samples.Length == 0) return 120.0;

            // Calculate energy envelope
            int windowSize = sampleRate / 10; // 100ms windows
            var energyEnvelope = new List<float>();

            for (int i = 0; i < samples.Length; i += windowSize)
            {
                var window = samples.Skip(i).Take(windowSize).ToArray();
                if (window.Length == 0) continue;

                var energy = window.Select(s => s * s).Sum() / window.Length;
                energyEnvelope.Add((float)Math.Sqrt(energy));
            }

            if (energyEnvelope.Count < 10) return 120.0;

            // Find peaks in energy envelope
            var peaks = FindPeaks(energyEnvelope.ToArray());

            if (peaks.Count < 2)
                return 120.0; // Default tempo

            // Calculate average interval between peaks
            var intervals = new List<double>();
            for (int i = 1; i < Math.Min(peaks.Count, 20); i++)
            {
                intervals.Add(peaks[i] - peaks[i - 1]);
            }

            if (intervals.Count == 0) return 120.0;

            var avgInterval = intervals.Average();
            var bpm = (60.0 / (avgInterval * windowSize / sampleRate));

            // Clamp to reasonable range and adjust for common BPM errors
            bpm = Math.Max(60, Math.Min(200, bpm));

            // If BPM is way off (too fast), it might be detecting every beat instead of downbeats
            if (bpm > 160) bpm /= 2;
            if (bpm < 70) bpm *= 2;

            return Math.Round(bpm, 1);
        }

        private List<int> FindPeaks(float[] signal)
        {
            if (signal.Length < 3) return new List<int>();

            var peaks = new List<int>();
            var threshold = signal.Average() + signal.Select(s => Math.Abs(s - signal.Average())).Average() * 0.5f;

            for (int i = 1; i < signal.Length - 1; i++)
            {
                if (signal[i] > threshold &&
                    signal[i] > signal[i - 1] &&
                    signal[i] > signal[i + 1])
                {
                    // Avoid detecting peaks too close together
                    if (peaks.Count == 0 || i - peaks[peaks.Count - 1] > 2)
                        peaks.Add(i);
                }
            }

            return peaks;
        }

        /// <summary>
        /// Calculate RMS energy (0-1 scale)
        /// </summary>
        private double CalculateEnergy(float[] samples)
        {
            if (samples.Length == 0) return 0.5;

            var rms = Math.Sqrt(samples.Select(s => (double)(s * s)).Average());
            // Normalize to 0-1 range (assuming typical audio levels)
            return Math.Min(1.0, rms * 10);
        }

        /// <summary>
        /// Calculate loudness in dB
        /// </summary>
        private double CalculateLoudness(float[] samples)
        {
            if (samples.Length == 0) return -10;

            var rms = Math.Sqrt(samples.Select(s => (double)(s * s)).Average());
            if (rms < 1e-10) return -60; // Silence

            var db = 20 * Math.Log10(rms);
            return Math.Max(-60, Math.Min(0, db)); // Clamp to typical range
        }

        /// <summary>
        /// Calculate spectral centroid (brightness of sound)
        /// </summary>
        private double CalculateSpectralCentroid(float[] samples, int sampleRate)
        {
            if (samples.Length == 0) return 2000;

            // Simplified FFT-free approximation using zero-crossing rate
            int windowSize = 2048;
            var centroids = new List<double>();

            for (int i = 0; i < samples.Length - windowSize; i += windowSize)
            {
                var window = samples.Skip(i).Take(windowSize).ToArray();
                if (window.Length < windowSize) continue;

                // Calculate zero-crossing rate as proxy for high frequency content
                double zcr = CalculateZeroCrossingRate(window);

                // Estimate centroid based on ZCR (0-4000 Hz range)
                var centroid = zcr * 4000;
                centroids.Add(centroid);
            }

            return centroids.Any() ? centroids.Average() : 2000;
        }

        /// <summary>
        /// Calculate zero-crossing rate (proxy for high frequency content)
        /// </summary>
        private double CalculateZeroCrossingRate(float[] samples)
        {
            if (samples.Length < 2) return 0.1;

            int crossings = 0;
            for (int i = 1; i < samples.Length; i++)
            {
                if ((samples[i] >= 0 && samples[i - 1] < 0) ||
                    (samples[i] < 0 && samples[i - 1] >= 0))
                {
                    crossings++;
                }
            }
            return (double)crossings / samples.Length;
        }

        /// <summary>
        /// Estimate danceability from tempo, energy, and rhythm regularity
        /// </summary>
        private double CalculateDanceability(double tempo, double energy, double zcr)
        {
            // Ideal dance tempo: 110-130 BPM
            var tempoScore = 1.0 - Math.Abs(tempo - 120) / 60.0;
            tempoScore = Math.Max(0, Math.Min(1, tempoScore));

            // Combine with energy (more energy = more danceable)
            var danceability = (tempoScore * 0.5) + (energy * 0.5);

            return Math.Max(0, Math.Min(1, danceability));
        }

        /// <summary>
        /// Estimate valence (musical positiveness) from energy and brightness
        /// </summary>
        private double CalculateValence(double energy, double spectralCentroid)
        {
            // Brighter, more energetic = more positive
            var brightnessScore = Math.Min(1.0, spectralCentroid / 3000.0);
            var valence = (energy * 0.6) + (brightnessScore * 0.4);

            return Math.Max(0, Math.Min(1, valence));
        }

        /// <summary>
        /// Estimate acousticness (lower spectral centroid + lower energy = more acoustic)
        /// </summary>
        private double CalculateAcousticness(double spectralCentroid, double energy)
        {
            var brightnessScore = 1.0 - Math.Min(1.0, spectralCentroid / 4000.0);
            var energyScore = 1.0 - energy;

            var acousticness = (brightnessScore * 0.7) + (energyScore * 0.3);
            return Math.Max(0, Math.Min(1, acousticness));
        }

        /// <summary>
        /// Estimate speechiness from zero-crossing rate and spectral centroid
        /// </summary>
        private double CalculateSpeechiness(double zcr, double spectralCentroid)
        {
            // Speech typically has moderate-high ZCR and mid-range frequencies
            var zcrScore = Math.Min(1.0, zcr * 100); // Scale up
            var freqScore = 1.0 - Math.Abs(spectralCentroid - 2000) / 2000.0;
            freqScore = Math.Max(0, freqScore);

            var speechiness = (zcrScore * 0.6) + (freqScore * 0.4);
            return Math.Max(0, Math.Min(1, speechiness));
        }

        /// <summary>
        /// Estimate instrumentalness (inverse of speechiness with adjustments)
        /// </summary>
        private double CalculateInstrumentalness(double speechiness)
        {
            // Simple inverse relationship
            return Math.Max(0, Math.Min(1, 1.0 - speechiness));
        }
    }
}
