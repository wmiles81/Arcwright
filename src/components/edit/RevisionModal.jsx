import React, { useState, useEffect, useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import useAppStore from '../../store/useAppStore';
import { getTheme } from './editorThemes';

/** Flatten a file tree to just text files (type === 'file'). */
function flattenTextFiles(tree, result = []) {
  for (const node of tree) {
    if (node.type === 'file') result.push(node);
    if (node.type === 'dir' && node.children) flattenTextFiles(node.children, result);
  }
  return result;
}

/**
 * Configuration-only modal. Shown only when pipeline is idle.
 * Once the user clicks Start, it calls pipeline.startPipeline() and closes itself.
 * The status bar in MarkdownEditor takes over from there.
 */
export default function RevisionModal({ isOpen, onClose, pipeline }) {
  const fileTree = useEditorStore((s) => s.fileTree);
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const apiKey = useAppStore((s) => {
    const prov = s.providers[s.activeProvider];
    return prov?.apiKey;
  });
  const revisionItems = useAppStore((s) => s.revisionItems);
  const chapters = useAppStore((s) => s.chapters);
  const t = getTheme(editorTheme);
  const c = t.colors;

  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [revisionSource, setRevisionSource] = useState('both');
  const [customPrompt, setCustomPrompt] = useState('');
  const [pauseBetween, setPauseBetween] = useState(true);

  const textFiles = useMemo(() => flattenTextFiles(fileTree), [fileTree]);

  const hasAnalysisData =
    revisionItems.length > 0 || chapters.some((ch) => ch.aiScores || ch.userScores);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const selectAll = () => setSelectedPaths(new Set(textFiles.map((f) => f.path)));
  const deselectAll = () => setSelectedPaths(new Set());
  const toggleFile = (path) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const handleStart = () => {
    if (!apiKey) {
      alert('Set your OpenRouter API key in the Analyze workflow first.');
      return;
    }
    const selectedFiles = textFiles.filter((f) => selectedPaths.has(f.path));
    if (selectedFiles.length === 0) return;
    pipeline.setAdvanceMode(pauseBetween ? 'pause' : 'auto');
    pipeline.startPipeline(selectedFiles, revisionSource, customPrompt);
    onClose(); // Close modal — status bar takes over
  };

  if (!isOpen) return null;

  const isDark = t.family === 'dark';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const inputBorder = c.chromeBorder;

  const sourceOptions = [
    { value: 'both', label: 'Checklist + Gaps', disabled: !hasAnalysisData },
    { value: 'checklist', label: 'Revision Checklist', disabled: !hasAnalysisData },
    { value: 'gaps', label: 'Dimension Gaps', disabled: !hasAnalysisData },
    { value: 'custom', label: 'Custom Prompt', disabled: false },
  ];

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: c.chrome,
          color: c.text,
          border: `1px solid ${c.chromeBorder}`,
          borderRadius: 12,
          width: 560,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${c.chromeBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>AI Chapter Revision</h2>
          <button
            onClick={onClose}
            style={{
              color: c.chromeText,
              fontSize: 18,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* File list */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Select Files</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={selectAll}
                  style={{ fontSize: 11, color: c.chromeText, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  style={{ fontSize: 11, color: c.chromeText, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${inputBorder}`,
                borderRadius: 6,
                maxHeight: 180,
                overflowY: 'auto',
                background: inputBg,
              }}
            >
              {textFiles.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: c.chromeText }}>
                  No text files found. Open a directory in the file panel first.
                </div>
              ) : (
                textFiles.map((f) => (
                  <label
                    key={f.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaths.has(f.path)}
                      onChange={() => toggleFile(f.path)}
                      style={{ accentColor: '#7C3AED' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.path}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Revision source */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Revision Source
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {sourceOptions.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    opacity: opt.disabled ? 0.4 : 1,
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="revisionSource"
                    value={opt.value}
                    checked={revisionSource === opt.value}
                    onChange={() => setRevisionSource(opt.value)}
                    disabled={opt.disabled}
                    style={{ accentColor: '#7C3AED' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {!hasAnalysisData && (
              <p style={{ fontSize: 11, color: c.chromeText, marginTop: 4 }}>
                Analyze chapters first to use checklist or gap-based revision.
              </p>
            )}
          </div>

          {/* Custom prompt */}
          {revisionSource === 'custom' && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Custom Revision Instructions
              </span>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: c.text,
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                placeholder="e.g., Tighten the pacing in the middle third, add more sensory detail to the opening scene, strengthen the emotional arc..."
              />
            </div>
          )}

          {/* Advance mode */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={pauseBetween}
              onChange={(e) => setPauseBetween(e.target.checked)}
              style={{ accentColor: '#7C3AED' }}
            />
            Pause between chapters for review
          </label>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${c.chromeBorder}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: c.chromeText,
              border: `1px solid ${c.chromeBorder}`,
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={selectedPaths.size === 0 || !apiKey}
            style={{
              background: '#7C3AED',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedPaths.size === 0 || !apiKey ? 'not-allowed' : 'pointer',
              opacity: selectedPaths.size === 0 || !apiKey ? 0.5 : 1,
            }}
          >
            Start Revision ({selectedPaths.size} file{selectedPaths.size !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
