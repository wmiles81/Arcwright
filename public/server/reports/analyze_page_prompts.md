# Analyze Page — Prompt Architecture

This document describes the system prompts sent to the LLM when the user is on the **Analyze** page (`/analyze` route). There are two distinct paths depending on whether an AI Project is active.

---

## Routing Logic (`useChatSend.js`)

```
if (activeAiProject && activeMode === 'ai') {
    → buildAiProjectSystemPrompt(aiProject, editorState, '/analyze')
    → tools enabled if model supports them
} else {
    promptMode = chatSettings.promptMode || 'full'
    if (promptMode === 'full') {
        → buildChatSystemPrompt('/analyze', { nativeToolsActive })
        → tools enabled if model supports them
    } else if (promptMode !== 'off') {
        → buildEditModePrompt(promptMode, editorState)
        → no tools
    } else {
        → no system prompt at all
    }
}
```

---

## Path 1: Default Mode (No AI Project Active)

**Builder:** `buildChatSystemPrompt('/analyze', { nativeToolsActive })`
**Source:** `src/chat/contextBuilder.js:21-233`

### Template (with `{placeholders}` for dynamic data)

```
You are a narrative design assistant embedded in the "Arcwrite" application. You help
writers build, analyze, and refine story arcs across 11 narrative dimensions.

You are conversational, knowledgeable about storytelling craft, and can both advise AND
directly modify the application state when asked.

## Current Workflow: Analysis

## Genre Configuration
- Genre: {genre.name} (key: {selectedGenre})
- Subgenre: {subgenre.name} (key: {selectedSubgenre})
- Modifier: {selectedModifier || 'None'}
- Pacing: {selectedPacing || 'None'}
- Plot Structure: {structure.name} (key: {genre.structure})
- Blend: {Disabled | Enabled — ratio% primary / (100-ratio)% secondaryGenre > secondarySubgenre}

## Available Genres
- romance: Romance (subgenres: contemporary="Contemporary", historical="Historical", ...)
- scienceFiction: Science Fiction (subgenres: ...)
- fantasy: Fantasy (subgenres: ...)
- mystery: Mystery (subgenres: ...)
- thriller: Thriller (subgenres: ...)
- horror: Horror (subgenres: ...)
- literary: Literary Fiction (subgenres: ...)

## The 11 Narrative Dimensions
- intimacy (Intimacy): range 0 to 10
- trust (Trust): range -5 to 5
- tension (Tension): range 0 to 10
- stakes (Stakes): range 0 to 10
- pacing (Pacing): range 0 to 10
- agency (Agency): range 0 to 10
- identity (Identity): range 0 to 10
- sensory (Sensory): range 0 to 10
- worldComplexity (World Complexity): range 0 to 10
- moralAmbiguity (Moral Ambiguity): range 0 to 10
- goalAlignment (Goal Alignment): range -5 to 5

## Current Weights (9 tension channels, range 0-3)
- conflict: {value}
- mystery: {value}
- romantic: {value}
- social: {value}
- internal: {value}
- survival: {value}
- temporal: {value}
- moral: {value}
- cosmic: {value}
```

### Analysis-Specific Context (only on Analyze page)

If chapters exist:
```
## Chapters ({count} total)
1. [id:{ch.id}] "{ch.title}" ({wordCount} words, status: {status}) — intimacy:{score}, trust:{score}, ... [time: {timePercent}%] [beat: {beat}]
2. [id:{ch.id}] "{ch.title}" ...
...
```

If no chapters:
```
## Chapters: None yet — the user hasn't added any chapters.
```

If revision checklist exists:
```
## Revision Checklist ({checked}/{total} checked)
- [x] {recommendation text}
- [ ] {recommendation text}
...
```

### Genre Requirements (if subgenre has them)
```
## Genre Requirements (end-of-story targets)
- Final Intimacy: {min}–{max}
- Final Trust: {min}–{max}
- Final Tension: {min}–{max}
```

### Plot Structure Beats
```
## Plot Structure Beats ({structure.name})
- {beatKey}: "{beat.name}" at {range[0]}–{range[1]}%
- ...
```

### Actions Section

