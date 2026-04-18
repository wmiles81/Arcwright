# Plan: Import & Reverse-Engineer Workflow

**Branch:** `Redesign-20260418`

## Context

Arcwright currently has three workflows (Scaffold, Analyze, Edit) optimized for building a story from scratch. Authors who arrive with an existing manuscript have no first-class path: they can paste chapters into `AnalysisWorkflow` and get per-chapter dimension scores, but the app never extracts **genre, subgenre, modifier, tropes, characters, settings, or the best-fitting plot structure** — and it never bundles those findings into a portable project folder.

This slice adds a new entry point `/import` that takes a manuscript through six extraction passes (five LLM, one engine-only), lets the author review and edit the output, then writes a named, versionable project dossier. The exported `variables.json` also carries a persisted `constraintMode: 'soft' | 'hard'` flag; enforcement of that flag in the editor is a later slice.

Out of scope here: the VS Code–style shell redesign, the design-first entry flow, and hard-constraint enforcement in the editor. Scaffold remains the primary starting point for brand-new stories.

## Approach

Add a dedicated `/import` workflow that reuses the existing engine/AI plumbing. It is a six-phase state machine (`input → split → extract → review → export → done`) orchestrated by a new Zustand store so drafts survive reload.

### New files

| File | Purpose |
|---|---|
| `src/components/import/ImportWorkflow.jsx` | Top-level page / phase state machine / step indicator |
| `src/components/import/ManuscriptInput.jsx` | Paste text, upload single file, or upload multiple (one chapter per file); title + author inputs; token-size warning |
| `src/components/import/ChapterSplitPreview.jsx` | Editable chapter table (rename, delete, merge-adjacent) driven by the hoisted splitter |
| `src/components/import/ExtractionProgress.jsx` | Six rows, one per pass, with Run All / Re-run / Stop / Show raw output |
| `src/components/import/ExtractionReview.jsx` | Tabbed editor: Genre, Chapters, Characters, Settings, Structure, Delta, Dossier Preview |
| `src/components/import/ExportDialog.jsx` | Folder name + location radio (`~/.arcwright/projects/books/` vs external via `showDirectoryPicker`) + include checkboxes + soft/hard toggle + existing-folder handling (Abort/Overwrite/Merge) |
| `src/hooks/useManuscriptImport.js` | Orchestrates all 6 passes with per-pass `AbortController`, progress, error, cancel |
| `src/api/extractionPrompts.js` | `buildGenreDetectionPrompt`, `buildCharacterExtractionPrompt`, `buildSettingsExtractionPrompt`, `buildStructureDetectionPrompt` — all return strictly-typed JSON. Tropes piggyback on genre pass to save tokens. |
| `src/engine/chapterSplitter.js` | Pure helper hoisted out of `TextInputPanel.jsx`: `splitManuscriptIntoChapters(text, { mode })` |
| `src/engine/deltaReport.js` | `buildDeltaReport({ scoredChapters, structureKey, weights, subgenreRequirements })` composing `enrichDataWithTension` + `classifyPacingPattern` + `computeGapAnalysis` + `validateAgainstGenre` |
| `src/engine/dossierExport.js` | Pure string builders (`buildGenreDossierMarkdown`, `buildCharactersMarkdown`, `buildSettingsMarkdown`, `buildArcAnalysisMarkdown`, `buildScaffoldJson`, `buildVariablesJson`, `buildManuscriptMarkdown`) + two writers: `writeDossierToHandle(folderHandle, bundle)` and `writeDossierViaApi(projectName, bundle)` |
| `src/store/useImportStore.js` | Zustand + persist (`'arcwright-import-store'`) holding `phase`, `rawManuscript`, `chapters`, `extraction.{genre,scoring,characters,settings,structure,derived}`, `deltaStale`, `exportConfig`, `reviewTab` |

### Edits to existing files

| File | Change |
|---|---|
| `src/App.jsx` (~3 lines) | Lazy-import `ImportWorkflow`; add `<Route path="import" element={<ImportWorkflow />} />` inside the existing `AppShell` route |
| `src/components/layout/WorkflowSelector.jsx` (~20 lines) | Add fourth card linking to `/import`; change grid to `md:grid-cols-2 lg:grid-cols-4` |
| `src/components/analysis/TextInputPanel.jsx` (~80 lines) | Replace inline splitter with call to `src/engine/chapterSplitter.js`; no behavior change |
| `src/hooks/useClaudeAnalysis.js` (~30 lines) | Extract `scoreChaptersWithContext({ chapters, genre, subgenre, structure, apiKey, onProgress, signal })` as a module-level function so both `useClaudeAnalysis` and `useManuscriptImport` share the batching loop |
| `src/store/useAppStore.js` (~5 lines) | Add persisted `constraintMode: 'soft'` + `setConstraintMode(mode)`; add to `partialize` allowlist |
| `src/chat/toolDefinitions.js` + `src/chat/actionExecutor.js` (~60 lines each) | Add matched pairs: `rerunImportPass({pass})`, `approveImportPass({pass})`, `discardImportPass({pass})`, `setConstraintMode({mode})` |
| `server/routes/files.js` (~25 lines) | Add `PUT /projects/books/:name/file/*filePath` with strict path normalization (`path.resolve` + prefix check), 10 MB body cap, extension allowlist (`.md`, `.json`, `.txt`) |
| `src/services/arcwriteFS.js` (~10 lines) | `writeBookProjectFile(bookName, relPath, content)` wrapping the new endpoint |

