import React, { useState, useEffect, useCallback } from 'react';
import useProjectStore from '../../store/useProjectStore';

/** Collapsible tree node for the artifacts browser. */
function TreeNode({ node, depth, onFileClick, selectedPath }) {
  const [expanded, setExpanded] = useState(depth === 0); // top-level open by default

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: `3px 4px 3px ${8 + depth * 14}px`,
            textAlign: 'left',
            fontSize: 12,
            color: 'inherit',
          }}
        >
          <span style={{ fontSize: 10, opacity: 0.6, width: 10 }}>{expanded ? '▼' : '▶'}</span>
          <span style={{ fontSize: 13, marginRight: 4 }}>📁</span>
          <span style={{ fontWeight: 600 }}>{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onFileClick={onFileClick}
            selectedPath={selectedPath}
          />
        ))}
      </div>
    );
  }

  const isSelected = node.path === selectedPath;
  const ext = node.name.split('.').pop()?.toLowerCase();
  const icon = ext === 'md' ? '📝' : ext === 'yaml' || ext === 'yml' ? '⚙️' : '📄';

  return (
    <button
      onClick={() => onFileClick(node)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        background: isSelected ? 'rgba(124,58,237,0.12)' : 'none',
        border: 'none',
        borderLeft: isSelected ? '3px solid #7C3AED' : '3px solid transparent',
        cursor: 'pointer',
        padding: `3px 4px 3px ${8 + depth * 14}px`,
        textAlign: 'left',
        fontSize: 12,
        color: isSelected ? '#7C3AED' : 'inherit',
        fontWeight: isSelected ? 600 : 400,
      }}
    >
      <span style={{ width: 10 }} />
      <span style={{ fontSize: 13, marginRight: 4 }}>{icon}</span>
      {node.name}
    </button>
  );
}

export default function ArtifactsPanel({ colors: c, isDark }) {
  const artifactsTree = useProjectStore((s) => s.artifactsTree);
  const isInitialized = useProjectStore((s) => s.isInitialized);

  const [selectedNode, setSelectedNode] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileClick = useCallback(async (node) => {
    if (selectedNode?.path === node.path) return;
    setSelectedNode(node);
    setLoading(true);
    try {
      const content = await useProjectStore.getState().readArtifactFile(node.path);
      setFileContent(content || '');
    } catch (e) {
      setFileContent(`(Error reading file: ${e.message})`);
    } finally {
      setLoading(false);
    }
  }, [selectedNode]);

  // Reload tree when panel becomes visible (in case it changed)
  useEffect(() => {
    if (isInitialized) {
      useProjectStore.getState().loadArtifacts();
    }
  }, [isInitialized]);

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const treeBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const previewBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)';

  if (!isInitialized) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: c.chromeText }}>
        Set up Arcwrite storage first to access artifacts.
      </div>
    );
  }

  if (artifactsTree.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: c.chromeText }}>
        Loading artifacts…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 380, border: `1px solid ${borderColor}`, borderRadius: 6, overflow: 'hidden' }}>
      {/* Tree pane */}
      <div style={{
        width: 220,
        flexShrink: 0,
        overflowY: 'auto',
        background: treeBg,
        borderRight: `1px solid ${borderColor}`,
        padding: '6px 0',
      }}>
        {artifactsTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onFileClick={handleFileClick}
            selectedPath={selectedNode?.path}
          />
        ))}
      </div>

      {/* Preview pane */}
      <div style={{ flex: 1, overflowY: 'auto', background: previewBg, padding: 12 }}>
        {loading && (
          <div style={{ fontSize: 11, color: c.chromeText }}>Loading…</div>
        )}
        {!loading && !selectedNode && (
          <div style={{ fontSize: 11, color: c.chromeText, marginTop: 20, textAlign: 'center' }}>
            Select a file to preview
          </div>
        )}
        {!loading && selectedNode && (
          <>
            <div style={{
              fontSize: 10,
              color: c.chromeText,
              marginBottom: 8,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {selectedNode.path}
            </div>
            <pre style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              color: c.text,
            }}>
              {fileContent}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
