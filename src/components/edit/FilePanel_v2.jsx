import React, { useCallback, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import useProjectStore from '../../store/useProjectStore';
import { ensureDir } from '../../services/arcwriteFS';
import FileContextMenu from './FileContextMenu';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.markdown', '.mdown', '.mkd', '.json', '.js', '.jsx', '.py']);

// Module-level ref for drag payload (avoids dataTransfer serialization issues)
let dragPayload = null;

/** Move a single file from one directory to another via copy+delete. */
async function moveFile(sourceHandle, sourceName, sourceParentHandle, destDirHandle) {
  const file = await sourceHandle.getFile();
  const buf = await file.arrayBuffer();
  const newHandle = await destDirHandle.getFileHandle(sourceName, { create: true });
  const writable = await newHandle.createWritable();
  await writable.write(buf);
  await writable.close();
  await sourceParentHandle.removeEntry(sourceName);
  return newHandle;
}

/** Copy all entries from one directory into another recursively. */
async function copyDirContents(srcDirHandle, destDirHandle) {
  for await (const [name, handle] of srcDirHandle.entries()) {
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      const newHandle = await destDirHandle.getFileHandle(name, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(buf);
      await writable.close();
    } else {
      const newSubDir = await destDirHandle.getDirectoryHandle(name, { create: true });
      await copyDirContents(handle, newSubDir);
    }
  }
}

/** Move a directory recursively from one parent to another via copy+delete. */
async function moveDir(sourceDirHandle, sourceName, sourceParentHandle, destDirHandle) {
  const newDir = await destDirHandle.getDirectoryHandle(sourceName, { create: true });
  await copyDirContents(sourceDirHandle, newDir);
  await sourceParentHandle.removeEntry(sourceName, { recursive: true });
  return newDir;
}

/** Collect all visible (expanded) paths from the tree in order. */
function collectVisiblePaths(tree) {
  const paths = [];
  for (const node of tree) {
    paths.push(node.path);
    if (node.type === 'dir' && node.expanded && node.children) {
      paths.push(...collectVisiblePaths(node.children));
    }
  }
  return paths;
}

/** Find a node by path in the tree. */
function findNode(tree, path) {
  for (const node of tree) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** Write the green-dotted file paths to .contextinclude in the root directory. */
async function writeContextInclude(directoryHandle, contextPaths) {
  try {
    const fileHandle = await directoryHandle.getFileHandle('.contextinclude', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(Object.keys(contextPaths).join('\n'));
    await writable.close();
  } catch (e) {
    console.warn('[FilePanel] Failed to write .contextinclude:', e);
  }
}

/** Read .contextinclude and return { paths, content } to restore green-dot state. */
async function loadContextInclude(dirHandle, fileTree) {
  const result = { paths: {}, content: {} };
  try {
    const fileHandle = await dirHandle.getFileHandle('.contextinclude');
    const file = await fileHandle.getFile();
    const text = await file.text();
    const filePaths = text.split('\n').map((p) => p.trim()).filter(Boolean);
    await Promise.all(filePaths.map(async (path) => {
      result.paths[path] = true;
      const node = findNode(fileTree, path);
      if (node?.handle && node.type === 'file') {
        try {
          const f = await node.handle.getFile();
          result.content[path] = await f.text();
        } catch { /* file may have moved */ }
      }
    }));
  } catch { /* .contextinclude doesn't exist yet */ }
  return result;
}

/** Collect all file paths (non-dir) from a tree node recursively. */
function collectFilePaths(node) {
  if (node.type === 'file' || node.type === 'other') return [node.path];
  if (node.type === 'dir' && node.children) return node.children.flatMap(collectFilePaths);
  return [];
}

/** Recursively read a directory handle into a tree structure. */
export async function buildFileTree(dirHandle, parentPath = '') {
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    const path = parentPath ? `${parentPath}/${name}` : name;
    console.log(`[FileTree] "${name}" kind=${handle.kind} path="${path}"`);
    if (handle.kind === 'directory') {
      const children = await buildFileTree(handle, path);
      entries.push({ name, path, handle, type: 'dir', children, expanded: false });
    } else {
      const ext = name.lastIndexOf('.') >= 0 ? name.substring(name.lastIndexOf('.')) : '';
      if (TEXT_EXTENSIONS.has(ext.toLowerCase())) {
        entries.push({ name, path, handle, type: 'file' });
      } else {
        // Show non-text files as disabled so nothing is invisibly hidden
        entries.push({ name, path, handle, type: 'other' });
      }
    }
  }
  return entries.sort((a, b) => {
    if (a.type !== b.type) {
      if (a.type === 'dir') return -1;
      if (b.type === 'dir') return 1;
      if (a.type === 'other') return 1;
      if (b.type === 'other') return -1;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Find the directory handle for a given path by walking the tree. */
function findDirHandle(tree, path) {
  for (const node of tree) {
    if (node.type === 'dir' && node.path === path) return node.handle;
    if (node.children) {
      const found = findDirHandle(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** Find parent directory path for a node path. */
function parentPath(path) {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.substring(0, i) : '';
}

export default function FilePanel() {
  const directoryHandle = useEditorStore((s) => s.directoryHandle);
  const fileTree = useEditorStore((s) => s.fileTree);
  const setDirectoryHandle = useEditorStore((s) => s.setDirectoryHandle);
  const setFileTree = useEditorStore((s) => s.setFileTree);
  const toggleTreeNode = useEditorStore((s) => s.toggleTreeNode);
  const openTab = useEditorStore((s) => s.openTab);
  const tabs = useEditorStore((s) => s.tabs);
  const renameTab = useEditorStore((s) => s.renameTab);
  const contextPaths = useEditorStore((s) => s.contextPaths);
  const toggleContextPath = useEditorStore((s) => s.toggleContextPath);
  const setContextPaths = useEditorStore((s) => s.setContextPaths);
  const setContextContent = useEditorStore((s) => s.setContextContent);
  const selectedPaths = useEditorStore((s) => s.selectedPaths);
  const selectPath = useEditorStore((s) => s.selectPath);
  const selectRange = useEditorStore((s) => s.selectRange);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const updateTabPath = useEditorStore((s) => s.updateTabPath);

  // Project store state for smart folder opening
  const isInitialized = useProjectStore((s) => s.isInitialized);
  const activeBookProject = useProjectStore((s) => s.activeBookProject);

  const handleToggleContext = useCallback(async (node) => {
    const isAdding = !contextPaths[node.path];
    toggleContextPath(node.path);
    if (isAdding && node.type === 'file' && node.handle) {
      try {
        const f = await node.handle.getFile();
        setContextContent(node.path, await f.text());
      } catch (e) {
        console.warn('[FilePanel] Could not read file for context:', e);
      }
    }
    if (directoryHandle) {
      await writeContextInclude(directoryHandle, useEditorStore.getState().contextPaths);
    }
  }, [contextPaths, toggleContextPath, setContextContent, directoryHandle]);

  const handleToggleFolderContext = useCallback(async (node) => {
    const paths = collectFilePaths(node);
    const allIn = paths.length > 0 && paths.every((p) => contextPaths[p]);
    setContextPaths(paths, !allIn);
    if (!allIn && directoryHandle) {
      await Promise.all(paths.map(async (path) => {
        const fileNode = findNode(fileTree, path);
        if (fileNode?.handle && fileNode.type === 'file') {
          try {
            const f = await fileNode.handle.getFile();
            setContextContent(path, await f.text());
          } catch { /* skip */ }
        }
      }));
    }
    if (directoryHandle) {
      await writeContextInclude(directoryHandle, useEditorStore.getState().contextPaths);
    }
  }, [contextPaths, setContextPaths, setContextContent, directoryHandle, fileTree]);

  const [renamingPath, setRenamingPath] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [dropTargetPath, setDropTargetPath] = useState(null); // path of dir being hovered for drop

  const handleDragStart = useCallback((e, node) => {
    // If dragged node is in selection, drag all selected; otherwise just this one
    const paths = selectedPaths[node.path]
      ? Object.keys(selectedPaths)
      : [node.path];
    dragPayload = paths;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', paths.join('\n'));
  }, [selectedPaths]);

  const handleDrop = useCallback(async (e, destPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetPath(null);
    if (!dragPayload || dragPayload.length === 0) return;

    const destDirHandle = destPath === ''
      ? directoryHandle
      : findDirHandle(fileTree, destPath);
    if (!destDirHandle) return;

    try {
      for (const srcPath of dragPayload) {
        const srcNode = findNode(fileTree, srcPath);
        if (!srcNode) continue;

        // Can't drop into same parent
        const srcParent = parentPath(srcPath);
        if (srcParent === destPath) continue;

        // Can't drop folder into itself or descendant
        if (srcNode.type === 'dir' && (destPath === srcPath || destPath.startsWith(srcPath + '/'))) continue;

        // Check name conflict
        let conflict = false;
        try {
          if (srcNode.type === 'dir') {
            await destDirHandle.getDirectoryHandle(srcNode.name);
            conflict = true;
          } else {
            await destDirHandle.getFileHandle(srcNode.name);
            conflict = true;
          }
        } catch { /* no conflict */ }
        if (conflict) {
          window.alert(`"${srcNode.name}" already exists in the destination folder.`);
          continue;
        }

        const srcParentHandle = srcParent === ''
          ? directoryHandle
          : findDirHandle(fileTree, srcParent);
        if (!srcParentHandle) continue;

        const newPath = destPath ? `${destPath}/${srcNode.name}` : srcNode.name;

        if (srcNode.type === 'dir') {
          await moveDir(srcNode.handle, srcNode.name, srcParentHandle, destDirHandle);
        } else {
          const newHandle = await moveFile(srcNode.handle, srcNode.name, srcParentHandle, destDirHandle);
          // Update open tab if this file was open
          const tab = tabs.find((t) => t.id === srcPath);
          if (tab) updateTabPath(srcPath, newPath, newHandle);
        }

        // Update context paths
        if (contextPaths[srcPath]) {
          const next = { ...useEditorStore.getState().contextPaths };
          delete next[srcPath];
          next[newPath] = true;
          useEditorStore.setState({ contextPaths: next });
        }
      }
    } catch (err) {
      console.error('Move failed:', err);
      window.alert(`Move failed: ${err.message}`);
    }

    // Refresh tree
    const tree = await buildFileTree(directoryHandle);
    setFileTree(tree);
    clearSelection();
    dragPayload = null;
  }, [directoryHandle, fileTree, tabs, contextPaths, updateTabPath, setFileTree, clearSelection]);

  const handleNodeClick = useCallback((e, node) => {
    if (e.shiftKey) {
      e.preventDefault();
      const visible = collectVisiblePaths(fileTree);
      selectRange(node.path, visible);
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      selectPath(node.path, true);
    } else {
      selectPath(node.path, false);
    }
  }, [fileTree, selectPath, selectRange]);

  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const supportsFileSystem = typeof window.showDirectoryPicker === 'function';

  const handleOpenFolder = useCallback(async () => {
    // Smart open: use active book project or projects/books/ when available
    const { arcwriteHandle, activeBookProject: abp, isInitialized: init } = useProjectStore.getState();
    if (init && arcwriteHandle) {
      try {
        let handle;
        if (abp) {
          const booksDir = await ensureDir(arcwriteHandle, 'projects', 'books');
          handle = await booksDir.getDirectoryHandle(abp);
        } else {
          handle = await ensureDir(arcwriteHandle, 'projects', 'books');
        }
        setDirectoryHandle(handle);
        const tree = await buildFileTree(handle);
        setFileTree(tree);
        const { paths, content } = await loadContextInclude(handle, tree);
        useEditorStore.setState({ contextPaths: paths, contextContent: content });
        return;
      } catch (e) {
        console.warn('[FilePanel] Smart folder open failed, falling back to picker:', e);
      }
    }
    // Fallback: browser directory picker
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
      setDirectoryHandle(handle);
      const tree = await buildFileTree(handle);
      setFileTree(tree);
      const { paths, content } = await loadContextInclude(handle, tree);
      useEditorStore.setState({ contextPaths: paths, contextContent: content });
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Failed to open folder:', e);
    }
  }, [setDirectoryHandle, setFileTree]);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
      setDirectoryHandle(handle);
      const tree = await buildFileTree(handle);
      setFileTree(tree);
      const { paths, content } = await loadContextInclude(handle, tree);
      useEditorStore.setState({ contextPaths: paths, contextContent: content });
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Failed to open folder:', e);
    }
  }, [setDirectoryHandle, setFileTree]);

  const handleRefresh = useCallback(async () => {
    if (!directoryHandle) return;
    const tree = await buildFileTree(directoryHandle);
    setFileTree(tree);
  }, [directoryHandle, setFileTree]);

  const handleFileClick = useCallback(async (node) => {
    try {
      const file = await node.handle.getFile();
      const content = await file.text();
      openTab(node.path, node.name, content, node.handle);
    } catch (e) {
      console.error('Failed to read file:', e);
    }
  }, [openTab]);

  const handleNewFile = useCallback(async (parentDirHandle, parentDirPath) => {
    if (!parentDirHandle) return;
    let name = window.prompt('File name:', 'untitled.md');
    if (!name) return;
    // Auto-append .md if user didn't include a text extension
    const hasExt = name.lastIndexOf('.') > 0;
    if (!hasExt) name = name + '.md';
    try {
      const fileHandle = await parentDirHandle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write('');
      await writable.close();
      const path = parentDirPath ? `${parentDirPath}/${name}` : name;
      // Refresh tree, then open the new file
      const tree = await buildFileTree(directoryHandle);
      setFileTree(tree);
      openTab(path, name, '', fileHandle);
    } catch (e) {
      console.error('Failed to create file:', e);
    }
  }, [directoryHandle, setFileTree, openTab]);

  const handleNewFolder = useCallback(async (parentDirHandle, parentDirPath) => {
    if (!parentDirHandle) return;
    // Count existing "Folder" dirs for default name
    let count = 1;
    try {
      for await (const [n, h] of parentDirHandle.entries()) {
        if (h.kind === 'directory' && n.startsWith('Folder')) count++;
      }
    } catch { /* ignore */ }
    const name = window.prompt('Folder name:', `Folder ${String(count).padStart(3, '0')}`);
    if (!name) return;
    try {
      const newDirHandle = await parentDirHandle.getDirectoryHandle(name, { create: true });
      console.log(`[FilePanel] Created folder "${name}" kind=${newDirHandle.kind}`);
      const tree = await buildFileTree(directoryHandle);
      setFileTree(tree);
    } catch (e) {
      console.error('Failed to create folder:', e);
      window.alert(`Failed to create folder: ${e.message}`);
    }
  }, [directoryHandle, setFileTree]);

  // Rename: start inline editing
  const startRename = useCallback((path, currentName) => {
    setRenamingPath(path);
    setRenameValue(currentName);
  }, []);

  // Rename: commit
  const commitRename = useCallback(async (node) => {
    const newName = renameValue.trim();
    setRenamingPath(null);
    if (!newName || newName === node.name) return;

    try {
      // Get parent directory handle
      const pp = parentPath(node.path);
      const parentDir = pp ? findDirHandle(fileTree, pp) : directoryHandle;
      if (!parentDir) return;

      const newPath = pp ? `${pp}/${newName}` : newName;

      if (node.type === 'file' || node.type === 'other') {
        // Read old content, create new file, write, delete old
        const file = await node.handle.getFile();
        const buf = await file.arrayBuffer();
        const newHandle = await parentDir.getFileHandle(newName, { create: true });
        const writable = await newHandle.createWritable();
        await writable.write(buf);
        await writable.close();
        await parentDir.removeEntry(node.name);

        // Update open tab
        const tab = tabs.find((t) => t.id === node.path);
        if (tab) updateTabPath(node.path, newPath, newHandle);

        // Update context path
        if (contextPaths[node.path]) {
          const next = { ...useEditorStore.getState().contextPaths };
          delete next[node.path];
          next[newPath] = true;
          useEditorStore.setState({ contextPaths: next });
        }
      } else {
        // Directory rename: create new dir, copy contents, delete old
        const newDirHandle = await parentDir.getDirectoryHandle(newName, { create: true });
        await copyDirContents(node.handle, newDirHandle);
        await parentDir.removeEntry(node.name, { recursive: true });

        // Update open tabs and context paths for all files inside
        const oldPrefix = node.path + '/';
        const store = useEditorStore.getState();
        for (const tab of store.tabs) {
          if (tab.id === node.path || tab.id.startsWith(oldPrefix)) {
            const updatedPath = newPath + tab.id.substring(node.path.length);
            store.updateTabPath(tab.id, updatedPath, null);
          }
        }
        const ctxNext = { ...store.contextPaths };
        let ctxChanged = false;
        for (const cp of Object.keys(ctxNext)) {
          if (cp.startsWith(oldPrefix)) {
            delete ctxNext[cp];
            ctxNext[newPath + cp.substring(node.path.length)] = true;
            ctxChanged = true;
          }
        }
        if (ctxChanged) useEditorStore.setState({ contextPaths: ctxNext });
      }

      // Refresh tree
      const tree = await buildFileTree(directoryHandle);
      setFileTree(tree);
    } catch (e) {
      console.error('Rename failed:', e);
    }
  }, [renameValue, fileTree, directoryHandle, tabs, contextPaths, updateTabPath, setFileTree]);

  // Delete file or folder
  const handleDelete = useCallback(async (node) => {
    const what = node.type === 'dir' ? `folder "${node.name}" and all its contents` : `"${node.name}"`;
    if (!window.confirm(`Delete ${what}?`)) return;

    try {
      const pp = parentPath(node.path);
      const parentDir = pp ? findDirHandle(fileTree, pp) : directoryHandle;
      if (!parentDir) return;

      if (node.type === 'dir') {
        await parentDir.removeEntry(node.name, { recursive: true });

        // Close tabs and remove context paths for all files inside
        const prefix = node.path + '/';
        const store = useEditorStore.getState();
        for (const tab of [...store.tabs]) {
          if (tab.id.startsWith(prefix)) store.closeTab(tab.id);
        }
        const ctxNext = { ...store.contextPaths };
        let ctxChanged = false;
        for (const cp of Object.keys(ctxNext)) {
          if (cp.startsWith(prefix)) { delete ctxNext[cp]; ctxChanged = true; }
        }
        if (ctxChanged) useEditorStore.setState({ contextPaths: ctxNext });
      } else {
        await parentDir.removeEntry(node.name);

        // Close tab if open
        const store = useEditorStore.getState();
        const tab = store.tabs.find((t) => t.id === node.path);
        if (tab) store.closeTab(node.path);

        // Remove from context paths
        if (store.contextPaths[node.path]) {
          const ctxNext = { ...store.contextPaths };
          delete ctxNext[node.path];
          useEditorStore.setState({ contextPaths: ctxNext });
        }
      }

      const tree = await buildFileTree(directoryHandle);
      setFileTree(tree);
    } catch (e) {
      console.error('Delete failed:', e);
      window.alert(`Delete failed: ${e.message}`);
    }
  }, [fileTree, directoryHandle, setFileTree]);

  if (!supportsFileSystem) {
    return (
      <div className="p-4 text-sm text-gray-500">
        <p className="mb-2 font-medium text-gray-700">File System Access not available</p>
        <p className="text-xs">
          This feature requires Chrome or Edge. Use the editor with copy/paste, or switch to a Chromium-based browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-black/10 shrink-0 flex-wrap">
        <button
          onClick={handleOpenFolder}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium transition-colors"
          title={activeBookProject ? `Open ${activeBookProject}` : 'Open book projects folder'}
        >
          {activeBookProject ? `\uD83D\uDCC2 ${activeBookProject}` : 'Open Folder'}
        </button>
        {isInitialized && (
          <button
            onClick={handleBrowseFolder}
            className="text-[10px] text-gray-400 hover:text-gray-600 px-1 transition-colors"
            title="Browse any folder"
          >
            Browse\u2026
          </button>
        )}
        {directoryHandle && (
          <>
            <button
              onClick={() => handleNewFile(directoryHandle, '')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium transition-colors"
              title="New file in root"
            >
              + File
            </button>
            <button
              onClick={() => handleNewFolder(directoryHandle, '')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium transition-colors"
              title="New folder in root"
            >
              + Folder
            </button>
            <button
              onClick={handleRefresh}
              className="text-xs text-gray-500 hover:text-black px-1.5 py-1 rounded hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              {'\u21BB'}
            </button>
          </>
        )}
      </div>

      {directoryHandle && (
        <div className="px-2 py-1 border-b border-black/5 shrink-0">
          <span className="text-[10px] text-gray-400 truncate block" title={directoryHandle.name}>
            {directoryHandle.name}/
          </span>
        </div>
      )}

      {/* File tree */}
      <div
        className={`flex-1 overflow-y-auto p-1 ${dropTargetPath === '' ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}
        onDragOver={(e) => {
          if (!dragPayload) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTargetPath('');
        }}
        onDragLeave={(e) => {
          // Only clear if leaving the container itself
          if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetPath(null);
        }}
        onDrop={(e) => handleDrop(e, '')}
      >
        {!directoryHandle && (
          <p className="text-xs text-gray-400 p-2">Click "Open Folder" to browse local files.</p>
        )}
        {fileTree.length === 0 && directoryHandle && (
          <p className="text-xs text-gray-400 p-2">Empty folder. Use "+ File" to create a file.</p>
        )}
        {fileTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onToggle={toggleTreeNode}
            onFileClick={handleFileClick}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            renamingPath={renamingPath}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onStartRename={startRename}
            onCommitRename={commitRename}
            contextPaths={contextPaths}
            onToggleContext={handleToggleContext}
            onToggleFolderContext={handleToggleFolderContext}
            onContextMenu={handleContextMenu}
            selectedPaths={selectedPaths}
            onNodeClick={handleNodeClick}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            dropTargetPath={dropTargetPath}
            setDropTargetPath={setDropTargetPath}
          />
        ))}
      </div>

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onRename={(node) => startRename(node.path, node.name)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function ContextDot({ active, onClick, title }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 11, height: 11,
        borderRadius: '50%',
        background: active ? '#22C55E' : '#9CA3AF',
        cursor: 'pointer',
        flexShrink: 0,
        marginLeft: 'auto',
        transition: 'background 0.15s',
      }}
      title={title}
    />
  );
}

function TreeNode({ node, depth, onToggle, onFileClick, onNewFile, onNewFolder, renamingPath, renameValue, setRenameValue, onStartRename, onCommitRename, contextPaths, onToggleContext, onToggleFolderContext, onContextMenu, selectedPaths, onNodeClick, onDragStart, onDrop, dropTargetPath, setDropTargetPath }) {
  const indent = depth * 16;
  const isRenaming = renamingPath === node.path;
  const isSelected = !!selectedPaths[node.path];
  const isDropTarget = dropTargetPath === node.path;
  const selClass = isSelected ? ' bg-blue-100' : '';

  // Common drag props for all node types
  const dragProps = {
    draggable: true,
    onDragStart: (e) => onDragStart(e, node),
    onDragEnd: () => setDropTargetPath(null),
  };

  // Drop props for directory nodes
  const dropProps = node.type === 'dir' ? {
    onDragOver: (e) => {
      if (!dragPayload) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetPath(node.path);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        if (dropTargetPath === node.path) setDropTargetPath(null);
      }
    },
    onDrop: (e) => { e.stopPropagation(); onDrop(e, node.path); },
  } : {};

  if (node.type === 'other') {
    const inContext = !!contextPaths[node.path];
    return (
      <div
        className={`flex items-center gap-1 w-full text-left px-1 py-0.5 text-sm text-gray-300 rounded${selClass}`}
        style={{ paddingLeft: indent + 4 + 16 }}
        title={`"${node.name}" — not a text file (kind: ${node.handle?.kind})`}
        onContextMenu={(e) => onContextMenu(e, node)}
        onClick={(e) => onNodeClick(e, node)}
        {...dragProps}
      >
        <span className="shrink-0">{'\u25A1'}</span>
        <span className="truncate">{node.name}</span>
        <ContextDot
          active={inContext}
          onClick={() => onToggleContext(node)}
          title={inContext ? 'In AI context (click to remove)' : 'Not in AI context (click to add)'}
        />
      </div>
    );
  }

  if (node.type === 'dir') {
    const descendantPaths = collectFilePaths(node);
    const allIn = descendantPaths.length > 0 && descendantPaths.every((p) => contextPaths[p]);
    return (
      <>
        <div
          className={`group flex items-center gap-1 w-full text-left px-1 py-0.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors${selClass}${isDropTarget ? ' ring-2 ring-blue-400 bg-blue-50' : ''}`}
          style={{ paddingLeft: indent + 4 }}
          onContextMenu={(e) => onContextMenu(e, node)}
          onClick={(e) => onNodeClick(e, node)}
          {...dragProps}
          {...dropProps}
        >
          <span onClick={(e) => { e.stopPropagation(); onToggle(node.path); }} className="text-xs w-3 text-center text-gray-400 shrink-0 cursor-pointer">
            {node.expanded ? '\u25BE' : '\u25B8'}
          </span>
          <span className="text-gray-400 shrink-0">{'\uD83D\uDCC1'}</span>
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => onCommitRename(node)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitRename(node);
                if (e.key === 'Escape') onStartRename(null, '');
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 text-sm bg-white border border-blue-400 rounded px-1 py-0 outline-none"
            />
          ) : (
            <span
              className="truncate flex-1 min-w-0"
              onDoubleClick={(e) => { e.stopPropagation(); onStartRename(node.path, node.name); }}
            >
              {node.name}
            </span>
          )}
          {/* Inline actions on hover */}
          <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onNewFile(node.handle, node.path); }}
              className="text-xs text-gray-400 hover:text-black px-0.5"
              title="New file here"
            >
              +f
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onNewFolder(node.handle, node.path); }}
              className="text-xs text-gray-400 hover:text-black px-0.5"
              title="New folder here"
            >
              +d
            </button>
          </span>
          <ContextDot
            active={allIn}
            onClick={() => onToggleFolderContext(node)}
            title={allIn ? 'All files in AI context (click to remove)' : 'Add all files to AI context'}
          />
        </div>
        {node.expanded && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onToggle={onToggle}
            onFileClick={onFileClick}
            onNewFile={onNewFile}
            onNewFolder={onNewFolder}
            renamingPath={renamingPath}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onStartRename={onStartRename}
            onCommitRename={onCommitRename}
            contextPaths={contextPaths}
            onToggleContext={onToggleContext}
            onToggleFolderContext={onToggleFolderContext}
            onContextMenu={onContextMenu}
            selectedPaths={selectedPaths}
            onNodeClick={onNodeClick}
            onDragStart={onDragStart}
            onDrop={onDrop}
            dropTargetPath={dropTargetPath}
            setDropTargetPath={setDropTargetPath}
          />
        ))}
      </>
    );
  }

  const inContext = !!contextPaths[node.path];
  return (
    <div
      className={`flex items-center gap-1 w-full text-left px-1 py-0.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer${selClass}`}
      style={{ paddingLeft: indent + 4 + 16 }}
      onClick={(e) => {
        if (isRenaming) return;
        onNodeClick(e, node);
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) onFileClick(node);
      }}
      onDoubleClick={(e) => { e.stopPropagation(); onStartRename(node.path, node.name); }}
      onContextMenu={(e) => onContextMenu(e, node)}
      {...dragProps}
    >
      <span className="text-gray-400 shrink-0">{'\uD83D\uDCC4'}</span>
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => onCommitRename(node)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename(node);
            if (e.key === 'Escape') onStartRename(null, '');
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-sm bg-white border border-blue-400 rounded px-1 py-0 outline-none"
        />
      ) : (
        <span className="truncate">{node.name}</span>
      )}
      <ContextDot
        active={inContext}
        onClick={() => onToggleContext(node)}
        title={inContext ? 'In AI context (click to remove)' : 'Not in AI context (click to add)'}
      />
    </div>
  );
}
