import useAppStore from '../store/useAppStore';
import useEditorStore from '../store/useEditorStore';
import { genreSystem } from '../data/genreSystem';
import { plotStructures } from '../data/plotStructures';
import { dimensions, DIMENSION_KEYS } from '../data/dimensions';
import { WEIGHT_KEYS } from '../engine/weights';
import { buildPaneContext } from './editPrompts';

function routeToWorkflow(route) {
  if (route?.includes('edit')) return 'Edit';
  if (route?.includes('scaffold')) return 'Scaffold';
  if (route?.includes('analyze')) return 'Analysis';
  if (route?.includes('help')) return 'Help';
  return 'Home';
}

/**
 * Build a system prompt that gives the LLM full context about the current app state,
 * including which workflow is active, all field values, and available actions.
 */
export function buildChatSystemPrompt(currentRoute, { nativeToolsActive = false } = {}) {
  const state = useAppStore.getState();
  const genre = genreSystem[state.selectedGenre];
  const subgenre = genre?.subgenres[state.selectedSubgenre];
  const structure = plotStructures[genre?.structure];
  const workflow = routeToWorkflow(currentRoute);

  let prompt = `You are a narrative design assistant embedded in the "Arcwright" application. You help writers build, analyze, and refine story arcs across 11 narrative dimensions.

You are conversational, knowledgeable about storytelling craft, and can both advise AND directly modify the application state when asked.

## Current Workflow: ${workflow}

## Genre Configuration
- Genre: ${genre?.name || state.selectedGenre} (key: ${state.selectedGenre})
- Subgenre: ${subgenre?.name || state.selectedSubgenre} (key: ${state.selectedSubgenre})
- Modifier: ${state.selectedModifier || 'None'}
- Pacing: ${state.selectedPacing || 'None'}
- Plot Structure: ${structure?.name || 'Unknown'} (key: ${genre?.structure || 'unknown'})
- Blend: ${state.blendEnabled ? `Enabled — ${state.blendRatio}% primary / ${100 - state.blendRatio}% ${genreSystem[state.secondaryGenre]?.name || state.secondaryGenre} > ${genreSystem[state.secondaryGenre]?.subgenres[state.secondarySubgenre]?.name || state.secondarySubgenre}` : 'Disabled'}

## Available Genres
${Object.entries(genreSystem).map(([key, g]) => `- ${key}: ${g.name} (subgenres: ${Object.entries(g.subgenres).map(([sk, s]) => `${sk}="${s.name}"`).join(', ')})`).join('\n')}

## The 11 Narrative Dimensions
${DIMENSION_KEYS.map((k) => `- ${k} (${dimensions[k].name}): range ${dimensions[k].range[0]} to ${dimensions[k].range[1]}`).join('\n')}

## Current Weights (9 tension channels, range 0-3)
${WEIGHT_KEYS.map((k) => `- ${k}: ${state.weights[k]?.toFixed(2) ?? 'N/A'}`).join('\n')}
`;

  // Scaffold-specific context
  if (workflow === 'Scaffold') {
    if (state.scaffoldBeats.length > 0) {
      prompt += `\n## Current Scaffold Beats (${state.scaffoldBeats.length} beats)\n`;
      state.scaffoldBeats.forEach((beat, i) => {
        const dimValues = DIMENSION_KEYS.map((k) => `${k}:${beat[k] ?? 0}`).join(', ');
        const beatName = structure?.beats?.[beat.beat]?.name || beat.beat || '';
        prompt += `${i + 1}. [id:${beat.id}] "${beat.label || 'Untitled'}" at ${beat.time}% (beat: ${beatName}) — ${dimValues}\n`;
      });
    } else {
      prompt += `\n## Scaffold Beats: None yet — the user hasn't added any beats.\n`;
    }
  }

  // Analysis-specific context
  if (workflow === 'Analysis') {
    if (state.chapters.length > 0) {
      prompt += `\n## Chapters (${state.chapters.length} total)\n`;
      state.chapters.forEach((ch, i) => {
        const scores = ch.userScores || ch.aiScores;
        const statusTag = ch.status || 'pending';
        const wordCount = ch.text ? ch.text.split(/\s+/).length : 0;
        prompt += `${i + 1}. [id:${ch.id}] "${ch.title || 'Untitled'}" (${wordCount} words, status: ${statusTag})`;
        if (scores) {
          const dimValues = DIMENSION_KEYS.map((k) => `${k}:${scores[k] != null ? (typeof scores[k] === 'number' ? scores[k].toFixed(1) : scores[k]) : '-'}`).join(', ');
          prompt += ` — ${dimValues}`;
          if (scores.timePercent != null) prompt += ` [time: ${scores.timePercent}%]`;
          if (scores.beat) prompt += ` [beat: ${scores.beat}]`;
        }
        prompt += '\n';
      });
    } else {
      prompt += `\n## Chapters: None yet — the user hasn't added any chapters.\n`;
    }

    if (state.revisionItems.length > 0) {
      const checked = state.revisionItems.filter((r) => r.checked).length;
      prompt += `\n## Revision Checklist (${checked}/${state.revisionItems.length} checked)\n`;
      state.revisionItems.forEach((item) => {
        prompt += `- [${item.checked ? 'x' : ' '}] ${item.recommendation || item.text || item.id}\n`;
      });
    }
  }

  // Edit-specific context
  if (workflow === 'Edit') {
    const editorState = useEditorStore.getState();
    const activeTab = editorState.tabs.find((t) => t.id === editorState.activeTabId);
    const secondaryTab = editorState.dualPane
      ? editorState.tabs.find((t) => t.id === editorState.secondaryTabId)
      : null;

    prompt += `\n## Editor State\n`;
    prompt += `- Dual-pane mode: ${editorState.dualPane ? 'ON' : 'OFF'}\n`;

    if (activeTab) {
      const words = activeTab.content ? activeTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
      prompt += `\n### Left Pane (primary)\n`;
      prompt += `- File: "${activeTab.title}" [tabId: ${activeTab.id}]${activeTab.dirty ? ' (unsaved)' : ''}\n`;
      prompt += `- Length: ${words} words\n`;
      if (activeTab.content) {
        prompt += `\n\`\`\`markdown\n${activeTab.content}\n\`\`\`\n`;
      }
    } else {
      prompt += `\n### Left Pane: empty (no file open)\n`;
    }

    if (secondaryTab) {
      const words = secondaryTab.content ? secondaryTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
      prompt += `\n### Right Pane (secondary)\n`;
      prompt += `- File: "${secondaryTab.title}" [tabId: ${secondaryTab.id}]${secondaryTab.dirty ? ' (unsaved)' : ''}\n`;
      prompt += `- Length: ${words} words\n`;
      if (secondaryTab.content) {
        prompt += `\n\`\`\`markdown\n${secondaryTab.content}\n\`\`\`\n`;
      }
    } else if (editorState.dualPane) {
      prompt += `\n### Right Pane: empty (no file selected)\n`;
    }

    const openFiles = editorState.tabs.map((t) => `"${t.title}" [${t.id}]`).join(', ');
    if (editorState.tabs.length > 0) {
      prompt += `\nAll open tabs: ${openFiles}\n`;
    }

    prompt += `\nThe user's open directory: ${editorState.directoryHandle ? `"${editorState.directoryHandle.name}/"` : 'none'}\n`;
  }

  // Genre requirements
  if (subgenre?.requirements) {
    prompt += `\n## Genre Requirements (end-of-story targets)\n`;
    prompt += `- Final Intimacy: ${subgenre.requirements.finalIntimacy[0]}–${subgenre.requirements.finalIntimacy[1]}\n`;
    prompt += `- Final Trust: ${subgenre.requirements.finalTrust[0]}–${subgenre.requirements.finalTrust[1]}\n`;
    prompt += `- Final Tension: ${subgenre.requirements.finalTension[0]}–${subgenre.requirements.finalTension[1]}\n`;
  }

  // Structure beats
  if (structure?.beats) {
    prompt += `\n## Plot Structure Beats (${structure.name})\n`;
    Object.entries(structure.beats).forEach(([key, b]) => {
      prompt += `- ${key}: "${b.name}" at ${b.range[0]}–${b.range[1]}%\n`;
    });
  }

  if (nativeToolsActive) {
    // When native tools are active, the model gets tool schemas via the API
    prompt += `
## Modifying Application State
You have tools available to modify the application state. Use them when the user asks you to change settings, beats, chapters, genres, weights, or other app state. Always explain what you're doing before calling a tool. Use the exact IDs shown in the state above (e.g., beat_1234, ch_abc). Keep dimension values within their valid ranges. Be conversational and helpful — you're a writing partner, not just a tool.
`;
  } else {
    // Fenced-block fallback for models without tool support
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

### Available Actions
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
- {"type": "writeFile", "path": "<relative/path/filename.md>", "content": "<full file content>"} — Create or overwrite a file on disk in the open directory and open it in the editor. If dual-pane is on, it opens in the right pane. Subdirectories are created automatically.

When the user asks you to revise or fix a chapter, write the revised version to a new file using a versioned filename (e.g., if the source is "01-Chapter-One.md", write to the same folder as "01-Chapter-One-v02.md"). Always include the complete revised text, not just the changes.
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

### Rules
1. Always explain what you're doing BEFORE the action block.
2. Use the exact IDs shown in the state above (e.g., beat_1234, ch_abc).
3. Keep dimension values within their valid ranges.
4. You may include multiple action blocks in one response.
5. If the user asks something you cannot do via actions (e.g., writing chapter text), explain what they should do manually.
6. Be conversational and helpful — you're a writing partner, not just a tool.
`;
  }

  return prompt;
}

// ── AI Project prompt builders ──

/**
 * Decide whether a file should be inlined into the system prompt.
 * - 'inline': always inline
 * - 'reference': never inline (tool-callable only)
 * - 'auto' (default): inline if cached content is under 2000 words
 */
function shouldInline(f) {
  const mode = f.includeMode || 'auto';
  if (mode === 'inline') return true;
  if (mode === 'reference') return false;
  // auto: inline small files, reference large ones
  if (!f.cachedContent) return false;
  const wordCount = f.cachedContent.trim().split(/\s+/).filter(Boolean).length;
  return wordCount < 2000;
}

/**
 * Inline project file contents directly into the system prompt (Claude Projects style).
 * Respects per-file includeMode: auto (2k word threshold), inline (always), reference (never).
 */
function buildProjectKnowledge(aiProject) {
  if (!aiProject.files || aiProject.files.length === 0) return '';

  let section = '\n## Project Knowledge\n';
  section += 'The following reference documents are part of this project.\n\n';

  for (const f of aiProject.files) {
    const label = f.title || f.path;
    if (shouldInline(f) && f.cachedContent) {
      section += `### ${label}\n`;
      if (f.description) section += `*${f.description}*\n\n`;
      section += `${f.cachedContent}\n\n---\n\n`;
    } else {
      // Reference mode — show description only, note it's available via tool
      section += `### ${label} (\`${f.path}\`)\n`;
      section += `${f.description}\n`;
      section += `*(Content available via readProjectFile tool)*\n\n`;
    }
  }

  return section;
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
  const isEditRoute = currentRoute?.includes('/edit');
  let prompt = '';

  // Editor pane contents — only on Edit page (too large / irrelevant elsewhere)
  if (isEditRoute && editorState) {
    const paneCtx = buildPaneContext(editorState);
    if (paneCtx.trim()) {
      prompt += `# Editor Contents\n${paneCtx}\n---\n\n`;
    }
  }

  // Editor file tree listing — always useful so AI knows what files exist
  if (editorState) {
    prompt += buildFileTreeListing(editorState);
  }

  // Inline project file contents (Claude Projects style)
  prompt += buildProjectKnowledge(aiProject);

  // Custom system prompt last (highest weight for LLMs)
  if (aiProject.systemPrompt) {
    prompt += `\n---\n\n${aiProject.systemPrompt}`;
  }

  return prompt;
}
