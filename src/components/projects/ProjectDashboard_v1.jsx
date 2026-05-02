import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useBookStore from '../../store/useBookStore';
import useSeriesStore from '../../store/useSeriesStore';
import useAppStore from '../../store/useAppStore';
import { dimensions, DIMENSION_KEYS } from '../../data/dimensions';

/**
 * ProjectDashboard — unified overview of the active book project.
 *
 * Shows:
 * - Book metadata and series context
 * - Chapter/scene grid with beat mapping status
 * - Analysis scores with trend indicators
 * - Quick-action buttons (Analyze, Edit, Revise)
 */
export default function ProjectDashboard() {
    const activeBookId = useBookStore((s) => s.activeBookId);
    const activeBook = useBookStore((s) => s.activeBook);
    const characters = useBookStore((s) => s.characters);
    const scenes = useBookStore((s) => s.scenes);
    const chapters = useBookStore((s) => s.chapters);
    const settings = useBookStore((s) => s.settings);
    const getStats = useBookStore((s) => s.getStats);
    const getSceneSnapshots = useBookStore((s) => s.getSceneSnapshots);

    const activeSeries = useSeriesStore((s) => s.activeSeries);
    const scaffoldBeats = useAppStore((s) => s.scaffoldBeats);
    const appChapters = useAppStore((s) => s.chapters);

    const navigate = useNavigate();

    const stats = useMemo(() => {
        if (!activeBookId) return null;
        return getStats();
    }, [activeBookId, getStats]);

    // Scenes with analysis data
    const scenesEnriched = useMemo(() => {
        return scenes.map((scene) => {
            const snapshots = getSceneSnapshots(scene.id);
            const latestSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
            let latestScores = null;
            if (latestSnap?.scores) {
                try {
                    latestScores = typeof latestSnap.scores === 'string'
                        ? JSON.parse(latestSnap.scores)
                        : latestSnap.scores;
                } catch { }
            }
            return {
                ...scene,
                snapshotCount: snapshots.length,
                latestScores,
                latestSource: latestSnap?.source,
            };
        });
    }, [scenes, getSceneSnapshots]);

    const mappedScenes = scenesEnriched.filter((s) => s.beat_id);
    const unmappedScenes = scenesEnriched.filter((s) => !s.beat_id);
    const analyzedScenes = scenesEnriched.filter((s) => s.snapshotCount > 0);
    const beatCoverage = scaffoldBeats.length > 0
        ? Math.round((new Set(mappedScenes.map((s) => s.beat_id)).size / scaffoldBeats.length) * 100)
        : 0;

    if (!activeBookId) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold mb-6">Project Dashboard</h1>
                <div className="bg-white/5 backdrop-blur rounded-lg border border-purple-500/20 p-8 text-center">
                    <p className="text-lg text-gray-400 mb-4">No book project active.</p>
                    <p className="text-sm text-gray-500">
                        Open a project from the Project menu or create one in{' '}
                        <Link to="/scaffold" className="text-purple-400 hover:underline">Story Scaffolding</Link>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Project Dashboard</h1>

            {/* Book header */}
            <div className="bg-white/5 backdrop-blur rounded-lg border border-purple-500/20 p-4 mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-purple-200">{activeBook?.title || 'Untitled'}</h2>
                        {activeSeries && (
                            <p className="text-xs text-purple-400 mt-0.5">
                                📚 {activeSeries.name}
                                {activeBook?.series_position && ` — Book ${activeBook.series_position}`}
                            </p>
                        )}
                        {activeBook?.premise && (
                            <p className="text-sm text-gray-400 mt-1 max-w-2xl">{activeBook.premise}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link
                            to="/scaffold"
                            className="text-xs bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded font-semibold"
                        >
                            Scaffold
                        </Link>
                        <Link
                            to="/analysis"
                            className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded font-semibold"
                        >
                            Analyze
                        </Link>
                        <Link
                            to="/edit"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded font-semibold"
                        >
                            Edit
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                <StatCard label="Chapters" value={stats?.chapterCount || chapters.length} />
                <StatCard label="Scenes" value={stats?.sceneCount || scenes.length} />
                <StatCard label="Characters" value={stats?.characterCount || characters.length} />
                <StatCard label="Settings" value={settings.length} />
                <StatCard
                    label="Beat Coverage"
                    value={`${beatCoverage}%`}
                    color={beatCoverage > 80 ? 'emerald' : beatCoverage > 50 ? 'yellow' : 'red'}
                />
                <StatCard label="Analyzed" value={analyzedScenes.length} />
            </div>

            {/* Scene grid */}
            <h3 className="text-lg font-bold text-purple-300 mb-3">Scenes</h3>
            {scenesEnriched.length === 0 ? (
                <div className="bg-white/5 rounded-lg p-6 text-center text-gray-500 text-sm mb-6">
                    No scenes yet. Create scene stubs from{' '}
                    <Link to="/scaffold" className="text-purple-400 hover:underline">Scaffold</Link>{' '}
                    or add them in the editor's Scenes tab.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                    {scenesEnriched.map((scene) => (
                        <SceneCard key={scene.id} scene={scene} />
                    ))}
                </div>
            )}

            {/* Characters overview */}
            {characters.length > 0 && (
                <>
                    <h3 className="text-lg font-bold text-purple-300 mb-3">Characters</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
                        {characters.map((char) => (
                            <div
                                key={char.id}
                                className="bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm"
                            >
                                <div className="font-medium text-gray-200">{char.name}</div>
                                <div className="text-[10px] text-gray-500 capitalize">{char.role}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Scaffold beats status */}
            {scaffoldBeats.length > 0 && (
                <>
                    <h3 className="text-lg font-bold text-purple-300 mb-3">Beat Mapping Status</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
                        {scaffoldBeats.map((beat, i) => {
                            const beatId = beat.beat || beat.label;
                            const linkedScenes = mappedScenes.filter((s) => s.beat_id === beatId);
                            const isMapped = linkedScenes.length > 0;

                            return (
                                <div
                                    key={i}
                                    className={`rounded px-2 py-1.5 text-xs border ${isMapped
                                            ? 'border-emerald-500/30 bg-emerald-500/10'
                                            : 'border-gray-700 bg-gray-800/50'
                                        }`}
                                >
                                    <div className="font-semibold text-gray-300 truncate">{beat.label}</div>
                                    <div className="text-[10px] text-gray-500">
                                        {beat.time}% — {isMapped ? `${linkedScenes.length} scene(s)` : 'unmapped'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ label, value, color = 'purple' }) {
    const colorMap = {
        purple: 'border-purple-500/30 text-purple-300',
        emerald: 'border-emerald-500/30 text-emerald-300',
        yellow: 'border-yellow-500/30 text-yellow-300',
        red: 'border-red-500/30 text-red-300',
    };

    return (
        <div className={`bg-white/5 rounded-lg border p-3 text-center ${colorMap[color]}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold">{label}</div>
        </div>
    );
}

function SceneCard({ scene }) {
    const hasBeat = !!scene.beat_id;
    const hasAnalysis = scene.snapshotCount > 0;

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded p-3 text-sm">
            <div className="flex items-start gap-2 mb-1.5">
                <span
                    className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${hasBeat ? 'bg-purple-500' : 'bg-gray-500/40'
                        }`}
                />
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-200 truncate">{scene.title}</div>
                    {hasBeat && (
                        <div className="text-[10px] text-purple-400">♫ {scene.beat_id} ({scene.time_position}%)</div>
                    )}
                </div>
            </div>

            {/* Mini score bar if analyzed */}
            {hasAnalysis && scene.latestScores && (
                <div className="flex gap-0.5 mt-1.5">
                    {DIMENSION_KEYS.map((k) => {
                        const val = scene.latestScores[k];
                        if (val == null) return null;
                        const dim = dimensions[k];
                        return (
                            <div key={k} className="flex-1 group relative">
                                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${(val / 10) * 100}%`,
                                            backgroundColor: dim.color,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Status badges */}
            <div className="flex gap-1 mt-2 flex-wrap">
                {hasBeat && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        mapped
                    </span>
                )}
                {hasAnalysis && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {scene.snapshotCount} run{scene.snapshotCount !== 1 ? 's' : ''}
                    </span>
                )}
                {scene.latestSource === 'revision' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        revised
                    </span>
                )}
            </div>
        </div>
    );
}
