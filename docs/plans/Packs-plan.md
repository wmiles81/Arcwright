Arcwright Extensions System — v1 Plan
Status: noodling. Not a commitment to build. Captured for future reference.

Context
Arcwright today has a data-pack system that lets users add genres, plot structures, prompts, and sequences via JSON files dropped into ~/.arcwright/extensions/<id>/ (loaded at startup by src/App.jsx:62-98 applyDataPacks()). It is purely declarative — packs cannot add chat tools, sequence step types, toolbar buttons, exporters, or any code-bearing behavior. Every "would-be plugin surface" is hardcoded JSX or a static export.

In parallel there is a user-script system: arbitrary JS executed via new AsyncFunction('ctx', code) in src/scripts/scriptRunner.js:33 with the ctx API in src/scripts/scriptApi.js. Scripts are unsandboxed, run with full file/AI access, no trust prompt.

Goal: unify these — extend the data-pack system to support code-bearing extensions so authors can add capability the core team never conceived. Provide a wizard so the typical author (a fiction writer, not a JS developer) can scaffold a working extension without writing code in the common case. Keep the existing JSON-pack flow working unchanged.

Scope decision (v1): five surfaces — chat tools, sequence step types, toolbar buttons, prompt presets, chapter exporters. Trust model: one coarse install prompt per pack. Author UX: declarative-first wizard with a code escape hatch.

Branch policy: all work lands on a new long-lived feature branch (feature/extensions) off main. The base product continues development on main; the branch rebases against main at the end of each phase. No phase merges to main until v1 is complete and reviewed. Each phase below is internally shippable on the feature branch — not a hard merge gate.

Architecture
Manifest (extends existing pack.json)
Backward-compatible. A pack adds an optional contributes block; packs without it behave exactly as today.

{
  "id": "wm.export-buddy",
  "name": "Export Buddy",
  "version": "0.1.0",
  "author": "WM",
  "description": "Plain-text exporter and a chat tool that lints beats.",
  "apiVersion": 1,                // NEW — loader rejects unknown versions
  "includes": { ... },            // unchanged (genres, structures, prompts, sequences)
  "contributes": [                // NEW — code-bearing entries
    { "type": "toolbarItem",   "id": "exportTxt", "label": "Export TXT", "icon": "📄",
      "location": "editor", "action": "actions/exportTxt.action.json" },
    { "type": "chatTool",      "name": "lintBeats", "description": "...",
      "parameters": { "type": "object", "properties": {} },
      "action": "actions/lintBeats.action.json" },
    { "type": "sequenceStep",  "stepType": "wm.regexReplace", "label": "Regex Replace",
      "schema": [{ "key": "pattern", "type": "string" }],
      "action": "actions/regexReplace.action.json" },
    { "type": "promptPreset",  "id": "voiceCoach", "title": "Voice coach", "template": "..." },
    { "type": "exporter",      "id": "plainTxt",  "label": "Plain Text (.txt)",
      "extension": ".txt", "action": "actions/plainTxt.action.json" }
  ]
}
Action model (the declarative-first piece)
Each contributes[*].action points to a JSON file at actions/<name>.action.json. The action's kind determines what runs — five built-in declarative kinds plus a script escape hatch:

kind	What it does	Author writes
exportActiveFile	Saves active editor doc to disk in a chosen format	{ "kind": "exportActiveFile", "format": "txt" | "md" | "html", "saveDialog": true }
findReplace	Regex / literal find-replace on active doc	{ "kind": "findReplace", "pattern": "...", "replacement": "...", "regex": true, "scope": "selection" | "doc" }
runPrompt	Runs an existing prompt preset against the active doc	{ "kind": "runPrompt", "promptId": "voiceCoach", "vars": { ... } }
runSequence	Runs an existing sequence	{ "kind": "runSequence", "sequenceId": "draftChapter" }
askAI	One-shot LLM call with a system + user template	{ "kind": "askAI", "system": "...", "user": "{{selectedText}}" }
script	Escape hatch: arbitrary JS body in scripts/<name>.js, executed via the existing AsyncFunction('ctx', code) runner	{ "kind": "script", "script": "scripts/exportTxt.js" }
Most plausible extensions need none of these to involve a single line of JS. The wizard will show only the declarative kinds by default; "Write my own" reveals the script kind.

Runtime: registries seeded with core, extended at load
For each of the five contribution categories, the codebase converts the current static list into a runtime registry whose getAll() merges core entries with extension contributions. No core read-site is removed — core lists are seeded into the registry at boot, so disabling the extensions system entirely yields current behavior.

