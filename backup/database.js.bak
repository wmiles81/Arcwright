/**
 * SQLite database service for Arcwright.
 *
 * Uses sql.js (SQLite compiled to WASM) with IndexedDB persistence.
 * Handles structured/relational data: books, series, scenes, characters,
 * chapters, settings, analysis snapshots.
 *
 * Content files (manuscripts, markdown) stay on Arcwrite FS.
 */

import initSqlJs from 'sql.js';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let db = null;
let SQL = null;
let persistTimer = null;
let backupTimer = null;

// Deferred promise so other modules can wait for DB readiness
let _dbReadyResolve;
let _dbReadyReject;
const _dbReadyPromise = new Promise((resolve, reject) => { _dbReadyResolve = resolve; _dbReadyReject = reject; });

/** Await this to ensure the database is initialized before querying. Returns db or null on failure. */
export function waitForDb() { return _dbReadyPromise.catch(() => null); }
let arcwriteHandle = null;

const IDB_NAME = 'arcwright-db';
const IDB_STORE = 'database';
const IDB_KEY = 'main';
const PERSIST_DEBOUNCE_MS = 500;
const BACKUP_DEBOUNCE_MS = 10000; // 10s debounce for file system backup
const BACKUP_FILENAME = 'arcwright.db';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(prefix = '') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA = `
  -- Series
  CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Series Beats (for terminating type)
  CREATE TABLE IF NOT EXISTS series_beats (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    time INTEGER NOT NULL,
    beat TEXT NOT NULL,
    label TEXT NOT NULL
  );

  -- Books
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

  -- Characters
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'supporting',
    notes TEXT DEFAULT ''
  );

  -- Character Arc Points
  CREATE TABLE IF NOT EXISTS character_arc_points (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    dimension_key TEXT NOT NULL,
    time INTEGER NOT NULL,
    value REAL NOT NULL,
    note TEXT DEFAULT ''
  );

  -- Settings (locations/worlds)
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT ''
  );

  -- Chapters (containers)
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT,
    notes TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  -- Scenes (bridge entity)
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

  -- Scene-Character junction
  CREATE TABLE IF NOT EXISTS scene_characters (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (scene_id, character_id)
  );

  -- Analysis Snapshots
  CREATE TABLE IF NOT EXISTS analysis_snapshots (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    run_date TEXT DEFAULT (datetime('now')),
    scores_json TEXT DEFAULT '{}',
    source TEXT DEFAULT 'ai'
  );

  -- Schema version tracking
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );
`;

