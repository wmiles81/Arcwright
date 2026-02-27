import React, { useRef, useEffect } from 'react';
import useScriptStore from '../../store/useScriptStore';

export default function ScriptOutputPanel({ colors: c }) {
  const scriptOutput = useScriptStore((s) => s.scriptOutput);
  const showOutputPanel = useScriptStore((s) => s.showOutputPanel);
  const setShowOutputPanel = useScriptStore((s) => s.setShowOutputPanel);
  const logRef = useRef(null);

  const { isRunning, scriptName, logs, progress } = scriptOutput;

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  if (!showOutputPanel) return null;

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  const levelColor = (level) => {
    if (level === 'error') return '#DC2626';
    if (level === 'warn') return '#D97706';
    return c.text;
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        zIndex: 40,
        background: c.chrome,
        borderTop: `1px solid ${c.chromeBorder}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          borderBottom: `1px solid ${c.chromeBorder}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: c.chromeText }} role="status" aria-live="polite">
          {isRunning ? `Running: ${scriptName}` : scriptName || 'Script Output'}
        </span>
        <button
          onClick={() => setShowOutputPanel(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            color: c.statusText,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '0 2px',
          }}
          title="Close"
        >
          {'\u00D7'}
        </button>
      </div>

      {/* Progress bar */}
      {progress && (
        <div
          style={{
            height: 3,
            background: c.chromeBorder,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: '#7C3AED',
              transition: 'width 0.2s',
            }}
          />
        </div>
      )}

      {/* Log area */}
      <div
        ref={logRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px',
          fontFamily: 'monospace',
          fontSize: '11px',
          lineHeight: 1.6,
        }}
      >
        {logs.map((entry, i) => (
          <div key={i} style={{ color: levelColor(entry.level) }}>
            {entry.message}
          </div>
        ))}
        {isRunning && logs.length === 0 && (
          <div style={{ color: c.statusText, fontStyle: 'italic' }}>Waiting for output...</div>
        )}
      </div>
    </div>
  );
}
