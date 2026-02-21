import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import useAppStore from '../../store/useAppStore';
import usePromptStore from '../../store/usePromptStore';
import { getTheme } from '../edit/editorThemes';
import { PROVIDERS, PROVIDER_ORDER } from '../../api/providers';
import defaultPrompts from '../../data/defaultPrompts';

/**
 * Dialog for creating, editing, and managing custom prompts.
 * Shows a list of all prompts (custom + defaults), allows editing custom prompts,
 * and supports model override per prompt.
 */
export default function PromptEditorDialog({ isOpen, onClose, editingPromptId }) {
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const t = getTheme(editorTheme);
  const c = t.colors;
  const isDark = t.isDark;

  const customPrompts = usePromptStore((s) => s.customPrompts);
  const createPrompt = usePromptStore((s) => s.createPrompt);
  const updatePrompt = usePromptStore((s) => s.updatePrompt);
  const deletePrompt = usePromptStore((s) => s.deletePrompt);

  const [view, setView] = useState('list'); // 'list' | 'edit'
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [modelOverride, setModelOverride] = useState('');

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (view === 'edit') {
          setView('list');
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, view, onClose]);

  // If opened with an editingPromptId, jump to edit view
  useEffect(() => {
    if (isOpen && editingPromptId) {
      const prompt = customPrompts.find((p) => p.id === editingPromptId);
      if (prompt) {
        setEditingPrompt(prompt);
        setTitle(prompt.title);
        setContent(prompt.content);
        setModelOverride(prompt.modelOverride || '');
        setView('edit');
      }
    } else if (isOpen) {
      setView('list');
      setEditingPrompt(null);
    }
  }, [isOpen, editingPromptId, customPrompts]);

  const handleNew = useCallback(() => {
    setEditingPrompt(null);
    setTitle('');
    setContent('');
    setModelOverride('');
    setView('edit');
  }, []);

  const handleEdit = useCallback((prompt, isDefault) => {
    if (isDefault) {
      // Clone default prompt for editing as custom
      setEditingPrompt(null);
      setTitle(prompt.title + ' (Custom)');
      setContent(prompt.content);
      setModelOverride('');
    } else {
      setEditingPrompt(prompt);
      setTitle(prompt.title);
      setContent(prompt.content);
      setModelOverride(prompt.modelOverride || '');
    }
    setView('edit');
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;

    if (editingPrompt) {
      // Update existing
      await updatePrompt({
        ...editingPrompt,
        title: title.trim(),
        content: content.trim(),
        modelOverride: modelOverride || undefined,
      });
    } else {
      // Create new
      await createPrompt({
        title: title.trim(),
        content: content.trim(),
        modelOverride: modelOverride || undefined,
      });
    }
    setView('list');
  }, [title, content, modelOverride, editingPrompt, updatePrompt, createPrompt]);

  const handleDelete = useCallback(async (prompt) => {
    await deletePrompt(prompt.id);
    setConfirmDelete(null);
  }, [deletePrompt]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      if (view === 'edit') {
        setView('list');
      } else {
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  // Combine custom and default prompts for the list
  const allPrompts = [
    ...customPrompts.map((p) => ({ ...p, isCustom: true })),
    ...defaultPrompts.map((p) => ({ ...p, isCustom: false })),
  ];

  // Get available models for dropdown
  const providers = useAppStore.getState().providers;
  const allModels = [];
  for (const providerId of PROVIDER_ORDER) {
    const prov = providers[providerId];
    const config = PROVIDERS[providerId];
    const models = prov?.availableModels?.length > 0
      ? prov.availableModels
      : (config?.hardcodedModels || []);
    for (const m of models) {
      allModels.push({ id: m.id, name: m.name || m.id, provider: config.name });
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: c.chrome,
          color: c.text,
          border: `1px solid ${c.chromeBorder}`,
          borderRadius: 12,
          width: view === 'edit' ? 640 : 520,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${c.chromeBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view === 'edit' && (
              <button
                onClick={() => setView('list')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: c.chromeText,
                  padding: '2px 8px',
                }}
              >
                {'\u2190'}
              </button>
            )}
            <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>
              {view === 'list' ? 'Manage Prompts' : editingPrompt ? 'Edit Prompt' : 'New Prompt'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              color: c.chromeText,
              fontSize: 18,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
          {view === 'list' ? (
            <PromptList
              prompts={allPrompts}
              onEdit={handleEdit}
              onDelete={setConfirmDelete}
              colors={c}
              isDark={isDark}
            />
          ) : (
            <PromptForm
              title={title}
              setTitle={setTitle}
              content={content}
              setContent={setContent}
              modelOverride={modelOverride}
              setModelOverride={setModelOverride}
              models={allModels}
              colors={c}
              isDark={isDark}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${c.chromeBorder}`,
            display: 'flex',
            justifyContent: view === 'list' ? 'space-between' : 'flex-end',
            gap: 8,
          }}
        >
          {view === 'list' ? (
            <>
              <button
                onClick={handleNew}
                style={{
                  background: '#7C3AED',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + New Prompt
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  color: c.chromeText,
                  border: `1px solid ${c.chromeBorder}`,
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                    fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setView('list')}
                style={{
                  background: 'transparent',
                  color: c.chromeText,
                  border: `1px solid ${c.chromeBorder}`,
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || !content.trim()}
                style={{
                  background: title.trim() && content.trim() ? '#7C3AED' : '#9CA3AF',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: title.trim() && content.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save
              </button>
            </>
          )}
        </div>

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                background: c.chrome,
                border: `1px solid ${c.chromeBorder}`,
                borderRadius: 8,
                padding: 20,
                maxWidth: 320,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                Delete "{confirmDelete.title}"?
              </div>
              <div style={{ fontSize: 12, color: c.chromeText, marginBottom: 16 }}>
                This action cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    background: 'transparent',
                    color: c.chromeText,
                    border: `1px solid ${c.chromeBorder}`,
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  style={{
                    background: '#DC2626',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptList({ prompts, onEdit, onDelete, colors: c, isDark }) {
  const customPrompts = prompts.filter((p) => p.isCustom);
  const defaultPromptsInList = prompts.filter((p) => !p.isCustom);

  const renderPromptItem = (prompt) => (
    <div
      key={prompt.id}
      style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${c.chromeBorder}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{prompt.title}</span>
          {prompt.modelOverride && (
            <span
              style={{
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 3,
                background: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)',
                color: '#7C3AED',
                fontWeight: 600,
              }}
            >
              {prompt.modelOverride.split('/').pop()}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: c.chromeText,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {prompt.content.slice(0, 80)}...
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
        <button
          onClick={() => onEdit(prompt, !prompt.isCustom)}
          title={prompt.isCustom ? 'Edit' : 'Clone as custom'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            color: c.chromeText,
            padding: '4px 8px',
            borderRadius: 4,
          }}
        >
          {prompt.isCustom ? '\u270E' : '\u2398'}
        </button>
        {prompt.isCustom && (
          <button
            onClick={() => onDelete(prompt)}
            title="Delete"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#DC2626',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            {'\u2717'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {customPrompts.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 16px 4px',
              fontSize: 10,
              fontWeight: 700,
              color: c.chromeText,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Custom Prompts
          </div>
          {customPrompts.map(renderPromptItem)}
        </>
      )}
      <div
        style={{
          padding: '8px 16px 4px',
          fontSize: 10,
          fontWeight: 700,
          color: c.chromeText,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: customPrompts.length > 0 ? 8 : 0,
        }}
      >
        Default Prompts
      </div>
      {defaultPromptsInList.map(renderPromptItem)}
    </div>
  );
}

function PromptForm({ title, setTitle, content, setContent, modelOverride, setModelOverride, models, colors: c, isDark }) {
  return (
    <div style={{ padding: 20 }}>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Continue Story"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: 6,
            outline: 'none',
          }}
        />
      </div>

      {/* Model Override */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Model Override <span style={{ fontWeight: 400, color: c.chromeText }}>(optional)</span>
        </label>
        <select
          value={modelOverride}
          onChange={(e) => setModelOverride(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: 6,
            outline: 'none',
          }}
        >
          <option value="">Use active model</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.provider}: {m.name}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 10, color: c.chromeText, marginTop: 3 }}>
          When set, this prompt will always use the specified model instead of the active one.
        </div>
      </div>

      {/* Content */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Prompt Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'Enter your prompt template...\n\nAvailable variables:\n{{selected_text}} - Current selection\n{{before}} - Text before selection\n{{after}} - Text after selection\n{{selected_documents}} - Context files\n{{user_input}} - Additional user input'}
          rows={12}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: 12,
            fontFamily: 'monospace',
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: 6,
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.5,
          }}
        />
        <div style={{ fontSize: 10, color: c.chromeText, marginTop: 6 }}>
          <strong>Template variables:</strong>{' '}
          <code style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 2 }}>
            {'{{selected_text}}'}
          </code>{' '}
          <code style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 2 }}>
            {'{{before}}'}
          </code>{' '}
          <code style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 2 }}>
            {'{{after}}'}
          </code>{' '}
          <code style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 2 }}>
            {'{{selected_documents}}'}
          </code>{' '}
          <code style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: 2 }}>
            {'{{user_input}}'}
          </code>
        </div>
      </div>
    </div>
  );
}
