# 7 — Settings & Providers

> **Entry points covered:** Configure provider API key (7.1), Select model (7.2), Chat settings (7.3), Image generation (7.4), Provider adapter call path (7.5), Model capability detection (7.6).

---

## 7.0 — Settings & Provider Overview

```mermaid
graph TD
    subgraph SettingsDialog["SettingsDialog.jsx"]
        ProviderCards["Provider Cards\n(one per provider)"]
        ChatSettingsUI["Chat Settings\n(tools, temp, max tokens, mode)"]
        ImageSettingsUI["Image Settings\n(provider, model, size)"]
        VoiceTab["Voice Tab\n(TTS settings)"]
    end

    subgraph Stores["useAppStore"]
        ProviderState["providerState\n{selectedModel, apiKey, availableModels}"]
        ChatSettings["chatSettings\n{toolsEnabled, temp, maxTokens, promptMode}"]
        ImageSettings["imageSettings\n{provider, model, size, quality}"]
    end

    subgraph API["API Layer"]
        providers_js["providers.js\n(registry: 8 providers)"]
        providerAdapter["providerAdapter.js\n(unified callCompletion)"]
        claude_js["claude.js\n(modelSupportsTools, etc.)"]
        imageGeneration["imageGeneration.js"]
    end

    subgraph Streams["Streaming"]
        chatStreaming["chatStreaming.js\n(openai-compat)"]
        anthropicStreaming["anthropicStreaming.js\n(Anthropic SDK)"]
    end

    SettingsDialog --> Stores
    Stores --> API
    providerAdapter --> Streams
    providerAdapter --> providers_js
    claude_js --> Stores
```

---

## 7.1 — Configure Provider API Key

```mermaid
flowchart TD
    A([User opens Settings dialog]) --> B["SettingsDialog renders\none ProviderCard per provider"]
    B --> C([User types API key in ProviderCard input])
    C --> D["ProviderCard: onChange → local state"]
    D --> E([User clicks 'Save' or blurs field])
    E --> F["useAppStore.updateProvider(providerId, {apiKey: value})"]
    F --> G["providerState[providerId].apiKey = value"]
    G --> H["Zustand persist → localStorage"]
    H --> I["ProviderCard shows\ngreen indicator for valid key\n(non-empty)"]

    J([Settings saved to disk]) --> K["SettingsDialog 'Save to Disk' button"]
    K --> L["Collect all provider configs\n+ chatSettings + imageSettings"]
    L --> M["useProjectStore.saveSettings(\ncollected settings object)"]
    M --> N["arcwriteFS.writeSettings(\narcwriteHandle, settings)"]
    N --> O["Write Arcwrite/settings.json"]
    O --> P([Settings persisted to Arcwrite folder\nsurvives browser data clear])
```

---

## 7.2 — Select Model

```mermaid
flowchart TD
    A([App mounts / provider API key changes]) --> B["useAppStore: loadModels(providerId)"]
    B --> C["providerAdapter.fetchModels(providerId)"]
    C --> D{"Provider protocol?"}
    D -->|"openai-compat"| E["GET {baseUrl}/models\nwith Authorization: Bearer {apiKey}"]
    D -->|"anthropic-native"| F["Anthropic SDK: client.models.list()"]
    D -->|"local (ollama, etc.)"| G["GET localhost:{port}/api/tags\nor /v1/models"]
    E --> H["Parse model list\nfilter by provider.modelFilter if set"]
    F --> H
    G --> H
    H --> I["useAppStore.setAvailableModels(providerId, models[])"]
    I --> J["ProviderCard model dropdown populated"]

    K([User selects model from dropdown]) --> L["useAppStore.updateProvider(providerId, {selectedModel: modelId})"]
    L --> M["Persisted to localStorage"]
    M --> N["ChatPanel reads:\nconst model = availableModels.find(m => m.id === selectedModel)"]
    N --> O["modelSupportsTools(model)\n→ determines toolsActive"]
    O --> P{toolsActive?}
    P -->|Yes| Q["AI label turns green in ChatPanel\nTool calling enabled in useChatSend"]
    P -->|No| R["Plain streaming only\nNo tool loop"]
```

---

## 7.3 — Chat Settings

```mermaid
flowchart TD
    A([User changes Temperature slider]) --> B["useAppStore.updateChatSettings({temperature: val})"]
    B --> C["chatSettings.temperature = val\n(persisted via Zustand persist)"]
    C --> D["Applied on next LLM call:\nproviderAdapter passes temp to API"]

    E([User toggles Tools Enabled]) --> F["useAppStore.updateChatSettings({toolsEnabled: val})"]
    F --> G["toolsActive = toolsEnabled && modelSupportsTools(model)"]
    G --> H{toolsActive?}
    H -->|Yes| I["useChatSend includes toolDefinitions\nIn LLM call params"]
    H -->|No| J["Simple streaming only"]

    K([User changes Prompt Mode in ChatPanel]) --> L["Dropdown: Full Context / Line Editor /\nWriting Partner / Critic / Version Comparator"]
    L --> M["useAppStore.updateChatSettings({promptMode: val})"]
    M --> N["contextBuilder.buildEditModePrompt(promptMode)\nused instead of full system prompt"]
```

---

## 7.4 — Image Generation

