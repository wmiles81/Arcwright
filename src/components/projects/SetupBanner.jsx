import React, { useState, useEffect, useCallback } from 'react';

/**
 * SetupBanner — shown on the landing page.
 *
 * States:
 *   1. Loading     — checking data-status from API
 *   2. Fresh       — no settings yet; offer migration or fresh start
 *   3. Migrating   — copy in progress
 *   4. Initialized — green banner showing data directory
 *   5. Error       — migration failed; show message + retry
 */
export default function SetupBanner() {
  const [status, setStatus] = useState('loading'); // loading | fresh | migrating | ready | error
  const [dataDir, setDataDir] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [error, setError] = useState('');
  const [migratedCount, setMigratedCount] = useState(0);

  // ── Check data-status on mount ──────────────────────────────────────
  useEffect(() => {
    fetch('/api/data-status')
      .then((r) => r.json())
      .then((data) => {
        setDataDir(data.dataDir);
        setStatus(data.fresh ? 'fresh' : 'ready');
      })
      .catch(() => setStatus('ready')); // if API fails, don't block the app
  }, []);

  // ── Import data ─────────────────────────────────────────────────────
  const handleMigrate = useCallback(async () => {
    if (!sourcePath.trim()) {
      setError('Please enter a path to your existing Arcwrite folder.');
      return;
    }
    setStatus('migrating');
    setError('');
    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: sourcePath.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Migration failed');
        setStatus('fresh');
        return;
      }
      setMigratedCount(data.filesCopied);
      setStatus('ready');
    } catch (e) {
      setError(e.message);
      setStatus('fresh');
    }
  }, [sourcePath]);

  // ── Start fresh ─────────────────────────────────────────────────────
  const handleFresh = useCallback(() => {
    setStatus('ready');
  }, []);

  // === Loading ===
  if (status === 'loading') {
    return (
      <div className="max-w-2xl mx-auto mb-8 bg-slate-800/50 border border-slate-600/30 rounded-lg px-6 py-4">
        <p className="text-slate-400 text-sm">Checking data directory…</p>
      </div>
    );
  }

  // === Initialized ===
  if (status === 'ready') {
    return (
      <div className="max-w-2xl mx-auto mb-8 bg-green-900/30 border border-green-500/40 rounded-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-300 text-sm font-semibold">
              {migratedCount > 0
                ? `Data imported — ${migratedCount} items copied`
                : 'Arcwright initialized'}
            </p>
            <p className="text-green-200/70 text-xs mt-0.5">
              Storage: <code className="bg-green-900/40 px-1 rounded">{dataDir}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === Migrating ===
  if (status === 'migrating') {
    return (
      <div className="max-w-2xl mx-auto mb-8 bg-amber-900/30 border border-amber-500/40 rounded-lg px-6 py-5">
        <p className="text-amber-200 text-sm font-semibold">Importing data…</p>
        <p className="text-amber-300/70 text-xs mt-1">
          Copying from <code className="bg-amber-900/40 px-1 rounded">{sourcePath}</code>
        </p>
      </div>
    );
  }

  // === Fresh install — migration prompt ===
  return (
    <div className="max-w-2xl mx-auto mb-8 bg-purple-900/40 border border-purple-500/40 rounded-lg px-6 py-5">
      <h3 className="text-lg font-bold text-purple-200 mb-1">Welcome — Set up your data</h3>
      <p className="text-purple-300 text-sm mb-4">
        Arcwright stores data in{' '}
        <code className="text-purple-200 bg-purple-800/50 px-1 rounded">{dataDir}</code>.
        {' '}If you have an existing Arcwrite folder from a previous version, you can import it now.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder="Path to existing Arcwrite folder, e.g. /Volumes/home/Arcwrite"
          className="flex-1 bg-slate-800 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
        />
        <button
          onClick={handleMigrate}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
        >
          Import
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs mb-3">{error}</p>
      )}

      <button
        onClick={handleFresh}
        className="text-xs text-purple-400 hover:text-purple-200 transition-colors"
      >
        Skip — start with empty data
      </button>
    </div>
  );
}
