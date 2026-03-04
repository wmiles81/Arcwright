/**
 * SQLite database service for Arcwright.
 *
 * This module now delegates all operations to the local API server.
 * The export signatures are identical to the original WASM-based version,
 * so stores and components require no changes.
 *
 * Original: sql.js (WASM) + IndexedDB + Arcwrite FS backup
 * Current:  fetch → local Express API → better-sqlite3
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

// ---------------------------------------------------------------------------
// ID generation (still runs client-side for convenience)
// ---------------------------------------------------------------------------

export function generateId(prefix = '') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Database initialization (now a no-op — server handles this)
// ---------------------------------------------------------------------------

let _initDone = false;

export async function initDatabase() {
  _initDone = true;
  console.log('[database] Server-backed mode — no WASM init needed');
}

export async function waitForDb() { return true; }

export function getDb() {
  console.warn('[database] getDb() called — database is server-side now');
  return null;
}

// Persistence is handled server-side — these are no-ops
export function persistDb() { }
export function persistDbNow() { }
export function setArcwriteHandle() { }
export function scheduleArcwriteBackup() { }
export async function backupToArcwrite() { }
export async function loadFromArcwrite() { return null; }

// ---------------------------------------------------------------------------
// Generic query helpers (not available in API mode — use specific functions)
// ---------------------------------------------------------------------------

export function queryAll() {
  throw new Error('[database] queryAll() is not available in server-backed mode. Use specific CRUD functions.');
}
export function queryOne() {
  throw new Error('[database] queryOne() is not available in server-backed mode. Use specific CRUD functions.');
}
export function execute() {
  throw new Error('[database] execute() is not available in server-backed mode. Use specific CRUD functions.');
}

// ---------------------------------------------------------------------------
// Series CRUD
// ---------------------------------------------------------------------------

export async function getAllSeries() {
  return apiGet('/series');
}

export async function getSeriesById(id) {
  return apiGet(`/series/${id}`);
}

export async function insertSeries({ name, type, notes = '' }) {
  const { id } = await apiPost('/series', { name, type, notes });
  return id;
}

export async function updateSeries(id, updates) {
  await apiPut(`/series/${id}`, updates);
}

export async function deleteSeries(id) {
  await apiDelete(`/series/${id}`);
}

// --- Series Beats ---

export async function getSeriesBeats(seriesId) {
  return apiGet(`/series/${seriesId}/beats`);
}

export async function insertSeriesBeat({ seriesId, time, beat, label }) {
  const { id } = await apiPost(`/series/${seriesId}/beats`, { time, beat, label });
  return id;
}

export async function deleteSeriesBeat(id) {
  await apiDelete(`/series-beats/${id}`);
}

// ---------------------------------------------------------------------------
// Books CRUD
// ---------------------------------------------------------------------------

export async function getAllBooks() {
  return apiGet('/books');
}

export async function getBooksBySeriesId(seriesId) {
  return apiGet(`/books/by-series/${seriesId}`);
}

export async function getBookById(id) {
  return apiGet(`/books/${id}`);
}

export async function getBookByTitle(title) {
  return apiGet(`/books/by-title/${encodeURIComponent(title)}`);
}

export async function insertBook({ title, seriesId = null, seriesPosition = null, hook = '', premise = '' }) {
  const { id } = await apiPost('/books', { title, seriesId, seriesPosition, hook, premise });
  return id;
}

export async function updateBook(id, updates) {
  await apiPut(`/books/${id}`, updates);
}

export async function deleteBook(id) {
  await apiDelete(`/books/${id}`);
}

// ---------------------------------------------------------------------------
// Characters CRUD
// ---------------------------------------------------------------------------

export async function getCharactersByBook(bookId) {
  return apiGet(`/characters/by-book/${bookId}`);
}

export async function getCharacterById(id) {
  return apiGet(`/characters/${id}`);
}

export async function insertCharacter({ bookId, name, role = 'supporting', notes = '' }) {
  const { id } = await apiPost('/characters', { bookId, name, role, notes });
  return id;
}

export async function updateCharacter(id, updates) {
  await apiPut(`/characters/${id}`, updates);
}

export async function deleteCharacter(id) {
  await apiDelete(`/characters/${id}`);
}

// --- Character Arc Points ---

export async function getArcPointsByCharacter(characterId) {
  return apiGet(`/arc-points/by-character/${characterId}`);
}

export async function insertArcPoint({ characterId, dimensionKey, time, value, note = '' }) {
  const { id } = await apiPost('/arc-points', { characterId, dimensionKey, time, value, note });
  return id;
}

export async function updateArcPoint(id, updates) {
  await apiPut(`/arc-points/${id}`, updates);
}

export async function deleteArcPoint(id) {
  await apiDelete(`/arc-points/${id}`);
}

// ---------------------------------------------------------------------------
// Settings (locations/worlds) CRUD
// ---------------------------------------------------------------------------

export async function getSettingsByBook(bookId) {
  return apiGet(`/settings-entities/by-book/${bookId}`);
}

export async function insertSetting({ bookId, name, description = '' }) {
  const { id } = await apiPost('/settings-entities', { bookId, name, description });
  return id;
}

export async function updateSetting(id, updates) {
  await apiPut(`/settings-entities/${id}`, updates);
}

export async function deleteSetting(id) {
  await apiDelete(`/settings-entities/${id}`);
}

// ---------------------------------------------------------------------------
// Chapters CRUD
// ---------------------------------------------------------------------------

export async function getChaptersByBook(bookId) {
  return apiGet(`/chapters/by-book/${bookId}`);
}

export async function insertChapter({ bookId, number, title, filePath = null, notes = '', sortOrder = 0 }) {
  const { id } = await apiPost('/chapters', { bookId, number, title, filePath, notes, sortOrder });
  return id;
}

export async function updateChapter(id, updates) {
  await apiPut(`/chapters/${id}`, updates);
}

export async function deleteChapter(id) {
  await apiDelete(`/chapters/${id}`);
}

// ---------------------------------------------------------------------------
// Scenes CRUD
// ---------------------------------------------------------------------------

export async function getScenesByBook(bookId) {
  return apiGet(`/scenes/by-book/${bookId}`);
}

export async function getScenesByChapter(chapterId) {
  return apiGet(`/scenes/by-chapter/${chapterId}`);
}

export async function getScenesByBeat(beatId) {
  return apiGet(`/scenes/by-beat/${beatId}`);
}

export async function getSceneById(id) {
  return apiGet(`/scenes/${id}`);
}

export async function insertScene({
  bookId, title, summary = '', beatId = null, timePosition = null,
  chapterId = null, orderInChapter = 0, povCharacterId = null,
  settingId = null, filePath = null,
}) {
  const { id } = await apiPost('/scenes', {
    bookId, title, summary, beatId, timePosition,
    chapterId, orderInChapter, povCharacterId, settingId, filePath,
  });
  return id;
}

export async function updateScene(id, updates) {
  await apiPut(`/scenes/${id}`, updates);
}

export async function deleteScene(id) {
  await apiDelete(`/scenes/${id}`);
}

export async function linkSceneToBeat(sceneId, beatId, timePosition = null) {
  await apiPut(`/scenes/${sceneId}/link-beat`, { beatId, timePosition });
}

export async function unlinkScene(sceneId) {
  await apiPut(`/scenes/${sceneId}/unlink`, {});
}

// --- Scene-Character junction ---

export async function getCharactersInScene(sceneId) {
  return apiGet(`/scenes/${sceneId}/characters`);
}

export async function addCharacterToScene(sceneId, characterId) {
  await apiPost(`/scenes/${sceneId}/characters/${characterId}`, {});
}

export async function removeCharacterFromScene(sceneId, characterId) {
  await apiDelete(`/scenes/${sceneId}/characters/${characterId}`);
}

// ---------------------------------------------------------------------------
// Analysis Snapshots
// ---------------------------------------------------------------------------

export async function getSnapshotsByScene(sceneId) {
  return apiGet(`/snapshots/by-scene/${sceneId}`);
}

export async function insertSnapshot({ sceneId, scores, source = 'ai' }) {
  const { id } = await apiPost('/snapshots', { sceneId, scores, source });
  return id;
}

export async function deleteSnapshot(id) {
  await apiDelete(`/snapshots/${id}`);
}
