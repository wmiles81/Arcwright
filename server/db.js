/**
 * SQLite database wrapper using better-sqlite3.
 *
 * Mirrors the schema and CRUD functions from the browser-side database.js,
 * but runs natively on Node.js — no WASM, no IndexedDB.
 *
 * The database file lives at <dataDir>/arcwright.db.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db = null;

// ---------------------------------------------------------------------------
// ID generation (matches browser-side generateId)
// ---------------------------------------------------------------------------

export function generateId(prefix = '') {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 7);
    return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Schema (identical to browser database.js)
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS series_beats (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    time INTEGER NOT NULL,
    beat TEXT NOT NULL,
    label TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    series_id TEXT REFERENCES series(id),
    series_position INTEGER,
    hook TEXT DEFAULT '',
    premise TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'supporting',
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS character_arc_points (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    dimension_key TEXT NOT NULL,
    time INTEGER NOT NULL,
    value REAL NOT NULL,
    note TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT,
    notes TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    beat_id TEXT,
    time_position INTEGER,
    chapter_id TEXT REFERENCES chapters(id),
    order_in_chapter INTEGER DEFAULT 0,
    pov_character_id TEXT REFERENCES characters(id),
    setting_id TEXT REFERENCES settings(id),
    file_path TEXT,
    revision_count INTEGER DEFAULT 0,
    last_revision_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scene_characters (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (scene_id, character_id)
  );

  CREATE TABLE IF NOT EXISTS analysis_snapshots (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    run_date TEXT DEFAULT (datetime('now')),
    scores_json TEXT DEFAULT '{}',
    source TEXT DEFAULT 'ai'
  );

  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );
`;

const CURRENT_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initDatabase(dataDir) {
    if (db) return db;

    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'arcwright.db');

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Apply schema (IF NOT EXISTS makes this idempotent)
    db.exec(SCHEMA);

    // Track schema version
    const versionRow = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
    if (!versionRow) {
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(CURRENT_SCHEMA_VERSION);
    }
    // Future: add migration logic here when version < CURRENT_SCHEMA_VERSION

    console.log(`[Database] Initialized at ${dbPath}`);
    return db;
}

export function getDb() {
    if (!db) throw new Error('[Database] Not initialized. Call initDatabase() first.');
    return db;
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

// ---------------------------------------------------------------------------
// Series CRUD
// ---------------------------------------------------------------------------

export function getAllSeries() {
    return getDb().prepare('SELECT * FROM series ORDER BY name').all();
}

export function getSeriesById(id) {
    return getDb().prepare('SELECT * FROM series WHERE id = ?').get(id) || null;
}

export function insertSeries({ name, type, notes = '' }) {
    const id = generateId('ser');
    getDb().prepare(
        'INSERT INTO series (id, name, type, notes) VALUES (?, ?, ?, ?)'
    ).run(id, name, type, notes);
    return id;
}

export function updateSeries(id, updates) {
    const allowed = ['name', 'type', 'notes'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    getDb().prepare(`UPDATE series SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteSeries(id) {
    getDb().prepare('DELETE FROM series WHERE id = ?').run(id);
}

// --- Series Beats ---

export function getSeriesBeats(seriesId) {
    return getDb().prepare('SELECT * FROM series_beats WHERE series_id = ? ORDER BY time').all(seriesId);
}

export function insertSeriesBeat({ seriesId, time, beat, label }) {
    const id = generateId('sb');
    getDb().prepare(
        'INSERT INTO series_beats (id, series_id, time, beat, label) VALUES (?, ?, ?, ?, ?)'
    ).run(id, seriesId, time, beat, label);
    return id;
}

export function deleteSeriesBeat(id) {
    getDb().prepare('DELETE FROM series_beats WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Books CRUD
// ---------------------------------------------------------------------------

export function getAllBooks() {
    return getDb().prepare('SELECT * FROM books ORDER BY title').all();
}

export function getBooksBySeriesId(seriesId) {
    return getDb().prepare(
        'SELECT * FROM books WHERE series_id = ? ORDER BY series_position, title'
    ).all(seriesId);
}

export function getBookById(id) {
    return getDb().prepare('SELECT * FROM books WHERE id = ?').get(id) || null;
}

export function getBookByTitle(title) {
    return getDb().prepare('SELECT * FROM books WHERE title = ?').get(title) || null;
}

export function insertBook({ title, seriesId = null, seriesPosition = null, hook = '', premise = '' }) {
    const id = generateId('book');
    getDb().prepare(
        'INSERT INTO books (id, title, series_id, series_position, hook, premise) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, title, seriesId, seriesPosition, hook, premise);
    return id;
}

export function updateBook(id, updates) {
    const allowed = ['title', 'series_id', 'series_position', 'hook', 'premise'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    getDb().prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteBook(id) {
    getDb().prepare('DELETE FROM books WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Characters CRUD
// ---------------------------------------------------------------------------

export function getCharactersByBook(bookId) {
    return getDb().prepare('SELECT * FROM characters WHERE book_id = ? ORDER BY name').all(bookId);
}

export function getCharacterById(id) {
    return getDb().prepare('SELECT * FROM characters WHERE id = ?').get(id) || null;
}

export function insertCharacter({ bookId, name, role = 'supporting', notes = '' }) {
    const id = generateId('char');
    getDb().prepare(
        'INSERT INTO characters (id, book_id, name, role, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(id, bookId, name, role, notes);
    return id;
}

export function updateCharacter(id, updates) {
    const allowed = ['name', 'role', 'notes'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    values.push(id);
    getDb().prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteCharacter(id) {
    getDb().prepare('DELETE FROM characters WHERE id = ?').run(id);
}

// --- Character Arc Points ---

export function getArcPointsByCharacter(characterId) {
    return getDb().prepare(
        'SELECT * FROM character_arc_points WHERE character_id = ? ORDER BY time'
    ).all(characterId);
}

export function insertArcPoint({ characterId, dimensionKey, time, value, note = '' }) {
    const id = generateId('arc');
    getDb().prepare(
        'INSERT INTO character_arc_points (id, character_id, dimension_key, time, value, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, characterId, dimensionKey, time, value, note);
    return id;
}

export function updateArcPoint(id, updates) {
    const allowed = ['dimension_key', 'time', 'value', 'note'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    values.push(id);
    getDb().prepare(`UPDATE character_arc_points SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteArcPoint(id) {
    getDb().prepare('DELETE FROM character_arc_points WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Settings (locations/worlds) CRUD
// ---------------------------------------------------------------------------

export function getSettingsByBook(bookId) {
    return getDb().prepare('SELECT * FROM settings WHERE book_id = ? ORDER BY name').all(bookId);
}

export function insertSetting({ bookId, name, description = '' }) {
    const id = generateId('set');
    getDb().prepare(
        'INSERT INTO settings (id, book_id, name, description) VALUES (?, ?, ?, ?)'
    ).run(id, bookId, name, description);
    return id;
}

export function updateSetting(id, updates) {
    const allowed = ['name', 'description'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    values.push(id);
    getDb().prepare(`UPDATE settings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteSetting(id) {
    getDb().prepare('DELETE FROM settings WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Chapters CRUD
// ---------------------------------------------------------------------------

export function getChaptersByBook(bookId) {
    return getDb().prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY sort_order, number').all(bookId);
}

export function insertChapter({ bookId, number, title, filePath = null, notes = '', sortOrder = 0 }) {
    const id = generateId('ch');
    getDb().prepare(
        'INSERT INTO chapters (id, book_id, number, title, file_path, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, bookId, number, title, filePath, notes, sortOrder);
    return id;
}

export function updateChapter(id, updates) {
    const allowed = ['number', 'title', 'file_path', 'notes', 'sort_order'];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    values.push(id);
    getDb().prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteChapter(id) {
    getDb().prepare('DELETE FROM chapters WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Scenes CRUD
// ---------------------------------------------------------------------------

export function getScenesByBook(bookId) {
    return getDb().prepare(
        'SELECT * FROM scenes WHERE book_id = ? ORDER BY time_position, order_in_chapter'
    ).all(bookId);
}

export function getScenesByChapter(chapterId) {
    return getDb().prepare('SELECT * FROM scenes WHERE chapter_id = ? ORDER BY order_in_chapter').all(chapterId);
}

export function getScenesByBeat(beatId) {
    return getDb().prepare('SELECT * FROM scenes WHERE beat_id = ? ORDER BY time_position').all(beatId);
}

export function getSceneById(id) {
    return getDb().prepare('SELECT * FROM scenes WHERE id = ?').get(id) || null;
}

export function insertScene({
    bookId, title, summary = '', beatId = null, timePosition = null,
    chapterId = null, orderInChapter = 0, povCharacterId = null,
    settingId = null, filePath = null,
}) {
    const id = generateId('sc');
    getDb().prepare(
        `INSERT INTO scenes (id, book_id, title, summary, beat_id, time_position,
     chapter_id, order_in_chapter, pov_character_id, setting_id, file_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, bookId, title, summary, beatId, timePosition, chapterId,
        orderInChapter, povCharacterId, settingId, filePath);
    return id;
}

export function updateScene(id, updates) {
    const allowed = [
        'title', 'summary', 'beat_id', 'time_position', 'chapter_id',
        'order_in_chapter', 'pov_character_id', 'setting_id', 'file_path',
        'revision_count', 'last_revision_path',
    ];
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
        if (allowed.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(val);
        }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    getDb().prepare(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteScene(id) {
    getDb().prepare('DELETE FROM scenes WHERE id = ?').run(id);
}

export function linkSceneToBeat(sceneId, beatId, timePosition = null) {
    const fields = ['beat_id = ?'];
    const values = [beatId];
    if (timePosition !== null) {
        fields.push('time_position = ?');
        values.push(timePosition);
    }
    fields.push("updated_at = datetime('now')");
    values.push(sceneId);
    getDb().prepare(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function unlinkScene(sceneId) {
    getDb().prepare(
        "UPDATE scenes SET beat_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(sceneId);
}

// --- Scene-Character junction ---

export function getCharactersInScene(sceneId) {
    return getDb().prepare(
        `SELECT c.* FROM characters c
     JOIN scene_characters sc ON sc.character_id = c.id
     WHERE sc.scene_id = ?
     ORDER BY c.name`
    ).all(sceneId);
}

export function addCharacterToScene(sceneId, characterId) {
    getDb().prepare(
        'INSERT OR IGNORE INTO scene_characters (scene_id, character_id) VALUES (?, ?)'
    ).run(sceneId, characterId);
}

export function removeCharacterFromScene(sceneId, characterId) {
    getDb().prepare(
        'DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?'
    ).run(sceneId, characterId);
}

// ---------------------------------------------------------------------------
// Analysis Snapshots
// ---------------------------------------------------------------------------

export function getSnapshotsByScene(sceneId) {
    return getDb().prepare(
        'SELECT * FROM analysis_snapshots WHERE scene_id = ? ORDER BY run_date DESC'
    ).all(sceneId).map((row) => ({ ...row, scores: JSON.parse(row.scores_json || '{}') }));
}

export function insertSnapshot({ sceneId, scores, source = 'ai' }) {
    const id = generateId('snap');
    getDb().prepare(
        'INSERT INTO analysis_snapshots (id, scene_id, scores_json, source) VALUES (?, ?, ?, ?)'
    ).run(id, sceneId, JSON.stringify(scores), source);
    return id;
}

export function deleteSnapshot(id) {
    getDb().prepare('DELETE FROM analysis_snapshots WHERE id = ?').run(id);
}
