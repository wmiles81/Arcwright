import { useState, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { genreSystem } from '../data/genreSystem';
import { plotStructures } from '../data/plotStructures';
import { parseJsonResponse } from '../api/claude';
import { callCompletionSync } from '../api/providerAdapter';
import {
  buildScoringSystemPrompt,
  buildScoringUserMessage,
  buildGetWellSystemPrompt,
  buildGetWellUserMessage,
} from '../api/prompts';

const BATCH_SIZE = 5;

export default function useClaudeAnalysis() {
  const {
    activeProvider, providers, chapters, selectedGenre, selectedSubgenre,
    updateChapterScores, setAnalysisInProgress,
  } = useAppStore();
  const apiKey = providers[activeProvider]?.apiKey || '';

  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  const currentGenre = genreSystem[selectedGenre];
  const currentSubgenre = currentGenre.subgenres[selectedSubgenre];
  const currentStructure = plotStructures[currentGenre.structure];

  const analyzeChapters = useCallback(async () => {
    if (!apiKey) {
      setError('Configure an API key in Settings.');
      return;
    }

    const unanalyzed = chapters.filter((ch) => ch.status === 'pending' || !ch.status);
    if (unanalyzed.length === 0) {
      setError('No chapters to analyze');
      return;
    }

    setError(null);
    setAnalysisInProgress(true);

    const systemPrompt = buildScoringSystemPrompt(
      currentGenre.name,
      currentSubgenre.name,
      currentStructure.name
    );

    try {
      // Process in batches
      for (let i = 0; i < unanalyzed.length; i += BATCH_SIZE) {
        const batch = unanalyzed.slice(i, i + BATCH_SIZE);
        setProgress(`Analyzing chapters ${i + 1}-${Math.min(i + BATCH_SIZE, unanalyzed.length)} of ${unanalyzed.length}...`);

        const batchWithIndex = batch.map((ch) => ({
          ...ch,
          index: chapters.indexOf(ch),
        }));

        const userMessage = buildScoringUserMessage(batchWithIndex, chapters.length);
        const responseText = await callCompletionSync(systemPrompt, userMessage, { maxTokens: 8192 });
        const parsed = parseJsonResponse(responseText);

        if (parsed.chapters && Array.isArray(parsed.chapters)) {
          parsed.chapters.forEach((result, idx) => {
            if (idx < batch.length && result.scores) {
              updateChapterScores(batch[idx].id, {
                ...result.scores,
                timePercent: result.timePercent,
                beat: result.beat,
                reasoning: result.reasoning,
              }, 'ai');
            }
          });
        }
      }

      setProgress('Analysis complete');
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setAnalysisInProgress(false);
    }
  }, [apiKey, chapters, currentGenre, currentSubgenre, currentStructure, updateChapterScores, setAnalysisInProgress]);

  const generateGetWellPlan = useCallback(async (gapAnalysis) => {
    if (!apiKey) {
      setError('Configure an API key in Settings.');
      return null;
    }

    setError(null);
    setProgress('Generating editorial recommendations...');

    const systemPrompt = buildGetWellSystemPrompt(currentGenre.name, currentSubgenre.name);
    const userMessage = buildGetWellUserMessage(gapAnalysis);

    try {
      const responseText = await callCompletionSync(systemPrompt, userMessage, { maxTokens: 8192 });
      const parsed = parseJsonResponse(responseText);
      setProgress('');
      return parsed;
    } catch (err) {
      setError(`Get-well plan generation failed: ${err.message}`);
      return null;
    }
  }, [apiKey, currentGenre, currentSubgenre]);

  return { analyzeChapters, generateGetWellPlan, error, progress };
}
