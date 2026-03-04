/**
 * Database REST API routes.
 *
 * Exposes all CRUD operations from server/db.js as HTTP endpoints.
 * Each entity follows the pattern: GET (list/single), POST (create), PUT (update), DELETE.
 */

import { Router } from 'express';
import * as db from '../db.js';

const router = Router();

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

router.get('/series', (_req, res) => {
    res.json(db.getAllSeries());
});

router.get('/series/:id', (req, res) => {
    const row = db.getSeriesById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Series not found' });
    res.json(row);
});

router.post('/series', (req, res) => {
    const id = db.insertSeries(req.body);
    res.status(201).json({ id });
});

router.put('/series/:id', (req, res) => {
    db.updateSeries(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/series/:id', (req, res) => {
    db.deleteSeries(req.params.id);
    res.json({ ok: true });
});

// --- Series Beats ---

router.get('/series/:seriesId/beats', (req, res) => {
    res.json(db.getSeriesBeats(req.params.seriesId));
});

router.post('/series/:seriesId/beats', (req, res) => {
    const id = db.insertSeriesBeat({ seriesId: req.params.seriesId, ...req.body });
    res.status(201).json({ id });
});

router.delete('/series-beats/:id', (req, res) => {
    db.deleteSeriesBeat(req.params.id);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

router.get('/books', (_req, res) => {
    res.json(db.getAllBooks());
});

router.get('/books/by-series/:seriesId', (req, res) => {
    res.json(db.getBooksBySeriesId(req.params.seriesId));
});

router.get('/books/:id', (req, res) => {
    const row = db.getBookById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Book not found' });
    res.json(row);
});

router.get('/books/by-title/:title', (req, res) => {
    const row = db.getBookByTitle(req.params.title);
    if (!row) return res.status(404).json({ error: 'Book not found' });
    res.json(row);
});

router.post('/books', (req, res) => {
    const id = db.insertBook(req.body);
    res.status(201).json({ id });
});

router.put('/books/:id', (req, res) => {
    db.updateBook(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/books/:id', (req, res) => {
    db.deleteBook(req.params.id);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

router.get('/characters/by-book/:bookId', (req, res) => {
    res.json(db.getCharactersByBook(req.params.bookId));
});

router.get('/characters/:id', (req, res) => {
    const row = db.getCharacterById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Character not found' });
    res.json(row);
});

router.post('/characters', (req, res) => {
    const id = db.insertCharacter(req.body);
    res.status(201).json({ id });
});

router.put('/characters/:id', (req, res) => {
    db.updateCharacter(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/characters/:id', (req, res) => {
    db.deleteCharacter(req.params.id);
    res.json({ ok: true });
});

// --- Character Arc Points ---

router.get('/arc-points/by-character/:characterId', (req, res) => {
    res.json(db.getArcPointsByCharacter(req.params.characterId));
});

router.post('/arc-points', (req, res) => {
    const id = db.insertArcPoint(req.body);
    res.status(201).json({ id });
});

router.put('/arc-points/:id', (req, res) => {
    db.updateArcPoint(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/arc-points/:id', (req, res) => {
    db.deleteArcPoint(req.params.id);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Settings (locations/worlds)
// ---------------------------------------------------------------------------

router.get('/settings-entities/by-book/:bookId', (req, res) => {
    res.json(db.getSettingsByBook(req.params.bookId));
});

router.post('/settings-entities', (req, res) => {
    const id = db.insertSetting(req.body);
    res.status(201).json({ id });
});

router.put('/settings-entities/:id', (req, res) => {
    db.updateSetting(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/settings-entities/:id', (req, res) => {
    db.deleteSetting(req.params.id);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

router.get('/chapters/by-book/:bookId', (req, res) => {
    res.json(db.getChaptersByBook(req.params.bookId));
});

router.post('/chapters', (req, res) => {
    const id = db.insertChapter(req.body);
    res.status(201).json({ id });
});

router.put('/chapters/:id', (req, res) => {
    db.updateChapter(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/chapters/:id', (req, res) => {
    db.deleteChapter(req.params.id);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

router.get('/scenes/by-book/:bookId', (req, res) => {
    res.json(db.getScenesByBook(req.params.bookId));
});

router.get('/scenes/by-chapter/:chapterId', (req, res) => {
    res.json(db.getScenesByChapter(req.params.chapterId));
});

router.get('/scenes/by-beat/:beatId', (req, res) => {
    res.json(db.getScenesByBeat(req.params.beatId));
});

router.get('/scenes/:id', (req, res) => {
    const row = db.getSceneById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Scene not found' });
    res.json(row);
});

router.post('/scenes', (req, res) => {
    const id = db.insertScene(req.body);
    res.status(201).json({ id });
});

router.put('/scenes/:id', (req, res) => {
    db.updateScene(req.params.id, req.body);
    res.json({ ok: true });
});

router.delete('/scenes/:id', (req, res) => {
    db.deleteScene(req.params.id);
    res.json({ ok: true });
});

router.put('/scenes/:id/link-beat', (req, res) => {
    const { beatId, timePosition } = req.body;
    db.linkSceneToBeat(req.params.id, beatId, timePosition);
    res.json({ ok: true });
});

router.put('/scenes/:id/unlink', (req, res) => {
    db.unlinkScene(req.params.id);
    res.json({ ok: true });
});

// --- Scene-Character junction ---

router.get('/scenes/:sceneId/characters', (req, res) => {
    res.json(db.getCharactersInScene(req.params.sceneId));
});

router.post('/scenes/:sceneId/characters/:characterId', (req, res) => {
    db.addCharacterToScene(req.params.sceneId, req.params.characterId);
    res.status(201).json({ ok: true });
});

router.delete('/scenes/:sceneId/characters/:characterId', (req, res) => {
    db.removeCharacterFromScene(req.params.sceneId, req.params.characterId);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Analysis Snapshots
// ---------------------------------------------------------------------------

router.get('/snapshots/by-scene/:sceneId', (req, res) => {
    res.json(db.getSnapshotsByScene(req.params.sceneId));
});

router.post('/snapshots', (req, res) => {
    const id = db.insertSnapshot(req.body);
    res.status(201).json({ id });
});

router.delete('/snapshots/:id', (req, res) => {
    db.deleteSnapshot(req.params.id);
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Aggregate queries
// ---------------------------------------------------------------------------

router.get('/books/:bookId/scenes/detailed', (req, res) => {
    res.json(db.getScenesWithDetails(req.params.bookId));
});

router.get('/books/:bookId/stats', (req, res) => {
    res.json(db.getBookStats(req.params.bookId));
});

export default router;
