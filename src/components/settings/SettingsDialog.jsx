import React, { useState, useEffect, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import useEditorStore from '../../store/useEditorStore';
import useFocusTrap from '../../hooks/useFocusTrap';
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
    const config = PROVIDERS[providerId];
    if (!prov?.apiKey && config?.requiresApiKey !== false) return;

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

  const focusTrapRef = useFocusTrap(isOpen);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Active provider dropdown shows providers that have an API key OR don't require one
  const configuredProviders = PROVIDER_ORDER.filter((id) => localProviders[id]?.apiKey || PROVIDERS[id]?.requiresApiKey === false);

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
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
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
            <button style={tabStyle(activeTab === 'accessibility')} onClick={() => setActiveTab('accessibility')}>
              Accessibility
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
          {activeTab === 'accessibility' && (
            <AccessibilityTab colors={c} />
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
              {PROVIDERS[id].name}{!configuredProviders.includes(id) && PROVIDERS[id]?.requiresApiKey !== false ? ' (no key)' : ''}
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

function formatImagePrice(pricing) {
  if (!pricing) return null;
  // OpenRouter frontend API: pricing.image_output is cost per image token
  // Multiply by 1000 to get approximate cost per image (rough estimate at ~1000 tokens/image)
  // pricing.image is used by some older entries
  const raw = pricing.image_output ?? pricing.image_token ?? pricing.image ?? pricing.request ?? null;
  if (raw) {
    const p = parseFloat(raw);
    if (!isNaN(p) && p > 0) {
      // image_output/image_token values are per-token — convert to $/img (≈1000 tokens)
      const isPerToken = (pricing.image_output != null || pricing.image_token != null) && pricing.image == null;
      const perImg = isPerToken ? p * 1000 : p;
      return `$${perImg < 0.001 ? perImg.toFixed(5) : perImg < 0.01 ? perImg.toFixed(4) : perImg.toFixed(3)}/img`;
    }
  }
  return null;
}

function ImageTab({ imageSettings, onUpdate, localProviders, colors: c }) {
  const configuredProviders = PROVIDER_ORDER.filter((id) => localProviders[id]?.apiKey || PROVIDERS[id]?.requiresApiKey === false);

  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  const handleBrowse = async () => {
    const pid = imageSettings.provider;
    if (!pid) return;
    const apiKey = localProviders[pid]?.apiKey;
    if (!apiKey && PROVIDERS[pid]?.requiresApiKey !== false) return;

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
            {filteredModels.map((m) => {
              const isSelected = m.id === imageSettings.model;
              const price = formatImagePrice(m.pricing);
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelectModel(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontSize: 12,
                    background: isSelected ? 'rgba(124,58,237,0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #7C3AED' : '3px solid transparent',
                    color: c.text,
                    border: 'none',
                    borderBottom: `1px solid ${c.chromeBorder}`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = `${c.chromeBorder}44`; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Checkmark */}
                  <span style={{ width: 14, fontSize: 11, color: '#7C3AED', flexShrink: 0 }}>
                    {isSelected ? '\u2713' : ''}
                  </span>
                  {/* Display name + model id */}
                  <span style={{ flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.id}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: c.chromeText, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</span>
                  </span>
                  {/* Pricing right-aligned */}
                  {price && (
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: c.chromeText, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {price}
                    </span>
                  )}
                </button>
              );
            })}
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
      {imageSettings.provider && imageSettings.model && (() => {
        // Warn if the model looks like a text/chat model rather than an image generator
        const m = imageSettings.model;
        const looksLikeTextModel = m === 'openrouter/auto' || m.includes('claude') || m.includes('gpt-4') || m.includes('gpt-3') || m.includes('llama') || m.includes('gemini') && !m.includes('image');
        return looksLikeTextModel ? (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(234,179,8,0.1)', borderRadius: 6, fontSize: 11, color: '#92400E' }}>
            <strong>Warning:</strong> <code style={{ fontSize: 11 }}>{m}</code> appears to be a text model, not an image generator. Use Browse to select a model like <code style={{ fontSize: 11 }}>black-forest-labs/flux-1.1-pro</code>.
          </div>
        ) : (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.chromeBorder}`, fontSize: 11, color: c.chromeText }}>
            Ready:{' '}
            <strong style={{ color: c.text }}>{PROVIDERS[imageSettings.provider]?.name}</strong>
            {' / '}
            <code style={{ fontSize: 11 }}>{imageSettings.model}</code>
          </div>
        );
      })()}

      {!imageSettings.provider && (
        <div style={{ marginTop: 12, padding: 12, background: 'rgba(234,179,8,0.1)', borderRadius: 6, fontSize: 11, color: '#92400E' }}>
          No provider selected. Add an API key to a provider in the Providers tab first, then select it here.
        </div>
      )}
    </div>
  );
}

// ── Tab: Accessibility ──

function AccessibilityTab({ colors: c }) {
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setZoomLevel = useEditorStore((s) => s.setZoomLevel);
  const dyslexiaFont = useEditorStore((s) => s.dyslexiaFont);
  const setDyslexiaFont = useEditorStore((s) => s.setDyslexiaFont);
  const letterSpacing = useEditorStore((s) => s.letterSpacing);
  const setLetterSpacing = useEditorStore((s) => s.setLetterSpacing);
  const lineHeightA11y = useEditorStore((s) => s.lineHeightA11y);
  const setLineHeightA11y = useEditorStore((s) => s.setLineHeightA11y);
  const reducedMotion = useEditorStore((s) => s.reducedMotion);
  const setReducedMotion = useEditorStore((s) => s.setReducedMotion);
  const minFontSize = useEditorStore((s) => s.minFontSize);
  const setMinFontSize = useEditorStore((s) => s.setMinFontSize);

  const zoomOptions = [
    { value: 1.0, label: '100%' },
    { value: 1.15, label: '115%' },
    { value: 1.3, label: '130%' },
    { value: 1.5, label: '150%' },
  ];

  const buttonGroupStyle = (active) => ({
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    background: active ? '#7C3AED' : 'transparent',
    color: active ? '#fff' : c.chromeText,
    border: `1px solid ${active ? '#7C3AED' : c.chromeBorder}`,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: c.chromeText, marginBottom: 16, lineHeight: 1.5 }}>
        Adjust display settings for better readability and comfort.
        Changes take effect immediately.
      </div>

      {/* Zoom Level */}
      <SettingRow label="Zoom Level" supported={true} hint="Scales the entire interface — text, buttons, and panels" colors={c}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
          {zoomOptions.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => setZoomLevel(opt.value)}
              style={{
                ...buttonGroupStyle(zoomLevel === opt.value),
                borderRadius: i === 0 ? '6px 0 0 6px' : i === zoomOptions.length - 1 ? '0 6px 6px 0' : 0,
                borderRight: i < zoomOptions.length - 1 ? 'none' : undefined,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Dyslexia Font */}
      <SettingRow label="Dyslexia-Friendly Font" supported={true} hint="Use OpenDyslexic font for improved letter recognition" colors={c}>
        <ToggleSwitch checked={dyslexiaFont} onChange={setDyslexiaFont} />
      </SettingRow>

      {/* Letter Spacing */}
      <SettingRow label="Letter Spacing" supported={true} hint="Increase space between letters for readability" colors={c}>
        <select
          value={letterSpacing}
          onChange={(e) => setLetterSpacing(parseFloat(e.target.value))}
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
          <option value={0}>Normal</option>
          <option value={0.05}>Wide (+0.05em)</option>
          <option value={0.1}>Extra Wide (+0.1em)</option>
        </select>
      </SettingRow>

      {/* Line Height */}
      <SettingRow label="Line Height" supported={true} hint="Increase space between lines of text" colors={c}>
        <select
          value={lineHeightA11y}
          onChange={(e) => setLineHeightA11y(e.target.value)}
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
          <option value="normal">Normal (1.5)</option>
          <option value="relaxed">Relaxed (1.75)</option>
          <option value="loose">Loose (2.0)</option>
        </select>
      </SettingRow>

      {/* Minimum Font Size */}
      <SettingRow label="Minimum Font Size" supported={true} hint="Prevent any text in the interface from being smaller than 12px" colors={c}>
        <ToggleSwitch checked={minFontSize} onChange={setMinFontSize} />
      </SettingRow>

      {/* Reduced Motion */}
      <SettingRow label="Reduce Motion" supported={true} hint="Minimize animations and transitions throughout the interface" colors={c}>
        <ToggleSwitch checked={reducedMotion} onChange={setReducedMotion} />
      </SettingRow>
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
