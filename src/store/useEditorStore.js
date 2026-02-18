import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useEditorStore = create(
  persist(
    (set, get) => ({
      // --- Tab management ---
      tabs: [],            // [{ id, title, content, dirty, fileHandle? }]
      activeTabId: null,
      secondaryTabId: null,

      // --- Dual-pane ---
      dualPane: false,
      syncScroll: false,
      diffMode: false,
      focusedPane: 'primary', // 'primary' | 'secondary'

      // --- File system ---
      directoryHandle: null,
      fileTree: [],        // [{ name, path, handle, type: 'file'|'dir', children?, expanded? }]
      contextPaths: {},    // { [filePath]: true } — files included in AI context
      selectedPaths: {},   // { [filePath]: true } — multi-selection for drag-and-drop
      lastSelectedPath: null, // for shift-click range selection

      // --- Left panel ---
      leftPanelTab: 'chat', // 'chat' | 'files' | 'variables'

      // --- Editor theme ---
      editorTheme: 'light', // 'light' | 'dark' | 'sepia' | 'nord'

      // --- Tab actions ---
      openTab: (id, title, content, fileHandle) => {
        const { tabs, dualPane, focusedPane } = get();
        const targetSecondary = dualPane && focusedPane === 'secondary';
        const existing = tabs.find((t) => t.id === id);
        if (existing) {
          set(targetSecondary ? { secondaryTabId: id } : { activeTabId: id });
          return;
        }
        const newTab = { id, title, content, dirty: false, fileHandle: fileHandle || null };
        set({
          tabs: [...tabs, newTab],
          ...(targetSecondary ? { secondaryTabId: id } : { activeTabId: id }),
        });
      },

      closeTab: (id) => {
        const { tabs, activeTabId, secondaryTabId } = get();
        const tab = tabs.find((t) => t.id === id);
        if (tab?.dirty) {
          if (!window.confirm(`"${tab.title}" has unsaved changes. Close anyway?`)) return;
        }
        const filtered = tabs.filter((t) => t.id !== id);
        const updates = { tabs: filtered };
        if (activeTabId === id) {
          updates.activeTabId = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
        }
        if (secondaryTabId === id) {
          updates.secondaryTabId = null;
        }
        set(updates);
      },

      setActiveTab: (id) => set({ activeTabId: id }),
      setSecondaryTab: (id) => set({ secondaryTabId: id }),

      updateTabContent: (id, content) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, content, dirty: true } : t)),
        }));
      },

      markTabClean: (id) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, dirty: false } : t)),
        }));
      },

      renameTab: (id, newTitle) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: newTitle } : t)),
        }));
      },

      setTabTextColor: (id, color) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, textColor: color || null } : t)),
        }));
      },

      // --- Dual-pane ---
      toggleDualPane: () => {
        const { dualPane, tabs, activeTabId, secondaryTabId } = get();
        if (!dualPane && !secondaryTabId && tabs.length > 1) {
          const other = tabs.find((t) => t.id !== activeTabId);
          set({ dualPane: true, secondaryTabId: other?.id || null });
        } else {
          set({ dualPane: !dualPane });
        }
      },

      toggleSyncScroll: () => set((s) => ({ syncScroll: !s.syncScroll })),
      toggleDiffMode: () => set((s) => ({ diffMode: !s.diffMode })),
      setFocusedPane: (pane) => set({ focusedPane: pane }),

      // --- Left panel ---
      setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),

      // --- Editor theme ---
      setEditorTheme: (theme) => set({ editorTheme: theme }),

      // --- File system ---
      setDirectoryHandle: (handle) => {
        set({ directoryHandle: handle });
        // Persist handle to IDB for cross-session restore
        import('../services/idbHandleStore').then(({ saveHandle, removeHandle }) => {
          if (handle) saveHandle('editorDir', handle);
          else removeHandle('editorDir');
        });
      },
      setFileTree: (tree) => set({ fileTree: tree }),

      toggleContextPath: (path) => set((s) => {
        const next = { ...s.contextPaths };
        if (next[path]) delete next[path];
        else next[path] = true;
        return { contextPaths: next };
      }),

      setContextPaths: (paths, enabled) => set((s) => {
        const next = { ...s.contextPaths };
        paths.forEach((p) => { if (enabled) next[p] = true; else delete next[p]; });
        return { contextPaths: next };
      }),

      toggleTreeNode: (path) => {
        const toggle = (nodes) =>
          nodes.map((n) => {
            if (n.path === path) return { ...n, expanded: !n.expanded };
            if (n.children) return { ...n, children: toggle(n.children) };
            return n;
          });
        set((s) => ({ fileTree: toggle(s.fileTree) }));
      },

      // --- Selection (for drag-and-drop) ---
      selectPath: (path, additive) => {
        if (additive) {
          // Cmd/Ctrl-click: toggle
          set((s) => {
            const next = { ...s.selectedPaths };
            if (next[path]) delete next[path]; else next[path] = true;
            return { selectedPaths: next, lastSelectedPath: path };
          });
        } else {
          set({ selectedPaths: { [path]: true }, lastSelectedPath: path });
        }
      },

      selectRange: (toPath, visiblePaths) => {
        const { lastSelectedPath } = get();
        if (!lastSelectedPath) {
          set({ selectedPaths: { [toPath]: true }, lastSelectedPath: toPath });
          return;
        }
        const fromIdx = visiblePaths.indexOf(lastSelectedPath);
        const toIdx = visiblePaths.indexOf(toPath);
        if (fromIdx === -1 || toIdx === -1) {
          set({ selectedPaths: { [toPath]: true }, lastSelectedPath: toPath });
          return;
        }
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        const next = {};
        for (let i = start; i <= end; i++) next[visiblePaths[i]] = true;
        set({ selectedPaths: next });
      },

      clearSelection: () => set({ selectedPaths: {} }),

      // Update tab id/path when a file is moved
      updateTabPath: (oldPath, newPath, newHandle) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === oldPath
              ? { ...t, id: newPath, title: newPath.split('/').pop(), fileHandle: newHandle }
              : t
          ),
          activeTabId: s.activeTabId === oldPath ? newPath : s.activeTabId,
          secondaryTabId: s.secondaryTabId === oldPath ? newPath : s.secondaryTabId,
        }));
      },

      // --- Save ---
      saveTab: async (id) => {
        const tab = get().tabs.find((t) => t.id === id);
        if (!tab?.fileHandle) return false;
        try {
          const writable = await tab.fileHandle.createWritable();
          await writable.write(tab.content);
          await writable.close();
          get().markTabClean(id);
          return true;
        } catch (e) {
          console.error('Save failed:', e);
          return false;
        }
      },
    }),
    {
      name: 'editor-store',
      partialize: (state) => ({
        editorTheme: state.editorTheme,
        leftPanelTab: state.leftPanelTab,
        contextPaths: state.contextPaths,
        // Persist tab paths (not content/handles — those reload from disk)
        _savedTabs: state.tabs.map((t) => ({ id: t.id, title: t.title })),
        _savedActiveTabId: state.activeTabId,
        _savedSecondaryTabId: state.secondaryTabId,
        dualPane: state.dualPane,
      }),
    }
  )
);

export default useEditorStore;
