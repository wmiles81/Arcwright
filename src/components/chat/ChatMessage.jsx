import React, { useState } from 'react';
import ChatActionBadge from './ChatActionBadge';
import { getBlobUrl } from '../../services/blobRegistry';

export default function ChatMessage({ message, onCopy, onRegenerate, onEdit }) {
  const isUser = message.role === 'user';
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    if (onCopy) onCopy();
  };

  return (
    <div
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'max-w-[95%] bg-g-chrome text-g-text border border-g-border'
            : 'w-full text-g-text'
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {formatText(message.content) || (
            !isUser && message.actions?.length > 0
              ? <span className="text-g-status italic text-xs">Ran {message.actions.length} action{message.actions.length !== 1 ? 's' : ''}</span>
              : null
          )}
        </div>

        {/* Image artifact preview */}
        {message.imageArtifact && (
          <ImagePreview artifact={message.imageArtifact} />
        )}

        {/* Attached files indicator */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-g-border">
            <div className="text-[10px] text-g-muted font-medium mb-1">Attached files:</div>
            {message.attachments.map((att, i) => (
              <div key={i} className="text-[10px] text-g-muted truncate">
                📎 {att.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-message action buttons */}
      <div
        className={`flex gap-1 mt-1 transition-opacity duration-150 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ActionButton icon="📋" title="Copy" onClick={handleCopy} />
        {!isUser && onRegenerate && (
          <ActionButton icon="🔄" title="Regenerate" onClick={onRegenerate} />
        )}
        {isUser && onEdit && (
          <ActionButton icon="✏️" title="Edit" onClick={() => onEdit(message)} />
        )}
      </div>

      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 max-w-[95%]">
          {message.actions.map((action, i) => (
            <ChatActionBadge key={i} action={action} />
          ))}
        </div>
      )}

      {/* Token usage for assistant messages */}
      {!isUser && message.usage && (
        <div className="mt-1">
          <span className="text-[9px] text-g-status font-mono tabular-nums">
            {message.usage.promptTokens?.toLocaleString()}in · {message.usage.completionTokens?.toLocaleString()}out
          </span>
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-g-chrome text-g-status hover:text-g-muted transition-colors text-xs"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

function ImagePreview({ artifact }) {
  const blobUrl = artifact.blobUrl || getBlobUrl(artifact.path);
  if (!blobUrl) return null;

  return (
    <div className="mt-2">
      <img
        src={blobUrl}
        alt={artifact.filename}
        className="max-w-full rounded-lg border border-g-border"
        style={{ maxHeight: 400 }}
      />
      <div className="text-[10px] text-g-status mt-1">
        {artifact.filename}
        {artifact.prompt && (
          <span className="ml-2 italic">
            {artifact.prompt.length > 80 ? artifact.prompt.substring(0, 80) + '...' : artifact.prompt}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal text formatting: bold (**text**) and inline code (`text`).
 * No markdown library needed — covers the most common LLM output patterns.
 */
function formatText(text) {
  if (!text) return null;

  // Split by lines, then process each line for bold and code spans
  return text.split('\n').map((line, i) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    // Process bold and code patterns
    const pattern = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(remaining)) !== null) {
      // Text before the match
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index));
      }

      if (match[2]) {
        // Bold: **text**
        parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
      } else if (match[3]) {
        // Code: `text`
        parts.push(
          <code key={key++} className="bg-g-chrome border border-g-border px-1 rounded text-xs">
            {match[3]}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last match
    if (lastIndex < remaining.length) {
      parts.push(remaining.slice(lastIndex));
    }

    // If no patterns found, just use the plain line
    if (parts.length === 0) {
      parts.push(line);
    }

    return (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {parts}
      </React.Fragment>
    );
  });
}
