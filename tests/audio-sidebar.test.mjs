import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body data-dsh-campfire></body></html>', { pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(window, 'isSecureContext', { value: true });
const { createRoot } = await import('react-dom/client');
await mkdir('.sandbox/test/audio-sidebar', { recursive: true });
for (const entry of ['src/audio-wave/sidebar.tsx', 'src/audio-wave/sidebar-session.ts', 'src/audio-wave/host-input.ts', 'src/audio-wave/spectrum-line.ts', 'src/controller.ts', 'src/config.ts']) {
  const result = await build({ entryPoints: [entry], outdir: '.sandbox/test/audio-sidebar', bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], write: false });
  for (const file of result.outputFiles) await writeFile(file.path, file.contents);
}
const moduleAt = name => import(pathToFileURL(resolve(`.sandbox/test/audio-sidebar/${name}.js`)));
const { AudioSidebar } = await moduleAt('sidebar');
const { createSidebarAudio } = await moduleAt('sidebar-session');
const { HostAudioInput } = await moduleAt('host-input');
const { createController } = await moduleAt('controller');
const { DEFAULTS, normalize } = await moduleAt('config');
const { SpectrumMotion } = await moduleAt('spectrum-line');
const style = document.createElement('style');
style.textContent = await readFile('src/audio-wave/sidebar.css', 'utf8');
document.head.append(style);

let width = 216, roots = [], controller, session, form, theme, requests, tracks, contexts, grant;
let resizeObservers = [], intersectionObservers = [], rafs = new Map(), serial = 0;
globalThis.requestAnimationFrame = fn => { rafs.set(++serial, fn); return serial; };
globalThis.cancelAnimationFrame = id => rafs.delete(id);
globalThis.ResizeObserver = class {
  constructor(fn) { this.fn = fn; resizeObservers.push(this); }
  observe() {} disconnect() { this.closed = true; }
};
globalThis.IntersectionObserver = class {
  constructor(fn) { this.fn = fn; intersectionObservers.push(this); }
  observe() {} disconnect() { this.closed = true; }
};
Object.defineProperties(dom.window.HTMLElement.prototype, {
  clientWidth: { get: () => width }, clientHeight: { get: () => 74 },
});
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  const ctx = { points: [], setTransform() {}, clearRect() {}, beginPath() { this.points = []; }, moveTo(x,y) { this.points.push([x,y]); }, lineTo(x,y) { this.points.push([x,y]); }, stroke() {} };
  this.drawContext = ctx;
  return ctx;
};
class Track extends EventTarget { readyState = 'live'; stop() { this.readyState = 'ended'; } }
class Stream {
  constructor(audio = [new Track()]) { this.audio = audio; this.video = new Track(); }
  getAudioTracks() { return this.audio; }
  getTracks() { return [...this.audio, this.video]; }
}
globalThis.MediaStream = Stream;
globalThis.AudioContext = class {
  state = 'suspended'; sampleRate = 48000;
  constructor() { contexts.push(this); }
  async resume() { this.state = 'running'; this.onstatechange?.(); }
  async close() { this.state = 'closed'; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createAnalyser() { return { fftSize: 4096, frequencyBinCount: 2048, disconnect() {}, getFloatTimeDomainData(a) { a.fill(.08); }, getFloatFrequencyData(a) { a.fill(-55); } }; }
};

function setup(audioAuto = true, input) {
  width = 216; requests = 0; contexts = []; tracks = [];
  grant = async () => { const stream = new Stream(); tracks.push(...stream.getTracks()); return stream; };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia() { requests++; return grant(); } } });
  const listeners = new Set();
  let snapshot = { status: 'ready', writable: true, mode: 'host', value: { ...DEFAULTS, enabled: true, audioAuto } };
  form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async set(key, value) { snapshot = { ...snapshot, value: { ...snapshot.value, [key]: value } }; listeners.forEach(fn => fn()); return true; } };
  theme = { dark: true, getTheme() { return { fontSize: 14, active: { colorScheme: this.dark ? 'dark' : 'light' } }; } };
  controller = createController(form, theme);
  session = createSidebarAudio(controller, input);
}
async function mount(wide = true) {
  const host = document.createElement('div');
  host.dataset.slot = 'sidebar';
  host.innerHTML = '<div><div class="footer-actions"><div data-slot="sidebar.footer.action" style="display:contents"></div></div><div data-slot="sidebar.settings">设置</div></div>';
  document.body.append(host);
  const root = createRoot(host.querySelector('[data-slot="sidebar.footer.action"]'));
  roots.push(root);
  await act(async () => root.render(createElement(AudioSidebar, { controller, input: session.input, wide })));
  return { root, host, render: wide => act(async () => root.render(createElement(AudioSidebar, { controller, input: session.input, wide }))) };
}
async function connect() { await act(async () => { void session.input.connect('system'); }); }
afterEach(async () => {
  await act(async () => { roots.forEach(root => root.unmount()); session?.dispose(); controller?.dispose(); });
  assert.equal(rafs.size, 0, 'all rendering loops released');
  assert.ok(resizeObservers.every(o => o.closed));
  assert.ok(intersectionObservers.every(o => o.closed));
  roots = []; resizeObservers = []; intersectionObservers = []; document.body.replaceChildren();
});
after(() => dom.window.close());

