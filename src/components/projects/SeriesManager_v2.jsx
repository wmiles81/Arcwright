import React, { useState, useEffect } from 'react';
import useSeriesStore from '../../store/useSeriesStore';
import useProjectStore from '../../store/useProjectStore';
import { ensureDir } from '../../services/arcwriteFS';
import NewSeriesWizard from './NewSeriesWizard';

const SERIES_TYPES = [
    { key: 'trilogy', label: 'Trilogy', desc: '3-book arc' },
    { key: 'saga', label: 'Saga', desc: '5–7 books' },
    { key: 'continuing', label: 'Continuing', desc: 'Open-ended' },
    { key: 'common_world', label: 'Common World', desc: 'Shared world' },
];

export default function SeriesManager({ colors: c, isDark, onSeriesChanged }) {
    const allSeries = useSeriesStore((s) => s.allSeries);
    const loadAllSeries = useSeriesStore((s) => s.loadAllSeries);
    const createSeries = useSeriesStore((s) => s.createSeries);
    const removeSeries = useSeriesStore((s) => s.removeSeries);

    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('trilogy');
    const [expanded, setExpanded] = useState(null);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { initDatabase } = await import('../../services/database');
                const db = await initDatabase();
                if (db) loadAllSeries();
            } catch { /* db not available */ }
        })();
    }, []);

    const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const inputBorder = c.chromeBorder;

    const handleCreate = () => {
        const name = newName.trim();
        if (!name) return;
        if (allSeries.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
            alert('A series with that name already exists.');
            return;
        }
        try {
            createSeries({ name, type: newType });
            setNewName('');
            if (onSeriesChanged) onSeriesChanged();
        } catch (err) {
            console.error('[SeriesManager] create failed:', err);
            alert('Database not available. Please ensure storage is configured.');
        }
    };

    const handleDelete = (id, name) => {
        if (!window.confirm(`Delete series "${name}"? Books will be unlinked but not deleted.`)) return;
        try {
            removeSeries(id);
            if (onSeriesChanged) onSeriesChanged();
        } catch (err) {
            console.error('[SeriesManager] delete failed:', err);
        }
    };

    const handleWizardClose = async () => {
        setShowWizard(false);
        loadAllSeries();
        if (onSeriesChanged) onSeriesChanged();

        // Ensure all series have folders on disk + write missing artifact files
        try {
            const arcwriteHandle = useProjectStore.getState().arcwriteHandle;
            if (arcwriteHandle) {
                const all = useSeriesStore.getState().allSeries;
                console.log('[SeriesManager] Syncing folders for', all.length, 'series');
                for (const s of all) {
                    const seriesDir = await ensureDir(arcwriteHandle, 'projects', 'series', s.name);
                    // Write missing artifact files from notes JSON
                    if (s.notes) {
                        try {
                            const meta = typeof s.notes === 'string' ? JSON.parse(s.notes) : s.notes;
                            // Write market-survey.md if it has survey data
                            if (meta.marketSurvey) {
                                try {
                                    await seriesDir.getFileHandle('market-survey.md');
                                } catch {
                                    // File doesn't exist — create it
                                    const fh = await seriesDir.getFileHandle('market-survey.md', { create: true });
                                    const w = await fh.createWritable();
                                    await w.write(`# Market Survey: ${s.name}\n\n${meta.marketSurvey}`);
                                    await w.close();
                                    console.log(`[SeriesManager] Wrote market-survey.md for "${s.name}"`);
                                }
                            }
                            // Write premises.md if it has premises data
                            if (meta.premises) {
                                try {
                                    await seriesDir.getFileHandle('premises.md');
                                } catch {
                                    const selected = meta.selectedPremise
                                        ? `## Selected Premise\n\n${meta.selectedPremise}\n\n---\n\n`
                                        : '';
                                    const fh = await seriesDir.getFileHandle('premises.md', { create: true });
                                    const w = await fh.createWritable();
                                    await w.write(`# Series Premises: ${s.name}\n\n${selected}## All Premises\n\n${meta.premises}`);
                                    await w.close();
                                    console.log(`[SeriesManager] Wrote premises.md for "${s.name}"`);
                                }
                            }
                        } catch (parseErr) {
                            console.warn(`[SeriesManager] Failed to parse notes for "${s.name}":`, parseErr.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[SeriesManager] folder sync failed:', err.message);
        }
    };

    const typeLabel = (type) => SERIES_TYPES.find((t) => t.key === type)?.label || type;

    // Parse series notes for metadata badge
    const getMetaBadge = (notes) => {
        if (!notes) return null;
        try {
            const meta = JSON.parse(notes);
            if (meta.bookCount) return `${meta.bookCount} books`;
        } catch { /* plain text notes */ }
        return null;
    };

    return (
        <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: c.chromeText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Series
            </h4>

            {/* Series list */}
            <div
                style={{
                    border: `1px solid ${inputBorder}`,
                    borderRadius: 6,
                    background: inputBg,
                    marginBottom: 10,
                }}
            >
                {allSeries.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: 11, color: c.chromeText, textAlign: 'center' }}>
                        No series yet. Create one below or use the wizard.
                    </div>
                ) : (
                    allSeries.map((s) => (
                        <div
                            key={s.id}
                            style={{
                                borderBottom: `1px solid ${inputBorder}`,
                            }}
                        >
                            <div
                                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13 }}>{'\uD83D\uDCDA'}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                                    <span
                                        style={{
                                            fontSize: 9,
                                            padding: '1px 6px',
                                            borderRadius: 4,
                                            background: isDark ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.12)',
                                            color: '#7C3AED',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {typeLabel(s.type)}
                                    </span>
                                    {getMetaBadge(s.notes) && (
                                        <span
                                            style={{
                                                fontSize: 9,
                                                padding: '1px 6px',
                                                borderRadius: 4,
                                                background: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)',
                                                color: '#10B981',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {getMetaBadge(s.notes)}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 10, color: c.chromeText }}>{expanded === s.id ? '\u25B2' : '\u25BC'}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }}
                                        style={{
                                            fontSize: 11,
                                            color: '#DC2626',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            opacity: 0.6,
                                            padding: '2px 4px',
                                        }}
                                        title="Delete series"
                                    >
                                        {'\u2715'}
                                    </button>
                                </div>
                            </div>
                            {expanded === s.id && (
                                <SeriesDetail seriesId={s.id} colors={c} isDark={isDark} />
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create series form + Wizard button */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                    placeholder="Series name..."
                    style={{
                        flex: 1,
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        color: c.text,
                        outline: 'none',
                    }}
                />
                <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    style={{
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 6,
                        padding: '5px 6px',
                        fontSize: 11,
                        color: c.text,
                        outline: 'none',
                    }}
                >
                    {SERIES_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                </select>
                <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    style={{
                        background: '#7C3AED',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: newName.trim() ? 'pointer' : 'not-allowed',
                        opacity: newName.trim() ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                    }}
                >
                    + Series
                </button>
                <button
                    onClick={() => setShowWizard(true)}
                    style={{
                        background: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                    title="Launch the guided series creation wizard with market survey and premise generation"
                >
                    ✨ Wizard
                </button>
            </div>

            {/* Wizard modal */}
            <NewSeriesWizard
                isOpen={showWizard}
                onClose={handleWizardClose}
                colors={c}
                isDark={isDark}
            />
        </div>
    );
}

/** Expanded detail showing wizard metadata + books in a series */
function SeriesDetail({ seriesId, colors: c, isDark }) {
    const [books, setBooks] = useState([]);
    const [meta, setMeta] = useState(null);

    useEffect(() => {
        (async () => {
            const db = await import('../../services/database');
            setBooks(db.getBooksBySeriesId(seriesId));
            const series = db.getSeriesById(seriesId);
            if (series?.notes) {
                try { setMeta(JSON.parse(series.notes)); } catch { /* not JSON */ }
            }
        })();
    }, [seriesId]);

    const tagStyle = {
        fontSize: 9,
        padding: '1px 6px',
        borderRadius: 3,
        fontWeight: 600,
        display: 'inline-block',
    };

    return (
        <div style={{ padding: '6px 12px 10px 36px', fontSize: 11 }}>
            {/* Wizard metadata */}
            {meta && (
                <div style={{ marginBottom: 8 }}>
                    {/* Parameters row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                        {meta.genre && (
                            <span style={{ ...tagStyle, background: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>
                                {meta.genre}{meta.subgenre ? ` → ${meta.subgenre}` : ''}
                            </span>
                        )}
                        {meta.bookCount && (
                            <span style={{ ...tagStyle, background: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.08)', color: '#10B981' }}>
                                {meta.bookCount} books
                            </span>
                        )}
                        {meta.wordsPerBook && (
                            <span style={{ ...tagStyle, background: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)', color: '#3B82F6' }}>
                                {(meta.wordsPerBook / 1000).toFixed(0)}k words/book
                            </span>
                        )}
                        {meta.chaptersPerBook && (
                            <span style={{ ...tagStyle, background: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
                                {meta.chaptersPerBook} ch/book
                            </span>
                        )}
                    </div>

                    {/* Market survey excerpt */}
                    {meta.marketResearch && (
                        <div style={{
                            padding: '6px 10px',
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                            border: `1px solid ${c.chromeBorder}`,
                            borderRadius: 6,
                            marginBottom: 6,
                        }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                                📊 Market Survey
                            </div>
                            <div style={{ fontSize: 10, color: c.chromeText, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>
                                {meta.marketResearch.slice(0, 300)}{meta.marketResearch.length > 300 ? '…' : ''}
                            </div>
                            <div style={{ fontSize: 9, color: '#7C3AED', marginTop: 3, fontStyle: 'italic' }}>
                                Full survey saved in series folder
                            </div>
                        </div>
                    )}

                    {/* Selected premise */}
                    {meta.selectedPremise !== undefined && meta.selectedPremise !== null && meta.premises && (
                        <div style={{
                            padding: '6px 10px',
                            background: isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.04)',
                            border: `1px solid ${c.chromeBorder}`,
                            borderRadius: 6,
                            marginBottom: 6,
                        }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                                ✨ Selected Premise #{meta.selectedPremise + 1}
                            </div>
                            <div style={{ fontSize: 10, color: c.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>
                                {(() => {
                                    // Extract the selected premise from the raw text
                                    const lines = meta.premises.split('\n');
                                    const premiseHeaders = [];
                                    lines.forEach((l, i) => { if (/^\d+[\.\)]/.test(l.trim())) premiseHeaders.push(i); });
                                    const start = premiseHeaders[meta.selectedPremise] || 0;
                                    const end = premiseHeaders[meta.selectedPremise + 1] || lines.length;
                                    return lines.slice(start, end).join('\n').trim().slice(0, 300);
                                })()}
                            </div>
                            <div style={{ fontSize: 9, color: '#7C3AED', marginTop: 3, fontStyle: 'italic' }}>
                                All premises saved in series folder
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Books list */}
            <div style={{ fontSize: 9, fontWeight: 700, color: c.chromeText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Books
            </div>
            {books.length === 0 ? (
                <span style={{ color: c.chromeText, fontStyle: 'italic' }}>
                    No books assigned. Use the dropdown on a book project above to add it.
                </span>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {books.sort((a, b) => (a.series_position || 99) - (b.series_position || 99)).map((b) => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                                borderRadius: 3,
                                padding: '1px 5px',
                                color: c.chromeText,
                            }}>
                                #{b.series_position || '?'}
                            </span>
                            <span style={{ color: c.text }}>{b.title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
