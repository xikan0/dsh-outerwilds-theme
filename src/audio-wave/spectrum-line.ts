import { SILENT_BANDS, SPECTRUM_BANDS, type AudioFrame } from './analysis.ts';
import { AUDIO_WAVE_PRESET } from './preset.ts';

// Smooth fixed-position amplitudes, including a gentle taper to the two pinned ends.
// The quintic blend has zero first and second derivatives at each band center.
function envelopeAt(levels: readonly number[], position: number): number {
  const smooth = (value: number) => value ** 3 * (value * (value * 6 - 15) + 10);
  const band = position * SPECTRUM_BANDS - 0.5;
  if (band <= 0) return levels[0] * smooth(position * SPECTRUM_BANDS * 2);
  if (band >= SPECTRUM_BANDS - 1) return levels[SPECTRUM_BANDS - 1] * smooth((1 - position) * SPECTRUM_BANDS * 2);
  const left = Math.floor(band);
  return levels[left] + (levels[left + 1] - levels[left]) * smooth(band - left);
}

export class SpectrumMotion {
  private levels = Array<number>(SPECTRUM_BANDS).fill(0);
  private releaseSeconds = AUDIO_WAVE_PRESET.releaseMs / 1000;

  reset() { this.levels.fill(0); }
  setRelease(milliseconds: number) { this.releaseSeconds = Math.max(0.15, Math.min(0.9, milliseconds / 1000)); }
  getLevels(): readonly number[] { return this.levels; }

  step(targets: readonly number[], seconds: number) {
    const dt = Math.max(0, Math.min(0.1, seconds));
    for (let index = 0; index < SPECTRUM_BANDS; index++) {
      const target = Math.max(0, Math.min(1, targets[index] || 0));
      const current = this.levels[index];
      const rate = target > current ? dt / 0.025 : Math.LN10 * dt / this.releaseSeconds;
      this.levels[index] = target + (current - target) * Math.exp(-rate);
      if (this.levels[index] < 0.00001) this.levels[index] = 0;
    }
  }
}

export class SpectrumLine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  private motion = new SpectrumMotion();
  private width = 0;
  private height = 0;
  private paused = false;
  private lastTime?: number;
  private intensity: number = AUDIO_WAVE_PRESET.intensity;
  private phase = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器无法绘制频谱。');
    this.context = context;
    container.append(this.canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  private resize() {
    const width = Math.round(this.container.clientWidth), height = Math.round(this.container.clientHeight);
    if (!width || !height || (width === this.width && height === this.height)) return;
    this.width = width;
    this.height = height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  private draw() {
    const { context, width, height } = this;
    if (!width || !height) return;
    const levels = this.motion.getLevels().map(level => Math.min(1, level * this.intensity));
    const baseline = height / 2;
    const halfHeight = height * 0.68 / 2;
    const segments = Math.max(128, Math.ceil(width));
    context.clearRect(0, 0, width, height);
    context.beginPath();
    context.moveTo(0, baseline);
    // Only the carrier travels: sin(k*x - phase) moves right as phase increases.
    // The audio envelope is sampled at x, never at a translated position.
    for (let index = 1; index < segments; index++) {
      const position = index / segments;
      const carrier = Math.sin(Math.PI * 2 * 6 * position - this.phase);
      const offset = envelopeAt(levels, position) * halfHeight * carrier;
      context.lineTo(position * width, baseline - offset);
    }
    context.lineTo(width, baseline);
    context.strokeStyle = '#91dad7';
    context.lineWidth = 1.6;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  }

  update(frame: AudioFrame, connected: boolean, now: number) {
    if (this.paused) return;
    const elapsed = this.lastTime === undefined ? 1 / 60 : (now - this.lastTime) / 1000;
    if (elapsed > 0.25) this.motion.reset();
    this.lastTime = now;
    const dt = Math.max(0, Math.min(0.1, elapsed > 0.25 ? 1 / 60 : elapsed));
    this.motion.step(connected ? frame.bands : SILENT_BANDS, dt);
    // One wavelength per second; hidden pages pause this clock with the renderer.
    this.phase = (this.phase + Math.PI * 2 * dt) % (Math.PI * 2);
    this.draw();
  }

  setIntensity(value: number) { this.intensity = Math.max(0.4, Math.min(1.6, value)); }
  setRelease(milliseconds: number) { this.motion.setRelease(milliseconds); }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.lastTime = undefined; this.motion.reset(); }
  dispose() { this.observer.disconnect(); this.canvas.remove(); }
}
