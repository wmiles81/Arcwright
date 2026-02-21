import useEditorStore from '../store/useEditorStore';
import useProjectStore from '../store/useProjectStore';
import useAppStore from '../store/useAppStore';

function routeToWorkflow(route) {
  if (route?.includes('edit')) return 'Edit';
  if (route?.includes('scaffold')) return 'Scaffold';
  if (route?.includes('analyze')) return 'Analysis';
  if (route?.includes('help')) return 'Help';
  return 'Home';
}

/**
 * Build a system prompt that gives the LLM role context, available tools,
 * and workflow-specific instructions. App state is NOT inlined — the LLM
 * pulls it on demand via getter tools (getGenreConfig, getScaffoldBeats, etc.).
 *
 * Exception: Editor pane contents are still inlined on the Edit page because
 * the LLM needs the prose text every turn for line editing and writing.
 */
export function buildChatSystemPrompt(currentRoute, { nativeToolsActive = false } = {}) {
  const workflow = routeToWorkflow(currentRoute);

  let prompt = `You are a narrative design assistant embedded in the "Arcwright" application. You help writers build, analyze, and refine story arcs across 11 narrative dimensions.

You are conversational, knowledgeable about storytelling craft, and can both advise AND directly modify the application state when asked. Never reprint or restate file contents that are already in context — respond only to what the user specifically asked for. When you write a file (writeFile or writeArtifact), your entire chat response must be at most one sentence confirming the filename and word count. Do not narrate, summarize, or describe the content you wrote.

## Current Workflow: ${workflow}

## Reading Application State
You have tools to inspect the current application state on demand. Use these when the user's question requires specific data — do not call them preemptively.

- \`getGenreConfig\` — current genre, subgenre, modifier, pacing, blend settings, and genre requirements
- \`getAvailableGenres\` — full catalog of genres and subgenres
- \`getWeights\` — current tension weight values (9 channels, range 0-3)
- \`getDimensions\` — the 11 narrative dimension definitions and ranges
- \`getPlotStructure\` — current plot structure and beat definitions
- \`getScaffoldBeats\` — all scaffold beats with dimension values
- \`getChapters\` — chapter list with scores, status, word counts
- \`getRevisionChecklist\` — revision items with checked state
- \`getEditorContents\` — open editor pane contents (files, word counts, full text)
- \`listSequences\` — all saved named sequences (id, name, description, step count)
- \`runNamedSequence\` — run a saved sequence by ID (use listSequences first)
`;

  // On Edit page: show a brief editor header (directory + open tabs) so the model
  // knows file operations are available and what files exist. Content is NOT inlined —
  // use getEditorContents to read it on demand.
  if (workflow === 'Edit') {
    const editorState = useEditorStore.getState();
    if (editorState.directoryHandle) {
      prompt += `\n## Editor\n`;
      prompt += `Open directory: **${editorState.directoryHandle.name}/**\n`;
      if (editorState.tabs.length > 0) {
        const activeTab = editorState.tabs.find((t) => t.id === editorState.activeTabId);
        const secondaryTab = editorState.dualPane
          ? editorState.tabs.find((t) => t.id === editorState.secondaryTabId)
          : null;
        if (activeTab) {
          const words = activeTab.content ? activeTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
          prompt += `Left pane: **${activeTab.title}** (${words} words)${activeTab.dirty ? ' [unsaved]' : ''}\n`;
        }
        if (secondaryTab) {
          const words = secondaryTab.content ? secondaryTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
          prompt += `Right pane: **${secondaryTab.title}** (${words} words)${secondaryTab.dirty ? ' [unsaved]' : ''}\n`;
        }
        const otherTabs = editorState.tabs.filter(
          (t) => t.id !== editorState.activeTabId && t.id !== editorState.secondaryTabId
        );
        if (otherTabs.length > 0) {
          prompt += `Other open tabs: ${otherTabs.map((t) => t.title).join(', ')}\n`;
        }
      }
      prompt += `Use \`getEditorContents\` to read file contents.\n`;
      prompt += `**RULE: When asked to write, draft, or revise any chapter or file content, you MUST call \`writeFile\` to save it to disk. Never output file content as text in chat.**\n`;
    }
  }

  // Reference files from green-dotted files in the file browser
  {
    const { contextContent = {} } = useEditorStore.getState();
    const ctxEntries = Object.entries(contextContent).filter(([, c]) => c);
    if (ctxEntries.length > 0) {
      prompt += `\n## Reference Files (marked in file browser)\n`;
      let totalChars = 0;
      const MAX_CTX_CHARS = 40_000;
      for (const [path, content] of ctxEntries) {
        if (totalChars >= MAX_CTX_CHARS) {
          prompt += `*[Remaining files omitted — context budget reached.]*\n`;
          break;
        }
        const filename = path.split('/').pop();
        const words = content.trim().split(/\s+/).filter(Boolean).length;
        const remaining = MAX_CTX_CHARS - totalChars;
        const chunk = content.length > remaining
          ? content.slice(0, remaining) + '\n...[truncated]'
          : content;
        prompt += `\n### ${filename} (${words} words)\n`;
        prompt += `\`\`\`markdown\n${chunk}\n\`\`\`\n`;
        totalChars += content.length;
      }
    }
  }

  // Active voice guide
  {
    const { activeVoiceContent, activeVoicePath } = useAppStore.getState().chatSettings;
    if (activeVoiceContent) {
      const voiceName = activeVoicePath ? activeVoicePath.replace(/\.md$/, '') : 'active voice';
      prompt += `\n## Voice Guide (${voiceName})\nWrite in the voice established by this style reference:\n\n${activeVoiceContent}\n`;
    }
  }

  // Narrator gender mechanics overlay (additive — supplements voice guide, does not replace it)
  {
    const { activeNarratorGender, activeGenderMechanicsContent } = useAppStore.getState().chatSettings;
    if (activeNarratorGender && activeGenderMechanicsContent) {
      prompt += `\n## Narrator Gender Mechanics (${activeNarratorGender})\nThe following mechanics SUPPLEMENT the voice guide above — apply them alongside the established voice characteristics, not instead of them.\n\n${activeGenderMechanicsContent}\n`;
    }
  }

  // Artifact awareness — check if active book project has artifacts
  const projectState = useProjectStore.getState();
  if (projectState.activeMode === 'book') {
    const edState = useEditorStore.getState();
    const artifactsNode = edState.fileTree?.find(
      (n) => n.name === 'artifacts' && n.type === 'dir'
    );
    if (artifactsNode) {
      const fileCount = artifactsNode.children?.filter(
        (c) => c.type === 'file' && c.name !== 'manifest.json'
      ).length || 0;
      if (fileCount > 0) {
        prompt += `\n## Artifacts\n`;
        prompt += `${fileCount} artifact${fileCount !== 1 ? 's' : ''} in the book project. Use \`listArtifacts\` to see what's available. Use \`readProjectFile\` with path "artifacts/filename.md" to read a specific artifact — but ONLY when the user explicitly asks you to reference one. Do NOT read artifacts proactively before writing.\n`;
      }
    }
    prompt += `\nUse \`writeArtifact\` for production artifacts and long outputs (story dossiers, character sheets, outlines, trope analyses, premise docs, etc.) instead of putting them in chat messages.\n`;
  }

  if (nativeToolsActive) {
    prompt += `
## Modifying Application State
You have tools available to modify the application state. Use them when the user asks you to change settings, beats, chapters, genres, weights, or other app state. Always explain what you're doing before calling a tool. When you need IDs (beat IDs, chapter IDs), call the appropriate getter first to find them. Keep dimension values within their valid ranges. Be conversational and helpful — you're a writing partner, not just a tool.

**RULE: When asked to write 2 or more chapters or documents, call runSequence instead of writing them all in one response. Each step's task field must be self-contained: include character names, POV, beat brief, word target, and any relevant story details.**
`;
  } else {
    prompt += `
## Taking Actions

When the user asks you to change something in the application, include a JSON action block in your response. Wrap it in a fenced code block tagged \`action\`:

\`\`\`action
{"type": "actionName", "param": "value"}
\`\`\`

Multiple actions in one block:
\`\`\`action
[
  {"type": "action1", ...},
  {"type": "action2", ...}
]
\`\`\`

### Reading State
Query application state before modifying it:

\`\`\`action
{"type": "getGenreConfig"}
\`\`\`

Available: getGenreConfig, getAvailableGenres, getWeights, getDimensions, getPlotStructure, getScaffoldBeats, getChapters, getRevisionChecklist, getEditorContents, runSequence

### Modifying State
`;

    if (workflow === 'Scaffold') {
      prompt += `
**Scaffold Actions:**
- {"type": "updateBeat", "id": "<beat_id>", "updates": {"<dim_key>": <number>, ...}} — Update dimension values on a beat. Can also update "time", "label", "beat".
- {"type": "addBeat", "beat": {"id": "beat_<timestamp>", "time": <0-100>, "beat": "<beat_key>", "label": "<name>", "<dim_key>": <number>, ...}} — Add a new beat. Include all 11 dimensions.
- {"type": "removeBeat", "id": "<beat_id>"} — Remove a beat
- {"type": "clearScaffold"} — Remove all beats
`;
    }

    if (workflow === 'Analysis') {
      prompt += `
**Analysis Actions:**
- {"type": "updateChapterScores", "chapterId": "<ch_id>", "scores": {"<dim_key>": <number>, ...}} — Update dimension scores for a chapter
- {"type": "removeChapter", "id": "<ch_id>"} — Remove a chapter
`;
    }

    if (workflow === 'Edit') {
      prompt += `
**Edit Actions:**
- {"type": "writeFile", "path": "<relative/path/filename.md>", "content": "<full file content>"} — Create or overwrite a file on disk in the open directory and open it in the editor. Subdirectories are created automatically.
- {"type": "runSequence", "steps": [{"task": "<self-contained chapter brief>", "outputFile": "<path/filename.md>"}, ...]} — Write N chapters or documents sequentially, each as a separate focused LLM call. Use this for ANY request to write 2 or more chapters/documents. Each step's task must be fully self-contained: include character names, POV, beat context, word target, and any relevant story details. Each file is written to disk automatically.

⚠️ HARD RULE — VERSIONED REWRITES:
When writing a revised or rewritten version of any existing file, you MUST use a versioned filename. NEVER overwrite the original. Examples:
  - "01-Chapter-One.md" → rewrite to "01-Chapter-One-v02.md"
  - "01-Chapter-One-v02.md" → rewrite to "01-Chapter-One-v03.md"
  - Same subfolder as the original (e.g., "chapters/01-Chapter-One-v02.md")
Versioned files automatically open in diff view (original left, revision right).
Always write the COMPLETE revised text — never partial content or diffs.
`;
    }

    prompt += `
**Genre Actions (always available):**
- {"type": "setGenre", "genre": "<genre_key>"} — Change primary genre
- {"type": "setSubgenre", "subgenre": "<subgenre_key>"} — Change subgenre
- {"type": "setModifier", "modifier": "<modifier_name>"} — Set modifier (use "" to clear)
- {"type": "updateWeight", "key": "<weight_key>", "value": <0-3>} — Adjust a tension weight
- {"type": "resetWeights"} — Reset weights to genre defaults
- {"type": "setBlendEnabled", "enabled": <true|false>} — Toggle genre blending
- {"type": "setSecondaryGenre", "genre": "<genre_key>"} — Set secondary blend genre
- {"type": "setBlendRatio", "ratio": <1-99>} — Set blend percentage
- {"type": "toggleDimension", "dim": "<dimension_key>"} — Toggle dimension visibility on chart

**Artifact Actions (for book production deliverables):**
- {"type": "writeArtifact", "filename": "<filename.md>", "content": "<full content>", "metadata": {"type": "<type>", "description": "<brief desc>", "source": "<source>"}} — Write a production artifact to the artifacts/ folder. Use for outputs over ~500 words (dossiers, outlines, character sheets, etc.)
- {"type": "listArtifacts"} — List all artifacts with metadata

**Orchestrator Actions (for multi-agent coordination):**
- {"type": "listAgents"} — List all AI Projects available as agents
- {"type": "listPromptTools"} — List all custom prompts available as tools
- {"type": "spawnAgent", "agentId": "<ai_project_name>", "task": "<task description>", "inputs": {...}, "provider": "<optional>", "model": "<optional>"} — Spawn an AI Project agent to perform a task
- {"type": "runPrompt", "promptId": "<prompt_id>", "inputs": {"<var>": "<value>"}, "provider": "<optional>", "model": "<optional>"} — Execute a custom prompt as a tool
- {"type": "listSequences"} — list all saved named sequences
- {"type": "runNamedSequence", "sequenceId": "<id>", "userInputs": {"<var>": "<value>"}} — run a named sequence by ID

### Rules
1. Always explain what you're doing BEFORE the action block.
2. When you need IDs (beat IDs, chapter IDs), call the appropriate getter first to find them.
3. Keep dimension values within their valid ranges.
4. You may include multiple action blocks in one response.
5. **RULE: When asked to write 2 or more chapters or documents, use runSequence instead of writing them all in one response. Include all necessary context in each step's task field (character names, POV, beat brief, word target) so each step is self-contained.**
6. If the user asks something you cannot do via actions, explain what they should do manually.
7. Be conversational and helpful — you're a writing partner, not just a tool.
`;
  }

  return prompt;
}

