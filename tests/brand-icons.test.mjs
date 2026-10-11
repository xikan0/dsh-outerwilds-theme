import test from 'node:test';
import assert from 'node:assert/strict';
import { build, transform } from 'esbuild';
import { JSDOM } from 'jsdom';
import { assetLoaders } from '../scripts/asset-loaders.mjs';

test('embedded icon masks remain valid CSS URLs after the SVG loader runs', async () => {
  const result = await build({ entryPoints: ['src/brand-icons.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: assetLoaders });
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
  const css = await transform(module.brandIconVariables, { loader: 'css', logLevel: 'silent' });
  assert.deepEqual(css.warnings.map(warning => warning.text), [], 'an invalid URL disables the mask and leaves a solid colour rectangle');
  const urls = [...module.brandIconVariables.matchAll(/url\("([^"\r\n]+)"\)/g)].map(match => match[1]);
  assert.equal(urls.length, 2);
  for (const url of urls) {
    assert.ok(url.startsWith('data:image/svg+xml;base64,'), 'masks must carry valid embedded SVG images');
    const svg = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').toString('utf8');
    const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
    assert.equal(dom.window.document.documentElement.localName, 'svg');
    assert.ok(dom.window.document.querySelector('path[d]'), 'retain the symbol geometry');
    assert.equal(dom.window.document.querySelector('rect,image,script'), null, 'no full rectangular background or active/external content');
    dom.window.close();
  }
});
