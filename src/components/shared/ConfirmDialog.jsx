import React, { useEffect, useRef } from 'react';
import useConfirmStore from '../../store/useConfirmStore';
import useEditorStore from '../../store/useEditorStore';
import { getTheme } from '../edit/editorThemes';

/**
 * F-010: In-app replacement for window.confirm().
 * Renders a themed, keyboard-accessible modal dialog.
 *
 * Mount once near the root of your app (e.g. in App.jsx or AppShell):
 *   <ConfirmDialog />
 */
export default function ConfirmDialog() {
    const isOpen = useConfirmStore((s) => s.isOpen);
    const message = useConfirmStore((s) => s.message);
    const confirmLabel = useConfirmStore((s) => s.confirmLabel);
    const cancelLabel = useConfirmStore((s) => s.cancelLabel);
    const danger = useConfirmStore((s) => s.danger);
    const accept = useConfirmStore((s) => s.accept);
    const reject = useConfirmStore((s) => s.reject);

    const themeName = useEditorStore((s) => s.editorTheme);
    const t = getTheme(themeName);
    const c = t.colors;

    const confirmRef = useRef(null);
    const cancelRef = useRef(null);

    // Focus the appropriate button when dialog opens
    useEffect(() => {
        if (!isOpen) return;
        // Focus cancel (safe action) for danger; confirm otherwise
        const target = danger ? cancelRef.current : confirmRef.current;
        requestAnimationFrame(() => target?.focus());
    }, [isOpen, danger]);

    // Keyboard handling: Escape rejects, Enter on focused button works natively
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); reject(); }
            if (e.key === 'Tab') {
                // Trap focus between Cancel and Confirm
                const els = [cancelRef.current, confirmRef.current].filter(Boolean);
                if (els.length < 2) return;
                const idx = els.indexOf(document.activeElement);
                if (e.shiftKey && idx <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
                else if (!e.shiftKey && idx >= els.length - 1) { e.preventDefault(); els[0].focus(); }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, reject]);

    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) reject(); }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label="Confirmation"
                aria-describedby="confirm-dialog-message"
                style={{
                    background: c.chrome,
                    color: c.text,
                    borderRadius: 12,
                    border: `1px solid ${c.chromeBorder}`,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    width: 380,
                    maxWidth: '90vw',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    animation: 'confirmDialogIn 0.15s ease-out',
                }}
            >
                <p
                    id="confirm-dialog-message"
                    style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}
                >
                    {message}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                        ref={cancelRef}
                        onClick={reject}
                        style={{
                            padding: '7px 18px',
                            fontSize: 13,
                            fontWeight: 600,
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: 'transparent',
                            color: c.chromeText,
                            border: `1px solid ${c.chromeBorder}`,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = c.toolbarBtnHoverBg || 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        onClick={accept}
                        style={{
                            padding: '7px 18px',
                            fontSize: 13,
                            fontWeight: 600,
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: 'none',
                            color: '#FFFFFF',
                            background: danger ? '#DC2626' : '#7C3AED',
                            transition: 'filter 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>

            {/* Entry animation */}
            <style>{`
        @keyframes confirmDialogIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
        </div>
    );
}
