import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(project, '.sandbox/audio-prototype');
await mkdir(outdir, { recursive: true });
await build({
  absWorkingDir: project, entryPoints: ['src/audio-wave/prototype.tsx'], outdir,
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', sourcemap: true,
  loader: { '.ttf': 'dataurl', '.woff2': 'dataurl' },
});
await writeFile(resolve(outdir, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>显示屏外观 · 频谱原型 06</title><link rel="stylesheet" href="/prototype.css"></head>
<body><div id="root"></div><script type="module" src="/prototype.js"></script></body></html>`);

if (process.argv.includes('--build-only')) {
  console.log(`Built standalone audio prototype: ${outdir}`);
} else {
  const port = Number(process.env.AUDIO_PROTOTYPE_PORT || 3093);
  const routes = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/prototype.js', ['prototype.js', 'text/javascript; charset=utf-8']],
    ['/prototype.css', ['prototype.css', 'text/css; charset=utf-8']],
    ['/prototype.js.map', ['prototype.js.map', 'application/json; charset=utf-8']],
    ['/prototype.css.map', ['prototype.css.map', 'application/json; charset=utf-8']],
  ]);
  const server = createServer(async (request, response) => {
    const route = routes.get(new URL(request.url, 'http://localhost').pathname);
    if (!route) { response.writeHead(404); response.end(); return; }
    try {
      const body = await readFile(resolve(outdir, route[0]));
      response.writeHead(200, {
        'Content-Type': route[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });
      response.end(body);
    } catch { response.writeHead(500); response.end('Prototype asset unavailable. Restart npm run audio:prototype.'); }
  });
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Stop the existing prototype or set AUDIO_PROTOTYPE_PORT.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Audio prototype: http://127.0.0.1:${port}`));
  process.on('SIGINT', () => server.close());
  process.on('SIGTERM', () => server.close());
}
