/**
 * Filesystem REST API routes.
 *
 * Replaces the browser-side arcwriteFS.js operations with server-side
 * equivalents using Node.js fs. All paths are relative to the data directory.
 *
 * Folder structure mirrors the original Arcwrite layout:
 *   <dataDir>/
 *   ├── settings.json
 *   ├── projects/books/{BookName}/
 *   ├── chat-history/{ProjectSlug}/
 *   ├── prompts/
 *   ├── sequences/
 *   ├── extensions/{PackName}/
 *   └── _Artifacts/
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';

let DATA_DIR = '';

export function setDataDir(dir) {
    DATA_DIR = dir;
}

function dataPath(...parts) {
    return path.join(DATA_DIR, ...parts);
}

function ensureDir(...parts) {
    const dir = dataPath(...parts);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

function writeJson(filePath, data) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Default settings (matches arcwriteFS.js)
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
    version: 2,
    activeProvider: 'openrouter',
    providers: {
        openrouter: { apiKey: '', selectedModel: 'anthropic/claude-sonnet-4-5-20250929', availableModels: [] },
        openai: { apiKey: '', selectedModel: 'gpt-4o', availableModels: [] },
        anthropic: { apiKey: '', selectedModel: 'claude-sonnet-4-5-20250929', availableModels: [] },
        perplexity: { apiKey: '', selectedModel: 'sonar-pro', availableModels: [] },
    },
    chatSettings: {
        temperature: 1,
        maxTokens: 4096,
        toolsEnabled: true,
        reasoningEnabled: false,
        promptMode: 'full',
    },
    editorTheme: 'light',
    imageSettings: { provider: '', model: '', defaultSize: '1024x1024' },
};

function migrateSettings(settings) {
    if (!settings || settings.version >= 2) return settings;
    return {
        ...DEFAULT_SETTINGS,
        activeProvider: 'openrouter',
        providers: {
            ...DEFAULT_SETTINGS.providers,
            openrouter: {
                ...DEFAULT_SETTINGS.providers.openrouter,
                apiKey: settings.apiKey || '',
                selectedModel: settings.selectedModel || 'anthropic/claude-sonnet-4-5-20250929',
            },
        },
        chatSettings: settings.chatSettings || DEFAULT_SETTINGS.chatSettings,
        editorTheme: settings.editorTheme || 'light',
        version: 2,
    };
}

const router = Router();

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

router.get('/settings', (_req, res) => {
    const settingsPath = dataPath('settings.json');
    let settings = readJsonSafe(settingsPath);
    if (!settings) {
        settings = { ...DEFAULT_SETTINGS };
        writeJson(settingsPath, settings);
    } else if (settings.version < 2) {
        settings = migrateSettings(settings);
        writeJson(settingsPath, settings);
    }
    res.json(settings);
});

router.put('/settings', (req, res) => {
    const settingsPath = dataPath('settings.json');
    writeJson(settingsPath, req.body);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Book Projects
// ---------------------------------------------------------------------------

router.get('/projects/books', (_req, res) => {
    const booksDir = ensureDir('projects', 'books');
    const entries = fs.readdirSync(booksDir, { withFileTypes: true });
    const projects = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    res.json(projects);
});

router.post('/projects/books', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    ensureDir('projects', 'books', name);
    res.status(201).json({ ok: true, name });
});

router.delete('/projects/books/:name', (req, res) => {
    const dir = dataPath('projects', 'books', req.params.name);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    res.json({ ok: true });
});

// Book project file tree
router.get('/projects/books/:name/tree', (req, res) => {
    const dir = dataPath('projects', 'books', req.params.name);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Book project not found' });
    res.json(walkTree(dir));
});

// Book chat history
router.get('/projects/books/:name/chat', (req, res) => {
    const chatPath = dataPath('projects', 'books', req.params.name, '.chat.json');
    res.json(readJsonSafe(chatPath) || []);
});

router.put('/projects/books/:name/chat', (req, res) => {
    const chatPath = dataPath('projects', 'books', req.params.name, '.chat.json');
    writeJson(chatPath, req.body);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// AI Projects
// ---------------------------------------------------------------------------

router.get('/projects/ai', (_req, res) => {
    const chatDir = ensureDir('chat-history');
    const entries = fs.readdirSync(chatDir, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectJson = readJsonSafe(path.join(chatDir, entry.name, 'project.json'));
        if (projectJson) projects.push(projectJson);
    }
    projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(projects);
});

router.post('/projects/ai', (req, res) => {
    const project = req.body;
    if (!project.name) return res.status(400).json({ error: 'name required' });
    const projectDir = ensureDir('chat-history', project.name);
    writeJson(path.join(projectDir, 'project.json'), { ...project, updatedAt: Date.now() });
    res.status(201).json({ ok: true });
});

router.put('/projects/ai/:name', (req, res) => {
    const project = req.body;
    const projectDir = ensureDir('chat-history', req.params.name);
    writeJson(path.join(projectDir, 'project.json'), { ...project, updatedAt: Date.now() });
    res.json({ ok: true });
});

router.delete('/projects/ai/:name', (req, res) => {
    const projectJsonPath = dataPath('chat-history', req.params.name, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
        fs.unlinkSync(projectJsonPath);
    }
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Chat History
// ---------------------------------------------------------------------------

router.get('/chat-history/:slug', (req, res) => {
    const slug = req.params.slug.replace(/[^a-zA-Z0-9_-]/g, '_');
    const activePath = dataPath('chat-history', slug, 'active.json');
    const history = readJsonSafe(activePath);
    if (history !== null) return res.json(history);

    // Legacy fallback
    const legacyPath = dataPath('projects', 'ai', '.chats', `${slug}.json`);
    const legacy = readJsonSafe(legacyPath);
    if (legacy && legacy.length > 0) {
        ensureDir('chat-history', slug);
        writeJson(activePath, legacy);
        try { fs.unlinkSync(legacyPath); } catch { }
        return res.json(legacy);
    }

    res.json([]);
});

router.put('/chat-history/:slug', (req, res) => {
    const slug = req.params.slug.replace(/[^a-zA-Z0-9_-]/g, '_');
    ensureDir('chat-history', slug);
    writeJson(dataPath('chat-history', slug, 'active.json'), req.body);
    res.json({ ok: true });
});

router.post('/chat-history/:slug/archive', (req, res) => {
    const slug = req.params.slug.replace(/[^a-zA-Z0-9_-]/g, '_');
    const chatDir = ensureDir('chat-history', slug);
    const activePath = path.join(chatDir, 'active.json');
    const current = readJsonSafe(activePath);
    if (current && current.length > 0) {
        const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
        writeJson(path.join(chatDir, `${stamp}.json`), current);
    }
    writeJson(activePath, []);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

router.get('/prompts', (_req, res) => {
    const promptsDir = ensureDir('prompts');
    const prompts = [];
    const entries = fs.readdirSync(promptsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        try {
            const filePath = path.join(promptsDir, entry.name);
            const text = fs.readFileSync(filePath, 'utf-8');
            if (entry.name.endsWith('.json')) {
                prompts.push(JSON.parse(text));
            } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
                const stat = fs.statSync(filePath);
                const title = entry.name.replace(/\.(md|txt)$/, '');
                prompts.push({
                    id: `file:${entry.name}`,
                    title,
                    content: text,
                    isFileBased: true,
                    createdAt: stat.mtimeMs,
                    updatedAt: stat.mtimeMs,
                });
            }
        } catch (e) {
            console.warn(`[files] Failed to load prompt ${entry.name}:`, e.message);
        }
    }
    prompts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    res.json(prompts);
});

router.post('/prompts', (req, res) => {
    const prompt = req.body;
    if (!prompt.id) return res.status(400).json({ error: 'id required' });
    const promptsDir = ensureDir('prompts');
    writeJson(path.join(promptsDir, `${prompt.id}.json`), { ...prompt, updatedAt: Date.now() });
    res.status(201).json({ ok: true });
});

router.delete('/prompts/:id', (req, res) => {
    const promptsDir = ensureDir('prompts');
    const id = req.params.id;
    const filename = id.startsWith('file:') ? id.slice(5) : `${id}.json`;
    const filePath = path.join(promptsDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

router.get('/sequences', (_req, res) => {
    const seqDir = ensureDir('sequences');
    const sequences = [];
    const entries = fs.readdirSync(seqDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        try {
            sequences.push(JSON.parse(fs.readFileSync(path.join(seqDir, entry.name), 'utf-8')));
        } catch (e) {
            console.warn(`[files] Failed to parse sequence ${entry.name}:`, e.message);
        }
    }
    sequences.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(sequences);
});

router.post('/sequences', (req, res) => {
    const sequence = req.body;
    if (!sequence.id) return res.status(400).json({ error: 'id required' });
    const seqDir = ensureDir('sequences');
    writeJson(path.join(seqDir, `${sequence.id}.json`), { ...sequence, updatedAt: Date.now() });
    res.status(201).json({ ok: true });
});

router.delete('/sequences/:id', (req, res) => {
    const seqDir = ensureDir('sequences');
    const filePath = path.join(seqDir, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Extension Packs
// ---------------------------------------------------------------------------

router.get('/extensions', (_req, res) => {
    const extDir = dataPath('extensions');
    if (!fs.existsSync(extDir)) return res.json([]);
    const packs = [];
    const entries = fs.readdirSync(extDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(extDir, entry.name, 'pack.json');
        const manifest = readJsonSafe(manifestPath);
        if (manifest) {
            packs.push({ ...manifest, id: manifest.id || entry.name });
        }
    }
    res.json(packs);
});

router.get('/extensions/:id/content', (req, res) => {
    const extDir = dataPath('extensions', req.params.id);
    if (!fs.existsSync(extDir)) return res.status(404).json({ error: 'Pack not found' });
    const manifest = readJsonSafe(path.join(extDir, 'pack.json'));
    if (!manifest?.includes) return res.json({});

    const result = { genres: null, dimensionRanges: null, structures: null, prompts: [], sequences: [] };
    const includes = manifest.includes;

    if (includes.genres) {
        const data = readJsonSafe(path.join(extDir, includes.genres));
        if (data) {
            if (data._dimensionRanges) {
                result.dimensionRanges = data._dimensionRanges;
                delete data._dimensionRanges;
            }
            result.genres = data;
        }
    }

    if (includes.structures) {
        result.structures = readJsonSafe(path.join(extDir, includes.structures));
    }

    for (const [type, dirName] of [['prompts', includes.prompts], ['sequences', includes.sequences]]) {
        if (!dirName) continue;
        const dir = path.join(extDir, dirName.replace(/\/$/, ''));
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
        for (const fname of files) {
            const parsed = readJsonSafe(path.join(dir, fname));
            if (parsed) result[type].push(parsed);
        }
    }

    res.json(result);
});

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

router.get('/artifacts/tree', (_req, res) => {
    const artDir = dataPath('_Artifacts');
    if (!fs.existsSync(artDir)) return res.json([]);
    res.json(walkTree(artDir));
});

router.get('/artifacts/file/{*filePath}', (req, res) => {
    const artDir = dataPath('_Artifacts');
    const filePath = path.join(artDir, req.params.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
});

// ---------------------------------------------------------------------------
// Generic file read by relative path
// ---------------------------------------------------------------------------

router.get('/files/{*filePath}', (req, res) => {
    const filePath = dataPath(req.params.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return res.json(walkTree(filePath));
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
});

// ---------------------------------------------------------------------------
// Directory tree walker (helper)
// ---------------------------------------------------------------------------

function walkTree(dirPath, parentRelative = '') {
    const entries = [];
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
        if (item.name.startsWith('.')) continue;
        const relativePath = parentRelative ? `${parentRelative}/${item.name}` : item.name;
        if (item.isDirectory()) {
            entries.push({
                name: item.name,
                path: relativePath,
                type: 'dir',
                children: walkTree(path.join(dirPath, item.name), relativePath),
            });
        } else {
            entries.push({ name: item.name, path: relativePath, type: 'file' });
        }
    }
    return entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

export default router;
