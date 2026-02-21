import { create } from 'zustand';
import { saveHandle, loadHandle, removeHandle } from '../services/idbHandleStore';
import {
  initArcwrite, readSettings, writeSettings, ensureDir,
  listBookProjects as fsListBookProjects,
  createBookProject as fsCreateBookProject,
  deleteBookProject as fsDeleteBookProject,
  listAiProjects as fsListAiProjects,
  saveAiProject as fsSaveAiProject,
  deleteAiProject as fsDeleteAiProject,
  readBookChatHistory, writeBookChatHistory,
  readAiChatHistory, writeAiChatHistory,
  provisionArtifacts, walkArtifactsTree, readArtifactFile as fsReadArtifactFile,
  listExtensionPacks, loadPackContent,
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

  // Skill folder directory handles (restored from IDB on project activation)
  skillFolderHandles: {}, // { idbKey: FileSystemDirectoryHandle }

  // _Artifacts tree
  artifactsTree: [],

  // Data packs (loaded from Arcwrite/extensions/)
  dataPacks: [],
  dataPacksLoaded: false,

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
    await provisionArtifacts(arcwriteHandle);
    await get().loadArtifacts();
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
        await provisionArtifacts(arcwriteHandle);
        await get().loadArtifacts();

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

    // Load this project's chat history from dedicated file.
    // Falls back to legacy embedded chatHistory and migrates it on first access.
    const { default: useChatStore } = await import('./useChatStore');
    const { arcwriteHandle } = get();
    let chatHistory = [];
    if (arcwriteHandle) {
      try {
        chatHistory = await readAiChatHistory(arcwriteHandle, project.name);
        // Migration: if dedicated file is empty but project JSON has embedded history, migrate it
        if (chatHistory.length === 0 && project.chatHistory?.length > 0) {
          chatHistory = project.chatHistory;
          await writeAiChatHistory(arcwriteHandle, project.name, chatHistory);
          // Strip from project JSON to keep it lean
          const cleaned = { ...project };
          delete cleaned.chatHistory;
          await fsSaveAiProject(arcwriteHandle, { ...cleaned, updatedAt: Date.now() });
        }
      } catch (e) {
        console.warn('[ProjectStore] Could not load AI chat history:', e.message);
        chatHistory = project.chatHistory || [];
      }
    } else {
      chatHistory = project.chatHistory || [];
    }
    useChatStore.getState().setMessages(chatHistory);

    set({
      activeAiProject: project,
      activeBookProject: null,
      activeMode: 'ai',
      skillFolderHandles: {},
    });
    saveActiveProject('ai', project.name);

    // Restore skill folder handles from IDB
    if (project.files) {
      const handles = {};
      for (const f of project.files) {
        if (f.type === 'folder' && f.idbKey) {
          try {
            const handle = await loadHandle(f.idbKey);
            if (!handle) continue;
            const perm = await handle.queryPermission({ mode: 'read' });
            if (perm === 'granted') {
              handles[f.idbKey] = handle;
            }
          } catch (e) {
            console.warn('[ProjectStore] Failed to restore skill folder handle:', f.idbKey, e.message);
          }
        }
      }
      if (Object.keys(handles).length > 0) {
        set({ skillFolderHandles: handles });
      }
    }
  },

  /** Re-grant permission for a skill folder (requires user gesture). */
  reconnectSkillFolder: async (idbKey) => {
    try {
      const handle = await loadHandle(idbKey);
      if (!handle) return false;
      const perm = await handle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') return false;
      set((s) => ({ skillFolderHandles: { ...s.skillFolderHandles, [idbKey]: handle } }));
      return true;
    } catch (e) {
      console.warn('[ProjectStore] reconnectSkillFolder failed:', e.message);
      return false;
    }
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

  /** Clear chat history on disk for the active project (writes [] explicitly). */
  clearProjectHistory: async () => {
    const { arcwriteHandle, activeBookProject, activeAiProject, activeMode } = get();
    if (!arcwriteHandle) return;
    try {
      if (activeMode === 'book' && activeBookProject) {
        await writeBookChatHistory(arcwriteHandle, activeBookProject, []);
      } else if (activeMode === 'ai' && activeAiProject) {
        await writeAiChatHistory(arcwriteHandle, activeAiProject.name, []);
      }
    } catch (e) {
      console.warn('[ProjectStore] clearProjectHistory failed:', e.message);
    }
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
        // Store history in a dedicated file — never embed in the project JSON
        await writeAiChatHistory(arcwriteHandle, activeAiProject.name, messages);
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

  /** Load the _Artifacts/ directory tree. */
  loadArtifacts: async () => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return;
    try {
      const tree = await walkArtifactsTree(arcwriteHandle);
      set({ artifactsTree: tree });
    } catch (e) {
      console.warn('[ProjectStore] loadArtifacts failed:', e.message);
    }
  },

  /** Read a file from _Artifacts/ by path (e.g. 'semantic_physics_engine/README.md'). */
  readArtifactFile: async (path) => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return null;
    return await fsReadArtifactFile(arcwriteHandle, path);
  },

  /** Load extension packs from Arcwrite/extensions/. */
  loadDataPacks: async () => {
    const { arcwriteHandle } = get();
    if (!arcwriteHandle) return;
    try {
      const packList = await listExtensionPacks(arcwriteHandle);
      const loaded = [];
      for (const pack of packList) {
        const content = await loadPackContent(pack.dirHandle, pack.includes || {});
        loaded.push({
          id: pack.id, name: pack.name, version: pack.version,
          description: pack.description, author: pack.author,
          enabled: true, content,
        });
      }
      set({ dataPacks: loaded, dataPacksLoaded: true });
    } catch (e) {
      console.warn('[ProjectStore] loadDataPacks failed:', e.message);
      set({ dataPacksLoaded: true });
    }
  },

  /** Delete an AI project. */
  deleteAiProject: async (name) => {
    const { arcwriteHandle, activeAiProject, aiProjects } = get();
    if (!arcwriteHandle) return;

    // Clean up skill folder handles from IDB
    const project = aiProjects.find((p) => p.name === name);
    if (project?.files) {
      for (const f of project.files) {
        if (f.type === 'folder' && f.idbKey) {
          try { await removeHandle(f.idbKey); } catch (_) { /* ignore */ }
        }
      }
    }

    await fsDeleteAiProject(arcwriteHandle, name);
    if (activeAiProject?.name === name) {
      set({ activeAiProject: null, activeMode: null, skillFolderHandles: {} });
    }
    await get().loadProjects();
  },
}));

export default useProjectStore;
