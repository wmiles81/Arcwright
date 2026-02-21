const DEFAULT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Check if a model uses max_completion_tokens instead of max_tokens.
 * Newer OpenAI models (o1, o3, GPT-5+) require the new parameter name.
 */
function usesMaxCompletionTokens(modelId) {
  if (!modelId) return false;
  const id = modelId.toLowerCase();
  // Match o1, o3, o4, gpt-5, gpt-6, etc. with optional openai/ prefix
  return /^(openai\/)?(o[1-9]|gpt-[5-9])/.test(id);
}

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

  const modelId = options.model || 'anthropic/claude-sonnet-4-5-20250929';
  const tokenLimit = options.maxTokens || 4096;

  const body = {
    model: modelId,
    stream: true,
    messages,
  };
  if (options._streamOptions) {
    body.stream_options = { include_usage: true };
  }

  // Newer OpenAI models (o1, o3, GPT-5+) require max_completion_tokens
  if (usesMaxCompletionTokens(modelId)) {
    body.max_completion_tokens = tokenLimit;
  } else {
    body.max_tokens = tokenLimit;
  }
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
    onError(new Error('Could not reach the API — check your internet connection and try again.'));
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
  let usage = null;

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
          onDone(toolCalls, usage);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          // Capture usage from the final chunk (OpenAI/OpenRouter include it here)
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens,
              completionTokens: parsed.usage.completion_tokens,
              totalTokens: parsed.usage.total_tokens,
            };
          }
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
    onDone(toolCalls, usage);
  } catch (err) {
    if (err.name === 'AbortError') { onDone(toolCalls, usage); return; }
    const isNetworkDrop = err.name === 'TypeError' || /network|fetch/i.test(err.message);
    onError(new Error(isNetworkDrop
      ? 'Connection lost mid-response. This can happen when the output is very long or the context is too large. Try again, or reduce context size.'
      : `Stream error: ${err.message}`
    ));
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

/**
 * Parse <tool_call>...</tool_call> tags from LLM response text.
 * Some models (e.g., Arcee Trinity) output this format as plain text
 * instead of using the structured OpenAI tool_calls response format.
 * Returns array of { name, arguments, raw }.
 */
export function parseToolCallTags(text) {
  const pattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  const toolCalls = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      // Handle both { name, arguments } and { name, arguments: "{}" } formats
      let args = parsed.arguments || {};
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }
      toolCalls.push({
        raw: match[0],
        name: parsed.name,
        arguments: args,
      });
    } catch (e) {
      console.warn('[parseToolCallTags] Failed to parse:', match[1], e.message);
    }
  }

  return toolCalls;
}

/**
 * Strip <tool_call>...</tool_call> tags from text for display.
 */
export function stripToolCallTags(text) {
  return text.replace(/<tool_call>\s*[\s\S]*?\s*<\/tool_call>/g, '').trim();
}

/**
 * Extract balanced JSON objects from text that contain a "tool" key.
 * Handles nested braces properly by counting brace depth.
 */
function extractToolJsonObjects(text) {
  const results = [];
  let i = 0;

  while (i < text.length) {
    // Find potential start of JSON object
    const start = text.indexOf('{"tool"', i);
    if (start === -1) break;

    // Find matching closing brace by counting depth
    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;

    for (let j = start; j < text.length; j++) {
      const char = text[j];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\' && inString) {
        escape = true;
        continue;
      }

      if (char === '"' && !escape) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') depth++;
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            end = j + 1;
            break;
          }
        }
      }
    }

    if (end > start) {
      results.push({ raw: text.substring(start, end), start, end });
      i = end;
    } else {
      i = start + 1;
    }
  }

  return results;
}

/**
 * Parse {"tool": "toolName", ...params} JSON objects from LLM response text.
 * Some models output this format when they intend to call tools but don't use
 * the structured tool_calls API or XML tags.
 * Handles nested objects and arrays properly.
 * Returns array of { name, arguments, raw }.
 */
export function parseInlineToolJson(text) {
  const toolCalls = [];
  const candidates = extractToolJsonObjects(text);

  for (const { raw } of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.tool && typeof parsed.tool === 'string') {
        const { tool, ...args } = parsed;
        toolCalls.push({
          raw,
          name: tool,
          arguments: args,
        });
      }
    } catch (e) {
      console.warn('[parseInlineToolJson] Failed to parse:', raw.substring(0, 100), e.message);
    }
  }

  return toolCalls;
}

/**
 * Strip {"tool": ...} JSON objects from text for display.
 */
export function stripInlineToolJson(text) {
  const candidates = extractToolJsonObjects(text);
  let result = text;
  // Remove in reverse order to preserve indices
  for (let i = candidates.length - 1; i >= 0; i--) {
    const { start, end } = candidates[i];
    result = result.substring(0, start) + result.substring(end);
  }
  return result.trim();
}
