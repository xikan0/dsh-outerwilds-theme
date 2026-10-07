import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
await mkdir('lib', { recursive: true });
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', format: 'esm', external: ['@deepseek-ai/schemastery'], sourcemap: true });
const client = await build({ entryPoints: ['src/client.tsx'], bundle: true, platform: 'browser', format: 'cjs', write: false, external: ['react', 'react/jsx-runtime'], loader: { '.css': 'text', '.png': 'dataurl' }, jsx: 'automatic' });
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-theme-campfire",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`);
await build({ entryPoints: ['src/preview.tsx'], outfile: '.sandbox/preview/app.js', bundle: true, platform: 'browser', format: 'esm', loader: { '.css': 'text', '.png': 'dataurl' }, jsx: 'automatic' });
await writeFile('.sandbox/preview/index.html', await readFile('scripts/preview.html'));
console.log('Built host, DSH client module, and shared preview.');
