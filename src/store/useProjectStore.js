import { create } from 'zustand';
import { saveHandle, loadHandle } from '../services/idbHandleStore';
import {
  initArcwrite, readSettings, writeSettings, ensureDir,
  listBookProjects as fsListBookProjects,
  createBookProject as fsCreateBookProject,
  deleteBookProject as fsDeleteBookProject,
  listAiProjects as fsListAiProjects,
  saveAiProject as fsSaveAiProject,
  deleteAiProject as fsDeleteAiProject,
  readBookChatHistory, writeBookChatHistory,
} from '../services/arcwriteFS';
import useAppStore from './useAppStore';
import useEditorStore from './useEditorStore';

/**
 * Central project system store.
 * Persistence target is the Arcwrite/ folder on disk (via File System Access API).
 * The Arcwrite/ directory handle is persisted in IndexedDB.
 *
 * Permission model (Chrome 122+):
 * - On first setup, user picks a parent folder → Arcwrite/ is created inside it
 * - Only the Arcwrite/ handle is stored in IDB (scoped permissions)
 * - On startup, queryPermission() is called silently (no UI)
 * - If the user chose "Allow on every visit", it returns 'granted' → zero prompts
 * - If not, needsReconnect is set and a button is shown (user gesture required)
 */
/** Save active project selection to localStorage for cross-session restore. */
function saveActiveProject(mode, name) {
  try {
    if (mode && name) {
      localStorage.setItem('arcwright-active-project', JSON.stringify({ mode, name }));
    } else {
      localStorage.removeItem('arcwright-active-project');
    }
  } catch (_) { /* ignore */ }
}

