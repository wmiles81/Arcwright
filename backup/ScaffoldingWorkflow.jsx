import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import useAppStore from '../../store/useAppStore';
import { genreSystem } from '../../data/genreSystem';
import { allStructures, beatSelectorGroups, actSelectorGroups } from '../../data/plotStructures';
import { getIdealCurve } from '../../data/presetArcs';
import { getCompleteWeights, getModifierAdjustedWeights } from '../../engine/weights';
import { enrichDataWithTension } from '../../engine/tension';
import { validateAgainstGenre } from '../../engine/validation';
import { blendArcs, blendWeights, blendRequirements } from '../../engine/blending';
import GenreSelector from '../shared/GenreSelector';
import GenreBlender from '../shared/GenreBlender';
import NarrativeChart from '../shared/NarrativeChart';
import DimensionToggles from '../shared/DimensionToggles';
import ValidationPanel from '../shared/ValidationPanel';
import ExportImportControls from '../shared/ExportImportControls';
import BeatEditor from './BeatEditor';
import TemplateLoader from './TemplateLoader';
import StructureSelector from './StructureSelector';
import ScaffoldOutput from './ScaffoldOutput';
import StructureReference from './StructureReference';

export default function ScaffoldingWorkflow() {
  const {
    selectedGenre, selectedSubgenre, selectedModifier, selectedStructure,
    selectedActStructure, setStructure, setActStructure,
    weights, visibleDims, scaffoldBeats,
    setScaffoldBeats, clearScaffold,
    blendEnabled, secondaryGenre, secondarySubgenre, blendRatio,
  } = useAppStore();

  const currentGenre = genreSystem[selectedGenre];
  const currentSubgenre = currentGenre.subgenres[selectedSubgenre];
  const currentStructure = allStructures[selectedStructure] || allStructures[currentGenre.structure];
  const currentActStructure = selectedActStructure ? (allStructures[selectedActStructure] || null) : null;

  // Compute active weights (with modifier + optional blending)
  const activeWeights = useMemo(() => {
    let w = getModifierAdjustedWeights(weights, selectedModifier);
    if (blendEnabled && secondaryGenre && secondarySubgenre) {
      const secWeights = getCompleteWeights(
        genreSystem[secondaryGenre].subgenres[secondarySubgenre].weights
      );
      w = blendWeights(w, secWeights, blendRatio);
    }
    return w;
  }, [weights, selectedModifier, blendEnabled, secondaryGenre, secondarySubgenre, blendRatio]);

  // Compute ideal curve (or blended curve)
  const idealCurve = useMemo(() => {
    const primaryArc = getIdealCurve(selectedGenre);
    if (blendEnabled && secondaryGenre) {
      const secondaryArc = getIdealCurve(secondaryGenre);
      return blendArcs(primaryArc, secondaryArc, blendRatio);
    }
    return primaryArc;
  }, [selectedGenre, blendEnabled, secondaryGenre, blendRatio]);

  // Compute active requirements (with optional blending)
  const activeRequirements = useMemo(() => {
    if (blendEnabled && secondaryGenre && secondarySubgenre) {
      const secReqs = genreSystem[secondaryGenre].subgenres[secondarySubgenre].requirements;
      return blendRequirements(currentSubgenre.requirements, secReqs, blendRatio);
    }
    return currentSubgenre.requirements;
  }, [currentSubgenre, blendEnabled, secondaryGenre, secondarySubgenre, blendRatio]);

  const enrichedData = useMemo(
    () => enrichDataWithTension(scaffoldBeats, activeWeights),
    [scaffoldBeats, activeWeights]
  );

  const validation = useMemo(
    () => enrichedData.length > 0
      ? validateAgainstGenre(enrichedData, activeRequirements)
      : { intimacy: false, trust: false, tension: false },
    [enrichedData, activeRequirements]
  );

  const handleImport = (data) => {
    if (Array.isArray(data)) {
      setScaffoldBeats(data);
    } else if (data.beats) {
      setScaffoldBeats(data.beats);
    }
  };

  // --- Resizable split panel ---
  const [leftWidth, setLeftWidth] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(80, Math.max(20, pct)));
    };
    const onMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Story Scaffolding</h1>

      <GenreSelector />
      <GenreBlender />

      <StructureReference />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <StructureSelector
          label="Beats"
          selectedKey={selectedStructure}
          onSelect={setStructure}
          groups={beatSelectorGroups}
          color="teal"
          countField="beats"
        />
        <StructureSelector
          label="Acts"
          selectedKey={selectedActStructure}
          onSelect={setActStructure}
          groups={actSelectorGroups}
          color="indigo"
          countField="acts"
          showNone
        />
        <TemplateLoader />
        <button
          onClick={() => {
            if (scaffoldBeats.length === 0 || window.confirm('Clear all beats?')) {
              clearScaffold();
            }
          }}
          className="text-sm bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
        >
          Clear All
        </button>
        <ExportImportControls
          data={{ genre: selectedGenre, subgenre: selectedSubgenre, beats: scaffoldBeats }}
          onImport={handleImport}
          exportFilename={`scaffold-${selectedGenre}-${selectedSubgenre}.json`}
          label="Scaffold"
        />
      </div>

      {/* Resizable split: beat editor | drag handle | chart */}
      <div ref={containerRef} className="hidden lg:flex mb-6" style={{ minHeight: 400 }}>
        <div style={{ width: `${leftWidth}%` }} className="overflow-hidden pr-2 flex-shrink-0">
          <BeatEditor
            structureBeats={currentStructure.beats}
            idealCurve={idealCurve}
            activeWeights={activeWeights}
            structureKey={selectedStructure || currentGenre.structure}
          />
        </div>
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 cursor-col-resize bg-purple-500/30 hover:bg-purple-500/60 rounded-full mx-1 flex-shrink-0 transition-colors"
        />
        <div style={{ width: `${100 - leftWidth}%` }} className="overflow-hidden pl-2">
          {enrichedData.length > 0 ? (
            <NarrativeChart
              data={enrichedData}
              visibleDims={visibleDims}
              structureName={currentStructure.name}
              structureBeats={currentStructure.beats}
              actStructure={currentActStructure}
              height={400}
            />
          ) : (
            <div className="bg-white/10 backdrop-blur rounded-lg p-6 flex items-center justify-center h-[400px]">
              <p className="text-purple-300 text-center">
                Add beats or load a template to see your story arc
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Mobile: stacked layout */}
      <div className="lg:hidden space-y-6 mb-6">
        <BeatEditor
          structureBeats={currentStructure.beats}
          idealCurve={idealCurve}
          activeWeights={activeWeights}
          structureKey={selectedStructure || currentGenre.structure}
        />
        {enrichedData.length > 0 ? (
          <NarrativeChart
            data={enrichedData}
            visibleDims={visibleDims}
            structureName={currentStructure.name}
            structureBeats={currentStructure.beats}
            actStructure={currentActStructure}
            height={400}
          />
        ) : (
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 flex items-center justify-center h-[400px]">
            <p className="text-purple-300 text-center">
              Add beats or load a template to see your story arc
            </p>
          </div>
        )}
      </div>

      <DimensionToggles />

      {enrichedData.length > 0 && <ValidationPanel validation={validation} enrichedData={enrichedData} />}

      <ScaffoldOutput />
    </div>
  );
}
