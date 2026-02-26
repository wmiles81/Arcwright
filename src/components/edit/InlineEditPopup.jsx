import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import useInlineEdit from '../../hooks/useInlineEdit';
import useInlineEditStore from '../../store/useInlineEditStore';
import useEditorStore from '../../store/useEditorStore';
import usePromptStore from '../../store/usePromptStore';
import useAppStore from '../../store/useAppStore';
import { genreSystem } from '../../data/genreSystem';
import defaultPrompts from '../../data/defaultPrompts';
import PromptEditorDialog from '../prompts/PromptEditorDialog';

/**
 * Compute popup position: below the anchor, clamped within the viewport.
 * Flips above if not enough room below.
 */
function computePosition(anchorRect, popupWidth, popupHeight) {
  const MARGIN = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = anchorRect.bottom + MARGIN;
  let left = anchorRect.left;

  if (top + popupHeight > vh - MARGIN) {
    top = anchorRect.top - popupHeight - MARGIN;
  }
  if (left + popupWidth > vw - MARGIN) {
    left = vw - popupWidth - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;
  if (top < MARGIN) top = MARGIN;

  return { top, left };
}

/** Resolve template variables in preset prompts, including scaffold vars. */
function resolveTemplate(content, { selectedText, beforeText, afterText, userInput, selectedDocuments, scaffoldVars = {} }) {
  let result = content
    .replace(/\{\{selected_text\}\}/g, selectedText || '')
    .replace(/\{\{before\}\}/g, beforeText || '')
    .replace(/\{\{after\}\}/g, afterText || '')
    .replace(/\{\{selected_documents\}\}/g, selectedDocuments || '')
    .replace(/\{\{user_input\}\}/g, userInput || '');
  // Resolve scaffold vars (genre, subgenre, modifier, pacing, structure, etc.)
  for (const [name, value] of Object.entries(scaffoldVars)) {
    result = result.replace(new RegExp(`\\{\\{${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g'), value || '');
  }
  return result;
}

/** Return list of unresolved {{variable}} names remaining in content. */
function detectUnresolvedVars(content) {
  const matches = [...content.matchAll(/\{\{([^}|]+?)(?:\s*\|[^}]*)?\}\}/g)];
  return [...new Set(matches.map((m) => m[1].trim()))];
}

/** Get plain text before the saved selection range in the editor. Truncated to last maxChars. */
function getBeforeText(editorRef, savedRange, maxChars = 8000) {
  try {
    if (!editorRef?.current || !savedRange) return '';
    const r = document.createRange();
    r.setStart(editorRef.current, 0);
    r.setEnd(savedRange.startContainer, savedRange.startOffset);
    const full = r.toString();
    return full.length > maxChars ? full.slice(-maxChars) : full;
  } catch { return ''; }
}

/** Get plain text after the saved selection range in the editor. Truncated to first maxChars. */
function getAfterText(editorRef, savedRange, maxChars = 8000) {
  try {
    if (!editorRef?.current || !savedRange) return '';
    const r = document.createRange();
    r.setStart(savedRange.endContainer, savedRange.endOffset);
    r.setEnd(editorRef.current, editorRef.current.childNodes.length);
    const full = r.toString();
    return full.length > maxChars ? full.slice(0, maxChars) : full;
  } catch { return ''; }
}

/** Find a file handle in the tree by path. */
function findHandleInTree(tree, path) {
  for (const node of tree) {
    if (node.path === path && node.handle) return node.handle;
    if (node.children) {
      const found = findHandleInTree(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** Read content of all context-selected files (green dots). Returns formatted string. */
async function getSelectedDocumentsContent() {
  const { contextPaths, tabs, fileTree } = useEditorStore.getState();
  const paths = Object.keys(contextPaths).filter((p) => contextPaths[p]);
  if (paths.length === 0) return '';

  const parts = [];
  for (const path of paths.sort()) {
    // Check if already open in a tab
    const tab = tabs.find((t) => t.id === path);
    if (tab?.content) {
      parts.push(`[${path}]\n${tab.content}\n[/${path}]`);
      continue;
    }
    // Otherwise read from file handle
    const handle = findHandleInTree(fileTree, path);
    if (handle) {
      try {
        const file = await handle.getFile();
        const content = await file.text();
        parts.push(`[${path}]\n${content}\n[/${path}]`);
      } catch {
        // skip unreadable files
      }
    }
  }
  return parts.join('\n\n');
}

/**
 * InlineEditPopup — two modes:
 *  "button"  → small floating AI button near the selection
 *  "popup"   → full editing popup with prompt, response, and action bar
 */
export default function InlineEditPopup({
  mode,
  anchorRect,
  onClick,
  onClose,
  selectedText,
  savedRange,
  editorRef,
  tabId,
  colors: c,
  isDark,
  updateTabContent,
  initialPreset,
}) {
  // ────────────────────────── Button mode ──────────────────────────
  if (mode === 'button') {
    const top = anchorRect.bottom + 4;
    const left = anchorRect.right - 30;
    return (
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        style={{
          position: 'fixed',
          top: Math.min(top, window.innerHeight - 36),
          left: Math.min(Math.max(left, 8), window.innerWidth - 36),
          zIndex: 60,
          background: '#7C3AED',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          lineHeight: 1,
          transition: 'opacity 0.15s',
        }}
        title="AI Edit (⌘K)"
      >
        AI
      </button>
    );
  }

  // ────────────────────────── Popup mode ──────────────────────────
  return (
    <InlineEditPanel
      anchorRect={anchorRect}
      onClose={onClose}
      selectedText={selectedText}
      savedRange={savedRange}
      editorRef={editorRef}
      tabId={tabId}
      colors={c}
      isDark={isDark}
      updateTabContent={updateTabContent}
      initialPreset={initialPreset}
    />
  );
}

/** The full popup panel — separated so hooks are only called in popup mode. */
function InlineEditPanel({
  anchorRect,
  onClose,
  selectedText,
  savedRange,
  editorRef,
  tabId,
  colors: c,
  isDark,
  updateTabContent,
  initialPreset,
}) {
  const { status, response, errorMsg, submitEdit, reset, cancel } = useInlineEdit();
  const promptHistory = useInlineEditStore((s) => s.promptHistory);
  const lastPrompt = useInlineEditStore((s) => s.lastPrompt);
  const addPrompt = useInlineEditStore((s) => s.addPrompt);
  const customPrompts = usePromptStore((s) => s.customPrompts);

  // Scaffold vars for NovaKit-style template resolution
  const selectedGenre = useAppStore((s) => s.selectedGenre);
  const selectedSubgenre = useAppStore((s) => s.selectedSubgenre);
  const selectedModifier = useAppStore((s) => s.selectedModifier);
  const selectedPacing = useAppStore((s) => s.selectedPacing);
  const selectedStructure = useAppStore((s) => s.selectedStructure);
  const scaffoldVars = useMemo(() => {
    const gd = genreSystem[selectedGenre];
    const sd = gd?.subgenres?.[selectedSubgenre];
    return {
      genre: gd?.name || selectedGenre || '',
      subgenre: sd?.name || selectedSubgenre || '',
      modifier: selectedModifier || '',
      pacing: selectedPacing || '',
      structure: selectedStructure || '',
    };
  }, [selectedGenre, selectedSubgenre, selectedModifier, selectedPacing, selectedStructure]);

  const [prompt, setPrompt] = useState(initialPreset?.title || '');
  const [showHistory, setShowHistory] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activePreset, setActivePreset] = useState(initialPreset || null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  // pendingVars: { resolvedContent, vars: {name: value}, modelOverride } — shown when unresolved {{vars}} remain
  const [pendingVars, setPendingVars] = useState(null);
  // pendingPromptPreview: { text, modelOverride } — editable resolved preview before sending
  const [pendingPromptPreview, setPendingPromptPreview] = useState(null);

  const popupRef = useRef(null);
  const inputRef = useRef(null);
  const responseRef = useRef(null);

  const POPUP_WIDTH = 420;
  const POPUP_EST_HEIGHT = 300;

  // Position on mount + resize
  useEffect(() => {
    const update = () => {
      setPos(computePosition(anchorRect, POPUP_WIDTH, POPUP_EST_HEIGHT));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [anchorRect]);

  // Auto-focus prompt input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Auto-scroll response area as it streams
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // Outside click handler
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClose = useCallback(() => {
    if (status === 'streaming') cancel();
    onClose();
  }, [status, cancel, onClose]);

  // Filter dropdown items (custom prompts + default presets + history)
  const filterText = showHistory && prompt.startsWith('/')
    ? prompt.slice(1).toLowerCase()
    : '';
  const filteredCustom = showHistory
    ? customPrompts.filter((p) => p.title.toLowerCase().includes(filterText))
    : [];
  const filteredPresets = showHistory
    ? defaultPrompts.filter((p) => p.title.toLowerCase().includes(filterText))
    : [];
  const filteredHistory = showHistory
    ? promptHistory.filter((p) => p.toLowerCase().includes(filterText))
    : [];
  const dropdownItems = [
    ...filteredCustom.map((p) => ({ type: 'custom', id: p.id, label: p.title, data: p })),
    ...filteredPresets.map((p) => ({ type: 'preset', id: p.id, label: p.title, data: p })),
    ...filteredHistory.map((h, i) => ({ type: 'history', id: `h-${i}`, label: h, data: h })),
  ];

  // Submit the prompt to AI
  const handleSubmit = useCallback(async () => {
    const text = prompt.trim() || lastPrompt;
    if (!text) return;
    addPrompt(text);
    setPrompt(text);
    setShowHistory(false);

    if (activePreset) {
      const userInput = prompt.startsWith(activePreset.title)
        ? prompt.slice(activePreset.title.length).trim()
        : '';
      const beforeText = getBeforeText(editorRef, savedRange);
      const afterText = getAfterText(editorRef, savedRange);
      const selectedDocuments = await getSelectedDocumentsContent();
      const resolved = resolveTemplate(activePreset.content, {
        selectedText,
        beforeText,
        afterText,
        userInput,
        selectedDocuments,
        scaffoldVars,
      });
      // Check for unresolved {{variables}} (e.g. NovaKit vars like {{themes}}, {{tone}})
      const remaining = detectUnresolvedVars(resolved);
      if (remaining.length > 0) {
        setPendingVars({
          resolvedContent: resolved,
          vars: Object.fromEntries(remaining.map((v) => [v, ''])),
          modelOverride: activePreset.modelOverride || null,
        });
        return;
      }
      submitEdit(selectedText, resolved, true, activePreset.modelOverride || null);
    } else {
      submitEdit(selectedText, text);
    }
  }, [prompt, lastPrompt, addPrompt, submitEdit, selectedText, activePreset, editorRef, savedRange, scaffoldVars]);

  // Called when user submits the extra-vars form
  const handleVarFormSubmit = useCallback(() => {
    if (!pendingVars) return;
    let final = pendingVars.resolvedContent;
    for (const [name, value] of Object.entries(pendingVars.vars)) {
      final = final.replace(
        new RegExp(`\\{\\{${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*\\|[^}]*)?\\}\\}`, 'g'),
        value
      );
    }
    setPendingVars(null);
    submitEdit(selectedText, final, true, pendingVars.modelOverride);
  }, [pendingVars, submitEdit, selectedText]);

  // Accept: replace selection with AI response
  const handleAccept = useCallback(() => {
    try {
      editorRef.current.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
      document.execCommand('insertText', false, response);
      updateTabContent(tabId, editorRef.current.innerHTML);
    } catch (e) {
      console.error('Inline edit accept failed:', e);
    }
    onClose();
  }, [editorRef, savedRange, response, updateTabContent, tabId, onClose]);

  // Retry: clear response, let user edit prompt
  const handleRetry = useCallback(() => {
    reset();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [reset]);

  // Select a preset/custom prompt: resolve template immediately → show editable preview
  const handlePresetSelect = useCallback(async (preset) => {
    setShowHistory(false);
    setHistoryIndex(-1);
    setActivePreset(preset);
    const beforeText = getBeforeText(editorRef, savedRange);
    const afterText = getAfterText(editorRef, savedRange);
    const selectedDocuments = await getSelectedDocumentsContent();
    const resolved = resolveTemplate(preset.content, {
      selectedText,
      beforeText,
      afterText,
      userInput: '',
      selectedDocuments,
      scaffoldVars,
    });
    setPendingPromptPreview({ text: resolved, modelOverride: preset.modelOverride || null });
  }, [editorRef, savedRange, selectedText, scaffoldVars]);

  // Keyboard handling in prompt input
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (showHistory) {
        setShowHistory(false);
        setHistoryIndex(-1);
      } else {
        handleClose();
      }
      return;
    }

    // Dropdown navigation (presets + history)
    if (showHistory && dropdownItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHistoryIndex((i) => Math.min(i + 1, dropdownItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHistoryIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && historyIndex >= 0) {
        e.preventDefault();
        const item = dropdownItems[historyIndex];
        if (item.type === 'preset' || item.type === 'custom') {
          handlePresetSelect(item.data);
        } else if (item.type === 'manage') {
          setShowPromptEditor(true);
          setShowHistory(false);
        } else {
          setPrompt(item.data);
        }
        setShowHistory(false);
        setHistoryIndex(-1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [showHistory, dropdownItems, historyIndex, handleSubmit, handleClose, handlePresetSelect]);

  // Handle prompt input changes
  const handlePromptChange = useCallback((e) => {
    const val = e.target.value;
    setPrompt(val);
    if (activePreset && !val.startsWith(activePreset.title)) {
      setActivePreset(null);
    }
    if (val.startsWith('/')) {
      setShowHistory(true);
      setHistoryIndex(-1);
    } else {
      setShowHistory(false);
    }
  }, [activePreset]);

  // Select a history item
  const selectHistory = useCallback((item) => {
    setPrompt(item);
    setShowHistory(false);
    setHistoryIndex(-1);
    inputRef.current?.focus();
  }, []);

  const truncatedSelection = selectedText.length > 200
    ? selectedText.slice(0, 200) + '...'
    : selectedText;

  const inputStyle = {
    width: '100%',
    background: c.bg,
    color: c.text,
    border: `1px solid ${c.chromeBorder}`,
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'none',
  };

  const btnBase = {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.15s',
  };

  return (
    <div
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 60,
        width: POPUP_WIDTH,
        maxWidth: 'calc(100vw - 16px)',
        background: c.chrome,
        border: `1px solid ${c.chromeBorder}`,
        borderRadius: '8px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Selected text preview */}
      {selectedText && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${c.chromeBorder}`,
            fontSize: '11px',
            color: c.statusText,
            maxHeight: '60px',
            overflowY: 'auto',
          }}
        >
          <span style={{ fontWeight: 600, color: c.chromeText }}>Selected: </span>
          <span style={{ opacity: 0.8 }}>{truncatedSelection}</span>
        </div>
      )}

      {/* Prompt input area */}
      <div style={{ padding: '8px 12px', position: 'relative' }}>
        {activePreset && (
          <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#7C3AED',
              background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.1)',
              padding: '1px 6px',
              borderRadius: '3px',
            }}>
              PRESET
            </span>
            <span style={{ fontSize: '10px', color: c.statusText }}>
              Template variables will be resolved on send
            </span>
          </div>
        )}
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder={lastPrompt || 'Describe what you want... (/ for prompts)'}
          rows={2}
          style={inputStyle}
          disabled={status === 'streaming'}
        />

        {/* Prompt dropdown (custom + presets + history) */}
        {showHistory && (dropdownItems.length > 0 || true) && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: '100%',
              marginBottom: -4,
              zIndex: 70,
              background: c.bg,
              border: `1px solid ${c.chromeBorder}`,
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxHeight: '280px',
              overflowY: 'auto',
            }}
          >
            {filteredCustom.length > 0 && (
              <div style={{ padding: '4px 10px 2px', fontSize: '9px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Custom Prompts
              </div>
            )}
            {filteredCustom.map((prompt) => {
              const idx = dropdownItems.findIndex((d) => d.id === prompt.id);
              return (
                <div
                  key={prompt.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePresetSelect(prompt);
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    color: c.text,
                    cursor: 'pointer',
                    fontWeight: 500,
                    background: idx === historyIndex
                      ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (idx !== historyIndex) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {prompt.title}
                  {prompt.modelOverride && (
                    <span style={{ fontSize: '8px', color: '#7C3AED', opacity: 0.8 }}>
                      {prompt.modelOverride.split('/').pop()}
                    </span>
                  )}
                </div>
              );
            })}
            {filteredPresets.length > 0 && (
              <div style={{
                padding: '4px 10px 2px',
                fontSize: '9px',
                fontWeight: 700,
                color: c.statusText,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderTop: filteredCustom.length > 0 ? `1px solid ${c.chromeBorder}` : 'none',
                marginTop: filteredCustom.length > 0 ? 4 : 0,
              }}>
                Presets
              </div>
            )}
            {filteredPresets.map((preset) => {
              const idx = dropdownItems.findIndex((d) => d.id === preset.id);
              return (
                <div
                  key={preset.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePresetSelect(preset);
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    color: c.text,
                    cursor: 'pointer',
                    fontWeight: 500,
                    background: idx === historyIndex
                      ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                      : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (idx !== historyIndex) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {preset.title}
                </div>
              );
            })}
            {filteredHistory.length > 0 && (
              <div style={{
                padding: '4px 10px 2px',
                fontSize: '9px',
                fontWeight: 700,
                color: c.statusText,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderTop: (filteredCustom.length > 0 || filteredPresets.length > 0) ? `1px solid ${c.chromeBorder}` : 'none',
                marginTop: (filteredCustom.length > 0 || filteredPresets.length > 0) ? 4 : 0,
              }}>
                History
              </div>
            )}
            {filteredHistory.map((item, i) => {
              const idx = filteredCustom.length + filteredPresets.length + i;
              return (
                <div
                  key={`h-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); selectHistory(item); }}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    color: c.text,
                    cursor: 'pointer',
                    background: idx === historyIndex
                      ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                      : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (idx !== historyIndex) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {item.length > 60 ? item.slice(0, 60) + '...' : item}
                </div>
              );
            })}
            {/* Manage Prompts option */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setShowHistory(false);
                setShowPromptEditor(true);
              }}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                color: '#7C3AED',
                cursor: 'pointer',
                fontWeight: 600,
                borderTop: `1px solid ${c.chromeBorder}`,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {'\u2699'} Manage Prompts...
            </div>
          </div>
        )}
      </div>

      {/* Streaming response area */}
      {(status === 'streaming' || status === 'done' || status === 'error') && (
        <div
          ref={responseRef}
          style={{
            padding: '8px 12px',
            borderTop: `1px solid ${c.chromeBorder}`,
            fontSize: '12px',
            fontFamily: 'monospace',
            color: c.text,
            maxHeight: '200px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}
        >
          {status === 'error' ? (
            <span style={{ color: '#DC2626' }}>{errorMsg}</span>
          ) : (
            <>
              {response}
              {status === 'streaming' && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '14px',
                    background: c.text,
                    marginLeft: '1px',
                    verticalAlign: 'text-bottom',
                    animation: 'inlineEditBlink 1s step-end infinite',
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Action bar */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: `1px solid ${c.chromeBorder}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '6px',
        }}
      >
        {status === 'streaming' && (
          <button
            onClick={cancel}
            style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
          >
            Cancel
          </button>
        )}

        {status === 'done' && (
          <>
            <button
              onClick={handleRetry}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Reject
            </button>
            <button
              onClick={handleAccept}
              style={{ ...btnBase, background: '#7C3AED', color: '#FFFFFF' }}
            >
              Accept
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <button
              onClick={handleRetry}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Retry
            </button>
            <button
              onClick={handleClose}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Close
            </button>
          </>
        )}

        {status === 'idle' && (
          <>
            <button
              onClick={handleClose}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{ ...btnBase, background: '#7C3AED', color: '#FFFFFF' }}
            >
              Send
            </button>
          </>
        )}
      </div>

      {/* Blink animation */}
      <style>{`
        @keyframes inlineEditBlink {
          50% { opacity: 0; }
        }
      `}</style>

      {/* Prompt Editor Dialog */}
      <PromptEditorDialog
        isOpen={showPromptEditor}
        onClose={() => setShowPromptEditor(false)}
      />

      {/* Editable prompt preview overlay — shown after selecting a preset/custom prompt */}
      {pendingPromptPreview && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: c.chromeBg || c.chrome,
            borderRadius: 8,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 2 }}>
            Preview — edit before sending
          </div>
          <textarea
            autoFocus
            value={pendingPromptPreview.text}
            onChange={(e) => setPendingPromptPreview((p) => ({ ...p, text: e.target.value }))}
            style={{
              ...inputStyle,
              flex: 1,
              minHeight: 120,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setPendingPromptPreview(null); setActivePreset(null); setPrompt(''); }}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const { text, modelOverride } = pendingPromptPreview;
                setPendingPromptPreview(null);
                submitEdit(selectedText, text, true, modelOverride);
              }}
              style={{ ...btnBase, background: '#7C3AED', color: '#FFFFFF' }}
            >
              Run
            </button>
          </div>
        </div>
      )}

      {/* Extra-variable form overlay (NovaKit prompts with unresolved {{vars}}) */}
      {pendingVars && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: c.chromeBg,
            borderRadius: 8,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 10,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 4 }}>
            Fill in template variables
          </div>
          {Object.keys(pendingVars.vars).map((name) => (
            <div key={name}>
              <label style={{ display: 'block', fontSize: 11, color: c.chromeText, marginBottom: 3 }}>
                {`{{${name}}}`}
              </label>
              <input
                type="text"
                placeholder={`Leave blank to omit`}
                value={pendingVars.vars[name]}
                onChange={(e) =>
                  setPendingVars((p) => ({ ...p, vars: { ...p.vars, [name]: e.target.value } }))
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '5px 8px',
                  fontSize: 12,
                  background: c.editorBg,
                  color: c.text,
                  border: `1px solid ${c.chromeBorder}`,
                  borderRadius: 4,
                  outline: 'none',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => setPendingVars(null)}
              style={{ ...btnBase, background: 'transparent', color: c.chromeText, border: `1px solid ${c.chromeBorder}` }}
            >
              Back
            </button>
            <button
              onClick={handleVarFormSubmit}
              style={{ ...btnBase, background: '#7C3AED', color: '#FFFFFF' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
