/**
 * useUndoStore.js — F-009: Undo/Redo system
 *
 * A lightweight undo stack that captures labelled snapshots before
 * destructive actions. Each entry records which source store was
 * mutated and the state slice to restore.
 *
 * Usage:
 *   import { pushUndo, undo, redo, useUndoStore } from './useUndoStore';
 *   pushUndo('Beat deleted', 'app', { scaffoldBeats: [...] });
 *   undo();   // restores the last snapshot
 *   redo();   // re-applies the undone snapshot
 */
import { create } from 'zustand';

/* ── Store ─────────────────────────────────────────────────────── */

const useUndoStore = create((set, get) => ({
    /** @type {{ label: string, source: 'app'|'editor', slice: object }[]} */
    undoStack: [],
    /** @type {{ label: string, source: 'app'|'editor', slice: object }[]} */
    redoStack: [],

    /** Visible toast label  (null = hidden) */
    toastLabel: null,
    toastTimerId: null,

    canUndo: false,
    canRedo: false,
}));

/* ── Store registry (avoids circular imports) ──────────────────── */

const storeRegistry = {};

/** Register a source store for undo/redo. Called from each store's module. */
export function registerUndoSource(name, store) {
    storeRegistry[name] = store;
}

function getStore(name) {
    const store = storeRegistry[name];
    if (!store) throw new Error(`Undo source "${name}" not registered`);
    return store;
}

/* ── Helpers (called imperatively, not from React) ─────────────── */

/**
 * Push a labelled undo snapshot.
 * @param {string} label  — human-readable description, e.g. "Beat deleted"
 * @param {'app'|'editor'} source — which store owns the slice
 * @param {object} slice — state to restore on undo
 */
export function pushUndo(label, source, slice) {
    const { undoStack, toastTimerId } = useUndoStore.getState();
    if (toastTimerId) clearTimeout(toastTimerId);

    const entry = { label, source, slice };
    const newStack = [...undoStack, entry].slice(-50); // cap at 50

    // Show toast with auto-dismiss
    const timerId = setTimeout(() => {
        useUndoStore.setState({ toastLabel: null, toastTimerId: null });
    }, 5000);

    useUndoStore.setState({
        undoStack: newStack,
        redoStack: [],           // new action clears redo
        canUndo: true,
        canRedo: false,
        toastLabel: label,
        toastTimerId: timerId,
    });
}

/** Undo the last action. */
export function undo() {
    const { undoStack, redoStack } = useUndoStore.getState();
    if (undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1];
    const store = getStore(entry.source);

    // Capture current state for redo before restoring
    const currentSlice = {};
    for (const key of Object.keys(entry.slice)) {
        currentSlice[key] = store.getState()[key];
    }
    const redoEntry = { label: entry.label, source: entry.source, slice: currentSlice };

    // Restore snapshot
    store.setState(entry.slice);

    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, redoEntry];

    const { toastTimerId: existingTimer } = useUndoStore.getState();
    if (existingTimer) clearTimeout(existingTimer);
    const timerId = setTimeout(() => {
        useUndoStore.setState({ toastLabel: null, toastTimerId: null });
    }, 3000);

    useUndoStore.setState({
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: true,
        toastLabel: `Undone: ${entry.label}`,
        toastTimerId: timerId,
    });
}

/** Redo the last undone action. */
export function redo() {
    const { undoStack, redoStack } = useUndoStore.getState();
    if (redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];
    const store = getStore(entry.source);

    // Capture current for undo before restoring
    const currentSlice = {};
    for (const key of Object.keys(entry.slice)) {
        currentSlice[key] = store.getState()[key];
    }
    const undoEntry = { label: entry.label, source: entry.source, slice: currentSlice };

    // Apply redo
    store.setState(entry.slice);

    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, undoEntry];

    const { toastTimerId: existingTimer } = useUndoStore.getState();
    if (existingTimer) clearTimeout(existingTimer);
    const timerId = setTimeout(() => {
        useUndoStore.setState({ toastLabel: null, toastTimerId: null });
    }, 3000);

    useUndoStore.setState({
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
        toastLabel: `Redone: ${entry.label}`,
        toastTimerId: timerId,
    });
}

export default useUndoStore;