test('sidebar stretches with the host, repaints pinned endpoints, and stays above settings', async () => {
  setup();
  const { host } = await mount();
  assert.equal(requests, 0, 'mount must never request capture');
  assert.equal(normalize({ enabled: true }).audioAuto, false, 'profiles without an audio choice start disabled');
  const canvas = host.querySelector('canvas');
  assert.equal(canvas.style.width, '216px');
  width = 372; resizeObservers.forEach(o => o.fn());
  assert.equal(canvas.style.width, '372px');
  assert.deepEqual(canvas.drawContext.points[0], [0,37]);
  assert.deepEqual(canvas.drawContext.points.at(-1), [372,37]);
  assert.equal(window.getComputedStyle(host.querySelector('.cf-audio-sidebar')).flexBasis, '100%');
  assert.equal(window.getComputedStyle(host.querySelector('.footer-actions')).flexWrap, 'wrap');
  assert.equal(host.querySelectorAll('.cf-wave-endcap').length, 2);
  assert.equal(window.getComputedStyle(host.querySelector('.cf-wave-endcap-right')).left, '100%');
  assert.equal(host.querySelector('.cf-audio-frequency-name').textContent, 'Outer Wilds探险队');
});

test('capture survives sidebar remount and collapse; hiding the feature releases all tracks', async () => {
  setup(); const first = await mount(); await connect();
  assert.equal(session.input.getSnapshot().phase, 'listening');
  await first.render(false);
  assert.equal(document.querySelector('canvas'), null);
  assert.ok(tracks.every(t => t.readyState === 'live'));
  await act(async () => first.root.unmount()); roots = []; first.host.remove();
  await mount();
  assert.equal(requests, 1);
  assert.equal(document.querySelector('.cf-audio-module').getAttribute('role'), 'img');
  await act(async () => controller.write('audioAuto', false));
  assert.equal(document.querySelector('.cf-audio-module'), null);
  assert.ok(tracks.every(t => t.readyState === 'ended'));
  assert.ok(contexts.every(c => c.state === 'closed'));
  await act(async () => controller.write('audioAuto', true));
  assert.equal(requests, 1, 'showing again must wait for a new click');
});