Surface	Today	After
Chat tools	Static array in src/chat/toolDefinitions.js; ACTION_HANDLERS object in src/chat/actionExecutor.js	getToolDefinitions() returns [...CORE, ...registry]; executeActions dispatches to registry on miss
Sequence steps	If/else chain in actionExecutor.js around line 1093	Final else calls extensionRegistry.getStepHandler(step.type)
Toolbar items	Hardcoded JSX in MarkdownEditor toolbar	New <ExtensionToolbarSlot location="editor" /> reads registry; embed in editor + chat + sequences toolbars
Prompt presets	defaultPrompts.js static + usePromptStore user prompts (already pack-injectable via addPackPrompts)	Reuse existing addPackPrompts path; contributes.promptPreset is sugar over it
Exporters	None — chapter export is hardcoded where it exists	New export-format registry consumed by the export menu
Trust model
One coarse prompt, one time per pack. Triggered the first time applyDataPacks() encounters a pack with any non-empty contributes of a code-bearing type and no recorded grant. Grant stored as pack.trustedVersion = "<version>" on the pack's row of useExtensionsStore (persisted). On version bump, re-prompt.

"" contains code that will run with full access to your open folder, your saved files, and your AI provider key. Only enable if you trust the author. [Cancel] [Enable]

Pure-JSON packs (no code-bearing contributions) skip the prompt entirely.

Code execution reuses src/scripts/scriptRunner.js and createScriptContext from src/scripts/scriptApi.js. No web worker, no permission tokens. The audience and risk profile match user scripts as they exist today; raising the bar comes in v2 if extensions are shared widely.

"Make a Thing" wizard
In-app modal, accessed from a new Settings → Extensions tab.

Pick a tile — six tiles: Toolbar Button · Chat Tool · Prompt Preset · Sequence Step · Exporter · Blank Canvas (advanced, hidden behind a "More…" link).
Name + description + emoji icon — auto-derives slug; checks for collision under ~/.arcwright/extensions/.
Type-specific form — fields appropriate to the tile (e.g., for Chat Tool: parameter schema builder; for Toolbar Button: location + label + tooltip).
What should happen? — single dropdown, the action picker:
"Show a message" — declarative
"Run an existing sequence" — picks from useSequenceStore
"Run an existing prompt" — picks from usePromptStore
"Find and replace text" — declarative form (from / to / scope / regex)
"Export the active file as…" — format picker
"Ask the AI…" — system + user template with {{placeholder}} support
"Write my own" — reveals an inline Monaco editor pre-filled with a working ctx-based starter
Try it — live preview inside the wizard. Toolbar buttons render in a fake toolbar; chat tools get a sample-input panel; errors render inline with plain-English explanations.
Save & Share — three buttons: Save (writes folder), Save and reload (also reactivates), Save and export as .arcext file (zips for sharing).
The wizard is the primary product. It reuses Monaco (already loaded via src/components/edit/MarkdownEditor.jsx) and the existing confirm-dialog primitive.

Distribution
Local file drop: drag a .arcext file (a renamed zip) onto a new sidebar drop zone. Install dialog summarizes contributions in plain English; user clicks Enable. Server unpacks into ~/.arcwright/extensions/<id>/.
Settings → Extensions → Install from URL: fetches a .arcext over HTTPS for power users.
No marketplace in v1. Defer until there's volume.
Files to create / modify
Ordered by build sequence. Each phase is internally shippable on the feature branch.

Phase 1 — Foundations (no behavior change)
Create:

src/extensions/manifest.js — schema + validator; accepts both v1 (no contributes) and v1.5 (with contributes).
src/extensions/registry.js — generic Registry class plus singletons chatToolRegistry, sequenceStepRegistry, toolbarRegistry, exporterRegistry. Backed by Zustand for React subscription where needed.
src/store/useExtensionsStore.js — installed[], enabled{}, trustedVersions{}, contributions mirror.
Phase 2 — Surface conversions (mechanical, low-risk)
Modify:

src/chat/toolDefinitions.js — keep static array as BUILTIN_TOOLS; export getToolDefinitions() that merges built-ins with chatToolRegistry.getAll(). Update consumers (single grep-and-replace pass).
src/chat/actionExecutor.js — executeActions dispatch falls through to registry; sequence-step if/else (~line 1093) ends with a registry-lookup fallback.
Phase 3 — Runtime
Create:

src/extensions/runAction.js — declarative action dispatcher (handles all six kind values).
src/extensions/loader.js — extends discovery, manifest validation, contributes registration; called from applyDataPacks().
src/extensions/packager.js — read/write .arcext zips (use jszip, already a transitive dep via mammoth or add as direct).
Modify:

src/App.jsx — applyDataPacks calls into extensions/loader.js for the new contributes block; trust prompt fires here on first encounter.
src/store/useProjectStore.js — loadDataPacks (line 520) carries the new contributes field through.
src/scripts/scriptApi.js — accept an extension-id arg; expose ctx.ext = { id, storage } where storage is a namespaced localStorage slice.
Phase 4 — Toolbar slot + UI
Create:

