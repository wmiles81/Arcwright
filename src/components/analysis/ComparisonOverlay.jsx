import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as ReTooltip,
} from 'recharts';
import useAppStore from '../../store/useAppStore';
import { genreSystem } from '../../data/genreSystem';
import { allStructures } from '../../data/plotStructures';
import { getIdealCurve } from '../../data/presetArcs';
import { DIMENSION_KEYS } from '../../data/dimensions';
import { getModifierAdjustedWeights } from '../../engine/weights';
import { enrichDataWithTension } from '../../engine/tension';
import { mergeForComparison } from '../../engine/validation';
import NarrativeChart from '../shared/NarrativeChart';

export default function ComparisonOverlay() {
  const {
    selectedGenre, selectedSubgenre, selectedModifier, selectedActStructure,
    weights, visibleDims, chapters, useScaffoldAsIdeal, scaffoldBeats,
  } = useAppStore();

  const currentGenre = genreSystem[selectedGenre];
  const currentStructure = allStructures[currentGenre.structure];
  const actStructure = selectedActStructure ? (allStructures[selectedActStructure] || null) : null;
  const activeWeights = getModifierAdjustedWeights(weights, selectedModifier);

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
          ...Object.fromEntries(
            DIMENSION_KEYS.map((k) => [k, scores[k] ?? 0])
          ),
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

  // Merge for overlay
  const overlayData = useMemo(
    () => mergeForComparison(actualData, idealData),
    [actualData, idealData]
  );

  // Gap heat strip data
  const gapHeatData = useMemo(() => {
    return overlayData.map((point) => {
      let totalGap = 0;
      let count = 0;
      DIMENSION_KEYS.forEach((key) => {
        const gap = point[`gap_${key}`];
        if (gap !== null && gap !== undefined) {
          totalGap += gap;
          count++;
        }
      });
      return {
        time: point.time,
        avgGap: count > 0 ? totalGap / count : 0,
        label: point.actual_label || point.ideal_label || `${point.time}%`,
      };
    });
  }, [overlayData]);

  if (actualData.length === 0) {
    return null;
  }

  const getGapColor = (gap) => {
    if (gap < 1) return '#22c55e'; // green
    if (gap < 2) return '#eab308'; // yellow
    if (gap < 3) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className="space-y-4">
      <NarrativeChart
        data={[]}
        overlayData={overlayData}
        visibleDims={visibleDims}
        structureName={currentStructure.name}
        structureBeats={currentStructure.beats}
        actStructure={actStructure}
        height={450}
      />

      {/* Gap Heat Strip */}
      <div className="bg-white/10 backdrop-blur rounded-lg p-4">
        <h3 className="text-sm font-bold text-purple-300 mb-2">
          Gap Severity (average dimensional gap per beat)
        </h3>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={gapHeatData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 5]} />
            <ReTooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #8b5cf6', borderRadius: '8px', fontSize: '12px' }}
              formatter={(value) => [value.toFixed(1), 'Avg Gap']}
              labelFormatter={(label) => `${label}%`}
            />
            <Bar dataKey="avgGap" radius={[2, 2, 0, 0]}>
              {gapHeatData.map((entry, index) => (
                <Cell key={index} fill={getGapColor(entry.avgGap)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-between text-[10px] text-purple-400 mt-1">
          <span>0%</span>
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-green-500" /> {'<'}1
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-yellow-500" /> 1-2
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-orange-500" /> 2-3
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-500" /> 3+
            </span>
          </div>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
