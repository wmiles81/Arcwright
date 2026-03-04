import { create } from 'zustand';
import {
  readSettings, writeSettings,
  listBookProjects as fsListBookProjects,
  createBookProject as fsCreateBookProject,
  deleteBookProject as fsDeleteBookProject,
  listAiProjects as fsListAiProjects,
  saveAiProject as fsSaveAiProject,
  deleteAiProject as fsDeleteAiProject,
  readBookChatHistory, writeBookChatHistory,
  readAiChatHistory, writeAiChatHistory, archiveAiChatHistory,
  provisionArtifacts, walkArtifactsTree, readArtifactFile as fsReadArtifactFile,
  listExtensionPacks,
} from '../services/arcwriteFS';
import { apiGet } from '../services/api';
import useAppStore from './useAppStore';
import useEditorStore from './useEditorStore';
import useBookStore from './useBookStore';

/**
 * Central project system store.
 * Persistence target is the Arcwrite/ folder on disk via the local API server.
 * The API server manages all filesystem access — no browser permissions needed.
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
  // Server-backed mode: arcwriteHandle is a sentinel (non-null) so existing
  // null-checks in the store continue to work. The actual value is unused.
  arcwriteHandle: null,
  isInitialized: false,
  needsReconnect: false,  // kept for UI compat — always false in server mode

  // Settings loaded from disk
  settings: null,

  // Project listings
  bookProjects: [],
  aiProjects: [],
  activeBookProject: null,
  activeAiProject: null,
  activeMode: null, // 'book' | 'ai' | null
  bookDirHandle: null,   // FileSystemDirectoryHandle for the active book project folder
  bookFileTree: [],       // file tree for the active book project (independent of editor)

  // Skill folder directory handles (restored from IDB on project activation)
  skillFolderHandles: {}, // { idbKey: FileSystemDirectoryHandle }

  // _Artifacts tree
  artifactsTree: [],

  // Data packs (loaded from Arcwrite/extensions/)
  dataPacks: [],
  dataPacksLoaded: false,

  /**
   * Set up Arcwrite storage.
   * In server-backed mode, the server manages the data directory.
   * The handle parameter is accepted for backward compatibility.
   */
  setRootDirectory: async (_handle, _opts) => {
    const settings = await readSettings();
    set({ arcwriteHandle: 'server', isInitialized: true, needsReconnect: false, settings });

    // Migrate settings from localStorage if this is first setup
    await get().migrateFromLocalStorage();

    // Sync loaded settings to useAppStore
    const current = get().settings;
    if (current) {
      useAppStore.getState().syncFromProjectSettings(current);
    }

    await get().loadProjects();
    await get().loadArtifacts();
  },

  /**
   * Initialize from the API server on startup.
   * No IDB handles or browser permissions needed — the server manages the
   * data directory. Returns true on success.
   */
  restoreFromIDB: async () => {
    try {
      // Check that the API server is reachable
      await apiGet('/health');

      const settings = await readSettings();
      set({ arcwriteHandle: 'server', isInitialized: true, needsReconnect: false, settings });

      if (settings) {
        useAppStore.getState().syncFromProjectSettings(settings);
      }

      await get().loadProjects();
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
    } catch (e) {
      console.warn('[ProjectStore] Server not reachable:', e.message);
      set({ needsReconnect: true });
      return false;
    }
  },

  /**
   * Reconnect — in server-backed mode, just retry the server health check.
   */
  reconnect: async () => {
    try {
      await apiGet('/health');
      return await get().restoreFromIDB();
    } catch (e) {
      console.error('[ProjectStore] Reconnect failed — API server unreachable:', e.message);
      return false;
    }
  },

  /**
   * Reload settings from server.
   */
  loadSettings: async () => {
    const settings = await readSettings();
    set({ settings });
    useAppStore.getState().syncFromProjectSettings(settings);
  },

  /**
   * Update settings: merge patch, write to disk, sync to useAppStore.
   */
  updateSettings: async (patch) => {
    const { settings } = get();
    if (!settings) return;
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
    await writeSettings(null, updated);
    set({ settings: updated });
    useAppStore.getState().syncFromProjectSettings(updated);
  },

  /**
   * One-time migration of settings from localStorage to Arcwrite/.
   * Handles both old flat apiKey and new multi-provider state.
   */
  migrateFromLocalStorage: async () => {
    const { settings } = get();
    if (!settings) return;

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
      await writeSettings(null, updated);
      set({ settings: updated });
      console.log('[ProjectStore] Migrated settings from localStorage to Arcwrite/');
    }
  },

  // ── Project management ──

  /** Load project listings from disk. */
  loadProjects: async () => {
    try {
      const books = await fsListBookProjects();
      const ai = await fsListAiProjects();
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
    // Save current chat before switching
    await get().saveCurrentChatHistory();


    // Load chat history for this project
    const chatHistory = await readBookChatHistory(null, projectName);
    const { default: useChatStore } = await import('./useChatStore');
    useChatStore.getState().setMessages(chatHistory);

    // Build book project file tree from server API
    let bookTree = [];
    try {
      const rawTree = await apiGet(`/projects/books/${encodeURIComponent(projectName)}/tree`);
      const { expandedPaths } = useEditorStore.getState();
      const applyExpanded = (nodes) => nodes.map((n) => ({
        ...n,
        expanded: !!expandedPaths[n.path],
        ...(n.children ? { children: applyExpanded(n.children) } : {}),
      }));
      bookTree = applyExpanded(rawTree);
    } catch (e) {
      console.warn('[ProjectStore] Failed to load book file tree:', e.message);
    }

    // Load book entity data from SQLite
    try {
      await useBookStore.getState().loadBookByTitle(projectName);
    } catch (err) {
      console.warn('[ProjectStore] Failed to load book data:', err.message);
    }

    set({
      activeBookProject: projectName,
      activeAiProject: null,
      activeMode: 'book',
      bookDirHandle: null,  // no longer a real handle in server mode
      bookFileTree: bookTree,
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
    let chatHistory = [];
    try {
      chatHistory = await readAiChatHistory(null, project.name);
      // Migration: if dedicated file is empty but project JSON has embedded history, migrate it
      if (chatHistory.length === 0 && project.chatHistory?.length > 0) {
        chatHistory = project.chatHistory;
        await writeAiChatHistory(null, project.name, chatHistory);
        const cleaned = { ...project };
        delete cleaned.chatHistory;
        await fsSaveAiProject(null, { ...cleaned, updatedAt: Date.now() });
      }
    } catch (e) {
      console.warn('[ProjectStore] Could not load AI chat history:', e.message);
      chatHistory = project.chatHistory || [];
    }
    useChatStore.getState().setMessages(chatHistory);

    // Strip cachedContent from reference-mode files
    let activeProject = project;
    if (project.files?.some((f) => f.includeMode === 'reference' && f.cachedContent)) {
      activeProject = {
        ...project,
        files: project.files.map((f) =>
          f.includeMode === 'reference' ? { ...f, cachedContent: null } : f
        ),
      };
      fsSaveAiProject(null, { ...activeProject, updatedAt: Date.now() }).catch(() => { });
    }

    set({
      activeAiProject: activeProject,
      activeBookProject: null,
      activeMode: 'ai',
      bookDirHandle: null,
      bookFileTree: [],
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
    useBookStore.getState().clearBook();
    set({
      activeBookProject: null,
      activeAiProject: null,
      activeMode: null,
      bookDirHandle: null,
      bookFileTree: [],
    });
    saveActiveProject(null, null);
  },

  /** Clear chat history on disk. For AI projects, archives the current chat before clearing. */
  clearProjectHistory: async () => {
    const { activeBookProject, activeAiProject, activeMode } = get();
    try {
      if (activeMode === 'book' && activeBookProject) {
        await writeBookChatHistory(null, activeBookProject, []);
      } else if (activeMode === 'ai' && activeAiProject) {
        await archiveAiChatHistory(null, activeAiProject.name);
      }
    } catch (e) {
      console.warn('[ProjectStore] clearProjectHistory failed:', e.message);
    }
  },

  /** Save current chat history to the active project's storage. */
  saveCurrentChatHistory: async () => {
    const { activeBookProject, activeAiProject, activeMode } = get();

    const { default: useChatStore } = await import('./useChatStore');
    const messages = useChatStore.getState().messages;
    if (messages.length === 0) return;

    try {
      if (activeMode === 'book' && activeBookProject) {
        await writeBookChatHistory(null, activeBookProject, messages);
      } else if (activeMode === 'ai' && activeAiProject) {
        await writeAiChatHistory(null, activeAiProject.name, messages);
      }
    } catch (e) {
      console.warn('[ProjectStore] saveCurrentChatHistory failed:', e.message);
    }
  },

  /** Create a new book project folder. */
  createNewBookProject: async (name) => {
    await fsCreateBookProject(null, name);

    // Create a book record in SQLite
    try {
      const { insertBook, getBookByTitle } = await import('../services/database');
      const existing = getBookByTitle(name);
      if (!existing) {
        insertBook({ title: name });
      }
    } catch (err) {
      console.warn('[ProjectStore] Failed to create book record:', err.message);
    }

    await get().loadProjects();
  },

  /** Delete a book project folder. */
  deleteBookProject: async (name) => {
    const { activeBookProject } = get();
    await fsDeleteBookProject(null, name);
    if (activeBookProject === name) {
      set({ activeBookProject: null, activeMode: null, bookDirHandle: null, bookFileTree: [] });
    }
    await get().loadProjects();
  },

  /** Refresh the book project file tree (call after file ops that change the book folder). */
  refreshBookFileTree: async () => {
    const { bookDirHandle } = get();
    if (!bookDirHandle) return;
    const { buildFileTree } = await import('../components/edit/FilePanel');
    const rawTree = await buildFileTree(bookDirHandle);
    const { expandedPaths } = useEditorStore.getState();
    const applyExpanded = (nodes) => nodes.map((n) => ({
      ...n,
      expanded: !!expandedPaths[n.path],
      ...(n.children ? { children: applyExpanded(n.children) } : {}),
    }));
    set({ bookFileTree: applyExpanded(rawTree) });
  },

  /** Create a new AI project. */
  createAiProject: async (project) => {
    const full = {
      ...project,
      chatHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await fsSaveAiProject(null, full);
    await get().loadProjects();
    return full;
  },

  /** Update an existing AI project. */
  updateAiProject: async (project) => {
    const { activeAiProject } = get();
    await fsSaveAiProject(null, project);
    if (activeAiProject?.name === project.name) {
      set({ activeAiProject: project });
    }
    await get().loadProjects();
  },

  /** Load the _Artifacts/ directory tree. */
  loadArtifacts: async () => {
    try {
      const tree = await walkArtifactsTree();
      set({ artifactsTree: tree });
    } catch (e) {
      console.warn('[ProjectStore] loadArtifacts failed:', e.message);
    }
  },

  /** Read a file from _Artifacts/ by path (e.g. 'semantic_physics_engine/README.md'). */
  readArtifactFile: async (path) => {
    return await fsReadArtifactFile(null, path);
  },

  /** Load extension packs from Arcwrite/extensions/. */
  loadDataPacks: async () => {
    try {
      const packList = await listExtensionPacks();
      const loaded = [];
      for (const pack of packList) {
        // Load pack content from server
        try {
          const content = await apiGet(`/extensions/${encodeURIComponent(pack.id)}/content`);
          loaded.push({
            id: pack.id, name: pack.name, version: pack.version,
            description: pack.description, author: pack.author,
            enabled: true, content,
          });
        } catch (e) {
          console.warn(`[ProjectStore] Failed to load pack ${pack.id}:`, e.message);
        }
      }
      set({ dataPacks: loaded, dataPacksLoaded: true });
    } catch (e) {
      console.warn('[ProjectStore] loadDataPacks failed:', e.message);
      set({ dataPacksLoaded: true });
    }
  },

  /** Delete an AI project. */
  deleteAiProject: async (name) => {
    const { activeAiProject, aiProjects } = get();

    // Clean up skill folder handles from IDB (legacy cleanup)
    const project = aiProjects.find((p) => p.name === name);
    if (project?.files) {
      for (const f of project.files) {
        if (f.type === 'folder' && f.idbKey) {
          try { await removeHandle(f.idbKey); } catch (_) { /* ignore */ }
        }
      }
    }

    await fsDeleteAiProject(null, name);
    if (activeAiProject?.name === name) {
      set({ activeAiProject: null, activeMode: null, skillFolderHandles: {} });
    }
    await get().loadProjects();
  },
}));

export default useProjectStore;