src/extensions/ExtensionToolbarSlot.jsx — reads toolbarRegistry.getAll(location) and renders buttons.
src/components/extensions/ExtensionsTab.jsx — replaces or augments the existing Packs tab in src/components/settings/SettingsDialog.jsx. List installed extensions, enable/disable, view permissions, uninstall, install from URL, drop zone for .arcext files.
src/components/extensions/InstallDialog.jsx — trust prompt with plain-English contribution summary.
Modify:

src/components/edit/MarkdownEditor.jsx — embed <ExtensionToolbarSlot location="editor" /> in the right-side toolbar.
src/components/layout/AppShell_v2.jsx — embed sidebar drop zone for .arcext install.
src/components/settings/SettingsDialog.jsx — Packs tab → Extensions tab.
Phase 5 — Wizard
Create:

src/components/extensions/MakeAThingWizard.jsx — six-step modal with action picker.
src/components/extensions/WizardSteps/* — one file per branch (ToolbarButton, ChatTool, PromptPreset, SequenceStep, Exporter, BlankCanvas).
src/extensions/templates/* — starter manifest.json / actions/*.action.json / scripts/*.js per capability.
Phase 6 — Server
Create:

server/routes/extensions.js — split out from server/routes/files.js. Endpoints:
GET /api/extensions (existing list, extended)
GET /api/extensions/:id/content (existing, extended to return contributes)
POST /api/extensions/scaffold (new — wizard output)
POST /api/extensions/install (new — .arcext upload, optional URL)
DELETE /api/extensions/:id (new — uninstall)
Wire into server/index.js like acpRoutes.
Phase 7 — Tests + docs
src/extensions/__tests__/manifest.test.js — back-compat + v1.5 schema.
src/extensions/__tests__/registry.test.js — merge order, deregister-on-disable.
src/extensions/__tests__/runAction.test.js — each declarative kind.
docs/extensions.md — author guide + ctx reference + manifest schema.
HelpPage → Extensions tab updated to reflect new capabilities.
Reused functions / utilities
Script execution: new AsyncFunction('ctx', code) pattern from src/scripts/scriptRunner.js:33.
ctx builder: createScriptContext from src/scripts/scriptApi.js — extended with an ext.id and ext.storage slice; otherwise unchanged.
Confirm dialog: useConfirmStore (already used app-wide) for the trust prompt.
Pack discovery: existing /api/extensions and /api/extensions/:id/content endpoints in server/routes/files.js. Extend rather than rewrite.
Pack injection: addPackPrompts (src/store/usePromptStore.js:94) and addPackSequences (src/store/useSequenceStore.js:98) are reused for the promptPreset capability — no new path needed.
Monaco editor: already loaded via src/components/edit/MarkdownEditor.jsx — embed in the wizard's "Write my own" path.
File System Access: existing handle in useEditorStore.directoryHandle; reuse for declarative exportActiveFile action.
Verification
End-to-end paths to validate before merging the feature branch into main:

Back-compat smoke — install an existing JSON-only data pack into the new build; verify it loads without prompting and behaves identically to the old build (genres / structures / prompts / sequences all merge).
Wizard happy path — run Settings → Extensions → Make a Thing → Toolbar Button; choose "Export the active file as .txt"; save. Verify on disk: ~/.arcwright/extensions/<slug>/manifest.json + actions/export.action.json exist; no scripts/ folder. Reload app. Toolbar button appears in editor toolbar. Click it. Save dialog opens. Choose path. Verify .txt written.
Chat tool path — wizard scaffolds a chat tool that wraps a findReplace action. In chat, prompt the AI to use it. Verify the registry-fallback dispatch in actionExecutor invokes the action, not core handlers.
Trust prompt — install a .arcext containing a script action. First load: prompt appears with the pack name and capability summary. Cancel → contribute is not registered. Re-trigger → prompt again. Enable → registered. Bump pack version on disk → next load re-prompts.
Distribution — wizard "Save and export as .arcext"; drop file on a fresh ~/.arcwright/ install on the same machine. Drop-zone install dialog renders. Enable. Contributions appear.
Disable — disable an extension via Extensions tab; verify its toolbar buttons / tools / steps disappear from the registries; verify its prompts/sequences go grey-tagged.
Tests — npm test covers manifest validator, registry merge, and each declarative runAction kind; existing 30 tests still pass.
Build — npm run build produces no chunk-size regression beyond mammoth's existing footprint; the wizard bundle lazy-loads to keep main bundle untouched.
What's deliberately deferred to v2
Web-worker sandboxing of code-bearing extensions.
Per-capability permission categories (network, read-all-files, etc.) — current model is one coarse grant.
VS-Code-style activationEvents and lazy main import — v1 loads everything at startup; cheap given expected pack count.
An arcwright API import for extensions to use as a module — v1 uses the existing ctx injection.
Central marketplace, signing, update checks.
Panels, settings tabs, providers, file handlers, themes, keybindings as contribution categories.
Hot reload during wizard editing — v1 requires a save + reload cycle.
These are not blocked by v1; the registry pattern supports adding categories later without disturbing core. v2 design starts when v1 has 10+ real extensions in use.