test('one saved audio choice hides by default, starts native capture when enabled, and restores both choices after restart', async () => {
  const calls = [];
  const rpc = { async call(channel, endpoint, payload) {
    calls.push({ endpoint, ...payload });
    return { ok: true, value: { phase: 'listening', message: 'native', sampleRate: 48000, rms: 0, peak: 0, powers: [0,0,0,0,0,0] } };
  } };
  setup(false, new HostAudioInput(rpc));
  let mounted = await mount();
  assert.equal(document.querySelector('.cf-audio-module'), null);
  assert.equal(calls.length, 0);
  assert.equal(requests, 0);
  await act(async () => controller.write('audioAuto', true));
  assert.ok(document.querySelector('.cf-audio-module'));
  assert.equal(session.input.getSnapshot().phase, 'listening');
  assert.equal(session.input.getSnapshot().source, 'native');
  assert.equal(form.getSnapshot().value.audioAuto, true);
  assert.equal(requests, 0, 'enabling the feature must not request browser sharing');
  const display = document.querySelector('.cf-audio-module');
  assert.equal(display.tagName, 'DIV');
  assert.equal(display.getAttribute('tabindex'), null);
  assert.equal(display.getAttribute('title'), null);
  assert.equal(window.getComputedStyle(display).cursor, 'default');
  assert.equal(document.querySelector('.cf-audio-sidebar button'), null);
  assert.equal(document.querySelector('.cf-audio-action'), null);
  const releases = calls.filter(call => call.endpoint === 'outerwilds-audio/release').length;
  await act(async () => {
    display.click();
    for (const key of ['Enter', ' ']) display.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }));
  });
  assert.equal(session.input.getSnapshot().phase, 'listening', 'display interaction must not disconnect capture');
  assert.equal(form.getSnapshot().value.audioAuto, true);
  assert.equal(calls.filter(call => call.endpoint === 'outerwilds-audio/release').length, releases);
  async function restart() {
    await act(async () => { mounted.root.unmount(); session.dispose(); controller.dispose(); });
    roots = []; mounted.host.remove();
    controller = createController(form, theme);
    session = createSidebarAudio(controller, new HostAudioInput(rpc));
    mounted = await mount();
  }
  await restart();
  assert.ok(document.querySelector('.cf-audio-module'));
  assert.equal(session.input.getSnapshot().phase, 'listening');
  assert.equal(requests, 0);
  const currentSession = calls.findLast(call => call.endpoint === 'outerwilds-audio/read').session;
  await act(async () => controller.write('audioAuto', false));
  assert.equal(document.querySelector('.cf-audio-module'), null);
  assert.equal(session.input.getSnapshot().phase, 'idle');
  assert.ok(calls.some(call => call.endpoint === 'outerwilds-audio/release' && call.session === currentSession));
  const reads = calls.filter(call => call.endpoint === 'outerwilds-audio/read').length;
  await restart();
  assert.equal(document.querySelector('.cf-audio-module'), null);
  assert.equal(calls.filter(call => call.endpoint === 'outerwilds-audio/read').length, reads);
  assert.equal(form.getSnapshot().value.audioAuto, false);
});

test('late capture permission is discarded after disabling the theme', async () => {
  setup(); let resolve;
  grant = () => new Promise(r => { resolve = r; });
  await mount(); await connect();
  assert.equal(session.input.getSnapshot().phase, 'requesting');
  await act(async () => controller.write('enabled', false));
  const stream = new Stream();
  await act(async () => resolve(stream));
  assert.ok(stream.getTracks().every(t => t.readyState === 'ended'));
  assert.equal(session.input.getSnapshot().phase, 'idle');
});

test('display remains passive on capture errors and suspension; light mode, page exit and disposal release audio', async () => {
  setup(); await mount();
  grant = async () => { throw new Error('测试：没有音频轨道'); };
  await connect();
  assert.equal(document.querySelector('.cf-audio-sidebar button'), null);
  assert.match(document.querySelector('[role="status"]').textContent, /没有音频/);
  grant = async () => { const stream = new Stream(); tracks.push(...stream.getTracks()); return stream; };
  await connect();
  await act(async () => { contexts.at(-1).state = 'suspended'; contexts.at(-1).onstatechange?.(); });
  assert.equal(document.querySelector('.cf-audio-sidebar button'), null);
  assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /点击|断开声音来源/);
  await act(async () => session.input.resume());
  await act(async () => { theme.dark = false; controller.themeChanged(); });
  assert.ok(tracks.every(t => t.readyState === 'ended'));
  await act(async () => { theme.dark = true; controller.themeChanged(); });
  await connect();
  await act(async () => window.dispatchEvent(new dom.window.Event('pagehide')));
  assert.ok(tracks.every(t => t.readyState === 'ended'));
  await connect();
  await act(async () => session.dispose());
  assert.ok(tracks.every(t => t.readyState === 'ended'));
});

test('the accepted release remains 250 ms to ten percent across refresh rates', () => {
  setup();
  for (const fps of [60, 120]) {
    const motion = new SpectrumMotion();
    for (let i=0; i<fps; i++) motion.step([1,1,1,1,1,1],1/fps);
    const peak = motion.getLevels()[0];
    for (let i=0; i<fps/4; i++) motion.step([0,0,0,0,0,0],1/fps);
    assert.ok(Math.abs(motion.getLevels()[0]/peak-.1)<.0001);
  }
});
