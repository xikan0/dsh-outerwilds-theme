import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { AppearanceController } from '../controller';
import type { AudioFeed } from './input';
import { audioAvailable } from './sidebar-session';
import { SpectrumLine } from './spectrum-line';

export function AudioSidebar({ controller, input, wide = false }: {
  controller: AppearanceController; input: AudioFeed; wide?: boolean;
}) {
  const appearance = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return wide && audioAvailable(appearance) ? <AudioDisplay input={input}/> : null;
}

function AudioDisplay({ input }: { input: AudioFeed }) {
  const snapshot = useSyncExternalStore(input.subscribe, input.getSnapshot);
  const surface = useRef<HTMLSpanElement>(null);
  const [renderError, setRenderError] = useState('');
  const statusId = useId();
  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    let line: SpectrumLine;
    try { line = new SpectrumLine(node); }
    catch (error) { setRenderError(error instanceof Error ? error.message : '无法绘制频谱。'); return; }
    let raf = 0, inView = true, settleUntil = 0;
    const draw = (now: number) => {
      raf = 0;
      if (document.hidden || !inView) return;
      const listening = input.getSnapshot().phase === 'listening';
      line.update(input.read(), listening, now);
      if (listening || now < settleUntil) raf = requestAnimationFrame(draw);
    };
    const wake = () => {
      settleUntil = performance.now() + 500;
      if (!raf && !document.hidden && inView) raf = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(raf); raf = 0;
      if (document.hidden || !inView) line.pause();
      else { line.resume(); wake(); }
    };
    const observer = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      visibility();
    });
    observer.observe(node);
    const off = input.subscribe(wake);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      off(); cancelAnimationFrame(raf); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      line.dispose();
    };
  }, [input]);

  const listening = snapshot.phase === 'listening';
  const suspended = listening && snapshot.contextState !== 'running';
  return <div className="cf-audio-sidebar">
    <div className="cf-audio-module" role="img" aria-label="Outer Wilds探险队音频响应频谱"
      aria-describedby={statusId} data-audio-state={snapshot.phase}>
      <span className="cf-audio-frequency-heading">
        <span className="cf-audio-frequency-caption">频率：</span>
        <span className="cf-audio-frequency-station">
          <span className="cf-audio-frequency-bracket" aria-hidden="true">{'<'}</span>
          <span className="cf-audio-frequency-name">Outer Wilds探险队</span>
          <span className="cf-audio-frequency-bracket" aria-hidden="true">{'>'}</span>
        </span>
      </span>
      <span className="cf-wave-frame" aria-hidden="true">
        <span className="cf-wave-endcap cf-wave-endcap-left"/>
        <span className="cf-wave-surface" ref={surface}/>
        <span className="cf-wave-endcap cf-wave-endcap-right"/>
      </span>
    </div>
    <span id={statusId} className={snapshot.phase === 'error' || renderError ? 'cf-audio-error' : 'cf-audio-sr-only'} role="status">
      {renderError || (suspended ? '音频响应暂时暂停。' : snapshot.message)}
    </span>
  </div>;
}
