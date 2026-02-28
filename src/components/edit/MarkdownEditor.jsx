import React, { useRef, useCallback, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { getTheme, lightThemes, darkThemes } from './editorThemes';
import RevisionModal from './RevisionModal';
import SearchReplaceBar from './SearchReplaceBar';
import InlineEditPopup from './InlineEditPopup';
import defaultPrompts from '../../data/defaultPrompts';
import useRevisionPipeline from '../../hooks/useRevisionPipeline';
import useSearchReplace from '../../hooks/useSearchReplace';
import ToolsDropdown from './ToolsDropdown';
import ScriptOutputPanel from './ScriptOutputPanel';
import CodePane, { CODE_EXTS } from './CodePane';
import DiffView from './DiffView';

/** Convert basic markdown to HTML for contentEditable display. */
function markdownToHtml(content) {
  if (!content) return '';
  // Already converted — contains HTML block elements
  if (/<(?:p|div|h[1-6]|ul|ol|blockquote)\b/i.test(content)) return content;
  let html = content;
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0;" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const blocks = html.split(/\n\n+/);
  html = blocks.map((b) => {
    const t = b.trim();
    if (!t) return '';
    if (/^<(?:h[1-6]|hr|ul|ol|blockquote|div|p)\b/i.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return html || '<p><br></p>';
}

const TOOLBAR_ITEMS = [
  { label: 'B', title: 'Bold', command: 'bold', style: { fontWeight: 700 } },
  { label: 'I', title: 'Italic', command: 'italic', style: { fontStyle: 'italic' } },
  { label: 'U', title: 'Underline', command: 'underline', style: { textDecoration: 'underline' } },
  { label: '~', title: 'Strikethrough', command: 'strikeThrough' },
  { sep: true },
  { label: 'H1', title: 'Heading 1', command: 'formatBlock', value: '<h1>' },
  { label: 'H2', title: 'Heading 2', command: 'formatBlock', value: '<h2>' },
  { label: 'H3', title: 'Heading 3', command: 'formatBlock', value: '<h3>' },
  { sep: true },
  { label: '\u2022', title: 'Bullet List', command: 'insertUnorderedList' },
  { label: '1.', title: 'Ordered List', command: 'insertOrderedList' },
  { label: '\u275D', title: 'Blockquote', command: 'formatBlock', value: '<blockquote>' },
  { sep: true },
  { label: '</>', title: 'Inline Code', command: 'custom', action: 'code' },
  { label: '\u{1F517}', title: 'Link', command: 'custom', action: 'link' },
  { label: '\u2015', title: 'Horizontal Rule', command: 'insertHorizontalRule' },
];

export default function MarkdownEditor() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const secondaryTabId = useEditorStore((s) => s.secondaryTabId);
  const dualPane = useEditorStore((s) => s.dualPane);
  const syncScroll = useEditorStore((s) => s.syncScroll);
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setSecondaryTab = useEditorStore((s) => s.setSecondaryTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const updateTabContent = useEditorStore((s) => s.updateTabContent);
  const toggleDualPane = useEditorStore((s) => s.toggleDualPane);
  const toggleSyncScroll = useEditorStore((s) => s.toggleSyncScroll);
  const diffMode = useEditorStore((s) => s.diffMode);
  const toggleDiffMode = useEditorStore((s) => s.toggleDiffMode);
  const saveTab = useEditorStore((s) => s.saveTab);
  const renameTab = useEditorStore((s) => s.renameTab);
  const clearAllTabs = useEditorStore((s) => s.clearAllTabs);
  const setEditorTheme = useEditorStore((s) => s.setEditorTheme);
  const setLeftPanelTab = useEditorStore((s) => s.setLeftPanelTab);
  const focusedPane = useEditorStore((s) => s.focusedPane);
  const setFocusedPane = useEditorStore((s) => s.setFocusedPane);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const secondaryTab = tabs.find((t) => t.id === secondaryTabId);
  const t = getTheme(editorTheme);
  const c = t.colors;
  const isCodePrimary = CODE_EXTS.test(activeTab?.title || '');
  const isCodeSecondary = CODE_EXTS.test(secondaryTab?.title || '');

  const primaryRef = useRef(null);
  const secondaryRef = useRef(null);
  const scrollingRef = useRef(null);
  const editorContainerRef = useRef(null);
  const paneDragging = useRef(false);
  const [splitPercent, setSplitPercent] = useState(50);

  // Pane divider drag
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!paneDragging.current || !editorContainerRef.current) return;
      const rect = editorContainerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, pct)));
    };
    const onMouseUp = () => { paneDragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Tab rename state
  const [renamingTabId, setRenamingTabId] = useState(null);
  const [tabRenameValue, setTabRenameValue] = useState('');
  // Theme picker state
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [lastTextColor, setLastTextColor] = useState('#DC2626');
  const [lastBgColor, setLastBgColor] = useState('#FBBF24');
  const [inlineEdit, setInlineEdit] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashIndex, setSlashIndex] = useState(-1);
  const pipeline = useRevisionPipeline();
  const search = useSearchReplace(primaryRef, secondaryRef);
  const pickerRef = useRef(null);
  const textColorRef = useRef(null);
  const bgColorRef = useRef(null);

  // Close popovers on outside click
  useEffect(() => {
    if (!showThemePicker && !showTextColorPicker && !showBgColorPicker) return;
    const handler = (e) => {
      if (showThemePicker && pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowThemePicker(false);
      }
      if (showTextColorPicker && textColorRef.current && !textColorRef.current.contains(e.target)) {
        setShowTextColorPicker(false);
      }
      if (showBgColorPicker && bgColorRef.current && !bgColorRef.current.contains(e.target)) {
        setShowBgColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showThemePicker, showTextColorPicker, showBgColorPicker]);

  // Inline AI edit: detect selection on mouseup
  const handleEditorMouseUp = useCallback(() => {
    if (inlineEdit) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim()) {
        const range = sel.getRangeAt(0);
        setSelectionRect(range.getBoundingClientRect());
      } else {
        setSelectionRect(null);
      }
    }, 10);
  }, [inlineEdit]);

  // Inline AI edit: open the full popup
  const handleInlineEditOpen = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    let ownerRef = primaryRef;
    let ownerTabId = activeTabId;
    if (dualPane && secondaryRef.current?.contains(range.commonAncestorContainer)) {
      ownerRef = secondaryRef;
      ownerTabId = secondaryTabId;
    }

    setInlineEdit({
      selectedText: sel.toString(),
      savedRange: range.cloneRange(),
      rect: range.getBoundingClientRect(),
      editorRef: ownerRef,
      tabId: ownerTabId,
    });
    setSelectionRect(null);
  }, [activeTabId, secondaryTabId, dualPane]);

  // Slash command: detect /command on empty lines
  const checkSlashCommand = useCallback((ref) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setSlashMenu(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      setSlashMenu(null);
      return;
    }
    // Walk up to the direct child of the editor element
    let block = node;
    while (block.parentNode && block.parentNode !== ref.current) {
      block = block.parentNode;
    }
    const blockText = (block.textContent || '').trim();
    if (blockText.startsWith('/') && blockText.length >= 1 && blockText.length <= 40) {
      const cursorRect = range.getBoundingClientRect();
      setSlashMenu({
        paneRef: ref,
        rect: cursorRect,
        filterText: blockText.slice(1).toLowerCase(),
        block: block.nodeType === Node.TEXT_NODE ? block.parentNode : block,
      });
      setSlashIndex(-1);
    } else {
      setSlashMenu(null);
    }
  }, []);

  // Slash command: select a preset from the menu
  const handleSlashSelect = useCallback((preset) => {
    if (!slashMenu) return;
    const { paneRef, block } = slashMenu;

    // Delete the /... text from the block
    if (block) {
      const r = document.createRange();
      r.selectNodeContents(block);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      document.execCommand('delete');
    }

    // Save cursor position for the inline edit popup
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    const cursorRect = savedRange ? savedRange.getBoundingClientRect() : null;
    const rect = (cursorRect && cursorRect.height > 0) ? cursorRect : slashMenu.rect;
    const tabId = paneRef === secondaryRef ? secondaryTabId : activeTabId;

    if (paneRef?.current && tabId) {
      updateTabContent(tabId, paneRef.current.innerHTML);
    }

    setInlineEdit({
      selectedText: '',
      savedRange,
      rect,
      editorRef: paneRef,
      tabId,
      preset,
    });
    setSlashMenu(null);
    setSlashIndex(-1);
  }, [slashMenu, activeTabId, secondaryTabId, updateTabContent]);

  // Slash command: keyboard navigation in the menu
  const handleEditorKeyDown = useCallback((e) => {
    if (!slashMenu) return;
    const items = defaultPrompts.filter((p) =>
      p.title.toLowerCase().includes(slashMenu.filterText)
    );
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSlashIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSlashIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (slashIndex >= 0 && slashIndex < items.length) {
        e.preventDefault();
        handleSlashSelect(items[slashIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSlashMenu(null);
      setSlashIndex(-1);
    }
  }, [slashMenu, slashIndex, handleSlashSelect]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeTabId) saveTab(activeTabId);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'h' || e.key === 'f')) {
        e.preventDefault();
        setShowSearchBar((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleInlineEditOpen();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTabId, saveTab, handleInlineEditOpen]);

  // Sync scroll handler
  const handleScroll = useCallback((source) => {
    if (!syncScroll || !dualPane) return;
    if (scrollingRef.current && scrollingRef.current !== source) return;
    scrollingRef.current = source;
    const srcEl = source === 'primary' ? primaryRef.current : secondaryRef.current;
    const tgtEl = source === 'primary' ? secondaryRef.current : primaryRef.current;
    if (!srcEl || !tgtEl) return;
    const ratio = srcEl.scrollTop / (srcEl.scrollHeight - srcEl.clientHeight || 1);
    tgtEl.scrollTop = ratio * (tgtEl.scrollHeight - tgtEl.clientHeight);
    requestAnimationFrame(() => { scrollingRef.current = null; });
  }, [syncScroll, dualPane]);

  const handleFormat = useCallback((item, ref) => {
    const el = ref?.current;
    if (!el) return;
    el.focus();
    if (item.command === 'custom') {
      if (item.action === 'code') {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          const code = document.createElement('code');
          try { range.surroundContents(code); } catch { /* partial selection */ }
        }
      } else if (item.action === 'link') {
        const url = prompt('URL:');
        if (url) document.execCommand('createLink', false, url);
      }
    } else {
      document.execCommand(item.command, false, item.value || null);
    }
    const tabId = ref === primaryRef ? activeTabId : secondaryTabId;
    if (tabId) updateTabContent(tabId, el.innerHTML);
  }, [activeTabId, secondaryTabId, updateTabContent]);

  // Content sync: store → DOM on tab switch or leaving diff mode
  useEffect(() => {
    if (!primaryRef.current || isCodePrimary) return;
    primaryRef.current.innerHTML = markdownToHtml(activeTab?.content || '');
  }, [activeTabId, isCodePrimary, diffMode]);

  useEffect(() => {
    if (!dualPane || !secondaryRef.current || !secondaryTab || isCodeSecondary) return;
    secondaryRef.current.innerHTML = markdownToHtml(secondaryTab?.content || '');
  }, [secondaryTabId, dualPane, isCodeSecondary, diffMode]);

  const handleContentInput = useCallback((ref, tabId) => {
    if (ref?.current && tabId) updateTabContent(tabId, ref.current.innerHTML);
    checkSlashCommand(ref);
  }, [updateTabContent, checkSlashCommand]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Tab rename handlers
  const startTabRename = (tabId, currentTitle) => {
    setRenamingTabId(tabId);
    setTabRenameValue(currentTitle);
  };

  const commitTabRename = async (tabId) => {
    const newName = tabRenameValue.trim();
    setRenamingTabId(null);
    if (!newName) return;
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || newName === tab.title) return;
    renameTab(tabId, newName);
  };

  // Determine which textarea ref is focused
  const getFocusedRef = useCallback(() => {
    return (dualPane && focusedPane === 'secondary') ? secondaryRef : primaryRef;
  }, [dualPane, focusedPane]);

  const stripHtml = (s) => s ? s.replace(/<[^>]*>/g, ' ').trim() : '';
  const primaryWordCount = stripHtml(activeTab?.content).split(/\s+/).filter(Boolean).length;
  const secondaryWordCount = stripHtml(secondaryTab?.content).split(/\s+/).filter(Boolean).length;

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: c.bg }}>
        <div className="text-center">
          <p className="mb-3 text-lg" style={{ color: c.chromeText }}>No files open</p>
          <p className="text-sm mb-4" style={{ color: c.statusText }}>
            Open a folder in the Files panel and click a file to start editing.
          </p>
          <button
            onClick={() => setLeftPanelTab('files')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Go to Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative" style={{ background: c.bg }}>
      {/* File tabs */}
      <div
        className="flex items-center shrink-0"
        style={{ background: c.tabInactiveBg, borderBottom: `1px solid ${c.chromeBorder}` }}
      >
        {/* Left pane tabs — bounded to left pane width when dual-pane is active */}
        <div
          className="flex overflow-x-auto"
          style={dualPane ? { width: `${splitPercent}%`, flexShrink: 0 } : { flex: 1 }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onAuxClick={(e) => { if (e.button === 1) closeTab(tab.id); }}
                onDoubleClick={() => startTabRename(tab.id, tab.title)}
                className="group flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0 transition-colors cursor-pointer"
                style={{
                  background: isActive ? c.tabActiveBg : c.tabInactiveBg,
                  color: isActive ? c.tabActiveText : c.tabInactiveText,
                  borderRight: `1px solid ${c.chromeBorder}`,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = c.tabHoverBg; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = c.tabInactiveBg; }}
              >
                {renamingTabId === tab.id ? (
                  <input
                    autoFocus
                    value={tabRenameValue}
                    onChange={(e) => setTabRenameValue(e.target.value)}
                    onBlur={() => commitTabRename(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitTabRename(tab.id);
                      if (e.key === 'Escape') setRenamingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white border border-blue-400 rounded px-1 py-0 text-xs text-black outline-none w-24"
                  />
                ) : (
                  <span>{tab.title}</span>
                )}
                {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                <span
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: c.statusText }}
                >
                  {'\u00D7'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Divider — visual continuation of the pane splitter */}
        {dualPane && (
          <div
            className="self-stretch w-1.5 shrink-0"
            style={{ background: c.chromeText, opacity: 0.4 }}
          />
        )}

        {/* Right pane tab section — starts at left edge of right pane */}
        {dualPane && (
          <div className="flex flex-1 min-w-0 items-center overflow-x-auto">
            {secondaryTab ? (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0"
                style={{
                  background: c.tabActiveBg,
                  color: c.tabActiveText,
                  borderRight: `1px solid ${c.chromeBorder}`,
                }}
              >
                <span>{secondaryTab.title}</span>
                {secondaryTab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
              </div>
            ) : (
              <div
                className="flex items-center px-3 py-1.5 text-xs italic shrink-0"
                style={{ color: c.statusText }}
              >
                empty
              </div>
            )}
            {tabs.length > 1 && (
              <div className="flex items-center gap-1 px-2 shrink-0">
                <select
                  value={secondaryTabId || ''}
                  onChange={(e) => setSecondaryTab(e.target.value)}
                  className="text-[10px] rounded px-1 py-0.5 border-none outline-none"
                  style={{ background: c.chrome, color: c.chromeText }}
                >
                  <option value="" disabled>— pick —</option>
                  {tabs.filter((t) => t.id !== activeTabId).map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Clear all tabs — always visible at far right */}
        <button
          onClick={clearAllTabs}
          className="shrink-0 px-2 py-1.5 text-[10px] transition-colors border-l"
          style={{ color: c.statusText, borderColor: c.chromeBorder, background: c.tabInactiveBg }}
          title="Close all tabs"
          onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = c.tabHoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = c.statusText; e.currentTarget.style.background = c.tabInactiveBg; }}
        >
          ×all
        </button>
      </div>

      {/* Revision pipeline status bar */}
      {pipeline.status !== 'idle' && (
        <div
          className="flex items-center gap-3 px-3 py-1.5 shrink-0 text-xs"
          style={{ background: '#7C3AED', color: '#fff' }}
        >
          {/* Progress indicator */}
          <span className="font-semibold shrink-0">
            {pipeline.status === 'running' && `Revising ${pipeline.currentIndex + 1}/${pipeline.totalFiles}`}
            {pipeline.status === 'paused' && `Paused ${pipeline.currentIndex + 1}/${pipeline.totalFiles}`}
            {pipeline.status === 'complete' && `Done (${pipeline.totalFiles} files)`}
            {pipeline.status === 'cancelled' && 'Cancelled'}
            {pipeline.status === 'error' && 'Error'}
          </span>

          {/* Current file name */}
          {(pipeline.status === 'running' || pipeline.status === 'paused') && (
            <span className="truncate min-w-0">{pipeline.currentFileName}</span>
          )}

          {/* Error message */}
          {pipeline.status === 'error' && (
            <span className="truncate min-w-0 opacity-90">{pipeline.errorMessage}</span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Pause/auto toggle */}
          {(pipeline.status === 'running' || pipeline.status === 'paused') && (
            <label className="flex items-center gap-1 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pipeline.advanceMode === 'pause'}
                onChange={(e) => pipeline.setAdvanceMode(e.target.checked ? 'pause' : 'auto')}
                className="accent-white"
              />
              Pause
            </label>
          )}

          {/* Action buttons */}
          {pipeline.status === 'paused' && (
            <button
              onClick={() => pipeline.resumePipeline()}
              className="px-2 py-0.5 rounded font-semibold shrink-0"
              style={{ background: '#fff', color: '#7C3AED' }}
            >
              Continue
            </button>
          )}

          {(pipeline.status === 'running' || pipeline.status === 'paused') && (
            <button
              onClick={() => pipeline.cancelPipeline()}
              className="px-2 py-0.5 rounded font-semibold shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              Cancel
            </button>
          )}

          {(pipeline.status === 'complete' || pipeline.status === 'cancelled' || pipeline.status === 'error') && (
            <button
              onClick={() => pipeline.resetPipeline()}
              className="px-2 py-0.5 rounded font-semibold shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Formatting toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1 shrink-0 flex-wrap"
        style={{ background: c.chrome, borderBottom: `1px solid ${c.chromeBorder}` }}
        onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}
      >
        {TOOLBAR_ITEMS.map((item, i) => {
          if (item.sep) return <div key={i} className="w-px h-4 mx-1" style={{ background: c.chromeBorder }} />;
          return (
            <button
              key={i}
              onClick={() => handleFormat(item, getFocusedRef())}
              className="px-1.5 py-0.5 text-xs rounded transition-colors"
              style={{ color: c.toolbarBtn, ...(item.style || {}) }}
              title={item.title}
              onMouseEnter={(e) => { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; }}
            >
              {item.label}
            </button>
          );
        })}

        {/* Separator before color pickers */}
        <div className="w-px h-4 mx-1" style={{ background: c.chromeBorder }} />

        {/* Text color picker */}
        <div className="relative" ref={textColorRef}>
          <button
            onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowBgColorPicker(false); }}
            className="px-1.5 py-0.5 text-xs rounded transition-colors"
            style={{ color: c.toolbarBtn }}
            title="Text color (wraps selection)"
            onMouseEnter={(e) => { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="font-bold" style={{ textDecoration: 'underline', textDecorationColor: lastTextColor, textDecorationThickness: '2px' }}>A</span>
          </button>
          {showTextColorPicker && (
            <ColorPicker
              label="Text Color"
              onSelect={(color) => {
                setLastTextColor(color);
                getFocusedRef().current?.focus();
                document.execCommand('foreColor', false, color);
                const ref = getFocusedRef();
                const tabId = ref === primaryRef ? activeTabId : secondaryTabId;
                if (tabId && ref.current) updateTabContent(tabId, ref.current.innerHTML);
                setShowTextColorPicker(false);
              }}
              onReset={() => {
                getFocusedRef().current?.focus();
                document.execCommand('removeFormat', false, null);
                const ref = getFocusedRef();
                const tabId = ref === primaryRef ? activeTabId : secondaryTabId;
                if (tabId && ref.current) updateTabContent(tabId, ref.current.innerHTML);
                setShowTextColorPicker(false);
              }}
              onClose={() => setShowTextColorPicker(false)}
            />
          )}
        </div>

        {/* Background color picker */}
        <div className="relative" ref={bgColorRef}>
          <button
            onClick={() => { setShowBgColorPicker(!showBgColorPicker); setShowTextColorPicker(false); }}
            className="px-1.5 py-0.5 text-xs rounded transition-colors"
            style={{ color: c.toolbarBtn }}
            title="Background color (wraps selection)"
            onMouseEnter={(e) => { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="font-bold" style={{ background: lastBgColor, padding: '0 2px', borderRadius: '2px' }}>A</span>
          </button>
          {showBgColorPicker && (
            <ColorPicker
              label="Background Color"
              onSelect={(color) => {
                setLastBgColor(color);
                getFocusedRef().current?.focus();
                document.execCommand('hiliteColor', false, color);
                const ref = getFocusedRef();
                const tabId = ref === primaryRef ? activeTabId : secondaryTabId;
                if (tabId && ref.current) updateTabContent(tabId, ref.current.innerHTML);
                setShowBgColorPicker(false);
              }}
              onReset={() => {
                getFocusedRef().current?.focus();
                document.execCommand('hiliteColor', false, 'transparent');
                const ref = getFocusedRef();
                const tabId = ref === primaryRef ? activeTabId : secondaryTabId;
                if (tabId && ref.current) updateTabContent(tabId, ref.current.innerHTML);
                setShowBgColorPicker(false);
              }}
              onClose={() => setShowBgColorPicker(false)}
            />
          )}
        </div>

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowSearchBar(!showSearchBar)}
            className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
            style={showSearchBar
              ? { background: '#7C3AED', color: '#FFFFFF' }
              : { color: c.toolbarBtn }
            }
            title="Search & Replace (⌘H)"
            onMouseEnter={(e) => { if (!showSearchBar) { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; } }}
            onMouseLeave={(e) => { if (!showSearchBar) { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; } }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
          </button>
          <button
            onClick={() => setShowRevisionModal(true)}
            className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
            style={{ color: c.toolbarBtn }}
            title="AI chapter revision"
            onMouseEnter={(e) => { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; }}
          >
            Revise
          </button>
          <ToolsDropdown colors={c} />
          {/* Theme picker button */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors"
              style={{ color: c.chromeText }}
              title="Editor theme"
              onMouseEnter={(e) => { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.chromeText; e.currentTarget.style.background = 'transparent'; }}
            >
              <span
                className="w-3 h-3 rounded-sm border"
                style={{ background: c.bg, borderColor: c.chromeBorder }}
              />
              {t.name}
            </button>

            {showThemePicker && (
              <ThemePicker
                currentKey={editorTheme}
                onSelect={(key) => { setEditorTheme(key); setShowThemePicker(false); }}
              />
            )}
          </div>

          {dualPane && (
            <button
              onClick={toggleDiffMode}
              className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
              style={diffMode
                ? { background: '#7C3AED', color: '#FFFFFF' }
                : { color: c.toolbarBtn }
              }
              title="Toggle diff view between panes"
              onMouseEnter={(e) => { if (!diffMode) { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; } }}
              onMouseLeave={(e) => { if (!diffMode) { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; } }}
            >
              Diff
            </button>
          )}
          {dualPane && (
            <button
              onClick={toggleSyncScroll}
              className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
              style={syncScroll
                ? { background: '#7C3AED', color: '#FFFFFF' }
                : { color: c.toolbarBtn }
              }
              title="Sync scroll between panes"
              onMouseEnter={(e) => { if (!syncScroll) { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; } }}
              onMouseLeave={(e) => { if (!syncScroll) { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; } }}
            >
              Sync
            </button>
          )}
          <button
            onClick={toggleDualPane}
            className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
            style={dualPane
              ? { background: '#7C3AED', color: '#FFFFFF' }
              : { color: c.toolbarBtn }
            }
            title={dualPane ? 'Single pane' : 'Dual pane'}
            onMouseEnter={(e) => { if (!dualPane) { e.currentTarget.style.color = c.toolbarBtnHover; e.currentTarget.style.background = c.toolbarBtnHoverBg; } }}
            onMouseLeave={(e) => { if (!dualPane) { e.currentTarget.style.color = c.toolbarBtn; e.currentTarget.style.background = 'transparent'; } }}
          >
            {dualPane ? '\u2016 1' : '\u2016 2'}
          </button>
        </div>
      </div>

      {/* Search & Replace bar */}
      <SearchReplaceBar
        isOpen={showSearchBar}
        onClose={() => { setShowSearchBar(false); search.reset(); }}
        search={search}
        colors={c}
      />

      {/* Rich editor styles */}
      <style>{`
        .editor-content:empty::before { content: attr(data-placeholder); color: ${c.placeholder}; pointer-events: none; }
        .editor-content p { margin: 0 0 0.5em; }
        .editor-content h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0 0.3em; }
        .editor-content h2 { font-size: 1.3em; font-weight: bold; margin: 0.5em 0 0.3em; }
        .editor-content h3 { font-size: 1.15em; font-weight: bold; margin: 0.4em 0 0.2em; }
        .editor-content code { background: rgba(128,128,128,0.15); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
        .editor-content blockquote { border-left: 3px solid ${c.chromeBorder}; padding-left: 12px; margin: 0.4em 0; opacity: 0.85; }
        .editor-content img { max-width: 100%; border-radius: 6px; margin: 8px 0; display: block; }
        .editor-content a { color: #2563EB; text-decoration: underline; }
        .editor-content hr { border: none; border-top: 1px solid ${c.chromeBorder}; margin: 1em 0; }
        .editor-content ul, .editor-content ol { margin: 0.3em 0; padding-left: 1.5em; }
        ::highlight(search-results) { background-color: rgba(255, 255, 0, 0.4); }
        ::highlight(current-match) { background-color: rgba(255, 165, 0, 0.6); }
      `}</style>

      {/* Editor pane(s) — diff view replaces both panes when active */}
      {dualPane && diffMode && secondaryTab ? (
        <DiffView
          leftContent={activeTab?.content || ''}
          rightContent={secondaryTab?.content || ''}
          colors={c}
          onUpdateLeft={(content) => updateTabContent(activeTabId, content)}
          onUpdateRight={(content) => updateTabContent(secondaryTabId, content)}
        />
      ) : (
      <div ref={editorContainerRef} className="flex-1 flex min-h-0">
        {isCodePrimary ? (
          <CodePane
            content={activeTab?.content || ''}
            tabId={activeTabId}
            updateTabContent={updateTabContent}
            colors={c}
            isDark={t.family === 'dark'}
            fileName={activeTab?.title || ''}
            style={{
              width: dualPane ? `${splitPercent}%` : '100%',
              flexShrink: 0, minHeight: 0,
              borderTop: dualPane ? `2px solid ${focusedPane === 'primary' ? '#7C3AED' : 'transparent'}` : 'none',
            }}
            onFocus={() => { setFocusedPane('primary'); setSelectionRect(null); setSlashMenu(null); }}
          />
        ) : (
          <div
            ref={primaryRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => handleContentInput(primaryRef, activeTabId)}
            onPaste={handlePaste}
            onScroll={() => handleScroll('primary')}
            onMouseDown={() => { setFocusedPane('primary'); setSelectionRect(null); setSlashMenu(null); }}
            onMouseUp={handleEditorMouseUp}
            onKeyUp={handleEditorMouseUp}
            onKeyDown={handleEditorKeyDown}
            onFocus={() => setFocusedPane('primary')}
            className="editor-content font-mono text-sm p-4 outline-none leading-relaxed overflow-y-auto"
            style={{
              background: c.bg, color: c.text, caretColor: c.caret,
              width: dualPane ? `${splitPercent}%` : '100%',
              flexShrink: 0, minHeight: 0,
              borderTop: dualPane ? `2px solid ${focusedPane === 'primary' ? '#7C3AED' : 'transparent'}` : 'none',
            }}
            data-placeholder="Start writing..."
            spellCheck={true}
          />
        )}

        {dualPane && (
          <>
            <div
              onMouseDown={() => { paneDragging.current = true; }}
              onDoubleClick={() => setSplitPercent(50)}
              className="w-1.5 shrink-0 cursor-col-resize transition-colors"
              style={{ background: c.chromeText, opacity: 0.4 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={(e) => { if (!paneDragging.current) e.currentTarget.style.opacity = '0.4'; }}
            />
            {isCodeSecondary ? (
              <CodePane
                content={secondaryTab?.content || ''}
                tabId={secondaryTabId}
                updateTabContent={updateTabContent}
                colors={c}
                isDark={t.family === 'dark'}
                fileName={secondaryTab?.title || ''}
                style={{
                  flex: 1, minWidth: 0, minHeight: 0,
                  borderTop: `2px solid ${focusedPane === 'secondary' ? '#7C3AED' : 'transparent'}`,
                }}
                onFocus={() => { setFocusedPane('secondary'); setSelectionRect(null); setSlashMenu(null); }}
              />
            ) : (
              <div
                ref={secondaryRef}
                contentEditable={!!secondaryTab}
                suppressContentEditableWarning
                onInput={() => handleContentInput(secondaryRef, secondaryTabId)}
                onPaste={handlePaste}
                onScroll={() => handleScroll('secondary')}
                onMouseDown={() => { setFocusedPane('secondary'); setSelectionRect(null); setSlashMenu(null); }}
                onMouseUp={handleEditorMouseUp}
                onKeyUp={handleEditorMouseUp}
                onKeyDown={handleEditorKeyDown}
                onFocus={() => setFocusedPane('secondary')}
                className="editor-content font-mono text-sm p-4 outline-none leading-relaxed overflow-y-auto"
                style={{
                  background: c.bg, color: c.text, caretColor: c.caret,
                  flex: 1, minWidth: 0, minHeight: 0,
                  borderTop: `2px solid ${focusedPane === 'secondary' ? '#7C3AED' : 'transparent'}`,
                }}
                data-placeholder="Click a file to open in this pane..."
                spellCheck={true}
              />
            )}
          </>
        )}
      </div>
      )}

      {/* Status bar with prominent save */}
      <div
        className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ background: c.statusBg, borderTop: `1px solid ${c.chromeBorder}` }}
      >
        <div className="flex items-center gap-2 text-[11px]" style={{ color: c.statusText }}>
          <span>{activeTab?.title || 'No file'}</span>
          {activeTab?.dirty && (
            <span className="font-medium" style={{ color: '#F97316' }}>unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: c.statusText }}>
            {primaryWordCount} words
            {dualPane && secondaryTab && (
              <span style={{ color: c.chromeText }}>{' \u2502 '}{secondaryWordCount} words</span>
            )}
          </span>
          <span className="text-[10px]" style={{ color: c.statusText }}>{activeTab?.content?.length || 0} chars</span>

          {/* Prominent save button */}
          {activeTab?.fileHandle && (
            <button
              onClick={() => { if (activeTabId) saveTab(activeTabId); }}
              className="text-xs font-semibold px-3 py-0.5 rounded transition-colors"
              style={activeTab.dirty
                ? { background: '#2563EB', color: '#FFFFFF' }
                : { background: c.chrome, color: c.statusText, cursor: 'default' }
              }
              disabled={!activeTab.dirty}
              title={activeTab.dirty ? 'Save (Cmd+S)' : 'No changes to save'}
              onMouseEnter={(e) => { if (activeTab.dirty) e.currentTarget.style.background = '#1D4ED8'; }}
              onMouseLeave={(e) => { if (activeTab.dirty) e.currentTarget.style.background = '#2563EB'; }}
            >
              {activeTab.dirty ? 'Save' : 'Saved'}
            </button>
          )}
        </div>
      </div>

      <RevisionModal isOpen={showRevisionModal} onClose={() => setShowRevisionModal(false)} pipeline={pipeline} />

      {/* Floating AI button on selection */}
      {selectionRect && !inlineEdit && (
        <InlineEditPopup
          mode="button"
          anchorRect={selectionRect}
          onClick={handleInlineEditOpen}
          colors={c}
        />
      )}

      {/* Full inline edit popup */}
      {inlineEdit && (
        <InlineEditPopup
          mode="popup"
          onClose={() => setInlineEdit(null)}
          selectedText={inlineEdit.selectedText}
          savedRange={inlineEdit.savedRange}
          editorRef={inlineEdit.editorRef}
          tabId={inlineEdit.tabId}
          anchorRect={inlineEdit.rect}
          colors={c}
          isDark={t.family === 'dark'}
          updateTabContent={updateTabContent}
          initialPreset={inlineEdit.preset || null}
        />
      )}

      {/* Slash command menu */}
      {slashMenu && (() => {
        const items = defaultPrompts.filter((p) =>
          p.title.toLowerCase().includes(slashMenu.filterText)
        );
        if (items.length === 0) return null;
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: Math.min(slashMenu.rect.bottom + 4, window.innerHeight - 280),
              left: Math.min(Math.max(slashMenu.rect.left, 8), window.innerWidth - 220),
              zIndex: 60,
              width: 220,
              background: c.chrome,
              border: `1px solid ${c.chromeBorder}`,
              borderRadius: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              maxHeight: '240px',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: '4px 10px 2px', fontSize: '9px', fontWeight: 700, color: c.statusText, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prompts
            </div>
            {items.map((preset, i) => (
              <div
                key={preset.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSlashSelect(preset);
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  color: c.text,
                  cursor: 'pointer',
                  fontWeight: 500,
                  background: i === slashIndex
                    ? (t.family === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = t.family === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (i !== slashIndex) e.currentTarget.style.background = 'transparent';
                }}
              >
                {preset.title}
              </div>
            ))}
          </div>
        );
      })()}

      <ScriptOutputPanel colors={c} />
    </div>
  );
}

/** Visual theme picker popover with swatches. */
function ThemePicker({ currentKey, onSelect }) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl border p-3 w-64"
      style={{ background: '#FFFFFF', borderColor: '#E5E7EB' }}
    >
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Light</div>
      <div className="grid grid-cols-2 gap-1 mb-3">
        {lightThemes.map((theme) => (
          <ThemeSwatch
            key={theme.key}
            theme={theme}
            isActive={theme.key === currentKey}
            onClick={() => onSelect(theme.key)}
          />
        ))}
      </div>

      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Dark</div>
      <div className="grid grid-cols-2 gap-1">
        {darkThemes.map((theme) => (
          <ThemeSwatch
            key={theme.key}
            theme={theme}
            isActive={theme.key === currentKey}
            onClick={() => onSelect(theme.key)}
          />
        ))}
      </div>
    </div>
  );
}

/** A single theme swatch showing bg/text/chrome preview. */
function ThemeSwatch({ theme, isActive, onClick }) {
  const c = theme.colors;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded transition-all text-left"
      style={{
        background: isActive ? '#EDE9FE' : '#F9FAFB',
        border: isActive ? '2px solid #7C3AED' : '2px solid transparent',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#F3F4F6'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? '#EDE9FE' : '#F9FAFB'; }}
    >
      {/* Mini preview */}
      <div
        className="w-6 h-6 rounded-sm border flex items-center justify-center shrink-0"
        style={{ background: c.bg, borderColor: c.chromeBorder }}
      >
        <span className="text-[8px] font-bold" style={{ color: c.text }}>Aa</span>
      </div>
      <span className="text-[11px] text-gray-700 truncate">{theme.name}</span>
    </button>
  );
}

const PICKER_COLORS = [
  { label: 'Black', color: '#000000' },
  { label: 'Dark Gray', color: '#4B5563' },
  { label: 'Gray', color: '#9CA3AF' },
  { label: 'White', color: '#FFFFFF' },
  { label: 'Red', color: '#DC2626' },
  { label: 'Orange', color: '#EA580C' },
  { label: 'Amber', color: '#D97706' },
  { label: 'Yellow', color: '#FBBF24' },
  { label: 'Green', color: '#16A34A' },
  { label: 'Teal', color: '#0D9488' },
  { label: 'Blue', color: '#2563EB' },
  { label: 'Indigo', color: '#4F46E5' },
  { label: 'Purple', color: '#7C3AED' },
  { label: 'Pink', color: '#DB2777' },
  { label: 'Light Blue', color: '#93C5FD' },
  { label: 'Light Green', color: '#86EFAC' },
];

/** Shared color picker popover for text color and background color. */
function ColorPicker({ label, onSelect, onReset, onClose }) {
  return (
    <div
      className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-xl border p-2 w-44"
      style={{ background: '#FFFFFF', borderColor: '#E5E7EB' }}
    >
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{label}</div>
      <div className="grid grid-cols-4 gap-1">
        {PICKER_COLORS.map((fc) => (
          <button
            key={fc.color}
            onClick={() => onSelect(fc.color)}
            className="w-7 h-7 rounded-sm border transition-all hover:scale-110"
            style={{
              background: fc.color,
              borderColor: '#D1D5DB',
              borderWidth: '1px',
            }}
            title={fc.label}
          />
        ))}
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-1.5 w-full text-[10px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded py-0.5 transition-colors"
        >
          Reset to default
        </button>
      )}
    </div>
  );
}
