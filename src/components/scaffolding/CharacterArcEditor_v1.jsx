import React, { useState, useMemo, useCallback } from 'react';
import useBookStore from '../../store/useBookStore';
import useAppStore from '../../store/useAppStore';
import { dimensions, DIMENSION_KEYS } from '../../data/dimensions';

/**
 * CharacterArcEditor — scaffold-side panel for editing character dimension arcs.
 *
 * Shows characters in the active book and lets authors set dimension values
 * (vulnerability, agency, trust, etc.) at different story positions (0–100%).
 * These arc points define how a character's traits evolve across the narrative.
 */
export default function CharacterArcEditor() {
    const activeBookId = useBookStore((s) => s.activeBookId);
    const characters = useBookStore((s) => s.characters);
    const addCharacter = useBookStore((s) => s.addCharacter);
    const getCharacterArcPoints = useBookStore((s) => s.getCharacterArcPoints);
    const addArcPoint = useBookStore((s) => s.addArcPoint);
    const updateArcPointById = useBookStore((s) => s.updateArcPointById);
    const removeArcPoint = useBookStore((s) => s.removeArcPoint);
    const scaffoldBeats = useAppStore((s) => s.scaffoldBeats);

    const [selectedCharId, setSelectedCharId] = useState(null);
    const [showAddChar, setShowAddChar] = useState(false);
    const [newCharName, setNewCharName] = useState('');
    const [newCharRole, setNewCharRole] = useState('protagonist');

    // Load arc points for selected character
    const arcPoints = useMemo(() => {
        if (!selectedCharId) return [];
        return getCharacterArcPoints(selectedCharId);
    }, [selectedCharId, getCharacterArcPoints]);

    // Group arc points by dimension
    const pointsByDimension = useMemo(() => {
        const grouped = {};
        DIMENSION_KEYS.forEach((k) => { grouped[k] = []; });
        arcPoints.forEach((pt) => {
            if (grouped[pt.dimension_key]) {
                grouped[pt.dimension_key].push(pt);
            }
        });
        // Sort each group by time
        Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.time - b.time));
        return grouped;
    }, [arcPoints]);

    // Refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = () => setRefreshKey((k) => k + 1);

    const handleAddCharacter = () => {
        if (!newCharName.trim()) return;
        const id = addCharacter({ name: newCharName.trim(), role: newCharRole });
        setNewCharName('');
        setShowAddChar(false);
        setSelectedCharId(id);
    };

    const handleAddPoint = (dimensionKey) => {
        if (!selectedCharId) return;
        // Default: add at 50% with value 5
        addArcPoint({ characterId: selectedCharId, dimensionKey, time: 50, value: 5.0 });
        refresh();
    };

    const handleUpdatePoint = (pointId, field, value) => {
        updateArcPointById(pointId, { [field]: value });
        refresh();
    };

    const handleRemovePoint = (pointId) => {
        removeArcPoint(pointId);
        refresh();
    };

    if (!activeBookId) {
        return (
            <div className="bg-white/5 backdrop-blur rounded-lg border border-purple-500/20 p-4 mb-6">
                <h3 className="text-lg font-bold text-purple-300 mb-2">Character Arcs</h3>
                <p className="text-xs text-gray-400">Activate a book project to edit character arcs.</p>
            </div>
        );
    }

    const selectedChar = characters.find((c) => c.id === selectedCharId);

    return (
        <div className="bg-white/5 backdrop-blur rounded-lg border border-purple-500/20 p-4 mb-6" key={refreshKey}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-purple-300">Character Arcs</h3>
                <button
                    onClick={() => setShowAddChar(!showAddChar)}
                    className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded font-semibold"
                >
                    + Character
                </button>
            </div>

            {/* Add character form */}
            {showAddChar && (
                <div className="flex gap-2 mb-3 items-end">
                    <input
                        type="text"
                        value={newCharName}
                        onChange={(e) => setNewCharName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
                        placeholder="Character name…"
                        className="flex-1 text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white"
                        autoFocus
                    />
                    <select
                        value={newCharRole}
                        onChange={(e) => setNewCharRole(e.target.value)}
                        className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white"
                    >
                        <option value="protagonist">Protagonist</option>
                        <option value="antagonist">Antagonist</option>
                        <option value="love_interest">Love Interest</option>
                        <option value="supporting">Supporting</option>
                    </select>
                    <button
                        onClick={handleAddCharacter}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded font-semibold"
                    >
                        Add
                    </button>
                </div>
            )}

            {/* Character tabs */}
            {characters.length > 0 ? (
                <div className="flex gap-1 mb-3 flex-wrap">
                    {characters.map((char) => (
                        <button
                            key={char.id}
                            onClick={() => setSelectedCharId(char.id)}
                            className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors ${selectedCharId === char.id
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/10 text-purple-300 hover:bg-white/20'
                                }`}
                        >
                            {char.name}
                            <span className="ml-1 text-[10px] text-purple-400/60">({char.role})</span>
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-gray-500 mb-3">No characters yet. Add one to start defining arcs.</p>
            )}

            {/* Dimension arc editor */}
            {selectedChar && (
                <div className="space-y-3">
                    <div className="text-xs text-gray-400 mb-1">
                        Set dimension values at story positions for <strong className="text-purple-300">{selectedChar.name}</strong>.
                        {scaffoldBeats.length > 0 && (
                            <span className="text-gray-500"> Beat positions shown as reference markers.</span>
                        )}
                    </div>

                    {DIMENSION_KEYS.map((dimKey) => {
                        const dim = dimensions[dimKey];
                        const points = pointsByDimension[dimKey] || [];

                        return (
                            <div key={dimKey} className="bg-gray-800/50 rounded p-2 border border-gray-700">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: dim.color }}
                                        />
                                        <span className="text-xs font-semibold text-gray-300">{dim.name}</span>
                                    </div>
                                    <button
                                        onClick={() => handleAddPoint(dimKey)}
                                        className="text-[10px] text-purple-400 hover:text-purple-300 px-1"
                                    >
                                        + Point
                                    </button>
                                </div>

                                {points.length === 0 ? (
                                    <div className="text-[10px] text-gray-600 py-1">No arc points defined</div>
                                ) : (
                                    <div className="space-y-1">
                                        {points.map((pt) => (
                                            <div key={pt.id} className="flex items-center gap-2 text-[10px]">
                                                <label className="text-gray-500 w-8">@</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={pt.time}
                                                    onChange={(e) => handleUpdatePoint(pt.id, 'time', parseInt(e.target.value) || 0)}
                                                    className="w-12 bg-gray-900 border border-gray-600 rounded px-1 py-0.5 text-white text-center"
                                                />
                                                <span className="text-gray-500">%</span>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={10}
                                                    step={0.5}
                                                    value={pt.value}
                                                    onChange={(e) => handleUpdatePoint(pt.id, 'value', parseFloat(e.target.value))}
                                                    className="flex-1"
                                                    style={{ accentColor: dim.color }}
                                                />
                                                <span className="w-8 text-right font-mono" style={{ color: dim.color }}>
                                                    {Number(pt.value).toFixed(1)}
                                                </span>
                                                <button
                                                    onClick={() => handleRemovePoint(pt.id)}
                                                    className="text-red-400 hover:text-red-300 px-0.5"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Beat reference markers mini-bar */}
                                {scaffoldBeats.length > 0 && points.length > 0 && (
                                    <div className="relative h-1.5 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                                        {scaffoldBeats.map((b, i) => (
                                            <div
                                                key={i}
                                                className="absolute top-0 w-px h-full bg-gray-500"
                                                style={{ left: `${b.time}%` }}
                                                title={`${b.label} (${b.time}%)`}
                                            />
                                        ))}
                                        {points.map((pt) => (
                                            <div
                                                key={pt.id}
                                                className="absolute top-0 w-1.5 h-full rounded-full"
                                                style={{ left: `${pt.time}%`, backgroundColor: dim.color, transform: 'translateX(-50%)' }}
                                                title={`${dim.name}: ${pt.value} at ${pt.time}%`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
