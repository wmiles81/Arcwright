import React from 'react';
import { exportBeatSheetMarkdown, exportBeatSheetHTML } from '../../engine/scaffoldOutput';

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
  if (!beatSheet || beatSheet.length === 0 || !summaryCard) return null;

  const handleExportMarkdown = () => {
    const md = exportBeatSheetMarkdown(beatSheet, summaryCard);
    downloadFile(md, `scaffold-${selectedGenre}-${selectedSubgenre}.md`, 'text/markdown');
  };

  const handleExportHTML = () => {
    const html = exportBeatSheetHTML(beatSheet, summaryCard);
    downloadFile(html, `scaffold-${selectedGenre}-${selectedSubgenre}.html`, 'text/html');
  };

  return (
    <div className="flex gap-2">
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
