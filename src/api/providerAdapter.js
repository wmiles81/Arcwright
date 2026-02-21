/**
 * Unified provider adapter.
 * Routes API calls to the correct protocol implementation based on the active provider.
 * All consumers should use these functions instead of calling claude.js / chatStreaming.js directly.
 */
import useAppStore from '../store/useAppStore';
import { PROVIDERS } from './providers';
import { callClaudeStreaming } from './chatStreaming';
import { callClaude } from './claude';
import { callAnthropicStreaming, callAnthropicSync } from './anthropicStreaming';

/**
 * Get the active provider's config + user state.
 * Returns { providerId, config, apiKey, selectedModel, availableModels }.
 */
export function getActiveProvider() {
  const { activeProvider, providers } = useAppStore.getState();
  const config = PROVIDERS[activeProvider];
  const state = providers[activeProvider] || {};
  return {
    providerId: activeProvider,
    config,
    apiKey: state.apiKey || '',
    selectedModel: state.selectedModel || config?.defaultModel || '',
    availableModels: state.availableModels || [],
  };
}

/**
 * Fetch models for a given provider.
 * For API-backed providers, fetches from their models endpoint.
 * For others, returns hardcoded models.
 * Normalizes all results to the standard model shape.
 */
export async function fetchModels(providerId, apiKey) {
  const config = PROVIDERS[providerId];
  if (!config) throw new Error(`Unknown provider: ${providerId}`);

  if (!config.supportsModelFetch) {
    return config.hardcodedModels || [];
  }

  // Anthropic uses different auth headers and response format
  if (config.protocol === 'anthropic-native') {
    return fetchAnthropicModels(config, apiKey);
  }

  const url = `${config.baseUrl}${config.modelsEndpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...config.extraHeaders(apiKey),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models from ${config.name} (${response.status})`);
  }

  const data = await response.json();
  let models = (data.data || []).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    supportedParameters: m.supported_parameters || [],
    contextLength: m.context_length,
    maxCompletionTokens: m.top_provider?.max_completion_tokens,
    pricing: m.pricing,
    inputModalities: m.architecture?.input_modalities || ['text'],
  }));

  if (config.modelFilter) {
    models = models.filter(config.modelFilter);
  }

  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Fetch models from the Anthropic /v1/models endpoint.
 * Handles pagination (has_more), different auth headers,
 * and enriches results with knownModelMeta from the provider config.
 */
async function fetchAnthropicModels(config, apiKey) {
  const allModels = [];
  let afterId = null;
  const limit = 100;

  // Paginate through all models
  while (true) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (afterId) params.set('after_id', afterId);

    const url = `${config.baseUrl}${config.modelsEndpoint}?${params}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${config.name} (${response.status})`);
    }

    const data = await response.json();
    const items = data.data || [];
    allModels.push(...items);

    if (!data.has_more || items.length === 0) break;
    afterId = items[items.length - 1].id;
  }

  const meta = config.knownModelMeta || {};

  // Normalize to our standard model shape, enriching with knownModelMeta
  let models = allModels.map((m) => {
    // Match meta by checking if the model id starts with a known key
    const metaKey = Object.keys(meta).find((k) => m.id.startsWith(k));
    const enrichment = metaKey ? meta[metaKey] : {};

    return {
      id: m.id,
      name: m.display_name || m.id,
      supportedParameters: enrichment.supportedParameters || ['temperature'],
      contextLength: enrichment.contextLength,
      maxCompletionTokens: enrichment.maxCompletionTokens,
    };
  });

  if (config.modelFilter) {
    models = models.filter(config.modelFilter);
  }

  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Fetch image-capable models for a given provider.
 *
 * OpenRouter: uses /api/frontend/models/find?output_modalities=image
 *   — the standard /models endpoint omits most image generators.
 * OpenAI: filters /models for known image model IDs.
 * Others: returns empty (no image generation support known).
 */
export async function fetchImageModels(providerId, apiKey) {
  const config = PROVIDERS[providerId];
  if (!config) throw new Error(`Unknown provider: ${providerId}`);

  // Anthropic doesn't offer image generation models
  if (config.protocol === 'anthropic-native') {
    return [];
  }

  // OpenRouter: dedicated image model discovery endpoint
  if (providerId === 'openrouter') {
    return fetchOpenRouterImageModels(apiKey, config);
  }

  // OpenAI: filter standard models list for DALL-E
  if (providerId === 'openai') {
    return fetchOpenAIImageModels(apiKey, config);
  }

  // Other providers: try standard /models with client-side filter
  if (!config.supportsModelFetch) {
    return (config.hardcodedModels || []).filter(isImageModel);
  }

  return [];
}

/**
 * OpenRouter image model discovery.
 * Uses /api/frontend/models/find?output_modalities=image which returns
 * all models that can generate images (Flux, Sourceful, Gemini Image, GPT-5 Image, etc.).
 */