/**
 * Build a minimal system prompt for a single step in a runSequence call.
 * Includes only voice guide + gender mechanics — no app state, no action docs.
 * The step LLM's only job is to output prose.
 */
export function buildSequenceStepSystemPrompt() {
  let prompt = `You are a creative fiction writer. Write the chapter or document described in the task.

Output ONLY the requested creative content. No commentary, no preamble, no action blocks, no meta-text. Begin writing immediately.`;

  const { activeVoiceContent, activeVoicePath, activeNarratorGender, activeGenderMechanicsContent } =
    useAppStore.getState().chatSettings;

  if (activeVoiceContent) {
    const voiceName = activeVoicePath ? activeVoicePath.replace(/\.md$/, '') : 'active voice';
    prompt += `\n\n## Voice Guide (${voiceName})\nWrite in the voice established by this style reference:\n\n${activeVoiceContent}`;
  }

  if (activeNarratorGender && activeGenderMechanicsContent) {
    prompt += `\n\n## Narrator Gender Mechanics (${activeNarratorGender})\nThe following mechanics SUPPLEMENT the voice guide — apply them alongside the established voice characteristics, not instead of them.\n\n${activeGenderMechanicsContent}`;
  }

  return prompt;
}

// ── AI Project prompt builders ──

// Per-file auto-inline threshold (words). Files over this are referenced, not inlined.
const AUTO_INLINE_WORD_LIMIT = 400;
// Total inline budget (words) across all auto-mode files.
const TOTAL_INLINE_WORD_BUDGET = 4000;
// Hard cap (chars) across ALL inlined knowledge content, including 'inline' mode files.
// ~60 000 chars ≈ 15 000 tokens. Files that would push past this become reference-only.
const MAX_KNOWLEDGE_CHARS = 60_000;

