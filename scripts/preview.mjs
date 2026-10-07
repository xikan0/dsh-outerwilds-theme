import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve('.sandbox/preview');
const routes = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]]);
createServer(async (req, res) => {
  const route = routes.get(new URL(req.url, 'http://localhost').pathname);
  if (!route) { res.writeHead(404); return res.end(); }
  try { const data = await readFile(resolve(root, route[0])); res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(500); res.end('Build the preview first.'); }
}).listen(3092, '127.0.0.1', () => console.log('Scene preview: http://127.0.0.1:3092'));
