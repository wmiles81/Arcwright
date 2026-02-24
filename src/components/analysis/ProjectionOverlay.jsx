import React, { useMemo } from 'react';
import useAppStore from '../../store/useAppStore';
import { genreSystem } from '../../data/genreSystem';
import { allStructures } from '../../data/plotStructures';
import { getIdealCurve } from '../../data/presetArcs';
import { DIMENSION_KEYS } from '../../data/dimensions';
import { getModifierAdjustedWeights } from '../../engine/weights';
import { enrichDataWithTension } from '../../engine/tension';
import { generateProjection, mergeForTripleComparison } from '../../engine/projection';
import { computeGapAnalysis } from '../../engine/validation';
import NarrativeChart from '../shared/NarrativeChart';
import ProjectionSlider from './ProjectionSlider';

export default function ProjectionOverlay() {
  const {
    selectedGenre, selectedModifier, selectedActStructure,
    weights, visibleDims, chapters, projectionPercent,
    useScaffoldAsIdeal, scaffoldBeats,
  } = useAppStore();

  const currentGenre = genreSystem[selectedGenre];
  const currentStructure = allStructures[currentGenre.structure];
  const actStructure = selectedActStructure ? (allStructures[selectedActStructure] || null) : null;
  const activeWeights = useMemo(
    () => getModifierAdjustedWeights(weights, selectedModifier),
    [weights, selectedModifier]
  );

  // Build actual data from chapters
  const actualData = useMemo(() => {
    const scored = chapters
      .filter((ch) => ch.userScores || ch.aiScores)
      .map((ch, i) => {
        const scores = ch.userScores || ch.aiScores || {};
        return {
          time: scores.timePercent ?? Math.round(((i + 1) / chapters.length) * 100),
          beat: scores.beat || '',
          label: ch.title,
          ...Object.fromEntries(DIMENSION_KEYS.map((k) => [k, scores[k] ?? 0])),
        };
      })
      .sort((a, b) => a.time - b.time);

    return enrichDataWithTension(scored, activeWeights);
  }, [chapters, activeWeights]);

  // Get ideal data — either from scaffold or genre preset
  const idealData = useMemo(() => {
    if (useScaffoldAsIdeal && scaffoldBeats.length > 0) {
      // Use user's scaffold as the ideal
      const scaffoldData = scaffoldBeats.map((beat) => ({
        time: beat.time,
        beat: beat.beat || '',
        label: beat.label || beat.beat || '',
        ...Object.fromEntries(DIMENSION_KEYS.map((k) => [k, beat[k] ?? 0])),
      }));
      return enrichDataWithTension(scaffoldData, activeWeights);
    }
    // Default: use genre preset
    const ideal = getIdealCurve(selectedGenre);
    return enrichDataWithTension(ideal, activeWeights);
  }, [selectedGenre, activeWeights, useScaffoldAsIdeal, scaffoldBeats]);

  // Generate projected data
  const projectedData = useMemo(
    () => generateProjection(actualData, idealData, projectionPercent, activeWeights),
    [actualData, idealData, projectionPercent, activeWeights]
  );

  // Merge for triple-layer chart
  const tripleData = useMemo(
    () => mergeForTripleComparison(actualData, idealData, projectedData),
    [actualData, idealData, projectedData]
  );

  // Projected health score
  const projectedScore = useMemo(() => {
    if (projectedData.length === 0) return undefined;
    const gap = computeGapAnalysis(projectedData, idealData, activeWeights, currentStructure);
    return gap.overallScore;
  }, [projectedData, idealData, activeWeights, currentStructure]);

  if (actualData.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 mt-8">Before/After Projection</h2>

      <ProjectionSlider projectedScore={projectedScore} />

      {projectionPercent > 0 && (
        <NarrativeChart
          data={[]}
          overlayData={tripleData}
          visibleDims={visibleDims}
          structureName={currentStructure.name}
          structureBeats={currentStructure.beats}
          actStructure={actStructure}
          height={450}
          showProjected
        />
      )}
    </div>
  );
}
