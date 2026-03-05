#!/usr/bin/env node
/**
 * Arcwright MCP Server — exposes project data to ACP agents via MCP protocol.
 *
 * Runs as a stdio subprocess. The ACP agent spawns this server and communicates
 * via JSON-RPC over stdin/stdout.
 *
 * Data directory: set via ARCWRITE_DATA_DIR env var (default: /Volumes/home/Arcwrite)
 *
 * Tools:
 *   - list_scenes        → scene files from Scenes/ dir
 *   - read_scene          → full content of a scene file
 *   - get_genre_config    → genre, subgenre, modifier, pacing from settings.json
 *   - get_scaffold_beats  → scaffold beats with dimension values
 *   - list_projects       → project directories
 *   - read_project        → full project JSON
 *   - search_content      → grep-style search across scenes
 *
 * Resources:
 *   - arcwright://settings       → current settings summary
 *   - arcwright://scenes         → scene listing
 *   - arcwright://scene/{name}   → individual scene content
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.ARCWRITE_DATA_DIR || '/Volumes/home/Arcwrite';
const SCENES_DIR = path.join(DATA_DIR, 'Scenes');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read and parse settings.json, returning {} on failure. */
function readSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

/** List files in a directory with size info. */
function listDir(dirPath, extensions = []) {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries
            .filter(e => {
                if (!e.isFile()) return false;
                if (extensions.length === 0) return true;
                return extensions.some(ext => e.name.endsWith(ext));
            })
            .map(e => {
                const fullPath = path.join(dirPath, e.name);
                const stats = fs.statSync(fullPath);
                return {
                    name: e.name,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                };
            });
    } catch {
        return [];
    }
}

/** Simple content search across files in a directory. */
function searchFiles(dirPath, query, extensions = ['.md', '.txt']) {
    const results = [];
    const files = listDir(dirPath, extensions);
    const lowerQuery = query.toLowerCase();

    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(dirPath, file.name), 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(lowerQuery)) {
                    results.push({
                        file: file.name,
                        line: i + 1,
                        content: lines[i].trim(),
                    });
                    if (results.length >= 50) return results;
                }
            }
        } catch {
            // Skip unreadable files
        }
    }
    return results;
}

// ── MCP Server Setup ─────────────────────────────────────────────────────────

const server = new McpServer({
    name: 'arcwright',
    version: '1.0.0',
});

// ── Tools ────────────────────────────────────────────────────────────────────

server.tool(
    'list_scenes',
    'List all scene/chapter files in the Arcwright project',
    {},
    async () => {
        const scenes = listDir(SCENES_DIR, ['.md', '.txt']);
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(scenes, null, 2),
            }],
        };
    }
);

server.tool(
    'read_scene',
    'Read the full content of a scene/chapter file',
    { filename: z.string().describe('Scene filename (e.g., "Chapter-01.md")') },
    async ({ filename }) => {
        const safeName = path.basename(filename); // prevent directory traversal
        const filePath = path.join(SCENES_DIR, safeName);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return {
                content: [{
                    type: 'text',
                    text: content,
                }],
            };
        } catch {
            return {
                content: [{
                    type: 'text',
                    text: `Error: File "${safeName}" not found in Scenes directory.`,
                }],
                isError: true,
            };
        }
    }
);

server.tool(
    'get_genre_config',
    'Get the current genre, subgenre, modifier, and pacing settings',
    {},
    async () => {
        const settings = readSettings();
        const config = {
            genre: settings.selectedGenre || 'unknown',
            subgenre: settings.selectedSubgenre || 'unknown',
            modifier: settings.selectedModifier || '',
            pacing: settings.selectedPacing || '',
            structure: settings.selectedStructure || '',
            blendEnabled: settings.blendEnabled || false,
            secondaryGenre: settings.secondaryGenre || '',
            secondarySubgenre: settings.secondarySubgenre || '',
            blendRatio: settings.blendRatio || 0,
        };
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(config, null, 2),
            }],
        };
    }
);

