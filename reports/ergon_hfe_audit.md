# ERGON — Arcwright HFE Audit Report (Initial Sweep)

**Auditor:** ERGON (code-level inspection)
**Scope:** Full application — all workflows, layout, and shared components
**Method:** Static analysis of JSX, CSS, and store code; no visual rendering
**Confidence caveat:** Findings marked *(Visual confirmation needed)* require browser inspection to verify contrast ratios and layout spacing.

---

## Session Findings Log

---

### F-001 — No Skip-Navigation Link

> **AXIS 4 — ACCESSIBILITY** | Severity: `HIGH` | Component: `AppShell`
> **Finding:** `AppShell.jsx` has `<nav aria-label="Main navigation">` and `aria-label="Main content"` on the content div, but provides no skip-to-main-content link. Keyboard users must Tab through the full nav bar (logo, Scaffold, Analyze, Edit, Projects, Settings, Help, project badge, chat toggle) on every workflow switch.
> **Standard:** WCAG SC 2.4.1 (Bypass Blocks), Section 508 §1194.22(o)
> **Impact:** All keyboard-only users and screen reader users (~2–4% of population). Exacerbated by frequent workflow switching during authoring sessions.
> **Fix:** Add a visually-hidden, focus-visible skip link as the first child of `<body>` or `AppShell`:
> ```jsx
> <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-purple-600 focus:text-white focus:px-4 focus:py-2 focus:rounded">
>   Skip to main content
> </a>
> ```
> And add `id="main-content"` to the content div.

---

### F-002 — `useFocusTrap` Missing from 3 of 5 Modals

> **AXIS 4 — ACCESSIBILITY** | Severity: `HIGH` | Component: `InlineEditPopup`, `RevisionModal`, `ProjectsDialog`
> **Finding:** `useFocusTrap` is imported and applied in `SettingsDialog` and `ScriptEditorDialog`, but **not** in `InlineEditPopup`, `RevisionModal`, or `ProjectsDialog`. These three components render as modal overlays but allow Tab to escape into the background document.
> **Standard:** WCAG SC 2.1.2 (No Keyboard Trap — inverse: modal must trap), SC 2.4.3 (Focus Order)
> **Impact:** Screen reader and keyboard users can interact with obscured background content, causing disorientation and potential data loss.
> **Fix:** Import `useFocusTrap` and apply in each:
> ```jsx
> import useFocusTrap from '../../hooks/useFocusTrap';
> // inside component:
> const focusTrapRef = useFocusTrap(isOpen);
> // apply ref to the modal container div
> ```

---

### F-003 — DiffView: Additions Use Color-Only Encoding

> **AXIS 1 — VISUAL PERCEPTION** | Severity: `HIGH` | Component: `DiffView`
> **Finding:** Removals use `line-through` + red background (two channels — PASS). But **additions** use only `background: rgba(34,197,94,0.3)` (green tint) — a single color-only indicator. Users with deuteranopia (~6% of males) cannot distinguish additions from unchanged text.
> **Standard:** WCAG SC 1.4.1 (Use of Color), Section 508 §1194.21(i)
> **Impact:** ~8% of males, ~0.5% of females with color vision deficiency. The core revision workflow relies on distinguishing additions.
> **Fix:** Add a secondary indicator to additions — use `font-weight: 600` or `text-decoration: underline` or a `＋` gutter marker:
> ```jsx
> <span style={{ background: 'rgba(34,197,94,0.3)', fontWeight: 600, borderRadius: 2, padding: '0 1px' }}>
> ```

---

### F-004 — NarrativeChart Has No Text Alternative

> **AXIS 4 — ACCESSIBILITY** | Severity: `HIGH` | Component: `NarrativeChart`
> **Finding:** `NarrativeChart.jsx` renders a Recharts SVG chart with zero ARIA attributes, no `alt` text, no `role`, and no data table fallback. The chart is the primary visualization for the Scaffold workflow — screen reader users receive no information.
> **Standard:** WCAG SC 1.1.1 (Non-text Content), Section 508 §1194.22(a)
> **Impact:** All screen reader users. The chart is a core output of the Scaffolding workflow.
> **Fix:** Add `role="img"` and `aria-label` to the chart container with a generated text summary: "Narrative chart showing [N] beats across [dimensions]. Tension peaks at [X]% with value [Y]." Additionally, provide a collapsible data table alternative.

