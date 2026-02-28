import useAppStore from '../store/useAppStore';
import useEditorStore from '../store/useEditorStore';
import useProjectStore from '../store/useProjectStore';
import usePromptStore from '../store/usePromptStore';
import useSequenceStore from '../store/useSequenceStore';
import useChatStore from '../store/useChatStore';
import { buildFileTree } from '../components/edit/FilePanel';
import { readFileByPath, readJsonFile, writeJsonFile } from '../services/arcwriteFS';
import { callCompletionSync, callCompletionWithProvider } from '../api/providerAdapter';
import { buildChatSystemPrompt, buildAiProjectSystemPrompt, buildSequenceStepSystemPrompt } from './contextBuilder';
import { buildEditModePrompt } from './editPrompts';
import { buildRevisionSystemPrompt, buildRevisionUserPrompt } from './revisionPrompts';
import { buildScoringSystemPrompt, buildGetWellSystemPrompt } from '../api/prompts';
import { genreSystem } from '../data/genreSystem';
import { plotStructures, allStructures } from '../data/plotStructures';
import { dimensions, DIMENSION_KEYS } from '../data/dimensions';
import { WEIGHT_KEYS } from '../engine/weights';

// ── Named Sequence execution helpers ─────────────────────────────────────────

function _seqInitStatus(step, idx) {
  const type = step.type || 'action';
  if (type === 'loop') {
    return {
      id: step.id,
      label: step.name || `Loop ${idx + 1}`,
      type: 'loop',
      status: 'pending',
      currentIteration: 0,
      totalIterations: step.count ?? null,
      iterations: [],
    };
  }
  if (type === 'condition') {
    return {
      id: step.id,
      label: step.name || `Condition ${idx + 1}`,
      type: 'condition',
      status: 'pending',
      decision: null,
    };
  }
  return {
    id: step.id,
    label: step.name || step.outputFile || `Step ${idx + 1}`,
    type: 'action',
    status: 'pending',
    outputFile: step.outputFile || null,
    wordCount: 0,
  };
}