/**
 * Decide whether a file should be inlined into the system prompt.
 * - 'inline': always inline (no word-count check)
 * - 'reference': never inline (tool-callable only)
 * - 'skill': never inline (handled separately via skill folder listing)
 * - 'auto' (default): inline if cached content is under AUTO_INLINE_WORD_LIMIT words
 */
function shouldInline(f) {
  const mode = f.includeMode || 'auto';
  if (mode === 'inline') return true;
  if (mode === 'reference' || mode === 'skill') return false;
  // auto for folder entries with SKILL.md: treat as skill (skip inline)
  if (f.type === 'folder' && f.cachedContent) return false;
  // auto: inline small files, reference large ones
  if (!f.cachedContent) return false;
  const wordCount = f.cachedContent.trim().split(/\s+/).filter(Boolean).length;
  return wordCount < AUTO_INLINE_WORD_LIMIT;
}

/**
 * Inline project file contents directly into the system prompt (Claude Projects style).
 * Respects per-file includeMode: auto (word threshold), inline (always), reference (never).
 * Skips skill folder entries — those are handled by buildSkillFolderListing.
 *
 * Budgets:
 * - 'auto' files: capped by TOTAL_INLINE_WORD_BUDGET words
 * - 'inline' files: no per-file limit, but ALL inlined content (auto + inline) is capped
 *   by MAX_KNOWLEDGE_CHARS to prevent runaway context from many large forced-inline files.
 */
