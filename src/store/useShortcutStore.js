/**
 * useShortcutStore.js — F-012: Remappable Keyboard Shortcuts
 *
 * Centralized shortcut registry with persist middleware.
 * Users can override any shortcut via the Settings > Shortcuts tab.
 *
 * Usage:
 *   import { matchesShortcut } from '../store/useShortcutStore';
 *   if (matchesShortcut('editor.save', e)) { ... }
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Default shortcut bindings ────────────────────────────────── */

export const DEFAULT_SHORTCUTS = {
    'editor.save': { key: 's', meta: true, label: 'Save file' },
    'editor.search': { key: 'f', meta: true, label: 'Find / Replace' },
    'editor.inlineEdit': { key: 'k', meta: true, label: 'Inline AI edit' },
    'editor.focusMode': { key: 'Escape', label: 'Toggle focus mode' },
    'editor.undo': { key: 'z', meta: true, label: 'Undo' },
    'editor.redo': { key: 'z', meta: true, shift: true, label: 'Redo' },
    'file.contextMenu': { key: 'F10', shift: true, label: 'Context menu' },
};

/* ── Store ────────────────────────────────────────────────────── */

const useShortcutStore = create(
    persist(
        (set, get) => ({
            /** User overrides — only stores the key/modifier diff from defaults */
            overrides: {},

            /** Set a custom shortcut binding */
            setShortcut: (id, binding) =>
                set((s) => ({
                    overrides: { ...s.overrides, [id]: binding },
                })),

            /** Reset a single shortcut to default */
            resetShortcut: (id) =>
                set((s) => {
                    const next = { ...s.overrides };
                    delete next[id];
                    return { overrides: next };
                }),

            /** Reset all shortcuts to defaults */
            resetAll: () => set({ overrides: {} }),
        }),
        {
            name: 'shortcut-store',
            partialize: (state) => ({ overrides: state.overrides }),
        }
    )
);

/* ── Helpers ──────────────────────────────────────────────────── */

/**
 * Get the effective binding for a shortcut (user override or default).
 * @param {string} id — shortcut identifier, e.g. 'editor.save'
 * @returns {{ key: string, meta?: boolean, shift?: boolean, alt?: boolean, label: string }}
 */
export function getBinding(id) {
    const { overrides } = useShortcutStore.getState();
    const override = overrides[id];
    const base = DEFAULT_SHORTCUTS[id];
    if (!base) return null;
    return override ? { ...base, ...override } : base;
}

/**
 * Check if a KeyboardEvent matches a named shortcut.
 * @param {string} id — shortcut identifier
 * @param {KeyboardEvent} e — the event to match
 * @returns {boolean}
 */
export function matchesShortcut(id, e) {
    const binding = getBinding(id);
    if (!binding) return false;

    // Key comparison (case-insensitive)
    if (e.key.toLowerCase() !== binding.key.toLowerCase()) return false;

    // Modifier matching
    const wantMeta = !!binding.meta;
    const wantShift = !!binding.shift;
    const wantAlt = !!binding.alt;

    const hasMeta = e.metaKey || e.ctrlKey; // Support both Mac ⌘ and Ctrl
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;

    return hasMeta === wantMeta && hasShift === wantShift && hasAlt === wantAlt;
}

/**
 * Format a binding as a display string (e.g. "⌘S", "⌘⇧Z", "⇧F10").
 * @param {{ key: string, meta?: boolean, shift?: boolean, alt?: boolean }} binding
 * @returns {string}
 */
export function formatBinding(binding) {
    if (!binding) return '';
    const parts = [];
    if (binding.meta) parts.push('⌘');
    if (binding.alt) parts.push('⌥');
    if (binding.shift) parts.push('⇧');
    // Show the key in uppercase for single letters
    const display = binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
    parts.push(display);
    return parts.join('');
}

/**
 * Detect conflicts: returns the id of any shortcut that uses the same binding.
 * @param {string} excludeId — the shortcut being edited (exclude from check)
 * @param {{ key: string, meta?: boolean, shift?: boolean, alt?: boolean }} binding
 * @returns {string|null} — conflicting shortcut id, or null
 */
export function findConflict(excludeId, binding) {
    for (const id of Object.keys(DEFAULT_SHORTCUTS)) {
        if (id === excludeId) continue;
        const current = getBinding(id);
        if (
            current.key.toLowerCase() === binding.key.toLowerCase() &&
            !!current.meta === !!binding.meta &&
            !!current.shift === !!binding.shift &&
            !!current.alt === !!binding.alt
        ) {
            return id;
        }
    }
    return null;
}

export default useShortcutStore;
