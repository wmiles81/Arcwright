/**
 * Arcwright API server.
 *
 * Runs on a separate port from Vite. In development, Vite proxies /api/*
 * to this server. In production, the static server handles both.
 *
 * Data directory defaults to ~/.arcwright but can be overridden with
 * the ARCWRIGHT_DATA environment variable.
 */

import express from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase } from './db.js';
import databaseRoutes from './routes/database.js';
import filesRoutes, { setDataDir } from './routes/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = parseInt(process.env.API_PORT || '5174', 10);
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
    res.json({ status: 'ok', dataDir: DATA_DIR, port: API_PORT });
});

// ── Start ───────────────────────────────────────────────────────────────
app.listen(API_PORT, () => {
    console.log(`[API] Arcwright API running at http://localhost:${API_PORT}`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
        console.log(`\n[API] ${sig} received — shutting down`);
        closeDatabase();
        process.exit(0);
    });
}
