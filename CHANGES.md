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

## 2026-02-27

### WCAG 2.1 AA Accessibility Implementation

Full accessibility overhaul for authors with physical challenges (visual impairments, dyslexia). Delivered in 6 phases.

**Phase 1 — Zoom Scaling + Reading Aids + Settings Tab:**
- CSS `zoom` on the app container scales ALL content (including 230+ inline `px` font sizes) without touching component code
- New persisted fields in `useEditorStore`: `zoomLevel`, `dyslexiaFont`, `letterSpacing`, `lineHeightA11y`, `reducedMotion`, `minFontSize`
- New "Accessibility" tab in Settings with controls for: Zoom Level (100/115/130/150%), Dyslexia Font toggle, Letter Spacing, Line Height, Minimum Font Size, Reduce Motion
- Body-level CSS effects applied via `useEffect` in `App.jsx` — font-family (OpenDyslexic when toggled), letter-spacing, line-height, `.reduce-motion` class, `data-min-font` attribute
- OpenDyslexic woff2 fonts loaded via `@font-face` in `index.css`

**Phase 2 — High-Contrast Themes + Global Theme Reach:**
- Two new themes in `editorThemes.js`: "High Contrast Light" (#000 on #FFF) and "High Contrast Dark" (#FFF on #000), both AAA ratios
- Theme colors published as CSS custom properties (`--g-bg`, `--g-text`, `--g-chrome`, etc.) on `:root` from `App.jsx`
- Tailwind semantic color tokens (`g-bg`, `g-text`, `g-chrome`, `g-border`, `g-muted`, `g-status`, `g-accent`) referencing CSS variables
- Migrated 4 highest-impact components from hardcoded Tailwind colors to `g-*` tokens: `EditWorkflow`, `ChatPanel`, `ChatMessage`, `SequencesPanel`

**Phase 3 — ARIA Labels:**
- `aria-label` on all icon-only buttons (settings gear, chat toggle, attach, send, stop, action buttons)
- `role="dialog" aria-modal="true" aria-label` on SettingsDialog, ScriptEditorDialog
- `role="menu"` / `role="menuitem"` + `aria-expanded` + `aria-haspopup` on ToolsDropdown
- `aria-hidden="true"` on decorative icon spans in ChatMessage
- `aria-label="Main navigation"` on nav, `aria-label="Main content"` on main elements

**Phase 4 — Focus Trapping:**
- New `useFocusTrap` hook (`src/hooks/useFocusTrap.js`) — traps Tab within modal container, restores focus on deactivation
- Applied to SettingsDialog and ScriptEditorDialog

**Phase 5 — Screen Reader Live Regions:**
- `aria-live="polite" role="log" aria-label="Chat messages"` on chat messages container
- `.sr-only` streaming indicator: "AI is generating a response..."
- `role="status" aria-live="polite"` on ScriptOutputPanel header
- `.sr-only` utility class in `index.css`

**Phase 6 — Small-Font Remediation:**
- CSS rules under `[data-min-font="true"]` bump Tailwind `text-[7-10px]` → 12px, `text-[11px]` → 13px, `text-xs` → 13px
- Inline `style={{ fontSize }}` instances handled by Phase 1's zoom

**Files:** `src/store/useEditorStore.js`, `src/components/layout/AppShell.jsx`, `src/components/settings/SettingsDialog.jsx`, `src/App.jsx`, `src/index.css`, `src/components/edit/editorThemes.js`, `tailwind.config.js`, `src/components/edit/EditWorkflow.jsx`, `src/components/chat/ChatPanel.jsx`, `src/components/chat/ChatMessage.jsx`, `src/components/sequences/SequencesPanel.jsx`, `src/hooks/useFocusTrap.js`, `src/components/edit/ScriptEditorDialog.jsx`, `src/components/edit/ToolsDropdown.jsx`, `src/components/edit/ScriptOutputPanel.jsx`, `public/fonts/OpenDyslexic-Regular.woff2`, `public/fonts/OpenDyslexic-Bold.woff2`

---

### Script Manager UI

**Changes:**
- New `ScriptEditorDialog` modal accessible from "Manage Scripts..." in `ToolsDropdown` — create, edit, rename, delete user scripts with a code editor
- `deleteFile` added to `scriptApi` for removing script files
- "Rename Chapter Files" builtin script added

**Files:** `src/components/edit/ScriptEditorDialog.jsx`, `src/components/edit/ToolsDropdown.jsx`

---

### Re-analyze All + Stop Analysis Buttons

**Changes:**
- "Re-analyze All" button in AnalysisWorkflow — calls `resetChaptersForReanalysis` to clear all cached analysis and re-run
- Stop button during analysis — uses `AbortController` in `useClaudeAnalysis` to cancel in-flight requests

**Files:** `src/components/analysis/AnalysisWorkflow.jsx`, `src/hooks/useClaudeAnalysis.js`

---

## 2026-02-26

### Prompts Management

**Changes:**
- Chat `/` slash menu extended to include user prompts alongside sequences. Selecting a prompt inserts its template text into the input box without auto-sending; sequences still execute immediately. Results grouped under "Sequences" / "Prompts" section headers.
- "Prompts" button added to chat panel header — opens `PromptEditorDialog` for create/edit/delete without needing to be inside a document editor.
- `InlineEditPopup` (editor): selecting a preset or custom prompt now shows an editable preview step — template variables resolved against current selection context, presented in a textarea with Run / Cancel before submission.

**Files:** `src/components/chat/ChatPanel.jsx`, `src/components/edit/InlineEditPopup.jsx`

---

### Mermaid Diagrams in Help

**Changes:**
- Sequences tab in Help page: replaced ASCII `DiagramBox` placeholders with live `MermaidDiagram` flowcharts — seq-flow (4-step sequence), seq-exit-loop (exit-condition loop), seq-condition (branching condition with retry).

**Files:** `src/components/layout/HelpPage.jsx`

---

### Scaffold: Live Tension Readout

**Problem:** Changing a dimension slider in the scaffold beat editor caused no visible change to the TENSION (derived) line. The formula is correct — the normalization against all-channels-at-maximum means a full-range stakes change moves tension by ~1 unit on a 0-10 scale, which is visually subtle.

**Changes:**
- `BeatEditorRow` collapsed header: shows `T:x.x` badge (green-tinted red) next to the dimension swatches.
- `BeatEditorRow` expanded view: "Tension:" label with a live mini progress bar and numeric score above the dimension sliders — updates instantly as sliders move.

**Files:** `src/components/scaffolding/BeatEditorRow.jsx`

---

### Bug Fixes

**AI project support files not loading (Nova):**
- Stored paths in `project.json` include a leading `Arcwrite/` prefix (e.g. `Arcwrite/projects/ai/...`). `readFileByPath` is called with `arcwriteHandle` already at the Arcwrite root, so the traversal was failing on the `Arcwrite/` segment. The incoming `path` arg was already stripped but the matched file's stored path was passed raw.
- Fix: strip `Arcwrite/` prefix from `match.path` before calling `readFileByPath`.
- **File:** `src/chat/actionExecutor.js`

**Book file path resolution (✗ → retry pattern):**
- Book files are stored at `projects/books/{Name}/{Name}.md` but the AI was requesting `projects/books/{Name}.md`. Try 1 always failed (that path resolves to a directory), forcing an AI retry with the bare filename.
- Fix: added Try 1.5 — detects `projects/books/*.md` pattern and rewrites to the nested form before falling through.
- **File:** `src/chat/actionExecutor.js`

**Chat draft input lost on pane switch:**
- `ChatPanel` unmounts completely when toggled closed. Input was local `useState`, so any draft was lost when switching to Files and back.
- Fix: moved `input` to `useChatStore` as `draftInput` / `setDraftInput`.
- **Files:** `src/store/useChatStore.js`, `src/components/chat/ChatPanel.jsx`

---

### UI Tweaks

- **Tool-capable model indicator:** Model names in the provider model list render in green when `supportedParameters` includes `'tools'`.
- **AI label:** Chat panel header "AI" label gets a green background when the active model supports tools and tools are enabled.
- **"Prompt" → "Mode":** The system prompt / agent switcher button in the chat header renamed from "Prompt" to "Mode".
- **GitHub Action:** `.github/workflows/sync-ffa.yml` — syncs `main` to `Future-Fiction-Academy/Arcwright` daily at 3 am MT; both repos also configured as push targets on `origin`.

**Files:** `src/components/settings/ProviderCard.jsx`, `src/components/chat/ChatPanel.jsx`, `.github/workflows/sync-ffa.yml`

---

## Known Issues / Watch List

- `projects/ai/` directory still exists on disk (now empty). Safe to delete manually.
- `settings.json.bak` in Arcwrite root — can be deleted once settings confirmed correct.
- App must be reconnected via "Change" button → pick `/Volumes/home/Arcwrite/` → click OK when asked if it's the home folder.