// Runs an action step body: resolves template, calls LLM, writes file, posts chat messages.
// Mutates ctx.chainedContext based on step.chain.
// Returns { wordCount, resolvedOutputFile }.
async function _seqRunActionBody(step, ctx) {
  const stepName = step.name || step.outputFile || 'Step';

  ctx.chatStore.addMessage({
    id: `seq_prog_${Date.now()}_${step.id}`,
    role: 'assistant',
    content: `_Running "${ctx.sequence.name}" — ${stepName}…_`,
    timestamp: Date.now(),
  });

  const resolvedOutputFile = step.outputFile
    ? step.outputFile.replace(/##/g, String(ctx.loopIndex + 1).padStart(2, '0'))
    : null;

  let template = step.promptRef
    ? (ctx.prompts.find((p) => p.id === step.promptRef)?.template || step.template || '')
    : (step.template || '');

  template = template
    .replace(/\{\{loop_index\}\}/g, String(ctx.loopIndex))
    .replace(/\{\{loop_count\}\}/g, ctx.loopCount != null ? String(ctx.loopCount) : '');

  if (ctx.userInputs) {
    for (const [k, v] of Object.entries(ctx.userInputs)) {
      template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }

  if (ctx.chainedContext) {
    template = `## Context from previous step\n${ctx.chainedContext}\n\n${template}`;
  }

  const taskContent = template.replace(/\{\{[^}]+\}\}/g, '').trim();
  if (!taskContent) throw new Error(`Step "${stepName}" has empty content after filling template variables`);

  const prose = await callCompletionWithProvider(
    ctx.app.activeProvider,
    ctx.systemPrompt,
    taskContent,
    { maxTokens: 4096, model: step.modelOverride || null }
  );

  const wordCount = prose.trim().split(/\s+/).filter(Boolean).length;

  if (resolvedOutputFile) {
    await ACTION_HANDLERS.writeFile({ path: resolvedOutputFile, content: prose });
  }

  ctx.chainedContext = step.chain ? prose : null;

  const fileNote = resolvedOutputFile ? ` — \`${resolvedOutputFile}\`` : '';
  ctx.chatStore.addMessage({
    id: `seq_done_${Date.now()}_${step.id}`,
    role: 'assistant',
    content: `**"${ctx.sequence.name}" ${stepName} complete**${fileNote} (${wordCount.toLocaleString()} words)`,
    timestamp: Date.now(),
  });

  return { wordCount, resolvedOutputFile };
}

// ── Sequence log helper ───────────────────────────────────────────────────────

/**
 * Append a markdown entry to the sequence run log.
 * Does NOT rebuild the file tree — kept lightweight for frequent calls.
 * Silently skips if no directory is open.
 */
async function _seqAppendLog(logPath, entry) {
  const rootHandle = useEditorStore.getState().directoryHandle;
  if (!rootHandle) return;

  const parts = logPath.split('/').filter(Boolean);
  const filename = parts.pop();
  if (!filename) return;

  let dirHandle = rootHandle;
  for (const part of parts) {
    dirHandle = await dirHandle.getDirectoryHandle(part, { create: true });
  }

  let existing = '';
  try {
    const fh = await dirHandle.getFileHandle(filename, { create: false });
    existing = await (await fh.getFile()).text();
  } catch { /* file doesn't exist yet */ }

  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(existing + entry);
  await writable.close();
}

function _seqLogPath(sequenceName) {
  const safe = sequenceName.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
  return `logs/${safe}_log.md`;
}

function _logTs() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the active book project's FileSystemDirectoryHandle.
 *
 * Priority:
 *  1. directoryHandle already open in editor store (and activeMode is 'book')
 *  2. activeBookProject name + arcwriteHandle → reconstruct the handle
 *  3. Last resort: create/activate 'Untitled Project'
 *
 * This prevents the app from creating a new "Untitled Project" when the user
 * is on a non-Editor page (Analyze, Scaffold) with a book project already open.
 */
async function resolveBookProjectHandle() {
  const projectStore = useProjectStore.getState();
  const editorHandle = useEditorStore.getState().directoryHandle;

  // Best case: editor already has the book directory open
  if (editorHandle && projectStore.activeMode === 'book') {
    return editorHandle;
  }

  // Good case: we know the active project name — reconstruct from arcwriteHandle
  if (projectStore.activeBookProject && projectStore.arcwriteHandle) {
    try {
      const projectsDir = await projectStore.arcwriteHandle.getDirectoryHandle('projects');
      const booksDir = await projectsDir.getDirectoryHandle('books');
      const bookHandle = await booksDir.getDirectoryHandle(projectStore.activeBookProject);
      // Restore into editor store so future calls find it immediately
      useEditorStore.getState().setDirectoryHandle(bookHandle);
      return bookHandle;
    } catch (e) {
      console.warn('[resolveBookProjectHandle] Could not reconstruct handle for',
        projectStore.activeBookProject, e.message);
    }
  }

  throw new Error('No book project is active.');
}

// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_HANDLERS = {
  // --- Read-only state getters ---
  getGenreConfig: () => {
    const state = useAppStore.getState();
    const genre = genreSystem[state.selectedGenre];
    const subgenre = genre?.subgenres[state.selectedSubgenre];
    const structure = plotStructures[genre?.structure];
    const config = {
      genre: { key: state.selectedGenre, name: genre?.name },
      subgenre: { key: state.selectedSubgenre, name: subgenre?.name },
      modifier: state.selectedModifier || null,
      pacing: state.selectedPacing || null,
      plotStructure: { key: genre?.structure, name: structure?.name },
      blend: state.blendEnabled
        ? { enabled: true, ratio: state.blendRatio, secondaryGenre: state.secondaryGenre, secondarySubgenre: state.secondarySubgenre }
        : { enabled: false },
    };
    if (subgenre?.requirements) {
      config.requirements = {
        finalIntimacy: subgenre.requirements.finalIntimacy,
        finalTrust: subgenre.requirements.finalTrust,
        finalTension: subgenre.requirements.finalTension,
      };
    }
    return JSON.stringify(config, null, 2);
  },

  getAvailableGenres: () => {
    const catalog = {};
    for (const [key, g] of Object.entries(genreSystem)) {
      catalog[key] = {
        name: g.name,
        structure: g.structure,
        subgenres: Object.fromEntries(
          Object.entries(g.subgenres).map(([sk, s]) => [sk, s.name])
        ),
      };
    }
    return JSON.stringify(catalog, null, 2);
  },

  getWeights: () => {
    const { weights } = useAppStore.getState();
    return JSON.stringify(
      Object.fromEntries(WEIGHT_KEYS.map((k) => [k, weights[k]?.toFixed(2) ?? 'N/A'])),
      null, 2
    );
  },

  getDimensions: () => {
    return JSON.stringify(
      Object.fromEntries(
        DIMENSION_KEYS.map((k) => [k, { name: dimensions[k].name, range: dimensions[k].range }])
      ),
      null, 2
    );
  },

  getPlotStructure: () => {
    const state = useAppStore.getState();
    const genre = genreSystem[state.selectedGenre];
    const structure = plotStructures[genre?.structure];
    return JSON.stringify({
      current: {
        key: genre?.structure,
        name: structure?.name,
        beats: structure?.beats
          ? Object.fromEntries(
              Object.entries(structure.beats).map(([k, b]) => [k, { name: b.name, range: b.range }])
            )
          : {},
      },
      available: Object.fromEntries(
        Object.entries(allStructures).map(([k, s]) => [k, s.name])
      ),
    }, null, 2);
  },

  getScaffoldBeats: () => {
    const state = useAppStore.getState();
    const { scaffoldBeats } = state;
    if (scaffoldBeats.length === 0) return JSON.stringify({ beats: [], count: 0 });
    const genre = genreSystem[state.selectedGenre];
    const structure = plotStructures[genre?.structure];
    const beats = scaffoldBeats.map((beat, i) => ({
      index: i + 1,
      id: beat.id,
      label: beat.label || 'Untitled',
      time: beat.time,
      beatType: beat.beat,
      beatName: structure?.beats?.[beat.beat]?.name || beat.beat || '',
      dimensions: Object.fromEntries(DIMENSION_KEYS.map((k) => [k, beat[k] ?? 0])),
    }));
    return JSON.stringify({ beats, count: beats.length }, null, 2);
  },

  getChapters: () => {
    const { chapters } = useAppStore.getState();
    if (chapters.length === 0) return JSON.stringify({ chapters: [], count: 0 });
    const result = chapters.map((ch, i) => {
      const scores = ch.userScores || ch.aiScores;
      const wordCount = ch.text ? ch.text.split(/\s+/).length : 0;
      const entry = {
        index: i + 1,
        id: ch.id,
        title: ch.title || 'Untitled',
        wordCount,
        status: ch.status || 'pending',
      };
      if (scores) {
        entry.dimensions = Object.fromEntries(
          DIMENSION_KEYS.map((k) => [k, scores[k] != null ? scores[k] : null])
        );
        if (scores.timePercent != null) entry.timePercent = scores.timePercent;
        if (scores.beat) entry.beat = scores.beat;
      }
      return entry;
    });
    return JSON.stringify({ chapters: result, count: result.length }, null, 2);
  },

  getRevisionChecklist: () => {
    const { revisionItems } = useAppStore.getState();
    if (revisionItems.length === 0) return JSON.stringify({ items: [], count: 0, checkedCount: 0 });
    const items = revisionItems.map((item) => ({
      id: item.id,
      recommendation: item.recommendation || item.text || item.id,
      checked: item.checked,
    }));
    const checkedCount = items.filter((i) => i.checked).length;
    return JSON.stringify({ items, count: items.length, checkedCount }, null, 2);
  },

  getEditorContents: () => {
    const editorState = useEditorStore.getState();
    const activeTab = editorState.tabs.find((t) => t.id === editorState.activeTabId);
    const secondaryTab = editorState.dualPane
      ? editorState.tabs.find((t) => t.id === editorState.secondaryTabId)
      : null;
    const result = {
      dualPane: editorState.dualPane,
      primaryPane: null,
      secondaryPane: null,
      allOpenTabs: editorState.tabs.map((t) => ({ id: t.id, title: t.title })),
      directory: editorState.directoryHandle?.name || null,
    };
    if (activeTab) {
      const words = activeTab.content ? activeTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
      result.primaryPane = { tabId: activeTab.id, title: activeTab.title, dirty: !!activeTab.dirty, wordCount: words, content: activeTab.content || '' };
    }
    if (secondaryTab) {
      const words = secondaryTab.content ? secondaryTab.content.trim().split(/\s+/).filter(Boolean).length : 0;
      result.secondaryPane = { tabId: secondaryTab.id, title: secondaryTab.title, dirty: !!secondaryTab.dirty, wordCount: words, content: secondaryTab.content || '' };
    }
    return JSON.stringify(result, null, 2);
  },

  getSystemPrompts: ({ name } = {}) => {
    const editorState = useEditorStore.getState();
    const appState = useAppStore.getState();
    const genre = genreSystem[appState.selectedGenre];
    const genreName = genre?.name || appState.selectedGenre || 'General Fiction';
    const subgenreName = genre?.subgenres[appState.selectedSubgenre]?.name || appState.selectedSubgenre || 'General';
    const structureName = appState.plotStructure || 'threeAct';

    const promptBuilders = {
      // --- Analysis & Scoring ---
      scoring: { label: 'Analysis: Chapter Scoring', build: () => buildScoringSystemPrompt(genreName, subgenreName, structureName) },
      getwell: { label: 'Analysis: Get-Well Plan (Editorial)', build: () => buildGetWellSystemPrompt(genreName, subgenreName) },
      revision: { label: 'Revision System Prompt', build: () => buildRevisionSystemPrompt(genreName, subgenreName) },
      revisionUser: { label: 'Revision User Prompt (template)', build: () => buildRevisionUserPrompt('(chapter text)', 'custom', null) },
      // --- Chat modes ---
      chat: { label: 'Chat System Prompt (Full Context)', build: () => buildChatSystemPrompt('/edit', { nativeToolsActive: true }) },
      orchestrator: { label: 'Chat: Orchestrator Mode', build: () => buildEditModePrompt('orchestrator', editorState) },
      editor: { label: 'Chat: Line Editor Mode', build: () => buildEditModePrompt('editor', editorState) },
      writer: { label: 'Chat: Writing Partner Mode', build: () => buildEditModePrompt('writer', editorState) },
      critic: { label: 'Chat: Critic Mode', build: () => buildEditModePrompt('critic', editorState) },
      comparator: { label: 'Chat: Version Compare Mode', build: () => buildEditModePrompt('comparator', editorState) },
      // --- Operational ---
      sequence: { label: 'Sequence Step Prompt', build: () => buildSequenceStepSystemPrompt() },
      inlineEdit: { label: 'Inline Edit Prompt', build: () => 'You are an inline text editor. The user has selected a passage and given you an editing instruction.\n\nRULES:\n1. Output ONLY the revised text. No preamble, no explanation, no markdown code fences.\n2. Preserve the author\'s voice, style, tone, and register.\n3. Apply the instruction precisely — nothing more, nothing less.\n4. If the instruction is to rewrite or rephrase, keep approximately the same length unless told otherwise.\n5. Maintain any existing formatting (bold, italic, etc.) where appropriate.\n6. Never add commentary like "Here is the revised text:" — just output the text directly.' },
      voiceAnalysis: { label: 'Voice Analysis Prompt', build: () => 'You are a literary voice analyst. Analyze the provided prose sample and produce a structured voice style guide that an AI writing model can use as a reference to match this author\'s voice.\n\nOutput a markdown document with these sections:\n## Voice Signature\n## Sentence Rhythm\n## Internal Voice\n## What Draws Reader In\n## Dialogue\n## Sentence-Level Patterns\n## What to Avoid' },
      // --- AI Project ---
      aiProject: { label: 'AI Project System Prompt', build: () => {
        const { activeAiProject } = useProjectStore.getState();
        return activeAiProject ? buildAiProjectSystemPrompt(activeAiProject, editorState, '/edit') : '(No AI project active — activate one to see its prompt)';
      }},
    };

    if (!name || name === 'all') {
      const summary = Object.entries(promptBuilders).map(([key, { label, build }]) => {
        try {
          const text = build();
          return { key, label, length: text.length };
        } catch {
          return { key, label, length: 0, note: 'error building prompt' };
        }
      });
      return JSON.stringify(summary, null, 2);
    }

    const entry = promptBuilders[name];
    if (!entry) return JSON.stringify({ error: `Unknown prompt: "${name}". Available: ${Object.keys(promptBuilders).join(', ')}` });
    return entry.build();
  },

  // --- Scaffold ---
  updateBeat: ({ id, updates }) => {
    useAppStore.getState().updateBeat(id, updates);
    const fields = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ');
    return `Updated beat ${id}: ${fields}`;
  },
  addBeat: ({ beat }) => {
    useAppStore.getState().addBeat(beat);
    return `Added beat "${beat.label || 'untitled'}" at ${beat.time}%`;
  },
  removeBeat: ({ id }) => {
    useAppStore.getState().removeBeat(id);
    return `Removed beat ${id}`;
  },
  clearScaffold: () => {
    useAppStore.getState().clearScaffold();
    return 'Cleared all scaffold beats';
  },

  // --- Genre config ---
  setGenre: ({ genre }) => {
    useAppStore.getState().setGenre(genre);
    return `Changed genre to ${genre}`;
  },
  setSubgenre: ({ subgenre }) => {
    useAppStore.getState().setSubgenre(subgenre);
    return `Changed subgenre to ${subgenre}`;
  },
  setModifier: ({ modifier }) => {
    useAppStore.getState().setModifier(modifier);
    return modifier ? `Set modifier to ${modifier}` : 'Cleared modifier';
  },
  setPacing: ({ pacing }) => {
    useAppStore.getState().setPacing(pacing);
    return pacing ? `Set pacing to ${pacing}` : 'Cleared pacing';
  },
  updateWeight: ({ key, value }) => {
    useAppStore.getState().updateWeight(key, value);
    return `Updated weight ${key} to ${value}`;
  },
  resetWeights: () => {
    useAppStore.getState().resetWeights();
    return 'Reset weights to genre defaults';
  },

  // --- Blending ---
  setBlendEnabled: ({ enabled }) => {
    useAppStore.getState().setBlendEnabled(enabled);
    return enabled ? 'Enabled genre blending' : 'Disabled genre blending';
  },
  setSecondaryGenre: ({ genre }) => {
    useAppStore.getState().setSecondaryGenre(genre);
    return `Set secondary genre to ${genre}`;
  },
  setSecondarySubgenre: ({ subgenre }) => {
    useAppStore.getState().setSecondarySubgenre(subgenre);
    return `Set secondary subgenre to ${subgenre}`;
  },
  setBlendRatio: ({ ratio }) => {
    useAppStore.getState().setBlendRatio(ratio);
    return `Set blend ratio to ${ratio}%`;
  },

  // --- Analysis ---
  updateChapterScores: ({ chapterId, scores }) => {
    useAppStore.getState().updateChapterScores(chapterId, scores, 'user');
    return `Updated scores for chapter ${chapterId}`;
  },
  removeChapter: ({ id }) => {
    useAppStore.getState().removeChapter(id);
    return `Removed chapter ${id}`;
  },
  setProjectionPercent: ({ percent }) => {
    useAppStore.getState().setProjectionPercent(percent);
    return `Set projection to ${percent}%`;
  },

  // --- Visibility ---
  toggleDimension: ({ dim }) => {
    useAppStore.getState().toggleDimension(dim);
    return `Toggled ${dim} visibility`;
  },

  // --- Edit workflow ---
  writeFile: async ({ path, content }) => {
    const editorState = useEditorStore.getState();
    const rootHandle = editorState.directoryHandle;
    if (!rootHandle) throw new Error('No directory open in the editor');
    if (!path || !content) throw new Error('path and content are required');

    // Walk subdirectories to get parent, creating as needed
    const parts = path.split('/').filter(Boolean);
    const filename = parts.pop();
    if (!filename) throw new Error('Invalid file path');
    // After pop(), parts contains the directory path components
    let dirHandle = rootHandle;
    for (const part of parts) {
      dirHandle = await dirHandle.getDirectoryHandle(part, { create: true });
    }

    // Create and write the file
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Refresh file tree
    const tree = await buildFileTree(rootHandle);
    useEditorStore.getState().setFileTree(tree);

    const newTabId = path;
    const words = content.trim().split(/\s+/).filter(Boolean).length;

    // Detect versioned rewrite: basename-vNN.ext (2+ digit version number)
    // When detected, find the original and open both in dual-pane diff view
    const versionMatch = filename.match(/^(.*?)-v(\d{2,})(\.[^.]+)?$/i);
    if (versionMatch) {
      const base = versionMatch[1];
      const vNum = parseInt(versionMatch[2], 10);
      const ext = versionMatch[3] || '';

      // Candidate originals: bare basename first, then v(N-1)
      const candidates = [`${base}${ext}`];
      if (vNum > 2) {
        candidates.push(`${base}-v${String(vNum - 1).padStart(2, '0')}${ext}`);
      }

      let originalFilename = null;
      let originalHandle = null;
      let originalContent = null;

      for (const candidate of candidates) {
        try {
          const fh = await dirHandle.getFileHandle(candidate);
          const file = await fh.getFile();
          originalContent = await file.text();
          originalFilename = candidate;
          originalHandle = fh;
          break;
        } catch (_) { /* not found, try next */ }
      }

      if (originalFilename !== null) {
        const origTabId = parts.length > 0 ? `${parts.join('/')}/${originalFilename}` : originalFilename;
        const currentTabs = useEditorStore.getState().tabs;
        const tabsUpdate = [...currentTabs];
        if (!currentTabs.find((t) => t.id === origTabId)) {
          tabsUpdate.push({ id: origTabId, title: originalFilename, content: originalContent, dirty: false, fileHandle: originalHandle });
        }
        if (!currentTabs.find((t) => t.id === newTabId)) {
          tabsUpdate.push({ id: newTabId, title: filename, content, dirty: false, fileHandle });
        }
        useEditorStore.setState({
          tabs: tabsUpdate,
          activeTabId: origTabId,
          secondaryTabId: newTabId,
          dualPane: true,
          diffMode: true,
        });
        return `Created "${path}" (${words} words). Left pane: "${originalFilename}" | Right pane: "${filename}" — diff view enabled.`;
      }
    }

    // Non-versioned (or no original found): existing behavior
    const { dualPane } = useEditorStore.getState();
    if (dualPane) {
      const tabs = useEditorStore.getState().tabs;
      const existing = tabs.find((t) => t.id === newTabId);
      if (existing) {
        useEditorStore.getState().setSecondaryTab(newTabId);
      } else {
        useEditorStore.setState((s) => ({
          tabs: [...s.tabs, { id: newTabId, title: filename, content, dirty: false, fileHandle }],
          secondaryTabId: newTabId,
        }));
      }
    } else {
      useEditorStore.getState().openTab(newTabId, filename, content, fileHandle);
    }

    return `Created "${path}" (${words} words) and opened in editor`;
  },

  // --- AI Project file access ---
  readProjectFile: async ({ path }) => {
    if (!path) throw new Error('path is required');

    // Normalize: strip leading "Arcwrite/" prefix (AI models often add it)
    const cleanPath = path.replace(/^Arcwrite\//i, '');

    // Helper to read and format result
    const formatResult = (content, label) => {
      const words = content.trim().split(/\s+/).filter(Boolean).length;
      return `File "${label}" (${words} words):\n\n${content}`;
    };

    // Try 0: Check active AI project's file catalog for cached content
    // The AI may pass a title, path, or filename — match flexibly
    const { arcwriteHandle, activeAiProject, skillFolderHandles } = useProjectStore.getState();
    if (activeAiProject?.files) {
      const match = activeAiProject.files.find((f) => {
        const q = cleanPath.toLowerCase();
        return (f.path && f.path.toLowerCase() === q) ||
               (f.title && f.title.toLowerCase() === q) ||
               (f.path && f.path.toLowerCase().endsWith('/' + q)) ||
               (f.title && (f.title.toLowerCase() + '.md') === q) ||
               (f.path && f.path.split('/').pop().toLowerCase() === q);
      });
      if (match) {
        // Serve from cached content if available
        if (match.cachedContent) {
          return formatResult(match.cachedContent, match.title || match.path);
        }
        // Otherwise try reading with the stored path (strip legacy "Arcwrite/" prefix if present)
        if (arcwriteHandle && match.path) {
          try {
            const content = await readFileByPath(arcwriteHandle, match.path.replace(/^Arcwrite\//i, ''));
            return formatResult(content, match.title || match.path);
          } catch (_) { /* fall through */ }
        }
      }
    }

    // Try 0.5: Read from skill folder handles (relative path resolution)
    if (skillFolderHandles && Object.keys(skillFolderHandles).length > 0) {
      for (const handle of Object.values(skillFolderHandles)) {
        try {
          const content = await readFileByPath(handle, cleanPath);
          return formatResult(content, cleanPath);
        } catch (_) { /* try next handle */ }
      }
    }

    // Try 1: Read from Arcwrite storage root
    if (arcwriteHandle) {
      try {
        const content = await readFileByPath(arcwriteHandle, cleanPath);
        return formatResult(content, cleanPath);
      } catch (_) { /* fall through */ }
    }

    // Try 1.5: Book files live inside a same-named folder
    // e.g. "projects/books/My-Book.md" → "projects/books/My-Book/My-Book.md"
    if (arcwriteHandle && cleanPath.startsWith('projects/books/')) {
      const filename = cleanPath.split('/').pop();
      const stem = filename.replace(/\.[^.]+$/, '');
      const nestedPath = `projects/books/${stem}/${filename}`;
      if (nestedPath !== cleanPath) {
        try {
          const content = await readFileByPath(arcwriteHandle, nestedPath);
          return formatResult(content, filename);
        } catch (_) { /* fall through */ }
      }
    }

    // Try 2: Read from the editor's open directory (for book chapter files)
    const editorHandle = useEditorStore.getState().directoryHandle;
    if (editorHandle) {
      try {
        const content = await readFileByPath(editorHandle, cleanPath);
        return formatResult(content, cleanPath);
      } catch (_) { /* fall through */ }
    }

    // Try 3: Bare filename lookup in editor directory (AI may omit subdirs)
    if (editorHandle && !cleanPath.includes('/')) {
      try {
        // Search one level of subdirectories for the filename
        for await (const [name, handle] of editorHandle.entries()) {
          if (handle.kind === 'directory') {
            try {
              const fh = await handle.getFileHandle(cleanPath);
              const file = await fh.getFile();
              const content = await file.text();
              return formatResult(content, `${name}/${cleanPath}`);
            } catch (_) { /* not in this subdir */ }
          }
        }
        // Try root level
        const fh = await editorHandle.getFileHandle(cleanPath);
        const file = await fh.getFile();
        return formatResult(await file.text(), cleanPath);
      } catch (_) { /* fall through */ }
    }

    throw new Error(`File not found: ${path}`);
  },

  // --- Artifacts ---
  writeArtifact: async ({ filename, content, metadata }) => {
    if (!filename) throw new Error('filename is required');
    if (!content) throw new Error('content is required');

    // Sanitize filename — flat names only, no path separators
    const cleanFilename = filename.replace(/[/\\]/g, '').trim();
    if (!cleanFilename) throw new Error('Invalid filename');

    // 1. Get or create a book project
    const bookProjectHandle = await resolveBookProjectHandle();

    // 2. Get/create artifacts/ directory
    const artifactsDir = await bookProjectHandle.getDirectoryHandle('artifacts', { create: true });

    // 3. Write the file
    const fileHandle = await artifactsDir.getFileHandle(cleanFilename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // 4. Read/update manifest
    let manifest;
    try {
      manifest = await readJsonFile(artifactsDir, 'manifest.json');
    } catch (_) {
      manifest = null;
    }
    if (!manifest || !manifest.files) {
      manifest = { files: [] };
    }

    // Remove existing entry with same filename (overwrite case)
    manifest.files = manifest.files.filter((f) => f.name !== cleanFilename);

    // Append new entry
    manifest.files.push({
      name: cleanFilename,
      type: metadata?.type || 'document',
      description: metadata?.description || '',
      created: new Date().toISOString(),
      source: metadata?.source || 'chat',
    });

    await writeJsonFile(artifactsDir, 'manifest.json', manifest);

    // 5. Refresh file tree in editor
    const tree = await buildFileTree(bookProjectHandle);
    useEditorStore.getState().setFileTree(tree);

    // 6. Open file in editor
    const tabId = `artifacts/${cleanFilename}`;
    const { dualPane } = useEditorStore.getState();
    if (dualPane) {
      const tabs = useEditorStore.getState().tabs;
      const existingTab = tabs.find((t) => t.id === tabId);
      if (existingTab) {
        useEditorStore.getState().setSecondaryTab(tabId);
      } else {
        useEditorStore.setState((s) => ({
          tabs: [...s.tabs, { id: tabId, title: cleanFilename, content, dirty: false, fileHandle }],
          secondaryTabId: tabId,
        }));
      }
    } else {
      useEditorStore.getState().openTab(tabId, cleanFilename, content, fileHandle);
    }

    // 7. Return short summary (NOT the full content)
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return `Wrote "${cleanFilename}" to artifacts (${words.toLocaleString()} words). File opened in editor.`;
  },

  listArtifacts: async () => {
    const bookProjectHandle = useEditorStore.getState().directoryHandle;
    const projectStore = useProjectStore.getState();

    if (!bookProjectHandle || projectStore.activeMode !== 'book') {
      return 'No artifacts yet. No book project is active.';
    }

    try {
      const artifactsDir = await bookProjectHandle.getDirectoryHandle('artifacts');
      const manifest = await readJsonFile(artifactsDir, 'manifest.json');
      if (!manifest || !manifest.files || manifest.files.length === 0) {
        return 'No artifacts yet.';
      }
      return JSON.stringify(manifest, null, 2);
    } catch (e) {
      if (e.name === 'NotFoundError') {
        return 'No artifacts yet.';
      }
      throw e;
    }
  },

  // --- Image generation ---
  generateImage: async ({ prompt, filename, size }) => {
    if (!prompt) throw new Error('prompt is required');
    if (!filename) throw new Error('filename is required');

    const cleanFilename = filename.endsWith('.png') ? filename : `${filename}.png`;

    const { generateImage: callImageApi } = await import('../api/imageGeneration');
    const { registerBlob } = await import('../services/blobRegistry');

    // 1. Call the image generation API
    const result = await callImageApi(prompt, { size });

    // 2. Decode base64 to binary blob
    const binaryString = atob(result.b64_json);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    // 3. Save to active book project; fall back to Arcwrite root if none is open
    let imageParentHandle;
    let isBookProject = false;
    try {
      imageParentHandle = await resolveBookProjectHandle();
      isBookProject = true;
    } catch (_) {
      const { arcwriteHandle } = useProjectStore.getState();
      if (!arcwriteHandle) throw new Error('No storage folder connected. Click the folder icon to open your Arcwrite folder.');
      imageParentHandle = arcwriteHandle;
    }

    // 4. Write binary blob to images/
    const imagesDir = await imageParentHandle.getDirectoryHandle('images', { create: true });
    const fileHandle = await imagesDir.getFileHandle(cleanFilename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // 5. Register blob URL for rendering
    const artifactPath = `images/${cleanFilename}`;
    const blobUrl = registerBlob(artifactPath, blob);

    // 6. Refresh file tree only for book projects — don't overwrite the tree with Arcwrite root contents
    if (isBookProject) {
      const tree = await buildFileTree(imageParentHandle);
      useEditorStore.getState().setFileTree(tree);
    }

    // 8. Post image preview to chat
    const chatStore = useChatStore.getState();
    chatStore.addMessage({
      id: `img_${Date.now()}`,
      role: 'assistant',
      content: `Generated: **${cleanFilename}**`,
      timestamp: Date.now(),
      imageArtifact: {
        path: artifactPath,
        blobUrl,
        prompt: result.revised_prompt || prompt,
        filename: cleanFilename,
      },
    });

    const sizeKb = Math.round(blob.size / 1024);
    return `Generated image "${cleanFilename}" (${sizeKb} KB) and saved to images/.${result.revised_prompt ? ` Revised prompt: "${result.revised_prompt}"` : ''}`;
  },

  // --- Orchestrator / Multi-agent ---
  listAgents: async () => {
    const { aiProjects } = useProjectStore.getState();
    const agents = aiProjects.map((p) => {
      const hasSkill = p.files?.some(
        (f) => f.type === 'folder' && (f.includeMode === 'skill' || f.cachedContent)
      ) || false;
      return {
        id: p.name,
        name: p.name,
        description: p.description || '(no description)',
        isSkill: hasSkill,
        hasFiles: (p.files?.length || 0) > 0,
        fileCount: p.files?.length || 0,
      };
    });
    return JSON.stringify({ agents }, null, 2);
  },

  readAgentDefinition: async ({ agentId }) => {
    if (!agentId) throw new Error('agentId is required');
    const { aiProjects } = useProjectStore.getState();
    const project = aiProjects.find((p) => p.name.toLowerCase() === agentId.toLowerCase());
    if (!project) {
      const names = aiProjects.map((p) => p.name).join(', ');
      throw new Error(`Agent not found: ${agentId}. Available: ${names}`);
    }
    const parts = [];
    if (project.systemPrompt?.trim()) {
      parts.push(`## System Prompt\n\n${project.systemPrompt.trim()}`);
    }
    if (project.files?.length) {
      const fileList = project.files.map((f) => {
        const tag = f.includeMode === 'skill' || (f.type === 'folder' && f.cachedContent) ? ' [skill folder]' : '';
        return `- ${f.title || f.path}${tag}`;
      }).join('\n');
      parts.push(`## Attached Files\n\n${fileList}`);
    }
    if (parts.length === 0) return `Agent "${project.name}" has no definition content.`;
    return parts.join('\n\n');
  },

  listPromptTools: async () => {
    const prompts = usePromptStore.getState().getAllPrompts();
    const tools = prompts.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '(no description)',
      hasModelOverride: !!(p.provider || p.model),
      provider: p.provider || null,
      model: p.model || null,
      templateVariables: extractTemplateVariables(p.template || ''),
    }));
    return JSON.stringify({ promptTools: tools }, null, 2);
  },

  spawnAgent: async ({ agentId, task, inputs, provider, model }) => {
    if (!agentId) throw new Error('agentId is required');
    if (!task) throw new Error('task is required');

    // Find the AI project (case-insensitive match)
    const { aiProjects } = useProjectStore.getState();
    const agentIdLower = agentId.toLowerCase();
    const agent = aiProjects.find((p) => p.name.toLowerCase() === agentIdLower);
    if (!agent) throw new Error(`Agent not found: ${agentId}. Available agents: ${aiProjects.map(p => p.name).join(', ')}`);

    // Build the agent's system prompt with its file context
    const editorState = useEditorStore.getState();
    let systemPrompt = buildAiProjectSystemPrompt(agent, editorState, '/edit');

    // Add orchestrator context bridge if inputs provided
    if (inputs && Object.keys(inputs).length > 0) {
      systemPrompt += `\n\n## Context from Orchestrator\n${JSON.stringify(inputs, null, 2)}`;
    }

    // Build the task message
    const userMessage = `TASK: ${task}`;

    // Make the call (cross-provider if specified)
    const targetProvider = provider || useAppStore.getState().activeProvider;
    const response = await callCompletionWithProvider(targetProvider, systemPrompt, userMessage, {
      model,
      maxTokens: 4096,
    });

    const words = response.trim().split(/\s+/).filter(Boolean).length;
    return `Agent "${agentId}" completed task (${words} words):\n\n${response}`;
  },

  runPrompt: async ({ promptId, inputs, provider, model }) => {
    if (!promptId) throw new Error('promptId is required');

    // Find the prompt
    const prompts = usePromptStore.getState().getAllPrompts();
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) throw new Error(`Prompt not found: ${promptId}`);

    // Fill template variables
    let filledTemplate = prompt.template || '';
    const vars = inputs || {};
    for (const [key, value] of Object.entries(vars)) {
      filledTemplate = filledTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // Remove unfilled template variables
    filledTemplate = filledTemplate.replace(/\{\{[^}]+\}\}/g, '');

    // Determine provider/model (prompt override > call override > active)
    const targetProvider = provider || prompt.provider || useAppStore.getState().activeProvider;
    const targetModel = model || prompt.model || null;

    // Make the call
    const response = await callCompletionWithProvider(targetProvider, '', filledTemplate, {
      model: targetModel,
      maxTokens: 4096,
    });

    const words = response.trim().split(/\s+/).filter(Boolean).length;
    return `Prompt "${prompt.name}" completed (${words} words):\n\n${response}`;
  },
  // --- Named Sequences ---
  listSequences: async () => {
    const seqs = useSequenceStore.getState().getAllSequences();
    return JSON.stringify(seqs.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      steps: (s.steps || []).map((step) => ({
        id: step.id,
        type: step.type || 'action',
        name: step.name || step.outputFile || '',
        outputFile: step.outputFile || null,
        template: step.template || null,
        promptRef: step.promptRef || null,
        chain: step.chain || false,
        modelOverride: step.modelOverride || null,
        ...(step.type === 'condition' ? { ifYes: step.ifYes, ifNo: step.ifNo } : {}),
        ...(step.type === 'loop' ? { count: step.count, maxIterations: step.maxIterations, iterations: step.iterations } : {}),
      })),
    })), null, 2);
  },

  createSequence: async ({ name, description, steps }) => {
    if (!name?.trim()) throw new Error('createSequence: name is required');
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('createSequence: steps array is required');

    // Assign IDs to any steps missing them
    const stepsWithIds = steps.map((s, i) => ({
      ...s,
      id: s.id || `step_${Date.now()}_${i}`,
    }));

    const seq = await useSequenceStore.getState().createSequence({
      name: name.trim(),
      description: (description || '').trim(),
      steps: stepsWithIds,
    });

    if (!seq) throw new Error('Failed to save sequence — is a project folder connected?');
    return `Sequence "${seq.name}" saved with ${stepsWithIds.length} step(s). ID: ${seq.id}`;
  },

  runNamedSequence: async ({ sequenceId, userInputs }) => {
    if (!sequenceId) throw new Error('sequenceId is required');

    const sequences = useSequenceStore.getState().getAllSequences();
    const sequence = sequences.find((s) => s.id === sequenceId);
    if (!sequence) throw new Error(`Sequence not found: ${sequenceId}`);
    if (!sequence.steps || sequence.steps.length === 0) {
      throw new Error(`Sequence "${sequence.name}" has no steps`);
    }

    const chatStore = useChatStore.getState();
    const app = useAppStore.getState();
    const prompts = usePromptStore.getState().getAllPrompts();
    const systemPrompt = buildSequenceStepSystemPrompt();

    const stepStatuses = sequence.steps.map(_seqInitStatus);
    const logPath = _seqLogPath(sequence.name);
    await _seqAppendLog(logPath,
      `# ${sequence.name} — Sequence Log\nStarted: ${_logTs()}\n\n`
    );

    // Snapshot stepStatuses for setRunningSequence (spreads loop iterations to avoid mutation aliasing)
    const _snapshot = () => stepStatuses.map((s) =>
      s.type === 'loop' ? { ...s, iterations: [...(s.iterations || [])] } : { ...s }
    );

    const _updateRunning = (currentStep) => {
      useSequenceStore.getState().setRunningSequence({
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        currentStep,
        totalSteps: sequence.steps.length,
        steps: _snapshot(),
      });
    };

    _updateRunning(0);

    const ctx = {
      userInputs,
      chainedContext: null,
      loopIndex: 0,
      loopCount: null,
      sequence,
      chatStore,
      systemPrompt,
      app,
      prompts,
    };

    const results = [];

    try {
      let i = 0;
      const retries = {};

      while (i < sequence.steps.length) {
        const step = sequence.steps[i];
        const type = step.type || 'action';
        let outcome = 'continue';

        stepStatuses[i] = { ...stepStatuses[i], status: 'running' };
        _updateRunning(i + 1);

        // ── Action step ──────────────────────────────────────────────────────
        if (type === 'action') {
          const { wordCount, resolvedOutputFile } = await _seqRunActionBody(step, ctx);
          stepStatuses[i] = { ...stepStatuses[i], status: 'done', wordCount, outputFile: resolvedOutputFile };
          _updateRunning(i + 1);
          results.push({ step: step.name || step.outputFile || `Step ${i + 1}`, outputFile: resolvedOutputFile, wordCount });
          await _seqAppendLog(logPath,
            `## ${_logTs()} — ${step.name || `Step ${i + 1}`}\n` +
            (resolvedOutputFile ? `Output: \`${resolvedOutputFile}\`  \n` : '') +
            `Words: ${wordCount.toLocaleString()}\n\n`
          );

        // ── Condition step ───────────────────────────────────────────────────
        } else if (type === 'condition') {
          const condName = step.name || `Condition ${i + 1}`;
          let question = step.template || '';
          if (ctx.chainedContext) question = question.replace(/\{\{chained_context\}\}/g, ctx.chainedContext);
          question = question.replace(/\{\{[^}]+\}\}/g, '').trim();

          let decision = 'no question → continuing';
          if (question) {
            const answer = await callCompletionWithProvider(
              app.activeProvider,
              'You are evaluating a writing condition. Answer with only YES or NO.',
              question,
              { maxTokens: 10 }
            );
            const isYes = /^yes/i.test(answer.trim());
            outcome = isYes ? (step.ifYes || 'continue') : (step.ifNo || 'end');
            decision = `${isYes ? 'YES' : 'NO'} → ${outcome}`;
          }

          stepStatuses[i] = { ...stepStatuses[i], status: 'done', decision };
          _updateRunning(i + 1);
          chatStore.addMessage({
            id: `seq_cond_${Date.now()}`,
            role: 'assistant',
            content: `_"${condName}": ${decision}_`,
            timestamp: Date.now(),
          });
          await _seqAppendLog(logPath,
            `## ${_logTs()} — ${condName} [condition]\nDecision: ${decision}\n\n`
          );

        // ── Loop step ────────────────────────────────────────────────────────
        } else if (type === 'loop') {
          const fixedCount = step.count ?? null;
          const maxIter = step.count ?? (step.maxIterations ?? 20);

          stepStatuses[i] = { ...stepStatuses[i], status: 'running', totalIterations: fixedCount, iterations: [] };
          _updateRunning(i + 1);

          let iterChainedCtx = ctx.chainedContext;
          let exitLoop = false;

          for (let iter = 0; iter < maxIter && !exitLoop; iter++) {
            const iterEntry = { label: `Iteration ${iter + 1}`, status: 'running', outputFile: null, wordCount: 0 };
            stepStatuses[i] = {
              ...stepStatuses[i],
              currentIteration: iter + 1,
              iterations: [...stepStatuses[i].iterations, iterEntry],
            };
            _updateRunning(i + 1);

            const iterCtx = { ...ctx, chainedContext: iterChainedCtx, loopIndex: iter, loopCount: fixedCount };
            let iterWords = 0;
            let iterFile = null;

            for (let bi = 0; bi < (step.steps?.length || 0) && !exitLoop; bi++) {
              const bodyStep = step.steps[bi];
              const btype = bodyStep.type || 'action';
              if (btype === 'action') {
                const { wordCount: bw, resolvedOutputFile: bf } = await _seqRunActionBody(bodyStep, iterCtx);
                iterWords += bw;
                if (bf) iterFile = bf;
                await _seqAppendLog(logPath,
                  `### ${_logTs()} — ${step.name || `Loop ${i + 1}`} · Iter ${iter + 1} · ${bodyStep.name || `Step ${bi + 1}`}\n` +
                  (bf ? `Output: \`${bf}\`  \n` : '') +
                  `Words: ${bw.toLocaleString()}\n\n`
                );
              } else if (btype === 'condition') {
                let q = bodyStep.template || '';
                if (iterCtx.chainedContext) q = q.replace(/\{\{chained_context\}\}/g, iterCtx.chainedContext);
                q = q.replace(/\{\{[^}]+\}\}/g, '').trim();
                if (q) {
                  const ans = await callCompletionWithProvider(
                    app.activeProvider,
                    'You are evaluating a writing condition. Answer with only YES or NO.',
                    q,
                    { maxTokens: 10 }
                  );
                  const bOutcome = /^yes/i.test(ans.trim())
                    ? (bodyStep.ifYes || 'continue')
                    : (bodyStep.ifNo || 'end');
                  if (bOutcome === 'end') exitLoop = true;
                }
              }
            }

            iterChainedCtx = iterCtx.chainedContext;
            const iterIdx = stepStatuses[i].iterations.length - 1;
            stepStatuses[i] = {
              ...stepStatuses[i],
              iterations: stepStatuses[i].iterations.map((it, ii) =>
                ii === iterIdx ? { ...it, status: 'done', wordCount: iterWords, outputFile: iterFile } : it
              ),
            };
            _updateRunning(i + 1);

            // LLM exit condition check (after each iteration, only if not already exiting)
            if (!exitLoop && step.exitTemplate && iter < maxIter - 1) {
              let exitQ = step.exitTemplate;
              if (iterCtx.chainedContext) exitQ = exitQ.replace(/\{\{chained_context\}\}/g, iterCtx.chainedContext);
              exitQ = exitQ.replace(/\{\{[^}]+\}\}/g, '').trim();
              if (exitQ) {
                const exitAns = await callCompletionWithProvider(
                  app.activeProvider,
                  'Answer with only CONTINUE or STOP.',
                  exitQ,
                  { maxTokens: 10 }
                );
                if (/^stop/i.test(exitAns.trim())) exitLoop = true;
              }
            }
          }

          if (step.chain) ctx.chainedContext = iterChainedCtx;
          stepStatuses[i] = { ...stepStatuses[i], status: 'done' };
          _updateRunning(i + 1);
        }

        // ── Retry / end handling ─────────────────────────────────────────────
        if (outcome === 'end') break;
        if (outcome === 'retry' && i > 0) {
          const key = step.id;
          retries[key] = (retries[key] || 0) + 1;
          if (retries[key] <= (step.maxRetries ?? 3)) {
            stepStatuses[i - 1] = { ...stepStatuses[i - 1], status: 'pending' };
            _updateRunning(i);
            i--;
            continue;
          }
        }

        i++;
      }
    } finally {
      setTimeout(() => useSequenceStore.getState().clearRunningSequence(), 1500);
    }

    const totalWords = results.reduce((s, r) => s + r.wordCount, 0);
    await _seqAppendLog(logPath,
      `---\n**Completed**: ${_logTs()} · ${totalWords.toLocaleString()} total words\n`
    );
    return `Sequence "${sequence.name}" complete: ${sequence.steps.length} step${sequence.steps.length !== 1 ? 's' : ''}, ${totalWords.toLocaleString()} total words.\n${
      results.map((r) => `- ${r.step}${r.outputFile ? ` → \`${r.outputFile}\`` : ''} (${r.wordCount.toLocaleString()} words)`).join('\n')
    }`;
  },

  // --- Sequence writing ---
  runSequence: async ({ steps }) => {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('runSequence: steps array is required and must not be empty');
    }

    const chatStore = useChatStore.getState();
    const app = useAppStore.getState();
    const systemPrompt = buildSequenceStepSystemPrompt();
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const { task, outputFile } = steps[i];
      if (!task || !outputFile) throw new Error(`runSequence: step ${i + 1} is missing task or outputFile`);

      const stepLabel = `${i + 1}/${steps.length}`;

      // Post "in progress" status to chat
      chatStore.addMessage({
        id: `seq_progress_${Date.now()}_${i}`,
        role: 'assistant',
        content: `_Writing step ${stepLabel}: \`${outputFile}\`…_`,
        timestamp: Date.now(),
      });

      // Fresh LLM call — minimal context, prose only
      const prose = await callCompletionWithProvider(
        app.activeProvider,
        systemPrompt,
        task,
        { maxTokens: 4096 }
      );

      // Write to disk and open in editor — reuse writeFile handler exactly
      await ACTION_HANDLERS.writeFile({ path: outputFile, content: prose });

      const wordCount = prose.trim().split(/\s+/).filter(Boolean).length;

      // Replace progress message with completion status
      chatStore.addMessage({
        id: `seq_done_${Date.now()}_${i}`,
        role: 'assistant',
        content: `**Step ${stepLabel} complete** — \`${outputFile}\` (${wordCount.toLocaleString()} words)`,
        timestamp: Date.now(),
      });

      results.push({ outputFile, wordCount });
    }

    const totalWords = results.reduce((s, r) => s + r.wordCount, 0);
    return `Sequence complete: ${steps.length} file${steps.length !== 1 ? 's' : ''} written, ${totalWords.toLocaleString()} total words.\n${
      results.map((r) => `- \`${r.outputFile}\` (${r.wordCount.toLocaleString()} words)`).join('\n')
    }`;
  },
};

/**
 * Extract template variable names from a prompt template.
 * Looks for {{variable_name}} patterns.
 */
function extractTemplateVariables(template) {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

/**
 * Execute an array of parsed action groups against the Zustand store.
 * Returns array of { success, description, type } or { success: false, error, type }.
 */
export async function executeActions(actions) {
  const results = [];
  for (const group of actions) {
    if (group.error) {
      results.push({ success: false, error: `Parse error: ${group.error}` });
      continue;
    }
    for (const action of group.data) {
      const handler = ACTION_HANDLERS[action.type];
      if (!handler) {
        results.push({ success: false, error: `Unknown action: ${action.type}`, type: action.type });
        continue;
      }
      try {
        const description = await handler(action);
        results.push({ success: true, description, type: action.type });
      } catch (e) {
        results.push({ success: false, error: e.message, type: action.type });
      }
    }
  }
  return results;
}
