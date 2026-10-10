// Portable audio input for the standalone prototype. Capture and rendering stay separate.
import { analyseAudio, quietFrame, type AudioFrame } from './analysis.ts';
import { AUDIO_WAVE_PRESET } from './preset.ts';
export type AudioSource = 'system' | 'microphone' | 'test' | 'native';
export type InputSnapshot = {
  phase: 'idle' | 'requesting' | 'listening' | 'error';
  source: AudioSource | null;
  message: string;
  contextState: AudioContextState | 'none';
  sampleRate: number;
};
type Session = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: AudioNode;
  samples: Float32Array<ArrayBuffer>;
  spectrum: Float32Array<ArrayBuffer>;
  stream?: MediaStream;
  testSource?: OscillatorNode | AudioBufferSourceNode;
  toneGain?: GainNode;
  outputGain?: GainNode;
};
export interface AudioFeed {
  getSnapshot(): InputSnapshot;
  subscribe(listener: () => void): () => void;
  connect(kind: 'system' | 'microphone'): Promise<void>;
  resume(): Promise<void>;
  read(): AudioFrame;
  stop(message?: string): void;
  dispose(): void;
  setAutomatic?(enabled: boolean): void;
}

const stopStream = (stream?: MediaStream) => stream?.getTracks().forEach(track => track.stop());
const closeContext = (context?: AudioContext) => {
  if (context && context.state !== 'closed') void context.close().catch(() => {});
};

function captureError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return '未获得共享或麦克风权限，可以重新连接。';
    if (error.name === 'NotFoundError') return '没有找到可用的音频来源。';
    if (error.name === 'NotReadableError') return '无法读取声音来源，请检查设备是否被占用。';
    if (error.name === 'InvalidStateError') return '请在当前页面点击连接按钮，再选择声音来源。';
  }
  return error instanceof Error ? error.message : '音频连接失败，请重新连接。';
}

