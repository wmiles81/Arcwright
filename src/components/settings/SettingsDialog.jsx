import React, { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import useEditorStore from '../../store/useEditorStore';
import useProjectStore from '../../store/useProjectStore';
import { getTheme, lightThemes, darkThemes } from '../edit/editorThemes';
import { PROVIDERS, PROVIDER_ORDER } from '../../api/providers';
import { fetchModels, fetchImageModels } from '../../api/providerAdapter';
import ProviderCard from './ProviderCard';
import VoiceTab from './VoiceTab';

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
  const [localImageSettings, setLocalImageSettings] = useState({});

  // Sync from store when dialog opens
  useEffect(() => {
    if (isOpen) {
      const app = useAppStore.getState();
      const editor = useEditorStore.getState();
      setLocalActiveProvider(app.activeProvider);
      setLocalProviders(JSON.parse(JSON.stringify(app.providers)));
      setLocalChatSettings({ ...app.chatSettings });
      setLocalEditorTheme(editor.editorTheme);
      setLocalImageSettings({ ...app.imageSettings });
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

    // Commit chat settings — preserve voice/gender fields since VoiceTab manages them independently
    const { activeVoicePath, activeVoiceContent, activeNarratorGender, activeGenderMechanicsContent } = useAppStore.getState().chatSettings;
    app.updateChatSettings({ ...localChatSettings, activeVoicePath, activeVoiceContent, activeNarratorGender, activeGenderMechanicsContent });

    // Commit image settings
    app.updateImageSettings(localImageSettings);

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
        chatSettings: { ...localChatSettings, activeVoicePath, activeVoiceContent, activeNarratorGender, activeGenderMechanicsContent },
        editorTheme: localEditorTheme,
        imageSettings: localImageSettings,
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
            <button style={tabStyle(activeTab === 'voice')} onClick={() => setActiveTab('voice')}>
              Voice
            </button>
            <button style={tabStyle(activeTab === 'image')} onClick={() => setActiveTab('image')}>
              Image
            </button>
            <button style={tabStyle(activeTab === 'packs')} onClick={() => setActiveTab('packs')}>
              Packs
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
          {activeTab === 'voice' && (
            <VoiceTab colors={c} />
          )}
          {activeTab === 'image' && (
            <ImageTab
              imageSettings={localImageSettings}
              onUpdate={(u) => setLocalImageSettings((prev) => ({ ...prev, ...u }))}
              localProviders={localProviders}
              colors={c}
            />
          )}
          {activeTab === 'packs' && (
            <PacksTab colors={c} />
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

// ── Tab: Packs ──

function PacksTab({ colors: c }) {
  const dataPacks = useProjectStore((s) => s.dataPacks);
  const dataPacksLoaded = useProjectStore((s) => s.dataPacksLoaded);
  const isInitialized = useProjectStore((s) => s.isInitialized);

  if (!isInitialized) {
    return (
      <div style={{ fontSize: 13, color: c.chromeText, textAlign: 'center', padding: 32 }}>
        Connect an Arcwrite folder to use data packs.
      </div>
    );
  }

  if (!dataPacksLoaded) {
    return (
      <div style={{ fontSize: 13, color: c.chromeText, textAlign: 'center', padding: 32 }}>
        Loading packs...
      </div>
    );
  }

  if (dataPacks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>&#128230;</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 6 }}>No Data Packs Installed</div>
        <div style={{ fontSize: 12, color: c.chromeText, lineHeight: 1.5, maxWidth: 360, margin: '0 auto' }}>
          Place pack folders in <code style={{ background: c.bg, padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>Arcwrite/extensions/</code> to
          extend Arcwright with custom genres, plot structures, prompts, and sequences.
        </div>
        <div style={{ fontSize: 11, color: c.chromeText, marginTop: 12, opacity: 0.7 }}>
          Each pack needs a <code style={{ fontSize: 10 }}>pack.json</code> manifest.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: c.chromeText, marginBottom: 4 }}>
        {dataPacks.length} pack{dataPacks.length !== 1 ? 's' : ''} loaded from <code style={{ background: c.bg, padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>Arcwrite/extensions/</code>
      </div>
      {dataPacks.map((pack) => {
        const content = pack.content || {};
        const genreCount = content.genres ? Object.keys(content.genres).length : 0;
        const structureCount = content.structures ? Object.keys(content.structures).length : 0;
        const promptCount = content.prompts?.length || 0;
        const sequenceCount = content.sequences?.length || 0;
        const parts = [];
        if (genreCount) parts.push(`${genreCount} genre${genreCount !== 1 ? 's' : ''}`);
        if (structureCount) parts.push(`${structureCount} structure${structureCount !== 1 ? 's' : ''}`);
        if (promptCount) parts.push(`${promptCount} prompt${promptCount !== 1 ? 's' : ''}`);
        if (sequenceCount) parts.push(`${sequenceCount} sequence${sequenceCount !== 1 ? 's' : ''}`);

        return (
          <div
            key={pack.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.chromeBorder}`,
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{pack.name}</div>
                {pack.author && (
                  <div style={{ fontSize: 11, color: c.chromeText, marginTop: 1 }}>by {pack.author}</div>
                )}
              </div>
              {pack.version && (
                <span style={{
                  fontSize: 10,
                  color: c.chromeText,
                  background: c.chrome,
                  border: `1px solid ${c.chromeBorder}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontFamily: 'monospace',
                }}>
                  v{pack.version}
                </span>
              )}
            </div>
            {pack.description && (
              <div style={{ fontSize: 12, color: c.chromeText, marginTop: 6, lineHeight: 1.4 }}>
                {pack.description}
              </div>
            )}
            {parts.length > 0 && (
              <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 8, fontWeight: 500 }}>
                {parts.join(' \u00B7 ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Image ──

function ImageTab({ imageSettings, onUpdate, localProviders, colors: c }) {
  const configuredProviders = PROVIDER_ORDER.filter((id) => localProviders[id]?.apiKey);

  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  const handleBrowse = async () => {
    const pid = imageSettings.provider;
    if (!pid) return;
    const apiKey = localProviders[pid]?.apiKey;
    if (!apiKey) return;

    setModelsLoading(true);
    setModelsError('');
    setShowBrowser(true);
    try {
      const models = await fetchImageModels(pid, apiKey);
      setImageModels(models);
      if (models.length === 0) setModelsError('No image models found for this provider.');
    } catch (err) {
      setModelsError(err.message);
      setImageModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSelectModel = (modelId) => {
    onUpdate({ model: modelId });
    setShowBrowser(false);
    setModelFilter('');
  };

  // Reset browser when provider changes
  const prevProvider = React.useRef(imageSettings.provider);
  useEffect(() => {
    if (imageSettings.provider !== prevProvider.current) {
      prevProvider.current = imageSettings.provider;
      setShowBrowser(false);
      setImageModels([]);
      setModelFilter('');
    }
  }, [imageSettings.provider]);

  const filteredModels = modelFilter
    ? imageModels.filter((m) =>
        m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
        (m.name && m.name.toLowerCase().includes(modelFilter.toLowerCase()))
      )
    : imageModels;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: c.chromeText, marginBottom: 14, lineHeight: 1.5 }}>
        Configure which provider and model to use for image generation.
        Select a provider, then browse available image models or type a model ID directly.
      </div>

      {/* Provider selector */}
      <SettingRow label="Provider" supported={true} hint="Which provider to route image generation calls to" colors={c}>
        <select
          value={imageSettings.provider || ''}
          onChange={(e) => onUpdate({ provider: e.target.value })}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: 13,
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: 6,
            outline: 'none',
          }}
        >
          <option value="">Select a provider</option>
          {configuredProviders.map((id) => (
            <option key={id} value={id}>
              {PROVIDERS[id].name}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* Model ID — free text input + Browse button */}
      <SettingRow label="Model" supported={true} hint="Type a model ID or browse available image models from your provider" colors={c}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={imageSettings.model || ''}
            onChange={(e) => onUpdate({ model: e.target.value })}
            placeholder="e.g., dall-e-3 or black-forest-labs/flux-1.1-pro"
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 13,
              fontFamily: 'monospace',
              background: c.bg,
              color: c.text,
              border: `1px solid ${c.chromeBorder}`,
              borderRadius: 6,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleBrowse}
            disabled={!imageSettings.provider || modelsLoading}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: imageSettings.provider ? '#7C3AED' : c.chrome,
              color: imageSettings.provider ? '#fff' : c.chromeText,
              border: imageSettings.provider ? 'none' : `1px solid ${c.chromeBorder}`,
              borderRadius: 6,
              cursor: imageSettings.provider ? 'pointer' : 'not-allowed',
              opacity: modelsLoading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {modelsLoading ? 'Loading...' : 'Browse'}
          </button>
        </div>
      </SettingRow>

      {/* Model browser panel */}
      {showBrowser && (
        <div style={{
          marginBottom: 14,
          border: `1px solid ${c.chromeBorder}`,
          borderRadius: 8,
          background: c.bg,
          overflow: 'hidden',
        }}>
          {/* Search filter */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${c.chromeBorder}` }}>
            <input
              type="text"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Filter models..."
              autoFocus
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 12,
                background: c.chrome,
                color: c.text,
                border: `1px solid ${c.chromeBorder}`,
                borderRadius: 4,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Model list */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {modelsLoading && (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: c.chromeText }}>
                Fetching image models...
              </div>
            )}
            {modelsError && (
              <div style={{ padding: 12, fontSize: 11, color: '#DC2626' }}>{modelsError}</div>
            )}
            {!modelsLoading && filteredModels.length === 0 && !modelsError && (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: c.chromeText }}>
                {modelFilter ? 'No matching models.' : 'No image models found.'}
              </div>
            )}
            {filteredModels.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectModel(m.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  background: m.id === imageSettings.model ? 'rgba(124,58,237,0.1)' : 'transparent',
                  color: c.text,
                  border: 'none',
                  borderBottom: `1px solid ${c.chromeBorder}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = m.id === imageSettings.model ? 'rgba(124,58,237,0.1)' : 'transparent'; }}
              >
                <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{m.id}</div>
                {m.name && m.name !== m.id && (
                  <div style={{ fontSize: 10, color: c.chromeText, marginTop: 1 }}>{m.name}</div>
                )}
                {m.pricing?.image && (
                  <div style={{ fontSize: 10, color: c.chromeText, marginTop: 1 }}>
                    ${parseFloat(m.pricing.image).toFixed(3)}/image
                  </div>
                )}
                {!m.pricing?.image && m.pricing?.prompt && (
                  <div style={{ fontSize: 10, color: c.chromeText, marginTop: 1 }}>
                    ${(parseFloat(m.pricing.prompt) * 1e6).toFixed(2)}/M input
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer with count */}
          {!modelsLoading && imageModels.length > 0 && (
            <div style={{
              padding: '6px 12px',
              borderTop: `1px solid ${c.chromeBorder}`,
              fontSize: 10,
              color: c.chromeText,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{filteredModels.length} of {imageModels.length} image model{imageModels.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { setShowBrowser(false); setModelFilter(''); }}
                style={{ background: 'none', border: 'none', color: c.chromeText, cursor: 'pointer', fontSize: 10, textDecoration: 'underline' }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Default size */}
      <SettingRow label="Default Size" supported={true} hint="Default image dimensions (can be overridden per request)" colors={c}>
        <select
          value={imageSettings.defaultSize || '1024x1024'}
          onChange={(e) => onUpdate({ defaultSize: e.target.value })}
          style={{
            padding: '6px 10px',
            fontSize: 13,
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.chromeBorder}`,
            borderRadius: 6,
            outline: 'none',
          }}
        >
          <option value="1024x1024">1024 x 1024 (Square)</option>
          <option value="1792x1024">1792 x 1024 (Landscape)</option>
          <option value="1024x1792">1024 x 1792 (Portrait)</option>
          <option value="512x512">512 x 512 (Small)</option>
        </select>
      </SettingRow>

      {/* Status */}
      {imageSettings.provider && imageSettings.model && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.chromeBorder}`, fontSize: 11, color: c.chromeText }}>
          Ready:{' '}
          <strong style={{ color: c.text }}>{PROVIDERS[imageSettings.provider]?.name}</strong>
          {' / '}
          <code style={{ fontSize: 11 }}>{imageSettings.model}</code>
        </div>
      )}

      {!imageSettings.provider && (
        <div style={{ marginTop: 12, padding: 12, background: 'rgba(234,179,8,0.1)', borderRadius: 6, fontSize: 11, color: '#92400E' }}>
          No provider selected. Add an API key to a provider in the Providers tab first, then select it here.
        </div>
      )}
    </div>
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
