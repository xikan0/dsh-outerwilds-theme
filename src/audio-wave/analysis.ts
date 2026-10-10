// Two broad regions each for bass, mids and treble; positions stay fixed across inputs.
export const BAND_EDGES = [50, 120, 250, 1000, 4000, 8000, 16000] as const;
export const SPECTRUM_BANDS = BAND_EDGES.length - 1;
export const SILENT_BANDS: readonly number[] = Object.freeze(Array<number>(SPECTRUM_BANDS).fill(0));

export type AudioMetrics = { rms: number; peak: number };
export type AudioFrame = AudioMetrics & {
  bands: readonly number[];
  bass: number;
  mid: number;
  treble: number;
};

export const quietFrame = (): AudioFrame => ({
  rms: 0, peak: 0, bands: SILENT_BANDS, bass: 0, mid: 0, treble: 0,
});
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const bandResponse = (power: number, sensitivity: number) => power > 0 && sensitivity > 0 ? clamp((10 * Math.log10(power) + 20 * Math.log10(sensitivity / 10) + 78) / 66) : 0;
export function frameFromPowers(metrics: AudioMetrics, powers: readonly number[], sensitivity: number): AudioFrame {
  const bands = metrics.rms > 0.00001 ? powers.map(power => bandResponse(power, sensitivity)) : SILENT_BANDS;
  const response = [0, 2, 4].map(index => (bands[index] + bands[index + 1]) / 2);
  return { ...metrics, bands, bass: response[0], mid: response[1], treble: response[2] };
}

export function measureAudio(samples: Float32Array): AudioMetrics {
  let energy = 0, peak = 0;
  for (const sample of samples) {
    energy += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = samples.length ? Math.sqrt(energy / samples.length) : 0;
  return { rms, peak };
}

// Integrate FFT power into six broad bands. A bin crossing a band edge shares its power.
export function readSpectrum(spectrum: Float32Array, sampleRate: number, sensitivity: number): number[] {
  const bands = Array<number>(SPECTRUM_BANDS).fill(0);
  if (!spectrum.length || sampleRate <= 0 || sensitivity <= 0) return bands;
  const binWidth = sampleRate / (spectrum.length * 2);
  const upper = sampleRate / 2;
  for (let band = 0; band < SPECTRUM_BANDS; band++) {
    const low = BAND_EDGES[band];
    const high = Math.min(BAND_EDGES[band + 1], upper);
    if (high <= low) continue;
    const first = Math.max(1, Math.floor(low / binWidth - 0.5));
    const last = Math.min(spectrum.length - 1, Math.ceil(high / binWidth + 0.5));
    let power = 0;
    for (let bin = first; bin <= last; bin++) {
      if (!Number.isFinite(spectrum[bin])) continue;
      const overlap = Math.max(0, Math.min(high, (bin + 0.5) * binWidth) - Math.max(low, (bin - 0.5) * binWidth));
      power += 10 ** (spectrum[bin] / 10) * overlap / binWidth;
    }
    // Fixed dB range preserves loudness differences; there is no per-frame normalization.
    bands[band] = bandResponse(power, sensitivity);
  }
  return bands;
}

export function analyseAudio(samples: Float32Array, spectrum: Float32Array, sampleRate: number, sensitivity: number): AudioFrame {
  const metrics = measureAudio(samples);
  const bands = metrics.rms > 0.00001 ? readSpectrum(spectrum, sampleRate, sensitivity) : SILENT_BANDS;
  const response = [0, 2, 4].map(index => (bands[index] + bands[index + 1]) / 2);
  return { ...metrics, bands, bass: response[0], mid: response[1], treble: response[2] };
}
