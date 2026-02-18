const DEFAULT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Stream a chat completion via OpenAI-compatible API.
 * Calls onChunk(text) for each content delta, onDone(toolCalls) on completion, onError(err) on failure.
 * toolCalls is an object keyed by index — empty object when no tool calls are present.
 *
 * Options._apiUrl and _extraHeaders allow the provider adapter to route to different base URLs.
 */
export async function callClaudeStreaming(apiKey, messages, options = {}, onChunk, onDone, onError) {
  const apiUrl = options._apiUrl || DEFAULT_API_URL;
  const extraHeaders = options._extraHeaders || { 'HTTP-Referer': window.location.origin };

  const body = {
    model: options.model || 'anthropic/claude-sonnet-4-5-20250929',
    max_tokens: options.maxTokens || 4096,
    stream: true,
    messages,
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = 'auto';
  }
  if (options.temperature != null) body.temperature = options.temperature;

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') { onDone({}); return; }
    onError(new Error(`Network error: ${err.message}`));
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error.error?.message || `API request failed (${response.status})`;
    if (response.status === 401 || response.status === 403 || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('clerk')) {
      onError(new Error('API key authentication failed. Please check your key is valid and has credits remaining.'));
    } else {
      onError(new Error(msg));
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const toolCalls = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          onDone(toolCalls);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) onChunk(delta.content);
          // Accumulate streamed tool_calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone(toolCalls);
  } catch (err) {
    if (err.name === 'AbortError') { onDone(toolCalls); return; }
    onError(new Error(`Stream error: ${err.message}`));
  }
}

/**
 * Extract ```action ... ``` fenced blocks from LLM response text.
 * Returns array of { data: [actionObjects], raw, index } or { error, raw, index }.
 */
export function parseActions(text) {
  const pattern = /```action\s*\n([\s\S]*?)\n```/g;
  const actions = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      actions.push({
        raw: match[0],
        data: Array.isArray(parsed) ? parsed : [parsed],
        index: match.index,
      });
    } catch (e) {
      actions.push({ raw: match[0], error: e.message, index: match.index });
    }
  }

  return actions;
}

/**
 * Strip action code blocks from text for display.
 */
export function stripActionBlocks(text) {
  return text.replace(/```action\s*\n[\s\S]*?\n```/g, '').trim();
}
