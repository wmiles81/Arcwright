import React, { useState, useRef, useEffect } from 'react';
import builtinScripts from '../../scripts/builtinScripts';
import useScriptStore from '../../store/useScriptStore';
import { runScript } from '../../scripts/scriptRunner';
import ScriptEditorDialog from './ScriptEditorDialog';

export default function ToolsDropdown({ colors: c }) {
  const [open, setOpen] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const ref = useRef(null);
  const userScripts = useScriptStore((s) => s.userScripts);

  // Outside-click close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scripts visible from toolbar (not folder-only)
  const toolbarBuiltin = builtinScripts.filter((s) => s.context !== 'folder');
  const toolbarUser = userScripts.filter((s) => s.context !== 'folder');

  const handleRun = (script) => {
    setOpen(false);
    runScript(script);
  };

  const handleManage = () => {
    setOpen(false);
    setShowManager(true);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors"
        style={{ color: c.toolbarBtn }}
        title="Scripts & Tools"
        aria-label="Scripts and Tools menu"
        aria-expanded={open}
        aria-haspopup="true"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = c.toolbarBtnHover;
          e.currentTarget.style.background = c.toolbarBtnHoverBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = c.toolbarBtn;
          e.currentTarget.style.background = 'transparent';
        }}
      >
        Tools
        <span style={{ fontSize: '7px', marginLeft: 1 }}>{'\u25BC'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 50,
            width: 220,
            background: c.chrome,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
          role="menu"
        >
          {toolbarBuiltin.map((script) => (
            <div
              key={script.id}
              onClick={() => handleRun(script)}
              role="menuitem"
              tabIndex={-1}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                color: c.text,
                cursor: 'pointer',
                fontWeight: 500,
              }}
              title={script.description}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = c.toolbarBtnHoverBg || 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {script.name}
            </div>
          ))}

          {toolbarUser.length > 0 && (
            <>
              <div
                style={{
                  borderTop: `1px solid ${c.chromeBorder}`,
                  padding: '4px 10px 2px',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: c.statusText,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: 2,
                }}
              >
                Custom
              </div>
              {toolbarUser.map((script) => (
                <div
                  key={script.id}
                  onClick={() => handleRun(script)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    color: c.text,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  title={script.description || ''}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = c.toolbarBtnHoverBg || 'rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {script.name}
                </div>
              ))}
            </>
          )}

          <div style={{ borderTop: `1px solid ${c.chromeBorder}`, marginTop: 2 }}>
            <div
              onClick={handleManage}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                color: c.statusText,
                cursor: 'pointer',
                fontStyle: 'italic',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = c.toolbarBtnHoverBg || 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Manage Scripts...
            </div>
          </div>
        </div>
      )}
      <ScriptEditorDialog
        isOpen={showManager}
        onClose={() => setShowManager(false)}
        colors={c}
      />
    </div>
  );
}
