import React, { useState } from 'react';
import { exportBeatSheetMarkdown, exportBeatSheetHTML, generateSceneStubs } from '../../engine/scaffoldOutput';
import useEditorStore from '../../store/useEditorStore';
import useBookStore from '../../store/useBookStore';
import useProjectStore from '../../store/useProjectStore';

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function WritingGuideExporter({ beatSheet, summaryCard, selectedGenre, selectedSubgenre }) {
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(false);

    if (!beatSheet || beatSheet.length === 0 || !summaryCard) return null;

    const handleExportMarkdown = () => {
        const md = exportBeatSheetMarkdown(beatSheet, summaryCard);
        downloadFile(md, `scaffold-${selectedGenre}-${selectedSubgenre}.md`, 'text/markdown');
    };

    const handleExportHTML = () => {
        const html = exportBeatSheetHTML(beatSheet, summaryCard);
        downloadFile(html, `scaffold-${selectedGenre}-${selectedSubgenre}.html`, 'text/html');
    };

    /** Open the beat sheet markdown directly in the editor as a tab. */
    const handleOpenInEditor = () => {
        const md = exportBeatSheetMarkdown(beatSheet, summaryCard);
        const tabId = `scaffold-guide-${selectedGenre}-${selectedSubgenre}`;
        const tabTitle = `Scaffold: ${summaryCard.genre} > ${summaryCard.subgenre}`;
        useEditorStore.getState().openTab(tabId, tabTitle, md, null);
        useEditorStore.getState().setActiveTab(tabId);
    };

    /** Create scene stub files in the active book project and register them in the database. */
    const handleCreateSceneStubs = async () => {
        const bookDirHandle = useProjectStore.getState().bookDirHandle;
        const activeBookId = useBookStore.getState().activeBookId;

        if (!bookDirHandle) {
            alert('Please activate a book project first (Project menu → select a book project).');
            return;
        }

        setCreating(true);
        try {
            const stubs = generateSceneStubs(beatSheet, summaryCard);

            // Create a Scenes/ directory in the book project
            const scenesDir = await bookDirHandle.getDirectoryHandle('Scenes', { create: true });

            for (const stub of stubs) {
                // Write scene stub file to disk
                const fileHandle = await scenesDir.getFileHandle(stub.filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(stub.content);
                await writable.close();

                // Register scene in database if book is active
                if (activeBookId) {
                    useBookStore.getState().addScene({
                        title: `${stub.beatLabel} (${stub.sceneInBeat}/${stub.scenesInBeat})`,
                        summary: '',
                        beatId: stub.beatId,
                        timePosition: stub.time,
                        filePath: `Scenes/${stub.filename}`,
                    });
                }
            }

            // Refresh file tree
            await useProjectStore.getState().refreshBookFileTree();

            setCreated(true);
            setTimeout(() => setCreated(false), 3000);
        } catch (err) {
            console.error('[WritingGuideExporter] Failed to create scene stubs:', err);
            alert(`Failed to create scene files: ${err.message}`);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="flex gap-2 flex-wrap">
            <button
                onClick={handleOpenInEditor}
                className="text-sm bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold"
                title="Open the beat sheet as an editable document in the editor"
            >
                Open in Editor
            </button>
            <button
                onClick={handleCreateSceneStubs}
                disabled={creating || created}
                className={`text-sm px-4 py-2 rounded font-semibold ${created
                        ? 'bg-green-700 cursor-default'
                        : creating
                            ? 'bg-amber-700 cursor-wait'
                            : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                title="Create ~3 scene stub files per beat in the active book project"
            >
                {created ? '✓ Scenes Created' : creating ? 'Creating…' : 'Create Scene Stubs'}
            </button>
            <button
                onClick={handleExportMarkdown}
                className="text-sm bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded font-semibold"
            >
                Export Markdown
            </button>
            <button
                onClick={handleExportHTML}
                className="text-sm bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-semibold"
            >
                Export HTML
            </button>
        </div>
    );
}
