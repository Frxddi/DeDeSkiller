// Mini-Server zum lokalen Testen (liefert den Projektordner aus).
//   node serve.mjs [port]
//   → http://localhost:8080/dist/index.html?dev=1
//   → http://localhost:8080/demo/moodle-demo.html   (mehrere iframes wie in Moodle)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(root, path === '/' ? 'dist/index.html' : path));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, () => {
  console.log(`http://localhost:${port}/dist/index.html?dev=1`);
  console.log(`http://localhost:${port}/demo/moodle-demo.html`);
});
