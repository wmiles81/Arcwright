import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../store/useAppStore';
import useEditorStore from '../../store/useEditorStore';
import useProjectStore from '../../store/useProjectStore';
import useClaudeAnalysis from '../../hooks/useClaudeAnalysis';
import { PROVIDERS } from '../../api/providers';
import { buildFileTree } from '../edit/FilePanel';
import GenreSelector from '../shared/GenreSelector';
import DimensionToggles from '../shared/DimensionToggles';
import PacingClassifierBadge from '../shared/PacingClassifierBadge';
import TextInputPanel from './TextInputPanel';
import ScoringReviewPanel from './ScoringReviewPanel';
import ComparisonOverlay from './ComparisonOverlay';
import GetWellPlan from './GetWellPlan';
import RevisionChecklist from './RevisionChecklist';
import ProjectionOverlay from './ProjectionOverlay';

function sanitizeFilename(title) {
  return title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-').trim() || 'untitled';
}

export default function AnalysisWorkflow() {
  const {
    activeProvider, providers, chapters, analysisInProgress, selectedGenre,
  } = useAppStore();

  const provState = providers[activeProvider] || {};
  const provConfig = PROVIDERS[activeProvider];
  const hasApiKey = !!provState.apiKey;

  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExportToEditor = useCallback(async () => {
    const chaptersWithText = chapters.filter((ch) => ch.text);
    if (chaptersWithText.length === 0) return;

    // Ask for book title
    const title = window.prompt('Book title for export:');
    if (!title) return;
    const safeTitle = sanitizeFilename(title);

    setExporting(true);
    try {
      // Use Arcwrite/projects/books/ if available, otherwise fall back to directory picker
      const { arcwriteHandle, isInitialized } = useProjectStore.getState();
      let booksHandle;
      let rootForTree;

      if (isInitialized && arcwriteHandle) {
        const projectsHandle = await arcwriteHandle.getDirectoryHandle('projects', { create: true });
        booksHandle = await projectsHandle.getDirectoryHandle('books', { create: true });
        rootForTree = arcwriteHandle;
      } else {
        // Fallback: pick a directory
        let dirHandle = useEditorStore.getState().directoryHandle;
        if (!dirHandle) {
          dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          useEditorStore.getState().setDirectoryHandle(dirHandle);
        }
        booksHandle = dirHandle;
        rootForTree = dirHandle;
      }

      // Create book folder under books/
      const folderHandle = await booksHandle.getDirectoryHandle(safeTitle, { create: true });

      // Write each chapter as a .md file
      const pad = chaptersWithText.length >= 100 ? 3 : chaptersWithText.length >= 10 ? 2 : 2;
      for (let i = 0; i < chaptersWithText.length; i++) {
        const ch = chaptersWithText[i];
        const num = String(i + 1).padStart(pad, '0');
        const safeName = sanitizeFilename(ch.title || `Chapter-${num}`);
        const filename = `${num}-${safeName}.md`;

        // Format: ## Chapter N heading, optional POV, paragraphs with blank lines
        let body = `## Chapter ${i + 1}\n\n`;
        if (ch.pov) body += `${ch.pov}\n\n`;
        // Ensure blank line after each paragraph
        // Use double-newline split if present, otherwise fall back to single newlines
        const hasDoubleNewlines = /\n{2,}/.test(ch.text);
        const paragraphs = ch.text
          .split(hasDoubleNewlines ? /\n{2,}/ : /\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        body += paragraphs.join('\n\n') + '\n';

        const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(body);
        await writable.close();
      }

      // Point editor at the Arcwrite folder and navigate
      useEditorStore.getState().setDirectoryHandle(rootForTree);
      const tree = await buildFileTree(rootForTree);
      useEditorStore.getState().setFileTree(tree);
      useEditorStore.getState().setLeftPanelTab('files');
      navigate('/edit');
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  }, [chapters, navigate]);

  const { analyzeChapters, error, progress } = useClaudeAnalysis();

  const hasAnalyzedChapters = chapters.some((ch) => ch.aiScores || ch.userScores);
  const hasPendingChapters = chapters.some((ch) => ch.status === 'pending' || !ch.status);

  // Build actual beats for pacing classifier
  const analyzedBeats = hasAnalyzedChapters
    ? chapters
        .filter((ch) => ch.userScores || ch.aiScores)
        .map((ch, i) => {
          const scores = ch.userScores || ch.aiScores || {};
          return {
            time: scores.timePercent ?? Math.round(((i + 1) / chapters.length) * 100),
            intimacy: scores.intimacy ?? 0,
          };
        })
        .sort((a, b) => a.time - b.time)
    : [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Reverse Engineer & Diagnose</h1>

      <GenreSelector />

      {/* Provider Status */}
      <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-6 flex items-center gap-3">
        <span className="text-sm text-purple-300">
          {hasApiKey
            ? `Using ${provConfig?.name || activeProvider} / ${provState.selectedModel || 'no model selected'}`
            : 'No API key configured.'}
        </span>
        {!hasApiKey && (
          <span className="text-xs text-purple-400">
            Open Settings (gear icon in nav bar) to add one.
          </span>
        )}
      </div>

      {/* Text Input */}
      <TextInputPanel />

      {/* Analyze Button */}
      {chapters.length > 0 && hasPendingChapters && (
        <div className="mb-6">
          <button
            onClick={analyzeChapters}
            disabled={analysisInProgress || !hasApiKey}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:opacity-50 py-3 rounded-lg font-bold text-lg"
          >
            {analysisInProgress ? 'Analyzing...' : `Analyze ${chapters.filter((ch) => !ch.status || ch.status === 'pending').length} Chapter(s)`}
          </button>
          {!hasApiKey && (
            <p className="text-xs text-yellow-400 mt-2 text-center">
              Configure an API key in Settings to enable AI analysis
            </p>
          )}
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-6 text-sm text-red-200">
          {error}
        </div>
      )}
      {progress && (
        <div className="bg-blue-900/50 border border-blue-500 rounded p-3 mb-6 text-sm text-blue-200">
          {progress}
        </div>
      )}

      {/* Score Review */}
      <ScoringReviewPanel />

      {/* Comparison & Get-Well Plan */}
      {hasAnalyzedChapters && (
        <>
          {/* Pacing Classification */}
          {selectedGenre === 'romance' && analyzedBeats.length >= 3 && (
            <div className="mb-6 mt-8">
              <PacingClassifierBadge beats={analyzedBeats} />
            </div>
          )}

          <h2 className="text-2xl font-bold mb-4 mt-8">Comparison: Actual vs. Genre Ideal</h2>
          <ComparisonOverlay />

          <div className="mt-8">
            <DimensionToggles />
          </div>

          <div className="mt-8">
            <GetWellPlan />
          </div>

          <RevisionChecklist />

          <ProjectionOverlay />

          {/* Export to Editor */}
          <div className="mt-8 mb-6">
            <button
              onClick={handleExportToEditor}
              disabled={exporting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-50 py-3 rounded-lg font-bold text-lg transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export Chapters to Editor'}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Writes each chapter as a .md file into a new folder, then opens the Editor
            </p>
          </div>
        </>
      )}
    </div>
  );
}
