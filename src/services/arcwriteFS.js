/**
 * Filesystem abstraction for the .arcwrite/ system folder.
 * All disk I/O for settings and project definitions goes through here.
 */

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
};

/**
 * Migrate settings from v1 (flat apiKey/selectedModel) to v2 (providers map).
 * Returns the settings unchanged if already v2+.
 */
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

/**
 * Walk/create nested directories from a parent handle.
 * Returns the final directory handle.
 */
export async function ensureDir(parentHandle, ...pathParts) {
  let current = parentHandle;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

/**
 * Read and parse a JSON file from a directory handle.
 * Returns null if the file doesn't exist.
 */
export async function readJsonFile(dirHandle, filename) {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (e) {
    if (e.name === 'NotFoundError') return null;
    throw e;
  }
}

/**
 * Write a JSON file to a directory handle.
 */
export async function writeJsonFile(dirHandle, filename, data) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/**
 * Initialize an Arcwrite storage folder inside a parent directory.
 * Creates "Arcwrite/" subfolder (visible, no dot prefix), sets up internal
 * structure, and returns the subfolder handle + settings.
 * Only the returned arcwriteHandle is persisted to IndexedDB — the parent
 * handle is discarded after this call, so future permission prompts scope
 * to "Arcwrite/" only.
 */
export async function initArcwrite(parentHandle) {
  const arcwriteHandle = await parentHandle.getDirectoryHandle('Arcwrite', { create: true });

  await ensureDir(arcwriteHandle, 'projects', 'books');
  await ensureDir(arcwriteHandle, 'projects', 'ai');

  let settings = await readJsonFile(arcwriteHandle, 'settings.json');
  if (!settings) {
    settings = { ...DEFAULT_SETTINGS };
    await writeJsonFile(arcwriteHandle, 'settings.json', settings);
  } else if (settings.version < 2) {
    settings = migrateSettings(settings);
    await writeJsonFile(arcwriteHandle, 'settings.json', settings);
  }

  return { arcwriteHandle, settings };
}

/**
 * Read settings from .arcwrite/settings.json.
 * Applies v1→v2 migration if needed and persists the upgrade.
 */
export async function readSettings(arcwriteHandle) {
  let settings = await readJsonFile(arcwriteHandle, 'settings.json');
  if (!settings) return { ...DEFAULT_SETTINGS };
  if (settings.version < 2) {
    settings = migrateSettings(settings);
    await writeJsonFile(arcwriteHandle, 'settings.json', settings);
  }
  return settings;
}

/**
 * Write settings to .arcwrite/settings.json.
 */
export async function writeSettings(arcwriteHandle, settings) {
  await writeJsonFile(arcwriteHandle, 'settings.json', settings);
}

// ── Project CRUD ──

/**
 * List book project folders in Arcwrite/projects/books/.
 */
export async function listBookProjects(arcwriteHandle) {
  const booksDir = await ensureDir(arcwriteHandle, 'projects', 'books');
  const projects = [];
  for await (const [name, handle] of booksDir.entries()) {
    if (handle.kind === 'directory') {
      projects.push({ name, handle });
    }
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Create a new book project folder.
 */
export async function createBookProject(arcwriteHandle, name) {
  const booksDir = await ensureDir(arcwriteHandle, 'projects', 'books');
  return await booksDir.getDirectoryHandle(name, { create: true });
}

/**
 * Delete a book project folder recursively.
 */
export async function deleteBookProject(arcwriteHandle, name) {
  const booksDir = await ensureDir(arcwriteHandle, 'projects', 'books');
  await booksDir.removeEntry(name, { recursive: true });
}

/**
 * List AI project JSON files in Arcwrite/projects/ai/.
 */
export async function listAiProjects(arcwriteHandle) {
  const aiDir = await ensureDir(arcwriteHandle, 'projects', 'ai');
  const projects = [];
  for await (const [name, handle] of aiDir.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) {
      try {
        const file = await handle.getFile();
        const text = await file.text();
        projects.push(JSON.parse(text));
      } catch (e) {
        console.warn(`[arcwriteFS] Failed to parse AI project ${name}:`, e.message);
      }
    }
  }
  return projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Save an AI project JSON file.
 */
export async function saveAiProject(arcwriteHandle, project) {
  const aiDir = await ensureDir(arcwriteHandle, 'projects', 'ai');
  const filename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  await writeJsonFile(aiDir, filename, { ...project, updatedAt: Date.now() });
}

/**
 * Delete an AI project JSON file.
 */
export async function deleteAiProject(arcwriteHandle, projectName) {
  const aiDir = await ensureDir(arcwriteHandle, 'projects', 'ai');
  const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  await aiDir.removeEntry(filename);
}

/**
 * Read a file by relative path from the Arcwrite root.
 */
export async function readFileByPath(arcwriteHandle, relativePath) {
  const parts = relativePath.split('/').filter(Boolean);
  const filename = parts.pop();
  if (!filename) throw new Error('Invalid file path');
  let dirHandle = arcwriteHandle;
  for (const part of parts) {
    dirHandle = await dirHandle.getDirectoryHandle(part);
  }
  const fileHandle = await dirHandle.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Read chat history from a book project folder.
 */
export async function readBookChatHistory(arcwriteHandle, bookName) {
  const bookDir = await ensureDir(arcwriteHandle, 'projects', 'books', bookName);
  return (await readJsonFile(bookDir, '.chat.json')) || [];
}

/**
 * Save chat history to a book project folder.
 */
export async function writeBookChatHistory(arcwriteHandle, bookName, messages) {
  const bookDir = await ensureDir(arcwriteHandle, 'projects', 'books', bookName);
  await writeJsonFile(bookDir, '.chat.json', messages);
}
