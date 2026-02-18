import { useState, useRef, useCallback } from 'react';
import { callCompletion } from '../api/providerAdapter';
import useAppStore from '../store/useAppStore';

const INLINE_EDIT_SYSTEM_PROMPT = `You are an inline text editor. The user has selected a passage and given you an editing instruction.

RULES:
1. Output ONLY the revised text. No preamble, no explanation, no markdown code fences.
2. Preserve the author's voice, style, tone, and register.
3. Apply the instruction precisely — nothing more, nothing less.
4. If the instruction is to rewrite or rephrase, keep approximately the same length unless told otherwise.
5. Maintain any existing formatting (bold, italic, etc.) where appropriate.
6. Never add commentary like "Here is the revised text:" — just output the text directly.`;

export default function useInlineEdit() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'streaming' | 'done' | 'error'
  const [response, setResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(false);

  const submitEdit = useCallback((selectedText, userPrompt, isPreset = false) => {
    const { providers, activeProvider, chatSettings } = useAppStore.getState();
    const provState = providers[activeProvider] || {};
    if (!provState.apiKey) {
      setErrorMsg('No API key configured. Open Settings to add one.');
      setStatus('error');
      return;
    }

    setStatus('streaming');
    setResponse('');
    setErrorMsg('');
    abortRef.current = false;

    // Preset prompts contain their own full instructions — send them directly.
    // Regular inline edits use the system prompt + structured message format.
    const messages = isPreset
      ? [{ role: 'user', content: userPrompt }]
      : [
          { role: 'system', content: INLINE_EDIT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `## Selected Text\n${selectedText}\n\n## Instruction\n${userPrompt}`,
          },
        ];

    callCompletion(
      messages,
      {
        maxTokens: chatSettings.maxTokens || 4096,
        temperature: chatSettings.temperature ?? 0.7,
      },
      (chunk) => {
        if (abortRef.current) return;
        setResponse((prev) => prev + chunk);
      },
      () => {
        if (!abortRef.current) setStatus('done');
      },
      (err) => {
        if (abortRef.current) return;
        setErrorMsg(err.message);
        setStatus('error');
      }
    );
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResponse('');
    setErrorMsg('');
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setStatus('idle');
    setResponse('');
  }, []);

  return { status, response, errorMsg, submitEdit, reset, cancel };
}