async function fetchOpenRouterImageModels(apiKey, config) {
  const url = 'https://openrouter.ai/api/frontend/models/find?q=&output_modalities=image';
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...config.extraHeaders(apiKey),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image models from OpenRouter (${response.status})`);
  }

  const data = await response.json();
  const items = data.data || data || [];

  return (Array.isArray(items) ? items : [])
    .map((m) => ({
      id: m.slug || m.id,
      name: m.name || m.slug || m.id,
      pricing: m.endpoint?.pricing || m.pricing,
      architecture: m.architecture,
      outputModalities: m.output_modalities,
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * OpenAI image model discovery.
 * Filters the standard /models list for DALL-E models.
 */
async function fetchOpenAIImageModels(apiKey, config) {
  const url = `${config.baseUrl}${config.modelsEndpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...config.extraHeaders(apiKey),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models from OpenAI (${response.status})`);
  }

  const data = await response.json();
  return (data.data || [])
    .filter((m) => isImageModel(m))
    .map((m) => ({
      id: m.id,
      name: m.id,
      pricing: null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function isImageModel(m) {
  return /dall-e|gpt.*image/i.test(m.id || m.name || '');
}

/**
 * Streaming completion — routes to the correct protocol.
 * Uses the active provider from the store.
 *
 * @param {Array} messages - OpenAI-format messages array
 * @param {Object} options - { maxTokens, temperature, tools, signal, model? }
 * @param {Function} onChunk - called with text deltas
 * @param {Function} onDone - called with toolCalls object on completion
 * @param {Function} onError - called with Error on failure
 */
export async function callCompletion(messages, options, onChunk, onDone, onError) {
  const { config, apiKey, selectedModel } = getActiveProvider();
  if (!apiKey) {
    onError(new Error('No API key configured. Open Settings to add one.'));
    return;
  }

  const model = options.model || selectedModel;

  if (config.protocol === 'anthropic-native') {
    return callAnthropicStreaming(apiKey, messages, { ...options, model }, onChunk, onDone, onError);
  }

  // OpenAI-compatible path (OpenRouter, OpenAI, Perplexity)
  const apiUrl = `${config.baseUrl}${config.completionsEndpoint}`;
  const extraHeaders = config.extraHeaders(apiKey);

  return callClaudeStreaming(apiKey, messages, {
    ...options,
    model,
    _apiUrl: apiUrl,
    _extraHeaders: extraHeaders,
    _streamOptions: config.supportsStreamOptions === true,
  }, onChunk, onDone, onError);
}

/**
 * Non-streaming completion — routes to the correct protocol.
 * Uses the active provider from the store.
 *
 * @param {string} systemPrompt - system prompt text
 * @param {string} userMessage - user message text
 * @param {Object} options - { maxTokens, model? }
 * @returns {Promise<string>} response text
 */
export async function callCompletionSync(systemPrompt, userMessage, options = {}) {
  const { config, apiKey, selectedModel } = getActiveProvider();
  if (!apiKey) {
    throw new Error('No API key configured. Open Settings to add one.');
  }

  const model = options.model || selectedModel;

  if (config.protocol === 'anthropic-native') {
    return callAnthropicSync(apiKey, systemPrompt, userMessage, { ...options, model });
  }

  // OpenAI-compatible path
  const apiUrl = `${config.baseUrl}${config.completionsEndpoint}`;
  const extraHeaders = config.extraHeaders(apiKey);

  return callClaude(apiKey, systemPrompt, userMessage, {
    ...options,
    model,
    _apiUrl: apiUrl,
    _extraHeaders: extraHeaders,
  });
}

/**
 * Cross-provider non-streaming completion.
 * Allows specifying a different provider than the active one.
 *
 * @param {string} providerId - provider key (openrouter, openai, anthropic)
 * @param {string} systemPrompt - system prompt text
 * @param {string} userMessage - user message text
 * @param {Object} options - { maxTokens, model? }
 * @returns {Promise<string>} response text
 */
export async function callCompletionWithProvider(providerId, systemPrompt, userMessage, options = {}) {
  const { providers } = useAppStore.getState();
  const config = PROVIDERS[providerId];
  if (!config) throw new Error(`Unknown provider: ${providerId}`);

  const state = providers[providerId] || {};
  const apiKey = state.apiKey;
  if (!apiKey) throw new Error(`No API key configured for ${config.name}`);

  const model = options.model || state.selectedModel || config.defaultModel;

  if (config.protocol === 'anthropic-native') {
    return callAnthropicSync(apiKey, systemPrompt, userMessage, { ...options, model });
  }

  // OpenAI-compatible path
  const apiUrl = `${config.baseUrl}${config.completionsEndpoint}`;
  const extraHeaders = config.extraHeaders(apiKey);

  return callClaude(apiKey, systemPrompt, userMessage, {
    ...options,
    model,
    _apiUrl: apiUrl,
    _extraHeaders: extraHeaders,
  });
}
