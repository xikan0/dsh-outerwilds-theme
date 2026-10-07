import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
await mkdir('.sandbox/test', { recursive: true });
const modules = {};
for (const name of ['config', 'scene', 'controller', 'runtime']) {
  const result = await build({ entryPoints: [`src/${name}.ts`], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.png': 'dataurl' } });
  const destination = resolve(`.sandbox/test/${name}.mjs`); await writeFile(destination, result.outputFiles[0].contents);
  modules[name] = await import(pathToFileURL(destination));
}
const { DEFAULTS } = modules.config;
function mockForm(writable = true) {
  let snapshot = { status: 'ready', writable, mode: 'host', value: { ...DEFAULTS } };
  const listeners = new Set();
  return { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async set(field, value) { snapshot = { ...snapshot, value: { ...snapshot.value, [field]: value } }; listeners.forEach(fn => fn()); return true; },
    async mutate(ops) { for (const op of ops) await this.set(op.path[0], op.value); return true; }, listeners,
  };
}
function mockTheme() {
  let snapshot = { preference: 'dark', fontSize: 14, active: { colorScheme: 'dark' } };
  let layer = 0;
  return { getTheme: () => snapshot, writes: 0, overrides: 0, releases: 0,
    setTheme(id) { this.writes++; snapshot = { ...snapshot, preference: id, active: { colorScheme: id === 'light' ? 'light' : 'dark' } }; },
    setFontSize(px) { snapshot = { ...snapshot, fontSize: px }; },
    overrideTokens(_source, tokens) { this.overrides++; this.tokens = tokens; const own = ++layer; return () => { if (own === layer) this.releases++; }; },
  };
}
test('scene keeps campfire in view through wide, narrow and short containers', () => {
  for (const [width, height] of [[1640,1080],[1086,768],[484,780],[334,600],[334,300],[280,240]]) {
    const l = modules.scene.layoutScene(width, height), {fireX, fireY} = l;
    assert.ok(fireX > 25 && fireX < width-25, `fire x at ${width}x${height}`);
    assert.ok(fireY > 50 && fireY < height-25, `fire y at ${width}x${height}`);
  }
  assert.equal(modules.scene.layoutScene(484,780).tier,'small');
  assert.equal(modules.scene.layoutScene(1086,300).short,true);
});
test('star density follows available area and selected density', () => {
  const count = (w,h,stars) => (modules.scene.starsMarkup(w,h,stars).match(/class="cf-star/g)||[]).length;
  assert.ok(count(1200,800,'many') > count(1200,800,'standard'));
  assert.ok(count(1200,800,'standard') > count(400,600,'standard'));
  assert.ok(count(1200,800,'standard') > count(1200,800,'few'));
});

test('Web stars stay tiny, dense and completely static', () => {
  const markup = modules.scene.starsMarkup(1200, 800, 'standard');
  const dom = new JSDOM(`<svg>${markup}</svg>`);
  const stars = [...dom.window.document.querySelectorAll('.cf-star')];
  assert.ok(stars.length > 900, 'the accepted dense starfield must not return to sparse stars');
  for (const circle of dom.window.document.querySelectorAll('circle')) {
    assert.ok(Number(circle.getAttribute('r')) >= .5 && Number(circle.getAttribute('r')) <= .62, 'tiny dots retain pixel coverage without oversized stars or halos');
    assert.ok(Number(circle.getAttribute('opacity')) >= .65 && Number(circle.getAttribute('opacity')) <= .82, 'avoid compounded dimming of subpixel dots');
  }
  assert.equal(dom.window.document.querySelector('.cf-twinkle,[style],animate'), null, 'Web stars must not have animation or timing styles');
  assert.equal(modules.scene.starsMarkup(1200, 800, 'standard'), markup, 'rebuilding preserves the static field');
  dom.window.close();
});

test('the shared scene uses static backgrounds without live star nodes', () => {
  const dom = new JSDOM(modules.scene.sceneMarkup(1200, 800, DEFAULTS));
  assert.equal(dom.window.document.querySelector('.cf-star-shutter,.cf-star-shutters,.cf-twinkle,.cf-star'), null, 'no per-star DOM elements or animated shutters');
  const sky = dom.window.document.querySelector('.cf-sky');
  assert.equal(sky.childElementCount, 0, 'render the extended sky as one background image');
  assert.ok(sky.style.backgroundImage.includes('data:image/svg+xml,'));
  const background = dom.window.document.querySelector('.cf-art').style.backgroundImage;
  assert.ok(background.startsWith('url('), 'retain the accepted fixed artwork');
  assert.equal(dom.window.document.querySelector('.cf-art-image'), null, 'both platforms use the fixed background drawing path');
  dom.window.close();
});
test('controller rolls back refused writes and reports error', async () => {
  const form = mockForm(), theme = mockTheme(); form.set = async () => false;
  const controller = modules.controller.createController(form,theme);
  const operation = controller.write('brightness',60);
  assert.equal(controller.getSnapshot().prefs.brightness,60);
  await operation;
  assert.equal(controller.getSnapshot().prefs.brightness,35); assert.equal(controller.getSnapshot().error,true); assert.equal(controller.getSnapshot().saving,0);
  controller.dispose(); assert.equal(form.listeners.size,0);
});
test('concurrent edits preserve the newest draft while earlier writes settle', async () => {
  const form=mockForm(), queue=[];
  const realSet=form.set.bind(form); form.set=(key,value)=>new Promise(resolve=>queue.push(async()=>resolve(await realSet(key,value))));
  const controller=modules.controller.createController(form,mockTheme());
  const first=controller.write('brightness',45), second=controller.write('brightness',55);
  await queue[0](); await first; assert.equal(controller.getSnapshot().prefs.brightness,55);
  await queue[1](); await second; assert.equal(controller.getSnapshot().prefs.brightness,55); assert.equal(controller.getSnapshot().saving,0);
  controller.dispose();
});
test('reset preserves enable state and native font settings', async () => {
  const form=mockForm(), theme=mockTheme(); const controller=modules.controller.createController(form,theme);
  await controller.enable(); await controller.write('motion','rich'); controller.fontSize(18); await controller.reset();
  assert.equal(controller.getSnapshot().prefs.enabled,true); assert.equal(controller.getSnapshot().prefs.motion,'gentle'); assert.equal(theme.getTheme().fontSize,18);
  controller.dispose();
});
test('readonly form cannot claim saved changes', async () => {
  const form=mockForm(false), theme=mockTheme(), controller=modules.controller.createController(form,theme);
  await controller.write('enabled',true); await controller.enable(); controller.fontSize(18);
  assert.equal(controller.getSnapshot().prefs.enabled,false); assert.equal(controller.getSnapshot().message,'');
  assert.equal(theme.writes,0); assert.equal(theme.getTheme().fontSize,14); controller.dispose();
});
test('runtime adapts host replacement, respects reduced motion and removes every owned layer', async () => {
  const dom = new JSDOM('<body><div id="root"><div data-slot="root"><div><div data-slot="main.conversation"><main data-phase="hero"></main></div><div data-shell-overlay></div></div></div></div></body>');
  Object.assign(globalThis, { window:dom.window, document:dom.window.document, MutationObserver:dom.window.MutationObserver });
  const observers=[];
  globalThis.ResizeObserver=class { constructor(fn){this.fn=fn;observers.push(this);} observe(){} disconnect(){this.disconnected=true;} };
  const media=new dom.window.EventTarget(); media.matches=false; dom.window.matchMedia=()=>media;
  let box={left:280,top:0,width:1086,height:768};
  dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return {...box,right:box.left+box.width,bottom:box.top+box.height};};
  const theme=mockTheme(), runtime=modules.runtime.createVisualRuntime(theme);
  runtime.update({...DEFAULTS,enabled:true});
  assert.equal(document.querySelectorAll('.cf-stage').length,1); assert.equal(theme.overrides,1);
  const artNode = document.querySelector('.cf-art');
  const staticSky = document.querySelector('.cf-sky'), originalSkyImage = staticSky.style.backgroundImage;
  runtime.refreshTheme(); assert.equal(theme.overrides,1);
  box={left:56,top:0,width:334,height:600}; observers[0].fn(); assert.equal(document.querySelector('.cf-stage').dataset.tier,'small');
  box={left:0,top:0,width:240,height:160}; observers[0].fn(); assert.equal(document.querySelector('.cf-stage').dataset.minimal,'true');
  box={left:0,top:0,width:540,height:780}; observers[0].fn(); assert.equal(document.querySelector('.cf-stage').dataset.minimal,'false');
  assert.equal(document.querySelector('.cf-art'),artNode,'resizing must preserve the decoded artwork');
  assert.equal(document.querySelector('.cf-sky'),staticSky,'resizing preserves the single static sky node');
  assert.notEqual(staticSky.style.backgroundImage,originalSkyImage,'the static sky still adapts to container geometry');
  media.matches=true; media.dispatchEvent(new dom.window.Event('change')); assert.equal(document.querySelector('.cf-stage').dataset.motion,'still');
  const host=document.querySelector('[data-slot="main.conversation"]'); host.innerHTML='<main data-phase="active"></main>';
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(document.querySelector('.cf-stage').dataset.phase,'active'); assert.equal(document.querySelectorAll('[data-cf-conversation]').length,1);
  theme.setTheme('light'); runtime.refreshTheme(); assert.equal(document.querySelectorAll('.cf-stage').length,0); assert.equal(document.body.hasAttribute('data-dsh-campfire'),false);
  theme.setTheme('dark'); runtime.refreshTheme(); assert.equal(document.querySelectorAll('.cf-stage').length,1);
  const writes=theme.writes; runtime.dispose(); runtime.dispose(); assert.equal(theme.writes,writes);
  assert.equal(document.querySelectorAll('.cf-stage,[data-cf-frame],[data-cf-conversation]').length,0); assert.equal(document.body.hasAttribute('data-dsh-campfire'),false);
  assert.ok(observers.every(o=>o.disconnected)); dom.window.close();
});
test('unknown host layout falls back to palette without claiming a scene', () => {
  const dom=new JSDOM('<body><div id="root"><main></main></div></body>');
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver});
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  const media=new dom.window.EventTarget();media.matches=false;dom.window.matchMedia=()=>media;
  const theme=mockTheme(), runtime=modules.runtime.createVisualRuntime(theme);
  runtime.update({...DEFAULTS,enabled:true}); assert.equal(theme.overrides,1); assert.equal(document.querySelector('.cf-stage'),null);runtime.dispose();dom.window.close();
});

test('Desktop adaptation handles late platform markers, column moves and cleanup while retaining the Web palette', async () => {
  const dom = new JSDOM('<body><div id="root"><div data-slot="root"><div data-test-frame><div data-test-sidebar><div data-slot="sidebar"></div></div><div data-test-center><div data-slot="main"><div data-slot="main.conversation"><main data-phase="hero"></main></div></div></div><div data-shell-overlay></div></div></div></div></body>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const media = new dom.window.EventTarget(); media.matches = false; dom.window.matchMedia = () => media;
  const theme = mockTheme(), runtime = modules.runtime.createVisualRuntime(theme);
  const originalColumn = document.querySelector('[data-test-center]');
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 });
  runtime.update({ ...DEFAULTS, enabled: true });
  const webTokens = theme.tokens;
  assert.equal(webTokens['--dsw-alias-bg-layer-2'].dark, '#16262d');
  assert.equal(document.body.hasAttribute('data-cf-desktop'), false);
  assert.equal(document.querySelector('.cf-stage').dataset.sky, 'refined');
  const acceptedArt = document.querySelector('.cf-art'), acceptedSky = document.querySelector('.cf-sky');
  const acceptedBackground = acceptedArt.style.backgroundImage;
  assert.equal(document.querySelector('[data-cf-center-column]'), originalColumn);
  assert.equal(document.querySelector('[data-test-sidebar]').hasAttribute('data-cf-center-column'), false);
  document.documentElement.setAttribute('data-windows-titlebar', '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.body.hasAttribute('data-cf-desktop'), true);
  assert.equal(document.querySelector('.cf-stage').dataset.sky, 'refined');
  assert.equal(document.querySelector('.cf-art'), acceptedArt, 'a late Desktop marker must retain the accepted static artwork');
  assert.equal(document.querySelector('.cf-sky'), acceptedSky, 'Desktop retains the single static sky node');
  assert.equal(document.querySelector('.cf-art').style.backgroundImage, acceptedBackground);
  assert.equal(document.querySelector('.cf-star,.cf-twinkle,.cf-star-shutter'), null, 'Desktop must not restore the old star animation');
  assert.equal(theme.tokens['--dsw-alias-bg-layer-2'].dark, '#403c3a');
  assert.equal(theme.tokens['--dsw-alias-bg-base'].dark, '#071017');
  runtime.update({ ...DEFAULTS, enabled: true, opacity: 90 });
  assert.equal(theme.tokens['--dsw-menu-surface-fill'].dark, 'rgba(52, 49, 48, 0.9)');
  const replacementColumn = document.createElement('div');
  document.querySelector('[data-test-frame]').appendChild(replacementColumn);
  replacementColumn.appendChild(document.querySelector('[data-slot="main"]'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(originalColumn.hasAttribute('data-cf-center-column'), false);
  assert.equal(document.querySelector('[data-cf-center-column]'), replacementColumn);
  document.querySelector('[data-slot="main.conversation"]').remove();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelector('[data-cf-center-column]'), null);
  document.documentElement.removeAttribute('data-windows-titlebar');
  await new Promise(resolve => setImmediate(resolve));
  runtime.update({ ...DEFAULTS, enabled: true });
  assert.deepEqual(theme.tokens, webTokens);
  runtime.update({ ...DEFAULTS, enabled: false });
  assert.equal(document.querySelector('[data-dsh-campfire], [data-cf-desktop], [data-cf-frame], [data-cf-center-column], [data-cf-conversation]'), null);
  runtime.dispose();
  const overrides = theme.overrides;
  document.documentElement.setAttribute('data-windows-titlebar', '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(theme.overrides, overrides, 'disposed platform observer must not apply tokens');
  dom.window.close();
});

test('theme tokens survive a light-to-dark switch when the presenter receives an older snapshot', async () => {
  const dom = new JSDOM('<body><div id="root"></div></body>');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const media = new dom.window.EventTarget(); media.matches = false; dom.window.matchMedia = () => media;
  const listeners = [];
  let scheme = 'dark', layer;
  const token = '--dsw-alias-button-info-fill';
  const theme = {
    getTheme() { return { preference: scheme, fontSize: 15, active: { colorScheme: scheme, tokens: layer ? { [token]: layer[token][scheme] } : {} } }; },
    setTheme(next) { scheme = next; publish(); },
    setFontSize() {},
    overrideTokens(_source, tokens) {
      layer = tokens; publish();
      return () => { if (layer === tokens) { layer = undefined; publish(); } };
    },
  };
  function publish() {
    const snapshot = theme.getTheme();
    for (const listener of listeners) listener(snapshot);
  }
  const form = mockForm(); await form.set('enabled', true);
  const controller = modules.controller.createController(form, theme);
  const runtime = modules.runtime.createVisualRuntime(theme);
  // The plugin subscribes before the host presenter. Reentrant theme/change
  // events can otherwise let the outer, stale snapshot win the final write.
  listeners.push(() => controller.themeChanged());
  listeners.push(snapshot => {
    document.body.style.removeProperty(token);
    if (snapshot.active.tokens[token]) document.body.style.setProperty(token, snapshot.active.tokens[token]);
  });
  controller.attach(runtime);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.body.style.getPropertyValue(token), '#e8a15b');
  theme.setTheme('light');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.body.style.getPropertyValue(token), '');
  theme.setTheme('dark');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.body.style.getPropertyValue(token), '#e8a15b');
  controller.dispose(); runtime.dispose(); dom.window.close();
});