```mermaid
flowchart TD
    A([User types image request in chat\n+ Image Mode active]) --> B["ChatPanel detects imageMode = true"]
    B --> C["useChatSend: detect image request\nor LLM calls generateImage tool"]
    C --> D["actionExecutor.generateImage(prompt, options)"]
    D --> E["imageGeneration.js\ngenerateImage(settings, prompt)"]
    E --> F{Image provider?}
    F -->|"openai (DALL-E)"| G["POST https://api.openai.com/v1/images/generations\n{prompt, model, size, quality}"]
    F -->|"openrouter (flux, etc.)"| H["POST openrouter endpoint\nwith image generation params"]
    F -->|"Custom endpoint"| I["POST imageSettings.endpoint"]
    G --> J["Response: {data: [{url}]} or {data: [{b64_json}]}"]
    H --> J
    I --> J
    J --> K["Download image bytes"]
    K --> L["arcwriteFS.writeArtifact(\narcwriteHandle, filename, bytes)"]
    L --> M["Save to Arcwrite/artifacts/{timestamp}.png"]
    M --> N["Return artifact path to LLM\nor insert markdown image in chat"]
    N --> O(["Image shown inline in ChatMessage\nvia ![alt](artifacts/...) markdown"])

    P([User opens Settings → Image tab]) --> Q["imageSettings: provider, model, size, quality, endpoint"]
    Q --> R["useAppStore.updateImageSettings({...})"]
    R --> S["Persisted to localStorage"]
```

---

## 7.5 — Provider Adapter Call Path

The unified interface that all LLM calls go through.

```mermaid
flowchart TD
    A["providerAdapter.callCompletion(\nproviderId, systemPrompt,\nmessages, settings, tools?)"] --> B["Look up provider config\nfrom providers.js registry"]
    B --> C{protocol?}

    C -->|"anthropic-native"| D["anthropicStreaming.js\nAnthropic SDK client.messages.stream()"]
    C -->|"openai-compat"| E["chatStreaming.js\nfetch(endpoint + '/chat/completions')\nContent-Type: text/event-stream"]

    D --> F["Stream MessageStreamEvent chunks"]
    E --> G["Stream SSE 'data: {...}' lines"]

    F --> H["Extract: text deltas, tool_use blocks,\ninput_json_delta (streaming tool args)"]
    G --> I["Extract: delta.content, delta.tool_calls\nparse JSON as it streams"]

    H --> J["Yield chunks to useChatSend\n(text → streamBuffer)"]
    I --> J

    J --> K{Tool calls\nin response?}
    K -->|Yes| L["Return tool_use blocks\nto useChatSend for processing\n(2.2 Tool Calling Loop)"]
    K -->|No| M["finalizeStream()\nMove buffer to messages[]"]

    N["providerAdapter.fetchModels(providerId)"] --> O["GET {baseUrl}/models\nwith provider's auth headers"]
    O --> P["Parse + return model list\n(used by 7.2 Model Selection)"]
```

---

## 7.6 — Model Capability Detection

```mermaid
flowchart TD
    A["model object from availableModels[]"] --> B["claude.js: modelSupportsTools(model)"]
    B --> C{model has\nsupportedParameters?}
    C -->|Yes| D["return model.supportedParameters.includes('tools')"]
    C -->|No (local/unknown)| E["return false"]
    D --> F{toolsActive\n= toolsEnabled && result}
    E --> F
    F --> G["ChatPanel: AI label green if toolsActive"]
    F --> H["useChatSend: include toolDefinitions if toolsActive"]
    F --> I["ProviderCard: model name green if supportsTools"]
```

---

## 7.7 — Provider Registry Structure

Eight providers are defined in `src/api/providers.js`. Each has:

```mermaid
graph TD
    subgraph ProviderEntry["providers[id] = {...}"]
        id["id: 'openrouter'"]
        name["name: 'OpenRouter'"]
        keyUrl["keyUrl: URL to get API key"]
        protocol["protocol: 'openai-compat' | 'anthropic-native'"]
        baseUrl["baseUrl: API endpoint base"]
        endpoint["endpoint: /chat/completions"]
        extraHeaders["extraHeaders: {HTTP-Referer, ...}"]
        modelFilter["modelFilter: fn to filter model list"]
        hardcodedModels["hardcodedModels: fallback if API unavailable"]
    end

    subgraph Providers["Provider IDs"]
        openrouter
        openai
        anthropic
        perplexity
        ollama["ollama (localhost:11434)"]
        lmstudio["lm-studio (localhost:1234)"]
        jan["jan (localhost:1337)"]
        localai["localai (localhost:8080)"]
    end
```

---

## 7.8 — Key Files

| File | Role |
|------|------|
| `src/api/providers.js` | Static registry of all 8 providers with connection details |
| `src/api/providerAdapter.js` | `callCompletion()`, `fetchModels()` — unified LLM interface |
| `src/api/chatStreaming.js` | SSE streaming + tool call parsing for openai-compat providers |
| `src/api/anthropicStreaming.js` | Anthropic SDK streaming implementation |
| `src/api/claude.js` | `modelSupportsTools()`, `modelSupportsReasoning()` |
| `src/api/imageGeneration.js` | `generateImage()` — DALL-E, Flux, custom endpoint |
| `src/components/settings/SettingsDialog.jsx` | Full settings modal |
| `src/components/settings/ProviderCard.jsx` | Per-provider key + model selector (model names in green if tools-capable) |
| `src/store/useAppStore.js` | `providerState`, `chatSettings`, `imageSettings`, `updateProvider`, `updateChatSettings` |
