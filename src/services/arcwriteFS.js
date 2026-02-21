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
  imageSettings: {
    provider: '',
    model: '',
    defaultSize: '1024x1024',
  },
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

/**
 * Read chat history for an AI project from a dedicated file.
 * Stored at Arcwrite/projects/ai/.chats/{name}.json — separate from the project
 * definition JSON so large conversations don't bloat the project file.
 * Returns [] if not found.
 */
export async function readAiChatHistory(arcwriteHandle, projectName) {
  const chatsDir = await ensureDir(arcwriteHandle, 'projects', 'ai', '.chats');
  const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  return (await readJsonFile(chatsDir, filename)) || [];
}

/**
 * Save chat history for an AI project to a dedicated file.
 * Stored at Arcwrite/projects/ai/.chats/{name}.json.
 */
export async function writeAiChatHistory(arcwriteHandle, projectName, messages) {
  const chatsDir = await ensureDir(arcwriteHandle, 'projects', 'ai', '.chats');
  const filename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  await writeJsonFile(chatsDir, filename, messages);
}

// ── Custom Prompts CRUD ──

/**
 * List custom prompt JSON files in Arcwrite/prompts/.
 */
export async function listCustomPrompts(arcwriteHandle) {
  const promptsDir = await ensureDir(arcwriteHandle, 'prompts');
  const prompts = [];
  for await (const [name, handle] of promptsDir.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) {
      try {
        const file = await handle.getFile();
        const text = await file.text();
        prompts.push(JSON.parse(text));
      } catch (e) {
        console.warn(`[arcwriteFS] Failed to parse prompt ${name}:`, e.message);
      }
    }
  }
  return prompts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

/**
 * Save a custom prompt JSON file.
 */
export async function saveCustomPrompt(arcwriteHandle, prompt) {
  const promptsDir = await ensureDir(arcwriteHandle, 'prompts');
  const filename = `${prompt.id}.json`;
  await writeJsonFile(promptsDir, filename, { ...prompt, updatedAt: Date.now() });
}

/**
 * Delete a custom prompt JSON file.
 */
export async function deleteCustomPrompt(arcwriteHandle, promptId) {
  const promptsDir = await ensureDir(arcwriteHandle, 'prompts');
  const filename = `${promptId}.json`;
  await promptsDir.removeEntry(filename);
}

// ── Custom Sequences CRUD ──

/**
 * List custom sequence JSON files in Arcwrite/sequences/.
 */
export async function listCustomSequences(arcwriteHandle) {
  const sequencesDir = await ensureDir(arcwriteHandle, 'sequences');
  const sequences = [];
  for await (const [name, handle] of sequencesDir.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) {
      try {
        const file = await handle.getFile();
        const text = await file.text();
        sequences.push(JSON.parse(text));
      } catch (e) {
        console.warn(`[arcwriteFS] Failed to parse sequence ${name}:`, e.message);
      }
    }
  }
  return sequences.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Save a custom sequence JSON file.
 */
export async function saveCustomSequence(arcwriteHandle, sequence) {
  const sequencesDir = await ensureDir(arcwriteHandle, 'sequences');
  const filename = `${sequence.id}.json`;
  await writeJsonFile(sequencesDir, filename, { ...sequence, updatedAt: Date.now() });
}

/**
 * Delete a custom sequence JSON file.
 */
export async function deleteCustomSequence(arcwriteHandle, sequenceId) {
  const sequencesDir = await ensureDir(arcwriteHandle, 'sequences');
  const filename = `${sequenceId}.json`;
  await sequencesDir.removeEntry(filename);
}

// ── Extension Packs ──

/**
 * Scan Arcwrite/extensions/ for subdirectories containing pack.json manifests.
 * Returns an array of pack descriptors (manifest + dirHandle).
 */
export async function listExtensionPacks(arcwriteHandle) {
  let extDir;
  try {
    extDir = await arcwriteHandle.getDirectoryHandle('extensions');
  } catch (e) {
    if (e.name === 'NotFoundError') return [];
    throw e;
  }
  const packs = [];
  for await (const [name, handle] of extDir.entries()) {
    if (handle.kind !== 'directory') continue;
    try {
      const manifestHandle = await handle.getFileHandle('pack.json');
      const file = await manifestHandle.getFile();
      const manifest = JSON.parse(await file.text());
      packs.push({ ...manifest, id: manifest.id || name, dirHandle: handle });
    } catch (_) { /* skip dirs without valid pack.json */ }
  }
  return packs;
}

/**
 * Load all content declared in a pack's includes.
 * Returns { genres, dimensionRanges, structures, prompts, sequences }.
 */
