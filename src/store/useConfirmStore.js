import { create } from 'zustand';

/**
 * Tiny store powering an in-app confirm dialog (F-010).
 *
 * Usage:
 *   import { confirm } from '../store/useConfirmStore';
 *   const yes = await confirm('Delete this file?');
 *   if (yes) { ... }
 */
const useConfirmStore = create((set) => ({
    isOpen: false,
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false,
    _resolve: null,

    show: ({ message, confirmLabel, cancelLabel, danger }) => {
        return new Promise((resolve) => {
            set({
                isOpen: true,
                message,
                confirmLabel: confirmLabel || 'Confirm',
                cancelLabel: cancelLabel || 'Cancel',
                danger: danger ?? false,
                _resolve: resolve,
            });
        });
    },

    accept: () => {
        const { _resolve } = useConfirmStore.getState();
        _resolve?.(true);
        set({ isOpen: false, _resolve: null });
    },

    reject: () => {
        const { _resolve } = useConfirmStore.getState();
        _resolve?.(false);
        set({ isOpen: false, _resolve: null });
    },
}));

/**
 * Convenience wrapper: `const yes = await confirm('Delete?')`
 * Accepts a string (message only) or options object.
 */
export function confirm(messageOrOpts) {
    const opts = typeof messageOrOpts === 'string'
        ? { message: messageOrOpts }
        : messageOrOpts;
    return useConfirmStore.getState().show(opts);
}

export default useConfirmStore;
