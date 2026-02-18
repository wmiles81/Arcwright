import React, { useState } from 'react';
import useProjectStore from '../../store/useProjectStore';
import { AI_PROJECT_PRESETS } from '../../chat/editPrompts';
import AiProjectEditor from './AiProjectEditor';

export default function AiProjectList({ selected, onSelect, colors: c, isDark }) {
  const aiProjects = useProjectStore((s) => s.aiProjects);
  const [editingProject, setEditingProject] = useState(null); // null | project object | 'new'

  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const inputBorder = c.chromeBorder;

  const allProjects = [
    ...AI_PROJECT_PRESETS.map((p) => ({ ...p, _isPreset: true })),
    ...aiProjects.map((p) => ({ ...p, _isPreset: false })),
  ];

  const handleDelete = async (name) => {
    if (!window.confirm(`Delete AI project "${name}"?`)) return;
    await useProjectStore.getState().deleteAiProject(name);
    if (selected?.name === name) onSelect(null);
  };

  const handleDuplicate = async (preset) => {
    let baseName = `Copy of ${preset.name}`;
    let name = baseName;
    const existingNames = aiProjects.map((p) => (p.name || '').toLowerCase());
    let counter = 2;
    while (existingNames.includes(name.toLowerCase())) {
      name = `${baseName} ${counter}`;
      counter++;
    }
    const newProject = {
      name,
      systemPrompt: preset.systemPrompt,
      files: [...(preset.files || [])],
    };
    await useProjectStore.getState().createAiProject(newProject);
  };

  const handleSave = async (project) => {
    if (editingProject === 'new') {
      const created = await useProjectStore.getState().createAiProject(project);
      if (created) onSelect(created);
    } else {
      await useProjectStore.getState().updateAiProject(project);
      // If this is the currently selected project, update the reference
      if (selected?.name === project.name) {
        onSelect(project);
      }
    }
    setEditingProject(null);
  };

  // Show the editor if in edit/create mode
  if (editingProject) {
    return (
      <AiProjectEditor
        project={editingProject === 'new' ? null : editingProject}
        onSave={handleSave}
        onCancel={() => setEditingProject(null)}
        colors={c}
        isDark={isDark}
        existingNames={[
          ...AI_PROJECT_PRESETS.map((p) => p.name.toLowerCase()),
          ...aiProjects.map((p) => (p.name || '').toLowerCase()),
        ]}
      />
    );
  }

  const isSelected = (p) => {
    if (!selected) return false;
    if (p._isPreset) return selected.isPreset && selected.presetKey === p.presetKey;
    return selected.name === p.name && !selected.isPreset;
  };

  return (
    <div>
      {/* Project list */}
      <div
        style={{
          border: `1px solid ${inputBorder}`,
          borderRadius: 6,
          maxHeight: 300,
          overflowY: 'auto',
          background: inputBg,
          marginBottom: 12,
        }}
      >
        {allProjects.map((p, i) => (
          <div
            key={p._isPreset ? `preset_${p.presetKey}` : p.name}
            onClick={() => onSelect(isSelected(p) ? null : p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              cursor: 'pointer',
              background: isSelected(p) ? (isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)') : 'transparent',
              borderLeft: isSelected(p) ? '3px solid #7C3AED' : '3px solid transparent',
              borderBottom: i < allProjects.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` : 'none',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                {p._isPreset && (
                  <span style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.15)',
                    color: '#7C3AED',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    Preset
                  </span>
                )}
                {!p._isPreset && p.files && p.files.length > 0 && (
                  <span style={{ fontSize: 10, color: c.chromeText }}>
                    {p.files.length} file{p.files.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 11,
                color: c.chromeText,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {(p.systemPrompt || '').substring(0, 80)}{(p.systemPrompt || '').length > 80 ? '...' : ''}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
              {p._isPreset ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(p); }}
                  style={{ fontSize: 10, color: c.chromeText, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                  title="Duplicate as editable project"
                >
                  Duplicate
                </button>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingProject(p); }}
                    style={{ fontSize: 10, color: c.chromeText, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    title="Edit project"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                    style={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', opacity: 0.7 }}
                    title="Delete project"
                  >
                    {'\u2715'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New project button */}
      <button
        onClick={() => setEditingProject('new')}
        style={{
          background: '#7C3AED',
          color: '#fff',
          border: 'none',
          padding: '6px 14px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + New AI Project
      </button>
    </div>
  );
}
