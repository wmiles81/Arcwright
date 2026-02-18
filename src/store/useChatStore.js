import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  isStreaming: false,
  streamBuffer: '',
  error: null,
  abortController: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateStreamBuffer: (text) => set({ streamBuffer: text }),

  finalizeStream: (displayText, actionResults = []) => {
    const msg = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: displayText,
      timestamp: Date.now(),
      actions: actionResults,
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
