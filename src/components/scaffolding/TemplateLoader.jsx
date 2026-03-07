import React, { useState, useRef, useEffect } from 'react';
import { confirm } from '../../store/useConfirmStore';
import useAppStore from '../../store/useAppStore';
import { getIdealCurve } from '../../data/presetArcs';
import { applyPacingToBeats } from '../../engine/pacing';
import { blendArcs } from '../../engine/blending';

let idCounter = 1;

export default function TemplateLoader() {
  const {
    selectedGenre, selectedPacing, applyCompanions,
    scaffoldBeats, setScaffoldBeats,
    blendEnabled, secondaryGenre, blendRatio,
    customStructures, saveCustomStructure, deleteCustomStructure,
  } = useAppStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const confirmReplace = async () => {
    if (scaffoldBeats.length === 0) return true;
    return await confirm('This will replace your current beats. Continue?');
  };

  const handleLoadGenreTemplate = () => {
    if (!confirmReplace()) return;

    let templateArc = getIdealCurve(selectedGenre);

    if (blendEnabled && secondaryGenre) {
      const secondaryArc = getIdealCurve(secondaryGenre);
      templateArc = blendArcs(templateArc, secondaryArc, blendRatio);
    }

    let beats = templateArc.map((point) => ({
      ...point,
      id: `tmpl_${Date.now()}_${idCounter++}`,
    }));

    if (selectedPacing) {
      beats = applyPacingToBeats(beats, selectedPacing, applyCompanions);
    }

    setScaffoldBeats(beats);
    setMenuOpen(false);
  };

  const handleLoadCustom = (structure) => {
    if (!confirmReplace()) return;
    const beats = structure.beats.map((b) => ({
      ...b,
      id: `cust_${Date.now()}_${idCounter++}`,
    }));
    setScaffoldBeats(beats);
    setMenuOpen(false);
  };

  const handleDeleteCustom = async (e, id) => {
    e.stopPropagation();
    if (await confirm('Delete this custom structure?')) {
      deleteCustomStructure(id);
    }
  };

  const handleSave = () => {
    if (scaffoldBeats.length === 0) {
      alert('No beats to save. Add beats first.');
      return;
    }
    const name = window.prompt('Name for this structure:');
    if (!name || !name.trim()) return;
    saveCustomStructure(name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex gap-2 items-center">
      {/* Template dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded font-semibold flex items-center gap-1"
        >
          Load Template
          <span className="text-xs">{menuOpen ? '\u25B2' : '\u25BC'}</span>
        </button>

        {menuOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-purple-500/30 rounded-lg shadow-xl z-30 overflow-hidden">
            {/* Genre template */}
            <button
              onClick={handleLoadGenreTemplate}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors border-b border-purple-500/20"
            >
              <span className="font-semibold">
                {blendEnabled ? 'Blended Genre Template' : 'Genre Template'}
              </span>
              <span className="block text-xs text-purple-300 mt-0.5">
                Load preset arc for current genre
              </span>
            </button>

            {/* Custom structures */}
            {customStructures.length > 0 && (
              <>
                <div className="px-4 py-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider bg-slate-800/80">
                  Custom Structures
                </div>
                {customStructures.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => handleLoadCustom(s)}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm block truncate">{s.name}</span>
                      <span className="text-[10px] text-purple-400">
                        {s.beats.length} beats
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteCustom(e, s.id)}
                      className="text-red-400 hover:text-red-300 text-xs ml-2 px-1"
                      title="Delete structure"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </>
            )}

            {customStructures.length === 0 && (
              <div className="px-4 py-2 text-xs text-purple-400/60 italic">
                No custom structures saved yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save current as structure */}
      <button
        onClick={handleSave}
        className={`text-sm px-4 py-2 rounded font-semibold transition-colors ${saved
          ? 'bg-green-600 text-white'
          : 'bg-purple-600 hover:bg-purple-700'
          }`}
      >
        {saved ? 'Saved!' : 'Save as Structure'}
      </button>
    </div>
  );
}
