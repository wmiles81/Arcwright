# Changelog

## [3.1.1] — 2026-05-02

### Added

- **`.docx` import via mammoth** — clicking a Word document in the file tree converts it to markdown on first open and writes the working copy to a sibling `<filename>.docx.md`. The original `.docx` is never modified; subsequent clicks open the existing `.docx.md` directly. mammoth is lazy-loaded only when a `.docx` is opened, so the main bundle is unaffected.

### Fixed

- **Editor displayed prose in monospace** — the WYSIWYG `contentEditable` panes hardcoded `font-mono`, so chapters rendered like a typewriter document. Replaced with proportional `text-base` so prose now reads correctly. Code files still use the dedicated `<CodePane>` for syntax highlighting.
- **`scenes.forEach is not a function` on `/edit`** — the server-backed migration left every database call in `useBookStore` unawaited, so `scenes` (and `characters`, `chapters`, `settings`) were being stored as Promises rather than arrays. Made `loadBook` and all mutator methods async, with `Promise.all` for the four entity loads.
- **`ProjectDashboard` and `CharacterArcEditor` consumed Promises synchronously** — both components called now-async store methods (`getStats`, `getSceneSnapshots`, `getCharacterArcPoints`) inside `useMemo` and dropped them into render output. Replaced with `useEffect` + `useState` patterns; `ProjectDashboard` now batches snapshot loads with `Promise.all` keyed by scene id.
- **"Open Folder" threw `WellKnownDirectory` enum error** — `FilePanel` passed `arcwriteHandle` directly to `showDirectoryPicker({ startIn })`. After the server migration, `arcwriteHandle` is the string `'server'` rather than a real `FileSystemDirectoryHandle`. Now only forwards the handle when its `kind === 'directory'`, otherwise falls back to `'documents'`.

### Notes

- Latent issue not yet fixed: `/api/projects/books/<title>/tree` and `/api/books/by-title/<title>` return 404 during book auto-restore. The endpoints were renamed during the server migration but the auto-restore path wasn't updated. App degrades gracefully to "no active book"; harmless until the project-restore flow is rewired.

---

## [3.1.0] — 2026-05-01

### Added

