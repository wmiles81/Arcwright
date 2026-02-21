import React, { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import useProjectStore from '../../store/useProjectStore';
import { callCompletionWithProvider } from '../../api/providerAdapter';

// ── Filesystem helpers ──

async function scanStyleLibrary(arcwriteHandle) {
  const voices = [];
  try {
    const libDir = await arcwriteHandle.getDirectoryHandle('style-library');
    for await (const [name, handle] of libDir.entries()) {
      if (handle.kind === 'directory') {
        for await (const [fname, fh] of handle.entries()) {
          if (fh.kind === 'file' && fname.endsWith('.md')) {
            const content = await (await fh.getFile()).text();
            voices.push({ path: `${name}/${fname}`, genre: name, name: fname.replace(/\.md$/, ''), content });
          }
        }
      } else if (handle.kind === 'file' && name.endsWith('.md')) {
        const content = await (await handle.getFile()).text();
        voices.push({ path: name, genre: '', name: name.replace(/\.md$/, ''), content });
      }
    }
  } catch (e) {
    if (e.name !== 'NotFoundError') throw e;
  }
  return voices;
}

async function writeVoiceFile(arcwriteHandle, path, content) {
  const parts = path.split('/');
  const filename = parts.pop();
  const libDir = await arcwriteHandle.getDirectoryHandle('style-library', { create: true });
  let dir = libDir;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fh = await dir.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
}

async function deleteVoiceFile(arcwriteHandle, path) {
  const parts = path.split('/');
  const filename = parts.pop();
  const libDir = await arcwriteHandle.getDirectoryHandle('style-library');
  let dir = libDir;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  await dir.removeEntry(filename);
}

const ANALYSIS_SYSTEM_PROMPT = `You are a literary voice analyst. Analyze the provided prose sample and produce a structured voice style guide that an AI writing model can use as a reference to match this author's voice.

Output a markdown document with these sections:

## Voice Signature
POV, tense, narrator tone, primary characteristics — 2-3 sentences.

## Sentence Rhythm
Dominant patterns. Include direct quoted examples from the text using blockquotes.

## Internal Voice
How the narrator's thoughts are expressed. Include examples.

## What Draws the Reader In
The emotional and structural hooks specific to this voice.

## Dialogue
How characters speak. Subtext vs. explicit text. Include examples.

## Sentence-Level Patterns
Recurring techniques — catalogue lists, action through objects, naming conventions, etc. Include examples.

## What to Avoid
Anti-patterns that would break this voice. Be specific (4–6 items).

Rules:
- Use blockquotes (>) for examples pulled directly from the provided text.
- Be practical and specific, not academic.
- Do not summarize the plot or characters — focus entirely on craft and technique.
- This guide will be fed directly to an AI model to write in this style.`;

// ── Component ──

async function loadGenderMechanics(arcwriteHandle, gender) {
  const dir = await arcwriteHandle.getDirectoryHandle('gender-mechanics');
  const fh = await dir.getFileHandle(`${gender}.md`);
  return (await fh.getFile()).text();
}

export default function VoiceTab({ colors: c }) {
  const arcwriteHandle = useProjectStore((s) => s.arcwriteHandle);
  const activePath = useAppStore((s) => s.chatSettings.activeVoicePath);
  const activeGender = useAppStore((s) => s.chatSettings.activeNarratorGender);

  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genderLoading, setGenderLoading] = useState(false);
  const [genderError, setGenderError] = useState(null);

  // Edit state
  const [editingPath, setEditingPath] = useState(null);
  const [editContent, setEditContent] = useState('');

  // Add state
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState('sample'); // 'sample' | 'guide'
  const [sampleText, setSampleText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [newGenre, setNewGenre] = useState('');
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  const resetAddForm = () => {
    setAdding(false);
    setAddMode('sample');
    setSampleText('');
    setNewGenre('');
    setNewName('');
    setNewContent('');
    setError(null);
  };

  const loadVoices = useCallback(async () => {
    if (!arcwriteHandle) return;
    setLoading(true);
    setError(null);
    try {
      const found = await scanStyleLibrary(arcwriteHandle);
      setVoices(found);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [arcwriteHandle]);

  useEffect(() => { loadVoices(); }, [loadVoices]);

  const handleSelect = (voice) => {
    useAppStore.getState().updateChatSettings({
      activeVoicePath: voice.path,
      activeVoiceContent: voice.content,
    });
  };

  const handleDeselect = () => {
    useAppStore.getState().updateChatSettings({
      activeVoicePath: null,
      activeVoiceContent: '',
    });
  };

  const handleEditStart = (voice) => {
    setEditingPath(voice.path);
    setEditContent(voice.content);
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      await writeVoiceFile(arcwriteHandle, editingPath, editContent);
      setVoices((prev) => prev.map((v) => v.path === editingPath ? { ...v, content: editContent } : v));
      if (activePath === editingPath) {
        useAppStore.getState().updateChatSettings({ activeVoiceContent: editContent });
      }
      setEditingPath(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (voice) => {
    if (!window.confirm(`Delete "${voice.path}"?`)) return;
    try {
      await deleteVoiceFile(arcwriteHandle, voice.path);
      setVoices((prev) => prev.filter((v) => v.path !== voice.path));
      if (activePath === voice.path) {
        useAppStore.getState().updateChatSettings({ activeVoicePath: null, activeVoiceContent: '' });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleGenderSelect = async (gender) => {
    setGenderError(null);
    if (!gender) {
      useAppStore.getState().updateChatSettings({ activeNarratorGender: null, activeGenderMechanicsContent: '' });
      return;
    }
    setGenderLoading(true);
    try {
      const content = await loadGenderMechanics(arcwriteHandle, gender);
      useAppStore.getState().updateChatSettings({ activeNarratorGender: gender, activeGenderMechanicsContent: content });
    } catch (e) {
      if (e.name === 'NotFoundError') {
        setGenderError(`gender-mechanics/${gender}.md not found. Copy your mechanics file to Arcwrite/gender-mechanics/${gender}.md`);
      } else {
        setGenderError(e.message);
      }
      useAppStore.getState().updateChatSettings({ activeNarratorGender: gender, activeGenderMechanicsContent: '' });
    } finally {
      setGenderLoading(false);
    }
  };

  const handleAnalyzeSample = async () => {
    if (!sampleText.trim()) return;
    const app = useAppStore.getState();
    setAnalyzing(true);
    setError(null);
    try {
      const result = await callCompletionWithProvider(
        app.activeProvider,
        ANALYSIS_SYSTEM_PROMPT,
        `Analyze this prose sample and produce the voice style guide:\n\n${sampleText}`,
        { maxTokens: 2048 }
      );
      setNewContent(result);
      setAddMode('guide');
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddSave = async () => {
    const genre = newGenre.trim().replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').toLowerCase();
    const name = newName.trim().replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').toLowerCase();
    if (!genre || !name) return;
    const path = `${genre}/${name}.md`;
    if (voices.find((v) => v.path === path)) {
      setError(`A voice at "${path}" already exists.`);
      return;
    }
    setSaving(true);
    try {
      await writeVoiceFile(arcwriteHandle, path, newContent);
      setVoices((prev) => [...prev, { path, genre, name, content: newContent }]);
      resetAddForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    padding: '5px 8px',
    fontSize: 12,
    background: c.bg,
    color: c.text,
    border: `1px solid ${c.chromeBorder}`,
    borderRadius: 5,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const btnStyle = (variant = 'default') => ({
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 5,
    border: 'none',
    cursor: 'pointer',
    background: variant === 'primary' ? '#7C3AED'
      : variant === 'danger' ? 'transparent'
      : 'transparent',
    color: variant === 'primary' ? '#fff'
      : variant === 'danger' ? '#EF4444'
      : c.chromeText,
  });

  if (!arcwriteHandle) {
    return (
      <div style={{ color: c.chromeText, fontSize: 13, padding: '8px 0' }}>
        Open an Arcwrite storage folder to manage voice profiles.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>Voice Profiles</div>
          <div style={{ fontSize: 10, color: c.chromeText, marginTop: 2 }}>
            Stored in Arcwrite/style-library/. Active voice is injected into every chat prompt.
          </div>
        </div>
        <button
          onClick={() => { setAdding(true); setEditingPath(null); }}
          disabled={adding}
          style={{ ...btnStyle('primary'), padding: '5px 12px', fontSize: 12 }}
        >
          + Add
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 10, padding: '6px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 5 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ color: c.chromeText, fontSize: 12 }}>Loading…</div>}

      {!loading && voices.length === 0 && !adding && (
        <div style={{ color: c.chromeText, fontSize: 12, fontStyle: 'italic' }}>
          No voice profiles yet. Click + Add to create one.
        </div>
      )}

      {/* Voice list */}
      {voices.map((voice) => {
        const isActive = activePath === voice.path;
        const isEditing = editingPath === voice.path;

        return (
          <div
            key={voice.path}
            style={{
              marginBottom: 8,
              border: `1px solid ${isActive ? '#7C3AED' : c.chromeBorder}`,
              borderRadius: 7,
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              background: isActive ? 'rgba(124,58,237,0.06)' : c.bg,
            }}>
              <span style={{ fontSize: 14, color: isActive ? '#7C3AED' : c.chromeBorder, flexShrink: 0 }}>
                {isActive ? '●' : '○'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>
                  {voice.genre ? `${voice.genre} / ` : ''}
                </span>
                <span style={{ fontSize: 12, color: c.text }}>{voice.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {isActive ? (
                  <button onClick={handleDeselect} style={btnStyle()}>Deactivate</button>
                ) : (
                  <button onClick={() => handleSelect(voice)} style={{ ...btnStyle(), color: '#7C3AED' }}>Set Active</button>
                )}
                <button
                  onClick={() => isEditing ? setEditingPath(null) : handleEditStart(voice)}
                  style={btnStyle()}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => handleDelete(voice)} style={btnStyle('danger')}>Delete</button>
              </div>
            </div>

            {isEditing && (
              <div style={{ padding: '8px 10px', borderTop: `1px solid ${c.chromeBorder}`, background: c.chrome }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={14}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <button onClick={handleEditSave} disabled={saving} style={{ ...btnStyle('primary'), padding: '5px 14px' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Narrator Gender */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${c.chromeBorder}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 2 }}>Narrator Gender</div>
        <div style={{ fontSize: 10, color: c.chromeText, marginBottom: 10 }}>
          Overlays gender-specific narration mechanics from Arcwrite/gender-mechanics/. Additive — does not replace the active voice guide.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[null, 'female', 'male'].map((g) => {
            const label = g === null ? 'None' : g === 'female' ? 'Female narrator' : 'Male narrator';
            const isActive = activeGender === g;
            return (
              <button
                key={String(g)}
                onClick={() => handleGenderSelect(g)}
                disabled={genderLoading}
                style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: `1px solid ${isActive ? '#7C3AED' : c.chromeBorder}`,
                  background: isActive ? 'rgba(124,58,237,0.10)' : 'transparent',
                  color: isActive ? '#7C3AED' : c.chromeText,
                  cursor: genderLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                {label}
              </button>
            );
          })}
          {genderLoading && <span style={{ fontSize: 11, color: c.chromeText, alignSelf: 'center' }}>Loading…</span>}
        </div>
        {activeGender && !genderError && useAppStore.getState().chatSettings.activeGenderMechanicsContent && (
          <div style={{ fontSize: 10, color: '#10B981', marginTop: 6 }}>
            {activeGender === 'female' ? 'Female' : 'Male'} mechanics loaded.
          </div>
        )}
        {genderError && (
          <div style={{ fontSize: 10, color: '#EF4444', marginTop: 6 }}>{genderError}</div>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ border: `1px solid ${c.chromeBorder}`, borderRadius: 7, overflow: 'hidden', marginTop: 4 }}>

          {/* Add form header with mode toggle */}
          <div style={{
            padding: '7px 10px',
            background: c.bg,
            borderBottom: `1px solid ${c.chromeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>New Voice Profile</span>
            <div style={{ display: 'flex', gap: 2, background: c.chrome, borderRadius: 5, padding: 2, border: `1px solid ${c.chromeBorder}` }}>
              {['sample', 'guide'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAddMode(mode)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: addMode === mode ? '#7C3AED' : 'transparent',
                    color: addMode === mode ? '#fff' : c.chromeText,
                    transition: 'background 0.1s',
                  }}
                >
                  {mode === 'sample' ? 'Analyze Sample' : 'Paste Guide'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '10px', background: c.chrome }}>

            {/* Name fields — always visible */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: c.chromeText, display: 'block', marginBottom: 3 }}>
                  GENRE (folder name)
                </label>
                <input
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder="dark-romance"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: c.chromeText, display: 'block', marginBottom: 3 }}>
                  NAME (filename)
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="working-class-grit"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Analyze Sample mode */}
            {addMode === 'sample' && (
              <>
                <label style={{ fontSize: 10, fontWeight: 600, color: c.chromeText, display: 'block', marginBottom: 3 }}>
                  PROSE SAMPLE
                </label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  rows={14}
                  placeholder="Paste 500–3000 words of your prose here. The AI will extract voice characteristics and produce a structured style guide."
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                  <button onClick={resetAddForm} style={{ ...btnStyle(), border: `1px solid ${c.chromeBorder}` }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleAnalyzeSample}
                    disabled={analyzing || !sampleText.trim() || !newGenre.trim() || !newName.trim()}
                    style={{ ...btnStyle('primary'), padding: '5px 14px' }}
                  >
                    {analyzing ? 'Analyzing…' : 'Analyze →'}
                  </button>
                </div>
                {analyzing && (
                  <div style={{ fontSize: 10, color: c.chromeText, marginTop: 6, textAlign: 'right' }}>
                    Extracting voice characteristics…
                  </div>
                )}
              </>
            )}

            {/* Paste Guide mode */}
            {addMode === 'guide' && (
              <>
                <label style={{ fontSize: 10, fontWeight: 600, color: c.chromeText, display: 'block', marginBottom: 3 }}>
                  {newContent ? 'GENERATED GUIDE (review and edit)' : 'CONTENT'}
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={14}
                  placeholder="Paste your style guide or voice reference here…"
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                  <button onClick={resetAddForm} style={{ ...btnStyle(), border: `1px solid ${c.chromeBorder}` }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSave}
                    disabled={saving || !newGenre.trim() || !newName.trim() || !newContent.trim()}
                    style={{ ...btnStyle('primary'), padding: '5px 14px' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