export class AudioInput {
  private snapshot: InputSnapshot = {
    phase: 'idle', source: null, message: '尚未连接声音来源。', contextState: 'none', sampleRate: 0,
  };
  private listeners = new Set<() => void>();
  private session?: Session;
  private pendingContext?: AudioContext;
  private generation = 0;
  readonly sensitivity = AUDIO_WAVE_PRESET.gain * 10;

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(snapshot: InputSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }
  private release() {
    const session = this.session;
    this.session = undefined;
    closeContext(this.pendingContext);
    this.pendingContext = undefined;
    if (!session) return;
    session.context.onstatechange = null;
    stopStream(session.stream);
    session.source.disconnect();
    session.analyser.disconnect();
    session.outputGain?.disconnect();
    session.testSource?.stop();
    session.testSource?.disconnect();
    closeContext(session.context);
  }
  stop(message = '已断开声音来源。') {
    this.generation++;
    this.release();
    this.publish({ phase: 'idle', source: null, message, contextState: 'none', sampleRate: 0 });
  }
  private begin(source: AudioSource): number {
    const ticket = ++this.generation;
    this.release();
    this.publish({ phase: 'requesting', source, message: '正在连接声音来源…', contextState: 'none', sampleRate: 0 });
    return ticket;
  }
  private attach(context: AudioContext, source: AudioNode, extra: Partial<Session>, kind: AudioSource) {
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    this.session = {
      context, source, analyser, samples: new Float32Array(analyser.fftSize),
      spectrum: new Float32Array(analyser.frequencyBinCount), ...extra,
    };
    this.pendingContext = undefined;
    context.onstatechange = () => {
      if (this.session?.context === context) this.publish({ ...this.snapshot, contextState: context.state });
    };
    this.publish({
      phase: 'listening', source: kind, message: kind === 'test' ? '正在分析真实测试音。' : '声音来源已连接。',
      contextState: context.state, sampleRate: context.sampleRate,
    });
  }
  async connect(kind: 'system' | 'microphone') {
    const ticket = this.begin(kind);
    let context: AudioContext | undefined, stream: MediaStream | undefined;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices) throw new Error('请使用 localhost 地址，并在 Chrome 或 Edge 中打开。');
      context = new AudioContext();
      this.pendingContext = context;
      // Both calls happen inside the user's click, before the first await.
      const resume = context.resume().catch(error => error as unknown);
      if (kind === 'system') {
        if (!navigator.mediaDevices.getDisplayMedia) throw new Error('当前浏览器没有提供系统声音共享，请使用 Chrome 或 Edge。');
        const options: DisplayMediaStreamOptions & { systemAudio: string; selfBrowserSurface: string } = {
          video: { frameRate: 1 }, audio: { suppressLocalAudioPlayback: false } as MediaTrackConstraints,
          systemAudio: 'include', selfBrowserSurface: 'exclude',
        };
        stream = await navigator.mediaDevices.getDisplayMedia(options);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: false, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      }
      if (ticket !== this.generation) { stopStream(stream); closeContext(context); return; }
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) throw new Error('没有收到音频轨道。请重新连接，选择整个屏幕并勾选“共享系统音频”，或选择播放声音的标签页并勾选共享音频。');
      const resumeError = await resume;
      if (resumeError) throw resumeError;
      if (ticket !== this.generation) { stopStream(stream); closeContext(context); return; }
      if (audioTracks.some(track => track.readyState !== 'live')) throw new Error('声音共享已经停止，请重新连接。');
      // Keep the capture session's video track alive, but consume only its audio tracks.
      const source = context.createMediaStreamSource(new MediaStream(audioTracks));
      this.attach(context, source, { stream }, kind);
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => {
          if (this.session?.stream === stream) this.stop('声音共享已停止。');
        }, { once: true });
      }
    } catch (error) {
      stopStream(stream);
      closeContext(context);
      if (ticket !== this.generation) return;
      this.pendingContext = undefined;
      this.publish({ phase: 'error', source: kind, message: captureError(error), contextState: 'none', sampleRate: 0 });
    }
  }
  async startTestTone(strength: number, rhythm = false, frequency = 220) {
    const ticket = this.begin('test');
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      this.pendingContext = context;
      await context.resume();
      if (ticket !== this.generation) { closeContext(context); return; }
      let testSource: OscillatorNode | AudioBufferSourceNode;
      if (rhythm) {
        // A real, quiet kick every 0.5 seconds. The analyser must detect it like captured music.
        const buffer = context.createBuffer(1, Math.round(context.sampleRate * 0.5), context.sampleRate);
        const samples = buffer.getChannelData(0);
        let phase = 0;
        for (let index = 0; index < samples.length; index++) {
          const time = index / context.sampleRate;
          phase += 2 * Math.PI * (55 + 95 * Math.exp(-time / 0.025)) / context.sampleRate;
          if (time < 0.22) samples[index] = Math.sin(phase) * Math.exp(-time / 0.035) * Math.min(1, time / 0.003);
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        testSource = source;
      } else {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = Math.max(20, Math.min(frequency, context.sampleRate * 0.45));
        testSource = oscillator;
      }
      const toneGain = context.createGain(), outputGain = context.createGain();
      toneGain.gain.value = Math.max(0, Math.min(0.5, strength));
      outputGain.gain.value = 0.08;
      testSource.connect(toneGain);
      toneGain.connect(outputGain);
      outputGain.connect(context.destination);
      this.attach(context, toneGain, { testSource, toneGain, outputGain }, 'test');
      testSource.start();
      this.publish({ ...this.snapshot, message: rhythm ? '正在分析真实测试节拍 · 120 BPM · 低音量。' : `正在分析 ${frequency} Hz 持续测试音 · 低音量。` });
    } catch (error) {
      closeContext(context);
      if (ticket !== this.generation) return;
      this.release();
      this.publish({ phase: 'error', source: 'test', message: captureError(error), contextState: 'none', sampleRate: 0 });
    }
  }
  setTestStrength(strength: number) {
    const session = this.session;
    if (!session?.toneGain) return;
    const now = session.context.currentTime;
    session.toneGain.gain.cancelScheduledValues(now);
    session.toneGain.gain.setTargetAtTime(Math.max(0, Math.min(0.5, strength)), now, 0.02);
  }
  async resume() {
    const session = this.session;
    if (!session) return;
    try { await session.context.resume(); }
    catch (error) {
      if (this.session !== session) return;
      const kind = this.snapshot.source;
      this.release();
      this.publish({ phase: 'error', source: kind, message: captureError(error), contextState: 'none', sampleRate: 0 });
    }
  }
  read(): AudioFrame {
    const session = this.session;
    if (!session || session.context.state !== 'running') return quietFrame();
    session.analyser.getFloatTimeDomainData(session.samples);
    session.analyser.getFloatFrequencyData(session.spectrum);
    return analyseAudio(session.samples, session.spectrum, session.context.sampleRate, this.sensitivity);
  }
  dispose() {
    this.listeners.clear();
    this.stop();
  }
}
