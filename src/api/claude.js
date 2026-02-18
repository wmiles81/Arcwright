const DEFAULT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5-20250929';

export async function callClaude(apiKey, systemPrompt, userMessage, options = {}) {
  const apiUrl = options._apiUrl || DEFAULT_API_URL;
  const extraHeaders = options._extraHeaders || { 'HTTP-Referer': window.location.origin };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      max_tokens: options.maxTokens || 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error.error?.message || `API request failed (${response.status})`;
    if (response.status === 401 || response.status === 403 || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('clerk')) {
      throw new Error('API key authentication failed. Please check your key is valid and has credits remaining.');
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function fetchOpenRouterModels(apiKey) {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models (${response.status})`);
  }

  const data = await response.json();
  return data.data
    .map((m) => ({
      id: m.id,
      name: m.name,
      supportedParameters: m.supported_parameters || [],
      contextLength: m.context_length,
      maxCompletionTokens: m.top_provider?.max_completion_tokens,
      pricing: m.pricing,
      inputModalities: m.architecture?.input_modalities || ['text'],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function modelSupportsTools(model) {
  return model?.supportedParameters?.includes('tools') ?? false;
}

// Attempt to repair common JSON issues from LLM output
function repairJson(str) {
  let s = str;
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Remove control characters except \n \r \t
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  return s;
}

// Try to close truncated JSON by balancing braces/brackets
function closeTruncatedJson(str) {
  let s = str.trimEnd();
  // Remove a trailing partial string value (unterminated quote)
  if ((s.match(/"/g) || []).length % 2 !== 0) {
    s = s.replace(/"[^"]*$/, '""');
  }
  // Remove trailing comma
  s = s.replace(/,\s*$/, '');
  // Count open/close braces and brackets
  const opens = { '{': 0, '[': 0 };
  const closeChar = { '{': '}', '[': ']' };
  for (const ch of s) {
    if (ch === '{') opens['{']++;
    else if (ch === '}') opens['{']--;
    else if (ch === '[') opens['[']++;
    else if (ch === ']') opens['[']--;
  }
  // Append closing characters in reverse nesting order
  for (let i = 0; i < opens['[']; i++) s += ']';
  for (let i = 0; i < opens['{']; i++) s += '}';
  return s;
}

// Parse JSON from LLM response, handling markdown code blocks and common issues
export function parseJsonResponse(text) {
  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  let jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // If no code block, try to find the outermost JSON object
  if (!codeBlockMatch) {
    const firstBrace = jsonStr.indexOf('{');
    if (firstBrace > 0) {
      jsonStr = jsonStr.slice(firstBrace);
    }
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0 && lastBrace < jsonStr.length - 1) {
      jsonStr = jsonStr.slice(0, lastBrace + 1);
    }
  }

  // Attempt 1: direct parse
  try {
    return JSON.parse(jsonStr);
  } catch (_) { /* fall through */ }

  // Attempt 2: repair trailing commas / control chars
  try {
    return JSON.parse(repairJson(jsonStr));
  } catch (_) { /* fall through */ }

  // Attempt 3: close truncated JSON (model ran out of tokens)
  try {
    return JSON.parse(repairJson(closeTruncatedJson(jsonStr)));
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}`);
  }
}
