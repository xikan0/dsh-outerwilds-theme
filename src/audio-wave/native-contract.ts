export const AUDIO_CHANNEL = '/api';
export const AUDIO_ENDPOINT = 'outerwilds-audio';
export type NativeFrame = { sampleRate: number; rms: number; peak: number; powers: number[] };
export type NativeSnapshot = NativeFrame & {
  phase: 'idle' | 'starting' | 'listening' | 'error' | 'unsupported' | 'disabled';
  message: string;
};
export interface AudioRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<
    { ok: true; value: NativeSnapshot } | { ok: false; error: { message: string } }
  >;
}
export const nativeQuiet = (): NativeFrame => ({ sampleRate: 0, rms: 0, peak: 0, powers: Array<number>(6).fill(0) });
export function validNativeFrame(value: unknown): value is NativeFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as NativeFrame;
  return Number.isFinite(frame.sampleRate) && frame.sampleRate >= 8000 && frame.sampleRate <= 384000 &&
    Number.isFinite(frame.rms) && frame.rms >= 0 && frame.rms <= 1 &&
    Number.isFinite(frame.peak) && frame.peak >= 0 && frame.peak <= 1 &&
    Array.isArray(frame.powers) && frame.powers.length === 6 && frame.powers.every(p => Number.isFinite(p) && p >= 0 && p <= 1);
}
