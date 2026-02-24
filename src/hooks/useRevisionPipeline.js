import { useState, useRef, useCallback } from 'react';
import useEditorStore from '../store/useEditorStore';
import useAppStore from '../store/useAppStore';
import { callCompletion } from '../api/providerAdapter';
import {
  buildRevisionSystemPrompt,
  buildRevisionUserPrompt,
  matchFileToChapter,
} from '../chat/revisionPrompts';
import { buildFileTree } from '../components/edit/FilePanel';
import { genreSystem } from '../data/genreSystem';
import { dimensions, DIMENSION_KEYS } from '../data/dimensions';
import { getIdealCurve } from '../data/presetArcs';
import { interpolateAtTime } from '../engine/validation';
import { enrichDataWithTension } from '../engine/tension';
import { getModifierAdjustedWeights } from '../engine/weights';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function useRevisionPipeline() {
  const [status, setStatus] = useState('idle');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [advanceMode, setAdvanceMode] = useState('pause');
  const [errorMessage, setErrorMessage] = useState(null);

  const abortRef = useRef(false);
  const streamAccRef = useRef('');
  const pauseResolverRef = useRef(null);
  const fileQueueRef = useRef([]);
  const revisionConfigRef = useRef({ source: 'both', customPrompt: '' });
  const advanceModeRef = useRef('pause');

  // --- Find next rev number by scanning sibling files ---
  const findNextRevNumber = useCallback(async (dirHandle, baseName) => {
    const pattern = new RegExp(`^${escapeRegex(baseName)}-rev(\\d+)\\.md$`, 'i');
    let maxRev = 0;
    try {
      for await (const [name] of dirHandle.entries()) {
        const m = name.match(pattern);
        if (m) maxRev = Math.max(maxRev, parseInt(m[1], 10));
      }
    } catch {
      /* empty dir or no permission */
    }
    return maxRev + 1;
  }, []);

  // --- Build analysis data for a matched chapter ---
  const buildAnalysisData = useCallback((chapter) => {
    if (!chapter) return null;

    const app = useAppStore.getState();
    const scores = chapter.userScores || chapter.aiScores;
    if (!scores) return null;

    const idealCurve = getIdealCurve(app.selectedGenre);
    const weights = getModifierAdjustedWeights(app.weights, app.selectedModifier);
    const enrichedIdeal = enrichDataWithTension(idealCurve, weights);

    const chapterIndex = app.chapters.indexOf(chapter);
    const totalChapters = app.chapters.length;
    const timePercent =
      scores.timePercent ??
      (totalChapters > 0
        ? Math.round(((chapterIndex + 1) / totalChapters) * 100)
        : 50);

    const idealPoint = interpolateAtTime(enrichedIdeal, timePercent);

    // Lower threshold to 0.5 to catch more revision opportunities
    const gapDetails = DIMENSION_KEYS.map((k) => {
      const actual = scores[k] ?? 0;
      const ideal = idealPoint?.[k] ?? 0;
      const gap = actual - ideal;
      return {
        dimension: k,
        dimensionName: dimensions[k].name,
        actual,
        ideal,
        gap,
        absGap: Math.abs(gap),
        direction: gap > 0 ? 'reduce' : 'increase',
      };
    }).filter((g) => g.absGap >= 0.5);

    // Calculate time range for this chapter (spans from previous midpoint to next midpoint)
    const chapterStart = chapterIndex === 0
      ? 0
      : Math.round(((chapterIndex + 0.5) / totalChapters) * 100);
    const chapterEnd = chapterIndex === totalChapters - 1
      ? 100
      : Math.round(((chapterIndex + 1.5) / totalChapters) * 100);

    // Find revision items that fall within this chapter's time range
    const beatKey = scores.beat || '';
    const matchingRevItems = app.revisionItems.filter((item) => {
      // Time range match (item falls within this chapter's span)
      if (item.time >= chapterStart && item.time <= chapterEnd) return true;
      // Exact time match
      if (item.time === timePercent) return true;
      // Beat key match (normalize both to compare)
      if (beatKey && item.beat) {
        const normalizedItemBeat = item.beat.toLowerCase().replace(/[^a-z]/g, '');
        const normalizedBeatKey = beatKey.toLowerCase().replace(/[^a-z]/g, '');
        if (normalizedItemBeat.includes(normalizedBeatKey) || normalizedBeatKey.includes(normalizedItemBeat)) {
          return true;
        }
      }
      return false;
    });

    return { chapterScores: scores, idealScores: idealPoint, gapDetails, revisionItems: matchingRevItems };
  }, []);

  // --- Process a single file ---
  const processFile = useCallback(
    async (fileEntry) => {
      const editor = useEditorStore.getState();
      const app = useAppStore.getState();
      const { source, customPrompt } = revisionConfigRef.current;

      // 1. Read file content
      const file = await fileEntry.handle.getFile();
      const content = await file.text();

      // 2. Match to analyzed chapter
      const chapter = matchFileToChapter(content, fileEntry.name, app.chapters);
      const analysisData = chapter ? buildAnalysisData(chapter) : null;

      // 3. Walk to parent directory handle
      const pathParts = fileEntry.path.split('/').filter(Boolean);
      const fileName = pathParts.pop();
      let parentDirHandle = editor.directoryHandle;
      for (const part of pathParts) {
        parentDirHandle = await parentDirHandle.getDirectoryHandle(part);
      }

      // 4. Compute next rev number
      const extIdx = fileName.lastIndexOf('.');
      const baseName = extIdx > 0 ? fileName.substring(0, extIdx) : fileName;
      const revNum = await findNextRevNumber(parentDirHandle, baseName);
      const revFileName = `${baseName}-rev${String(revNum).padStart(2, '0')}.md`;

      // 5. Create blank rev file on disk
      const revHandle = await parentDirHandle.getFileHandle(revFileName, { create: true });
      const writable = await revHandle.createWritable();
      await writable.write('');
      await writable.close();

      // 6. Enable dual-pane if not already on
      if (!useEditorStore.getState().dualPane) {
        useEditorStore.getState().toggleDualPane();
      }

      // 7. Open source in left pane
      useEditorStore.getState().setFocusedPane('primary');
      useEditorStore.getState().openTab(fileEntry.path, fileEntry.name, content, fileEntry.handle);
      useEditorStore.getState().setActiveTab(fileEntry.path);

      // 8. Open rev file in right pane
      const parentPath = pathParts.join('/');
      const revPath = parentPath ? `${parentPath}/${revFileName}` : revFileName;
      const existingTab = useEditorStore.getState().tabs.find((t) => t.id === revPath);
      if (existingTab) {
        useEditorStore.getState().setSecondaryTab(revPath);
      } else {
        useEditorStore.setState((s) => ({
          tabs: [...s.tabs, { id: revPath, title: revFileName, content: '', dirty: false, fileHandle: revHandle }],
          secondaryTabId: revPath,
        }));
      }

      // 9. Refresh file tree
      const tree = await buildFileTree(editor.directoryHandle);
      useEditorStore.getState().setFileTree(tree);

      // 10. Build prompt
      const genre = genreSystem[app.selectedGenre];
      const subgenre = genre?.subgenres[app.selectedSubgenre];
      const systemPrompt = buildRevisionSystemPrompt(
        genre?.name || app.selectedGenre,
        subgenre?.name || app.selectedSubgenre
      );

      let effectiveSource = source;
      let effectiveAnalysis = {};
      if (source === 'custom') {
        effectiveAnalysis = { customPrompt };
      } else if (analysisData) {
        effectiveAnalysis = analysisData;
      } else {
        // No chapter match — fall back to generic guidance
        effectiveSource = 'custom';
        effectiveAnalysis = {
          customPrompt:
            customPrompt ||
            'Improve clarity, pacing, and prose quality while preserving the author\'s voice.',
        };
      }

      const userPrompt = buildRevisionUserPrompt(content, effectiveSource, effectiveAnalysis);

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // 11. Stream AI response
      streamAccRef.current = '';

      await new Promise((resolve, reject) => {
        callCompletion(
          messages,
          {
            maxTokens: Math.max(app.chatSettings?.maxTokens || 4096, 8192),
            temperature: 0.7,
          },
          // onChunk
          (chunk) => {
            if (abortRef.current) {
              reject(new Error('cancelled'));
              return;
            }
            streamAccRef.current += chunk;
            // Update right pane in real-time
            useEditorStore.getState().updateTabContent(revPath, streamAccRef.current);
          },
          // onDone
          () => resolve(),
          // onError
          (err) => reject(err)
        );
      });

      // 12. Save the completed rev file
      await useEditorStore.getState().saveTab(revPath);

      return revPath;
    },
    [findNextRevNumber, buildAnalysisData]
  );

  // --- Main pipeline runner ---
  const startPipeline = useCallback(
    async (selectedFiles, source, customPrompt) => {
      fileQueueRef.current = selectedFiles;
      revisionConfigRef.current = { source, customPrompt };
      abortRef.current = false;
      setStatus('running');
      setErrorMessage(null);

      for (let i = 0; i < selectedFiles.length; i++) {
        if (abortRef.current) {
          setStatus('cancelled');
          return;
        }

        setCurrentIndex(i);

        try {
          await processFile(selectedFiles[i]);
        } catch (err) {
          if (err.message === 'cancelled') {
            setStatus('cancelled');
            return;
          }
          setErrorMessage(`Error on "${selectedFiles[i].name}": ${err.message}`);
          setStatus('error');
          return;
        }

        // Pause-between logic (unless last file)
        if (i < selectedFiles.length - 1 && advanceModeRef.current === 'pause') {
          setStatus('paused');
          await new Promise((resolve) => {
            pauseResolverRef.current = resolve;
          });
          if (abortRef.current) {
            setStatus('cancelled');
            return;
          }
          setStatus('running');
        }
      }

      setStatus('complete');
    },
    [processFile]
  );

  const setAdvanceModeWrapped = useCallback((mode) => {
    setAdvanceMode(mode);
    advanceModeRef.current = mode;
    // If switching to auto while paused, auto-resolve the pause
    if (mode === 'auto' && pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, []);

  const resumePipeline = useCallback(() => {
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, []);

  const cancelPipeline = useCallback(() => {
    abortRef.current = true;
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, []);

  const resetPipeline = useCallback(() => {
    setStatus('idle');
    setCurrentIndex(-1);
    setErrorMessage(null);
    abortRef.current = false;
    pauseResolverRef.current = null;
  }, []);

  return {
    status,
    currentIndex,
    totalFiles: fileQueueRef.current.length,
    currentFileName: fileQueueRef.current[currentIndex]?.name || '',
    advanceMode,
    errorMessage,

    startPipeline,
    resumePipeline,
    cancelPipeline,
    resetPipeline,
    setAdvanceMode: setAdvanceModeWrapped,
  };
}
