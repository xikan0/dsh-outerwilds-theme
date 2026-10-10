import { AudioInput, type AudioFeed, type InputSnapshot } from './input';
import { frameFromPowers, quietFrame, type AudioFrame } from './analysis';
import { AUDIO_WAVE_PRESET } from './preset';
import { AUDIO_CHANNEL, AUDIO_ENDPOINT, validNativeFrame, type AudioRpc } from './native-contract';

// One input facade keeps the accepted renderer identical for both capture methods.
export class HostAudioInput implements AudioFeed {
  private automatic = false;
  private nativeUnsupported = false;
  private snapshot: InputSnapshot = { phase: 'idle', source: null, message: '尚未连接声音来源。', contextState: 'none', sampleRate: 0 };
  private listeners = new Set<() => void>();
  private frame = quietFrame();
  private frameAt = 0;
  private session?: string;
  private generation = 0;
  private abort?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private offBrowser: () => void;
  constructor(private rpc: AudioRpc, private browser = new AudioInput()) {
    this.offBrowser = browser.subscribe(() => { if (!this.automatic || this.nativeUnsupported) this.publish(browser.getSnapshot()); });
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(snapshot: InputSnapshot) {
    const changed = Object.entries(snapshot).some(([key, value]) => value !== this.snapshot[key as keyof InputSnapshot]);
    if (!changed) return;
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }
  setAutomatic(enabled: boolean) {
    if (this.automatic === enabled) return;
    this.stop(); this.automatic = enabled; this.nativeUnsupported = false;
    if (enabled) void this.connect('system');
    else this.publish(this.browser.getSnapshot());
  }
  async connect(kind: 'system' | 'microphone') {
    if (!this.automatic || this.nativeUnsupported) { await this.browser.connect(kind); return; }
    this.stop();
    const ticket = this.generation;
    const session = this.session = crypto.randomUUID();
    this.publish({ phase: 'requesting', source: 'native', message: '正在连接系统播放声音…', contextState: 'none', sampleRate: 0 });
    const poll = async () => {
      if (ticket !== this.generation) return;
      this.abort = new AbortController();
      const timeout = setTimeout(() => this.abort?.abort(), 2000);
      let delay = 33;
      try {
        const result = await this.rpc.call(AUDIO_CHANNEL, `${AUDIO_ENDPOINT}/read`, { session }, this.abort.signal);
        if (ticket !== this.generation) return;
        if (!result.ok) throw new Error(result.error.message);
        const value = result.value;
        if (value.phase === 'listening' && !validNativeFrame(value)) throw new Error('收到无效的音频数据。');
        if (value.phase === 'listening') {
          this.frame = frameFromPowers(value, value.powers, AUDIO_WAVE_PRESET.gain * 10); this.frameAt = performance.now();
          this.publish({ phase: 'listening', source: 'native', message: value.message, contextState: 'running', sampleRate: value.sampleRate });
        } else {
          this.frame = quietFrame();
          const terminal = value.phase === 'unsupported';
          this.publish({ phase: value.phase === 'error' || terminal ? 'error' : 'requesting', source: 'native', message: value.message, contextState: 'none', sampleRate: 0 });
          if (terminal) {
            this.nativeUnsupported = true; this.release(session); this.session = undefined;
            this.publish({ phase: 'error', source: 'system', message: '当前系统不支持自动监听，需要 Windows x64。', contextState: 'none', sampleRate: 0 });
            return;
          }
          delay = value.phase === 'error' ? 1000 : 100;
        }
      } catch {
        if (ticket !== this.generation) return;
        this.frame = quietFrame(); delay = 1000;
        this.publish({ phase: 'error', source: 'native', message: '系统音频连接中断，正在重连。', contextState: 'none', sampleRate: 0 });
      } finally { clearTimeout(timeout); }
      if (ticket === this.generation) this.timer = setTimeout(() => void poll(), delay);
    };
    await poll();
  }
  private release(session: string) {
    void this.rpc.call(AUDIO_CHANNEL, `${AUDIO_ENDPOINT}/release`, { session }, AbortSignal.timeout(2000)).catch(() => {});
  }
  stop(message = '已断开声音来源。') {
    this.generation++; this.abort?.abort(); clearTimeout(this.timer);
    if (this.session) this.release(this.session);
    this.session = undefined; this.frame = quietFrame();
    this.browser.stop(message);
    this.publish({ phase: 'idle', source: this.automatic && !this.nativeUnsupported ? 'native' : null, message, contextState: 'none', sampleRate: 0 });
  }
  async resume() { if (!this.automatic || this.nativeUnsupported) await this.browser.resume(); }
  read(): AudioFrame {
    return this.automatic && !this.nativeUnsupported ? performance.now() - this.frameAt < 300 ? this.frame : quietFrame() : this.browser.read();
  }
  dispose() { this.stop(); this.offBrowser(); this.browser.dispose(); this.listeners.clear(); }
}
