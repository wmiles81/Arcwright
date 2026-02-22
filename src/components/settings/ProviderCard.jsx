import React, { useState, useRef, useEffect } from 'react';

function formatPrice(priceStr) {
  const p = parseFloat(priceStr);
  if (!p || isNaN(p)) return null;
  const perMillion = p * 1e6;
  return perMillion < 0.01 ? '<$0.01' : `$${perMillion.toFixed(2)}`;
}

/**
 * Per-provider configuration card.
 * Shows API key input, model dropdown with pricing, refresh button, and status.
 */
export default function ProviderCard({
  config,
  providerState,
  isActive,
  onUpdate,
  onRefreshModels,
  colors: c,
}) {
  const [showKey, setShowKey] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { apiKey, selectedModel, availableModels, modelsLoading } = providerState;
  const isLocal = config.requiresApiKey === false;

  const models = availableModels?.length > 0 ? availableModels : (config.hardcodedModels || []);
  const selectedModelObj = models.find((m) => m.id === selectedModel);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleSelectModel = (modelId) => {
    onUpdate({ selectedModel: modelId });
    setDropdownOpen(false);
  };

  return (
    <div
      style={{
        border: `1px solid ${isActive ? '#7C3AED' : c.chromeBorder}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 10,
        background: isActive ? `${c.chrome}` : 'transparent',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: c.text }}>{config.name}</span>
        {isActive && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#7C3AED',
              background: '#7C3AED20',
              padding: '1px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Active
          </span>
        )}
        <span style={{ fontSize: 11, color: c.chromeText, marginLeft: 'auto' }}>
          {config.description}
        </span>
      </div>

      {/* API Key / Local setup */}
      <div style={{ marginBottom: 8 }}>
        {isLocal ? (
          /* Local provider — show setup instructions instead of key input */
          <div style={{
            padding: '6px 8px',
            fontSize: 11,
            color: c.chromeText,
            background: `${c.chromeBorder}33`,
            borderRadius: 4,
            borderLeft: '2px solid #7C3AED88',
          }}>
            <span style={{ fontWeight: 600, color: '#A78BFA' }}>Setup: </span>
            {config.localSetup}
          </div>
        ) : (
          <>
            <label style={{ fontSize: 11, color: c.chromeText, display: 'block', marginBottom: 3 }}>
              API Key
              {config.keyUrl && (
                <a
                  href={config.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 6, fontSize: 10, color: '#7C3AED' }}
                >
                  Get key
                </a>
              )}
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => onUpdate({ apiKey: e.target.value })}
                placeholder={config.keyPlaceholder}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  background: c.bg,
                  color: c.text,
                  border: `1px solid ${c.chromeBorder}`,
                  borderRadius: 4,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  background: 'none',
                  border: `1px solid ${c.chromeBorder}`,
                  borderRadius: 4,
                  color: c.chromeText,
                  fontSize: 11,
                  padding: '0 8px',
                  cursor: 'pointer',
                }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Model selector — custom dropdown with pricing */}
      <div>
        <label style={{ fontSize: 11, color: c.chromeText, display: 'block', marginBottom: 3 }}>
          Model
        </label>
        <div style={{ display: 'flex', gap: 4 }} ref={dropdownRef}>
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Trigger button */}
            <button
              onClick={() => models.length > 0 && setDropdownOpen(!dropdownOpen)}
              disabled={models.length === 0}
              style={{
                width: '100%',
                padding: '5px 28px 5px 8px',
                fontSize: 13,
                background: c.bg,
                color: c.text,
                border: `1px solid ${dropdownOpen ? '#7C3AED' : c.chromeBorder}`,
                borderRadius: 4,
                outline: 'none',
                textAlign: 'left',
                cursor: models.length === 0 ? 'not-allowed' : 'pointer',
                position: 'relative',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {models.length === 0
                ? (isLocal || apiKey ? 'Click ↻ to load models' : 'Enter API key first')
                : (selectedModelObj?.name || selectedModel || 'Select a model')
              }
              {/* Chevron */}
              <span style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: `translateY(-50%) rotate(${dropdownOpen ? 180 : 0}deg)`,
                fontSize: 10,
                color: c.chromeText,
                transition: 'transform 0.15s',
                pointerEvents: 'none',
              }}>
                {'\u25BC'}
              </span>
            </button>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 2px)',
                  left: 0,
                  right: 0,
                  maxHeight: 360,
                  overflowY: 'auto',
                  background: c.bg,
                  border: `1px solid ${c.chromeBorder}`,
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 50,
                }}
              >
                {models.map((m) => {
                  const isSelected = m.id === selectedModel;
                  const inPrice = m.pricing ? formatPrice(m.pricing.prompt) : null;
                  const outPrice = m.pricing ? formatPrice(m.pricing.completion) : null;
                  const hasPricing = inPrice || outPrice;

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: c.text,
                        background: isSelected ? '#7C3AED18' : 'transparent',
                        borderLeft: isSelected ? '3px solid #7C3AED' : '3px solid transparent',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = `${c.chromeBorder}44`; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Checkmark for selected */}
                      <span style={{ width: 16, fontSize: 12, color: '#7C3AED', flexShrink: 0 }}>
                        {isSelected ? '\u2713' : ''}
                      </span>

                      {/* Model name */}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name || m.id}
                      </span>

                      {/* Pricing — right-aligned */}
                      {hasPricing && (
                        <span style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: c.chromeText,
                          flexShrink: 0,
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}>
                          {inPrice || '-'} / {outPrice || '-'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {config.supportsModelFetch && (
            <button
              onClick={onRefreshModels}
              disabled={(!isLocal && !apiKey) || modelsLoading}
              style={{
                background: 'none',
                border: `1px solid ${c.chromeBorder}`,
                borderRadius: 4,
                color: modelsLoading ? c.chromeText : c.text,
                fontSize: 12,
                padding: '0 8px',
                cursor: (isLocal || apiKey) && !modelsLoading ? 'pointer' : 'not-allowed',
                opacity: (!isLocal && !apiKey) ? 0.4 : 1,
              }}
            >
              {modelsLoading ? '...' : '\u21BB'}
            </button>
          )}
        </div>
      </div>

      {/* Status line */}
      <div style={{ marginTop: 6, fontSize: 10, color: c.chromeText }}>
        {modelsLoading
          ? 'Loading models...'
          : models.length > 0
            ? `${models.length} model${models.length !== 1 ? 's' : ''} available`
            : isLocal
              ? 'Click ↻ to fetch models from local server'
              : !apiKey
                ? 'No API key set'
                : config.supportsModelFetch
                  ? 'Click ↻ to load models'
                  : ''
        }
      </div>
    </div>
  );
}
