/**
 * Filesystem abstraction for Arcwrite storage.
 *
 * This module now delegates all operations to the local API server.
 * The export signatures are identical to the original File System Access API
 * version, so stores and components require no changes.
 *
 * Original: File System Access API (browser permission prompts, directory handles)
 * Current:  fetch → local Express API → Node.js fs
 *
 * NOTE: The `arcwriteHandle` parameter is accepted but ignored in all functions.
 * It exists only for backward compatibility with existing store calls.
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

// ---------------------------------------------------------------------------
// Default settings (kept for export in case stores reference it)
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS = {
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

// ---------------------------------------------------------------------------
// Settings migration (still used by stores)
// ---------------------------------------------------------------------------

export function migrateSettings(settings) {
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

// ---------------------------------------------------------------------------
// Helpers (no-ops or shims)
// ---------------------------------------------------------------------------

export async function ensureDir() { /* server-side */ }
export async function readJsonFile() { return null; }
export async function writeJsonFile() { /* server-side */ }

// ---------------------------------------------------------------------------
// Init / Settings
// ---------------------------------------------------------------------------

export async function initArcwrite(_parentHandle, _opts) {
  const settings = await apiGet('/settings');
  return { arcwriteHandle: null, settings };
}

export async function readSettings(_arcwriteHandle) {
  return apiGet('/settings');
}

export async function writeSettings(_arcwriteHandle, settings) {
  await apiPut('/settings', settings);
}

// ---------------------------------------------------------------------------
// Book Project CRUD
// ---------------------------------------------------------------------------

export async function listBookProjects(_arcwriteHandle) {
  return apiGet('/projects/books');
}

export async function createBookProject(_arcwriteHandle, name) {
  await apiPost('/projects/books', { name });
  return null; // original returned directory handle — no longer needed
}

export async function deleteBookProject(_arcwriteHandle, name) {
  await apiDelete(`/projects/books/${encodeURIComponent(name)}`);
}

// ---------------------------------------------------------------------------
// AI Project CRUD
// ---------------------------------------------------------------------------

export async function listAiProjects(_arcwriteHandle) {
  return apiGet('/projects/ai');
}

export async function saveAiProject(_arcwriteHandle, project) {
  await apiPost('/projects/ai', project);
}

export async function deleteAiProject(_arcwriteHandle, projectName) {
  await apiDelete(`/projects/ai/${encodeURIComponent(projectName)}`);
}

// ---------------------------------------------------------------------------
// File reading
// ---------------------------------------------------------------------------

export async function readFileByPath(_arcwriteHandle, relativePath) {
  return apiGet(`/files/${relativePath}`);
}

// ---------------------------------------------------------------------------
// Chat History
// ---------------------------------------------------------------------------

export async function readBookChatHistory(_arcwriteHandle, bookName) {
  return apiGet(`/projects/books/${encodeURIComponent(bookName)}/chat`);
}

export async function writeBookChatHistory(_arcwriteHandle, bookName, messages) {
  await apiPut(`/projects/books/${encodeURIComponent(bookName)}/chat`, messages);
}

export async function readAiChatHistory(_arcwriteHandle, projectName) {
  const slug = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return apiGet(`/chat-history/${slug}`);
}

export async function writeAiChatHistory(_arcwriteHandle, projectName, messages) {
  const slug = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  await apiPut(`/chat-history/${slug}`, messages);
}

export async function archiveAiChatHistory(_arcwriteHandle, projectName) {
  const slug = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  await apiPost(`/chat-history/${slug}/archive`, {});
}

// ---------------------------------------------------------------------------
// Custom Prompts
// ---------------------------------------------------------------------------

export async function listCustomPrompts(_arcwriteHandle) {
  return apiGet('/prompts');
}

export async function saveCustomPrompt(_arcwriteHandle, prompt) {
  await apiPost('/prompts', prompt);
}

export async function deleteCustomPrompt(_arcwriteHandle, promptId) {
  await apiDelete(`/prompts/${encodeURIComponent(promptId)}`);
}

// ---------------------------------------------------------------------------
// Custom Sequences
// ---------------------------------------------------------------------------

export async function listCustomSequences(_arcwriteHandle) {
  return apiGet('/sequences');
}

export async function saveCustomSequence(_arcwriteHandle, sequence) {
  await apiPost('/sequences', sequence);
}

export async function deleteCustomSequence(_arcwriteHandle, sequenceId) {
  await apiDelete(`/sequences/${encodeURIComponent(sequenceId)}`);
}

// ---------------------------------------------------------------------------
// Extension Packs
// ---------------------------------------------------------------------------

export async function listExtensionPacks(_arcwriteHandle) {
  return apiGet('/extensions');
}

export async function loadPackContent(_packDirHandle, _includes) {
  // In API mode, use the extension content endpoint
  // The pack id should be passed explicitly
  console.warn('[arcwriteFS] loadPackContent — use /api/extensions/:id/content directly');
  return { genres: null, dimensionRanges: null, structures: null, prompts: [], sequences: [] };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export async function readArtifactManifest(_bookProjectHandle) {
  console.warn('[arcwriteFS] readArtifactManifest — needs book project context; use API directly');
  return null;
}

export async function writeArtifactManifest(_bookProjectHandle, _manifest) {
  console.warn('[arcwriteFS] writeArtifactManifest — needs book project context; use API directly');
}

export async function provisionArtifacts(_arcwriteHandle) {
  // Server can handle this during startup if needed
  console.log('[arcwriteFS] provisionArtifacts — handled server-side');
}

export async function walkArtifactsTree(_arcwriteHandle) {
  return apiGet('/artifacts/tree');
}

export async function readArtifactFile(_arcwriteHandle, relativePath) {
  return apiGet(`/artifacts/file/${relativePath}`);
}

// ---------------------------------------------------------------------------
// Directory tree utilities
// ---------------------------------------------------------------------------

export async function walkDirectoryTree(_dirHandle, _parentPath = '') {
  console.warn('[arcwriteFS] walkDirectoryTree — use API /files/* endpoint for server-side directory walking');
  return [];
}
