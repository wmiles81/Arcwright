import React, { useCallback } from 'react';
import useProjectStore from '../../store/useProjectStore';

export default function SetupBanner() {
  const isInitialized = useProjectStore((s) => s.isInitialized);
  const needsReconnect = useProjectStore((s) => s.needsReconnect);
  const folderName = useProjectStore((s) => s.arcwriteHandle?.name);
  const hasApiKey = useProjectStore((s) => !!s.settings?.apiKey);

  const handleSetup = useCallback(async () => {
    try {
      const existing = useProjectStore.getState().arcwriteHandle;
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: existing ?? 'documents',
      });

      // If the user picked a folder named "Arcwrite", confirm whether it IS
      // the home folder (use directly) or just the parent (create inside it).
      let direct = false;
      if (/^arcwri(te|ght)$/i.test(handle.name)) {
        direct = window.confirm(
          `"${handle.name}" detected.\n\nIs this your Arcwrite home folder?\n\nOK → Use it as-is\nCancel → Create a new "Arcwrite" folder inside it`
        );
      }

      await useProjectStore.getState().setRootDirectory(handle, { direct });
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Setup failed:', e);
    }
  }, []);

  const handleReconnect = useCallback(async () => {
    await useProjectStore.getState().reconnect();
  }, []);

  // State 1: Initialized — green banner
  if (isInitialized) {
    return (
      <div className="max-w-2xl mx-auto mb-8 bg-green-900/30 border border-green-500/40 rounded-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-300 text-sm font-semibold">Arcwrite initialized</p>
            <p className="text-green-200/70 text-xs mt-0.5">
              Storage: {folderName || 'connected'}
              {hasApiKey ? ' \u2022 API key configured' : ''}
            </p>
          </div>
          <button
            onClick={handleSetup}
            className="text-xs text-green-400 hover:text-green-200 transition-colors"
            title="Change storage folder"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  // State 2: Needs reconnect — amber banner
  if (needsReconnect) {
    return (
      <div className="max-w-2xl mx-auto mb-8 bg-amber-900/30 border border-amber-500/40 rounded-lg px-6 py-5">
        <h3 className="text-lg font-bold text-amber-200 mb-1">Reconnect Arcwrite storage</h3>
        <p className="text-amber-300 text-sm mb-4">
          Your Arcwrite folder was found but needs permission to access it.
          Choose <strong className="text-amber-200">&ldquo;Allow on every visit&rdquo;</strong> to
          skip this step in the future.
        </p>
        <button
          onClick={handleReconnect}
          className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  // State 3: Not set up — purple banner
  return (
    <div className="max-w-2xl mx-auto mb-8 bg-purple-900/40 border border-purple-500/40 rounded-lg px-6 py-5">
      <h3 className="text-lg font-bold text-purple-200 mb-1">Set up Arcwrite</h3>
      <p className="text-purple-300 text-sm mb-4">
        Pick where to store Arcwrite data. An
        {' '}<code className="text-purple-200 bg-purple-800/50 px-1 rounded">Arcwrite</code> folder
        will be created inside the location you choose.
        Choose <strong className="text-purple-200">&ldquo;Allow on every visit&rdquo;</strong> when
        prompted to enable automatic access.
      </p>
      <button
        onClick={handleSetup}
        className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        Choose Folder
      </button>
    </div>
  );
}
