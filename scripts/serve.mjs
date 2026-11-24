import { createReadStream, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const port = Number(process.env.ROHRRUNNER_PORT) || 4173;
const publicFiles = new Set(['index.html', 'manifest.webmanifest', 'sw.js']);
const publicFolders = new Set(['src', 'data', 'icons', 'vendor']);
const withinRoot = path => path !== '..' && !path.startsWith(`..${sep}`) && path !== '';

createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const parts = requested.split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || part.startsWith('.')) ||
        !(publicFiles.has(requested) || publicFolders.has(parts[0]) && parts.length > 1)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const path = resolve(root, requested);
    if (!withinRoot(relative(root, path)) || !withinRoot(relative(root, realpathSync(path)))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!statSync(path).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`RohrRunner: http://127.0.0.1:${port}`));
