import React, { useState, useEffect } from 'react';
import useScriptStore from '../../store/useScriptStore';
import { runScript } from '../../scripts/scriptRunner';
import useFocusTrap from '../../hooks/useFocusTrap';

const BLANK_SCRIPT = {
  name: '',
  description: '',
  context: 'both',
  language: 'js',
  code: `// Available: ctx.readFile(path), ctx.writeFile(path, content),
// ctx.readDir(path), ctx.createFolder(path), ctx.deleteFile(path),
// ctx.getActiveFilePath(), ctx.getActiveFileContent(), ctx.setActiveFileContent(content),
// ctx.log(msg), ctx.warn(msg), ctx.error(msg), ctx.progress(current, total),
// ctx.prompt(msg, default), ctx.confirm(msg), ctx.askAI(prompt, systemPrompt),
// ctx.selectedNode (from right-click context), ctx.refreshFileTree()

`,
};

export default function ScriptEditorDialog({ isOpen, onClose, colors: c }) {
  const userScripts = useScriptStore((s) => s.userScripts);
  const addScript = useScriptStore((s) => s.addScript);
  const updateScript = useScriptStore((s) => s.updateScript);
  const removeScript = useScriptStore((s) => s.removeScript);

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedId(null);
      setDraft(null);
      setDirty(false);
    }
  }, [isOpen]);

  const focusTrapRef = useFocusTrap(isOpen);

  if (!isOpen) return null;

  const selectScript = (script) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setSelectedId(script.id);
    setDraft({ name: script.name, description: script.description || '', context: script.context || 'both', code: script.code || '' });
    setDirty(false);
  };

  const startNew = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setSelectedId('__new__');
    setDraft({ ...BLANK_SCRIPT });
    setDirty(false);
  };

  const updateDraft = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  };

  const save = () => {
    if (!draft.name.trim()) { window.alert('Name is required.'); return; }
    if (selectedId === '__new__') {
      addScript(draft);
    } else {
      updateScript(selectedId, draft);
    }
    setDirty(false);
    // Stay on edited script (for __new__, we can't know new id without reading store again)
    if (selectedId === '__new__') {
      setSelectedId(null);
      setDraft(null);
    }
  };

  const remove = () => {
    if (!window.confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    removeScript(selectedId);
    setSelectedId(null);
    setDraft(null);
    setDirty(false);
  };

  const runCurrent = () => {
    if (dirty) { window.alert('Save changes before running.'); return; }
    const script = userScripts.find((s) => s.id === selectedId);
    if (script) { onClose(); runScript(script); }
  };

  const border = c?.chromeBorder || '#374151';
  const bg = c?.chrome || '#1f2937';
  const text = c?.text || '#e5e7eb';
  const subtext = c?.statusText || '#6b7280';
  const hoverBg = c?.toolbarBtnHoverBg || 'rgba(255,255,255,0.06)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Script Manager"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 8,
          width: 820,
          height: 560,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Script Manager</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: subtext, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: script list */}
          <div style={{ width: 210, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {userScripts.length === 0 && (
                <div style={{ fontSize: 11, color: subtext, padding: '8px 12px', fontStyle: 'italic' }}>No custom scripts yet.</div>
              )}
              {userScripts.map((s) => (
                <div
                  key={s.id}
                  onClick={() => selectScript(s)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    color: selectedId === s.id ? text : subtext,
                    background: selectedId === s.id ? hoverBg : 'transparent',
                    cursor: 'pointer',
                    borderLeft: selectedId === s.id ? '2px solid #7C3AED' : '2px solid transparent',
                    fontWeight: selectedId === s.id ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (selectedId !== s.id) e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={(e) => { if (selectedId !== s.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '(untitled)'}</div>
                  <div style={{ fontSize: 9, color: subtext, marginTop: 1 }}>{s.context || 'both'}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <button
                onClick={startNew}
                style={{ width: '100%', padding: '5px 8px', fontSize: 11, fontWeight: 600, background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
              >
                + New Script
              </button>
            </div>
          </div>

          {/* Right: editor */}
          {draft ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Fields */}
              <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: subtext, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Name</label>
                  <input
                    value={draft.name}
                    onChange={(e) => updateDraft('name', e.target.value)}
                    placeholder="My Script"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: 4, padding: '4px 8px', fontSize: 12, color: text, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '2 1 260px' }}>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: subtext, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Description</label>
                  <input
                    value={draft.description}
                    onChange={(e) => updateDraft('description', e.target.value)}
                    placeholder="What does this script do?"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: 4, padding: '4px 8px', fontSize: 12, color: text, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: subtext, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Context</label>
                  <select
                    value={draft.context}
                    onChange={(e) => updateDraft('context', e.target.value)}
                    style={{ width: '100%', background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '4px 8px', fontSize: 12, color: text, outline: 'none' }}
                  >
                    <option value="both">Both (toolbar)</option>
                    <option value="file">File only</option>
                    <option value="folder">Folder only</option>
                  </select>
                </div>
              </div>

              {/* Code */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '8px 14px 0' }}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: subtext, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Code (JavaScript)</label>
                <textarea
                  value={draft.code}
                  onChange={(e) => updateDraft('code', e.target.value)}
                  spellCheck={false}
                  style={{
                    flex: 1,
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${border}`,
                    borderRadius: 4,
                    padding: '8px 10px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: text,
                    resize: 'none',
                    outline: 'none',
                    lineHeight: 1.6,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {selectedId !== '__new__' && (
                    <button onClick={remove} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid #7f1d1d`, color: '#f87171', borderRadius: 4, cursor: 'pointer' }}>
                      Delete
                    </button>
                  )}
                  {selectedId !== '__new__' && (
                    <button onClick={runCurrent} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${border}`, color: subtext, borderRadius: 4, cursor: 'pointer' }}>
                      ▶ Run
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {dirty && <span style={{ fontSize: 10, color: subtext, fontStyle: 'italic' }}>Unsaved changes</span>}
                  <button onClick={save} style={{ padding: '4px 14px', fontSize: 11, fontWeight: 600, background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: subtext, fontStyle: 'italic' }}>Select a script to edit, or create a new one.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