function buildProjectKnowledge(aiProject) {
  if (!aiProject.files || aiProject.files.length === 0) return '';

  const nonSkillFiles = aiProject.files.filter((f) => {
    if (f.includeMode === 'skill') return false;
    if (f.type === 'folder' && f.cachedContent) return false; // auto-detected skill
    return true;
  });

  if (nonSkillFiles.length === 0) return '';

  let section = '\n## Project Knowledge\n';
  section += 'The following reference documents are part of this project.\n\n';

  let autoInlineWordsUsed = 0;
  let totalKnowledgeChars = 0;

  for (const f of nonSkillFiles) {
    const label = f.title || f.path;
    const forceInline = (f.includeMode || 'auto') === 'inline';
    const canAutoInline = shouldInline(f) && f.cachedContent;
    const contentLen = f.cachedContent?.length || 0;

    let doInline = false;
    if (forceInline && f.cachedContent) {
      // 'inline' mode: apply shared hard cap — large forced files become reference-only
      if (totalKnowledgeChars + contentLen <= MAX_KNOWLEDGE_CHARS) {
        doInline = true;
      }
    } else if (canAutoInline) {
      const words = f.cachedContent.trim().split(/\s+/).filter(Boolean).length;
      if (
        autoInlineWordsUsed + words <= TOTAL_INLINE_WORD_BUDGET &&
        totalKnowledgeChars + contentLen <= MAX_KNOWLEDGE_CHARS
      ) {
        doInline = true;
        autoInlineWordsUsed += words;
      }
    }

    if (doInline) {
      section += `### ${label}\n`;
      if (f.description) section += `*${f.description}*\n\n`;
      section += `${f.cachedContent}\n\n---\n\n`;
      totalKnowledgeChars += contentLen;
    } else {
      // Reference mode — content is available on demand via readProjectFile
      section += `### ${label} (\`${f.path}\`)\n`;
      if (f.description) section += `${f.description}\n`;
      const reason = forceInline ? ' [size cap reached — use readProjectFile]' : '';
      section += `*(Content available via readProjectFile tool${reason})*\n\n`;
    }
  }

  return section;
}

