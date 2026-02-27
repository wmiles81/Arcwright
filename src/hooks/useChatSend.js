import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useChatStore from '../store/useChatStore';
import useProjectStore from '../store/useProjectStore';
import { parseActions, stripActionBlocks, parseToolCallTags, stripToolCallTags, parseInlineToolJson, stripInlineToolJson } from '../api/chatStreaming';
import { callCompletion } from '../api/providerAdapter';
import { executeActions, ACTION_HANDLERS } from '../chat/actionExecutor';
import { buildChatSystemPrompt, buildAiProjectSystemPrompt } from '../chat/contextBuilder';
import { buildEditModePrompt } from '../chat/editPrompts';
import { modelSupportsTools } from '../api/claude';
import { PROVIDERS } from '../api/providers';
import { toolDefinitions } from '../chat/toolDefinitions';
import useEditorStore from '../store/useEditorStore';

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOOL_RESULT_CHARS = 6000;

export default function useChatSend() {
  const location = useLocation();

  return useCallback(async (userText) => {
    const chat = useChatStore.getState();
    const app = useAppStore.getState();
    const provState = app.providers[app.activeProvider] || {};

    if (!provState.apiKey) {
      chat.setError('No API key configured. Open Settings to add one.');
      return;
    }
    if (chat.isStreaming) return;

    // Snapshot history BEFORE adding the new user message to avoid duplication
    const recentMessages = chat.getRecentMessages(32000);

    // Add user message
    const userMsg = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };
    chat.addMessage(userMsg);
    chat.setStreaming(true);
    chat.setError(null);
    chat.updateStreamBuffer('');

    const abortController = new AbortController();
    chat.setAbortController(abortController);

    const provConfig = PROVIDERS[app.activeProvider];
    const allModels = provState.availableModels?.length > 0
      ? provState.availableModels
      : (provConfig?.hardcodedModels || []);
    const model = allModels.find((m) => m.id === provState.selectedModel);
    const { activeAiProject, activeMode } = useProjectStore.getState();

    // Determine system prompt and tool availability
    let systemPrompt = null;
    let useNativeTools = false;

    if (activeAiProject && activeMode === 'ai') {
      // AI project active — use its system prompt + inline project knowledge
      systemPrompt = buildAiProjectSystemPrompt(activeAiProject, useEditorStore.getState(), location.pathname);
      // Enable tools if model supports them (for readProjectFile + full tools)
      useNativeTools = app.chatSettings.toolsEnabled && modelSupportsTools(model);
    } else {
      // No AI project — use prompt mode (default: full)
      const promptMode = app.chatSettings.promptMode || 'full';
      useNativeTools = promptMode === 'full' && app.chatSettings.toolsEnabled && modelSupportsTools(model);

      if (promptMode === 'full') {
        systemPrompt = buildChatSystemPrompt(location.pathname, { nativeToolsActive: useNativeTools });
      } else if (promptMode !== 'off') {
        systemPrompt = buildEditModePrompt(promptMode, useEditorStore.getState());
      }
    }

    // Debug
    console.log('[ChatSend] mode:', activeMode || 'default', '| systemPrompt:', systemPrompt ? `${systemPrompt.substring(0, 80)}... (${systemPrompt.length} chars)` : 'NONE');

    const apiMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...recentMessages.map((m) => ({
        role: m.role === 'action' ? 'assistant' : m.role,
        content: m.content,
      })),
      { role: 'user', content: userText },
    ];

    const settings = {
      maxTokens: app.chatSettings.maxTokens,
      temperature: app.chatSettings.temperature,
    };

    if (useNativeTools) {
      // --- Native tool calling path (agentic loop) ---
      let allActionResults = [];
      let fullResponse = '';
      let accumulatedText = '';
      let iterations = 0;
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        fullResponse = '';

        const iterResult = await new Promise((resolve) => {
          callCompletion(
            apiMessages,
            { ...settings, tools: toolDefinitions, signal: abortController.signal },
            (chunk) => {
              fullResponse += chunk;
              useChatStore.getState().updateStreamBuffer(fullResponse);
            },
            (toolCalls, usage) => resolve({ toolCalls, usage }),
            (err) => {
              useChatStore.getState().setError(err.message);
              resolve(null);
            }
          );
        });

        // Error → done
        if (!iterResult) break;
        const { toolCalls: toolCallsResult, usage: iterUsage } = iterResult;
        if (iterUsage) {
          totalUsage.promptTokens += iterUsage.promptTokens || 0;
          totalUsage.completionTokens += iterUsage.completionTokens || 0;
          totalUsage.totalTokens += iterUsage.totalTokens || 0;
        }

        // Check for <tool_call> tags in text (some models output these as text instead of using structured tool_calls)
        const textToolCalls = parseToolCallTags(fullResponse);
        if (textToolCalls.length > 0) {
          // Execute tool calls from text tags
          for (const tc of textToolCalls) {
            const handler = ACTION_HANDLERS[tc.name];
            if (handler) {
              try {
                const desc = await handler({ ...tc.arguments, type: tc.name });
                allActionResults.push({ success: true, description: desc, type: tc.name });
              } catch (e) {
                allActionResults.push({ success: false, error: e.message, type: tc.name });
              }
            } else {
              allActionResults.push({ success: false, error: `Unknown action: ${tc.name}`, type: tc.name });
            }
          }
          // Strip tags from display text and finalize
          fullResponse = stripToolCallTags(fullResponse);
          break;
        }

        // Check for {"tool": "..."} inline JSON (some models output this format)
        const inlineToolCalls = parseInlineToolJson(fullResponse);
        if (inlineToolCalls.length > 0) {
          for (const tc of inlineToolCalls) {
            const handler = ACTION_HANDLERS[tc.name];
            if (handler) {
              try {
                const desc = await handler({ ...tc.arguments, type: tc.name });
                allActionResults.push({ success: true, description: desc, type: tc.name });
              } catch (e) {
                allActionResults.push({ success: false, error: e.message, type: tc.name });
              }
            } else {
              allActionResults.push({ success: false, error: `Unknown action: ${tc.name}`, type: tc.name });
            }
          }
          fullResponse = stripInlineToolJson(fullResponse);
          break;
        }

        // No structured tool calls and no text tags → done
        if (Object.keys(toolCallsResult).length === 0) break;

        // Execute structured tool calls
        const toolCallsArr = Object.values(toolCallsResult);
        const assistantMsg = {
          role: 'assistant',
          content: fullResponse || null,
          tool_calls: toolCallsArr,
        };
        apiMessages.push(assistantMsg);

        for (const tc of toolCallsArr) {
          let result;
          try {
            const args = JSON.parse(tc.function.arguments);
            const handler = ACTION_HANDLERS[tc.function.name];
            if (!handler) throw new Error(`Unknown action: ${tc.function.name}`);
            const desc = await handler({ ...args, type: tc.function.name });
            result = JSON.stringify({ success: true, description: desc });
            allActionResults.push({ success: true, description: desc, type: tc.function.name });
          } catch (e) {
            result = JSON.stringify({ success: false, error: e.message });
            allActionResults.push({ success: false, error: e.message, type: tc.function.name });
          }
          // Cap large tool results to avoid ballooning context
          if (result.length > MAX_TOOL_RESULT_CHARS) {
            result = result.substring(0, MAX_TOOL_RESULT_CHARS) + '...[truncated]';
          }
          apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        // Preserve text from this iteration before looping
        if (fullResponse.trim()) {
          accumulatedText += (accumulatedText ? '\n' : '') + fullResponse.trim();
        }
        // Loop back — model sees tool results and may respond or call more tools
      }

      // Use accumulated text from all iterations; fall back to last iteration's text
      const finalText = accumulatedText || fullResponse;
      useChatStore.getState().finalizeStream(finalText, allActionResults, totalUsage.totalTokens > 0 ? totalUsage : null);
      // Auto-persist so history survives browser close without switching projects
      useProjectStore.getState().saveCurrentChatHistory().catch(() => {});
    } else {
      // --- Fenced-block fallback (existing path) ---
      let fullResponse = '';

      await callCompletion(
        apiMessages,
        { ...settings, signal: abortController.signal },
        (chunk) => {
          fullResponse += chunk;
          useChatStore.getState().updateStreamBuffer(fullResponse);
        },
        async (_toolCalls, usage) => {
          let actionResults = [];
          let displayText = fullResponse;

          // Check for ```action blocks
          const actions = parseActions(fullResponse);
          if (actions.length > 0) {
            actionResults = await executeActions(actions);
            displayText = stripActionBlocks(displayText);
          }

          // Check for <tool_call> tags (some models output these as text)
          const textToolCalls = parseToolCallTags(fullResponse);
          if (textToolCalls.length > 0) {
            for (const tc of textToolCalls) {
              const handler = ACTION_HANDLERS[tc.name];
              if (handler) {
                try {
                  const desc = await handler({ ...tc.arguments, type: tc.name });
                  actionResults.push({ success: true, description: desc, type: tc.name });
                } catch (e) {
                  actionResults.push({ success: false, error: e.message, type: tc.name });
                }
              } else {
                actionResults.push({ success: false, error: `Unknown action: ${tc.name}`, type: tc.name });
              }
            }
            displayText = stripToolCallTags(displayText);
          }

          // Check for {"tool": "..."} inline JSON (some models output this format)
          const inlineToolCalls = parseInlineToolJson(fullResponse);
          if (inlineToolCalls.length > 0) {
            for (const tc of inlineToolCalls) {
              const handler = ACTION_HANDLERS[tc.name];
              if (handler) {
                try {
                  const desc = await handler({ ...tc.arguments, type: tc.name });
                  actionResults.push({ success: true, description: desc, type: tc.name });
                } catch (e) {
                  actionResults.push({ success: false, error: e.message, type: tc.name });
                }
              } else {
                actionResults.push({ success: false, error: `Unknown action: ${tc.name}`, type: tc.name });
              }
            }
            displayText = stripInlineToolJson(displayText);
          }

          useChatStore.getState().finalizeStream(displayText, actionResults, usage || null);
          // Auto-persist so history survives browser close without switching projects
          useProjectStore.getState().saveCurrentChatHistory().catch(() => {});
        },
        (err) => {
          useChatStore.getState().setError(err.message);
          useChatStore.getState().setStreaming(false);
          useChatStore.getState().updateStreamBuffer('');
        }
      );
    }
  }, [location.pathname]);
}
