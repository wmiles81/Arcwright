/**
 * Arcwright static file server with OpenRouter image model proxy.
 * Pure Node.js — no dependencies required.
 *
 * Replaces `npx serve` in the dist package, adding a server-side proxy for
 * the OpenRouter image model list endpoint (which is CORS-blocked from browsers).
 */
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import cp from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
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

// ── ACP Agent Streaming Endpoint ──────────────────────────────────────────────
//
// POST /api/acp/chat
// Body: { command, args?, prompt, systemPrompt?, messages?, env?, sessionId? }
// Response: SSE stream (text/event-stream) with data: JSON lines
//
// Spawns an ACP agent as a child process, sends the prompt via AI SDK's
// streamText, and relays chunks back as Server-Sent Events.
//
async function handleACPChat(req, res) {
  // Read request body
  let body = '';
  for await (const chunk of req) body += chunk;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const { command, args = [], prompt, systemPrompt, messages, env = {} } = parsed;

  if (!command) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required field: command' }));
    return;
  }
  if (!prompt && (!messages || messages.length === 0)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required field: prompt or messages' }));
    return;
  }

  // Build messages array for streamText — prepend system prompt if provided
  const streamMessages = [];
  if (systemPrompt) {
    streamMessages.push({ role: 'system', content: systemPrompt });
    console.log(`[ACP] Platform context injected (${systemPrompt.length} chars)`);
  }
  if (messages && messages.length > 0) {
    streamMessages.push(...messages);
  }

  let provider;
  try {
    // Dynamic import — these are ESM packages brought in by @mcpc-tech/acp-ai-provider
    const { createACPProvider } = await import('@mcpc-tech/acp-ai-provider');
    const { streamText } = await import('ai');

    // Add node_modules/.bin to PATH so local agent binaries are found
    const localBinPath = path.join(process.cwd(), 'node_modules', '.bin');
    const envPath = `${localBinPath}${path.delimiter}${process.env.PATH || ''}`;

    provider = createACPProvider({
      command,
      args,
      env: { ...env, PATH: envPath },
      session: {
        cwd: process.cwd(),
        mcpServers: [],
      },
    });

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const { textStream } = streamText({
      model: provider.languageModel(),
      prompt: streamMessages.length === 0 ? prompt : undefined,
      messages: streamMessages.length > 0 ? streamMessages : undefined,
      tools: provider.tools,
    });

    for await (const chunk of textStream) {
      // Format as SSE data line — same shape as OpenAI-compat streaming
      const data = JSON.stringify({
        choices: [{ delta: { content: chunk } }],
      });
      res.write(`data: ${data}\n\n`);
    }

    // Signal stream end
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[ACP] Error:', err.message);
    // If headers haven't been sent yet, send error as JSON
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } else {
      // Headers already sent (mid-stream error), send as SSE error event
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } finally {
    if (provider) {
      try { provider.cleanup(); } catch { /* ignore cleanup errors */ }
    }
  }
}

const server = http.createServer((req, res) => {
  // ── CORS preflight for API endpoints ──
  if (req.method === 'OPTIONS' && req.url.startsWith('/api/')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── ACP chat endpoint ──
  if (req.method === 'POST' && (req.url === '/api/acp/chat' || req.url.startsWith('/api/acp/chat?'))) {
    return handleACPChat(req, res);
  }

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
