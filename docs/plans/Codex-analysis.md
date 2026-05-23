Findings

High: The trust model is too narrow. The plan only prompts for “code-bearing” contributions, but declarative actions can still write files, mutate active text, run prompts/sequences, and spend API tokens via askAI. See Packs-plan.md (line 41) and Packs-plan.md (line 62). I’d treat any executable contribution, declarative or script, as requiring trust.

High: The manifest naming is inconsistent. The architecture extends existing pack.json, but templates and verification expect manifest.json. The current server only discovers pack.json in server/routes/files.js (line 349). See conflicting plan lines at Packs-plan.md (line 16), Packs-plan.md (line 134), and Packs-plan.md (line 163). Pick pack.json for v1 unless there is a deliberate migration.

High: Phase ordering has a real blocker. Runtime and wizard work in phases 3-5 depend on reading action JSON/scripts and writing extension folders, but the needed server endpoints do not arrive until phase 6. The browser cannot directly read ~/.arcwright/extensions/<id>/actions/.... Move server/routes/extensions.js earlier, or make phase 1 include read-only action resolution and phase 3 include scaffold/install writes.

High: Chat tool conversion is more invasive than the plan says. useChatSend directly calls ACTION_HANDLERS for text tool tags, inline JSON tools, and native structured calls, so changing executeActions alone will miss major execution paths. See useChatSend.js (line 212) and useChatSend.js (line 266). Add a single getActionHandler(name) dispatch layer and migrate all call sites.

Medium: Custom sequence steps need a centralized runner, not just a final top-level fallback. Loop bodies have their own local action/condition handling in actionExecutor.js (line 1167), so extension steps inside loops would be ignored unless both paths share one step dispatcher.

Medium: Enable/disable needs clearer state ownership. Current pack prompts/sequences are appended into the same arrays via usePromptStore.js (line 94) and useSequenceStore.js (line 98). “Disable makes them disappear” and “go grey-tagged” are different behaviors. I’d keep pack contributions separate from user-created items and derive visible lists from enabled pack IDs.

Medium: The Monaco assumption is stale. The plan says Monaco is already loaded via MarkdownEditor, but package.json has no Monaco dependency and the editor appears to use contentEditable plus a custom CodePane. Either add Monaco explicitly as lazy-loaded wizard-only dependency, or reuse the existing script editor/code pane.

Overall: the plan is directionally strong. The registry idea is the right backbone, and “declarative-first with script escape hatch” fits Arcwright’s audience nicely. I’d revise the plan around three guardrails before building: trust all active contributions, move server/action-file resolution earlier, and introduce unified dispatch layers for chat actions and sequence steps before adding new surfaces.