/**
 * Zustand store for Book entities.
 *
 * Reads from / writes to the local Express API (better-sqlite3) via database.js.
 * Holds the active book's characters, scenes, chapters, settings in memory
 * for fast React access, with every mutation persisted server-side.
 *
 * All database helpers are async (REST), so every method that touches them
 * is async and awaits the underlying call before calling `set(...)`.
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
    activeBook: null,

    // --- Entity arrays for active book ---
    characters: [],
    scenes: [],
    chapters: [],
    settings: [],

    // --- Loading state ---
    isLoading: false,

    // ── Book lifecycle ──

    loadBook: async (bookId) => {
        set({ isLoading: true });
        try {
            const book = await getBookById(bookId);
            if (!book) {
                set({ activeBookId: null, activeBook: null, characters: [], scenes: [], chapters: [], settings: [], isLoading: false });
                return;
            }
            const [bookCharacters, bookScenes, bookChapters, bookSettings] = await Promise.all([
                getCharactersByBook(bookId),
                getScenesByBook(bookId),
                getChaptersByBook(bookId),
                getSettingsByBook(bookId),
            ]);
            set({
                activeBookId: bookId,
                activeBook: book,
                characters: bookCharacters || [],
                scenes: bookScenes || [],
                chapters: bookChapters || [],
                settings: bookSettings || [],
                isLoading: false,
            });
        } catch (err) {
            console.error('[BookStore] Failed to load book:', err);
            set({ isLoading: false });
        }
    },

    loadBookByTitle: async (title) => {
        const { waitForDb } = await import('../services/database');
        const dbInstance = await waitForDb();
        if (!dbInstance) {
            console.warn('[BookStore] Database not available, skipping loadBookByTitle');
            return;
        }
        const book = await getBookByTitle(title);
        if (book) {
            await get().loadBook(book.id);
        } else {
            const id = await insertBook({ title });
            await get().loadBook(id);
        }
    },

    createBook: async ({ title, seriesId = null, seriesPosition = null, hook = '', premise = '' }) => {
        const id = await insertBook({ title, seriesId, seriesPosition, hook, premise });
        await get().loadBook(id);
        return id;
    },

    updateActiveBook: async (updates) => {
        const { activeBookId, activeBook } = get();
        if (!activeBookId) return;
        await updateBook(activeBookId, updates);
        set({ activeBook: { ...activeBook, ...updates } });
    },

    clearBook: () => {
        set({ activeBookId: null, activeBook: null, characters: [], scenes: [], chapters: [], settings: [] });
    },

    listBooks: async () => getAllBooks(),

    // ── Characters ──

    addCharacter: async ({ name, role = 'supporting', notes = '' }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = await insertCharacter({ bookId: activeBookId, name, role, notes });
        const characters = await getCharactersByBook(activeBookId);
        set({ characters: characters || [] });
        return id;
    },

    updateCharacterById: async (id, updates) => {
        const { activeBookId } = get();
        await updateCharacter(id, updates);
        const characters = await getCharactersByBook(activeBookId);
        set({ characters: characters || [] });
    },

    removeCharacter: async (id) => {
        const { activeBookId } = get();
        await deleteCharacter(id);
        const characters = await getCharactersByBook(activeBookId);
        set({ characters: characters || [] });
    },

    // ── Character Arc Points ──

    getCharacterArcPoints: async (characterId) => getArcPointsByCharacter(characterId),

    addArcPoint: async ({ characterId, dimensionKey, time, value, note = '' }) => {
        return insertArcPoint({ characterId, dimensionKey, time, value, note });
    },

    updateArcPointById: async (id, updates) => {
        await updateArcPoint(id, updates);
    },

    removeArcPoint: async (id) => {
        await deleteArcPoint(id);
    },

    // ── Scenes ──

    addScene: async ({ title, summary = '', beatId = null, timePosition = null, chapterId = null, orderInChapter = 0, povCharacterId = null, settingId = null, filePath = null }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = await insertScene({
            bookId: activeBookId, title, summary, beatId, timePosition,
            chapterId, orderInChapter, povCharacterId, settingId, filePath,
        });
        const scenes = await getScenesByBook(activeBookId);
        set({ scenes: scenes || [] });
        return id;
    },

    updateSceneById: async (id, updates) => {
        const { activeBookId } = get();
        await updateScene(id, updates);
        const scenes = await getScenesByBook(activeBookId);
        set({ scenes: scenes || [] });
    },

    removeScene: async (id) => {
        const { activeBookId } = get();
        await deleteScene(id);
        const scenes = await getScenesByBook(activeBookId);
        set({ scenes: scenes || [] });
    },

    linkSceneToBeatAction: async (sceneId, beatId, timePosition = null) => {
        const { activeBookId } = get();
        await linkSceneToBeat(sceneId, beatId, timePosition);
        const scenes = await getScenesByBook(activeBookId);
        set({ scenes: scenes || [] });
    },

    unlinkSceneAction: async (sceneId) => {
        const { activeBookId } = get();
        await unlinkScene(sceneId);
        const scenes = await getScenesByBook(activeBookId);
        set({ scenes: scenes || [] });
    },

    addCharacterToSceneAction: async (sceneId, characterId) => {
        await addCharacterToScene(sceneId, characterId);
    },

    removeCharacterFromSceneAction: async (sceneId, characterId) => {
        await removeCharacterFromScene(sceneId, characterId);
    },

    // ── Chapters ──

    addChapter: async ({ number, title, filePath = null, notes = '', sortOrder = 0 }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = await insertChapter({ bookId: activeBookId, number, title, filePath, notes, sortOrder });
        const chapters = await getChaptersByBook(activeBookId);
        set({ chapters: chapters || [] });
        return id;
    },

    updateChapterById: async (id, updates) => {
        const { activeBookId } = get();
        await updateChapter(id, updates);
        const chapters = await getChaptersByBook(activeBookId);
        set({ chapters: chapters || [] });
    },

    removeChapter: async (id) => {
        const { activeBookId } = get();
        await deleteChapter(id);
        const chapters = await getChaptersByBook(activeBookId);
        set({ chapters: chapters || [] });
    },

    // ── Settings (locations/worlds) ──

    addSetting: async ({ name, description = '' }) => {
        const { activeBookId } = get();
        if (!activeBookId) return null;
        const id = await insertSetting({ bookId: activeBookId, name, description });
        const settings = await getSettingsByBook(activeBookId);
        set({ settings: settings || [] });
        return id;
    },

    updateSettingById: async (id, updates) => {
        const { activeBookId } = get();
        await updateSetting(id, updates);
        const settings = await getSettingsByBook(activeBookId);
        set({ settings: settings || [] });
    },

    removeSetting: async (id) => {
        const { activeBookId } = get();
        await deleteSetting(id);
        const settings = await getSettingsByBook(activeBookId);
        set({ settings: settings || [] });
    },

    // ── Analysis ──

    getSceneSnapshots: async (sceneId) => getSnapshotsByScene(sceneId),

    addAnalysisSnapshot: async ({ sceneId, scores, source = 'ai' }) => {
        return insertSnapshot({ sceneId, scores, source });
    },

    // ── Aggregate queries ──

    getScenesDetailed: async () => {
        const { activeBookId } = get();
        if (!activeBookId) return [];
        return getScenesWithDetails(activeBookId);
    },

    getStats: async () => {
        const { activeBookId } = get();
        if (!activeBookId) return { sceneCount: 0, chapterCount: 0, characterCount: 0, mappedSceneCount: 0, snapshotCount: 0 };
        return getBookStats(activeBookId);
    },
}));

export default useBookStore;
