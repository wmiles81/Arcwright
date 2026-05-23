# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # install deps
npm run dev              # Vite (5173) + Express API (5174) together
npm run dev:api          # API server only
npm run dev:vite-only    # Vite only (API must be running separately)
npm run build            # static build to dist/
npm start                # NODE_ENV=production single-server (default PORT=3000)
npm run preview          # serve the built dist via Vite preview

npm test                 # vitest run (jsdom)
npm run test:watch       # watch mode
npx vitest run src/api/providers.test.js   # run one file
npx vitest run -t "test name"              # filter by test name
```

Override the data directory for development/testing:
```bash
ARCWRIGHT_DATA=/tmp/arcwright-test npm run dev
```

## Architecture

Arcwright is a React+Vite writing tool that sits on top of a local Express/SQLite backend. The client used to run sql.js in WASM; it now talks exclusively to the Node API. Keep that in mind when looking at `src/services/database.js`: most of it is a thin pass-through to `/api/*` that preserves the old export signatures so stores don't have to change.

### Two-process model

- **Dev:** `node server/index.js` (port 5174) runs alongside `vite` (port 5173). `vite.config.js` proxies `/api` and `/or-image-models` to 5174.
- **Prod:** `npm start` runs only `server/index.js` with `NODE_ENV=production`; Express serves the Vite build from `dist/` plus SPA fallback plus the OpenRouter image-model CORS proxy.
- **Data dir:** `~/.arcwright/` by default (`ARCWRIGHT_DATA` overrides). SQLite file is `<dataDir>/arcwright.db`; JSON artifacts (settings, prompts, sequences, projects, chat history, extension packs) live in subfolders documented at the top of `server/routes/files.js`.

### Server layout

- `server/index.js` — Express bootstrap, health endpoint, OpenRouter image-model proxy, prod static serving.
- `server/db.js` — better-sqlite3 wrapper. Schema is mirrored from the old browser database (Series → Books → Characters/Settings/Scenes/Chapters + beats/arc points).
- `server/routes/database.js` / `server/routes/files.js` — REST routes; all CRUD for each entity, plus file operations on the data directory. `setDataDir(DATA_DIR)` is called once from `server/index.js`.

### Client domains (src/)

- `App.jsx` is the composition root. It enforces a build-expiration date (`TRIAL_EXPIRES`), wires up lazy-loaded workflow routes (`/`, `/scaffold`, `/analyze`, `/edit`, `/help`, `/dashboard`), restores editor directory handle from IndexedDB, applies theme + accessibility CSS vars, and kicks off provider model fetches.
- **Workflows** (lazy routes): `components/scaffolding/ScaffoldingWorkflow_v2`, `components/analysis/AnalysisWorkflow`, `components/edit/EditWorkflow_v2`, `components/projects/ProjectDashboard`, `components/layout/HelpPage`. Shell is `components/layout/AppShell_v2`.
- `data/` — pure content: 11 narrative `dimensions`, genres (`genreSystem`), plot structures, beat guidance, modifier effects, default prompts.
- `engine/` — pure functions over beats/weights: tension (`tension.js` — 9 composite weight channels, not 11 dimensions; see `weights.js`), projection, blending, pacing, suggestions, validation.
- `api/` — LLM provider layer. `providers.js` is the static registry (OpenRouter, OpenAI, Anthropic, Perplexity, and local Ollama/LM Studio/Jan/LocalAI). `providerAdapter.js` routes calls to `chatStreaming.js` (OpenAI-compat) or `anthropicStreaming.js`. `prompts.js` has scoring/get-well system prompts.
- `chat/` — contextual AI assistant. `toolDefinitions.js` (OpenAI function-call schema) pairs 1:1 with `actionExecutor.js` (state-mutation handlers). `contextBuilder.js` produces the system prompt from current store state. `editPrompts.js` and `revisionPrompts.js` power inline editing and the multi-chapter revision pipeline.
- `services/` — `api.js` is the fetch wrapper for `/api/*`; `database.js` wraps it with the legacy store-facing API; `arcwriteFS.js` wraps the file-routes; `idbHandleStore.js` persists File System Access API handles; `blobRegistry.js` handles generated image references.
- `scripts/` — user scripts (stored in the sequence/script store) run inside an `AsyncFunction` with a `ctx` built by `scriptApi.js`. `scriptRunner.js` streams logs/progress into `useScriptStore`.
- `store/` — Zustand stores (all hook-style, one per concern). Persisted via `zustand/middleware`'s `persist`; undo uses a custom `useUndoStore` (NOT zundo globally — `pushUndo` is called explicitly).

### State layout (store/)

- `useAppStore` — providers (API keys, model lists), global app settings.
- `useEditorStore` — tabs, active/secondary tab, dual-pane, file tree, File System Access directory handle, theme, accessibility vars.
- `useProjectStore` — the active Book or AI project; owns data-pack loading (`applyDataPacks` in `App.jsx`), chat-history autosave (debounced 2s), and "restoreFromIDB" which also connects to the API server.
- `useBookStore` / `useSeriesStore` — book/series/character/beat/scene/chapter CRUD against `/api`.
- `useChatStore`, `useInlineEditStore`, `useScriptStore`, `useSequenceStore`, `usePromptStore`.
- `useConfirmStore` / `useUndoStore` / `useShortcutStore` — cross-cutting UI primitives. `confirm(...)` returns a promise used throughout instead of `window.confirm`.

### AI data flow

1. UI calls `callCompletionSync` / `callCompletionWithProvider` in `api/providerAdapter.js`.
2. Adapter inspects provider `protocol` (`openai-compat` or `anthropic-native`) and dispatches to the correct streaming implementation.
3. Chat system prompts are assembled in `chat/contextBuilder.js` from live store state so the model sees the current genre, weights, beats, open tabs, etc.
4. When the model calls a tool, `chat/actionExecutor.js` looks up the handler by name and mutates the stores (which triggers UI updates and, where applicable, `pushUndo`).

### Dimensions, weights, and genres — core invariants

- `data/dimensions.js` defines **11 dimension keys**; `DIMENSION_KEYS` is the source of truth.
- `engine/weights.js` defines **9 weight channels** (some are derived gaps like `vulnerabilityTrust`). A genre's weights map to these 9 keys, not to the 11 dimensions. `tension.calculateTension(point, weights)` expects the 9-channel object.
- Data packs (`useProjectStore.loadDataPacks` + `applyDataPacks`) mutate `genreSystem`, `plotStructures`, `allStructures`, and append prompts/sequences at startup. Treat `genreSystem`/`allStructures` as shared mutable registries.

### Build expiration

`src/App.jsx` hard-codes `TRIAL_EXPIRES`. When the date passes, the app renders `<TrialExpired />` and refuses to mount routes. Update this constant when cutting a new build; don't remove it without explicit instruction.

## Conventions specific to this repo

- **Versioned filenames.** `AppShell_v2.jsx`, `ScaffoldingWorkflow_v2.jsx`, `EditWorkflow_v2.jsx`, `SeriesManager_v3.jsx`, etc. are the live versions imported by the app. The unsuffixed / lower-version files are retained for reference; import the highest-suffix file unless `App.jsx` says otherwise.
- **Database compatibility shim.** `src/services/database.js` keeps its old names (`initDatabase`, `persistDb`, `queryAll`, etc.). Most are no-ops or throw in server-backed mode — use the specific CRUD helpers exported from `services/database.js` / `useBookStore` / `useSeriesStore`, not generic query helpers.
- **Tools in sync.** Any new capability exposed to the chat AI must be added to both `src/chat/toolDefinitions.js` (schema) and `src/chat/actionExecutor.js` (handler). Names must match exactly.
- **File System Access API.** The editor uses real directory handles, not the server's filesystem. Handles are persisted via `services/idbHandleStore.js`. Scripts invoked from the Files panel receive those handles through `scriptApi.js`'s `ctx`, not through `/api`.
- **Client-side IDs.** Both `server/db.js` and `services/database.js` export `generateId(prefix)` — same algorithm so IDs minted on either side are interchangeable.
- **Testing surface is narrow.** Current tests: `api/providers.test.js`, `api/providerAdapter.test.js`, `store/useChatStore.test.js`. Vitest config includes `src/**/*.{test,spec}.{js,jsx}` with jsdom + `@testing-library/jest-dom` loaded via `src/test/setup.js`.
- **MCP server.** `mcp/arcwright-mcp-server.js` is a standalone stdio MCP server for external ACP agents. It reads from `ARCWRITE_DATA_DIR` (note: different env var from the main app's `ARCWRIGHT_DATA`) and is not part of the main build.
