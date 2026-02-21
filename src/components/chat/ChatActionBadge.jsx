import React from 'react';

const MAX_BADGE_CHARS = 200;

function summarize(text) {
  if (!text) return '';
  // Use first line only (avoid dumping multi-line file contents or JSON)
  const firstLine = text.split('\n')[0];
  return firstLine.length > MAX_BADGE_CHARS ? firstLine.slice(0, MAX_BADGE_CHARS) + '…' : firstLine;
}

export default function ChatActionBadge({ action }) {
  if (!action.success) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-300">
        <span>{'\u2717'}</span>
        <span>{summarize(action.error) || 'Failed'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-white text-black border border-black/30">
      <span>{'\u2713'}</span>
      <span>{summarize(action.description)}</span>
    </span>
  );
}
