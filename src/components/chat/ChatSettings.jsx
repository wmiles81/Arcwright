import React from 'react';
import useAppStore from '../../store/useAppStore';

export default function ChatSettings({ onClose }) {
  const selectedModel = useAppStore((s) => s.selectedModel);
  const availableModels = useAppStore((s) => s.availableModels);
  const chatSettings = useAppStore((s) => s.chatSettings);
  const updateChatSettings = useAppStore((s) => s.updateChatSettings);

  const model = availableModels.find((m) => m.id === selectedModel);
  const supported = model?.supportedParameters || [];

  const supports = (param) => supported.includes(param);

  const formatPrice = (priceStr) => {
    const p = parseFloat(priceStr);
    if (!p || isNaN(p)) return '-';
    return `$${(p * 1e6).toFixed(2)}`;
  };

  return (
    <div className="border-b border-black/15 bg-gray-50 shrink-0">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-500 uppercase">Chat Settings</span>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-black"
          >
            {'\u2715'}
          </button>
        </div>

        <div className="space-y-3">
          {/* Temperature */}
          <SettingRow
            label="Temperature"
            supported={supports('temperature')}
            hint="Controls creativity / randomness"
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={chatSettings.temperature}
                onChange={(e) => updateChatSettings({ temperature: parseFloat(e.target.value) })}
                disabled={!supports('temperature')}
                className="flex-1 h-1 accent-black disabled:opacity-30"
              />
              <span className="text-xs font-mono w-7 text-right text-gray-600">
                {chatSettings.temperature.toFixed(1)}
              </span>
            </div>
          </SettingRow>

          {/* Max Tokens */}
          <SettingRow
            label="Max Tokens"
            supported={true}
            hint="Maximum response length"
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="256"
                max={model?.maxCompletionTokens || 16384}
                step="256"
                value={chatSettings.maxTokens}
                onChange={(e) => updateChatSettings({ maxTokens: parseInt(e.target.value) })}
                className="flex-1 h-1 accent-black"
              />
              <span className="text-xs font-mono w-12 text-right text-gray-600">
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
              : 'Not supported by this model — using fenced-block fallback'}
          >
            <ToggleSwitch
              checked={chatSettings.toolsEnabled}
              onChange={(v) => updateChatSettings({ toolsEnabled: v })}
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
          >
            <ToggleSwitch
              checked={chatSettings.reasoningEnabled}
              onChange={(v) => updateChatSettings({ reasoningEnabled: v })}
              disabled={!supports('reasoning')}
            />
          </SettingRow>

          {/* Model Info */}
          {model && (
            <div className="pt-2 border-t border-black/10">
              <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Model Info</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
                {model.contextLength && (
                  <>
                    <span>Context</span>
                    <span className="text-right font-mono">{(model.contextLength / 1000).toFixed(0)}k tokens</span>
                  </>
                )}
                {model.maxCompletionTokens && (
                  <>
                    <span>Max Output</span>
                    <span className="text-right font-mono">{(model.maxCompletionTokens / 1000).toFixed(0)}k tokens</span>
                  </>
                )}
                {model.pricing && (
                  <>
                    <span>Input price</span>
                    <span className="text-right font-mono">{formatPrice(model.pricing.prompt)}/M</span>
                    <span>Output price</span>
                    <span className="text-right font-mono">{formatPrice(model.pricing.completion)}/M</span>
                  </>
                )}
                {model.inputModalities?.length > 1 && (
                  <>
                    <span>Modalities</span>
                    <span className="text-right">{model.inputModalities.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, supported, hint, children }) {
  return (
    <div className={supported ? '' : 'opacity-40'}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      {children}
      {hint && (
        <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-8 h-4.5 rounded-full transition-colors ${
        checked && !disabled ? 'bg-black' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ height: '18px' }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-3.5' : ''
        }`}
        style={{ width: '14px', height: '14px' }}
      />
    </button>
  );
}