### Reused existing functions / utilities

- `src/engine/validation.js` → `computeGapAnalysis`, `validateAgainstGenre`
- `src/engine/tension.js` → `enrichDataWithTension`
- `src/engine/pacing.js` → `classifyPacingPattern`
- `src/engine/projection.js` → `interpolateAtTime` (for ideal-curve derivation)
- `src/data/genreSystem.js` → subgenre/modifier enums used as constraints in LLM prompts (no change to this file — tropes stay free-form)
- `src/data/plotStructures.js` → `allStructures` keys as the candidate set for Pass 5
- `src/api/providerAdapter.js` → `callCompletionSync` for each pass
- `src/api/prompts.js` → `buildScoringSystemPrompt` reused for Pass 2
- `src/api/claude.js` → `parseJsonResponse` for all pass outputs
- `src/components/analysis/ScoringReviewPanel.jsx` → reused inside the Chapters tab of `ExtractionReview`
- `src/components/analysis/ComparisonOverlay.jsx` → reused read-only inside the Delta tab
- `src/store/useProjectStore.js` → `createNewBookProject`, `activateBookProject`
- `src/store/useBookStore.js` → `addCharacter`, `addSetting`, `addChapter`, `addArcPoint`
- Filename sanitizer + zero-pad logic from `AnalysisWorkflow.jsx` (lines ~126–181) → hoisted into a shared util and reused

### Pass pipeline (inside `useManuscriptImport`)

1. **Genre + subgenre + modifier + tropes** (LLM). Input: excerpt sample (first 2k words + last 2k + three midsection 1k blocks). Output: `{ genre, subgenre, modifier, tropes[], confidence, reasoning }`, constrained to existing enums.
2. **Chapter dimension scoring** (LLM, batched 5). Reuses `buildScoringSystemPrompt`; writes to `useAppStore.chapters[].aiScores`. Depends on Pass 1.
3. **Characters** (LLM). Output: `[{ name, aliases, role, firstAppearance, chapters, arcSummary, dimensionArc? }]`.
4. **Settings / locations** (LLM). Output: `[{ name, description, firstAppearance, chapters }]`.
5. **Plot structure** (LLM). Candidate set = `Object.keys(allStructures)` pre-filtered to structures within ±3 beats of the chapter count. Output: `{ structureKey, confidence, reasoning, beatAssignments }`.
6. **Derived variables** (no LLM). `buildDeltaReport(...)` → tension curve, pacing classification, gap analysis, subgenre-requirement checks.

Each pass has its own `AbortController`; cancel sets status to `idle` (not `error`) so it's re-runnable. Pass 2 preserves per-chapter success on partial cancel. Passes with `confidence < 0.6` are flagged yellow in Review.

### Data-shape decisions

- **Tropes**: free-form `string[]`, stored on `useImportStore.extraction.genre.tropes` and serialized into both `dossier/genre.md` (bulleted) and `variables.json.tropes`. No new registry in `genreSystem.js`.
- **Per-character arcs**: generated client-side; on export to `arcwright` location, persisted via `useBookStore.addCharacter` + `addArcPoint`. On external export, arcs are markdown-only.
- **Constraint mode**: dual-stored. `useAppStore.constraintMode` (persisted to localStorage) for UI; `dossier/variables.json.constraintMode` (project-scoped) as canonical. On `activateBookProject`, mirror JSON → store.

### Export folder layout

```
{userFolderName}/
  README.md                     overview + links
  manuscript.md                 full concatenated text with ## Chapter N dividers
  chapters/NN-{slug}.md         one per chapter (NN zero-padded)
  dossier/
    genre.md                    genre, subgenre, modifier, tropes, confidence, reasoning
    characters.md               roster table + per-character section
    settings.md                 locations table + descriptions
    arc-analysis.md             detected structure, gap summary, priority actions, pacing, tension sparkline, validation
    scaffold.json               reverse-engineered beats, loadable via setScaffoldBeats
    variables.json              derived values + constraintMode (v=1 schema)
```

