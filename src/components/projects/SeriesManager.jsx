import React, { useState, useEffect, useRef } from 'react';
import { confirm } from '../../store/useConfirmStore';
import useSeriesStore from '../../store/useSeriesStore';

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

    useEffect(() => {
        (async () => {
            try {
                const { waitForDb } = await import('../../services/database');
                const db = await waitForDb();
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

    const handleDelete = async (id, name) => {
        if (!await confirm(`Delete series "${name}"? Books will be unlinked but not deleted.`)) return;
        try {
            removeSeries(id);
            if (onSeriesChanged) onSeriesChanged();
        } catch (err) {
            console.error('[SeriesManager] delete failed:', err);
        }
    };

    const typeLabel = (type) => SERIES_TYPES.find((t) => t.key === type)?.label || type;

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
                        No series yet. Create one below to link books.
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

            {/* Create series form */}
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
            </div>
        </div>
    );
}

/** Expanded detail showing books in a series */
function SeriesDetail({ seriesId, colors: c, isDark }) {
    const [books, setBooks] = useState([]);

    useEffect(() => {
        (async () => {
            const { getBooksBySeriesId } = await import('../../services/database');
            setBooks(getBooksBySeriesId(seriesId));
        })();
    }, [seriesId]);

    return (
        <div style={{ padding: '4px 12px 8px 36px', fontSize: 11 }}>
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
