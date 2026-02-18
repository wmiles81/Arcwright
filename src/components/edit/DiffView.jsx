import React, { useMemo, useCallback } from 'react';
import { diffWords, diffArrays } from 'diff';

/**
 * Convert HTML or raw text content to plain text with paragraph breaks preserved.
 *
 * ContentEditable stores HTML (<p>, <h1>, etc.), while the revision pipeline
 * streams raw markdown text. We need both to produce comparable paragraph arrays.
 */
function htmlToText(html) {
  if (!html) return '';
  // Plain text (no HTML tags) — return as-is
  if (!/<[a-z][\s\S]*?>/i.test(html)) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Insert double-newlines after block elements to preserve paragraph structure
  const blocks = doc.body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, hr, tr');
  blocks.forEach((el) => el.appendChild(document.createTextNode('\n\n')));
  // Convert <br> to paragraph break — markdownToHtml stores paragraph-separated
  // lines as <br> within a single <p>, so each <br> is a paragraph boundary.
  doc.body.querySelectorAll('br').forEach((el) => el.replaceWith(document.createTextNode('\n\n')));
  return doc.body.textContent?.trim() || '';
}

/** Split text into paragraphs. Tries double-newline first, falls back to single. */
function toParagraphs(text) {
  let paras = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  // If we got only 1 paragraph but the text has line breaks, split on single \n
  if (paras.length <= 1 && text.includes('\n')) {
    paras = text.split(/\n/).map((p) => p.trim()).filter(Boolean);
  }
  return paras;
}

/**
 * Word overlap ratio between two strings (Jaccard-like).
 * Used as a fuzzy comparator for diffArrays so that lightly-edited
 * paragraphs get aligned as matches rather than separate add/remove.
 */
