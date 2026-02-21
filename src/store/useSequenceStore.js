import { create } from 'zustand';
import {
  listCustomSequences as fsListCustomSequences,
  saveCustomSequence as fsSaveCustomSequence,
  deleteCustomSequence as fsDeleteCustomSequence,
} from '../services/arcwriteFS';
import useProjectStore from './useProjectStore';

/**
 * Store for managing user-defined named sequences.
 * Sequences are persisted to Arcwrite/sequences/ folder on disk.
 *
 * runningSequence tracks live execution state and is ephemeral (not persisted).
 * Shape: { sequenceId, sequenceName, currentStep, totalSteps, steps: [{id, label, status, outputFile, wordCount}] }
 * Status values: 'pending' | 'running' | 'done' | 'error'
 */
const useSequenceStore = create((set, get) => ({
  customSequences: [],
  isLoaded: false,
  runningSequence: null,

  /**
   * Load custom sequences from disk.
   */
  loadSequences: async () => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) {
      set({ customSequences: [], isLoaded: false });
      return;
    }
    try {
      const sequences = await fsListCustomSequences(arcwriteHandle);
      set({ customSequences: sequences, isLoaded: true });
    } catch (e) {
      console.error('[SequenceStore] loadSequences failed:', e);
      set({ customSequences: [], isLoaded: true });
    }
  },

  /**
   * Create a new named sequence.
   */
  createSequence: async (sequence) => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) return null;

    const full = {
      ...sequence,
      id: `sequence_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await fsSaveCustomSequence(arcwriteHandle, full);
      await get().loadSequences();
      return full;
    } catch (e) {
      console.error('[SequenceStore] createSequence failed:', e);
      return null;
    }
  },

  /**
   * Update an existing named sequence.
   */
  updateSequence: async (sequence) => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) return;

    const updated = { ...sequence, updatedAt: Date.now() };
    try {
      await fsSaveCustomSequence(arcwriteHandle, updated);
      await get().loadSequences();
    } catch (e) {
      console.error('[SequenceStore] updateSequence failed:', e);
    }
  },

  /**
   * Delete a named sequence by ID.
   */
  deleteSequence: async (sequenceId) => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) return;

    try {
      await fsDeleteCustomSequence(arcwriteHandle, sequenceId);
      await get().loadSequences();
    } catch (e) {
      console.error('[SequenceStore] deleteSequence failed:', e);
    }
  },

  /**
   * Inject pack sequences (tagged with _packId, read-only in UI).
   */
  addPackSequences: (sequences) => {
    set((s) => ({ customSequences: [...s.customSequences, ...sequences] }));
  },

  /**
   * Get all sequences.
   */
  getAllSequences: () => {
    const { customSequences } = get();
    return [...customSequences];
  },

  /**
   * Set the running sequence state (called by actionExecutor during execution).
   */
  setRunningSequence: (state) => set({ runningSequence: state }),

  /**
   * Clear the running sequence state (called on completion or error).
   */
  clearRunningSequence: () => set({ runningSequence: null }),
}));

export default useSequenceStore;