/**
 * Format skill folder file trees for the system prompt.
 * Shows the directory structure so the AI knows what files are available.
 */
function buildSkillFolderListing(aiProject) {
  if (!aiProject.files || aiProject.files.length === 0) return '';

  const skillFolders = aiProject.files.filter((f) => {
    if (f.type === 'folder' && (f.includeMode === 'skill' || f.cachedContent)) return true;
    return false;
  });

  if (skillFolders.length === 0) return '';

  const formatEntries = (entries, indent = '') => {
    let result = '';
    for (const entry of entries) {
      if (entry.type === 'dir') {
        result += `${indent}${entry.name}/\n`;
        if (entry.children) {
          result += formatEntries(entry.children, indent + '  ');
        }
      } else {
        result += `${indent}${entry.name}\n`;
      }
    }
    return result;
  };

  let listing = '';
  for (const folder of skillFolders) {
    listing += `\n## Skill Files (${folder.path}/)\n`;
    listing += 'Reference files available via readProjectFile. Use relative paths as shown.\n\n';
    if (folder.fileTree && folder.fileTree.length > 0) {
      listing += '```\n';
      listing += formatEntries(folder.fileTree);
      listing += '```\n';
    }
  }

  return listing;
}

/**
 * Format the editor's file tree as a readable listing for the system prompt.
 * Shows files with indentation.
 */
function buildFileTreeListing(editorState) {
  const { fileTree, directoryHandle, tabs } = editorState;
  if (!directoryHandle || !fileTree || fileTree.length === 0) return '';

  const openTabPaths = new Set(tabs.map((t) => t.id));

  const formatEntries = (entries, indent = '') => {
    let result = '';
    for (const entry of entries) {
      if (entry.type === 'dir') {
        result += `${indent}${entry.name}/\n`;
        if (entry.children) {
          result += formatEntries(entry.children, indent + '  ');
        }
      } else if (entry.type === 'file') {
        const isOpen = openTabPaths.has(entry.path);
        result += `${indent}${entry.name}${isOpen ? ' [open]' : ''}\n`;
      }
    }
    return result;
  };

  let listing = `\n## Editor File Tree (${directoryHandle.name}/)\n`;
  listing += 'These files are in the editor\'s open directory. Use readProjectFile with the filename to read any of them.\n\n';
  listing += '```\n';
  listing += formatEntries(fileTree);
  listing += '```\n';
  return listing;
}

/**
 * Build the complete system prompt for an AI project.
 *
 * @param {object} aiProject - The active AI project
 * @param {object} editorState - Editor store state
 * @param {string} currentRoute - Current route path (e.g., '/edit', '/analyze')
 */
