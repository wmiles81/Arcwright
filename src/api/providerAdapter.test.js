import { describe, it, expect, vi, afterEach } from 'vitest';
import { PROVIDERS } from '../api/providers';

// Mock useAppStore so getActiveProvider can read from it
vi.mock('../store/useAppStore', () => {
    const store = {
        activeProvider: 'openrouter',
        providers: {
            openrouter: {
                apiKey: 'test-key',
                selectedModel: 'anthropic/claude-sonnet-4-5-20250929',
                availableModels: [],
            },
            anthropic: {
                apiKey: 'sk-ant-test',
                selectedModel: 'claude-sonnet-4-5-20250929',
                availableModels: [],
            },
        },
    };
    return {
        default: { getState: () => store },
    };
});

// Mock chatStreaming and claude modules so they don't make real API calls
vi.mock('../api/chatStreaming', () => ({
    callClaudeStreaming: vi.fn(),
}));
vi.mock('../api/claude', () => ({
    callClaude: vi.fn(),
}));
vi.mock('../api/anthropicStreaming', () => ({
    callAnthropicStreaming: vi.fn(),
    callAnthropicSync: vi.fn(),
}));

// Import after mocks are set up
const { getActiveProvider, fetchModels } = await import('./providerAdapter');

// Store and restore real fetch
const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe('getActiveProvider', () => {
    it('returns the active provider config and user state', () => {
        const result = getActiveProvider();
        expect(result.providerId).toBe('openrouter');
        expect(result.config).toBe(PROVIDERS.openrouter);
        expect(result.apiKey).toBe('test-key');
        expect(result.selectedModel).toBe('anthropic/claude-sonnet-4-5-20250929');
    });
});

describe('fetchModels', () => {
    it('returns hardcoded models for providers without supportsModelFetch', async () => {
        const models = await fetchModels('perplexity', 'pplx-test');
        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('id');
        expect(models[0]).toHaveProperty('name');
    });

    it('throws on API error (no graceful fallback)', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
        });

        await expect(fetchModels('anthropic', 'bad-key')).rejects.toThrow(/401/);
    });

    it('returns sorted models when API call succeeds', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [
                    { id: 'zebra-model', name: 'Zebra' },
                    { id: 'alpha-model', name: 'Alpha' },
                ],
            }),
        });

        const models = await fetchModels('ollama', '');
        expect(models).toHaveLength(2);
        // fetchModels sorts alphabetically by id
        expect(models[0].id).toBe('alpha-model');
        expect(models[1].id).toBe('zebra-model');
    });

    it('throws on network error (no graceful fallback)', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(fetchModels('localai', '')).rejects.toThrow('ECONNREFUSED');
    });

    it('throws for unknown provider', async () => {
        await expect(fetchModels('nonexistent', '')).rejects.toThrow(/Unknown provider/);
    });
});
