import React, { useState, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import useProjectStore from '../../store/useProjectStore';
import { getTheme } from '../edit/editorThemes';
import BookProjectList from './BookProjectList';
import AiProjectList from './AiProjectList';

export default function ProjectsDialog({ isOpen, onClose }) {
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const t = getTheme(editorTheme);
  const c = t.colors;

  const [activeTab, setActiveTab] = useState('books'); // 'books' | 'ai'

  // Track what the user has selected but not yet committed
  const [pendingBookProject, setPendingBookProject] = useState(null);
  const [pendingAiProject, setPendingAiProject] = useState(null);

  const activeBookProject = useProjectStore((s) => s.activeBookProject);
  const activeAiProject = useProjectStore((s) => s.activeAiProject);
  const activeMode = useProjectStore((s) => s.activeMode);

  // Load projects + sync selection when dialog opens
  useEffect(() => {
    if (isOpen) {
      useProjectStore.getState().loadProjects();
      setPendingBookProject(activeBookProject);
      setPendingAiProject(activeAiProject);
      if (activeMode === 'ai') setActiveTab('ai');
      else setActiveTab('books');
    }
  }, [isOpen, activeBookProject, activeAiProject, activeMode]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleOk = async () => {
    if (activeTab === 'books') {
      if (pendingBookProject) {
        await useProjectStore.getState().activateBookProject(pendingBookProject);
      } else if (activeMode === 'book') {
        await useProjectStore.getState().deactivateProject();
      }
    } else {
      if (pendingAiProject) {
        await useProjectStore.getState().activateAiProject(pendingAiProject);
      } else if (activeMode === 'ai') {
        await useProjectStore.getState().deactivateProject();
      }
    }
    onClose();
  };

  const isDark = t.family === 'dark';
  const tabStyle = (active) => ({
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? c.text : c.chromeText,
    background: 'none',
    border: 'none',
    borderBottom: active ? `2px solid #7C3AED` : '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 0.15s',
  });

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
          width: 640,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 0',
            borderBottom: `1px solid ${c.chromeBorder}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Arcwright Projects</h2>
            <button
              onClick={onClose}
              style={{ color: c.chromeText, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
            >
              {'\u2715'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <button style={tabStyle(activeTab === 'books')} onClick={() => setActiveTab('books')}>
              Book Projects
            </button>
            <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
              AI Projects
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 200 }}>
          {activeTab === 'books' ? (
            <BookProjectList
              selected={pendingBookProject}
              onSelect={setPendingBookProject}
              colors={c}
              isDark={isDark}
            />
          ) : (
            <AiProjectList
              selected={pendingAiProject}
              onSelect={setPendingAiProject}
              colors={c}
              isDark={isDark}
            />
          )}
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
            onClick={handleOk}
            style={{
              background: '#7C3AED',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
