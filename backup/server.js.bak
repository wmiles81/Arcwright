/**
 * Arcwright static file server with OpenRouter image model proxy.
 * Pure Node.js — no dependencies required.
 *
 * Replaces `npx serve` in the dist package, adding a server-side proxy for
 * the OpenRouter image model list endpoint (which is CORS-blocked from browsers).
 */
import http  from 'http';
import https from 'https';
import fs    from 'fs';
import path  from 'path';
import cp    from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

// Proxy /or-image-models → OpenRouter frontend endpoint (server-side, no CORS)
function proxyImageModels(res) {
  const opts = {
    hostname: 'openrouter.ai',
    path: '/api/frontend/models/find?q=&output_modalities=image&limit=200',
    method: 'GET',
    headers: { 'Accept': 'application/json', 'User-Agent': 'Arcwright/1.0' },
  };
  const req = https.request(opts, (r) => {
    res.writeHead(r.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    r.pipe(res);
  });
  req.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  req.end();
}

const server = http.createServer((req, res) => {
  // Proxy endpoint
  if (req.url === '/or-image-models' || req.url.startsWith('/or-image-models?')) {
    return proxyImageModels(res);
  }

  // Static file serving with SPA fallback
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');  // SPA fallback
  }

  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Arcwright running at ${url}`);
  console.log('Press Ctrl+C to stop.\n');
  // Open browser
  const cmd = process.platform === 'win32' ? `start ${url}`
            : process.platform === 'darwin' ? `open ${url}`
            : `xdg-open ${url}`;
  setTimeout(() => cp.exec(cmd), 800);
});