server.tool(
    'get_scaffold_beats',
    'Get the current scaffold beats with all dimension values',
    {},
    async () => {
        const settings = readSettings();
        const beats = settings.scaffoldBeats || [];
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(beats, null, 2),
            }],
        };
    }
);

server.tool(
    'list_projects',
    'List all projects (AI projects and book projects) in the Arcwrite data directory',
    {},
    async () => {
        const projects = [];
        // AI projects subdirectory
        const aiDir = path.join(PROJECTS_DIR, 'ai');
        if (fs.existsSync(aiDir)) {
            try {
                const entries = fs.readdirSync(aiDir, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isDirectory()) {
                        projects.push({ name: e.name, type: 'ai' });
                    }
                }
            } catch { /* skip */ }
        }
        // Book projects
        const booksDir = path.join(PROJECTS_DIR, 'books');
        if (fs.existsSync(booksDir)) {
            try {
                const entries = fs.readdirSync(booksDir, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isDirectory()) {
                        projects.push({ name: e.name, type: 'book' });
                    }
                }
            } catch { /* skip */ }
        }
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(projects, null, 2),
            }],
        };
    }
);

server.tool(
    'read_project',
    'Read a project\'s metadata and files',
    {
        name: z.string().describe('Project name'),
        type: z.enum(['ai', 'book']).describe('Project type'),
    },
    async ({ name, type }) => {
        const safeName = path.basename(name);
        const projectDir = path.join(PROJECTS_DIR, type === 'ai' ? 'ai' : 'books', safeName);
        if (!fs.existsSync(projectDir)) {
            return {
                content: [{ type: 'text', text: `Project "${safeName}" not found.` }],
                isError: true,
            };
        }
        // Read all JSON and markdown files in the project
        const files = {};
        try {
            const entries = fs.readdirSync(projectDir, { withFileTypes: true });
            for (const e of entries) {
                if (e.isFile() && (e.name.endsWith('.json') || e.name.endsWith('.md') || e.name.endsWith('.txt'))) {
                    try {
                        files[e.name] = fs.readFileSync(path.join(projectDir, e.name), 'utf-8');
                    } catch { /* skip unreadable */ }
                }
            }
        } catch { /* skip */ }
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({ name: safeName, type, files }, null, 2),
            }],
        };
    }
);

server.tool(
    'search_content',
    'Search for text across all scenes and project files',
    { query: z.string().describe('Text to search for (case-insensitive)') },
    async ({ query }) => {
        const results = searchFiles(SCENES_DIR, query);
        return {
            content: [{
                type: 'text',
                text: results.length > 0
                    ? JSON.stringify(results, null, 2)
                    : `No results found for "${query}".`,
            }],
        };
    }
);

// ── Resources ────────────────────────────────────────────────────────────────

server.resource(
    'settings',
    'arcwright://settings',
    { description: 'Current Arcwright settings (genre, weights, structure)' },
    async () => {
        const settings = readSettings();
        // Return a focused summary, not the entire 200KB settings blob
        const summary = {
            genre: settings.selectedGenre,
            subgenre: settings.selectedSubgenre,
            modifier: settings.selectedModifier,
            pacing: settings.selectedPacing,
            structure: settings.selectedStructure,
            blendEnabled: settings.blendEnabled,
            scaffoldBeatCount: (settings.scaffoldBeats || []).length,
            chapterCount: (settings.chapters || []).length,
        };
        return {
            contents: [{
                uri: 'arcwright://settings',
                mimeType: 'application/json',
                text: JSON.stringify(summary, null, 2),
            }],
        };
    }
);

server.resource(
    'scenes',
    'arcwright://scenes',
    { description: 'List of all scene/chapter files' },
    async () => {
        const scenes = listDir(SCENES_DIR, ['.md', '.txt']);
        return {
            contents: [{
                uri: 'arcwright://scenes',
                mimeType: 'application/json',
                text: JSON.stringify(scenes, null, 2),
            }],
        };
    }
);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[arcwright-mcp] Server running on stdio');
    console.error(`[arcwright-mcp] Data dir: ${DATA_DIR}`);
}

main().catch(err => {
    console.error('[arcwright-mcp] Fatal:', err.message);
    process.exit(1);
});
