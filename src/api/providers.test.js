import { describe, it, expect } from 'vitest';
import { PROVIDERS, PROVIDER_ORDER } from './providers';

describe('PROVIDERS registry', () => {
    it('contains all providers listed in PROVIDER_ORDER', () => {
        for (const id of PROVIDER_ORDER) {
            expect(PROVIDERS[id]).toBeDefined();
            expect(PROVIDERS[id].id).toBe(id);
        }
    });

    it('PROVIDER_ORDER contains no unknown providers', () => {
        for (const id of PROVIDER_ORDER) {
            expect(Object.keys(PROVIDERS)).toContain(id);
        }
    });

    it('every provider has required fields', () => {
        const requiredFields = ['id', 'name', 'protocol', 'baseUrl', 'completionsEndpoint', 'defaultModel'];
        for (const [id, config] of Object.entries(PROVIDERS)) {
            for (const field of requiredFields) {
                expect(config, `${id} missing ${field}`).toHaveProperty(field);
            }
        }
    });

    it('every provider has an extraHeaders function', () => {
        for (const [id, config] of Object.entries(PROVIDERS)) {
            expect(typeof config.extraHeaders, `${id}.extraHeaders`).toBe('function');
        }
    });

    it('local providers have requiresApiKey set to false', () => {
        const localProviders = ['ollama', 'lmstudio', 'janai', 'localai'];
        for (const id of localProviders) {
            expect(PROVIDERS[id].requiresApiKey, `${id}.requiresApiKey`).toBe(false);
        }
    });

    it('cloud providers do not set requiresApiKey to false', () => {
        const cloudProviders = ['openrouter', 'openai', 'anthropic', 'perplexity'];
        for (const id of cloudProviders) {
            expect(PROVIDERS[id].requiresApiKey, `${id}.requiresApiKey`).not.toBe(false);
        }
    });

    it('providers with hardcodedModels have at least one model', () => {
        for (const [id, config] of Object.entries(PROVIDERS)) {
            if (config.hardcodedModels) {
                expect(config.hardcodedModels.length, `${id} hardcodedModels`).toBeGreaterThan(0);
                for (const model of config.hardcodedModels) {
                    expect(model, `${id} model entry`).toHaveProperty('id');
                    expect(model, `${id} model entry`).toHaveProperty('name');
                }
            }
        }
    });

    it('anthropic provider uses anthropic-native protocol', () => {
        expect(PROVIDERS.anthropic.protocol).toBe('anthropic-native');
    });

    it('all other cloud providers use openai-compat protocol', () => {
        for (const id of ['openrouter', 'openai', 'perplexity']) {
            expect(PROVIDERS[id].protocol, `${id}.protocol`).toBe('openai-compat');
        }
    });
});
