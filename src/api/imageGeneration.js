/**
 * Image generation API client.
 *
 * OpenRouter: uses /chat/completions — image models return the image as a
 *   data URL or remote URL in the message content. No special modalities param.
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

  if (providerId === 'openrouter') {
    // All OpenRouter image models use /chat/completions, but modalities differ:
    // - Dual-output models (Gemini Image, GPT-5 Image): modalities: ["image", "text"]
    // - Image-only models (Flux, Seedream, Sourceful): modalities: ["image"]
    const isDualOutput = /^(google\/gemini.*image|openai\/gpt-5-image)/i.test(modelId);
    return generateViaOpenRouter(config, apiKey, modelId, prompt, options, isDualOutput);
  }

  // OpenAI and others use /images/generations
  return generateViaImagesEndpoint(config, apiKey, modelId, prompt, options);
}

/**
 * OpenRouter: POST /chat/completions with the image model.
 * No modalities param — image models return the image in the message content
 * as a data URL or remote URL.
 */
async function generateViaOpenRouter(config, apiKey, modelId, prompt, options, isDualOutput = true) {
  const size = options.size || useAppStore.getState().imageSettings.defaultSize || '1024x1024';
  const ratioMap = { '1024x1024': '1:1', '1792x1024': '16:9', '1024x1792': '9:16', '512x512': '1:1' };
  const aspectRatio = ratioMap[size] || '1:1';

  const body = {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    modalities: isDualOutput ? ['image', 'text'] : ['image'],
    image_config: { aspect_ratio: aspectRatio },
  };

  const url = `${config.baseUrl}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
  };

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let msg = `Image generation failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch (_) {
      if (errBody.length > 0 && !errBody.startsWith('<!')) msg += `: ${errBody.substring(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('No response from image model');

  const content = message.content;
  let imageUrl = null;

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) { imageUrl = part.image_url.url; break; }
      if (part.type === 'image' && part.url) { imageUrl = part.url; break; }
    }
  } else if (typeof content === 'string') {
    // Some models return the URL as plain text
    const urlMatch = content.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp)(\?\S*)?/i);
    if (urlMatch) imageUrl = urlMatch[0];
    else if (content.startsWith('data:image')) imageUrl = content;
  }

  if (!imageUrl && Array.isArray(message.images) && message.images.length > 0) {
    const img = message.images[0];
    // Documented format: { type: "image_url", image_url: { url: "data:..." } }
    imageUrl = typeof img === 'string' ? img
      : (img.image_url?.url || img.url || null);
  }

  if (!imageUrl) {
    console.error('[imageGeneration] Unexpected response:', JSON.stringify(data).slice(0, 500));
    throw new Error('No image found in response. Verify the model supports image generation.');
  }

  // Data URL → extract base64
  const dataMatch = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/s);
  if (dataMatch) return { b64_json: dataMatch[1], revised_prompt: null };

  // Remote URL → fetch and convert
  if (imageUrl.startsWith('http')) {
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error(`Failed to download generated image (${imgResponse.status})`);
    const arrayBuffer = await imgResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { b64_json: btoa(binary), revised_prompt: null };
  }

  throw new Error('Unrecognized image format in response.');
}

/**
 * Standard OpenAI path: POST /images/generations.
 * gpt-image-1 always returns b64_json and rejects response_format.
 * DALL-E 2/3 need response_format: 'b64_json' to get base64 instead of expiring URLs.
 */
async function generateViaImagesEndpoint(config, apiKey, modelId, prompt, options) {
  const size = options.size || useAppStore.getState().imageSettings.defaultSize || '1024x1024';

  const body = { model: modelId, prompt, n: 1, size };

  // gpt-image-1 does not accept response_format (always returns b64_json).
  if (!modelId.startsWith('gpt-image')) {
    body.response_format = 'b64_json';
  }

  const url = `${config.baseUrl}/images/generations`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
  };

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let msg = `Image generation failed (${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch (_) {
      if (errBody.length > 0 && !errBody.startsWith('<!')) msg += `: ${errBody.substring(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  if (!data.data || data.data.length === 0) throw new Error('No image data in response');

  const item = data.data[0];
  if (item.b64_json) return item;

  // URL response — fetch and convert to base64
  if (item.url) {
    const imgResponse = await fetch(item.url);
    if (!imgResponse.ok) throw new Error(`Failed to download generated image (${imgResponse.status})`);
    const arrayBuffer = await imgResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { b64_json: btoa(binary), revised_prompt: item.revised_prompt };
  }

  throw new Error('No image data in response (expected b64_json or url)');
}
