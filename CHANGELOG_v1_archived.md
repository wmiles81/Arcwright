# Changelog

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
