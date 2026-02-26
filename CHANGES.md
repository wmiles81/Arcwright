# Arcwright Development Activity Log

Tracks significant changes, architectural decisions, and bug fixes. Most recent first.

---

## 2026-02-25

### Storage Architecture Reorganization

**Problem:** AI project JSON files in `projects/ai/` contained bloated `chatHistory` arrays and `cachedContent` for reference-mode files. Chat history had no versioning. Structure was confusing — config and history mixed in one file.

**Changes:**
- AI project configs moved: `projects/ai/{Name}.json` → `chat-history/{Name}/project.json`
- Chat history moved: embedded in project JSON → `chat-history/{Name}/active.json`
- "New Chat" now archives `active.json` → `{timestamp}.json` before clearing — nothing is ever destroyed
- `cachedContent` stripped from reference-mode files on project load; `AiProjectEditor` clears it when mode switches to reference
- `initArcwrite` now creates `chat-history/` instead of `projects/ai/` on init
- `projects/ai/` is now unused; legacy `.chats/` fallback retained in `readAiChatHistory` for migration

**Files:** `src/services/arcwriteFS.js`, `src/store/useProjectStore.js`, `src/components/projects/AiProjectEditor.jsx`

---

### Storage Folder Detection

**Problem:** If the user picked their existing `Arcwrite/` folder as the storage location, `initArcwrite` would create a nested `Arcwrite/Arcwrite/` inside it.

**Changes:**
- `SetupBanner.handleSetup`: detects folder names matching `/^arcwri(te|ght)$/i` and shows a `window.confirm` — OK uses the folder directly, Cancel creates a subfolder inside it
- `initArcwrite` accepts `{ direct: boolean }` option
- `setRootDirectory` accepts and passes through `{ direct }`

**Files:** `src/components/projects/SetupBanner.jsx`, `src/services/arcwriteFS.js`, `src/store/useProjectStore.js`

---

### Image Generation Fixes

**Problem:** Multiple issues — OpenRouter model routing wrong, regenerate button sent image to chat LLM instead of regenerating, images saved to wrong location, file tree overwritten with Arcwrite root.

**Changes:**
- OpenRouter routing: dual-output models (Gemini Image, GPT-5-image) use `modalities: ["image","text"]`; image-only models (Flux, Seedream, Sourceful) use `modalities: ["image"]`
- Regenerate button: detects `imageArtifact` on the message and calls `ACTION_HANDLERS.generateImage` directly instead of routing to the chat LLM
- Image save location: book project `images/` when active; `arcwriteHandle/images/` otherwise
- File tree refresh: only called when saving inside a book project — prevents Arcwrite root appearing as the project file tree
- `resolveBookProjectHandle` fallback removed from `generateImage`; pre-flight checks give clear error messages
- OpenRouter model discovery: reverted to frontend proxy (`/or-image-models`) — `/api/v1/models` only returns 4 image models vs 15+ from the frontend API

**Files:** `src/api/imageGeneration.js`, `src/chat/actionExecutor.js`, `src/components/chat/ChatPanel.jsx`, `src/api/providerAdapter.js`

---

### Arcwrite Folder Migration (manual)

**Problem:** App had been connected to the Arcwright source directory (`/Volumes/home/ai-tools/.../Arcwright`) instead of the data folder (`/Volumes/home/Arcwrite`). The real working data was in `/Volumes/home/Arcwrite/Arcwrite/` (nested, because the user had originally pointed at `/Volumes/home/Arcwrite/` as the parent).

**Changes (filesystem, not code):**
- Merged `/Volumes/home/Arcwrite/Arcwrite/` into `/Volumes/home/Arcwrite/`:
  - `_Artifacts/semantic_physics_engine/` → `Arcwrite/_Artifacts/semantic_physics_engine/`
  - Settings merged: image config (Seedream 4.5) and Perplexity API key pulled from nested into root
  - Test images moved to `Arcwrite/projects/images/`
- `settings.json.bak` created as backup before merge
- Chat history extracted from project JSONs and placed in `chat-history/` (see above)

---

## Known Issues / Watch List

- `projects/ai/` directory still exists on disk (now empty). Safe to delete manually.
- `settings.json.bak` in Arcwrite root — can be deleted once settings confirmed correct.
- App must be reconnected via "Change" button → pick `/Volumes/home/Arcwrite/` → click OK when asked if it's the home folder.
