import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import WorkflowSelector from './components/layout/WorkflowSelector';
import useAppStore from './store/useAppStore';
import useEditorStore from './store/useEditorStore';
import useProjectStore from './store/useProjectStore';
import useChatStore from './store/useChatStore';
import usePromptStore from './store/usePromptStore';
import useSequenceStore from './store/useSequenceStore';
import { PROVIDERS, PROVIDER_ORDER } from './api/providers';
import { fetchModels } from './api/providerAdapter';
import { loadHandle } from './services/idbHandleStore';
import { genreSystem, genreDimensionRanges } from './data/genreSystem';
import { plotStructures, allStructures } from './data/plotStructures';

// ── Trial expiration ─────────────────────────────────────────────────────────
// Set at build time. After this date the app shows an expiration screen.
const TRIAL_EXPIRES = new Date('2026-04-20T00:00:00Z').getTime(); // 2 months from today

const ScaffoldingWorkflow = lazy(() => import('./components/scaffolding/ScaffoldingWorkflow'));
const AnalysisWorkflow = lazy(() => import('./components/analysis/AnalysisWorkflow'));
const EditWorkflow = lazy(() => import('./components/edit/EditWorkflow'));
const HelpPage = lazy(() => import('./components/layout/HelpPage'));

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-purple-300 text-lg">Loading...</div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto mt-16 bg-red-900/40 border border-red-500 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-300 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-200 mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold"
          >
            Return Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function applyDataPacks() {
  const packs = useProjectStore.getState().dataPacks;
  for (const pack of packs) {
    if (!pack.enabled) continue;
    const c = pack.content;
    if (c.genres) Object.assign(genreSystem, c.genres);
    if (c.dimensionRanges) Object.assign(genreDimensionRanges, c.dimensionRanges);
    if (c.structures) {
      Object.assign(plotStructures, c.structures);
      Object.assign(allStructures, c.structures);
    }
    if (c.prompts?.length) {
      const tagged = c.prompts.map((p) => ({ ...p, _packId: pack.id }));
      usePromptStore.getState().addPackPrompts(tagged);
    }
    if (c.sequences?.length) {
      const tagged = c.sequences.map((s) => ({ ...s, _packId: pack.id }));
      useSequenceStore.getState().addPackSequences(tagged);
    }
  }
}

function TrialExpired() {
  const expDate = new Date(TRIAL_EXPIRES).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-purple-900 text-white p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="text-5xl mb-2">&#128220;</div>
        <h1 className="text-2xl font-bold">Build Expired</h1>
        <p className="text-purple-200 text-sm leading-relaxed">
          This build of Arcwright expired on <span className="font-semibold text-white">{expDate}</span>.
          Please obtain a newer version to continue.
        </p>
        <p className="text-purple-300/60 text-xs">
          Expired builds are retired to prevent use of outdated models and features.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  // Trial expiration check
  if (Date.now() > TRIAL_EXPIRES) return <TrialExpired />;

  // Restore .arcwrite/ system folder from IndexedDB on startup
  useEffect(() => {
    useProjectStore.getState().restoreFromIDB().then(async (restored) => {
      if (restored) {
        console.log('[App] Restored .arcwrite/ from IndexedDB');
        // Load custom prompts and sequences after project store is initialized
        usePromptStore.getState().loadPrompts();
        useSequenceStore.getState().loadSequences();

        // Load and apply extension data packs
        await useProjectStore.getState().loadDataPacks();
        applyDataPacks();
      }
    });
  }, []);

  // Restore editor directory handle + open tabs from IndexedDB
  useEffect(() => {
    (async () => {
      try {
        const handle = await loadHandle('editorDir');
        if (!handle) return;

        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') return;

        const editor = useEditorStore.getState();
        editor.setDirectoryHandle(handle);

        // Rebuild file tree
        const { buildFileTree } = await import('./components/edit/FilePanel');
        const tree = await buildFileTree(handle);
        editor.setFileTree(tree);

        // Restore open tabs from persisted paths
        const savedTabs = editor._savedTabs;
        const savedActive = editor._savedActiveTabId;
        const savedSecondary = editor._savedSecondaryTabId;
        if (savedTabs && savedTabs.length > 0) {
          const findHandle = (nodes, targetPath) => {
            for (const node of nodes) {
              if (node.path === targetPath) return node.handle;
              if (node.children) {
                const found = findHandle(node.children, targetPath);
                if (found) return found;
              }
            }
            return null;
          };

          for (const tab of savedTabs) {
            const fileHandle = findHandle(tree, tab.id);
            if (fileHandle) {
              try {
                const file = await fileHandle.getFile();
                const content = await file.text();
                editor.openTab(tab.id, tab.title, content, fileHandle);
              } catch (_) { /* file may have been deleted */ }
            }
          }

          // Restore active/secondary tab selection
          const currentTabs = useEditorStore.getState().tabs;
          if (savedActive && currentTabs.some((t) => t.id === savedActive)) {
            editor.setActiveTab(savedActive);
          }
          if (savedSecondary && currentTabs.some((t) => t.id === savedSecondary)) {
            editor.setSecondaryTab(savedSecondary);
          }
        }
      } catch (e) {
        console.warn('[App] Failed to restore editor state:', e.message);
      }
    })();
  }, []);

  // Auto-save chat history to active project (debounced 2s)
  const debounceRef = useRef(null);
  useEffect(() => {
    let prevMessages = useChatStore.getState().messages;

    const unsub = useChatStore.subscribe((state) => {
      if (state.messages !== prevMessages && state.messages.length > 0 && !state.isStreaming) {
        prevMessages = state.messages;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          useProjectStore.getState().saveCurrentChatHistory();
        }, 2000);
      }
    });

    const handleBeforeUnload = () => {
      clearTimeout(debounceRef.current);
      useProjectStore.getState().saveCurrentChatHistory();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsub();
      clearTimeout(debounceRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Load model lists for all providers that have API keys
  useEffect(() => {
    const app = useAppStore.getState();
    for (const id of PROVIDER_ORDER) {
      const prov = app.providers[id];
      if (!prov?.apiKey) continue;

      const config = PROVIDERS[id];
      if (config.supportsModelFetch && (!prov.availableModels || prov.availableModels.length === 0)) {
        app.updateProvider(id, { modelsLoading: true });
        fetchModels(id, prov.apiKey)
          .then((models) => useAppStore.getState().updateProvider(id, { availableModels: models, modelsLoading: false }))
          .catch(() => useAppStore.getState().updateProvider(id, { modelsLoading: false }));
      } else if (!config.supportsModelFetch && config.hardcodedModels) {
        // Populate hardcoded models if not already set
        if (!prov.availableModels || prov.availableModels.length === 0) {
          app.updateProvider(id, { availableModels: config.hardcodedModels });
        }
      }
    }
  }, []); // run once on mount

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<WorkflowSelector />} />
            <Route path="scaffold" element={<ScaffoldingWorkflow />} />
            <Route path="analyze" element={<AnalysisWorkflow />} />
            <Route path="edit" element={<EditWorkflow />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
