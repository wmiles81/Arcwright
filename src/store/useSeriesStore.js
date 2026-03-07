/**
 * Zustand store for Series entities.
 *
 * Reads from / writes to SQLite via database.js.
 * Manages the active series, its books, and series-level beats.
 */

import { create } from 'zustand';
import {
    getAllSeries, getSeriesById, insertSeries, updateSeries, deleteSeries,
    getSeriesBeats, insertSeriesBeat, deleteSeriesBeat,
    getBooksBySeriesId,
} from '../services/database';

const useSeriesStore = create((set, get) => ({
    // --- Active series ---
    activeSeriesId: null,
    activeSeries: null,     // { id, name, type, notes, ... }
    seriesBeats: [],        // for protagonist_terminating type
    seriesBooks: [],        // books in the active series

    // --- View mode ---
    viewMode: 'book',       // 'series' | 'book' | 'overlay'
    selectedSeriesStructure: null,  // key into seriesStructures

    setSelectedSeriesStructure: (key) => set({ selectedSeriesStructure: key }),

    // --- All series (for listings) ---
    allSeries: [],

    // ── Series lifecycle ──

    /** Load all series for listing. */
    loadAllSeries: () => {
        try {
            const allSeries = getAllSeries() || [];
            set({ allSeries: Array.isArray(allSeries) ? allSeries : [] });
        } catch {
            set({ allSeries: [] });
        }
    },

    /** Activate a series by ID. */
    loadSeries: (seriesId) => {
        const series = getSeriesById(seriesId);
        if (!series) {
            set({ activeSeriesId: null, activeSeries: null, seriesBeats: [], seriesBooks: [] });
            return;
        }
        const beats = getSeriesBeats(seriesId);
        const books = getBooksBySeriesId(seriesId);
        set({ activeSeriesId: seriesId, activeSeries: series, seriesBeats: beats, seriesBooks: books });
    },

    /** Create a new series. */
    createSeries: ({ name, type, notes = '' }) => {
        const id = insertSeries({ name, type, notes });
        get().loadAllSeries();
        get().loadSeries(id);
        return id;
    },

    /** Update the active series metadata. */
    updateActiveSeries: (updates) => {
        const { activeSeriesId, activeSeries } = get();
        if (!activeSeriesId) return;
        updateSeries(activeSeriesId, updates);
        set({ activeSeries: { ...activeSeries, ...updates } });
        get().loadAllSeries(); // refresh listing
    },

    /** Delete a series. */
    removeSeries: (id) => {
        const { activeSeriesId } = get();
        deleteSeries(id);
        if (activeSeriesId === id) {
            set({ activeSeriesId: null, activeSeries: null, seriesBeats: [], seriesBooks: [] });
        }
        get().loadAllSeries();
    },

    /** Clear active series. */
    clearSeries: () => {
        set({ activeSeriesId: null, activeSeries: null, seriesBeats: [], seriesBooks: [] });
    },

    // ── Series Beats (for protagonist_terminating) ──

    addSeriesBeat: ({ time, beat, label }) => {
        const { activeSeriesId } = get();
        if (!activeSeriesId) return null;
        const id = insertSeriesBeat({ seriesId: activeSeriesId, time, beat, label });
        set({ seriesBeats: getSeriesBeats(activeSeriesId) });
        return id;
    },

    removeSeriesBeat: (id) => {
        const { activeSeriesId } = get();
        deleteSeriesBeat(id);
        set({ seriesBeats: getSeriesBeats(activeSeriesId) });
    },

    // ── View mode ──

    setViewMode: (mode) => {
        if (['series', 'book', 'overlay'].includes(mode)) {
            set({ viewMode: mode });
        }
    },

    /** Cycle through view modes: series → book → overlay → series. */
    cycleViewMode: () => {
        const modes = ['series', 'book', 'overlay'];
        const { viewMode } = get();
        const idx = modes.indexOf(viewMode);
        set({ viewMode: modes[(idx + 1) % modes.length] });
    },

    // ── Refresh helpers ──

    /** Refresh series books list (call after adding/removing books from series). */
    refreshSeriesBooks: () => {
        const { activeSeriesId } = get();
        if (!activeSeriesId) return;
        set({ seriesBooks: getBooksBySeriesId(activeSeriesId) });
    },
}));

export default useSeriesStore;
