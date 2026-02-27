import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import useChatStore from '../../store/useChatStore';
import useAppStore from '../../store/useAppStore';
import useProjectStore from '../../store/useProjectStore';
import useChatSend from '../../hooks/useChatSend';
import ChatMessage from './ChatMessage';
import { stripActionBlocks } from '../../api/chatStreaming';
import { buildChatSystemPrompt, buildAiProjectSystemPrompt } from '../../chat/contextBuilder';
import { buildEditModePrompt, AI_PROJECT_PRESETS } from '../../chat/editPrompts';
import { modelSupportsTools } from '../../api/claude';
import { PROVIDERS } from '../../api/providers';
import { useOpenSettings } from '../layout/AppShell';
import useEditorStore from '../../store/useEditorStore';
import useSequenceStore from '../../store/useSequenceStore';
import usePromptStore from '../../store/usePromptStore';
import defaultPrompts from '../../data/defaultPrompts';
import PromptEditorDialog from '../prompts/PromptEditorDialog';
import { ACTION_HANDLERS } from '../../chat/actionExecutor';

export default function ChatPanel() {
  const isOpen = useChatStore((s) => s.isOpen);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const error = useChatStore((s) => s.error);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const truncateAfter = useChatStore((s) => s.truncateAfter);
  const truncateFrom = useChatStore((s) => s.truncateFrom);
  const trimToLast = useChatStore((s) => s.trimToLast);

  const input = useChatStore((s) => s.draftInput);
  const setInput = useChatStore((s) => s.setDraftInput);
  const [attachments, setAttachments] = useState([]);
  const [imageMode, setImageMode] = useState(false);
  const [imagePending, setImagePending] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [systemPromptText, setSystemPromptText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [showPromptManager, setShowPromptManager] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeProvider = useAppStore((s) => s.activeProvider);
  const providers = useAppStore((s) => s.providers);
  const chatSettings = useAppStore((s) => s.chatSettings);
  const imageSettings = useAppStore((s) => s.imageSettings);
  const imageReady = !!(imageSettings?.provider && imageSettings?.model);
  const sendMessage = useChatSend();
  const location = useLocation();
  const openSettings = useOpenSettings();

  const activeAiProject = useProjectStore((s) => s.activeAiProject);
  const activeBookProject = useProjectStore((s) => s.activeBookProject);
  const activeMode = useProjectStore((s) => s.activeMode);
  const aiProjects = useProjectStore((s) => s.aiProjects);
  const dropdownRef = useRef(null);

  const fileTree = useEditorStore((s) => s.fileTree);
  const directoryHandle = useEditorStore((s) => s.directoryHandle);
  const sequences = useSequenceStore((s) => s.customSequences);
  const customPrompts = usePromptStore((s) => s.customPrompts);
  const allPrompts = [...customPrompts, ...defaultPrompts];

  const providerState = providers[activeProvider] || {};
  const providerConfig = PROVIDERS[activeProvider];
  const allModels = providerState.availableModels?.length > 0
    ? providerState.availableModels
    : (providerConfig?.hardcodedModels || []);
  const model = allModels.find((m) => m.id === providerState.selectedModel);
  const toolsActive = chatSettings.toolsEnabled && modelSupportsTools(model);
  const hasFiles = fileTree && fileTree.length > 0;

  /** Shorten a model ID for display: strip date suffix. */
  const shortName = (id) => id.replace(/-\d{8}$/, '');

  // Slash-command: sequences + prompts filtered by typed query
  const filteredItems = slashMenuOpen ? [
    ...sequences
      .filter(s => !slashQuery || s.name.toLowerCase().includes(slashQuery.toLowerCase()))
      .map(s => ({ _type: 'sequence', ...s })),
    ...allPrompts
      .filter(p => !slashQuery || p.title.toLowerCase().includes(slashQuery.toLowerCase()))
      .map(p => ({ _type: 'prompt', ...p })),
  ] : [];

  const handleSlashSelect = useCallback(async (item) => {
    setInput('');
    setSlashMenuOpen(false);
    setSlashQuery('');
    if (item._type === 'sequence') {
      useChatStore.getState().addMessage({
        id: `slash_seq_${Date.now()}`,
        role: 'user',
        content: `/run "${item.name}"`,
        timestamp: Date.now(),
      });
      try {
        await ACTION_HANDLERS.runNamedSequence({ sequenceId: item.id });
      } catch (e) {
        useChatStore.getState().addMessage({
          id: `slash_seq_err_${Date.now()}`,
          role: 'assistant',
          content: `Error running "${item.name}": ${e.message}`,
          timestamp: Date.now(),
        });
      }
    } else {
      // Prompt: insert template text into input box; do NOT send
      setInput(item.content || '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [sequences]);

  // Rebuild the system prompt each time the user opens the viewer
  const handleToggleSystemPrompt = () => {
    if (!showSystemPrompt) {
      if (activeAiProject && activeMode === 'ai') {
        setSystemPromptText(buildAiProjectSystemPrompt(activeAiProject, useEditorStore.getState(), location.pathname));
      } else {
        const promptMode = chatSettings.promptMode || 'full';
        if (promptMode === 'off') {
          setSystemPromptText('(No system prompt \u2014 plain conversation mode)');
        } else if (promptMode === 'full') {
          setSystemPromptText(buildChatSystemPrompt(location.pathname));
        } else {
          const editPrompt = buildEditModePrompt(promptMode, useEditorStore.getState());
          setSystemPromptText(editPrompt || '(No prompt for this mode)');
        }
      }
    }
    setShowSystemPrompt(!showSystemPrompt);
  };

  // Display name for the current mode/project
  const promptLabel = activeMode === 'ai' && activeAiProject
    ? activeAiProject.name
    : activeMode === 'book' && activeBookProject
      ? activeBookProject
      : 'Full Context';

  // Auto-scroll to bottom on new messages or stream updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showProjectDropdown) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjectDropdown]);

  const abortStream = useChatStore((s) => s.abortStream);

  // Handle file attachment
  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments = [];
    for (const file of files) {
      try {
        const content = await file.text();
        newAttachments.push({
          name: file.name,
          content,
          size: file.size,
        });
      } catch (err) {
        console.warn('[ChatPanel] Failed to read file:', file.name, err.message);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isStreaming || imagePending) return;

    setSlashMenuOpen(false);

    // Image mode: bypass AI and call generateImage directly
    if (imageMode && text) {
      const addMessage = useChatStore.getState().addMessage;
      // Post user message
      addMessage({ id: `u-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() });
      setInput('');
      setImagePending(true);
      // Derive a filename from the prompt (first 40 chars, slugified)
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40).replace(/_+$/, '');
      const filename = `${slug}_${Date.now()}`;
      ACTION_HANDLERS.generateImage({ prompt: text, filename })
        .catch((err) => {
          addMessage({ id: `e-${Date.now()}`, role: 'assistant', content: `Image generation failed: ${err.message}`, timestamp: Date.now() });
        })
        .finally(() => setImagePending(false));
      return;
    }

    // Build message content with attachments
    let messageContent = text;
    if (attachments.length > 0) {
      const attachmentText = attachments.map((att) =>
        `\n\n---\n**Attached file: ${att.name}**\n\`\`\`\n${att.content}\n\`\`\``
      ).join('');
      messageContent = text + attachmentText;
    }

    setInput('');
    setAttachments([]);
    setEditingMessageId(null);
    sendMessage(messageContent);
  };

  const handleKeyDown = (e) => {
    if (slashMenuOpen && filteredItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, filteredItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSlashSelect(filteredItems[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle copy action
  const handleCopy = () => {
    // Could show a toast notification here
  };

  // Handle regenerate - find the last user message and regenerate from there
  const handleRegenerate = (assistantMessage) => {
    // Find the user message that preceded this assistant message
    const msgIndex = messages.findIndex((m) => m.id === assistantMessage.id);
    if (msgIndex <= 0) return;

    // Find the last user message before this assistant message
    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgIndex = i;
        break;
      }
    }
    if (userMsgIndex === -1) return;

    const userMessage = messages[userMsgIndex];

    // Image messages: re-run generation directly — don't send to the chat LLM
    if (assistantMessage.imageArtifact) {
      const { prompt } = assistantMessage.imageArtifact;
      truncateFrom(userMessage.id);
      const addMsg = useChatStore.getState().addMessage;
      addMsg({ id: `u-${Date.now()}`, role: 'user', content: userMessage.content, timestamp: Date.now() });
      setImagePending(true);
      const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40).replace(/_+$/, '');
      const filename = `${slug}_${Date.now()}`;
      ACTION_HANDLERS.generateImage({ prompt, filename })
        .catch((err) => {
          addMsg({ id: `e-${Date.now()}`, role: 'assistant', content: `Image generation failed: ${err.message}`, timestamp: Date.now() });
        })
        .finally(() => setImagePending(false));
      return;
    }

    // Regular messages: truncate to just before the user message, then resend via chat
    truncateFrom(userMessage.id);
    setTimeout(() => sendMessage(userMessage.content), 100);
  };

  // Handle edit - populate input with message content and remove it + subsequent messages
  const handleEdit = (message) => {
    setInput(message.content);
    setEditingMessageId(message.id);
    truncateFrom(message.id);
    inputRef.current?.focus();
  };

  return (
      <div className="flex flex-col h-full bg-g-bg text-g-text">
        {/* Header */}
        <div className="p-3 border-b border-g-border shrink-0 bg-g-bg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h2 className={`text-sm font-bold shrink-0 px-1.5 py-0.5 rounded ${toolsActive ? 'bg-green-500 text-white' : 'text-g-text'}`}>AI</h2>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-g-chrome text-g-muted font-mono truncate max-w-[200px] cursor-pointer hover:bg-g-chrome transition-colors"
                title={`${providerConfig?.name || activeProvider} / ${providerState.selectedModel || 'none'}\nClick to open Settings`}
                onClick={openSettings}
              >
                {providerConfig?.name ? `${providerConfig.name} / ` : ''}{shortName(providerState.selectedModel || '')}
              </span>
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium max-w-[120px] truncate hover:bg-purple-200 transition-colors cursor-pointer"
                  title={`${promptLabel}\nClick to switch AI project`}
                >
                  {promptLabel} <span className="text-[8px] opacity-60">{showProjectDropdown ? '\u25B2' : '\u25BC'}</span>
                </button>
                {showProjectDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-g-bg border border-g-border rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                    {/* Full Context (default, no AI project) */}
                    <button
                      onClick={() => {
                        useProjectStore.getState().deactivateProject();
                        setShowProjectDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-g-chrome transition-colors ${
                        !activeMode || activeMode === 'book' ? 'font-semibold text-purple-700 bg-purple-50' : 'text-g-text'
                      }`}
                    >
                      Full Context
                    </button>
                    {/* Presets */}
                    {AI_PROJECT_PRESETS.length > 0 && (
                      <div className="border-t border-g-border mt-1 pt-1">
                        <div className="px-3 py-0.5 text-[9px] text-g-status uppercase font-semibold">Presets</div>
                        {AI_PROJECT_PRESETS.map((p) => (
                          <button
                            key={`preset_${p.presetKey}`}
                            onClick={() => {
                              useProjectStore.getState().activateAiProject(p);
                              setShowProjectDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-g-chrome transition-colors ${
                              activeMode === 'ai' && activeAiProject?.isPreset && activeAiProject?.presetKey === p.presetKey
                                ? 'font-semibold text-purple-700 bg-purple-50'
                                : 'text-g-text'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* User AI projects */}
                    {aiProjects.length > 0 && (
                      <div className="border-t border-g-border mt-1 pt-1">
                        <div className="px-3 py-0.5 text-[9px] text-g-status uppercase font-semibold">Projects</div>
                        {aiProjects.map((p) => (
                          <button
                            key={p.name}
                            onClick={() => {
                              useProjectStore.getState().activateAiProject(p);
                              setShowProjectDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-g-chrome transition-colors ${
                              activeMode === 'ai' && !activeAiProject?.isPreset && activeAiProject?.name === p.name
                                ? 'font-semibold text-purple-700 bg-purple-50'
                                : 'text-g-text'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {toolsActive && !activeMode && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 text-green-700 font-medium shrink-0">
                  tools
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleToggleSystemPrompt}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  showSystemPrompt
                    ? 'bg-black text-white'
                    : 'text-g-muted hover:text-g-text hover:bg-g-chrome'
                }`}
                title="View system prompt"
              >
                Mode
              </button>
              <button
                onClick={() => setShowPromptManager(true)}
                className="text-xs px-2 py-1 rounded transition-colors text-g-muted hover:text-g-text hover:bg-g-chrome"
                title="Manage prompts"
              >
                Prompts
              </button>
              {hasFiles && (
                <button
                  onClick={() => { setShowFiles(!showFiles); if (!showFiles) { setShowSystemPrompt(false); } }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    showFiles
                      ? 'bg-black text-white'
                      : 'text-g-muted hover:text-g-text hover:bg-g-chrome'
                  }`}
                  title="View file tree"
                >
                  Files
                </button>
              )}
              <button
                onClick={() => {
                  if (messages.length === 0 || window.confirm('Start a new chat? Current messages will be cleared.')) {
                    clearMessages();
                    useProjectStore.getState().clearProjectHistory().catch(() => {});
                  }
                }}
                className="text-g-muted hover:text-g-text px-1.5 py-1 rounded hover:bg-g-chrome transition-colors"
                title="New chat"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="10" rx="1.5" />
                  <line x1="5" y1="6.5" x2="11" y2="6.5" />
                  <line x1="5" y1="9.5" x2="9" y2="9.5" />
                  <path d="M12 1v3M14 2h-4" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* System prompt viewer */}
        {showSystemPrompt && (
          <div className="border-b border-g-border bg-g-chrome shrink-0 max-h-[60%] overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-g-muted uppercase">System Prompt — {promptLabel}</span>
                <button
                  onClick={() => setShowSystemPrompt(false)}
                  className="text-xs text-g-status hover:text-g-text"
                >
                  {'\u2715'}
                </button>
              </div>
              <pre className="text-[11px] text-g-text whitespace-pre-wrap break-words font-mono leading-relaxed">
                {systemPromptText}
              </pre>
            </div>
          </div>
        )}

        {/* File tree panel */}
        {showFiles && hasFiles && (
          <div className="border-b border-g-border bg-g-chrome shrink-0 max-h-[40%] overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-g-muted uppercase">
                  Files — {directoryHandle?.name || 'Editor'}
                </span>
                <button
                  onClick={() => setShowFiles(false)}
                  className="text-xs text-g-status hover:text-g-text"
                >
                  {'\u2715'}
                </button>
              </div>
              <FileTreeView entries={fileTree} />
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-g-bg" aria-live="polite" role="log" aria-label="Chat messages">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center text-g-status text-sm mt-8">
              {activeMode === 'ai' && activeAiProject ? (
                <>
                  <p className="mb-2">AI Project: {activeAiProject.name}</p>
                  <p className="text-xs text-g-status">
                    {activeAiProject.files?.length > 0
                      ? `${activeAiProject.files.length} file(s) in catalog. Ask me anything.`
                      : 'Custom system prompt active. Ask me anything.'}
                  </p>
                </>
              ) : activeMode === 'book' && activeBookProject ? (
                <>
                  <p className="mb-2">Book Project: {activeBookProject}</p>
                  <p className="text-xs text-g-status">
                    Ask me about your story.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">Ask me about your story.</p>
                  <p className="text-xs text-g-status">
                    I can read and modify your scaffold beats, genre settings, chapter scores, and more.
                  </p>
                </>
              )}
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onCopy={handleCopy}
              onRegenerate={msg.role === 'assistant' ? () => handleRegenerate(msg) : undefined}
              onEdit={msg.role === 'user' ? handleEdit : undefined}
            />
          ))}

          {/* Streaming: show partial response */}
          {isStreaming && streamBuffer && (
            <div className="bg-g-bg rounded-lg border border-g-border p-3 text-sm text-g-text">
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {stripActionBlocks(streamBuffer)}
              </div>
              <span className="inline-block w-1.5 h-4 bg-black ml-0.5 animate-pulse" />
            </div>
          )}

          {/* Streaming: waiting for first chunk */}
          {isStreaming && !streamBuffer && (
            <div className="flex gap-1.5 p-3">
              <span className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} aria-hidden="true" />
              <span className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} aria-hidden="true" />
              <span className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} aria-hidden="true" />
              <span className="sr-only">AI is generating a response...</span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-300 rounded p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="px-3 pt-2 border-t border-g-border bg-g-chrome">
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 bg-g-bg border border-g-border rounded text-xs"
                >
                  <span className="text-g-muted">📎</span>
                  <span className="truncate max-w-[120px]" title={att.name}>{att.name}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="text-g-status hover:text-red-500 ml-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context stats bar — shown when history is long enough to manage */}
        {messages.length >= 6 && (() => {
          const totalChars = messages.reduce((sum, m) => sum + (m.content || '').length, 0);
          const trimOptions = [10, 20, 50].filter((n) => messages.length > n);
          if (trimOptions.length === 0 && totalChars < 8000) return null;
          return (
            <div className="px-3 py-1 border-t border-g-border bg-g-chrome flex items-center justify-between shrink-0">
              <span className="text-[9px] text-g-status font-mono">
                {messages.length} msgs · ~{totalChars >= 1000 ? `${Math.round(totalChars / 1000)}K` : totalChars} chars
              </span>
              {trimOptions.length > 0 && (
                <div className="flex items-center gap-0.5">
                  <span className="text-[9px] text-g-status mr-1">keep last</span>
                  {trimOptions.map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        if (window.confirm(`Keep only the last ${n} messages? Older messages will be removed from this session.`)) {
                          trimToLast(n);
                          useProjectStore.getState().saveCurrentChatHistory().catch(() => {});
                        }
                      }}
                      className="text-[9px] px-1.5 py-0.5 rounded hover:bg-g-chrome text-g-muted transition-colors"
                      title={`Keep last ${n} messages`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Input area */}
        <div className="p-3 border-t border-g-border shrink-0 bg-g-bg">
          <div className="relative">
            {/* Slash-command picker: sequences + prompts */}
            {slashMenuOpen && filteredItems.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-g-bg border border-g-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                {filteredItems.map((item, idx) => {
                  const isFirstOfType = idx === 0 || filteredItems[idx - 1]._type !== item._type;
                  return (
                    <React.Fragment key={item.id}>
                      {isFirstOfType && (
                        <div className={`px-2.5 py-1 text-[9px] font-bold text-g-status uppercase border-b border-g-border${idx > 0 ? ' border-t border-g-border mt-0.5' : ''}`}>
                          {item._type === 'sequence' ? 'Sequences' : 'Prompts'}
                        </div>
                      )}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleSlashSelect(item); }}
                        onMouseEnter={() => setSlashIndex(idx)}
                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-baseline gap-2 transition-colors ${
                          idx === slashIndex ? 'bg-purple-50 text-purple-700' : 'text-g-text hover:bg-g-chrome'
                        }`}
                      >
                        <span className="font-medium shrink-0">
                          {item._type === 'sequence' ? item.name : item.title}
                        </span>
                        {item._type === 'sequence' ? (
                          <>
                            {item.description && (
                              <span className="text-g-status text-[10px] truncate">{item.description}</span>
                            )}
                            <span className="text-g-status text-[10px] shrink-0 ml-auto">
                              {item.steps?.length || 0} steps
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-500 shrink-0 ml-auto">
                            prompt
                          </span>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                if (val.startsWith('/') && !val.includes(' ') && (sequences.length > 0 || allPrompts.length > 0)) {
                  setSlashQuery(val.slice(1));
                  setSlashMenuOpen(true);
                  setSlashIndex(0);
                } else {
                  setSlashMenuOpen(false);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={imageMode ? 'Describe the image to generate...' : (editingMessageId ? 'Edit your message...' : 'Ask about your story...')}
              rows={2}
              className={`w-full bg-g-bg border rounded-lg pl-10 pr-20 py-2 text-sm text-g-text resize-none focus:outline-none placeholder:text-g-status ${imageMode ? 'border-purple-400 focus:border-purple-600' : 'border-g-border focus:border-g-text'}`}
            />
            {/* File attachment button */}
            <button
              onClick={handleAttachFile}
              disabled={isStreaming}
              className="absolute left-2 bottom-2 w-7 h-7 flex items-center justify-center text-g-status hover:text-g-muted hover:bg-g-chrome rounded-md transition-colors disabled:opacity-50"
              title="Attach files"
              aria-label="Attach files"
            >
              <span aria-hidden="true">📎</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelected}
              className="hidden"
              accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.py,.xml,.yaml,.yml,.csv"
            />
            {/* Image mode toggle */}
            <button
              onClick={() => { if (imageReady) setImageMode((m) => !m); else openSettings('image'); }}
              title={imageReady ? (imageMode ? 'Switch to text mode' : 'Switch to image generation mode') : 'Configure image provider in Settings'}
              className={`absolute right-10 bottom-2 w-7 h-7 flex items-center justify-center rounded-md transition-colors text-base ${
                imageMode
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : imageReady
                    ? 'text-g-status hover:text-purple-600 hover:bg-purple-50'
                    : 'text-gray-300 cursor-pointer'
              }`}
            >
              🖼
            </button>
            {isStreaming || imagePending ? (
              <button
                onClick={imagePending ? undefined : abortStream}
                disabled={imagePending}
                className="absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center bg-black hover:bg-gray-800 rounded-md transition-colors disabled:opacity-60"
                title={imagePending ? 'Generating image...' : 'Stop generating'}
                aria-label={imagePending ? 'Generating image' : 'Stop generating'}
              >
                <span aria-hidden="true" style={{ width: 10, height: 10, background: '#DC2626', borderRadius: 2, display: 'block' }} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && attachments.length === 0}
                aria-label="Send message"
                className={`absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center disabled:bg-gray-300 disabled:text-g-muted text-white rounded-md text-sm font-semibold transition-colors ${imageMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-black hover:bg-gray-800'}`}
              >
                {'\u2191'}
              </button>
            )}
          </div>
          {editingMessageId && (
            <div className="mt-1 min-h-[14px]">
              <span className="text-[10px] text-purple-600 font-medium">
                Editing message • <button onClick={() => { setEditingMessageId(null); setInput(''); }} className="underline hover:text-purple-800">Cancel</button>
              </span>
            </div>
          )}
        </div>
      <PromptEditorDialog isOpen={showPromptManager} onClose={() => setShowPromptManager(false)} />
      </div>
  );
}

/** Compact file tree for the chat panel's Files drawer. */
function FileTreeView({ entries, depth = 0 }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      {entries.map((entry) => (
        <div key={entry.path}>
          {entry.type === 'dir' ? (
            <>
              <div className="text-[11px] text-g-muted font-medium py-0.5">
                {'\uD83D\uDCC1'} {entry.name}/
              </div>
              <FileTreeView entries={entry.children} depth={depth + 1} />
            </>
          ) : entry.type === 'file' ? (
            <div className="text-[11px] text-g-text py-0.5 truncate" title={entry.path}>
              {entry.name}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
