import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  isOpen: false,
  draftInput: '',
  messages: [],
  isStreaming: false,
  streamBuffer: '',
  error: null,
  abortController: null,

  setDraftInput: (v) => set({ draftInput: v }),

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateStreamBuffer: (text) => set({ streamBuffer: text }),

  finalizeStream: (displayText, actionResults = [], usage = null) => {
    const msg = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: displayText,
      timestamp: Date.now(),
      actions: actionResults,
      ...(usage && { usage }),
    };
    set((s) => ({
      messages: [...s.messages, msg],
      streamBuffer: '',
      isStreaming: false,
      abortController: null,
    }));
  },

  clearMessages: () => set({ messages: [], error: null }),
  setMessages: (msgs) => set({ messages: msgs || [], error: null }),

  // Remove all messages after a given message ID (for regenerate)
  truncateAfter: (messageId) => set((s) => {
    const idx = s.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return s;
    return { messages: s.messages.slice(0, idx + 1) };
  }),

  // Keep only the most recent N messages (for context management)
  trimToLast: (count) => set((s) => ({
    messages: s.messages.length > count ? s.messages.slice(-count) : s.messages,
  })),

  // Remove a message and all messages after it (for edit - removes the message being edited too)
  truncateFrom: (messageId) => set((s) => {
    const idx = s.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return s;
    return { messages: s.messages.slice(0, idx) };
  }),

  setError: (err) => set({ error: err }),
  setStreaming: (v) => set({ isStreaming: v }),
  setAbortController: (ac) => set({ abortController: ac }),
  abortStream: () => {
    const { abortController } = get();
    if (abortController) abortController.abort();
  },

  getRecentMessages: (maxChars = 32000) => {
    const { messages } = get();
    let total = 0;
    const result = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const len = (messages[i].content || '').length;
      if (total + len > maxChars && result.length > 0) break;
      total += len;
      result.unshift(messages[i]);
    }
    return result;
  },
}));

export default useChatStore;