export async function loadPackContent(packDirHandle, includes) {
  const result = { genres: null, dimensionRanges: null, structures: null, prompts: [], sequences: [] };

  if (includes.genres) {
    try {
      const fh = await packDirHandle.getFileHandle(includes.genres);
      const data = JSON.parse(await (await fh.getFile()).text());
      if (data._dimensionRanges) {
        result.dimensionRanges = data._dimensionRanges;
        delete data._dimensionRanges;
      }
      result.genres = data;
    } catch (_) {}
  }

  if (includes.structures) {
    try {
      const fh = await packDirHandle.getFileHandle(includes.structures);
      result.structures = JSON.parse(await (await fh.getFile()).text());
    } catch (_) {}
  }

  for (const [type, dirName] of [['prompts', includes.prompts], ['sequences', includes.sequences]]) {
    if (!dirName) continue;
    try {
      const dir = await packDirHandle.getDirectoryHandle(dirName.replace(/\/$/, ''));
      for await (const [fname, fhandle] of dir.entries()) {
        if (fhandle.kind === 'file' && fname.endsWith('.json')) {
          try {
            const parsed = JSON.parse(await (await fhandle.getFile()).text());
            result[type].push(parsed);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return result;
}

// ── Artifact Utilities ──

/**
 * Read the artifact manifest from a book project directory handle.
 * Returns { files: [...] } or null if no artifacts/ folder or manifest exists.
 */
export async function readArtifactManifest(bookProjectHandle) {
  try {
    const artifactsDir = await bookProjectHandle.getDirectoryHandle('artifacts');
    return await readJsonFile(artifactsDir, 'manifest.json');
  } catch (e) {
    if (e.name === 'NotFoundError') return null;
    throw e;
  }
}

/**
 * Write/update the artifact manifest inside a book project.
 * Creates artifacts/ if it doesn't exist.
 */
export async function writeArtifactManifest(bookProjectHandle, manifest) {
  const artifactsDir = await bookProjectHandle.getDirectoryHandle('artifacts', { create: true });
  await writeJsonFile(artifactsDir, 'manifest.json', manifest);
}

// ── Artifacts Utilities ──

const SPE_FILES = [
  'README.md',
  'cliche_collider.yaml',
  'sensory_lenses.yaml',
  'entropy_profiles.yaml',
  'character_entropy_budgets.yaml',
  'npe_to_spe_mappings.yaml',
  'line_editing_protocol.yaml',
  'name_collider.yaml',
  'place_collider.yaml',
  'female_voice_mechanics.md',
  'male_voice_mechanics.md',
];

/**
 * Provision bundled artifact libraries into Arcwrite/_Artifacts/.
 * Currently provisions: semantic_physics_engine (11 YAML/MD files).
 * Idempotent — skips if already present.
 */
export async function provisionArtifacts(arcwriteHandle) {
  try {
    const artifactsDir = await ensureDir(arcwriteHandle, '_Artifacts');
    const speDir = await ensureDir(artifactsDir, 'semantic_physics_engine');

    // Skip if already provisioned (README exists)
    try {
      await speDir.getFileHandle('README.md');
      return; // already done
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
    }

    for (const filename of SPE_FILES) {
      try {
        const res = await fetch(`/artifacts/spe/${filename}`);
        if (!res.ok) continue;
        const content = await res.text();
        const fh = await speDir.getFileHandle(filename, { create: true });
        const writable = await fh.createWritable();
        await writable.write(content);
        await writable.close();
      } catch (e) {
        console.warn(`[arcwriteFS] provisionArtifacts: failed to write ${filename}:`, e.message);
      }
    }
    console.log('[arcwriteFS] Artifacts provisioned.');
  } catch (e) {
    console.warn('[arcwriteFS] provisionArtifacts failed:', e.message);
  }
}

/**
 * Walk the _Artifacts/ directory tree.
 * Returns the same format as walkDirectoryTree.
 */
export async function walkArtifactsTree(arcwriteHandle) {
  try {
    const artifactsDir = await arcwriteHandle.getDirectoryHandle('_Artifacts');
    return await walkDirectoryTree(artifactsDir);
  } catch (e) {
    if (e.name === 'NotFoundError') return [];
    throw e;
  }
}

/**
 * Read a file from _Artifacts/ by its path (e.g. 'semantic_physics_engine/README.md').
 */
export async function readArtifactFile(arcwriteHandle, relativePath) {
  const parts = relativePath.split('/').filter(Boolean);
  const filename = parts.pop();
  let dir = await arcwriteHandle.getDirectoryHandle('_Artifacts');
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  const fh = await dir.getFileHandle(filename);
  const file = await fh.getFile();
  return await file.text();
}

// ── Skill Folder Utilities ──

/**
 * Recursively walk a directory and return a serializable file tree.
 * Each entry: { name, path, type: 'file'|'dir', children? }.
 * Skips dotfiles. Sorts dirs-first, then alphabetically.
 */
export async function walkDirectoryTree(dirHandle, parentPath = '') {
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    const path = parentPath ? `${parentPath}/${name}` : name;
    if (handle.kind === 'directory') {
      const children = await walkDirectoryTree(handle, path);
      entries.push({ name, path, type: 'dir', children });
    } else {
      entries.push({ name, path, type: 'file' });
    }
  }
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
