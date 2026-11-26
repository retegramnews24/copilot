// Anteprima locale: piccolo server per la cartella public/ (il browser non apre le pagine file://).
//   node scripts/anteprima.mjs            -> http://localhost:8788
//   node scripts/anteprima.mjs 8791       -> su un'altra porta
// Nelle sessioni di Claude parte da .claude/launch.json («giulio-static»).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const port = Number(process.argv[2]) || 8788;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm'
};

http
  .createServer(async (req, res) => {
    let file = join(root, decodeURIComponent(req.url.split('?')[0]));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('404');
    }
  })
  .listen(port, '127.0.0.1', () => console.log('Anteprima: http://localhost:' + port));
