import React, { useState, useMemo, useEffect } from 'react';
import useAppStore from '../../store/useAppStore';
import { genreSystem } from '../../data/genreSystem';
import { plotStructures } from '../../data/plotStructures';
import { dimensions, DIMENSION_KEYS } from '../../data/dimensions';
import { getIdealCurve } from '../../data/presetArcs';
import { getModifierAdjustedWeights } from '../../engine/weights';
import { enrichDataWithTension } from '../../engine/tension';
import { computeGapAnalysis } from '../../engine/validation';
import { generateRevisionChecklist } from '../../engine/revisionChecklist';
import useClaudeAnalysis from '../../hooks/useClaudeAnalysis';

function PriorityBadge({ priority }) {
  const colors = {
    HIGH: 'bg-red-600/60 text-red-200',
    MEDIUM: 'bg-yellow-600/60 text-yellow-200',
    LOW: 'bg-green-600/60 text-green-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${colors[priority] || colors.LOW}`}>
      {priority}
    </span>
  );
}

function BeatDiagnosisCard({ beatGap, aiRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const significantGaps = DIMENSION_KEYS
    .filter((key) => beatGap.gaps[key] && beatGap.gaps[key].absGap >= 1.5)
    .sort((a, b) => beatGap.gaps[b].absGap - beatGap.gaps[a].absGap);

  return (
    <div className="bg-slate-800/50 rounded-lg border border-purple-500/20 p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-purple-400 font-mono text-sm">{beatGap.time}%</span>
          <span className="font-semibold text-sm">{beatGap.label}</span>
          <PriorityBadge priority={beatGap.priority} />
        </div>
        <span className="text-purple-400 text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Dimension gaps */}
          {significantGaps.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-purple-300 mb-2">Dimension Gaps:</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {significantGaps.map((key) => {
                  const g = beatGap.gaps[key];
                  const direction = g.gap > 0 ? 'above' : 'below';
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span style={{ color: dimensions[key].color }} className="font-semibold w-20 truncate">
                        {dimensions[key].name}
                      </span>
                      <span className="text-purple-300">
                        {g.actual.toFixed(1)} vs {g.ideal.toFixed(1)}
                      </span>
                      <span className={g.gap > 0 ? 'text-orange-400' : 'text-blue-400'}>
                        ({direction} by {g.absGap.toFixed(1)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI recommendation */}
          {aiRecommendation && (
            <div className="bg-purple-900/30 rounded p-3 border border-purple-500/30">
              <h5 className="text-xs font-bold text-purple-300 mb-1">Editorial Recommendation:</h5>
              {aiRecommendation.diagnosis && (
                <p className="text-xs text-purple-200 mb-2">
                  <strong>Diagnosis:</strong> {aiRecommendation.diagnosis}
                </p>
              )}
              {aiRecommendation.recommendation && (
                <p className="text-xs text-white">
                  {aiRecommendation.recommendation}
                </p>
              )}
            </div>
          )}

          {/* Algorithmic recommendation (fallback) */}
          {!aiRecommendation && significantGaps.length > 0 && (
            <div className="bg-slate-700/50 rounded p-3">
              <h5 className="text-xs font-bold text-purple-300 mb-1">Suggestions:</h5>
              <ul className="text-xs text-purple-200 space-y-1">
                {significantGaps.slice(0, 3).map((key) => {
                  const g = beatGap.gaps[key];
                  const dir = g.gap > 0 ? 'Reduce' : 'Increase';
                  return (
                    <li key={key}>
                      {dir} <strong style={{ color: dimensions[key].color }}>{dimensions[key].name}</strong> by ~{g.absGap.toFixed(1)} points at this beat
                      {g.gap > 0
                        ? ` (currently ${g.actual.toFixed(1)}, genre expects ~${g.ideal.toFixed(1)})`
                        : ` (currently ${g.actual.toFixed(1)}, genre expects ~${g.ideal.toFixed(1)})`
                      }
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GetWellPlan() {
  const {
    selectedGenre, selectedSubgenre, selectedModifier,
    weights, chapters, apiKey, setRevisionItems,
    useScaffoldAsIdeal, scaffoldBeats,
  } = useAppStore();

  const { generateGetWellPlan, error, progress } = useClaudeAnalysis();
  const [aiPlan, setAiPlan] = useState(null);
  const [generating, setGenerating] = useState(false);

  const currentGenre = genreSystem[selectedGenre];
  const currentSubgenre = currentGenre.subgenres[selectedSubgenre];
  const currentStructure = plotStructures[currentGenre.structure];
  const activeWeights = useMemo(
    () => getModifierAdjustedWeights(weights, selectedModifier),
    [weights, selectedModifier]
  );

  // Build actual data from chapters
  const actualData = useMemo(() => {
    return chapters
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
  }, [chapters]);

  const enrichedActual = useMemo(
    () => enrichDataWithTension(actualData, activeWeights),
    [actualData, activeWeights]
  );

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

  const gapAnalysis = useMemo(
    () => computeGapAnalysis(enrichedActual, idealData, activeWeights, currentStructure),
    [enrichedActual, idealData, activeWeights, currentStructure]
  );

  // Generate revision checklist whenever gap analysis updates
  useEffect(() => {
    if (gapAnalysis.perBeatGaps.length > 0) {
      const items = generateRevisionChecklist(gapAnalysis, aiPlan);
      setRevisionItems(items);
    }
  }, [gapAnalysis, aiPlan, setRevisionItems]);

  if (enrichedActual.length === 0) return null;

  const handleGenerateAIPlan = async () => {
    setGenerating(true);
    const plan = await generateGetWellPlan(gapAnalysis);
    if (plan) setAiPlan(plan);
    setGenerating(false);
  };

  const handleExportMarkdown = () => {
    let md = `# Get-Well Plan: ${currentGenre.name} > ${currentSubgenre.name}\n\n`;
    md += `**Overall Score:** ${gapAnalysis.overallScore}/100\n\n`;

    if (aiPlan?.executiveSummary) {
      md += `## Executive Summary\n${aiPlan.executiveSummary}\n\n`;
    }

    md += `## Priority Actions\n`;
    if (aiPlan?.topPriorities) {
      aiPlan.topPriorities.forEach((p, i) => { md += `${i + 1}. ${p}\n`; });
    } else {
      gapAnalysis.priorityActions.forEach((a, i) => { md += `${i + 1}. [${a.priority}] ${a.description}\n`; });
    }

    md += `\n## Beat-by-Beat Diagnosis\n\n`;
    gapAnalysis.perBeatGaps.forEach((bg) => {
      const aiRec = aiPlan?.beatRecommendations?.find(
        (r) => r.timePercent === bg.time || r.beat === bg.label
      );
      md += `### ${bg.label} (${bg.time}%) - ${bg.priority}\n`;
      if (aiRec) {
        md += `**Diagnosis:** ${aiRec.diagnosis}\n\n`;
        md += `**Recommendation:** ${aiRec.recommendation}\n\n`;
      }
      const sigGaps = DIMENSION_KEYS.filter((k) => bg.gaps[k]?.absGap >= 1.5);
      if (sigGaps.length > 0) {
        md += `| Dimension | Actual | Ideal | Gap |\n|-----------|--------|-------|-----|\n`;
        sigGaps.forEach((k) => {
          const g = bg.gaps[k];
          md += `| ${dimensions[k].name} | ${g.actual.toFixed(1)} | ${g.ideal.toFixed(1)} | ${g.gap > 0 ? '+' : ''}${g.gap.toFixed(1)} |\n`;
        });
      }
      md += '\n';
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `get-well-plan-${selectedGenre}-${selectedSubgenre}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Get-Well Plan</h3>
        <div className="flex gap-2">
          {apiKey && (
            <button
              onClick={handleGenerateAIPlan}
              disabled={generating}
              className="text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 px-4 py-2 rounded font-semibold"
            >
              {generating ? 'Generating...' : aiPlan ? 'Regenerate AI Plan' : 'Generate AI Plan'}
            </button>
          )}
          <button
            onClick={handleExportMarkdown}
            className="text-sm bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded font-semibold"
          >
            Export Markdown
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4 text-sm text-red-200">
          {error}
        </div>
      )}
      {progress && (
        <div className="bg-blue-900/50 border border-blue-500 rounded p-3 mb-4 text-sm text-blue-200">
          {progress}
        </div>
      )}

      {/* Overall Score */}
      <div className="bg-slate-800/70 rounded-lg p-4 mb-4 border border-purple-500/30">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-purple-300">Overall Health Score</h4>
            <p className="text-xs text-purple-200 mt-1">
              {currentGenre.name} &rarr; {currentSubgenre.name}
            </p>
          </div>
          <div className={`text-4xl font-bold ${
            gapAnalysis.overallScore >= 75 ? 'text-green-400' :
            gapAnalysis.overallScore >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {gapAnalysis.overallScore}/100
          </div>
        </div>
      </div>

      {/* Executive Summary (AI) */}
      {aiPlan?.executiveSummary && (
        <div className="bg-purple-900/30 rounded-lg p-4 mb-4 border border-purple-500/30">
          <h4 className="text-sm font-bold text-purple-300 mb-2">Executive Summary</h4>
          <p className="text-sm text-white">{aiPlan.executiveSummary}</p>
        </div>
      )}

      {/* Priority Actions */}
      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-bold text-purple-300 mb-2">
          {aiPlan?.topPriorities ? 'Top Priorities (AI)' : 'Priority Actions'}
        </h4>
        <ol className="text-sm space-y-2 list-decimal list-inside">
          {(aiPlan?.topPriorities || gapAnalysis.priorityActions.map((a) => a.description)).map((item, i) => (
            <li key={i} className="text-purple-200">{item}</li>
          ))}
        </ol>
      </div>

      {/* Beat-by-Beat Diagnosis */}
      <h4 className="text-sm font-bold text-purple-300 mb-3">Beat-by-Beat Diagnosis</h4>
      <div className="space-y-2">
        {gapAnalysis.perBeatGaps.map((bg, i) => {
          const aiRec = aiPlan?.beatRecommendations?.find(
            (r) => r.timePercent === bg.time || r.beat === bg.label
          );
          return (
            <BeatDiagnosisCard
              key={i}
              beatGap={bg}
              aiRecommendation={aiRec}
            />
          );
        })}
      </div>

      {/* Dimension Summary */}
      <div className="mt-6 bg-slate-800/50 rounded-lg p-4">
        <h4 className="text-sm font-bold text-purple-300 mb-3">Dimension Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(gapAnalysis.perDimensionSummary).map(([key, summary]) => (
            <div key={key} className="bg-slate-900/50 rounded p-2 text-xs">
              <span style={{ color: dimensions[key]?.color }} className="font-semibold">
                {dimensions[key]?.name || key}
              </span>
              <div className="text-purple-300 mt-1">
                Avg gap: {summary.averageGap > 0 ? '+' : ''}{summary.averageGap.toFixed(1)} |
                Max: {summary.maxGap.toFixed(1)} |
                Trend: <span className={
                  summary.trend === 'above' ? 'text-orange-400' :
                  summary.trend === 'below' ? 'text-blue-400' :
                  'text-purple-400'
                }>{summary.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
