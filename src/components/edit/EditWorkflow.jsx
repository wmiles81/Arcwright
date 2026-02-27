import React, { useState, useRef, useCallback, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import useAppStore from '../../store/useAppStore';
import useSequenceStore from '../../store/useSequenceStore';
import ChatPanel from '../chat/ChatPanel';
import FilePanel from './FilePanel';
import MarkdownEditor from './MarkdownEditor';
import SequencesPanel from '../sequences/SequencesPanel';
import { DIMENSION_KEYS } from '../../data/dimensions';

const LEFT_TABS = [
  { key: 'chat', label: 'Chat' },
  { key: 'files', label: 'Files' },
  { key: 'variables', label: 'Variables' },
  { key: 'sequences', label: 'Sequences' },
];

export default function EditWorkflow() {
  const leftPanelTab = useEditorStore((s) => s.leftPanelTab);
  const setLeftPanelTab = useEditorStore((s) => s.setLeftPanelTab);
  const runningSequence = useSequenceStore((s) => s.runningSequence);

  // --- Resizable left panel ---
  const [leftWidth, setLeftWidth] = useState(320);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const handleDividerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      setLeftWidth(Math.min(rect.width * 0.5, Math.max(240, px)));
    };
    const onMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Left panel */}
      <div style={{ width: leftWidth }} className="shrink-0 flex flex-col min-h-0 bg-g-bg border-r border-g-border">
        {/* Tab bar */}
        <div className="flex border-b border-g-border shrink-0">
          {LEFT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setLeftPanelTab(tab.key)}
              className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                leftPanelTab === tab.key
                  ? 'bg-g-bg text-g-text border-b-2 border-g-text'
                  : 'bg-g-chrome text-g-muted hover:text-g-text hover:bg-g-bg'
              }`}
            >
              {tab.label}
              {tab.key === 'sequences' && runningSequence && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {leftPanelTab === 'chat' && <ChatPanel />}
          {leftPanelTab === 'files' && <FilePanel />}
          {leftPanelTab === 'variables' && <VariablesPanel />}
          {leftPanelTab === 'sequences' && <SequencesPanel />}
        </div>
      </div>

      {/* Drag divider */}
      <div
        onMouseDown={handleDividerDown}
        className="w-1.5 cursor-col-resize bg-purple-500/30 hover:bg-purple-500/60 flex-shrink-0 transition-colors"
      />

      {/* Editor area */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-900">
        <MarkdownEditor />
      </div>
    </div>
  );
}

function VariablesPanel() {
  const chapters = useAppStore((s) => s.chapters);
  const scaffoldBeats = useAppStore((s) => s.scaffoldBeats);
  const selectedGenre = useAppStore((s) => s.selectedGenre);

  const hasChapters = chapters.length > 0;
  const hasBeats = scaffoldBeats.length > 0;

  return (
    <div className="p-3 overflow-y-auto text-sm text-g-text">
      <h3 className="text-xs font-bold text-g-muted uppercase mb-3">Chapter Variables</h3>

      {!hasChapters && !hasBeats && (
        <p className="text-g-status text-xs">
          No chapter data yet. Add chapters in the Analyze workflow or beats in Scaffold to see dimension targets here.
        </p>
      )}

      {hasChapters && (
        <div className="space-y-2 mb-4">
          <div className="text-[10px] font-bold text-g-status uppercase">Analyzed Chapters</div>
          {chapters.map((ch, i) => {
            const scores = ch.userScores || ch.aiScores;
            return (
              <div key={ch.id} className="bg-g-chrome rounded p-2">
                <div className="font-medium text-xs mb-1">
                  {i + 1}. {ch.title || 'Untitled'}
                </div>
                {scores && (
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[10px] text-g-muted">
                    {DIMENSION_KEYS.map((k) => (
                      <span key={k}>
                        {k}: <span className="font-mono">{scores[k] != null ? Number(scores[k]).toFixed(1) : '-'}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasBeats && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-g-status uppercase">Scaffold Beats</div>
          {scaffoldBeats.map((beat, i) => (
            <div key={beat.id} className="bg-g-chrome rounded p-2">
              <div className="font-medium text-xs mb-1">
                {i + 1}. {beat.label || 'Untitled'} <span className="text-g-status">({beat.time}%)</span>
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[10px] text-g-muted">
                {DIMENSION_KEYS.map((k) => (
                  <span key={k}>
                    {k}: <span className="font-mono">{beat[k] != null ? Number(beat[k]).toFixed(1) : '-'}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