---

### F-005 — DimensionSlider Missing `aria-label`

> **AXIS 4 — ACCESSIBILITY** | Severity: `MEDIUM` | Component: `DimensionSlider`
> **Finding:** The `<input type="range">` elements in `DimensionSlider.jsx` have `min`, `max`, `step` but no `aria-label`, `aria-labelledby`, or programmatically associated `<label>`. Screen readers announce "slider, 0 to 10" without identifying which dimension (Intimacy, Trust, Danger, etc.).
> **Standard:** WCAG SC 1.3.1 (Info and Relationships), SC 4.1.2 (Name, Role, Value)
> **Impact:** All screen reader users in the Scaffold workflow.
> **Fix:** Pass `dimensionName` to the component and add `aria-label={dimensionName}` to both `<input>` elements.

---

### F-006 — MarkdownEditor `contentEditable` Lacks ARIA Role

> **AXIS 4 — ACCESSIBILITY** | Severity: `MEDIUM` | Component: `MarkdownEditor`
> **Finding:** The editor surface is a plain `<div contentEditable>` with no `role="textbox"`, `aria-multiline="true"`, or `aria-label`. Assistive technology cannot identify it as an editable text region.
> **Standard:** WCAG SC 4.1.2 (Name, Role, Value)
> **Impact:** All screen reader users in the Edit workflow — the primary authoring surface.
> **Fix:** Add to the contentEditable div:
> ```jsx
> role="textbox"
> aria-multiline="true"
> aria-label="Document editor"
> ```

---

### F-007 — No `prefers-reduced-motion` Respect

> **AXIS 1 — VISUAL PERCEPTION** | Severity: `MEDIUM` | Component: Global (CSS/JSX)
> **Finding:** Zero references to `prefers-reduced-motion` media query anywhere in JSX or CSS. All transitions, animations (chat loading dots, streaming cursor, sidebar slide, mermaid diagram rendering) run unconditionally.
> **Standard:** WCAG SC 2.3.3 (Animation from Interactions — AAA), ISO 9241-171
> **Impact:** Users with vestibular disorders (~35% of adults over 40 experience vestibular symptoms). The `reducedMotion` flag exists in `useEditorStore` but is never wired to CSS.
> **Fix:** In `App.jsx`, apply the existing `reducedMotion` store value as a class or CSS variable:
> ```jsx
> if (reducedMotion) root.classList.add('reduce-motion');
> ```
> Then in CSS: `@media (prefers-reduced-motion: reduce), .reduce-motion * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }`

---

### F-008 — No Distraction-Free Writing Mode