**If native tools are active (`nativeToolsActive: true`):**
```
## Modifying Application State
You have tools available to modify the application state. Use them when the user asks you
to change settings, beats, chapters, genres, weights, or other app state. Always explain
what you're doing before calling a tool. Use the exact IDs shown in the state above
(e.g., beat_1234, ch_abc). Keep dimension values within their valid ranges. Be
conversational and helpful — you're a writing partner, not just a tool.
```

**If native tools NOT active (fenced-block fallback):**
```
## Taking Actions

When the user asks you to change something in the application, include a JSON action block
in your response. Wrap it in a fenced code block tagged `action`:

\`\`\`action
{"type": "actionName", "param": "value"}
\`\`\`

### Available Actions

**Analysis Actions:**
- {"type": "updateChapterScores", "chapterId": "<ch_id>", "scores": {"<dim_key>": <number>, ...}}
- {"type": "removeChapter", "id": "<ch_id>"}

**Genre Actions (always available):**
- {"type": "setGenre", "genre": "<genre_key>"}
- {"type": "setSubgenre", "subgenre": "<subgenre_key>"}
- {"type": "setModifier", "modifier": "<modifier_name>"}
- {"type": "updateWeight", "key": "<weight_key>", "value": <0-3>}
- {"type": "resetWeights"}
- {"type": "setBlendEnabled", "enabled": <true|false>}
- {"type": "setSecondaryGenre", "genre": "<genre_key>"}
- {"type": "setBlendRatio", "ratio": <1-99>}
- {"type": "toggleDimension", "dim": "<dimension_key>"}

### Rules
1. Always explain what you're doing BEFORE the action block.
2. Use the exact IDs shown in the state above (e.g., beat_1234, ch_abc).
3. Keep dimension values within their valid ranges.
4. You may include multiple action blocks in one response.
5. If the user asks something you cannot do via actions, explain what they should do manually.
6. Be conversational and helpful — you're a writing partner, not just a tool.
```

---

## Path 2: AI Project Active

**Builder:** `buildAiProjectSystemPrompt(aiProject, editorState, '/analyze')`
**Source:** `src/chat/contextBuilder.js:321-347`

On the Analyze page, editor pane contents are **NOT** included (only on `/edit` route).

### Template

```
## Editor File Tree ({directoryName}/)
These files are in the editor's open directory. Use readProjectFile with the filename to
read any of them.

\`\`\`
{file tree with indentation, [open] markers for open tabs}
\`\`\`

## Project Knowledge
The following reference documents are part of this project.

### {file title or path}
*{file description}*

{full file content — if inlined}

---

### {file title or path} (`{file.path}`)
{file description}
*(Content available via readProjectFile tool)*

---

{user's custom system prompt text}
```

### Include Mode Logic (`shouldInline()`)

Each project file has an `includeMode` field:
- **`auto`** (default): Inline if `cachedContent` is under 2,000 words; otherwise reference-only
- **`inline`**: Always inline full content in system prompt
- **`reference`**: Never inline; show description + note about `readProjectFile` tool

### File Tree Listing (`buildFileTreeListing()`)

Always included when an editor directory is open. Shows the full file tree so the AI knows
what files are available to read:

```
## Editor File Tree (MyBook/)
These files are in the editor's open directory. Use readProjectFile with the filename to
read any of them.

\`\`\`
chapters/
  01-Chapter-One.md [open]
  02-Chapter-Two.md
  03-Chapter-Three.md
notes/
  outline.md
\`\`\`
```

---

## Tool Definitions (sent alongside system prompt when native tools active)

**Source:** `src/chat/toolDefinitions.js`

When native tool calling is enabled, the following tool schemas are sent via the API's
`tools` parameter. On the Analyze page, the most relevant are:

### Analysis Tools
| Tool | Description | Required Params |
|------|-------------|-----------------|
| `updateChapterScores` | Update dimension scores for a chapter | `chapterId`, `scores` (object of dim key-value pairs) |
| `removeChapter` | Remove a chapter by ID | `id` |
| `setProjectionPercent` | Set the projection percentage for analysis view | `percent` (0-100) |

