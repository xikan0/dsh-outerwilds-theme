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
async function mount({ writable = true, refuse = false } = {}) {
  const listeners = new Set();
  let snapshot = { status: 'ready', writable, mode: 'host', value: { ...DEFAULTS } };
  const form = {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async set(field, value) {
      if (refuse) return false;
      snapshot = { ...snapshot, value: { ...snapshot.value, [field]: value } };
      listeners.forEach(fn => fn());
      return true;
    },
    async mutate() { return false; },
  };
  let themeSnapshot = { preference: 'dark', fontSize: 14, active: { colorScheme: 'dark' } };
  const theme = {
    getTheme: () => themeSnapshot,
    setTheme() {},
    setFontSize(px) { themeSnapshot = { ...themeSnapshot, fontSize: px }; controller.themeChanged(); },
    overrideTokens() { return () => {}; },
  };
  controller = createController(form, theme);
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