const CURRENT_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// IndexedDB helpers (low-level persistence layer)
// ---------------------------------------------------------------------------

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB() {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveToIDB(data) {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, IDB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Arcwrite FS backup/restore (portability layer)
// ---------------------------------------------------------------------------

/**
 * Register the Arcwrite directory handle so backups can be written to it.
 * Should be called after the project store initializes the Arcwrite FS.
 */
export function setArcwriteHandle(handle) {
  arcwriteHandle = handle;
  console.log('[Database] Arcwrite handle registered for backups');
}

/**
 * Backup the SQLite database to the Arcwrite FS.
 * Writes the binary to Arcwrite/arcwright.db.
 */
async function backupToArcwrite() {
  if (!db || !arcwriteHandle) return;
  try {
    const data = db.export();
    const fileHandle = await arcwriteHandle.getFileHandle(BACKUP_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    console.log('[Database] Backed up to Arcwrite FS');
  } catch (err) {
    // Silently ignore — the Arcwrite FS may not have permissions yet
    console.warn('[Database] Arcwrite backup failed:', err.message);
  }
}

/**
 * Try to restore the database from the Arcwrite FS backup.
 * Returns a Uint8Array or null.
 */
async function loadFromArcwrite() {
  if (!arcwriteHandle) return null;
  try {
    const fileHandle = await arcwriteHandle.getFileHandle(BACKUP_FILENAME);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    // File doesn't exist yet — that's fine
    return null;
  }
}

/**
 * Schedule a debounced backup to Arcwrite FS.
 * Uses a longer debounce (10s) than IndexedDB to avoid excessive file writes.
 */
function scheduleArcwriteBackup() {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => backupToArcwrite(), BACKUP_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the SQLite database.
 * Loads from IndexedDB if a previous database exists, otherwise creates fresh.
 * Must be called once on app startup before any database operations.
 */
export async function initDatabase() {
  if (db) return db;

  try {
    // Load sql.js WASM - use CDN for the wasm binary
    SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });

    // Try to restore from IndexedDB first
    const saved = await loadFromIDB();
    if (saved) {
      try {
        db = new SQL.Database(new Uint8Array(saved));
        console.log('[Database] Restored from IndexedDB');
      } catch (err) {
        console.warn('[Database] Failed to restore from IndexedDB:', err);
        db = null;
      }
    }

    // Fallback: try Arcwrite FS backup
    if (!db) {
      const fsData = await loadFromArcwrite();
      if (fsData) {
        try {
          db = new SQL.Database(fsData);
          console.log('[Database] Restored from Arcwrite FS backup');
        } catch (err) {
          console.warn('[Database] Failed to restore from Arcwrite FS:', err);
          db = null;
        }
      }
    }

    // Last resort: create fresh
    if (!db) {
      db = new SQL.Database();
      console.log('[Database] Created fresh database');
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON;');

    // Apply schema (IF NOT EXISTS makes this idempotent)
    db.run(SCHEMA);

    // Track schema version
    const versionRows = db.exec('SELECT version FROM schema_version LIMIT 1');
    if (versionRows.length === 0 || versionRows[0].values.length === 0) {
      db.run('INSERT INTO schema_version (version) VALUES (?)', [CURRENT_SCHEMA_VERSION]);
    }
    // Future: add migration logic here when version < CURRENT_SCHEMA_VERSION

    // Force-backup on page close
    window.addEventListener('beforeunload', () => {
      if (backupTimer) clearTimeout(backupTimer);
      backupToArcwrite();
    });

    await persistDb();
    _dbReadyResolve(db);
    return db;
  } catch (err) {
    console.error('[Database] init failed:', err);
    _dbReadyResolve(null);  // Resolve with null so waitForDb() callers don't hang
    return null;
  }
}

/**
 * Get the current database instance. Throws if not initialized.
 */
export function getDb() {
  if (!db) throw new Error('[Database] Not initialized. Call initDatabase() first.');
  return db;
}

/**
 * Persist database to IndexedDB (debounced).
 * Call after every write operation.
 */
export function persistDb() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    if (!db) return;
    try {
      const data = db.export();
      await saveToIDB(data.buffer);
    } catch (err) {
      console.error('[Database] Persistence failed:', err);
    }
    // Also schedule an Arcwrite FS backup (longer debounce)
    scheduleArcwriteBackup();
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Force immediate persistence (for shutdown or critical saves).
 */
export async function persistDbNow() {
  if (persistTimer) clearTimeout(persistTimer);
  if (backupTimer) clearTimeout(backupTimer);
  if (!db) return;
  const data = db.export();
  await saveToIDB(data.buffer);
  await backupToArcwrite();
}

// ---------------------------------------------------------------------------
// Generic query helpers
// ---------------------------------------------------------------------------

/** Run a SELECT and return array of row objects. */
function queryAll(sql, params = []) {
  const result = getDb().exec(sql, params);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

/** Run a SELECT and return first row object or null. */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

/** Run INSERT/UPDATE/DELETE statement. */
function execute(sql, params = []) {
  getDb().run(sql, params);
  persistDb();
}

// ---------------------------------------------------------------------------
// Series CRUD
// ---------------------------------------------------------------------------

export function getAllSeries() {
  return queryAll('SELECT * FROM series ORDER BY name');
}

export function getSeriesById(id) {
  return queryOne('SELECT * FROM series WHERE id = ?', [id]);
}

export function insertSeries({ name, type, notes = '' }) {
  const id = generateId('ser');
  execute(
    'INSERT INTO series (id, name, type, notes) VALUES (?, ?, ?, ?)',
    [id, name, type, notes]
  );
  return id;
}

export function updateSeries(id, updates) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    if (['name', 'type', 'notes'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  execute(`UPDATE series SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteSeries(id) {
  execute('DELETE FROM series WHERE id = ?', [id]);
}

// --- Series Beats ---

export function getSeriesBeats(seriesId) {
  return queryAll('SELECT * FROM series_beats WHERE series_id = ? ORDER BY time', [seriesId]);
}

export function insertSeriesBeat({ seriesId, time, beat, label }) {
  const id = generateId('sb');
  execute(
    'INSERT INTO series_beats (id, series_id, time, beat, label) VALUES (?, ?, ?, ?, ?)',
    [id, seriesId, time, beat, label]
  );
  return id;
}

export function deleteSeriesBeat(id) {
  execute('DELETE FROM series_beats WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Books CRUD
// ---------------------------------------------------------------------------

export function getAllBooks() {
  return queryAll('SELECT * FROM books ORDER BY title');
}

export function getBooksBySeriesId(seriesId) {
  return queryAll(
    'SELECT * FROM books WHERE series_id = ? ORDER BY series_position, title',
    [seriesId]
  );
}

export function getBookById(id) {
  return queryOne('SELECT * FROM books WHERE id = ?', [id]);
}

export function getBookByTitle(title) {
  return queryOne('SELECT * FROM books WHERE title = ?', [title]);
}

export function insertBook({ title, seriesId = null, seriesPosition = null, hook = '', premise = '' }) {
  const id = generateId('book');
  execute(
    'INSERT INTO books (id, title, series_id, series_position, hook, premise) VALUES (?, ?, ?, ?, ?, ?)',
    [id, title, seriesId, seriesPosition, hook, premise]
  );
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
  execute(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteBook(id) {
  execute('DELETE FROM books WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Characters CRUD
// ---------------------------------------------------------------------------

export function getCharactersByBook(bookId) {
  return queryAll('SELECT * FROM characters WHERE book_id = ? ORDER BY name', [bookId]);
}

export function getCharacterById(id) {
  return queryOne('SELECT * FROM characters WHERE id = ?', [id]);
}

export function insertCharacter({ bookId, name, role = 'supporting', notes = '' }) {
  const id = generateId('char');
  execute(
    'INSERT INTO characters (id, book_id, name, role, notes) VALUES (?, ?, ?, ?, ?)',
    [id, bookId, name, role, notes]
  );
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
  execute(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteCharacter(id) {
  execute('DELETE FROM characters WHERE id = ?', [id]);
}

// --- Character Arc Points ---

export function getArcPointsByCharacter(characterId) {
  return queryAll(
    'SELECT * FROM character_arc_points WHERE character_id = ? ORDER BY time',
    [characterId]
  );
}

export function insertArcPoint({ characterId, dimensionKey, time, value, note = '' }) {
  const id = generateId('arc');
  execute(
    'INSERT INTO character_arc_points (id, character_id, dimension_key, time, value, note) VALUES (?, ?, ?, ?, ?, ?)',
    [id, characterId, dimensionKey, time, value, note]
  );
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
  execute(`UPDATE character_arc_points SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteArcPoint(id) {
  execute('DELETE FROM character_arc_points WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Settings (locations/worlds) CRUD
// ---------------------------------------------------------------------------

export function getSettingsByBook(bookId) {
  return queryAll('SELECT * FROM settings WHERE book_id = ? ORDER BY name', [bookId]);
}

export function insertSetting({ bookId, name, description = '' }) {
  const id = generateId('set');
  execute(
    'INSERT INTO settings (id, book_id, name, description) VALUES (?, ?, ?, ?)',
    [id, bookId, name, description]
  );
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
  execute(`UPDATE settings SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteSetting(id) {
  execute('DELETE FROM settings WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Chapters CRUD
// ---------------------------------------------------------------------------

export function getChaptersByBook(bookId) {
  return queryAll('SELECT * FROM chapters WHERE book_id = ? ORDER BY sort_order, number', [bookId]);
}

export function insertChapter({ bookId, number, title, filePath = null, notes = '', sortOrder = 0 }) {
  const id = generateId('ch');
  execute(
    'INSERT INTO chapters (id, book_id, number, title, file_path, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, bookId, number, title, filePath, notes, sortOrder]
  );
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
  execute(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteChapter(id) {
  execute('DELETE FROM chapters WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Scenes CRUD (bridge entity)
// ---------------------------------------------------------------------------

export function getScenesByBook(bookId) {
  return queryAll('SELECT * FROM scenes WHERE book_id = ? ORDER BY time_position, order_in_chapter', [bookId]);
}

export function getScenesByChapter(chapterId) {
  return queryAll('SELECT * FROM scenes WHERE chapter_id = ? ORDER BY order_in_chapter', [chapterId]);
}

export function getScenesByBeat(beatId) {
  return queryAll('SELECT * FROM scenes WHERE beat_id = ? ORDER BY time_position', [beatId]);
}

export function getSceneById(id) {
  return queryOne('SELECT * FROM scenes WHERE id = ?', [id]);
}

export function insertScene({
  bookId, title, summary = '', beatId = null, timePosition = null,
  chapterId = null, orderInChapter = 0, povCharacterId = null,
  settingId = null, filePath = null,
}) {
  const id = generateId('sc');
  execute(
    `INSERT INTO scenes (id, book_id, title, summary, beat_id, time_position,
     chapter_id, order_in_chapter, pov_character_id, setting_id, file_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, bookId, title, summary, beatId, timePosition, chapterId,
      orderInChapter, povCharacterId, settingId, filePath]
  );
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
  execute(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteScene(id) {
  execute('DELETE FROM scenes WHERE id = ?', [id]);
}

/** Link a scene to a scaffold beat. */
export function linkSceneToBeat(sceneId, beatId, timePosition = null) {
  const fields = ['beat_id = ?'];
  const values = [beatId];
  if (timePosition !== null) {
    fields.push('time_position = ?');
    values.push(timePosition);
  }
  fields.push("updated_at = datetime('now')");
  values.push(sceneId);
  execute(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** Unlink a scene from its beat. */
export function unlinkScene(sceneId) {
  execute(
    "UPDATE scenes SET beat_id = NULL, updated_at = datetime('now') WHERE id = ?",
    [sceneId]
  );
}

// --- Scene-Character junction ---

export function getCharactersInScene(sceneId) {
  return queryAll(
    `SELECT c.* FROM characters c
     JOIN scene_characters sc ON sc.character_id = c.id
     WHERE sc.scene_id = ?
     ORDER BY c.name`,
    [sceneId]
  );
}

export function addCharacterToScene(sceneId, characterId) {
  execute(
    'INSERT OR IGNORE INTO scene_characters (scene_id, character_id) VALUES (?, ?)',
    [sceneId, characterId]
  );
}

export function removeCharacterFromScene(sceneId, characterId) {
  execute(
    'DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?',
    [sceneId, characterId]
  );
}

// ---------------------------------------------------------------------------
// Analysis Snapshots
// ---------------------------------------------------------------------------

export function getSnapshotsByScene(sceneId) {
  return queryAll(
    'SELECT * FROM analysis_snapshots WHERE scene_id = ? ORDER BY run_date DESC',
    [sceneId]
  ).map((row) => ({ ...row, scores: JSON.parse(row.scores_json || '{}') }));
}

export function insertSnapshot({ sceneId, scores, source = 'ai' }) {
  const id = generateId('snap');
  execute(
    'INSERT INTO analysis_snapshots (id, scene_id, scores_json, source) VALUES (?, ?, ?, ?)',
    [id, sceneId, JSON.stringify(scores), source]
  );
  return id;
}

export function deleteSnapshot(id) {
  execute('DELETE FROM analysis_snapshots WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Aggregate queries (cross-entity)
// ---------------------------------------------------------------------------

/** Get all scenes for a book with their chapter and character info. */
export function getScenesWithDetails(bookId) {
  return queryAll(
    `SELECT s.*,
            ch.title AS chapter_title,
            ch.number AS chapter_number,
            c.name AS pov_character_name,
            st.name AS setting_name
     FROM scenes s
     LEFT JOIN chapters ch ON s.chapter_id = ch.id
     LEFT JOIN characters c ON s.pov_character_id = c.id
     LEFT JOIN settings st ON s.setting_id = st.id
     WHERE s.book_id = ?
     ORDER BY s.time_position, s.order_in_chapter`,
    [bookId]
  );
}

/** Get book summary statistics. */
export function getBookStats(bookId) {
  const scenes = queryOne('SELECT COUNT(*) as count FROM scenes WHERE book_id = ?', [bookId]);
  const chapters = queryOne('SELECT COUNT(*) as count FROM chapters WHERE book_id = ?', [bookId]);
  const characters = queryOne('SELECT COUNT(*) as count FROM characters WHERE book_id = ?', [bookId]);
  const mappedScenes = queryOne('SELECT COUNT(*) as count FROM scenes WHERE book_id = ? AND beat_id IS NOT NULL', [bookId]);
  const snapshots = queryOne(
    `SELECT COUNT(*) as count FROM analysis_snapshots a
     JOIN scenes s ON a.scene_id = s.id
     WHERE s.book_id = ?`,
    [bookId]
  );
  return {
    sceneCount: scenes?.count || 0,
    chapterCount: chapters?.count || 0,
    characterCount: characters?.count || 0,
    mappedSceneCount: mappedScenes?.count || 0,
    snapshotCount: snapshots?.count || 0,
  };
}