export function buildAiProjectSystemPrompt(aiProject, editorState, currentRoute) {
  let prompt = '';
  const _log = {}; // section char counts for diagnostics

  // Editor file tree listing — always useful so AI knows what files exist
  if (editorState) {
    const before = prompt.length;
    prompt += buildFileTreeListing(editorState);
    _log.fileTree = prompt.length - before;
  }

  // Reference files from green-dotted file browser entries
  if (editorState) {
    const contextContent = editorState.contextContent || {};
    const ctxEntries = Object.entries(contextContent).filter(([, c]) => c);
    if (ctxEntries.length > 0) {
      const before = prompt.length;
      prompt += `\n## Reference Files (marked in file browser)\n`;
      let totalChars = 0;
      const MAX_CTX_CHARS = 40_000;
      for (const [path, content] of ctxEntries) {
        if (totalChars >= MAX_CTX_CHARS) {
          prompt += `*[Remaining files omitted — context budget reached.]*\n`;
          break;
        }
        const filename = path.split('/').pop();
        const words = content.trim().split(/\s+/).filter(Boolean).length;
        const remaining = MAX_CTX_CHARS - totalChars;
        const chunk = content.length > remaining
          ? content.slice(0, remaining) + '\n...[truncated]'
          : content;
        prompt += `\n### ${filename} (${words} words)\n`;
        prompt += `\`\`\`markdown\n${chunk}\n\`\`\`\n`;
        totalChars += content.length;
      }
      _log.contextFiles = prompt.length - before;
    }
  }

  // Skill folder file tree listing
  {
    const before = prompt.length;
    prompt += buildSkillFolderListing(aiProject);
    _log.skillFolders = prompt.length - before;
  }

  // Inline project file contents (Claude Projects style)
  {
    const before = prompt.length;
    prompt += buildProjectKnowledge(aiProject);
    _log.knowledge = prompt.length - before;
  }

  // Artifact awareness for AI projects
  const projState = useProjectStore.getState();
  if (projState.activeMode === 'book' || projState.activeBookProject) {
    const artifactsNode = editorState?.fileTree?.find(
      (n) => n.name === 'artifacts' && n.type === 'dir'
    );
    if (artifactsNode) {
      const fileCount = artifactsNode.children?.filter(
        (c) => c.type === 'file' && c.name !== 'manifest.json'
      ).length || 0;
      if (fileCount > 0) {
        prompt += `\n## Artifacts\n`;
        prompt += `${fileCount} artifact${fileCount !== 1 ? 's' : ''} in the book project. Use \`listArtifacts\` to see details. Use \`readProjectFile\` with "artifacts/filename" to read files.\n`;
      }
    }
    prompt += `\nUse \`writeArtifact\` for long outputs instead of putting them in chat.\n`;
  }

  // Active voice guide
  {
    const { activeVoiceContent, activeVoicePath } = useAppStore.getState().chatSettings;
    if (activeVoiceContent) {
      const voiceName = activeVoicePath ? activeVoicePath.replace(/\.md$/, '') : 'active voice';
      prompt += `\n## Voice Guide (${voiceName})\nWrite in the voice established by this style reference:\n\n${activeVoiceContent}\n`;
    }
  }

  // Narrator gender mechanics overlay (additive — supplements voice guide, does not replace it)
  {
    const { activeNarratorGender, activeGenderMechanicsContent } = useAppStore.getState().chatSettings;
    if (activeNarratorGender && activeGenderMechanicsContent) {
      prompt += `\n## Narrator Gender Mechanics (${activeNarratorGender})\nThe following mechanics SUPPLEMENT the voice guide above — apply them alongside the established voice characteristics, not instead of them.\n\n${activeGenderMechanicsContent}\n`;
    }
  }

  // Getter tool guidance — tell AI project agents to pull state on demand
  prompt += `
## Reading Application State
You have tools to inspect the current application state on demand. Use these **only** when the user's question requires specific data — do not call them preemptively at the start of a conversation.

- \`getGenreConfig\` — current genre, subgenre, modifier, pacing, blend settings, and genre requirements
- \`getAvailableGenres\` — full catalog of genres and subgenres
- \`getWeights\` — current tension weight values (9 channels, range 0-3)
- \`getDimensions\` — the 11 narrative dimension definitions and ranges
- \`getPlotStructure\` — current plot structure and beat definitions
- \`getScaffoldBeats\` — all scaffold beats with dimension values
- \`getChapters\` — chapter list with scores, status, word counts
- \`getRevisionChecklist\` — revision items with checked state
- \`getEditorContents\` — open editor pane contents (files, word counts, full text)
- \`listSequences\` — all saved named sequences
- \`runNamedSequence\` — run a saved sequence by ID

**Important:** Only call getters when you need specific data to answer the user's question or perform a requested action. Do NOT gather all state at the start of a conversation. Do NOT call readProjectFile proactively before writing — only call it when the user explicitly asks you to reference a specific file. When asked to write, draft, or revise any chapter or file content, you MUST call \`writeFile\` or \`writeArtifact\` to save it to disk — never output file content as text in chat. When you write a file, your chat response must be at most one sentence confirming the filename and word count.
`;

  // Custom system prompt last (highest weight for LLMs)
  if (aiProject.systemPrompt) {
    prompt += `\n---\n\n${aiProject.systemPrompt}`;
  }

  return prompt;
}