### Genre/Config Tools (always available)
| Tool | Description | Required Params |
|------|-------------|-----------------|
| `setGenre` | Change primary genre | `genre` (key) |
| `setSubgenre` | Change subgenre | `subgenre` (key) |
| `setModifier` | Set or clear modifier | `modifier` (name or "") |
| `setPacing` | Set or clear pacing | `pacing` (name or "") |
| `updateWeight` | Adjust a tension weight | `key`, `value` (0-3) |
| `resetWeights` | Reset weights to defaults | — |
| `setBlendEnabled` | Toggle blending | `enabled` (bool) |
| `setSecondaryGenre` | Set secondary blend genre | `genre` (key) |
| `setSecondarySubgenre` | Set secondary blend subgenre | `subgenre` (key) |
| `setBlendRatio` | Set blend percentage | `ratio` (1-99) |
| `toggleDimension` | Toggle dimension chart visibility | `dim` (key) |

### File Access Tools
| Tool | Description | Required Params |
|------|-------------|-----------------|
| `readProjectFile` | Read file from project catalog, editor directory, or book files | `path` |
| `writeFile` | Create/overwrite file in editor directory | `path`, `content` |

### Scaffold Tools (only on Scaffold page, but defined globally)
| Tool | Description | Required Params |
|------|-------------|-----------------|
| `updateBeat` | Update beat properties/dimensions | `id`, `updates` |
| `addBeat` | Add a new scaffold beat | `beat` (object) |
| `removeBeat` | Remove a beat | `id` |
| `clearScaffold` | Remove all beats | — |

---

## Action Executor (`src/chat/actionExecutor.js`)

The `readProjectFile` handler has a multi-tier fallback for resolving file paths:

1. **Try 0:** Match against active AI project's file catalog (by path, title, or filename). Serve from `cachedContent` if available.
2. **Try 1:** Read from Arcwrite storage root via File System Access API.
3. **Try 2:** Read from the editor's open directory.
4. **Try 3:** Bare filename search — if the path has no slashes, search one level of subdirectories in the editor directory.

Path normalization: strips leading `Arcwrite/` prefix (models often prepend it).

---

## Preset Prompts (AI Project Presets)

**Source:** `src/chat/editPrompts.js:170-199`

These are read-only AI project presets users can activate or duplicate:

### Line Editor
> You are a precise, no-nonsense line editor. You fix prose.
> Rules: Show fixes as **Line/Fix/Why** format. Group by type. Preserve voice.
> Look for: passive voice, weak verbs, redundancy, unclear antecedents, rhythm, filter words, adverbs, dialogue attribution, telling-not-showing, clarity.

### Writing Partner
> You are a creative collaborator who writes prose. You do not analyze — you WRITE.
> Rules: Every response contains prose. Match tone/voice/POV/tense exactly. Show don't tell.

### Critic
> You are a sharp, honest literary critic. You do NOT rewrite — you analyze and judge.
> Format: Verdict, What Works, What Doesn't, Scene-by-Scene, Pacing Map.
> Rules: Be honest, quote specific passages, never speak in generalities.

### Version Compare
> You have two versions: LEFT PANE = original, RIGHT PANE = revision.
> Format: Winner, Passage Comparison Table, Gains, Losses, Kitbash Recipe.
> Rules: Quote from both versions, be specific, losses matter as much as gains.

---

## Summary: What the AI Sees on the Analyze Page

| Component | Default Mode | AI Project Mode |
|-----------|-------------|-----------------|
| Role instruction | "narrative design assistant" | (from project's custom system prompt) |
| Genre config | Full genre/subgenre/blend state | Not included |
| 11 dimensions | Listed with ranges | Not included |
| Tension weights | All 9 channels | Not included |
| Chapters | Full list with scores/status | Not included (but available via file tree) |
| Revision checklist | Included if present | Not included |
| Genre requirements | End-of-story targets | Not included |
| Plot structure beats | Listed with time ranges | Not included |
| Editor pane contents | Only on Edit page | Only on Edit page |
| Editor file tree | Not included | Included (always) |
| Project knowledge files | N/A | Inlined or referenced per includeMode |
| Available actions | Analysis + Genre actions | Via tools if enabled |
| Tool definitions | All tools via API | All tools via API |
