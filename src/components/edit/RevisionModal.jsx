import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useFocusTrap from '../../hooks/useFocusTrap';
import useEditorStore from '../../store/useEditorStore';
import useAppStore from '../../store/useAppStore';
import useProjectStore from '../../store/useProjectStore';
import { getTheme } from './editorThemes';
import { buildFileTree } from './FilePanel';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.markdown', '.mdown', '.mkd']);

/** Check if a file name has a text extension. */
function isTextFile(name) {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return TEXT_EXTENSIONS.has(name.substring(dot).toLowerCase());
}

/** Collect all text file paths from a tree. */
function collectTextPaths(tree) {
  const paths = [];
  for (const node of tree) {
    if (node.type === 'file' && isTextFile(node.name)) paths.push(node.path);
    if (node.type === 'dir' && node.children) paths.push(...collectTextPaths(node.children));
  }
  return paths;
}

/** Collect all text file nodes (flat) from a tree for pipeline submission. */
function collectTextNodes(tree) {
  const nodes = [];
  for (const node of tree) {
    if (node.type === 'file' && isTextFile(node.name)) nodes.push(node);
    if (node.type === 'dir' && node.children) nodes.push(...collectTextNodes(node.children));
  }
  return nodes;
}

/**
 * Configuration-only modal. Shown only when pipeline is idle.
 * Once the user clicks Start, it calls pipeline.startPipeline() and closes itself.
 * The status bar in MarkdownEditor takes over from there.
 */
export default function RevisionModal({ isOpen, onClose, pipeline }) {
  const editorFileTree = useEditorStore((s) => s.fileTree);
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const bookDirHandle = useProjectStore((s) => s.bookDirHandle);
  const activeBookProject = useProjectStore((s) => s.activeBookProject);
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
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [bookTree, setBookTree] = useState([]);

  // Build a dedicated tree from bookDirHandle when available
  useEffect(() => {
    if (!isOpen) return;
    if (bookDirHandle) {
      buildFileTree(bookDirHandle).then((tree) => setBookTree(tree));
    } else {
      setBookTree([]);
    }
  }, [isOpen, bookDirHandle]);

  // The tree to display: book tree if available, otherwise editor tree
  const displayTree = bookDirHandle ? bookTree : editorFileTree;

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

  const selectAll = () => setSelectedPaths(new Set(collectTextPaths(displayTree)));
  const deselectAll = () => setSelectedPaths(new Set());

  const toggleFile = useCallback((path) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const toggleDir = useCallback((dirNode) => {
    const childPaths = collectTextPaths(dirNode.children || []);
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const allIn = childPaths.every((p) => next.has(p));
      if (allIn) {
        childPaths.forEach((p) => next.delete(p));
      } else {
        childPaths.forEach((p) => next.add(p));
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleStart = () => {
    if (!apiKey) {
      alert('Set your OpenRouter API key in the Analyze workflow first.');
      return;
    }
    const selectedNodes = collectTextNodes(displayTree).filter((n) => selectedPaths.has(n.path));
    if (selectedNodes.length === 0) return;
    pipeline.setAdvanceMode(pauseBetween ? 'pause' : 'auto');
    pipeline.startPipeline(selectedNodes, revisionSource, customPrompt);
    onClose();
  };

  const trapRef = useFocusTrap(isOpen);

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
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI Chapter Revision"
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
          {/* File tree */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Select Files
                {activeBookProject && (
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#6366F1', marginLeft: 8 }}>
                    {'\uD83D\uDCD6'} {activeBookProject}
                  </span>
                )}
              </span>
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
                maxHeight: 220,
                overflowY: 'auto',
                background: inputBg,
                padding: '4px 0',
              }}
            >
              {displayTree.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: c.chromeText }}>
                  No files found. Open a directory in the file panel or set a book folder first.
                </div>
              ) : (
                displayTree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPaths={selectedPaths}
                    expandedDirs={expandedDirs}
                    onToggleFile={toggleFile}
                    onToggleDir={toggleDir}
                    onToggleExpanded={toggleExpanded}
                    colors={c}
                  />
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

/** Recursive tree node for the file selector. */
function FileTreeNode({ node, depth, selectedPaths, expandedDirs, onToggleFile, onToggleDir, onToggleExpanded, colors }) {
  const indent = depth * 16 + 8;

  if (node.type === 'dir') {
    const isExpanded = expandedDirs.has(node.path);
    const childTextPaths = collectTextPaths(node.children || []);
    const hasTextFiles = childTextPaths.length > 0;
    const allSelected = hasTextFiles && childTextPaths.every((p) => selectedPaths.has(p));
    const someSelected = !allSelected && childTextPaths.some((p) => selectedPaths.has(p));

    if (!hasTextFiles) return null; // hide folders with no text files

    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            paddingLeft: indent,
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 600,
            color: colors.text,
          }}
          onClick={() => onToggleExpanded(node.path)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={(e) => { e.stopPropagation(); onToggleDir(node); }}
            onClick={(e) => e.stopPropagation()}
            style={{ accentColor: '#7C3AED', cursor: 'pointer' }}
          />
          <span style={{ color: colors.chromeText, fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>
            {isExpanded ? '\u25BE' : '\u25B8'}
          </span>
          <span>{'\uD83D\uDCC1'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          <span style={{ fontSize: 10, color: colors.chromeText, marginLeft: 'auto', flexShrink: 0 }}>
            {childTextPaths.length}
          </span>
        </div>
        {isExpanded && node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPaths={selectedPaths}
            expandedDirs={expandedDirs}
            onToggleFile={onToggleFile}
            onToggleDir={onToggleDir}
            onToggleExpanded={onToggleExpanded}
            colors={colors}
          />
        ))}
      </>
    );
  }

  // Only show text files
  if (!isTextFile(node.name)) return null;

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        paddingLeft: indent + 16,
        cursor: 'pointer',
        fontSize: 12,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <input
        type="checkbox"
        checked={selectedPaths.has(node.path)}
        onChange={() => onToggleFile(node.path)}
        style={{ accentColor: '#7C3AED' }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </span>
    </label>
  );
}