- **Server-backed architecture (full migration)** — sql.js / WASM removed from the client. The browser now talks to a local Express server (`server/index.js`) that wraps `better-sqlite3`. `src/services/database.js` is a thin pass-through to `/api/*` that preserves the legacy store-facing signatures.
- **Two-process dev / single-process prod** — `npm run dev` boots Vite (5173) plus the Express API (5174) with `/api` and `/or-image-models` proxied. `npm start` runs only the Express server with `NODE_ENV=production`, serving the built frontend from `dist/` plus an SPA fallback.
- **Default data directory** — all settings, prompts, sequences, projects, chat history, and extension packs now live under `~/.arcwright/` by default. Override with `ARCWRIGHT_DATA=...` for development/testing. Replaces the user-picked "Arcwrite" folder for everything except the editor's open directory (which still uses File System Access).
- **Series CRUD + Series Wizard v2 + Series Manager v3** — server-backed series file API, new wizard flow, and revised manager UI for multi-book arcs.
- **ACP integration (Path 2)** — MCP server exposure for external ACP agents, environment-variable format fix, and an MCP presets UI in Settings. The standalone stdio MCP server lives at `mcp/arcwright-mcp-server.js` (note: reads from `ARCWRITE_DATA_DIR`, separate from the main app's `ARCWRIGHT_DATA`).
- **Plain (no-instructions) chat mode** — added to the chat mode dropdown so the model receives no system prompt; the Hook & Premise button now switches into this mode.
- **HFE audit features:**
  - **F-009 Undo / Redo** — explicit `pushUndo` integration across mutating actions; cross-cutting `useUndoStore` plus `<UndoNotification />`.
  - **F-010 Confirm dialog** — promise-based `confirm(...)` via `useConfirmStore`, replacing `window.confirm` site-wide.
  - **F-012 Remappable shortcuts** — `useShortcutStore` for user-customizable keyboard shortcuts.
- **Trial-expiration gate removed** — `App.jsx` no longer blocks the app behind a build-expiration date. Original preserved as `src/App_v1.jsx` for reference.

### Changed

- **Provider registry expanded** — `src/api/providers.js` now registers Ollama, LM Studio, Jan.ai, and LocalAI alongside OpenRouter, OpenAI, Anthropic, and Perplexity. Local providers run via OpenAI-compat REST on localhost (CORS must be enabled — see `src/api/providers.js` header comment).
- **CHANGELOG consolidation** — this file (`CHANGELOG_v3.md`) is the canonical changelog going forward. Earlier `CHANGELOG.md` and `CHANGELOG_v2.md` are retained for historical reference.

### Fixed

- **Hook & Premise button** — now correctly switches to no-system-prompt mode.

---

## [3.0.1] — 2026-03-02

### Fixed

- **Projects dialog OK button** — Clicking OK on the Book Projects tab would silently hang if the SQLite database failed to initialize. The dialog now closes immediately regardless of database state.
- **Database initialization resilience** — Wrapped `initDatabase()` in try/catch so `waitForDb()` resolves with `null` instead of hanging forever when WASM loading fails. *(Superseded in 3.1.0 — sql.js / WASM removed.)*
- **Chat panel header layout** — Mode and Prompts buttons were being clipped when the sidebar was narrow. Restructured the header to use `flex-wrap` so overflow items wrap to a second line.
- **Book project name in AI dropdown** — The chat header's purple project badge incorrectly showed book project names. Now shows "Full Context" when a book project is active, reserving the dropdown for AI project names only.
- **Redundant Files button** — Removed the duplicate "Files" button from the chat panel header; the top tab bar already provides file access.
- **Scene stub rendering** — Enhanced the markdown-to-HTML converter to support unordered lists, ordered lists, and blockquotes. Scene stubs now render formatted instead of raw markdown.
- **Create Scene Stubs disabled state** — The button is now grayed out with a tooltip when no book folder is open.
- **Character arcs database race condition** — `loadBookByTitle` now awaits database readiness before querying, preventing null `activeBookId` on startup.

---

## [3.0.0] — 2026-03-02

### Major: Pillar Integration

Complete integration of Scaffold, Analysis, and Editor workflows through a unified SQLite data layer.

### Added

- **SQLite Database** — persistent storage via sql.js with dual backup (IndexedDB + Arcwrite FS). *(Superseded in 3.1.0 — replaced by server-backed `better-sqlite3` over `/api/*`.)*
- **Book & Series Stores** — `useBookStore`, `useSeriesStore` for managing books, characters, scenes, chapters, settings, and series.
- **Scene-to-Beat Mapping** — new "Scenes" tab in editor with beat assignment, coverage tracking, and quick-add.
- **Expanded Template Variables** — `{{beat_name}}`, `{{scene_title}}`, `{{expected_dimensions}}`, `{{pov_character}}`, `{{beat_guidance}}` available in AI prompts.
- **Series Support** — 4 series arc structures (Trilogy, Saga, Continuing, Common World) with visual arc editor and book position markers.
- **Character Arc Editor** — per-character, per-dimension arc point editor with sliders and beat reference markers.
- **Analysis Feedback Loop** — revision pipeline records snapshots; Score Progression Panel shows before/after dimension comparison with trend indicators.
- **Project Dashboard** — unified view at `/dashboard` with stat cards, scene grid, beat mapping status, and quick-nav.

### Changed

- `ScaffoldingWorkflow` → v2 with series view mode toggle (Book Arc / Series Arc / Overlay)
- `EditWorkflow` → v2 with 5-tab left panel (Chat, Files, Scenes, Variables, Sequences)
- `InlineEditPopup` scaffoldVars expanded from 5 to 12 variables
- `useRevisionPipeline` now records revision snapshots to scene score history

### New Files

- `src/components/edit/SceneMappingPanel.jsx`
- `src/components/edit/EditWorkflow_v2.jsx`
- `src/components/scaffolding/SeriesArcEditor.jsx`
- `src/components/scaffolding/CharacterArcEditor.jsx`
- `src/components/scaffolding/ScaffoldingWorkflow_v2.jsx`
- `src/components/scaffolding/WritingGuideExporter_v2.jsx`
- `src/components/analysis/ScoreProgressionPanel.jsx`
- `src/components/projects/ProjectDashboard.jsx`
- `src/store/useBookStore.js`
- `src/store/useSeriesStore.js`
- `src/services/database.js`

---

## [2.5.0] — Previous

Prior release with Scaffold, Analysis, and Editor workflows operating independently.
