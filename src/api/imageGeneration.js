/**
 * Image generation API client.
 *
 * OpenRouter: uses /chat/completions with modalities: ["image"] — returns
 *   base64 data URLs in the assistant message's content array.
 * OpenAI: uses /images/generations with response_format: "b64_json".
 */
import useAppStore from '../store/useAppStore';
import { PROVIDERS } from './providers';

/**
 * Generate an image using the configured image provider + model.
 *
 * @param {string} prompt - Image description
 * @param {Object} options - { size? } overrides
 * @returns {Promise<{ b64_json: string, revised_prompt?: string }>}
 */
export async function generateImage(prompt, options = {}) {
  const { imageSettings, providers } = useAppStore.getState();
  const providerId = imageSettings.provider;
  const modelId = imageSettings.model;

  if (!providerId || !modelId) {
    throw new Error('Image generation not configured. Set a provider and model in Settings \u2192 Image.');
  }

  const config = PROVIDERS[providerId];
  if (!config) throw new Error(`Unknown provider: ${providerId}`);

  const provState = providers[providerId];
  const apiKey = provState?.apiKey;
  if (!apiKey) throw new Error(`No API key configured for ${config.name}`);

  // OpenRouter uses /chat/completions with modalities parameter
  if (providerId === 'openrouter') {
    return generateViaCompletions(config, apiKey, modelId, prompt, options);
  }

  // OpenAI and others use /images/generations
  return generateViaImagesEndpoint(config, apiKey, modelId, prompt, options);
}

/**
 * OpenRouter path: POST /chat/completions with modalities: ["image"].
 * Response contains base64 data URLs in the message content array.
 */
async function generateViaCompletions(config, apiKey, modelId, prompt, options) {
  const size = options.size || useAppStore.getState().imageSettings.defaultSize || '1024x1024';
  const [w, h] = size.split('x').map(Number);
  // Map size to aspect ratio for image_config
  const ratioMap = { '1024x1024': '1:1', '1792x1024': '16:9', '1024x1792': '9:16', '512x512': '1:1' };
  const aspectRatio = ratioMap[size] || '1:1';

  const body = {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image'],
    image_config: { aspect_ratio: aspectRatio },
  };

  const url = `${config.baseUrl}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let msg = `Image generation failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch (_) {
      if (errBody.length > 0) msg += `: ${errBody.substring(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();

  // Extract base64 image from the assistant message content
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('No response from image model');

  // Content may be a string or an array of parts
  const content = message.content;
  let b64_json = null;

  if (Array.isArray(content)) {
    // Look for image_url parts with base64 data URLs
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const dataUrl = part.image_url.url;
        // Extract base64 from data:image/png;base64,... or data:image/jpeg;base64,...
        const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (match) {
          b64_json = match[1];
          break;
        }
      }
    }
  }

  // Also check the images field (some OpenRouter responses put it here)
  if (!b64_json && message.images && message.images.length > 0) {
    const img = message.images[0];
    if (typeof img === 'string') {
      const match = img.match(/^data:image\/[^;]+;base64,(.+)$/);
      b64_json = match ? match[1] : img;
    } else if (img.url) {
      const match = img.url.match(/^data:image\/[^;]+;base64,(.+)$/);
      b64_json = match ? match[1] : null;
    }
  }

  if (!b64_json) {
    throw new Error('No image data found in response. The model may not support image output.');
  }

  return { b64_json, revised_prompt: null };
}

/**
 * Standard OpenAI path: POST /images/generations with response_format: "b64_json".
 */
async function generateViaImagesEndpoint(config, apiKey, modelId, prompt, options) {
  const size = options.size || useAppStore.getState().imageSettings.defaultSize || '1024x1024';

  const body = {
    model: modelId,
    prompt,
    n: 1,
    size,
    response_format: 'b64_json',
  };

  const url = `${config.baseUrl}/images/generations`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let msg = `Image generation failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch (_) {
      if (errBody.length > 0) msg += `: ${errBody.substring(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  if (!data.data || data.data.length === 0) {
    throw new Error('No image data in response');
  }

  return data.data[0];
}
