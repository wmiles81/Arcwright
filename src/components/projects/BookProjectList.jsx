import React, { useState, useRef, useEffect, useCallback } from 'react';
import { confirm } from '../../store/useConfirmStore';
import useProjectStore from '../../store/useProjectStore';
import SeriesManager from './SeriesManager_v3';

export default function BookProjectList({ selected, onSelect, colors: c, isDark }) {
  const bookProjects = useProjectStore((s) => s.bookProjects);
  const [newName, setNewName] = useState('');
  const [allSeries, setAllSeries] = useState([]);
  const [bookRecords, setBookRecords] = useState({}); // { projectName: bookRow }

  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const inputBorder = c.chromeBorder;

  // Load series list and book records when component mounts
  const refreshData = useCallback(async () => {
    try {
      const db = await import('../../services/database');
      const dbInstance = await db.initDatabase();
      if (!dbInstance) return;
      const series = db.getAllSeries();
      setAllSeries(series);
      // Load book records for each project
      const records = {};
      for (const p of bookProjects) {
        const book = db.getBookByTitle(p.name);
        if (book) records[p.name] = book;
      }
      setBookRecords(records);
    } catch { /* db not ready */ }
  }, [bookProjects]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const handleSeriesChange = async (projectName, seriesId) => {
    try {
      const db = await import('../../services/database');
      let book = db.getBookByTitle(projectName);
      if (!book) {
        const id = db.insertBook({ title: projectName });
        book = { id, title: projectName };
      }
      db.updateBook(book.id, {
        series_id: seriesId || null,
        series_position: seriesId ? (bookRecords[projectName]?.series_position || 1) : null,
      });
      refreshData();
    } catch (err) {
      console.error('[BookProjectList] series assignment failed:', err);
    }
  };

  const handlePositionChange = async (projectName, position) => {
    try {
      const db = await import('../../services/database');
      const book = db.getBookByTitle(projectName);
      if (!book) return;
      db.updateBook(book.id, { series_position: parseInt(position, 10) || 1 });
      refreshData();
    } catch (err) {
      console.error('[BookProjectList] position update failed:', err);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (/[^a-zA-Z0-9_ -]/.test(name)) {
      alert('Project name can only contain letters, numbers, spaces, hyphens, and underscores.');
      return;
    }
    if (bookProjects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('A project with that name already exists.');
      return;
    }
    await useProjectStore.getState().createNewBookProject(name);
    setNewName('');
    onSelect(name);
  };

  const handleDelete = async (name) => {
    if (!await confirm(`Delete book project "${name}" and all its files?`)) return;
    await useProjectStore.getState().deleteBookProject(name);
    if (selected === name) onSelect(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
  };

  const getSeriesName = (seriesId) => {
    const s = allSeries.find((x) => x.id === seriesId);
    return s ? s.name : '';
  };

  return (
    <div>
      {/* Project list */}
      <div
        style={{
          border: `1px solid ${inputBorder}`,
          borderRadius: 6,
          maxHeight: 320,
          overflowY: 'auto',
          background: inputBg,
          marginBottom: 12,
        }}
      >
        {bookProjects.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 12, color: c.chromeText, textAlign: 'center' }}>
            No book projects yet. Create one below.
          </div>
        ) : (
          bookProjects.map((p) => {
            const bookRec = bookRecords[p.name];
            const currentSeriesId = bookRec?.series_id || '';
            const currentPos = bookRec?.series_position || '';
            return (
              <div
                key={p.name}
                style={{
                  padding: '6px 12px',
                  background: selected === p.name ? (isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)') : 'transparent',
                  borderLeft: selected === p.name ? '3px solid #7C3AED' : '3px solid transparent',
                  borderBottom: `1px solid ${inputBorder}`,
                }}
              >
                {/* Row 1: project name + delete */}
                <div
                  onClick={() => onSelect(selected === p.name ? null : p.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{'\uD83D\uDCC1'}</span>
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                    {currentSeriesId && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)',
                        color: '#7C3AED',
                        fontWeight: 600,
                      }}>
                        {getSeriesName(currentSeriesId)} #{currentPos}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                    style={{
                      fontSize: 11,
                      color: '#DC2626',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: 0.6,
                      padding: '2px 6px',
                    }}
                    title="Delete project"
                  >
                    {'\u2715'}
                  </button>
                </div>

                {/* Row 2: series assignment (only when selected) */}
                {selected === p.name && allSeries.length > 0 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      paddingLeft: 22,
                    }}
                  >
                    <span style={{ fontSize: 10, color: c.chromeText, whiteSpace: 'nowrap' }}>Series:</span>
                    <select
                      value={currentSeriesId}
                      onChange={(e) => handleSeriesChange(p.name, e.target.value || null)}
                      style={{
                        flex: 1,
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 4,
                        padding: '3px 6px',
                        fontSize: 11,
                        color: c.text,
                        outline: 'none',
                        maxWidth: 180,
                      }}
                    >
                      <option value="">None</option>
                      {allSeries.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {currentSeriesId && (
                      <>
                        <span style={{ fontSize: 10, color: c.chromeText }}>Book #</span>
                        <input
                          type="number"
                          min={1}
                          value={currentPos}
                          onChange={(e) => handlePositionChange(p.name, e.target.value)}
                          style={{
                            width: 42,
                            background: inputBg,
                            border: `1px solid ${inputBorder}`,
                            borderRadius: 4,
                            padding: '3px 6px',
                            fontSize: 11,
                            color: c.text,
                            outline: 'none',
                            textAlign: 'center',
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New project input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New project name..."
          style={{
            flex: 1,
            background: inputBg,
            border: `1px solid ${inputBorder}`,
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: c.text,
            outline: 'none',
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          style={{
            background: '#7C3AED',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: newName.trim() ? 'pointer' : 'not-allowed',
            opacity: newName.trim() ? 1 : 0.5,
          }}
        >
          Create
        </button>
      </div>

      {/* Series Manager */}
      <SeriesManager colors={c} isDark={isDark} onSeriesChanged={refreshData} />
    </div>
  );
}

