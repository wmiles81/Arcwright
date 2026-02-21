import { create } from 'zustand';
import {
  listCustomPrompts as fsListCustomPrompts,
  saveCustomPrompt as fsSaveCustomPrompt,
  deleteCustomPrompt as fsDeleteCustomPrompt,
} from '../services/arcwriteFS';
import useProjectStore from './useProjectStore';
import defaultPrompts from '../data/defaultPrompts';

/**
 * Store for managing user-defined custom prompts.
 * Prompts are persisted to Arcwrite/prompts/ folder on disk.
 */
const usePromptStore = create((set, get) => ({
  customPrompts: [],
  isLoaded: false,

  /**
   * Load custom prompts from disk.
   */
  loadPrompts: async () => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) {
      set({ customPrompts: [], isLoaded: false });
      return;
    }
    try {
      const prompts = await fsListCustomPrompts(arcwriteHandle);
      set({ customPrompts: prompts, isLoaded: true });
    } catch (e) {
      console.error('[PromptStore] loadPrompts failed:', e);
      set({ customPrompts: [], isLoaded: true });
    }
  },

  /**
   * Create a new custom prompt.
   */
  createPrompt: async (prompt) => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) return null;

    const full = {
      ...prompt,
      id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await fsSaveCustomPrompt(arcwriteHandle, full);
      await get().loadPrompts();
      return full;
    } catch (e) {
      console.error('[PromptStore] createPrompt failed:', e);
      return null;
    }
  },

  /**
   * Update an existing custom prompt.
   */
  updatePrompt: async (prompt) => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) return;

    const updated = { ...prompt, updatedAt: Date.now() };
    try {
      await fsSaveCustomPrompt(arcwriteHandle, updated);
      await get().loadPrompts();
    } catch (e) {
      console.error('[PromptStore] updatePrompt failed:', e);
    }
  },

  /**
   * Delete a custom prompt by ID.
   */
  deletePrompt: async (promptId) => {
    const { arcwriteHandle, isInitialized } = useProjectStore.getState();
    if (!arcwriteHandle || !isInitialized) return;

    try {
      await fsDeleteCustomPrompt(arcwriteHandle, promptId);
      await get().loadPrompts();
    } catch (e) {
      console.error('[PromptStore] deletePrompt failed:', e);
    }
  },

  /**
   * Inject pack prompts (tagged with _packId, read-only in UI).
   */
  addPackPrompts: (prompts) => {
    set((s) => ({ customPrompts: [...s.customPrompts, ...prompts] }));
  },

  /**
   * Get all prompts (custom + defaults merged), with custom prompts first.
   */
  getAllPrompts: () => {
    const { customPrompts } = get();
    return [...customPrompts, ...defaultPrompts];
  },
}));

export default usePromptStore;
