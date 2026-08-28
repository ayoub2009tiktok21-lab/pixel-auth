// tiny static server for local dev/preview (no deps)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = parseInt(process.env.PORT || '8080', 10);

// ensure the bundle is current (index.html loads plain ironline.js)
try {
  const fresh = (p) => {
    try { return statSync(p).mtimeMs; } catch { return 0; }
  };
  const stale = fresh(join(root, 'src/main.js')) > fresh(join(root, 'ironline.js'));
  if (stale) {
    console.log('building ironline.js…');
    execFileSync('node', [join(root, 'build-web.mjs')], { stdio: 'inherit' });
  }
} catch (e) {
  console.warn('bundle build failed (serving as-is):', e.message);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`IRONLINE dev server: http://0.0.0.0:${port}`);
});
