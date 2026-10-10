import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nativeQuiet, validNativeFrame, type NativeFrame, type NativeSnapshot } from './native-contract';

type Options = {
  enabled: () => boolean;
  platform?: string;
  arch?: string;
  launch?: () => ChildProcessWithoutNullStreams;
  now?: () => number;
  leaseMs?: number;
};
// The helper owns no files or network endpoints. Its stdin closes when its Host dies.
function launchHelper() {
  const binary = fileURLToPath(new URL('./native/outerwilds-audio.exe', import.meta.url));
  const manifest = JSON.parse(readFileSync(new URL('./native/manifest.json', import.meta.url), 'utf8'));
  if (manifest.protocol !== 1 || createHash('sha256').update(readFileSync(binary)).digest('hex') !== manifest.binarySha256)
    throw new Error('Audio component checksum mismatch');
  return spawn(binary, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

export class NativeAudioHost {
  private leases = new Map<string, number>();
  private child?: ChildProcessWithoutNullStreams;
  private frame: NativeFrame = nativeQuiet();
  private phase: NativeSnapshot['phase'] = 'idle';
  private message = '系统声音尚未连接。';
  private frameAt = 0;
  private retryAt = 0;
  private disposed = false;
  private timer: ReturnType<typeof setInterval>;
  private now: () => number;
  constructor(private options: Options) {
    this.now = options.now ?? Date.now;
    this.timer = setInterval(() => this.sweep(), 500);
    this.timer.unref();
  }
  private supported() { return (this.options.platform ?? process.platform) === 'win32' && (this.options.arch ?? process.arch) === 'x64'; }
  private sweep() {
    for (const [session, expiry] of this.leases) if (expiry <= this.now()) this.leases.delete(session);
    if (!this.options.enabled() || !this.leases.size) this.stop();
    else if (!this.child && this.supported() && this.now() >= this.retryAt) this.start();
  }
  request(endpoint: string, payload: unknown): NativeSnapshot {
    if (this.disposed) throw new Error('Audio service disposed');
    const session = (payload as { session?: unknown } | null)?.session;
    if (typeof session !== 'string' || !/^[a-f0-9-]{36}$/.test(session) || !['read', 'release'].includes(endpoint))
      throw new Error('Invalid audio request');
    if (endpoint === 'release') { this.leases.delete(session); this.sweep(); return this.snapshot(); }
    if (!this.options.enabled()) { this.stop(); return { ...nativeQuiet(), phase: 'disabled', message: '请先在主题设置中开启音频响应。' }; }
    if (!this.supported()) return { ...nativeQuiet(), phase: 'unsupported', message: '自动监听暂支持 Windows x64。' };
    if (!this.leases.has(session) && this.leases.size >= 16) throw new Error('Too many audio clients');
    this.leases.set(session, this.now() + (this.options.leaseMs ?? 3000));
    this.sweep();
    return this.snapshot();
  }
  snapshot(): NativeSnapshot {
    const frame = this.now() - this.frameAt < 300 ? this.frame : { ...nativeQuiet(), sampleRate: this.frame.sampleRate };
    return { ...frame, phase: this.phase, message: this.message };
  }
  private start() {
    if (this.disposed) return;
    this.phase = 'starting'; this.message = '正在连接系统播放声音…';
    let child: ChildProcessWithoutNullStreams;
    try { child = (this.options.launch ?? launchHelper)(); }
    catch { this.fail(); return; }
    this.child = child;
    let buffer = '';
    child.stdin.on('error', () => {});
    child.stderr.resume();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      if (this.child !== child) return;
      buffer += data;
      if (buffer.length > 65536) { child.kill(); this.fail(); return; }
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        try {
          const value = JSON.parse(line);
          if (value.type === 'ready' && Number.isFinite(value.sampleRate)) {
            this.phase = 'listening'; this.message = '正在监听 DSH 所在电脑的系统播放声音。';
            this.frame = { ...nativeQuiet(), sampleRate: value.sampleRate }; this.frameAt = this.now();
          } else if (value.type === 'frame' && validNativeFrame(value)) {
            this.phase = 'listening'; this.message = '正在监听 DSH 所在电脑的系统播放声音。';
            this.frame = { sampleRate: value.sampleRate, rms: value.rms, peak: value.peak, powers: value.powers };
            this.frameAt = this.now();
          } else if (value.type === 'error') {
            this.phase = 'error'; this.frame = nativeQuiet();
            this.message = '暂时无法读取播放设备，正在重试。';
          } else throw new Error('Invalid audio frame');
        } catch { child.kill(); this.fail(); return; }
      }
    });
    const exited = () => {
      if (this.child !== child) return;
      this.child = undefined; this.fail();
    };
    child.on('error', exited); child.on('exit', exited);
  }
  private fail() {
    this.phase = 'error'; this.frame = nativeQuiet(); this.retryAt = this.now() + 1000;
    this.message = '音频组件暂不可用，正在重试。';
  }
  private stop() {
    const child = this.child; this.child = undefined;
    if (child) {
      child.stdin.end('q\n');
      const deadline = setTimeout(() => { if (child.exitCode === null) child.kill(); }, 500);
      deadline.unref();
    }
    this.frame = nativeQuiet(); this.phase = 'idle'; this.message = '系统声音已断开。';
    if (!this.options.enabled()) this.leases.clear();
  }
  dispose() {
    this.disposed = true; clearInterval(this.timer); this.leases.clear(); this.stop();
  }
}
