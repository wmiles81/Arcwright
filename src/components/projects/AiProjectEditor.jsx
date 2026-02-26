import React, { useState, useRef } from 'react';
import useProjectStore from '../../store/useProjectStore';
import { walkDirectoryTree, readFileByPath } from '../../services/arcwriteFS';
import { saveHandle } from '../../services/idbHandleStore';

function countTreeFiles(tree) {
  if (!tree) return 0;
  let n = 0;
  for (const e of tree) {
    if (e.type === 'file') n++;
    if (e.children) n += countTreeFiles(e.children);
  }
  return n;
}

/**
 * Create/Edit form for an AI project.
 * Shows inline within the AiProjectList area of the ProjectsDialog.
 */
export default function AiProjectEditor({ project, onSave, onCancel, colors: c, isDark, existingNames }) {
  const isNew = !project;
  const [name, setName] = useState(project?.name || '');
  const [systemPrompt, setSystemPrompt] = useState(project?.systemPrompt || '');
  const [files, setFiles] = useState(project?.files || []);
  const [nameError, setNameError] = useState('');
  // Track folder directory handles in memory for IDB persistence on save
  const folderHandlesRef = useRef({});

  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const inputBorder = c.chromeBorder;

  const validateName = (n) => {
    if (!n.trim()) return 'Name is required';
    if (/[^a-zA-Z0-9_ -]/.test(n)) return 'Only letters, numbers, spaces, hyphens, underscores';
    if (isNew && existingNames.includes(n.trim().toLowerCase())) return 'Name already exists';
    return '';
  };

  const handleNameChange = (val) => {
    setName(val);
    setNameError(validateName(val));
  };

  const handleAddFile = async () => {
    // Use the Arcwrite directory to browse for files
    const arcwriteHandle = useProjectStore.getState().arcwriteHandle;
    if (!arcwriteHandle) {
      alert('Arcwrite storage not connected.');
      return;
    }

    try {
      // Open file picker with multi-select enabled
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        startIn: arcwriteHandle,
      });

      const newFiles = [];
      const duplicates = [];

      for (const fileHandle of fileHandles) {
        // Resolve relative path
        const pathParts = await arcwriteHandle.resolve(fileHandle);
        const relativePath = pathParts ? pathParts.join('/') : fileHandle.name;

        // Check for duplicates
        if (files.some((f) => f.path === relativePath) || newFiles.some((f) => f.path === relativePath)) {
          duplicates.push(relativePath);
          continue;
        }

        // Read and cache file content so it's always available
        let cachedContent = null;
        try {
          const file = await fileHandle.getFile();
          cachedContent = await file.text();
        } catch (readErr) {
          console.warn('[AiProjectEditor] Could not read file content:', readErr.message);
        }

        newFiles.push({ path: relativePath, title: '', description: '', cachedContent, includeMode: 'auto' });
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }

      if (duplicates.length > 0) {
        alert(`${duplicates.length} file(s) already in project:\n${duplicates.join('\n')}`);
      }
    } catch (e) {
      // User cancelled picker — ignore
      if (e.name === 'AbortError') return;
      console.error('[AiProjectEditor] File picker error:', e);
    }
  };

  const handleAddFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read', startIn: 'documents' });
      const folderName = dirHandle.name;

      // Check for duplicates
      if (files.some((f) => f.path === folderName && f.type === 'folder')) {
        alert(`Folder "${folderName}" is already added.`);
        return;
      }

      // Walk the tree
      const fileTree = await walkDirectoryTree(dirHandle);

      // Try to read SKILL.md
      let skillMdContent = null;
      try {
        skillMdContent = await readFileByPath(dirHandle, 'SKILL.md');
      } catch (_) { /* no SKILL.md */ }

      const hasSkill = !!skillMdContent;
      const idbKey = `skillFolder__${(name || 'unnamed').replace(/[^a-zA-Z0-9_-]/g, '_')}__${folderName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      // Store handle in memory for IDB persistence on save
      folderHandlesRef.current[idbKey] = dirHandle;

      const entry = {
        path: folderName,
        type: 'folder',
        title: folderName,
        description: hasSkill ? 'Skill folder (SKILL.md detected)' : 'Reference folder',
        includeMode: hasSkill ? 'skill' : 'auto',
        idbKey,
        fileTree,
        cachedContent: skillMdContent,
      };

      setFiles((prev) => [...prev, entry]);

      // Auto-populate system prompt from SKILL.md
      if (hasSkill) {
        if (!systemPrompt.trim()) {
          setSystemPrompt(skillMdContent);
        } else if (window.confirm('SKILL.md found. Replace current system prompt with its contents?')) {
          setSystemPrompt(skillMdContent);
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('[AiProjectEditor] Folder picker error:', e);
    }
  };

  const updateFile = (index, field, value) => {
    setFiles((prev) => prev.map((f, i) => {
      if (i !== index) return f;
      const updated = { ...f, [field]: value };
      // Switching to reference mode — drop cached content, disk read handles it
      if (field === 'includeMode' && value === 'reference') updated.cachedContent = null;
      return updated;
    }));
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const err = validateName(name);
    if (err) {
      setNameError(err);
      return;
    }

    // Check all non-folder file descriptions are filled
    const missingDesc = files.some((f) => f.type !== 'folder' && !f.description.trim());
    if (missingDesc) {
      alert('All project files must have a description.');
      return;
    }

    // Persist folder handles to IDB
    for (const [idbKey, handle] of Object.entries(folderHandlesRef.current)) {
      await saveHandle(idbKey, handle);
    }

    onSave({
      ...(project || {}),
      name: name.trim(),
      systemPrompt,
      files,
    });
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>
        {isNew ? 'New AI Project' : `Edit: ${project.name}`}
      </h3>

      {/* Project name */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          Project Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={!isNew}
          placeholder="My AI Project"
          style={{
            width: '100%',
            background: inputBg,
            border: `1px solid ${nameError ? '#DC2626' : inputBorder}`,
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: c.text,
            outline: 'none',
            opacity: isNew ? 1 : 0.7,
          }}
        />
        {nameError && (
          <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{nameError}</div>
        )}
      </div>

      {/* System prompt */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          placeholder="You are a helpful assistant that..."
          style={{
            width: '100%',
            background: inputBg,
            border: `1px solid ${inputBorder}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
            color: c.text,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'monospace',
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Project files */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Project Files</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleAddFolder}
              title="Select a skill or reference folder"
              style={{
                fontSize: 11,
                color: '#10B981',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Add Folder
            </button>
            <button
              onClick={handleAddFile}
              title="Select one or more files to add"
              style={{
                fontSize: 11,
                color: '#7C3AED',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Add Files
            </button>
          </div>
        </div>

        {files.length === 0 ? (
          <div style={{
            padding: 12,
            fontSize: 11,
            color: c.chromeText,
            textAlign: 'center',
            border: `1px solid ${inputBorder}`,
            borderRadius: 6,
            background: inputBg,
          }}>
            No files added. Files provide context to the AI via their descriptions.
          </div>
        ) : (
          <div style={{
            border: `1px solid ${inputBorder}`,
            borderRadius: 6,
            background: inputBg,
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 10px',
                  borderBottom: i < files.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: c.chromeText, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.type === 'folder' ? `${f.path}/` : f.path}
                    {f.type === 'folder' && (
                      <span style={{ fontSize: 9, color: '#10B981', marginLeft: 6 }}>
                        {countTreeFiles(f.fileTree)} files
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <select
                      value={f.includeMode || 'auto'}
                      onChange={(e) => updateFile(i, 'includeMode', e.target.value)}
                      title="How this file is included in the AI prompt"
                      style={{
                        fontSize: 10,
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 3,
                        padding: '1px 4px',
                        color: c.text,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="auto">Auto</option>
                      <option value="inline">Inline</option>
                      <option value="reference">Reference</option>
                      <option value="skill">Skill</option>
                    </select>
                    <button
                      onClick={() => removeFile(i)}
                      style={{ fontSize: 10, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}
                    >
                      {'\u2715'}
                    </button>
                  </div>
                </div>
                {f.type !== 'folder' && (
                  <input
                    type="text"
                    value={f.title}
                    onChange={(e) => updateFile(i, 'title', e.target.value)}
                    placeholder="Title (optional)"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: `1px solid ${inputBorder}`,
                      borderRadius: 4,
                      padding: '3px 6px',
                      fontSize: 11,
                      color: c.text,
                      outline: 'none',
                      marginBottom: 3,
                    }}
                  />
                )}
                <input
                  type="text"
                  value={f.description}
                  onChange={(e) => updateFile(i, 'description', e.target.value)}
                  placeholder={f.type === 'folder' ? 'Description (optional)' : 'Description (required) — what this file contains'}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: `1px solid ${f.type !== 'folder' && !f.description.trim() ? '#DC2626' : inputBorder}`,
                    borderRadius: 4,
                    padding: '3px 6px',
                    fontSize: 11,
                    color: c.text,
                    outline: 'none',
                    marginTop: f.type === 'folder' ? 4 : 0,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: c.chromeText,
            border: `1px solid ${c.chromeBorder}`,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!!nameError || !name.trim()}
          style={{
            background: '#7C3AED',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: (nameError || !name.trim()) ? 'not-allowed' : 'pointer',
            opacity: (nameError || !name.trim()) ? 0.5 : 1,
          }}
        >
          {isNew ? 'Create' : 'Save'}
        </button>
      </div>
    </div>
  );
}
