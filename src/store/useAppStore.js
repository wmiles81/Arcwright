import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genreSystem } from '../data/genreSystem';
import { allStructures } from '../data/plotStructures';
import { DIMENSION_KEYS } from '../data/dimensions';
import { getCompleteWeights } from '../engine/weights';
import { getDefaultVisibleDims } from '../engine/defaults';

/** Remap beat types to the closest match in a new structure based on time position.
 *  Deduplicates when target has fewer beats (keeps best match per key).
 *  Creates new scaffold beats for any structure beats not covered. */
function remapBeatsToStructure(beats, structureKey) {
  const structure = allStructures[structureKey];
  if (!structure || beats.length === 0) return beats;
  const entries = Object.entries(structure.beats);

  // Remap existing beats to closest structure beat
  const remapped = beats.map((beat) => {
    let bestKey = entries[0]?.[0] || beat.beat;
    let bestDist = Infinity;
    for (const [key, def] of entries) {
      const mid = (def.range[0] + def.range[1]) / 2;
      const dist = Math.abs(beat.time - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    }
    return { ...beat, beat: bestKey, label: structure.beats[bestKey]?.name || beat.label };
  });

  // Deduplicate: when multiple scaffold beats map to the same structure beat,
  // keep only the one closest to that beat's midpoint, then snap time to new position
  const byKey = {};
  remapped.forEach((beat) => {
    const def = structure.beats[beat.beat];
    if (!def) return;
    const mid = (def.range[0] + def.range[1]) / 2;
    const dist = Math.abs(beat.time - mid);
    if (!byKey[beat.beat] || dist < byKey[beat.beat].dist) {
      byKey[beat.beat] = { beat, dist, mid };
    }
  });
  // Snap kept beats to their new structure position so they distribute correctly
  const deduplicated = Object.values(byKey).map((entry) => ({
    ...entry.beat,
    time: Math.round(entry.mid),
  }));

  // Find structure beats not covered by any scaffold beat
  const coveredKeys = new Set(deduplicated.map((b) => b.beat));
  const missing = entries.filter(([key]) => !coveredKeys.has(key));

  // Sort existing beats by time for interpolation lookups
  const sorted = [...deduplicated].sort((a, b) => a.time - b.time);

  // Create new scaffold beats with interpolated dimension values from neighbors
  const newBeats = missing.map(([key, def]) => {
    const time = Math.round((def.range[0] + def.range[1]) / 2);
    const b = {
      id: `remap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time,
      beat: key,
      label: def.name,
    };

    // Find surrounding beats for interpolation
    let below = null;
    let above = null;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].time <= time) below = sorted[i];
      if (sorted[i].time >= time && !above) above = sorted[i];
    }

    DIMENSION_KEYS.forEach((k) => {
      if (below && above && below !== above) {
        const span = above.time - below.time;
        const t = span > 0 ? (time - below.time) / span : 0.5;
        b[k] = Math.round(((1 - t) * (below[k] || 0) + t * (above[k] || 0)) * 10) / 10;
      } else if (below) {
        b[k] = below[k] || 0;
      } else if (above) {
        b[k] = above[k] || 0;
      } else {
        b[k] = 0;
      }
    });
    return b;
  });

  return [...deduplicated, ...newBeats].sort((a, b) => a.time - b.time);
}

const initialGenre = 'romance';
const initialSubgenre = 'contemporary';
const initialWeights = getCompleteWeights(genreSystem[initialGenre].subgenres[initialSubgenre].weights);

const useAppStore = create(
  persist(
    (set, get) => ({
      // --- Genre Configuration ---
      selectedGenre: initialGenre,
      selectedSubgenre: initialSubgenre,
      selectedStructure: genreSystem[initialGenre].structure,
      selectedActStructure: genreSystem[initialGenre].structure,
      selectedModifier: '',
      selectedPacing: '',
      applyCompanions: false,
      weights: { ...initialWeights },
      baseWeights: { ...initialWeights },
      visibleDims: getDefaultVisibleDims(initialGenre),

      setStructure: (structureKey) => {
        const { scaffoldBeats } = get();
        const remapped = remapBeatsToStructure(scaffoldBeats, structureKey);
        set({ selectedStructure: structureKey, scaffoldBeats: remapped });
      },

      setActStructure: (structureKey) => set({ selectedActStructure: structureKey }),

      setGenre: (genreKey) => {
        const newGenre = genreSystem[genreKey];
        const firstSubgenre = Object.keys(newGenre.subgenres)[0];
        const newWeights = getCompleteWeights(newGenre.subgenres[firstSubgenre].weights);
        const { scaffoldBeats } = get();
        const remapped = remapBeatsToStructure(scaffoldBeats, newGenre.structure);
        set({
          selectedGenre: genreKey,
          selectedSubgenre: firstSubgenre,
          selectedStructure: newGenre.structure,
          selectedActStructure: newGenre.structure,
          selectedModifier: '',
          selectedPacing: '',
          weights: { ...newWeights },
          baseWeights: { ...newWeights },
          visibleDims: getDefaultVisibleDims(genreKey),
          scaffoldBeats: remapped,
        });
      },

      setSubgenre: (subgenreKey) => {
        const { selectedGenre } = get();
        const newWeights = getCompleteWeights(genreSystem[selectedGenre].subgenres[subgenreKey].weights);
        set({
          selectedSubgenre: subgenreKey,
          selectedModifier: '',
          weights: { ...newWeights },
          baseWeights: { ...newWeights },
        });
      },

      setModifier: (modifier) => {
        const { baseWeights } = get();
        set({
          selectedModifier: modifier,
          weights: modifier ? { ...get().weights } : { ...baseWeights },
        });
      },

      setPacing: (pacing) => set({ selectedPacing: pacing }),
      setApplyCompanions: (v) => set({ applyCompanions: v }),

      updateWeight: (key, value) => {
        set((state) => ({
          weights: { ...state.weights, [key]: parseFloat(value) || 0 },
        }));
      },

      validateAndClampWeight: (key) => {
        const current = get().weights[key] || 0;
        const clamped = Math.max(0, Math.min(3, current));
        if (clamped !== current) {
          set((state) => ({
            weights: { ...state.weights, [key]: clamped },
          }));
        }
      },

      toggleDimension: (dim) => {
        set((state) => ({
          visibleDims: { ...state.visibleDims, [dim]: !state.visibleDims[dim] },
        }));
      },

      resetWeights: () => {
        const { selectedGenre, selectedSubgenre } = get();
        const newWeights = getCompleteWeights(genreSystem[selectedGenre].subgenres[selectedSubgenre].weights);
        set({ weights: { ...newWeights }, baseWeights: { ...newWeights } });
      },

      resetVisibility: () => {
        const { selectedGenre } = get();
        set({ visibleDims: getDefaultVisibleDims(selectedGenre) });
      },

      // --- Genre Blending ---
      blendEnabled: false,
      secondaryGenre: '',
      secondarySubgenre: '',
      blendRatio: 70,

      setBlendEnabled: (enabled) => {
        if (!enabled) {
          set({ blendEnabled: false, secondaryGenre: '', secondarySubgenre: '' });
        } else {
          const { selectedGenre } = get();
          // Pick first genre that isn't the primary
          const otherGenre = Object.keys(genreSystem).find((k) => k !== selectedGenre) || '';
          const firstSub = otherGenre ? Object.keys(genreSystem[otherGenre].subgenres)[0] : '';
          set({ blendEnabled: true, secondaryGenre: otherGenre, secondarySubgenre: firstSub });
        }
      },

      setSecondaryGenre: (genreKey) => {
        const firstSub = Object.keys(genreSystem[genreKey].subgenres)[0];
        set({ secondaryGenre: genreKey, secondarySubgenre: firstSub });
      },

      setSecondarySubgenre: (subgenreKey) => set({ secondarySubgenre: subgenreKey }),

      setBlendRatio: (ratio) => set({ blendRatio: Math.max(1, Math.min(99, ratio)) }),

      // --- Scaffolding (Workflow 1) ---
      scaffoldBeats: [],

      setScaffoldBeats: (beats) => set({ scaffoldBeats: beats }),

      addBeat: (beat) => {
        set((state) => {
          const newBeats = [...state.scaffoldBeats, beat].sort((a, b) => a.time - b.time);
          return { scaffoldBeats: newBeats };
        });
      },

      updateBeat: (id, updates) => {
        set((state) => ({
          scaffoldBeats: state.scaffoldBeats
            .map((b) => (b.id === id ? { ...b, ...updates } : b))
            .sort((a, b) => a.time - b.time),
        }));
      },

      removeBeat: (id) => {
        set((state) => ({
          scaffoldBeats: state.scaffoldBeats.filter((b) => b.id !== id),
        }));
      },

      clearScaffold: () => set({ scaffoldBeats: [] }),

      // --- Custom Structures ---
      customStructures: [],

      saveCustomStructure: (name) => {
        const { scaffoldBeats, customStructures } = get();
        if (scaffoldBeats.length === 0) return;
        const beats = scaffoldBeats.map(({ id, ...rest }) => rest);
        const structure = {
          id: `struct_${Date.now()}`,
          name,
          createdAt: Date.now(),
          beats,
        };
        set({ customStructures: [...customStructures, structure] });
      },

      deleteCustomStructure: (id) => {
        set((state) => ({
          customStructures: state.customStructures.filter((s) => s.id !== id),
        }));
      },

      renameCustomStructure: (id, name) => {
        set((state) => ({
          customStructures: state.customStructures.map((s) =>
            s.id === id ? { ...s, name } : s
          ),
        }));
      },

      // --- Analysis (Workflow 2) ---
      chapters: [],
      analysisInProgress: false,

      // --- Multi-provider LLM state ---
      activeProvider: 'openrouter',
      providers: {
        openrouter: { apiKey: '', selectedModel: 'anthropic/claude-sonnet-4-5-20250929', availableModels: [], modelsLoading: false },
        openai: { apiKey: '', selectedModel: 'gpt-4o', availableModels: [], modelsLoading: false },
        anthropic: { apiKey: '', selectedModel: 'claude-sonnet-4-5-20250929', availableModels: [], modelsLoading: false },
        perplexity: { apiKey: '', selectedModel: 'sonar-pro', availableModels: [], modelsLoading: false },
      },
      chatSettings: {
        temperature: 1,
        maxTokens: 4096,
        toolsEnabled: true,
        reasoningEnabled: false,
        promptMode: 'full',
        activeVoicePath: null,
        activeVoiceContent: '',
        activeNarratorGender: null,       // null | 'female' | 'male'
        activeGenderMechanicsContent: '', // loaded from Arcwrite/gender-mechanics/<gender>.md
      },
      updateChatSettings: (updates) => set((s) => ({
        chatSettings: { ...s.chatSettings, ...updates },
      })),

      // --- Image generation settings ---
      imageSettings: {
        provider: '',           // provider id — user picks from configured providers
        model: '',              // free-text model id — user types any model
        defaultSize: '1024x1024',
      },
      updateImageSettings: (updates) => set((s) => ({
        imageSettings: { ...s.imageSettings, ...updates },
      })),

      projectionPercent: 0,
      revisionItems: [],

      setActiveProvider: (id) => set({ activeProvider: id }),
      updateProvider: (id, updates) => set((s) => ({
        providers: { ...s.providers, [id]: { ...s.providers[id], ...updates } },
      })),

      /** Sync settings loaded from .arcwrite/ into this store. */
      syncFromProjectSettings: (settings) => set((s) => {
        const updates = {
          chatSettings: { ...s.chatSettings, ...(settings.chatSettings || {}) },
        };
        if (settings.imageSettings) {
          updates.imageSettings = { ...s.imageSettings, ...settings.imageSettings };
        }
        // v2 format: providers map
        if (settings.providers) {
          const merged = { ...s.providers };
          for (const [id, provState] of Object.entries(settings.providers)) {
            if (merged[id]) {
              merged[id] = {
                ...merged[id],
                apiKey: provState.apiKey || merged[id].apiKey,
                selectedModel: provState.selectedModel || merged[id].selectedModel,
              };
            }
          }
          updates.providers = merged;
          if (settings.activeProvider) updates.activeProvider = settings.activeProvider;
        } else if (settings.apiKey) {
          // v1 flat format — migrate into openrouter
          updates.providers = {
            ...s.providers,
            openrouter: {
              ...s.providers.openrouter,
              apiKey: settings.apiKey || s.providers.openrouter.apiKey,
              selectedModel: settings.selectedModel || s.providers.openrouter.selectedModel,
            },
          };
        }
        return updates;
      }),

      addChapter: (chapter) => {
        set((state) => ({ chapters: [...state.chapters, chapter] }));
      },

      updateChapter: (id, updates) => {
        set((state) => ({
          chapters: state.chapters.map((ch) => (ch.id === id ? { ...ch, ...updates } : ch)),
        }));
      },

      removeChapter: (id) => {
        set((state) => ({
          chapters: state.chapters.filter((ch) => ch.id !== id),
        }));
      },

      clearChapters: () => set({ chapters: [], revisionItems: [] }),

      setAnalysisInProgress: (v) => set({ analysisInProgress: v }),

      updateChapterScores: (chapterId, scores, source = 'ai') => {
        set((state) => ({
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? {
                  ...ch,
                  ...(source === 'ai'
                    ? { aiScores: scores, userScores: { ...scores } }
                    : { userScores: scores }),
                  status: source === 'ai' ? 'analyzed' : 'reviewed',
                }
              : ch
          ),
        }));
      },

      setProjectionPercent: (v) => set({ projectionPercent: v }),

      setRevisionItems: (items) => set({ revisionItems: items }),

      toggleRevisionItem: (itemId) => {
        set((state) => ({
          revisionItems: state.revisionItems.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        }));
      },
    }),
    {
      name: 'context-graphing-store',
      partialize: (state) => {
        // Persist provider keys, selected models, and cached model lists
        const providersPersist = {};
        for (const [id, p] of Object.entries(state.providers)) {
          providersPersist[id] = {
            apiKey: p.apiKey,
            selectedModel: p.selectedModel,
            availableModels: p.availableModels || [],
          };
        }
        return {
          selectedGenre: state.selectedGenre,
          selectedSubgenre: state.selectedSubgenre,
          selectedStructure: state.selectedStructure,
          selectedActStructure: state.selectedActStructure,
          selectedModifier: state.selectedModifier,
          selectedPacing: state.selectedPacing,
          applyCompanions: state.applyCompanions,
          weights: state.weights,
          baseWeights: state.baseWeights,
          blendEnabled: state.blendEnabled,
          secondaryGenre: state.secondaryGenre,
          secondarySubgenre: state.secondarySubgenre,
          blendRatio: state.blendRatio,
          scaffoldBeats: state.scaffoldBeats,
          customStructures: state.customStructures,
          chapters: state.chapters,
          activeProvider: state.activeProvider,
          providers: providersPersist,
          chatSettings: state.chatSettings,
          imageSettings: state.imageSettings,
          revisionItems: state.revisionItems,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migration: default act structure to beat structure if not persisted
          if (!state.selectedActStructure) {
            useAppStore.setState({ selectedActStructure: state.selectedStructure });
          }
          // Ensure beat types match the selected structure
          if (state.selectedStructure && state.scaffoldBeats?.length > 0) {
            const structure = allStructures[state.selectedStructure];
            if (structure) {
              const firstBeat = state.scaffoldBeats[0];
              if (firstBeat.beat && !structure.beats[firstBeat.beat]) {
                const remapped = remapBeatsToStructure(state.scaffoldBeats, state.selectedStructure);
                useAppStore.setState({ scaffoldBeats: remapped });
              }
            }
          }
          // Migration: flat apiKey/selectedModel → providers.openrouter
          if (state.apiKey && !state.providers?.openrouter?.apiKey) {
            const current = useAppStore.getState().providers;
            useAppStore.setState({
              activeProvider: 'openrouter',
              providers: {
                ...current,
                openrouter: {
                  ...current.openrouter,
                  apiKey: state.apiKey,
                  selectedModel: state.selectedModel || current.openrouter.selectedModel,
                },
              },
            });
          }
          // Merge persisted provider keys/models/cached lists into full provider state
          if (state.providers) {
            const defaults = useAppStore.getState().providers;
            const merged = {};
            for (const [id, p] of Object.entries(defaults)) {
              merged[id] = {
                ...p,
                apiKey: state.providers[id]?.apiKey || p.apiKey,
                selectedModel: state.providers[id]?.selectedModel || p.selectedModel,
                availableModels: state.providers[id]?.availableModels || p.availableModels || [],
                modelsLoading: false,
              };
            }
            useAppStore.setState({ providers: merged });
          }
        }
      },
    }
  )
);

export default useAppStore;
