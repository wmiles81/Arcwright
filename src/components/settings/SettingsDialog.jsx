import React, { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import useEditorStore from '../../store/useEditorStore';
import useProjectStore from '../../store/useProjectStore';
import { getTheme, lightThemes, darkThemes } from '../edit/editorThemes';
import { PROVIDERS, PROVIDER_ORDER } from '../../api/providers';
import { fetchModels } from '../../api/providerAdapter';
import ProviderCard from './ProviderCard';

export default function SettingsDialog({ isOpen, onClose }) {
  const editorTheme = useEditorStore((s) => s.editorTheme);
  const t = getTheme(editorTheme);
  const c = t.colors;

  const [activeTab, setActiveTab] = useState('providers');

  // Local copies of state — committed on Save
  const [localActiveProvider, setLocalActiveProvider] = useState('openrouter');
  const [localProviders, setLocalProviders] = useState({});
  const [localChatSettings, setLocalChatSettings] = useState({});
  const [localEditorTheme, setLocalEditorTheme] = useState('light');

  // Sync from store when dialog opens
  useEffect(() => {
    if (isOpen) {
      const app = useAppStore.getState();
      const editor = useEditorStore.getState();
      setLocalActiveProvider(app.activeProvider);
      setLocalProviders(JSON.parse(JSON.stringify(app.providers)));
      setLocalChatSettings({ ...app.chatSettings });
      setLocalEditorTheme(editor.editorTheme);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleProviderUpdate = useCallback((id, updates) => {
    setLocalProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  }, []);

  const handleRefreshModels = useCallback(async (providerId) => {
    const prov = localProviders[providerId];
    if (!prov?.apiKey) return;

    handleProviderUpdate(providerId, { modelsLoading: true });
    try {
      const models = await fetchModels(providerId, prov.apiKey);
      handleProviderUpdate(providerId, { availableModels: models, modelsLoading: false });
    } catch (err) {
      console.error(`[Settings] Failed to fetch models for ${providerId}:`, err.message);
      handleProviderUpdate(providerId, { modelsLoading: false });
    }
  }, [localProviders, handleProviderUpdate]);

  const handleSave = async () => {
    const app = useAppStore.getState();

    // Commit provider state
    app.setActiveProvider(localActiveProvider);
    for (const [id, prov] of Object.entries(localProviders)) {
      app.updateProvider(id, prov);
    }

    // Commit chat settings
    app.updateChatSettings(localChatSettings);

    // Commit editor theme
    if (localEditorTheme !== useEditorStore.getState().editorTheme) {
      useEditorStore.getState().setEditorTheme(localEditorTheme);
    }

    // Persist to disk if Arcwrite is initialized
    const proj = useProjectStore.getState();
    if (proj.arcwriteHandle) {
      const diskProviders = {};
      for (const [id, p] of Object.entries(localProviders)) {
        diskProviders[id] = {
          apiKey: p.apiKey,
          selectedModel: p.selectedModel,
          availableModels: p.availableModels || [],
        };
      }
      await proj.updateSettings({
        activeProvider: localActiveProvider,
        providers: diskProviders,
        chatSettings: localChatSettings,
        editorTheme: localEditorTheme,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Active provider dropdown only shows providers that have an API key
  const configuredProviders = PROVIDER_ORDER.filter((id) => localProviders[id]?.apiKey);

  // Get selected model info for chat settings hints
  const activeProv = localProviders[localActiveProvider] || {};
  const activeConfig = PROVIDERS[localActiveProvider];
  const activeModels = activeProv.availableModels?.length > 0
    ? activeProv.availableModels
    : (activeConfig?.hardcodedModels || []);
  const activeModel = activeModels.find((m) => m.id === activeProv.selectedModel);
  const supported = activeModel?.supportedParameters || [];

  const tabStyle = (active) => ({
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? c.text : c.chromeText,
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #7C3AED' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 0.15s',
  });

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
          width: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 0',
            borderBottom: `1px solid ${c.chromeBorder}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Settings</h2>
            <button
              onClick={onClose}
              style={{ color: c.chromeText, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
            >
              {'\u2715'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <button style={tabStyle(activeTab === 'providers')} onClick={() => setActiveTab('providers')}>
              Providers
            </button>
            <button style={tabStyle(activeTab === 'chat')} onClick={() => setActiveTab('chat')}>
              Chat
            </button>
            <button style={tabStyle(activeTab === 'appearance')} onClick={() => setActiveTab('appearance')}>
              Appearance
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 200 }}>
          {activeTab === 'providers' && (
            <ProvidersTab
              localActiveProvider={localActiveProvider}
              setLocalActiveProvider={setLocalActiveProvider}
              localProviders={localProviders}
              configuredProviders={configuredProviders}
              onProviderUpdate={handleProviderUpdate}
              onRefreshModels={handleRefreshModels}
              colors={c}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              chatSettings={localChatSettings}
              onUpdate={(u) => setLocalChatSettings((prev) => ({ ...prev, ...u }))}
              supported={supported}
              activeModel={activeModel}
              colors={c}
            />
          )}
          {activeTab === 'appearance' && (
            <AppearanceTab
              selectedTheme={localEditorTheme}
              onSelect={setLocalEditorTheme}
              colors={c}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${c.chromeBorder}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
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
            Cancel
          </button>
          <button
            onClick={handleSave}
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Providers ──

function ProvidersTab({ localActiveProvider, setLocalActiveProvider, localProviders, configuredProviders, onProviderUpdate, onRefreshModels, colors: c }) {
  return (
    <>
      {/* Active provider selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: c.text, display: 'block', marginBottom: 4 }}>
          Active Provider
        </label>
        <select
          value={localActiveProvider}
          onChange={(e) => setLocalActiveProvider(e.target.value)}
          style={{
            padding: '6px 10px',
            fontSize: 13,
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: 6,
            outline: 'none',
            minWidth: 200,
          }}
        >
          {PROVIDER_ORDER.map((id) => (
            <option key={id} value={id} disabled={!configuredProviders.includes(id) && id !== localActiveProvider}>
              {PROVIDERS[id].name}{!configuredProviders.includes(id) ? ' (no key)' : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 10, color: c.chromeText, marginTop: 3 }}>
          Only providers with an API key can be set as active.
        </div>
      </div>

      {/* Provider cards */}
      {PROVIDER_ORDER.map((id) => (
        <ProviderCard
          key={id}
          config={PROVIDERS[id]}
          providerState={localProviders[id] || {}}
          isActive={id === localActiveProvider}
          onUpdate={(updates) => onProviderUpdate(id, updates)}
          onRefreshModels={() => onRefreshModels(id)}
          colors={c}
        />
      ))}
    </>
  );
}

// ── Tab: Chat ──

function ChatTab({ chatSettings, onUpdate, supported, activeModel, colors: c }) {
  const supports = (param) => supported.includes(param);

  return (
    <div style={{ maxWidth: 480 }}>
      {/* Temperature */}
      <SettingRow label="Temperature" supported={supports('temperature')} hint="Controls creativity / randomness" colors={c}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={chatSettings.temperature}
            onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
            disabled={!supports('temperature')}
            style={{ flex: 1, accentColor: '#7C3AED' }}
          />
          <span style={{ fontSize: 12, fontFamily: 'monospace', width: 28, textAlign: 'right', color: c.chromeText }}>
            {chatSettings.temperature.toFixed(1)}
          </span>
        </div>
      </SettingRow>

      {/* Max Tokens */}
      <SettingRow label="Max Tokens" supported={true} hint="Maximum response length" colors={c}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min="256"
            max={activeModel?.maxCompletionTokens || 16384}
            step="256"
            value={chatSettings.maxTokens}
            onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) })}
            style={{ flex: 1, accentColor: '#7C3AED' }}
          />
          <span style={{ fontSize: 12, fontFamily: 'monospace', width: 48, textAlign: 'right', color: c.chromeText }}>
            {chatSettings.maxTokens >= 1000
              ? `${(chatSettings.maxTokens / 1000).toFixed(1)}k`
              : chatSettings.maxTokens}
          </span>
        </div>
      </SettingRow>

      {/* Native Tools */}
      <SettingRow
        label="Native Tools"
        supported={supports('tools')}
        hint={supports('tools')
          ? 'Use API tool calling instead of fenced blocks'
          : 'Not supported by this model \u2014 using fenced-block fallback'}
        colors={c}
      >
        <ToggleSwitch
          checked={chatSettings.toolsEnabled}
          onChange={(v) => onUpdate({ toolsEnabled: v })}
          disabled={!supports('tools')}
        />
      </SettingRow>

      {/* Reasoning */}
      <SettingRow
        label="Reasoning"
        supported={supports('reasoning')}
        hint={supports('reasoning')
          ? 'Enable extended thinking / chain-of-thought'
          : 'Not supported by this model'}
        colors={c}
      >
        <ToggleSwitch
          checked={chatSettings.reasoningEnabled}
          onChange={(v) => onUpdate({ reasoningEnabled: v })}
          disabled={!supports('reasoning')}
        />
      </SettingRow>

      {/* Model Info */}
      {activeModel && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${c.chromeBorder}` }}>
          <div style={{ fontSize: 10, color: c.chromeText, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
            Active Model Info
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', fontSize: 11, color: c.chromeText }}>
            {activeModel.contextLength && (
              <>
                <span>Context</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(activeModel.contextLength / 1000).toFixed(0)}k tokens</span>
              </>
            )}
            {activeModel.maxCompletionTokens && (
              <>
                <span>Max Output</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(activeModel.maxCompletionTokens / 1000).toFixed(0)}k tokens</span>
              </>
            )}
            {activeModel.pricing && (
              <>
                <span>Input price</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatPrice(activeModel.pricing.prompt)}/M</span>
                <span>Output price</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatPrice(activeModel.pricing.completion)}/M</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Appearance ──

function AppearanceTab({ selectedTheme, onSelect, colors: c }) {
  const renderGroup = (label, themes) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {themes.map((theme) => (
          <button
            key={theme.key}
            onClick={() => onSelect(theme.key)}
            style={{
              width: 72,
              height: 48,
              borderRadius: 6,
              border: selectedTheme === theme.key ? '2px solid #7C3AED' : `1px solid ${c.chromeBorder}`,
              background: theme.colors.bg,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: 2,
            }}
          >
            <div style={{
              width: 40,
              height: 3,
              borderRadius: 1,
              background: theme.colors.text,
              opacity: 0.6,
            }} />
            <div style={{
              width: 28,
              height: 3,
              borderRadius: 1,
              background: theme.colors.text,
              opacity: 0.3,
            }} />
            <span style={{
              fontSize: 8,
              color: theme.colors.text,
              marginTop: 2,
              opacity: 0.8,
            }}>
              {theme.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {renderGroup('Light Themes', lightThemes)}
      {renderGroup('Dark Themes', darkThemes)}
    </>
  );
}

// ── Shared components ──

function SettingRow({ label, supported, hint, children, colors: c }) {
  return (
    <div style={{ marginBottom: 14, opacity: supported ? 1 : 0.4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{label}</span>
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: c.chromeText, marginTop: 2 }}>{hint}</div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 32,
        height: 18,
        borderRadius: 9,
        border: 'none',
        background: checked && !disabled ? '#7C3AED' : '#9CA3AF',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

function formatPrice(priceStr) {
  const p = parseFloat(priceStr);
  if (!p || isNaN(p)) return '-';
  return `$${(p * 1e6).toFixed(2)}`;
}
