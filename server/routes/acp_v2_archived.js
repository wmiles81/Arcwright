/**
 * ACP (Agent Client Protocol) chat endpoint.
 *
 * POST /api/acp/chat
 * Body: { command, args?, prompt?, systemPrompt?, messages?, mcpServers?, env? }
 * Response: SSE stream of `data: {choices:[{delta:{content}}]}` lines, terminated by `data: [DONE]`.
 *
 * Spawns an ACP-compatible agent (claude-code-acp, gemini --experimental-acp, etc.)
 * as a stdio child process via @mcpc-tech/acp-ai-provider, runs the AI SDK's
 * streamText against it, and relays text chunks back to the browser.
 *
 * mcpServers is forwarded to the agent so user-configured MCP servers (Notion,
 * GitHub, Filesystem, etc.) are exposed alongside the built-in Arcwright server.
 */

import express from 'express';
import path from 'path';

const router = express.Router();

router.post('/acp/chat', async (req, res) => {
  const { command, args = [], prompt, systemPrompt, messages, mcpServers = [], env = {} } = req.body || {};

  if (!command) {
    return res.status(400).json({ error: 'Missing required field: command' });
  }
  if (!prompt && (!messages || messages.length === 0)) {
    return res.status(400).json({ error: 'Missing required field: prompt or messages' });
  }

  let provider;
  try {
    const { createACPProvider } = await import('@mcpc-tech/acp-ai-provider');
    const { streamText } = await import('ai');

    // Make sure local agent binaries (e.g. node_modules/.bin/claude-code-acp) resolve.
    const localBinPath = path.join(process.cwd(), 'node_modules', '.bin');
    const envPath = `${localBinPath}${path.delimiter}${process.env.PATH || ''}`;

    provider = createACPProvider({
      command,
      args,
      env: { ...env, PATH: envPath },
      session: {
        cwd: process.cwd(),
        mcpServers,
      },
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.flushHeaders?.();

    // streamText accepts EITHER `prompt` OR `messages`, never both.
    // If the caller sent a non-empty messages array, use it; otherwise fall back to prompt.
    const useMessages = Array.isArray(messages) && messages.length > 0;
    const streamArgs = {
      model: provider.languageModel(),
      system: systemPrompt || undefined,
      tools: provider.tools,
    };
    if (useMessages) {
      streamArgs.messages = messages;
    } else {
      streamArgs.prompt = prompt;
    }
    const { textStream } = streamText(streamArgs);

    // Abort the agent if the client disconnects.
    let aborted = false;
    req.on('close', () => { aborted = true; });

    for await (const chunk of textStream) {
      if (aborted) break;
      const data = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
      res.write(`data: ${data}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[ACP] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } finally {
    if (provider) {
      try { provider.cleanup?.(); } catch { /* ignore cleanup errors */ }
    }
  }
});

export default router;
