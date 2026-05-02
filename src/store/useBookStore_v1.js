/**
 * Zustand store for Book entities.
 *
 * Reads from / writes to SQLite via database.js.
 * Holds the active book's characters, scenes, chapters, settings in memory
 * for fast React access, with every mutation persisted to SQLite.
 *
 * Does NOT duplicate scaffold state (genre/weights/beats stay in useAppStore).
 */

import { create } from 'zustand';
import {
    getBookById, getBookByTitle, insertBook, updateBook, deleteBook, getAllBooks,
    getCharactersByBook, insertCharacter, updateCharacter, deleteCharacter,
    getArcPointsByCharacter, insertArcPoint, updateArcPoint, deleteArcPoint,
    getScenesByBook, insertScene, updateScene, deleteScene,
    linkSceneToBeat, unlinkScene,
    getChaptersByBook, insertChapter, updateChapter, deleteChapter,
    getSettingsByBook, insertSetting, updateSetting, deleteSetting,
    addCharacterToScene, removeCharacterFromScene,
    getSnapshotsByScene, insertSnapshot,
    getBookStats, getScenesWithDetails,
} from '../services/database';

const useBookStore = create((set, get) => ({
    // --- Active book ---
    activeBookId: null,
    activeBook: null,     // { id, title, hook, premise, series_id, ... }

    // --- Entity arrays for active book ---
    characters: [],
    scenes: [],
    chapters: [],
    settings: [],

    // --- Loading state ---
    isLoading: false,

    // ── Book lifecycle ──

    /** Load a book by ID and populate all child entities. */
    loadBook: async (bookId) => {
        set({ isLoading: true });
        try {
            const book = getBookById(bookId);
            if (!book) {
                set({ activeBookId: null, activeBook: null, characters: [], scenes: [], chapters: [], settings: [], isLoading: false });
                return;
            }
            const bookCharacters = getCharactersByBook(bookId);
            const bookScenes = getScenesByBook(bookId);
            const bookChapters = getChaptersByBook(bookId);
            const bookSettings = getSettingsByBook(bookId);
            set({ activeBookId: bookId, activeBook: book, characters: bookCharacters, scenes: bookScenes, chapters: bookChapters, settings: bookSettings, isLoading: false });
        } catch (err) {
            console.error('[BookStore] Failed to load book:', err);
            set({ isLoading: false });
        }
    },

    /** Load a book by title (used when activating a book project by name). */
    loadBookByTitle: async (title) => {
        // Wait for database to be ready (handles the init race condition)
        const { waitForDb } = await import('../services/database');
        const dbInstance = await waitForDb();
        if (!dbInstance) {
            console.warn('[BookStore] Database not available, skipping loadBookByTitle');
            return;
        }
        const book = getBookByTitle(title);
        if (book) {
            await get().loadBook(book.id);
        } else {
            // Auto-create a book record for this project
            const id = insertBook({ title });
            await get().loadBook(id);
        }
    },

    /** Create a new book and activate it. */
    createBook: ({ title, seriesId = null, seriesPosition = null, hook = '', premise = '' }) => {
        const id = insertBook({ title, seriesId, seriesPosition, hook, premise });
        get().loadBook(id);
        return id;
    },

    /** Update the active book's metadata. */
    updateActiveBook: (updates) => {
        const { activeBookId, activeBook } = get();
        if (!activeBookId) return;
        updateBook(activeBookId, updates);
        set({ activeBook: { ...activeBook, ...updates } });
    },

    /** Clear the active book (deactivate). */
    clearBook: () => {
        set({ activeBookId: null, activeBook: null, characters: [], scenes: [], chapters: [], settings: [] });
    },

    /** Get all books (for listings). */
    listBooks: () => getAllBooks(),

    // ── Characters ──

    addCharacter: ({ name, role = 'supporting', notes = '' }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = insertCharacter({ bookId: activeBookId, name, role, notes });
        set({ characters: getCharactersByBook(activeBookId) });
        return id;
    },

    updateCharacterById: (id, updates) => {
        const { activeBookId } = get();
        updateCharacter(id, updates);
        set({ characters: getCharactersByBook(activeBookId) });
    },

    removeCharacter: (id) => {
        const { activeBookId } = get();
        deleteCharacter(id);
        set({ characters: getCharactersByBook(activeBookId) });
    },

    // ── Character Arc Points ──

    /** Get arc points for a character (returns array). */
    getCharacterArcPoints: (characterId) => getArcPointsByCharacter(characterId),

    /** Add an arc point to a character. */
    addArcPoint: ({ characterId, dimensionKey, time, value, note = '' }) => {
        return insertArcPoint({ characterId, dimensionKey, time, value, note });
    },

    /** Update an existing arc point. */
    updateArcPointById: (id, updates) => {
        updateArcPoint(id, updates);
    },

    /** Remove an arc point. */
    removeArcPoint: (id) => {
        deleteArcPoint(id);
    },

    // ── Scenes ──

    addScene: ({ title, summary = '', beatId = null, timePosition = null, chapterId = null, orderInChapter = 0, povCharacterId = null, settingId = null, filePath = null }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = insertScene({
            bookId: activeBookId, title, summary, beatId, timePosition,
            chapterId, orderInChapter, povCharacterId, settingId, filePath,
        });
        set({ scenes: getScenesByBook(activeBookId) });
        return id;
    },

    updateSceneById: (id, updates) => {
        const { activeBookId } = get();
        updateScene(id, updates);
        set({ scenes: getScenesByBook(activeBookId) });
    },

    removeScene: (id) => {
        const { activeBookId } = get();
        deleteScene(id);
        set({ scenes: getScenesByBook(activeBookId) });
    },

    /** Link a scene to a scaffold beat. */
    linkSceneToBeatAction: (sceneId, beatId, timePosition = null) => {
        const { activeBookId } = get();
        linkSceneToBeat(sceneId, beatId, timePosition);
        set({ scenes: getScenesByBook(activeBookId) });
    },

    /** Unlink a scene from its beat. */
    unlinkSceneAction: (sceneId) => {
        const { activeBookId } = get();
        unlinkScene(sceneId);
        set({ scenes: getScenesByBook(activeBookId) });
    },

    /** Add a character to a scene. */
    addCharacterToSceneAction: (sceneId, characterId) => {
        addCharacterToScene(sceneId, characterId);
    },

    /** Remove a character from a scene. */
    removeCharacterFromSceneAction: (sceneId, characterId) => {
        removeCharacterFromScene(sceneId, characterId);
    },

    // ── Chapters ──

    addChapter: ({ number, title, filePath = null, notes = '', sortOrder = 0 }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = insertChapter({ bookId: activeBookId, number, title, filePath, notes, sortOrder });
        set({ chapters: getChaptersByBook(activeBookId) });
        return id;
    },

    updateChapterById: (id, updates) => {
        const { activeBookId } = get();
        updateChapter(id, updates);
        set({ chapters: getChaptersByBook(activeBookId) });
    },

    removeChapter: (id) => {
        const { activeBookId } = get();
        deleteChapter(id);
        set({ chapters: getChaptersByBook(activeBookId) });
    },

    // ── Settings (locations/worlds) ──

    addSetting: ({ name, description = '' }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = insertSetting({ bookId: activeBookId, name, description });
        set({ settings: getSettingsByBook(activeBookId) });
        return id;
    },

    updateSettingById: (id, updates) => {
        const { activeBookId } = get();
        updateSetting(id, updates);
        set({ settings: getSettingsByBook(activeBookId) });
    },

    removeSetting: (id) => {
        const { activeBookId } = get();
        deleteSetting(id);
        set({ settings: getSettingsByBook(activeBookId) });
    },

    // ── Analysis ──

    /** Get analysis history for a scene. */
    getSceneSnapshots: (sceneId) => getSnapshotsByScene(sceneId),

    /** Record a new analysis snapshot for a scene. */
    addAnalysisSnapshot: ({ sceneId, scores, source = 'ai' }) => {
        return insertSnapshot({ sceneId, scores, source });
    },

    // ── Aggregate queries ──

    /** Get scenes with full relationship details. */
    getScenesDetailed: () => {
        const { activeBookId } = get();
        if (!activeBookId) return [];
        return getScenesWithDetails(activeBookId);
    },

    /** Get book statistics. */
    getStats: () => {
        const { activeBookId } = get();
        if (!activeBookId) return { sceneCount: 0, chapterCount: 0, characterCount: 0, mappedSceneCount: 0, snapshotCount: 0 };
        return getBookStats(activeBookId);
    },
}));

export default useBookStore;
