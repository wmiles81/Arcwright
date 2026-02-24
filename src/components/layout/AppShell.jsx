import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ChatPanel from '../chat/ChatPanel';
import useChatStore from '../../store/useChatStore';
import useProjectStore from '../../store/useProjectStore';
import ProjectsDialog from '../projects/ProjectsDialog';
import SettingsDialog from '../settings/SettingsDialog';

const SettingsContext = createContext(() => {});
export const useOpenSettings = () => useContext(SettingsContext);

export default function AppShell() {
  const isOpen = useChatStore((s) => s.isOpen);
  const togglePanel = useChatStore((s) => s.togglePanel);
  const location = useLocation();

  const isInitialized = useProjectStore((s) => s.isInitialized);
  const activeMode = useProjectStore((s) => s.activeMode);
  const activeBookProject = useProjectStore((s) => s.activeBookProject);
  const activeAiProject = useProjectStore((s) => s.activeAiProject);

  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Edit page manages its own chat panel — hide the global one
  const isEditRoute = location.pathname.startsWith('/edit');
  const showGlobalChat = isOpen && !isEditRoute;

  // --- Resizable chat panel ---
  const [chatWidth, setChatWidth] = useState(384);
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
      setChatWidth(Math.min(rect.width * 0.5, Math.max(280, px)));
    };
    const onMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded font-semibold text-sm transition-colors ${
      isActive
        ? 'bg-purple-600 text-white'
        : 'text-purple-300 hover:bg-purple-800 hover:text-white'
    }`;

  const activeProjectName = activeMode === 'book' ? activeBookProject : activeMode === 'ai' ? activeAiProject?.name : null;

  const openSettings = useCallback(() => setShowSettingsDialog(true), []);

  // Track which pane the mouse is over so Cmd+A can scope selection to it
  const activePaneRef = useRef(null);
  const chatPaneRef = useRef(null);
  const mainPaneRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'a') return;
      const active = document.activeElement;
      // Let native Cmd+A work in inputs, textareas, and contentEditable
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      const pane = activePaneRef.current;
      if (!pane) return;
      e.preventDefault();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pane);
      sel.removeAllRanges();
      sel.addRange(range);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <SettingsContext.Provider value={openSettings}>
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-900 to-purple-900 text-white overflow-hidden">
      <nav className="bg-slate-900/80 backdrop-blur border-b border-purple-500/30 shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 text-xl font-bold text-purple-200 hover:text-white transition-colors">
            <img src="/Arcwright-logotype.png" alt="Arcwright" className="h-full max-h-[40px] w-auto rounded-md" />
          </NavLink>
          <div className="flex gap-2 items-center">
            {activeProjectName && (
              <span className="text-xs px-2 py-1 rounded bg-purple-600/50 text-purple-200 font-medium max-w-[120px] truncate" title={activeProjectName}>
                {activeProjectName}
              </span>
            )}
            <NavLink to="/scaffold" className={linkClass}>
              Scaffold
            </NavLink>
            <NavLink to="/analyze" className={linkClass}>
              Analyze
            </NavLink>
            <NavLink to="/edit" className={linkClass}>
              Edit
            </NavLink>
            <button
              onClick={() => isInitialized && setShowProjectsDialog(true)}
              disabled={!isInitialized}
              className={`px-4 py-2 rounded font-semibold text-sm transition-colors border border-purple-500/30 ${
                isInitialized
                  ? 'text-purple-300 hover:bg-purple-800 hover:text-white cursor-pointer'
                  : 'text-purple-500/40 cursor-not-allowed'
              }`}
              title={isInitialized ? 'Manage projects' : 'Set up Arcwright storage first'}
            >
              Projects
            </button>
            <button
              onClick={() => setShowSettingsDialog(true)}
              className="px-3 py-2 rounded font-semibold text-sm transition-colors border border-purple-500/30 text-purple-300 hover:bg-purple-800 hover:text-white cursor-pointer"
              title="Settings"
            >
              {'\u2699'}
            </button>
            <NavLink to="/help" className={linkClass}>
              Help
            </NavLink>
          </div>
        </div>
      </nav>
      <div ref={containerRef} className="flex flex-1 min-h-0">
        {/* Toggle button — hidden on edit route */}
        {!isEditRoute && (
          <button
            onClick={togglePanel}
            className="absolute top-1/2 -translate-y-1/2 z-50 bg-black hover:bg-gray-800 text-white w-8 h-16 rounded-r-lg flex items-center justify-center shadow-lg transition-all duration-300"
            style={{ left: showGlobalChat ? chatWidth : 0 }}
            title={isOpen ? 'Close chat' : 'Open AI chat'}
          >
            <span className="text-lg">{isOpen ? '\u00AB' : '\u00BB'}</span>
          </button>
        )}

        {/* Chat panel — hidden on edit route */}
        {showGlobalChat && (
          <>
            <div
              ref={chatPaneRef}
              onMouseEnter={() => { activePaneRef.current = chatPaneRef.current; }}
              style={{ width: chatWidth }}
              className="shrink-0 flex flex-col min-h-0"
            >
              <ChatPanel />
            </div>
            <div
              onMouseDown={handleDividerDown}
              className="w-1.5 cursor-col-resize bg-purple-500/30 hover:bg-purple-500/60 flex-shrink-0 transition-colors"
            />
          </>
        )}

        {/* Main content — edit route uses full width with no padding/max-width */}
        {isEditRoute ? (
          <main
            ref={mainPaneRef}
            onMouseEnter={() => { activePaneRef.current = mainPaneRef.current; }}
            className="flex-1 min-w-0 min-h-0"
          >
            <Outlet />
          </main>
        ) : (
          <main
            ref={mainPaneRef}
            onMouseEnter={() => { activePaneRef.current = mainPaneRef.current; }}
            className="flex-1 overflow-y-auto p-6 min-w-0"
          >
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        )}
      </div>

      <ProjectsDialog isOpen={showProjectsDialog} onClose={() => setShowProjectsDialog(false)} />
      <SettingsDialog isOpen={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} />
    </div>
    </SettingsContext.Provider>
  );
}
