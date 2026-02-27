import useEditorStore from '../store/useEditorStore';
import useAppStore from '../store/useAppStore';
import { callCompletionSync } from '../api/providerAdapter';
import { buildFileTree } from '../components/edit/FilePanel';

/**
 * Walk directory path parts to get a subdirectory handle.
 * If create is true, creates intermediate directories as needed.
 */
async function walkToDir(rootHandle, path, create = false) {
  const parts = path.split('/').filter(Boolean);
  let current = rootHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

/**
 * Walk to the parent directory of a file path, return { dirHandle, filename }.
 * Creates intermediate directories if create is true.
 */
async function walkToParent(rootHandle, filePath, create = false) {
  const parts = filePath.split('/').filter(Boolean);
  const filename = parts.pop();
  let dirHandle = rootHandle;
  for (const part of parts) {
    dirHandle = await dirHandle.getDirectoryHandle(part, { create });
  }
  return { dirHandle, filename };
}

function getRootHandle() {
  const handle = useEditorStore.getState().directoryHandle;
  if (!handle) throw new Error('No directory open. Open a folder in the Files panel first.');
  return handle;
}

/**
 * Create the ctx API object that scripts receive as their single argument.
 */
export function createScriptContext(options = {}) {
  const { onLog, onProgress, selectedNode } = options;

  return {
    // ── File I/O ──

    readFile: async (path) => {
      const rootHandle = getRootHandle();
      const { dirHandle, filename } = await walkToParent(rootHandle, path);
      const fileHandle = await dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    },

    writeFile: async (path, content) => {
      const rootHandle = getRootHandle();
      const { dirHandle, filename } = await walkToParent(rootHandle, path, true);
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    },

    readDir: async (path) => {
      const rootHandle = getRootHandle();
      const dirHandle = path ? await walkToDir(rootHandle, path) : rootHandle;
      const entries = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (name.startsWith('.')) continue;
        entries.push({ name, type: handle.kind === 'directory' ? 'dir' : 'file' });
      }
      return entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },

    createFolder: async (path) => {
      const rootHandle = getRootHandle();
      await walkToDir(rootHandle, path, true);
    },

    deleteFile: async (path) => {
      const rootHandle = getRootHandle();
      const { dirHandle, filename } = await walkToParent(rootHandle, path);
      await dirHandle.removeEntry(filename);
    },

    // ── Editor integration ──

    getActiveFileContent: () => {
      const { tabs, activeTabId } = useEditorStore.getState();
      const tab = tabs.find((t) => t.id === activeTabId);
      return tab?.content || '';
    },

    getActiveFilePath: () => {
      return useEditorStore.getState().activeTabId || '';
    },

    setActiveFileContent: (content) => {
      const { activeTabId, updateTabContent } = useEditorStore.getState();
      if (activeTabId) updateTabContent(activeTabId, content);
    },

    // ── Output ──

    log: (msg) => onLog?.(String(msg), 'info'),
    warn: (msg) => onLog?.(String(msg), 'warn'),
    error: (msg) => onLog?.(String(msg), 'error'),
    progress: (current, total) => onProgress?.(current, total),

    // ── UI ──

    prompt: (msg, defaultValue) => window.prompt(msg, defaultValue ?? ''),
    confirm: (msg) => window.confirm(msg),
    askAI: async (prompt, systemPrompt) => {
      const app = useAppStore.getState();
      const provState = app.providers[app.activeProvider] || {};
      if (!provState.apiKey) throw new Error('No API key configured. Set one in Settings.');
      return await callCompletionSync(systemPrompt || '', prompt);
    },

    // ── Context ──

    selectedNode: selectedNode || null,

    // ── Internal ──

    refreshFileTree: async () => {
      const rootHandle = getRootHandle();
      const tree = await buildFileTree(rootHandle);
      useEditorStore.getState().setFileTree(tree);
    },
  };
}
