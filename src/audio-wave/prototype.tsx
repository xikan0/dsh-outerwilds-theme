// Standalone functional prototype: each frequency band drives its own curve height.
import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioInput } from './input';
import { quietFrame } from './analysis.ts';
import { SpectrumLine } from './spectrum-line.ts';
import { AUDIO_WAVE_PRESET } from './preset.ts';
import './prototype.css';

const input = new AudioInput();
const sourceNames = { system: '系统 / 标签页声音', microphone: '麦克风', test: '测试音', native: '系统声音' };
const phaseNames = { idle: '未连接', requesting: '等待授权', listening: '已连接', error: '连接失败' };

function Prototype() {
  const snapshot = useSyncExternalStore(input.subscribe, input.getSnapshot);
  const [metrics, setMetrics] = useState(quietFrame);
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [strength, setStrength] = useState(10);
  const surface = useRef<HTMLDivElement>(null);
  const requesting = snapshot.phase === 'requesting';
  const connected = snapshot.phase === 'listening';
  const suspended = connected && snapshot.contextState !== 'running';
  const audible = connected && !suspended && metrics.rms > 0.00001;

  useEffect(() => {
    const wave = new SpectrumLine(surface.current!);
    let frame = 0, lastReadout = -Infinity;
    const tick = (now: number) => {
      const value = input.read();
      const state = input.getSnapshot();
      wave.update(value, state.phase === 'listening' && state.contextState === 'running', now);
      if (now - lastReadout > 100) { setMetrics(value); lastReadout = now; }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (document.hidden) wave.pause();
      else { wave.resume(); frame = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      cancelAnimationFrame(frame);
      wave.dispose();
    };
  }, []);

  return <div className="audio-prototype" data-view={view}>
    <aside className="prototype-sidebar">
      <div className="prototype-brand">OUTER WILDS<small>音频功能原型</small></div>
      <nav aria-label="页面切换测试">
        <button aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')}>⌂　首页</button>
        <button aria-current={view === 'chat' ? 'page' : undefined} onClick={() => setView('chat')}>◇　聊天</button>
      </nav>
      <p className="sidebar-note">切换页面时，下面的音频模块保持连接。</p>
      <footer className="prototype-footer">
        <section className="audio-module" aria-label="音频响应频谱" data-audio-state={snapshot.phase} title={
          suspended ? '音频分析暂停' : connected ? (audible ? '正在响应声音' : '已连接 · 当前安静') : phaseNames[snapshot.phase]
        }>
          <div className="audio-frequency-heading">
            <div className="audio-frequency-caption">频率：</div>
            <div className="audio-frequency-station">
              <span className="audio-frequency-bracket" aria-hidden="true">{'<'}</span>
              <span className="audio-frequency-name">Outer Wilds探险队</span>
              <span className="audio-frequency-bracket" aria-hidden="true">{'>'}</span>
            </div>
          </div>
          <div className="wave-frame">
            <span className="wave-endcap wave-endcap-left" aria-hidden="true"/>
            <div className="wave-surface" ref={surface} aria-hidden="true"/>
            <span className="wave-endcap wave-endcap-right" aria-hidden="true"/>
          </div>
        </section>
        <button className="settings-position" disabled>⚙　设置<span>位置示意</span></button>
      </footer>
    </aside>
    <main>
      <header><span>SPECTRUM PROTOTYPE · 06 · 显示屏外观</span><span>{view === 'home' ? '首页' : '聊天'}预览</span></header>
      <h1>查看显示屏中的文字与频谱</h1>
      <p className="intro">深蓝屏幕中央微亮、边缘渐暗，外侧是一圈较薄的灰褐色边框。文字、波形和两端竖线带有柔和光晕；继续使用已确认的排版、右行波和固定参数。</p>
      <section className="controls" aria-label="声音来源">
        <h2>连接声音</h2>
        <div className="source-buttons">
          <button className="primary" disabled={requesting} onClick={() => { void input.connect('system'); }}>连接系统 / 标签页声音</button>
          <button disabled={requesting} onClick={() => { void input.connect('microphone'); }}>连接麦克风</button>
          {suspended && <button onClick={() => { void input.resume(); }}>恢复音频分析</button>}
          <button className="disconnect" disabled={snapshot.phase === 'idle'} onClick={() => input.stop()}>断开</button>
        </div>
        <p className="share-help">监听音乐软件：选择“整个屏幕”，勾选“共享系统音频”。监听网页：选择正在播放声音的标签页，勾选共享音频。是否提供声音共享由浏览器决定。</p>
        <p className="connection-message" role="status" data-error={snapshot.phase === 'error'}>{snapshot.message}</p>
        <div className="sliders">
          <label htmlFor="sensitivity"><span>响应增益 <output>{AUDIO_WAVE_PRESET.gain.toFixed(1)}×</output></span><input id="sensitivity" type="range" min="1" max="30" value={AUDIO_WAVE_PRESET.gain * 10} disabled/></label>
          <label htmlFor="spectrum-release"><span>收束时间 <output>{AUDIO_WAVE_PRESET.releaseMs} ms</output></span><input id="spectrum-release" type="range" min="150" max="900" step="25" value={AUDIO_WAVE_PRESET.releaseMs} disabled/></label>
          <label htmlFor="wave-intensity"><span>显示高度 <output>{AUDIO_WAVE_PRESET.intensity * 100}%</output></span><input id="wave-intensity" type="range" min="40" max="160" value={AUDIO_WAVE_PRESET.intensity * 100} disabled/></label>
        </div>
        <p className="test-help">波形与以上参数已确认并固定，刷新后仍使用同一组数值。</p>
      </section>
      <section className="controls" aria-label="频段试音">
        <h2>听一听不同频段</h2>
        <div className="source-buttons">
          <button disabled={requesting} onClick={() => { void input.startTestTone(strength / 100, false, 110); }}>低频 · 110 Hz</button>
          <button disabled={requesting} onClick={() => { void input.startTestTone(strength / 100, false, 1000); }}>中频 · 1 kHz</button>
          <button disabled={requesting} onClick={() => { void input.startTestTone(strength / 100, false, 6000); }}>高频 · 6 kHz</button>
          <button disabled={requesting} onClick={() => { void input.startTestTone(strength / 100, true); }}>鼓点 · 120 BPM</button>
        </div>
        <div className="sliders">
          <label htmlFor="test-strength"><span>测试音强度 <output>{strength}%</output></span><input id="test-strength" type="range" min="0" max="50" value={strength} onChange={event => {
            const value = Number(event.target.value); input.setTestStrength(value / 100); setStrength(value);
          }}/></label>
        </div>
        <p className="test-help">试音会替换当前声音来源，并以较低音量播放。持续音时，波峰会向右经过对应频段，但起伏明显的区域留在原处；鼓点会让这片区域展开后逐渐收束。点击“断开”停止。</p>
      </section>
      <section className="readouts" aria-label="实时诊断信息">
        <h2>实时状态</h2>
        <dl>
          <div><dt>来源</dt><dd>{snapshot.source ? sourceNames[snapshot.source] : '—'}</dd></div>
          <div><dt>连接</dt><dd>{phaseNames[snapshot.phase]}</dd></div>
          <div><dt>分析引擎</dt><dd>{snapshot.contextState}</dd></div>
          <div><dt>采样率</dt><dd>{snapshot.sampleRate ? `${snapshot.sampleRate} Hz` : '—'}</dd></div>
          <div><dt>原始音量 RMS</dt><dd data-rms>{metrics.rms.toFixed(5)}</dd></div>
          <div><dt>峰值</dt><dd>{metrics.peak.toFixed(5)}</dd></div>
          <div><dt>当前声音</dt><dd>{connected ? (suspended ? '暂停' : audible ? '有声音' : '安静') : '—'}</dd></div>
          <div><dt>低频响应</dt><dd>{(metrics.bass * 100).toFixed(1)}%</dd></div>
          <div><dt>中频响应</dt><dd>{(metrics.mid * 100).toFixed(1)}%</dd></div>
          <div><dt>高频响应</dt><dd>{(metrics.treble * 100).toFixed(1)}%</dd></div>
          <div><dt>绘制方式</dt><dd>固定振幅区域 · 右行波</dd></div>
        </dl>
      </section>
      <p className="prototype-note">这是独立功能测试页。左侧模拟侧栏底部位置，尚未挂入 DSH 主题插件。声音在本机分析，屏幕画面不用于绘制。</p>
    </main>
  </div>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<Prototype/>);
window.addEventListener('pagehide', () => input.stop('页面离开，声音来源已断开。'));
