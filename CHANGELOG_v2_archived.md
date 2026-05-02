# Changelog

## [3.0.1] — 2026-03-02

### Fixed

- **Projects dialog OK button** — Clicking OK on the Book Projects tab would silently hang if the SQLite database failed to initialize. The dialog now closes immediately regardless of database state.
- **Database initialization resilience** — Wrapped `initDatabase()` in try/catch so `waitForDb()` resolves with `null` instead of hanging forever when WASM loading fails.
- **Chat panel header layout** — Mode and Prompts buttons were being clipped when the sidebar was narrow. Restructured the header to use `flex-wrap` so overflow items wrap to a second line.
- **Book project name in AI dropdown** — The chat header's purple project badge incorrectly showed book project names (e.g., "cr013a-small-town-enemy"). Now shows "Full Context" when a book project is active, reserving the dropdown for AI project names only.
- **Redundant Files button** — Removed the duplicate "Files" button from the chat panel header; the top tab bar already provides file access.
- **Scene stub rendering** — Enhanced the markdown-to-HTML converter to support unordered lists, ordered lists, and blockquotes. Scene stubs now render formatted instead of raw markdown.
- **Create Scene Stubs disabled state** — The button is now grayed out with a tooltip when no book folder is open.
- **Character arcs database race condition** — `loadBookByTitle` now awaits database readiness before querying, preventing null `activeBookId` on startup.

---

## [3.0.0] — 2026-03-02

### Major: Pillar Integration

Complete integration of Scaffold, Analysis, and Editor workflows through a unified SQLite data layer.

### Added

- **SQLite Database** — persistent storage via sql.js with dual backup (IndexedDB + Arcwrite FS)
- **Book & Series Stores** — `useBookStore`, `useSeriesStore` for managing books, characters, scenes, chapters, settings, and series
- **Scene-to-Beat Mapping** — new "Scenes" tab in editor with beat assignment, coverage tracking, and quick-add
- **Expanded Template Variables** — `{{beat_name}}`, `{{scene_title}}`, `{{expected_dimensions}}`, `{{pov_character}}`, `{{beat_guidance}}` available in AI prompts
- **Series Support** — 4 series arc structures (Trilogy, Saga, Continuing, Common World) with visual arc editor and book position markers
- **Character Arc Editor** — per-character, per-dimension arc point editor with sliders and beat reference markers
- **Analysis Feedback Loop** — revision pipeline records snapshots; Score Progression Panel shows before/after dimension comparison with trend indicators
- **Project Dashboard** — unified view at `/dashboard` with stat cards, scene grid, beat mapping status, and quick-nav

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
