/**
 * Anthropic Messages API implementation.
 * Handles the different request/response format, auth headers, and SSE event types.
 * Outputs tool calls in the same shape as the OpenAI-compat path so the agentic
 * loop in useChatSend works unchanged.
 */

const ANTHROPIC_API_VERSION = '2023-06-01';

/**
 * Convert OpenAI-format tools to Anthropic format.
 * OpenAI: { type: 'function', function: { name, description, parameters } }
 * Anthropic: { name, description, input_schema }
 */
function toAnthropicTools(openaiTools) {
  if (!openaiTools?.length) return undefined;
  return openaiTools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/**
 * Convert OpenAI-format messages to Anthropic format.
 * Extracts the system message (Anthropic uses a top-level `system` field).
 * Converts tool results from OpenAI `role: 'tool'` to Anthropic `role: 'user'`
 * with `type: 'tool_result'` content blocks.
 * Converts assistant tool_calls to Anthropic `tool_use` content blocks.
 */
function toAnthropicMessages(messages) {
  let system = null;
  const converted = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
      continue;
    }

    if (msg.role === 'tool') {
      // Anthropic: tool results are sent as user messages with tool_result content blocks
      converted.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.tool_call_id, content: msg.content }],
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls) {
      // Convert assistant message with tool_calls to Anthropic format
      const content = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.tool_calls) {
        let input = {};
        try { input = JSON.parse(tc.function.arguments); } catch { /* empty */ }
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
      }
      converted.push({ role: 'assistant', content });
      continue;
    }

    // Regular user/assistant text messages
    converted.push({ role: msg.role, content: msg.content });
  }

  return { system, messages: converted };
}

/**
 * Stream a chat completion from Anthropic's Messages API.
 * Translates tool calls to the same output format as chatStreaming.js.
 */
export async function callAnthropicStreaming(apiKey, messages, options = {}, onChunk, onDone, onError) {
  const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

  const body = {
    model: options.model || 'claude-sonnet-4-5-20250929',
    max_tokens: options.maxTokens || 4096,
    stream: true,
    messages: anthropicMessages,
  };
  if (system) body.system = system;
  if (options.temperature != null) body.temperature = options.temperature;

  const anthropicTools = toAnthropicTools(options.tools);
  if (anthropicTools?.length) {
    body.tools = anthropicTools;
    body.tool_choice = { type: 'auto' };
  }

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
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
    const msg = error.error?.message || `Anthropic API request failed (${response.status})`;
    if (response.status === 401 || response.status === 403) {
      onError(new Error('Anthropic API key authentication failed. Please check your key is valid.'));
    } else {
      onError(new Error(msg));
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Accumulate tool_use blocks → convert to OpenAI tool_calls format
  const toolUseBlocks = {}; // keyed by content block index
  let currentBlockIndex = null;
  let toolCallCounter = 0;

  // Output in the same shape as chatStreaming.js: { [index]: { id, type:'function', function:{ name, arguments } } }
  const toolCalls = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = null;
      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('event: ')) {
          eventType = trimmed.slice(7);
          continue;
        }

        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') { onDone(toolCalls); return; }

        try {
          const parsed = JSON.parse(data);

          switch (eventType) {
            case 'content_block_start': {
              currentBlockIndex = parsed.index;
              if (parsed.content_block?.type === 'tool_use') {
                toolUseBlocks[currentBlockIndex] = {
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  jsonBuffer: '',
                };
              }
              break;
            }

            case 'content_block_delta': {
              const delta = parsed.delta;
              if (delta?.type === 'text_delta' && delta.text) {
                onChunk(delta.text);
              } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
                const block = toolUseBlocks[parsed.index];
                if (block) block.jsonBuffer += delta.partial_json;
              }
              break;
            }

            case 'content_block_stop': {
              const block = toolUseBlocks[parsed.index];
              if (block) {
                // Finalize this tool call in OpenAI format
                toolCalls[toolCallCounter] = {
                  id: block.id,
                  type: 'function',
                  function: {
                    name: block.name,
                    arguments: block.jsonBuffer,
                  },
                };
                toolCallCounter++;
              }
              currentBlockIndex = null;
              break;
            }

            case 'message_stop':
              onDone(toolCalls);
              return;

            // message_start, message_delta, ping — ignored
            default:
              break;
          }
        } catch {
          // skip malformed chunks
        }

        eventType = null;
      }
    }
    onDone(toolCalls);
  } catch (err) {
    if (err.name === 'AbortError') { onDone(toolCalls); return; }
    onError(new Error(`Stream error: ${err.message}`));
  }
}

/**
 * Non-streaming completion via Anthropic Messages API.
 * Returns the text content of the response.
 */
export async function callAnthropicSync(apiKey, systemPrompt, userMessage, options = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });

  const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

  const body = {
    model: options.model || 'claude-sonnet-4-5-20250929',
    max_tokens: options.maxTokens || 4096,
    messages: anthropicMessages,
  };
  if (system) body.system = system;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error.error?.message || `Anthropic API request failed (${response.status})`;
    if (response.status === 401 || response.status === 403) {
      throw new Error('Anthropic API key authentication failed. Please check your key is valid.');
    }
    throw new Error(msg);
  }

  const data = await response.json();
  // Anthropic returns content as an array of blocks
  const textBlock = data.content?.find((b) => b.type === 'text');
  return textBlock?.text || '';
}
