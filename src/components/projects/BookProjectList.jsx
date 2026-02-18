import React, { useState } from 'react';
import useProjectStore from '../../store/useProjectStore';

export default function BookProjectList({ selected, onSelect, colors: c, isDark }) {
  const bookProjects = useProjectStore((s) => s.bookProjects);
  const [newName, setNewName] = useState('');

  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const inputBorder = c.chromeBorder;

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
    if (!window.confirm(`Delete book project "${name}" and all its files?`)) return;
    await useProjectStore.getState().deleteBookProject(name);
    if (selected === name) onSelect(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
  };

  return (
    <div>
      {/* Project list */}
      <div
        style={{
          border: `1px solid ${inputBorder}`,
          borderRadius: 6,
          maxHeight: 260,
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
          bookProjects.map((p) => (
            <div
              key={p.name}
              onClick={() => onSelect(selected === p.name ? null : p.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                cursor: 'pointer',
                background: selected === p.name ? (isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)') : 'transparent',
                borderLeft: selected === p.name ? '3px solid #7C3AED' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{'\uD83D\uDCC1'}</span>
                <span style={{ fontSize: 13 }}>{p.name}</span>
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
          ))
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
    </div>
  );
}
