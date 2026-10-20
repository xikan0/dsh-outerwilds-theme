import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');

await mkdir('.sandbox/test', { recursive: true });
const components = await build({ entryPoints: ['src/settings.tsx', 'src/controller.ts', 'src/config.ts'], outdir: '.sandbox/test/settings-ui', bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], loader: { '.png': 'dataurl' }, write: false });
for (const file of components.outputFiles) {
  await mkdir(resolve('.sandbox/test/settings-ui'), { recursive: true });
  await writeFile(file.path, file.contents);
}
const { SettingsPanel } = await import(pathToFileURL(resolve('.sandbox/test/settings-ui/settings.js')));
const { createController } = await import(pathToFileURL(resolve('.sandbox/test/settings-ui/controller.js')));
const { DEFAULTS } = await import(pathToFileURL(resolve('.sandbox/test/settings-ui/config.js')));

let root, controller;
async function mount({ writable = true, refuse = false, resetResult, staleFirstWrite = false, modernFonts = false, missingEntry = false } = {}) {
  const listeners = new Set();
  let snapshot = { status: 'ready', writable, mode: 'host', revision: 0, value: { ...DEFAULTS } };
  if (missingEntry) snapshot = { ...snapshot, status: 'unavailable', value: undefined };
  const form = {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async set(field, value) {
      if (missingEntry) return false;
      if (refuse) return false;
      if (staleFirstWrite) {
        staleFirstWrite = false;
        snapshot = { ...snapshot, revision: snapshot.revision + 1 };
        listeners.forEach(fn => fn());
        return false;
      }
      snapshot = { ...snapshot, revision: snapshot.revision + 1, value: { ...snapshot.value, [field]: value } };
      listeners.forEach(fn => fn());
      return true;
    },
    async mutate(ops) {
      const accepted = await resetResult;
      if (!accepted) return false;
      snapshot = { ...snapshot, value: { ...snapshot.value, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) } };
      listeners.forEach(fn => fn());
      return true;
    },
  };
  let themeSnapshot = modernFonts
    ? { preference: 'dark', fontSizes: { text: 16, code: 12, terminal: 13 }, active: { colorScheme: 'dark' } }
    : { preference: 'dark', fontSize: 14, active: { colorScheme: 'dark' } };
  const theme = {
    getTheme: () => themeSnapshot,
    setTheme() {},
    setFontSize(roleOrSize, size) {
      if (modernFonts) {
        assert.equal(roleOrSize, 'text');
        themeSnapshot = { ...themeSnapshot, fontSizes: { ...themeSnapshot.fontSizes, text: size } };
      } else themeSnapshot = { ...themeSnapshot, fontSize: roleOrSize };
      controller.themeChanged();
    },
    overrideTokens() { return () => {}; },
  };
  const native = {
    getSnapshot: () => ({ status: 'ready', writable }),
    async set(field, value) {
      assert.equal(field, 'preference');
      assert.equal(value, 'dark');
      if (missingEntry) {
        missingEntry = false;
        snapshot = { ...snapshot, status: 'ready', value: { ...DEFAULTS } };
        listeners.forEach(fn => fn());
      }
      return true;
    },
  };
  controller = createController(form, theme, native);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(SettingsPanel, { controller })));
  return { form, theme };
}

const numberField = title => document.querySelector(`input[aria-label="${title}数值"]`);
const stepButton = label => document.querySelector(`button[aria-label="${label}"]`);
async function edit(input, text) {
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, text);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function key(input, name) {
  await act(async () => input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true })));
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  controller?.dispose();
  root = controller = undefined;
  document.body.replaceChildren();
});
after(() => dom.window.close());

test('the single audio response choice defaults off and saves enable and disable', async () => {
  const { form } = await mount();
  assert.equal(document.querySelector('#cf-audioVisible-label'), null);
  const label = document.querySelector('#cf-audioAuto-label');
  assert.equal(label.querySelector('.cf-row-title').textContent, '音频响应');
  const buttons = label.parentElement.querySelectorAll('button');
  assert.equal(buttons[0].textContent, '关闭');
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
  await act(async () => buttons[1].click());
  assert.equal(form.getSnapshot().value.audioAuto, true);
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.match(document.querySelector('.cf-status').textContent, /已保存/);
  await act(async () => buttons[0].click());
  assert.equal(form.getSnapshot().value.audioAuto, false);
});

test('enabling from an already-dark host recovers a refreshed settings revision', async () => {
  const { form } = await mount({ staleFirstWrite: true });
  const enableButton = [...document.querySelectorAll('button')].find(button => button.textContent === '启用深色主题');
  await act(async () => enableButton.click());
  assert.equal(form.getSnapshot().value.enabled, true);
  assert.equal(enableButton.textContent, '关闭主题');
  assert.equal(document.querySelector('[role="alert"]'), null);
});

test('the enable button activates an absent Host entry without switching to light', async () => {
  const { form, theme } = await mount({ missingEntry: true });
  const enableButton = [...document.querySelectorAll('button')].find(button => button.textContent === '启用深色主题');
  assert.equal(form.getSnapshot().status, 'unavailable');
  await act(async () => enableButton.click());
  assert.equal(form.getSnapshot().value?.enabled, true);
  assert.equal(enableButton.textContent, '关闭主题');
  assert.equal(theme.getTheme().preference, 'dark');
  assert.equal(document.querySelector('[role="alert"]'), null);
});

