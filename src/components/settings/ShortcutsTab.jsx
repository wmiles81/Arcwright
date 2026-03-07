/**
 * ShortcutsTab.jsx — F-012: Settings tab for remappable keyboard shortcuts
 *
 * Renders a table of all keyboard shortcuts with record-to-remap,
 * per-row reset, and conflict detection.
 */
import React, { useState, useEffect, useCallback } from 'react';
import useShortcutStore, {
    DEFAULT_SHORTCUTS,
    getBinding,
    formatBinding,
    findConflict,
} from '../../store/useShortcutStore';

export default function ShortcutsTab({ colors: c }) {
    const { overrides, setShortcut, resetShortcut, resetAll } = useShortcutStore();
    const [recordingId, setRecordingId] = useState(null);
    const [conflict, setConflict] = useState(null); // { id, conflictsWith }

    // Listen for keydown when recording
    const handleKeyDown = useCallback(
        (e) => {
            if (!recordingId) return;
            e.preventDefault();
            e.stopPropagation();

            // Ignore bare modifier presses
            if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return;

            const binding = {
                key: e.key,
                meta: e.metaKey || e.ctrlKey || undefined,
                shift: e.shiftKey || undefined,
                alt: e.altKey || undefined,
            };
            // Clean up falsy modifiers
            if (!binding.meta) delete binding.meta;
            if (!binding.shift) delete binding.shift;
            if (!binding.alt) delete binding.alt;

            // Check for conflicts
            const conflictId = findConflict(recordingId, binding);
            if (conflictId) {
                setConflict({ id: recordingId, conflictsWith: conflictId });
            } else {
                setConflict(null);
                setShortcut(recordingId, binding);
            }
            setRecordingId(null);
        },
        [recordingId, setShortcut]
    );

    useEffect(() => {
        if (recordingId) {
            document.addEventListener('keydown', handleKeyDown, true);
            return () => document.removeEventListener('keydown', handleKeyDown, true);
        }
    }, [recordingId, handleKeyDown]);

    // Cancel recording on Escape
    useEffect(() => {
        if (!recordingId) return;
        const cancel = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setRecordingId(null);
            }
        };
        document.addEventListener('keydown', cancel, true);
        return () => document.removeEventListener('keydown', cancel, true);
    }, [recordingId]);

    const ids = Object.keys(DEFAULT_SHORTCUTS);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: c.text }}>Keyboard Shortcuts</h3>
                <button
                    onClick={resetAll}
                    style={{
                        background: 'transparent',
                        color: c.chromeText,
                        border: `1px solid ${c.chromeBorder}`,
                        padding: '4px 12px',
                        borderRadius: 5,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        opacity: Object.keys(overrides).length > 0 ? 1 : 0.4,
                    }}
                    disabled={Object.keys(overrides).length === 0}
                >
                    Reset All
                </button>
            </div>

            {conflict && (
                <div
                    role="alert"
                    style={{
                        background: '#7f1d1d',
                        color: '#fca5a5',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        marginBottom: 12,
                    }}
                >
                    Conflict: that binding is already used by <b>{DEFAULT_SHORTCUTS[conflict.conflictsWith]?.label}</b>
                </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ borderBottom: `1px solid ${c.chromeBorder}`, color: c.chromeText, textAlign: 'left' }}>
                        <th style={{ padding: '6px 0', fontWeight: 600 }}>Action</th>
                        <th style={{ padding: '6px 16px', fontWeight: 600, textAlign: 'center' }}>Shortcut</th>
                        <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right', width: 80 }}></th>
                    </tr>
                </thead>
                <tbody>
                    {ids.map((id) => {
                        const binding = getBinding(id);
                        const isOverridden = !!overrides[id];
                        const isRecording = recordingId === id;

                        return (
                            <tr
                                key={id}
                                style={{
                                    borderBottom: `1px solid ${c.chromeBorder}22`,
                                    background: isRecording ? `${c.chromeBorder}33` : 'transparent',
                                }}
                            >
                                <td style={{ padding: '8px 0', color: c.text }}>{binding.label}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                    {isRecording ? (
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '3px 10px',
                                                borderRadius: 4,
                                                border: '1px dashed #7C3AED',
                                                color: '#7C3AED',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                animation: 'pulse 1.2s infinite',
                                            }}
                                        >
                                            Press a key…
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => { setRecordingId(id); setConflict(null); }}
                                            style={{
                                                display: 'inline-block',
                                                padding: '3px 10px',
                                                borderRadius: 4,
                                                background: isOverridden ? '#7C3AED22' : `${c.chromeBorder}55`,
                                                border: isOverridden ? '1px solid #7C3AED55' : `1px solid ${c.chromeBorder}`,
                                                color: c.text,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                                cursor: 'pointer',
                                                minWidth: 60,
                                            }}
                                            title="Click to remap"
                                        >
                                            {formatBinding(binding)}
                                        </button>
                                    )}
                                </td>
                                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                                    {isOverridden && (
                                        <button
                                            onClick={() => { resetShortcut(id); setConflict(null); }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: c.chromeText,
                                                fontSize: 11,
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                            }}
                                        >
                                            Reset
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}