function wordOverlap(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/** Render word-level diff spans within a single paragraph pair. */
function wordDiffSpans(oldText, newText) {
  const parts = diffWords(oldText, newText);
  const left = [];
  const right = [];
  let hasChanges = false;

  parts.forEach((part, i) => {
    if (part.added) {
      hasChanges = true;
      right.push(
        <span key={i} style={{ background: 'rgba(34,197,94,0.3)', borderRadius: 2, padding: '0 1px' }}>
          {part.value}
        </span>
      );
    } else if (part.removed) {
      hasChanges = true;
      left.push(
        <span key={i} style={{ background: 'rgba(239,68,68,0.3)', textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.5)', borderRadius: 2, padding: '0 1px' }}>
          {part.value}
        </span>
      );
    } else {
      left.push(<span key={`l${i}`}>{part.value}</span>);
      right.push(<span key={`r${i}`}>{part.value}</span>);
    }
  });

  return { left, right, hasChanges };
}

/**
 * Diff-aligned side-by-side view with merge controls (VS Code style).
 *
 * Uses diffArrays with a fuzzy comparator to find matching paragraphs
 * as anchors, then aligns everything between them. Adjacent remove+add
 * blocks are paired positionally with word-level diff within each pair.
 *
 * Gutter arrows let the user move individual paragraphs between panes:
 *   - left arrow accepts the revision into the original
 *   - right arrow pushes the original into the revision
 */
export default function DiffView({ leftContent, rightContent, colors, onUpdateLeft, onUpdateRight }) {
  const leftText = useMemo(() => htmlToText(leftContent), [leftContent]);
  const rightText = useMemo(() => htmlToText(rightContent), [rightContent]);

  const leftParas = useMemo(() => toParagraphs(leftText), [leftText]);
  const rightParas = useMemo(() => toParagraphs(rightText), [rightText]);

  const { rows, stats } = useMemo(() => {
    const ops = diffArrays(leftParas, rightParas, {
      comparator: (a, b) => a === b || wordOverlap(a, b) > 0.4,
    });

    const rows = [];
    let addedChars = 0;
    let removedChars = 0;
    let changeCount = 0;
    let leftIdx = 0;
    let rightIdx = 0;

    let i = 0;
    while (i < ops.length) {
      const op = ops[i];

      if (!op.added && !op.removed) {
        for (let j = 0; j < op.value.length; j++) {
          const lp = leftParas[leftIdx++];
          const rp = rightParas[rightIdx++];
          if (lp === rp) {
            rows.push({ type: 'equal', leftText: lp, rightText: rp });
          } else {
            changeCount++;
            const { left, right } = wordDiffSpans(lp, rp);
            const parts = diffWords(lp, rp);
            parts.forEach((p) => {
              if (p.added) addedChars += p.value.length;
              if (p.removed) removedChars += p.value.length;
            });
            rows.push({ type: 'changed', leftText: lp, rightText: rp, leftSpans: left, rightSpans: right });
          }
        }
        i++;
      } else if (op.removed && i + 1 < ops.length && ops[i + 1].added) {
        const remCount = op.value.length;
        const addCount = ops[i + 1].value.length;
        const maxCount = Math.max(remCount, addCount);

        for (let j = 0; j < maxCount; j++) {
          const lp = j < remCount ? leftParas[leftIdx++] : null;
          const rp = j < addCount ? rightParas[rightIdx++] : null;

          if (lp && rp) {
            changeCount++;
            const { left, right } = wordDiffSpans(lp, rp);
            const parts = diffWords(lp, rp);
            parts.forEach((p) => {
              if (p.added) addedChars += p.value.length;
              if (p.removed) removedChars += p.value.length;
            });
            rows.push({ type: 'changed', leftText: lp, rightText: rp, leftSpans: left, rightSpans: right });
          } else if (lp) {
            changeCount++;
            removedChars += lp.length;
            rows.push({ type: 'removed', leftText: lp });
          } else {
            changeCount++;
            addedChars += rp.length;
            rows.push({ type: 'added', rightText: rp });
          }
        }
        i += 2;
      } else if (op.removed) {
        for (let j = 0; j < op.value.length; j++) {
          const lp = leftParas[leftIdx++];
          changeCount++;
          removedChars += lp.length;
          rows.push({ type: 'removed', leftText: lp });
        }
        i++;
      } else {
        for (let j = 0; j < op.value.length; j++) {
          const rp = rightParas[rightIdx++];
          changeCount++;
          addedChars += rp.length;
          rows.push({ type: 'added', rightText: rp });
        }
        i++;
      }
    }

    return { rows, stats: { added: addedChars, removed: removedChars, changes: changeCount } };
  }, [leftParas, rightParas]);

  // Accept revision: copy right paragraph into the left document at this row
  const handleAcceptRight = useCallback((rowIdx) => {
    if (!onUpdateLeft) return;
    const newParas = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (i === rowIdx) {
        // Use the right side for this row
        if (r.rightText) newParas.push(r.rightText);
        // If no rightText (removed row), accepting means deleting from left — skip it
      } else {
        // Keep left side for all other rows
        if (r.type === 'equal' || r.type === 'changed' || r.type === 'removed') {
          newParas.push(r.leftText);
        }
        // Skip 'added' rows — they don't exist in the left document
      }
    }
    onUpdateLeft(newParas.join('\n\n'));
  }, [rows, onUpdateLeft]);

  // Keep original: copy left paragraph into the right document at this row
  const handleAcceptLeft = useCallback((rowIdx) => {
    if (!onUpdateRight) return;
    const newParas = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (i === rowIdx) {
        // Use the left side for this row
        if (r.leftText) newParas.push(r.leftText);
        // If no leftText (added row), rejecting means deleting from right — skip it
      } else {
        // Keep right side for all other rows
        if (r.type === 'equal' || r.type === 'changed' || r.type === 'added') {
          newParas.push(r.rightText);
        }
        // Skip 'removed' rows — they don't exist in the right document
      }
    }
    onUpdateRight(newParas.join('\n\n'));
  }, [rows, onUpdateRight]);

  // Bulk: accept all revisions into the left document
  const handleAcceptAll = useCallback(() => {
    if (!onUpdateLeft) return;
    onUpdateLeft(rightParas.join('\n\n'));
  }, [rightParas, onUpdateLeft]);

  // Bulk: reject all revisions (push original into right)
  const handleRejectAll = useCallback(() => {
    if (!onUpdateRight) return;
    onUpdateRight(leftParas.join('\n\n'));
  }, [leftParas, onUpdateRight]);

  // Inline edit: rebuild the document when a cell is edited and blurred
  const handleCellEdit = useCallback((rowIdx, side, newText) => {
    const text = newText.trim();
    if (side === 'left') {
      if (!onUpdateLeft) return;
      const row = rows[rowIdx];
      if (text === (row.leftText || '')) return; // unchanged
      const newParas = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.type === 'equal' || r.type === 'changed' || r.type === 'removed') {
          if (i === rowIdx) {
            if (text) newParas.push(text); // empty = delete paragraph
          } else {
            newParas.push(r.leftText);
          }
        }
      }
      onUpdateLeft(newParas.join('\n\n'));
    } else {
      if (!onUpdateRight) return;
      const row = rows[rowIdx];
      if (text === (row.rightText || '')) return; // unchanged
      const newParas = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.type === 'equal' || r.type === 'changed' || r.type === 'added') {
          if (i === rowIdx) {
            if (text) newParas.push(text);
          } else {
            newParas.push(r.rightText);
          }
        }
      }
      onUpdateRight(newParas.join('\n\n'));
    }
  }, [rows, onUpdateLeft, onUpdateRight]);

  const c = colors;
  const removedBg = 'rgba(239,68,68,0.08)';
  const addedBg = 'rgba(34,197,94,0.08)';
  const spacerBg = c.bg;
  const canMerge = !!(onUpdateLeft || onUpdateRight);
  const gridCols = canMerge ? '1fr 28px 1fr' : '1fr 1px 1fr';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Diff stats bar */}
      <div
        className="flex items-center gap-3 px-3 py-1 shrink-0 text-xs"
        style={{ background: c.chrome, borderBottom: `1px solid ${c.chromeBorder}` }}
      >
        <span style={{ color: c.chromeText }} className="font-semibold">Diff View</span>
        {stats.added > 0 && <span style={{ color: '#22C55E' }}>+{stats.added} chars</span>}
        {stats.removed > 0 && <span style={{ color: '#EF4444' }}>{'\u2212'}{stats.removed} chars</span>}
        <div className="flex-1" />
        {canMerge && stats.changes > 0 && (
          <>
            <button
              onClick={handleAcceptAll}
              className="px-2 py-0.5 rounded font-semibold transition-colors"
              style={{ background: '#22C55E20', color: '#22C55E', fontSize: 10 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#22C55E40'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#22C55E20'; }}
              title="Accept all revisions into the original"
            >
              Accept All {'\u2190'}
            </button>
            <button
              onClick={handleRejectAll}
              className="px-2 py-0.5 rounded font-semibold transition-colors"
              style={{ background: '#EF444420', color: '#EF4444', fontSize: 10 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#EF444440'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#EF444420'; }}
              title="Reject all revisions (push original to revised)"
            >
              {'\u2192'} Reject All
            </button>
          </>
        )}
        <span style={{ color: c.statusText }} className="text-[10px]">
          {stats.changes} {stats.changes === 1 ? 'change' : 'changes'}
          {' \u00b7 '}{leftParas.length} / {rightParas.length} paras
        </span>
      </div>

      {/* Column headers */}
      <div
        className="shrink-0"
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          borderBottom: `1px solid ${c.chromeBorder}`,
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide px-4 py-1" style={{ color: '#EF4444', background: c.bg }}>
          Original
        </div>
        <div style={{ background: c.chrome }} />
        <div className="text-[10px] font-bold uppercase tracking-wide px-4 py-1" style={{ color: '#22C55E', background: c.bg }}>
          Revised
        </div>
      </div>

      {/* Aligned paragraph rows — single scroll container */}
      <div className="flex-1 overflow-y-auto" style={{ background: c.bg }}>
        {rows.map((row, idx) => {
          const isChange = row.type !== 'equal';
          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                borderBottom: `1px solid ${c.chromeBorder}22`,
              }}
            >
              {/* Left cell */}
              {row.type === 'added' ? (
                <div
                  className="font-mono text-sm leading-relaxed px-4 py-2"
                  style={{ background: spacerBg, opacity: 0.3, color: c.text }}
                >
                  {'\u00a0'}
                </div>
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleCellEdit(idx, 'left', e.currentTarget.textContent)}
                  className="font-mono text-sm leading-relaxed px-4 py-2 whitespace-pre-wrap outline-none"
                  style={{
                    color: c.text,
                    cursor: 'text',
                    background: row.type === 'removed' ? removedBg : row.type === 'changed' ? removedBg : c.bg,
                  }}
                >
                  {row.type === 'equal' && row.leftText}
                  {row.type === 'changed' && row.leftSpans}
                  {row.type === 'removed' && row.leftText}
                </div>
              )}

              {/* Gutter with merge arrows */}
              <div
                className="flex flex-col items-center justify-center gap-0.5"
                style={{ background: isChange ? c.chrome : c.bg }}
              >
                {canMerge && isChange && (
                  <>
                    {(row.type === 'changed' || row.type === 'added') && (
                      <button
                        onClick={() => handleAcceptRight(idx)}
                        className="rounded transition-colors"
                        style={{
                          color: '#22C55E',
                          fontSize: 11,
                          lineHeight: 1,
                          padding: '1px 3px',
                          cursor: 'pointer',
                          background: 'transparent',
                          border: 'none',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#22C55E30'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        title="Accept revision (copy right \u2192 left)"
                      >
                        {'\u2190'}
                      </button>
                    )}
                    {(row.type === 'changed' || row.type === 'removed') && (
                      <button
                        onClick={() => handleAcceptLeft(idx)}
                        className="rounded transition-colors"
                        style={{
                          color: '#EF4444',
                          fontSize: 11,
                          lineHeight: 1,
                          padding: '1px 3px',
                          cursor: 'pointer',
                          background: 'transparent',
                          border: 'none',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#EF444430'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        title="Keep original (copy left \u2192 right)"
                      >
                        {'\u2192'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Right cell */}
              {row.type === 'removed' ? (
                <div
                  className="font-mono text-sm leading-relaxed px-4 py-2"
                  style={{ background: spacerBg, opacity: 0.3, color: c.text }}
                >
                  {'\u00a0'}
                </div>
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleCellEdit(idx, 'right', e.currentTarget.textContent)}
                  className="font-mono text-sm leading-relaxed px-4 py-2 whitespace-pre-wrap outline-none"
                  style={{
                    color: c.text,
                    cursor: 'text',
                    background: row.type === 'added' ? addedBg : row.type === 'changed' ? addedBg : c.bg,
                  }}
                >
                  {row.type === 'equal' && row.rightText}
                  {row.type === 'changed' && row.rightSpans}
                  {row.type === 'added' && row.rightText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
