/**
 * Static provider registry.
 * Each entry defines connection details for an LLM API provider.
 * The protocol field determines which streaming implementation to use.
 */
export const PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 200+ models through a unified API',
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    protocol: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    completionsEndpoint: '/chat/completions',
    modelsEndpoint: '/models',
    defaultModel: 'anthropic/claude-sonnet-4-5-20250929',
    extraHeaders: () => ({ 'HTTP-Referer': window.location.origin }),
    supportsModelFetch: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4.1, o3, and more',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    protocol: 'openai-compat',
    baseUrl: 'https://api.openai.com/v1',
    completionsEndpoint: '/chat/completions',
    modelsEndpoint: '/models',
    defaultModel: 'gpt-4o',
    extraHeaders: () => ({}),
    supportsModelFetch: true,
    modelFilter: (m) => /^(gpt-|o[1-9]|chatgpt-)/.test(m.id),
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models via direct API',
    keyPlaceholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    protocol: 'anthropic-native',
    baseUrl: 'https://api.anthropic.com/v1',
    completionsEndpoint: '/messages',
    modelsEndpoint: '/models',
    defaultModel: 'claude-sonnet-4-5-20250929',
    extraHeaders: () => ({}),
    supportsModelFetch: true,
    // Metadata for enriching fetched models (API doesn't return these)
    knownModelMeta: {
      'claude-opus-4-6':     { supportedParameters: ['temperature', 'tools', 'reasoning'], contextLength: 200000, maxCompletionTokens: 32768 },
      'claude-sonnet-4-5':   { supportedParameters: ['temperature', 'tools', 'reasoning'], contextLength: 200000, maxCompletionTokens: 16384 },
      'claude-opus-4':       { supportedParameters: ['temperature', 'tools', 'reasoning'], contextLength: 200000, maxCompletionTokens: 32768 },
      'claude-sonnet-4':     { supportedParameters: ['temperature', 'tools', 'reasoning'], contextLength: 200000, maxCompletionTokens: 16384 },
      'claude-haiku-4-5':    { supportedParameters: ['temperature', 'tools'], contextLength: 200000, maxCompletionTokens: 8192 },
      'claude-3-5-sonnet':   { supportedParameters: ['temperature', 'tools'], contextLength: 200000, maxCompletionTokens: 8192 },
      'claude-3-5-haiku':    { supportedParameters: ['temperature', 'tools'], contextLength: 200000, maxCompletionTokens: 8192 },
      'claude-3-opus':       { supportedParameters: ['temperature', 'tools'], contextLength: 200000, maxCompletionTokens: 4096 },
    },
    // Fallback if fetch fails
    hardcodedModels: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', supportedParameters: ['temperature', 'tools', 'reasoning'], contextLength: 200000, maxCompletionTokens: 16384 },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', supportedParameters: ['temperature', 'tools', 'reasoning'], contextLength: 200000, maxCompletionTokens: 32768 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', supportedParameters: ['temperature', 'tools'], contextLength: 200000, maxCompletionTokens: 8192 },
    ],
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Search-augmented AI models',
    keyPlaceholder: 'pplx-...',
    keyUrl: 'https://www.perplexity.ai/settings/api',
    protocol: 'openai-compat',
    baseUrl: 'https://api.perplexity.ai',
    completionsEndpoint: '/chat/completions',
    defaultModel: 'sonar-pro',
    extraHeaders: () => ({}),
    supportsModelFetch: false,
    hardcodedModels: [
      { id: 'sonar-pro', name: 'Sonar Pro', supportedParameters: ['temperature'], contextLength: 200000, maxCompletionTokens: 8192 },
      { id: 'sonar', name: 'Sonar', supportedParameters: ['temperature'], contextLength: 128000, maxCompletionTokens: 8192 },
    ],
  },
};

export const PROVIDER_ORDER = ['openrouter', 'openai', 'anthropic', 'perplexity'];
