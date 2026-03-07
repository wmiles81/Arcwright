import { describe, it, expect, beforeEach } from 'vitest';
import useChatStore from './useChatStore';

// Reset the store before each test
beforeEach(() => {
    useChatStore.setState({
        isOpen: false,
        draftInput: '',
        messages: [],
        isStreaming: false,
        streamBuffer: '',
        error: null,
        abortController: null,
    });
});

describe('useChatStore', () => {
    describe('panel state', () => {
        it('starts closed', () => {
            expect(useChatStore.getState().isOpen).toBe(false);
        });

        it('togglePanel flips isOpen', () => {
            useChatStore.getState().togglePanel();
            expect(useChatStore.getState().isOpen).toBe(true);
            useChatStore.getState().togglePanel();
            expect(useChatStore.getState().isOpen).toBe(false);
        });

        it('openPanel and closePanel set explicitly', () => {
            useChatStore.getState().openPanel();
            expect(useChatStore.getState().isOpen).toBe(true);
            useChatStore.getState().closePanel();
            expect(useChatStore.getState().isOpen).toBe(false);
        });
    });

    describe('messages', () => {
        const makeMsg = (id, content = 'hello') => ({
            id,
            role: 'user',
            content,
            timestamp: Date.now(),
        });

        it('addMessage appends to messages array', () => {
            useChatStore.getState().addMessage(makeMsg('m1'));
            useChatStore.getState().addMessage(makeMsg('m2'));
            expect(useChatStore.getState().messages).toHaveLength(2);
            expect(useChatStore.getState().messages[0].id).toBe('m1');
            expect(useChatStore.getState().messages[1].id).toBe('m2');
        });

        it('clearMessages resets messages and error', () => {
            useChatStore.getState().addMessage(makeMsg('m1'));
            useChatStore.getState().setError('some error');
            useChatStore.getState().clearMessages();
            expect(useChatStore.getState().messages).toHaveLength(0);
            expect(useChatStore.getState().error).toBeNull();
        });

        it('setMessages replaces all messages', () => {
            useChatStore.getState().addMessage(makeMsg('old'));
            useChatStore.getState().setMessages([makeMsg('new1'), makeMsg('new2')]);
            expect(useChatStore.getState().messages).toHaveLength(2);
            expect(useChatStore.getState().messages[0].id).toBe('new1');
        });

        it('truncateAfter keeps messages up to and including the target', () => {
            useChatStore.getState().addMessage(makeMsg('m1'));
            useChatStore.getState().addMessage(makeMsg('m2'));
            useChatStore.getState().addMessage(makeMsg('m3'));
            useChatStore.getState().truncateAfter('m2');
            expect(useChatStore.getState().messages).toHaveLength(2);
            expect(useChatStore.getState().messages[1].id).toBe('m2');
        });

        it('truncateAfter with unknown ID leaves messages unchanged', () => {
            useChatStore.getState().addMessage(makeMsg('m1'));
            useChatStore.getState().truncateAfter('nonexistent');
            expect(useChatStore.getState().messages).toHaveLength(1);
        });

        it('truncateFrom removes the target and everything after', () => {
            useChatStore.getState().addMessage(makeMsg('m1'));
            useChatStore.getState().addMessage(makeMsg('m2'));
            useChatStore.getState().addMessage(makeMsg('m3'));
            useChatStore.getState().truncateFrom('m2');
            expect(useChatStore.getState().messages).toHaveLength(1);
            expect(useChatStore.getState().messages[0].id).toBe('m1');
        });

        it('trimToLast keeps only the last N messages', () => {
            for (let i = 1; i <= 5; i++) {
                useChatStore.getState().addMessage(makeMsg(`m${i}`));
            }
            useChatStore.getState().trimToLast(2);
            expect(useChatStore.getState().messages).toHaveLength(2);
            expect(useChatStore.getState().messages[0].id).toBe('m4');
            expect(useChatStore.getState().messages[1].id).toBe('m5');
        });

        it('trimToLast with count >= messages length is a no-op', () => {
            useChatStore.getState().addMessage(makeMsg('m1'));
            useChatStore.getState().trimToLast(10);
            expect(useChatStore.getState().messages).toHaveLength(1);
        });
    });

    describe('streaming', () => {
        it('updateStreamBuffer sets the buffer', () => {
            useChatStore.getState().updateStreamBuffer('partial response');
            expect(useChatStore.getState().streamBuffer).toBe('partial response');
        });

        it('finalizeStream creates assistant message and resets stream state', () => {
            useChatStore.getState().setStreaming(true);
            useChatStore.getState().updateStreamBuffer('streaming...');
            useChatStore.getState().finalizeStream('Final response', [], { tokens: 42 });

            const { messages, streamBuffer, isStreaming, abortController } = useChatStore.getState();
            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('assistant');
            expect(messages[0].content).toBe('Final response');
            expect(messages[0].usage).toEqual({ tokens: 42 });
            expect(streamBuffer).toBe('');
            expect(isStreaming).toBe(false);
            expect(abortController).toBeNull();
        });
    });

    describe('getRecentMessages', () => {
        it('returns all messages when under the char limit', () => {
            useChatStore.getState().addMessage({ id: 'm1', role: 'user', content: 'short' });
            useChatStore.getState().addMessage({ id: 'm2', role: 'assistant', content: 'also short' });
            const recent = useChatStore.getState().getRecentMessages();
            expect(recent).toHaveLength(2);
        });

        it('trims oldest messages when over the char limit', () => {
            const longContent = 'x'.repeat(20000);
            useChatStore.getState().addMessage({ id: 'm1', role: 'user', content: longContent });
            useChatStore.getState().addMessage({ id: 'm2', role: 'user', content: longContent });
            useChatStore.getState().addMessage({ id: 'm3', role: 'user', content: 'short' });
            const recent = useChatStore.getState().getRecentMessages(25000);
            // Should include m2 + m3 (20000 + 5 = 20005), but not m1 (would push to 40005)
            expect(recent.length).toBeLessThan(3);
            expect(recent[recent.length - 1].id).toBe('m3');
        });
    });
});