> **AXIS 5 — WRITING-WORKFLOW HFE** | Severity: `MEDIUM` | Component: `EditWorkflow_v2`
> **Finding:** No distraction-free / zen / focus mode exists. Zero references in codebase. During authoring, the nav bar, file panel, tab bar, formatting toolbar, status bar, and chat toggle are always visible. Chrome cannot be fully hidden.
> **Standard:** ISO 9241-110 (Suitability for the task), flow-state sovereignty principle
> **Impact:** All authors during deep writing sessions. Every visible UI chrome element competes for peripheral attention.
> **Fix:** Add a toggle (keyboard shortcut `⌘\` or `F11`) that hides nav, sidebar, toolbar, tab bar, and status bar — leaving only the editor surface. Escape exits. Store preference in `useEditorStore`.

---

### F-009 — No Undo System in Stores

> **AXIS 6 — ERROR ECOLOGY** | Severity: `HIGH` | Component: `useEditorStore`, `useScaffoldStore`, `useBookStore`
> **Finding:** No undo/redo stack exists in any Zustand store. The stores contain no `undoStack`, `undoHistory`, `redo`, or undo-related state. Beat deletion, character arc edits, scene reordering, and AI content insertion are all irreversible without manual backup.
> **Standard:** ISO 9241-110 (Error tolerance), Norman's Gulf of Execution
> **Impact:** All users. Beat deletion, the most common destructive action in Scaffold, triggers `window.confirm` but has no undo. Writers who accept AI revisions cannot revert except by closing without saving.
> **Fix:** Implement a Zustand undo middleware (e.g., `zundo`) on `useScaffoldStore` and `useEditorStore`. Minimum viable: snapshot state before destructive actions, expose `undo()` and `redo()` with `⌘Z` / `⌘⇧Z`.

---

### F-010 — `window.confirm` Hard-Interrupts During Authoring

> **AXIS 2 — COGNITIVE ERGONOMICS** | Severity: `MEDIUM` | Component: Multiple (16+ call sites)
> **Finding:** 16+ uses of `window.confirm()` across the codebase. Each surfaces the browser's native modal dialog — a hard-interrupt that steals focus from the editor, breaks flow state, and is not styled or positioned consistently with the application. Found in: `ChatPanel`, `FilePanel`, `ScaffoldingWorkflow_v2`, `TemplateLoader`, `SequencesPanel`, `SeriesManager`, `BookProjectList`, `AiProjectList`, `ScriptEditorDialog`, `TextInputPanel`, `VoiceTab`.
> **Standard:** ISO 9241-143 (Dialogue principles — modality), flow-state sovereignty
> **Impact:** All users. The native confirm dialog is a flow-state destroyer — it cannot be dismissed with app-consistent shortcuts and has no undo alternative.
> **Fix:** Replace `window.confirm` with an in-app confirmation component (inline or popover) that is dismissible with Escape, styled consistently, and — for destructive actions — offers undo instead of prevention.

---

### F-011 — `FileContextMenu` Not Keyboard-Triggerable

> **AXIS 3 — MOTOR / INPUT** | Severity: `MEDIUM` | Component: `FileContextMenu`
> **Finding:** `FileContextMenu.jsx` has no `onKeyDown` handler for `Shift+F10` or any keyboard equivalent. The context menu is mouse-right-click-only.
> **Standard:** WCAG SC 2.1.1 (Keyboard), Section 508 §1194.21(a)
> **Impact:** Keyboard-only users cannot access Rename, Delete, or script operations on files.
> **Fix:** Add `onKeyDown` to `FilePanel` tree items:
> ```jsx
> onKeyDown={(e) => { if (e.key === 'F10' && e.shiftKey) { e.preventDefault(); openContextMenu(node, e); } }}
> ```

---

### F-012 — Keyboard Shortcuts Not Remappable

> **AXIS 3 — MOTOR / INPUT** | Severity: `LOW` | Component: `SettingsDialog`
> **Finding:** No keyboard shortcut remapping exists in Settings or anywhere in the codebase. All shortcuts (`⌘S`, `⌘K`, `⌘B`, `⌘I`, `⌘U`, `⌘H/F`) are hardcoded. Left-hand-dominant users who mouse with their left hand have reduced access to `⌘` shortcuts.
> **Standard:** ISO 9241-171 (Accessibility guidance — input customization), WCAG SC 2.1.4 (Character Key Shortcuts — AAA)
> **Impact:** ~10% of population (left-handed users). Low severity because macOS system-level remapping exists as a workaround.
> **Fix:** Enhancement — add a Shortcuts tab to `SettingsDialog` with editable keybinding map stored in `useEditorStore`.

---

### F-013 — Solarized Dark Low Body Text Contrast

> **AXIS 1 — VISUAL PERCEPTION** | Severity: `MEDIUM` | Component: `editorThemes.js` *(Visual confirmation needed)*
> **Finding:** Solarized Dark uses `text: '#839496'` on `bg: '#002B36'`. Calculated contrast ratio: ~5.2:1 — passes AA (4.5:1) but is at the low end. The original Solarized spec was designed for code, not long-form prose reading. For manuscript display at 2+ hour sessions, this is suboptimal.
> **Standard:** WCAG SC 1.4.6 (Enhanced Contrast — AAA: 7:1), ISO 9241-303 (Display requirements for long-duration tasks)
> **Impact:** Users in marathon writing sessions with Solarized Dark. Eye fatigue accumulates faster at lower contrast ratios.
> **Fix:** Offer a "Solarized Dark (Bright)" variant using `text: '#93A1A1'` (~6.5:1) or `text: '#EEE8D5'` (~13:1). The existing high-contrast dark theme (#FFFFFF on #000000) covers the extreme end; a mid-range is missing.

---

## Passes (Notable)

> **AXIS 5** | Severity: `PASS` | Component: `SettingsDialog` / `useEditorStore`
> **Finding:** OpenDyslexic font toggle implemented as a first-class option in Settings → Appearance. `dyslexiaFont` flag in `useEditorStore` applies `font-family: "OpenDyslexic"` globally via `App.jsx`. Excellent.

> **AXIS 4** | Severity: `PASS` | Component: `ChatPanel`
> **Finding:** Chat message area has `aria-live="polite"` and `role="log"` with `aria-label="Chat messages"`. Streaming AI responses will be announced by screen readers. Well-implemented.

> **AXIS 1** | Severity: `PASS` | Component: `editorThemes.js`
> **Finding:** 17 editor themes including a high-contrast light/dark pair. Dark themes use appropriate #1A–#2E range backgrounds (not #000000). Paper and Sepia themes serve author-comfort use cases. Exceeds minimum requirement of 3 comfort themes.

> **AXIS 4** | Severity: `PASS` | Component: `ProviderCard`
> **Finding:** API key inputs use `<label>` elements wrapping the input. Programmatic association present. Model dropdowns also labeled.

> **AXIS 1** | Severity: `PASS` | Component: `DiffView` (removals)
> **Finding:** Removed text uses both red background AND `line-through` text decoration — dual-channel encoding. Removals survive color-only test.

---

## Priority Action Matrix

| Rank | ID | Component | Finding Summary | Severity | Effort | Score |
|------|----|-----------|----------------|----------|--------|-------|
| 1 | F-003 | `DiffView` | Additions are green-only — no secondary indicator | HIGH | Low | ★★★★★ |
| 2 | F-001 | `AppShell` | No skip-to-main-content link | HIGH | Low | ★★★★★ |
| 3 | F-005 | `DimensionSlider` | Missing `aria-label` on range inputs | MEDIUM | Low | ★★★★ |
| 4 | F-006 | `MarkdownEditor` | `contentEditable` has no ARIA role | MEDIUM | Low | ★★★★ |
| 5 | F-007 | Global | `prefers-reduced-motion` not wired (store flag exists, unused) | MEDIUM | Low | ★★★★ |
| 6 | F-002 | 3 Modals | Focus trap missing from InlineEditPopup, RevisionModal, ProjectsDialog | HIGH | Medium | ★★★★ |
| 7 | F-011 | `FileContextMenu` | Context menu not keyboard-triggerable | MEDIUM | Low | ★★★★ |
| 8 | F-004 | `NarrativeChart` | Zero ARIA — chart invisible to screen readers | HIGH | Medium | ★★★ |
| 9 | F-010 | Multiple | `window.confirm` hard-interrupts (16+ sites) | MEDIUM | High | ★★ |
| 10 | F-009 | Stores | No undo/redo system — all destructive actions irreversible | HIGH | High | ★★ |
| 11 | F-008 | `EditWorkflow_v2` | No distraction-free writing mode | MEDIUM | Medium | ★★ |
| 12 | F-013 | `editorThemes.js` | Solarized Dark contrast borderline for marathon prose | MEDIUM | Low | ★★ |
| 13 | F-012 | `SettingsDialog` | Keyboard shortcuts not remappable | LOW | High | ★ |

---

## Summary

**13 findings** across 6 axes. **0 CRITICAL**, **5 HIGH**, **7 MEDIUM**, **1 LOW**, **5 PASS**.

The top quick-wins (Rank 1–7) are all LOW effort and would meaningfully improve accessibility compliance. The two HIGH-effort items (undo system and `window.confirm` replacement) are structural investments that would transform the application's error resilience.

**Strongest areas:** Theme system, OpenDyslexic support, ChatPanel ARIA, DiffView removal encoding.
**Weakest areas:** Keyboard accessibility (skip nav, focus traps, context menu), undo coverage, reduced-motion support.
