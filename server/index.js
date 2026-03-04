/**
 * Arcwright API server.
 *
 * Runs on a separate port from Vite. In development, Vite proxies /api/*
 * to this server. In production, this server handles everything: API,
 * static assets, OpenRouter proxy, and SPA fallback.
 *
 * Data directory defaults to ~/.arcwright but can be overridden with
 * the ARCWRIGHT_DATA environment variable.
 */

import express from 'express';
import https from 'https';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase } from './db.js';
import databaseRoutes from './routes/database.js';
import filesRoutes, { setDataDir } from './routes/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || (IS_PROD ? '3000' : '5174'), 10);
const DATA_DIR = process.env.ARCWRIGHT_DATA || path.join(os.homedir(), '.arcwright');

const app = express();
app.use(express.json({ limit: '50mb' }));

// Initialize database
initDatabase(DATA_DIR);
setDataDir(DATA_DIR);
console.log(`[API] Data directory: ${DATA_DIR}`);

// ── API routes ──────────────────────────────────────────────────────────
app.use('/api', databaseRoutes);
app.use('/api', filesRoutes);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', dataDir: DATA_DIR, port: PORT, mode: IS_PROD ? 'production' : 'development' });
});

// ── OpenRouter image-model proxy (CORS-blocked from browser) ────────────
app.get('/or-image-models', (req, res) => {
    const opts = {
        hostname: 'openrouter.ai',
        path: '/api/frontend/models/find?q=&output_modalities=image&limit=200',
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'Arcwright/3.0' },
    };
    const proxy = https.request(opts, (upstream) => {
        res.writeHead(upstream.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        upstream.pipe(res);
    });
    proxy.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    });
    proxy.end();
});

// ── Production: serve Vite static build + SPA fallback ──────────────────
if (IS_PROD) {
    const distDir = path.join(__dirname, '..', 'dist');
    app.use(express.static(distDir));
    // SPA fallback: any non-API, non-file request gets index.html
    app.get('/{*path}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

// ── Start ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[API] Arcwright ${IS_PROD ? '(production)' : '(development)'} running at http://localhost:${PORT}`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        console.log(`\n[API] ${sig} received — shutting down`);
        closeDatabase();
        process.exit(0);
    });
}

