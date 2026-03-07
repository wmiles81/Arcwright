import React, { useState } from 'react';
import { confirm } from '../../store/useConfirmStore';
import useAppStore from '../../store/useAppStore';

let chapterIdCounter = 1;

export default function TextInputPanel() {
  const { chapters, addChapter, removeChapter, clearChapters } = useAppStore();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [bulkMode, setBulkMode] = useState(false);

  const handleAdd = () => {
    if (!text.trim()) return;
    addChapter({
      id: `ch_${Date.now()}_${chapterIdCounter++}`,
      title: title.trim() || `Chapter ${chapters.length + 1}`,
      text: text.trim(),
      status: 'pending',
      aiScores: null,
      userScores: null,
    });
    setTitle('');
    setText('');
  };

  const handleBulkSplit = () => {
    if (!text.trim()) return;
    // Split on common chapter markers (including Markdown ## headings)
    const chapterPattern = /(?:^|\n)(?:#{1,3}\s+)?(?:chapter\s+\d+|chapter\s+[a-z]+|part\s+\d+)\s*[:.—\-]?\s*([^\n]*)/gi;
    const parts = text.split(chapterPattern);

    // If no chapters found, try splitting by double newlines
    if (parts.length <= 1) {
      const sections = text.split(/\n{3,}/);
      sections.forEach((section, i) => {
        if (section.trim()) {
          addChapter({
            id: `ch_${Date.now()}_${chapterIdCounter++}`,
            title: `Section ${i + 1}`,
            text: section.trim(),
            status: 'pending',
            aiScores: null,
            userScores: null,
          });
        }
      });
    } else {
      // Try a more robust split
      const lines = text.split('\n');
      let currentTitle = '';
      let currentText = '';
      const chapterRegex = /^(?:#{1,3}\s+)?(?:chapter\s+\d+|chapter\s+[a-z]+|part\s+\d+)\s*[:.—\-]?\s*(.*)/i;

      lines.forEach((line) => {
        const match = line.match(chapterRegex);
        if (match) {
          if (currentText.trim()) {
            addChapter({
              id: `ch_${Date.now()}_${chapterIdCounter++}`,
              title: currentTitle || `Chapter ${chapters.length + 1}`,
              text: currentText.trim(),
              status: 'pending',
              aiScores: null,
              userScores: null,
            });
          }
          currentTitle = match[1]?.trim() || line.trim();
          currentText = '';
        } else {
          currentText += line + '\n';
        }
      });

      // Don't forget the last chapter
      if (currentText.trim()) {
        addChapter({
          id: `ch_${Date.now()}_${chapterIdCounter++}`,
          title: currentTitle || `Chapter ${chapters.length + 1}`,
          text: currentText.trim(),
          status: 'pending',
          aiScores: null,
          userScores: null,
        });
      }
    }

    setText('');
    setTitle('');
    setBulkMode(false);
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">Chapter Input</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={`text-xs px-3 py-1 rounded font-semibold ${bulkMode ? 'bg-purple-600' : 'bg-slate-600 hover:bg-slate-500'
              }`}
          >
            {bulkMode ? 'Single Mode' : 'Bulk Split Mode'}
          </button>
          {chapters.length > 0 && (
            <button
              onClick={async () => await confirm('Remove all chapters?') && clearChapters()}
              className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded font-semibold"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {!bulkMode && (
        <div className="mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chapter title (optional)"
            className="w-full bg-slate-800 border border-purple-500/50 rounded px-3 py-2 text-sm text-white mb-2"
          />
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={bulkMode
          ? 'Paste entire book text here. Splits on "Chapter X", "## Chapter X", or triple newlines...'
          : 'Paste chapter text here...'
        }
        className="w-full bg-slate-800 border border-purple-500/50 rounded px-3 py-2 text-sm text-white h-40 resize-y"
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-purple-300">{wordCount} words</span>
        <button
          onClick={bulkMode ? handleBulkSplit : handleAdd}
          disabled={!text.trim()}
          className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 px-4 py-2 rounded font-semibold text-sm"
        >
          {bulkMode ? 'Split & Add Chapters' : 'Add Chapter'}
        </button>
      </div>

      {/* Chapter List */}
      {chapters.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-bold text-purple-300">
            Chapters ({chapters.length})
          </h4>
          {chapters.map((ch, i) => (
            <div key={ch.id} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded text-sm">
              <span className="text-purple-400 font-mono w-6 text-right">{i + 1}</span>
              <span className="flex-1 truncate">{ch.title}</span>
              <span className="text-xs text-purple-300">
                {ch.text.split(/\s+/).length} words
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${ch.status === 'analyzed' ? 'bg-blue-600/50 text-blue-200' :
                  ch.status === 'reviewed' ? 'bg-green-600/50 text-green-200' :
                    'bg-slate-600/50 text-slate-300'
                }`}>
                {ch.status || 'pending'}
              </span>
              <button
                onClick={() => removeChapter(ch.id)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
