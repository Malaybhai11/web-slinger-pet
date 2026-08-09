import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = fileURLToPath(new URL('./public', import.meta.url));
const projectRoot = fileURLToPath(new URL('./', import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url || '/', 'http://local').pathname);
    if (p === '/') p = '/index.html';

    let file;
    if (p.startsWith('/node_modules/')) {
      file = normalize(join(projectRoot, p));
      if (!file.startsWith(projectRoot)) {
        res.writeHead(403);
        return res.end();
      }
    } else {
      file = normalize(join(publicRoot, p));
      if (!file.startsWith(publicRoot)) {
        res.writeHead(403);
        return res.end();
      }
    }

    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`web-slinger-pet dev server -> http://localhost:${PORT}`);
});