test('settings arrows adjust all three sliders by one unit and keep the displays in sync', async () => {
  const { form, theme } = await mount();
  await act(async () => stepButton('增大背景亮度').click());
  assert.equal(form.getSnapshot().value.brightness, 36);
  assert.equal(numberField('背景亮度').value, '36');
  assert.equal(document.querySelector('#cf-brightness').value, '36');
  await act(async () => stepButton('减小面板不透明度').click());
  assert.equal(form.getSnapshot().value.opacity, 95);
  await act(async () => stepButton('增大正文字号').click());
  assert.equal(theme.getTheme().fontSize, 15);
  assert.equal(numberField('正文字号').value, '15');
});

test('role-based font sizes display a number and finite slider progress through edits', async () => {
  const { theme } = await mount({ modernFonts: true });
  const slider = document.querySelector('#cf-font');
  const track = slider.closest('.cf-range-track');
  assert.equal(numberField('正文字号').value, '16');
  assert.equal(slider.value, '16');
  assert.equal(track.style.getPropertyValue('--cf-range-progress'), '50%');
  await act(async () => stepButton('增大正文字号').click());
  assert.equal(numberField('正文字号').value, '17');
  assert.equal(slider.value, '17');
  await edit(numberField('正文字号'), '18');
  await key(numberField('正文字号'), 'Enter');
  assert.equal(numberField('正文字号').value, '18');
  assert.equal(slider.value, '18');
  assert.ok(Number.isFinite(Number.parseFloat(track.style.getPropertyValue('--cf-range-progress'))));
  assert.deepEqual(theme.getTheme().fontSizes, { text: 18, code: 12, terminal: 13 });
});

test('the original slider input still updates the editable number display', async () => {
  const { form } = await mount();
  await act(async () => {
    const slider = document.querySelector('#cf-brightness');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(slider, '49');
    slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.equal(form.getSnapshot().value.brightness, 49);
  assert.equal(numberField('背景亮度').value, '49');
});

test('manual numbers wait for Enter or blur, including native font-size changes', async () => {
  const { form, theme } = await mount();
  const brightness = numberField('背景亮度');
  await edit(brightness, '42');
  assert.equal(form.getSnapshot().value.brightness, 35);
  await key(brightness, 'Enter');
  assert.equal(form.getSnapshot().value.brightness, 42);
  const font = numberField('正文字号');
  await edit(font, '18');
  await act(async () => font.blur());
  assert.equal(theme.getTheme().fontSize, 18);
  assert.equal(document.querySelector('#cf-font').value, '18');
});

test('manual values clamp to bounds, empty edits revert and Escape cancels an edit', async () => {
  const { form } = await mount();
  const brightness = numberField('背景亮度');
  await edit(brightness, '999');
  await key(brightness, 'Enter');
  assert.equal(form.getSnapshot().value.brightness, 65);
  assert.equal(brightness.value, '65');
  assert.equal(stepButton('增大背景亮度').disabled, true);
  await edit(brightness, '20');
  await key(brightness, 'Escape');
  assert.equal(form.getSnapshot().value.brightness, 65);
  assert.equal(brightness.value, '65');
  await edit(brightness, '');
  await act(async () => brightness.blur());
  assert.equal(brightness.value, '65');
  const opacity = numberField('面板不透明度');
  await edit(opacity, '1');
  await act(async () => opacity.blur());
  assert.equal(form.getSnapshot().value.opacity, 90);
  assert.equal(stepButton('减小面板不透明度').disabled, true);
});

test('moving from a numeric draft to an arrow applies the step to the committed value', async () => {
  const { form } = await mount();
  await edit(numberField('背景亮度'), '40');
  await act(async () => stepButton('增大背景亮度').focus());
  await act(async () => stepButton('增大背景亮度').click());
  assert.equal(form.getSnapshot().value.brightness, 41);
  assert.equal(numberField('背景亮度').value, '41');
});

test('readonly settings disable the arrows, numeric inputs and original sliders', async () => {
  const { form, theme } = await mount({ writable: false });
  assert.equal(document.querySelectorAll('.cf-range-step:disabled').length, 6);
  assert.equal(document.querySelectorAll('.cf-range-value input:disabled').length, 3);
  assert.equal(document.querySelectorAll('.cf-range input[type="range"]:disabled').length, 3);
  await act(async () => stepButton('增大背景亮度').click());
  assert.equal(form.getSnapshot().value.brightness, 35);
  assert.equal(theme.getTheme().fontSize, 14);
});

test('a refused numeric save restores the accepted value and reports failure', async () => {
  await mount({ refuse: true });
  const brightness = numberField('背景亮度');
  await edit(brightness, '42');
  await key(brightness, 'Enter');
  assert.equal(brightness.value, '35');
  assert.equal(document.querySelector('#cf-brightness').value, '35');
  assert.match(document.querySelector('[role="alert"]').textContent, /保存失败/);
});

test('reset locks every settings control and unlocks after success or refusal', async () => {
  for (const accepted of [true, false]) {
    let finishReset;
    const resetResult = new Promise(resolve => { finishReset = resolve; });
    const { form } = await mount({ resetResult });
    await act(async () => stepButton('增大背景亮度').click());
    const resetButton = [...document.querySelectorAll('button')].find(button => button.textContent === '恢复默认设置');
    await act(async () => resetButton.click());
    assert.equal(document.querySelectorAll('.cf-settings input:not(:disabled), .cf-settings button:not(:disabled)').length, 0);
    assert.match(document.querySelector('.cf-status').textContent, /正在恢复默认/);
    await act(async () => finishReset(accepted));
    assert.equal(numberField('背景亮度').disabled, false);
    assert.equal(resetButton.disabled, false);
    assert.equal(form.getSnapshot().value.brightness, accepted ? 35 : 36);
    assert.match(document.querySelector('.cf-status').textContent, accepted ? /已恢复/ : /恢复失败/);
    await act(async () => root.unmount());
    controller.dispose();
    root = controller = undefined;
    document.body.replaceChildren();
  }
});