### Error / edge cases covered

- Manuscript >150k words → representative excerpts for Passes 1/3/4/5; scoring still runs full.
- `rawManuscript` >500 KB → persist pointer only, keep text in memory, warn on refresh.
- LLM returns an unknown genre/structure key → clamp to closest enum, flag confidence 0.3, let user correct in Review.
- Target folder exists → Abort (default) / Overwrite / Merge radio in ExportDialog.
- Missing API key → "Run All" disabled with tooltip linking to Settings.
- Corrupted `useImportStore` on load → try/catch, reset, toast.

### Chat integration

Add tool/handler pairs so the chat assistant can drive the flow (names identical in both files, per the repo convention called out in `CLAUDE.md`):

- `rerunImportPass({ pass })`, `approveImportPass({ pass })`, `discardImportPass({ pass })`, `setConstraintMode({ mode })`

### Suggested merge sequence

1. Foundation, no UI: hoist `chapterSplitter`, add `extractionPrompts.js`, `deltaReport.js`, `dossierExport.js`, `useImportStore.js`, plus vitest coverage.
2. Server endpoint + `writeBookProjectFile` (only if `arcwright` export location is supported — recommended).
3. `useClaudeAnalysis` refactor (pure `scoreChaptersWithContext`) + `useManuscriptImport`.
4. UI components in the order Input → Split → Progress → Review → Export → Workflow shell.
5. Route + WorkflowSelector card.
6. Chat tools.
7. Polish: cancel UX, confirmation dialogs, overwrite/merge prompt, token-budget warning.

Steps 1–2 are test-only and mergeable before any visible UI.

## Verification

**Unit (new tests under `src/` matching the existing vitest glob `src/**/*.{test,spec}.{js,jsx}`):**
- `src/engine/chapterSplitter.test.js` — splitter handles `## Chapter N`, `Chapter One`, triple-newline, single-chapter fallback.
- `src/engine/dossierExport.test.js` — given fixture chapters + detections, assert `buildGenreDossierMarkdown`, `buildArcAnalysisMarkdown`, `buildVariablesJson` shapes; assert `variables.json.constraintMode` round-trips.
- `src/engine/deltaReport.test.js` — hand-built chapter set with known out-of-range dimension surfaces as a priority action; `overallScore` within expected bounds.

Run: `npx vitest run src/engine/chapterSplitter.test.js src/engine/dossierExport.test.js src/engine/deltaReport.test.js`.

**End-to-end manual:**
1. `npm run dev`, open `http://localhost:5173`, configure an API key in Settings.
2. Click the new Import card. Paste a public-domain sample (suggest first 3 chapters of *Pride & Prejudice*, ~15k words).
3. At `split`, confirm chapters auto-detected. At `extract`, click Run All. Expect Pass 1 → genre `romance`; Pass 3 → Elizabeth and Darcy as protagonists; Pass 5 → `romancingTheBeat` or similar.
4. Edit one field on each Review tab, confirm `deltaStale` blocks Next until Pass 6 re-runs.
5. In Export: name the folder `pp-test`, choose `~/.arcwright/projects/books/`, set constraintMode `hard`, click Export.
6. Inspect `~/.arcwright/projects/books/pp-test/` for the full layout in section "Export folder layout".
7. Confirm `dossier/variables.json.constraintMode === "hard"`.
8. Via `curl http://localhost:5174/api/books/by-title/pp-test`, confirm the book row; via `/api/characters/by-book/:id`, confirm rows inserted.
9. Click "Open in Editor" on the done screen → `/edit` loads with `useProjectStore.activeBookProject === "pp-test"` and the exported tree visible.
10. Cancel mid-Pass-2 on a re-run; confirm partial per-chapter scores persist and status reverts to `idle`.

## Critical files to modify

- `/home/user/Arcwright/src/App.jsx`
- `/home/user/Arcwright/src/components/layout/WorkflowSelector.jsx`
- `/home/user/Arcwright/src/components/analysis/TextInputPanel.jsx`
- `/home/user/Arcwright/src/hooks/useClaudeAnalysis.js`
- `/home/user/Arcwright/src/store/useAppStore.js`
- `/home/user/Arcwright/src/chat/toolDefinitions.js`
- `/home/user/Arcwright/src/chat/actionExecutor.js`
- `/home/user/Arcwright/server/routes/files.js`
- `/home/user/Arcwright/src/services/arcwriteFS.js`

## Explicit non-goals

- VS Code–style shell redesign (separate future slice).
- Design-first entry flow (separate future slice).
- Hard-constraint *enforcement* in the editor (this slice only persists the flag).
- `.docx` ingestion (stub says "coming soon").
- Per-scene extraction; re-import diff/merge UX; streaming pass output.