/** Load saved active project selection from localStorage. */
function loadActiveProject() {
  try {
    const raw = localStorage.getItem('arcwright-active-project');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

const useProjectStore = create((set, get) => ({
  // Arcwrite storage folder handle
  arcwriteHandle: null,
  isInitialized: false,
  needsReconnect: false,

  // Settings loaded from disk
  settings: null,

  // Project listings
  bookProjects: [],
  aiProjects: [],
  activeBookProject: null,
  activeAiProject: null,
  activeMode: null, // 'book' | 'ai' | null

  /**
   * Set up Arcwrite storage. Called when user picks a parent folder.
   * Creates "Arcwrite/" inside it, persists only that subfolder handle
   * to IndexedDB. The parent handle is not stored anywhere.
   */
  setRootDirectory: async (handle) => {
    const { arcwriteHandle, settings } = await initArcwrite(handle);
    await saveHandle('rootDir', arcwriteHandle);
    set({ arcwriteHandle, isInitialized: true, needsReconnect: false, settings });

    // Migrate settings from localStorage if this is first setup
    await get().migrateFromLocalStorage();

    // Sync loaded settings to useAppStore
    const current = get().settings;
    if (current) {
      useAppStore.getState().syncFromProjectSettings(current);
    }

    await get().loadProjects();
  },

  /**
   * Try to restore the Arcwrite/ handle from IndexedDB on startup.
   * Uses queryPermission() only — NEVER calls requestPermission() here
   * (no user gesture available in useEffect).
   *
   * If permission was persisted ("Allow on every visit"), returns true silently.
   * If not, sets needsReconnect so the UI can show a reconnect button.
   */
  restoreFromIDB: async () => {
    try {
      const arcwriteHandle = await loadHandle('rootDir');
      if (!arcwriteHandle) return false;

      // Silent check — queryPermission() never shows UI
      const perm = await arcwriteHandle.queryPermission({ mode: 'readwrite' });

      if (perm === 'granted') {
        // Permission persisted (user chose "Allow on every visit")
        await ensureDir(arcwriteHandle, 'projects', 'books');
        await ensureDir(arcwriteHandle, 'projects', 'ai');
        const settings = await readSettings(arcwriteHandle);
        set({ arcwriteHandle, isInitialized: true, needsReconnect: false, settings });

        if (settings) {
          useAppStore.getState().syncFromProjectSettings(settings);
        }

        await get().loadProjects();

        // Restore active project from localStorage
        const saved = loadActiveProject();
        if (saved) {
          try {
            if (saved.mode === 'book') {
              await get().activateBookProject(saved.name);
            } else if (saved.mode === 'ai') {
              const aiProjects = get().aiProjects;
              const project = aiProjects.find((p) => p.name === saved.name);
              if (project) await get().activateAiProject(project);
            }
          } catch (e) {
            console.warn('[ProjectStore] Failed to restore active project:', e.message);
            saveActiveProject(null, null);
          }
        }

        return true;
      }

      // Permission not persisted — store handle for reconnect button
      set({ arcwriteHandle, needsReconnect: true });
      return false;
    } catch (e) {
      console.warn('[ProjectStore] Failed to restore from IDB:', e.message);
      return false;
    }
  },

  /**
   * Re-grant permission to the Arcwrite/ folder.
   * MUST be called from a user gesture (button click) so that
   * requestPermission() can show Chrome's three-way prompt.
   */
  reconnect: async () => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return false;

    try {
      const perm = await arcwriteHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return false;

      await ensureDir(arcwriteHandle, 'projects', 'books');
      await ensureDir(arcwriteHandle, 'projects', 'ai');
      const settings = await readSettings(arcwriteHandle);
      set({ isInitialized: true, needsReconnect: false, settings });

      if (settings) {
        useAppStore.getState().syncFromProjectSettings(settings);
      }

      await get().loadProjects();
      return true;
    } catch (e) {
      console.error('[ProjectStore] Reconnect failed:', e.message);
      return false;
    }
  },

  /**
   * Reload settings from disk.
   */
  loadSettings: async () => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return;
    const settings = await readSettings(arcwriteHandle);
    set({ settings });
    useAppStore.getState().syncFromProjectSettings(settings);
  },

  /**
   * Update settings: merge patch, write to disk, sync to useAppStore.
   */
  updateSettings: async (patch) => {
    const { arcwriteHandle, settings } = get();
    if (!arcwriteHandle || !settings) return;
    const updated = { ...settings, ...patch };
    if (patch.chatSettings) {
      updated.chatSettings = { ...settings.chatSettings, ...patch.chatSettings };
    }
    if (patch.providers) {
      updated.providers = { ...settings.providers };
      for (const [id, provPatch] of Object.entries(patch.providers)) {
        updated.providers[id] = { ...settings.providers[id], ...provPatch };
      }
    }
    await writeSettings(arcwriteHandle, updated);
    set({ settings: updated });
    useAppStore.getState().syncFromProjectSettings(updated);
  },

  /**
   * One-time migration of settings from localStorage to Arcwrite/.
   * Handles both old flat apiKey and new multi-provider state.
   */
  migrateFromLocalStorage: async () => {
    const { arcwriteHandle, settings } = get();
    if (!arcwriteHandle || !settings) return;

    const appState = useAppStore.getState();
    let needsWrite = false;
    const updated = { ...settings };

    // Migrate provider keys from localStorage (Zustand persist) into disk settings
    if (appState.providers) {
      if (!updated.providers) updated.providers = {};
      for (const [id, p] of Object.entries(appState.providers)) {
        if (p.apiKey && (!updated.providers[id]?.apiKey)) {
          if (!updated.providers[id]) updated.providers[id] = {};
          updated.providers[id].apiKey = p.apiKey;
          updated.providers[id].selectedModel = p.selectedModel;
          needsWrite = true;
        }
      }
      if (appState.activeProvider && appState.activeProvider !== 'openrouter') {
        updated.activeProvider = appState.activeProvider;
        needsWrite = true;
      }
    }

    if (appState.chatSettings) {
      const defaults = { temperature: 1, maxTokens: 4096, toolsEnabled: true, reasoningEnabled: false, promptMode: 'full' };
      const appChat = appState.chatSettings;
      const hasCustom = Object.keys(defaults).some((k) => appChat[k] !== undefined && appChat[k] !== defaults[k]);
      if (hasCustom) {
        updated.chatSettings = { ...settings.chatSettings, ...appChat };
        needsWrite = true;
      }
    }

    const editorTheme = useEditorStore.getState().editorTheme;
    if (editorTheme && editorTheme !== 'light') {
      updated.editorTheme = editorTheme;
      needsWrite = true;
    }

    if (needsWrite) {
      await writeSettings(arcwriteHandle, updated);
      set({ settings: updated });
      console.log('[ProjectStore] Migrated settings from localStorage to Arcwrite/');
    }
  },

  // ── Project management ──

  /** Load project listings from disk. */
  loadProjects: async () => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return;
    try {
      const books = await fsListBookProjects(arcwriteHandle);
      const ai = await fsListAiProjects(arcwriteHandle);
      set({
        bookProjects: books.map((b) => ({ name: b.name })),
        aiProjects: ai,
      });
    } catch (e) {
      console.error('[ProjectStore] loadProjects failed:', e);
    }
  },

  /** Activate a book project — loads its folder into the editor file tree. */
  activateBookProject: async (projectName) => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return;

    // Save current chat before switching
    await get().saveCurrentChatHistory();

    const booksDir = await ensureDir(arcwriteHandle, 'projects', 'books');
    const projectHandle = await booksDir.getDirectoryHandle(projectName);

    // Load chat history for this project
    const chatHistory = await readBookChatHistory(arcwriteHandle, projectName);
    const { default: useChatStore } = await import('./useChatStore');
    useChatStore.getState().setMessages(chatHistory);

    // Load file tree into editor
    const { buildFileTree } = await import('../components/edit/FilePanel');
    useEditorStore.getState().setDirectoryHandle(projectHandle);
    const tree = await buildFileTree(projectHandle);
    useEditorStore.getState().setFileTree(tree);

    set({
      activeBookProject: projectName,
      activeAiProject: null,
      activeMode: 'book',
    });
    saveActiveProject('book', projectName);
  },

  /** Activate an AI project — sets the system prompt context. */
  activateAiProject: async (project) => {
    // Save current chat before switching
    await get().saveCurrentChatHistory();

    // Load this project's chat history
    const { default: useChatStore } = await import('./useChatStore');
    useChatStore.getState().setMessages(project.chatHistory || []);

    set({
      activeAiProject: project,
      activeBookProject: null,
      activeMode: 'ai',
    });
    saveActiveProject('ai', project.name);
  },

  /** Deactivate all projects (return to default Full Context). */
  deactivateProject: async () => {
    await get().saveCurrentChatHistory();
    const { default: useChatStore } = await import('./useChatStore');
    useChatStore.getState().clearMessages();
    set({
      activeBookProject: null,
      activeAiProject: null,
      activeMode: null,
    });
    saveActiveProject(null, null);
  },

  /** Save current chat history to the active project's storage. */
  saveCurrentChatHistory: async () => {
    const { arcwriteHandle, activeBookProject, activeAiProject, activeMode } = get();
    if (!arcwriteHandle) return;

    const { default: useChatStore } = await import('./useChatStore');
    const messages = useChatStore.getState().messages;
    if (messages.length === 0) return;

    try {
      if (activeMode === 'book' && activeBookProject) {
        await writeBookChatHistory(arcwriteHandle, activeBookProject, messages);
      } else if (activeMode === 'ai' && activeAiProject) {
        const updated = { ...activeAiProject, chatHistory: messages, updatedAt: Date.now() };
        await fsSaveAiProject(arcwriteHandle, updated);
        set({ activeAiProject: updated });
      }
    } catch (e) {
      console.warn('[ProjectStore] saveCurrentChatHistory failed:', e.message);
    }
  },

  /** Create a new book project folder. */
  createNewBookProject: async (name) => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return;
    await fsCreateBookProject(arcwriteHandle, name);
    await get().loadProjects();
  },

  /** Delete a book project folder. */
  deleteBookProject: async (name) => {
    const { arcwriteHandle, activeBookProject } = get();
    if (!arcwriteHandle) return;
    await fsDeleteBookProject(arcwriteHandle, name);
    if (activeBookProject === name) {
      set({ activeBookProject: null, activeMode: null });
    }
    await get().loadProjects();
  },

  /** Create a new AI project. */
  createAiProject: async (project) => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return null;
    const full = {
      ...project,
      chatHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await fsSaveAiProject(arcwriteHandle, full);
    await get().loadProjects();
    return full;
  },

  /** Update an existing AI project. */
  updateAiProject: async (project) => {
    const { arcwriteHandle, activeAiProject } = get();
    if (!arcwriteHandle) return;
    await fsSaveAiProject(arcwriteHandle, project);
    if (activeAiProject?.name === project.name) {
      set({ activeAiProject: project });
    }
    await get().loadProjects();
  },

  /** Delete an AI project. */
  deleteAiProject: async (name) => {
    const { arcwriteHandle, activeAiProject } = get();
    if (!arcwriteHandle) return;
    await fsDeleteAiProject(arcwriteHandle, name);
    if (activeAiProject?.name === name) {
      set({ activeAiProject: null, activeMode: null });
    }
    await get().loadProjects();
  },
}));

export default useProjectStore;
