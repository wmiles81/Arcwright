/**
 * UndoNotification.jsx — F-009: Toast notification for undo actions
 *
 * Displays a themed toast after destructive actions with an Undo button.
 * Auto-dismisses after 5 seconds. Keyboard accessible.
 */
import React from 'react';
import useUndoStore, { undo } from '../../store/useUndoStore';
import useEditorStore from '../../store/useEditorStore';
import { getTheme } from '../edit/editorThemes';

export default function UndoNotification() {
    const toastLabel = useUndoStore((s) => s.toastLabel);
    const canUndo = useUndoStore((s) => s.canUndo);
    const theme = useEditorStore((s) => s.editorTheme);
    const c = getTheme(theme);

    if (!toastLabel) return null;

    const isUndone = toastLabel.startsWith('Undone:') || toastLabel.startsWith('Redone:');

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: c.chrome,
                color: c.text,
                border: `1px solid ${c.chromeBorder}`,
                borderRadius: 8,
                padding: '10px 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                fontSize: 13,
                fontWeight: 500,
                animation: 'undoSlideUp 0.25s ease-out',
            }}
        >
            <span style={{ opacity: 0.85 }}>{toastLabel}</span>
            {!isUndone && canUndo && (
                <button
                    onClick={() => undo()}
                    onKeyDown={(e) => { if (e.key === 'Enter') undo(); }}
                    style={{
                        background: '#7C3AED',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Undo
                </button>
            )}
            <style>{`
        @keyframes undoSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
        </div>
    );
}
