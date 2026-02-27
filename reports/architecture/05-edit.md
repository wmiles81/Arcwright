# 5 — Edit Workflow

> **Entry points covered:** Open file (5.1), Save file (5.2), Run sequence from edit panel (5.3), Inline edit popup (5.4), Diff view (5.5), Dual-pane (5.6), File context selection (5.7).

---

## 5.0 — Edit Workflow Overview

```mermaid
graph TD
    subgraph EditWorkflow["EditWorkflow.jsx"]
        LeftPanel["Left Panel\n(tabs: Chat | Files | Sequences | Variables)"]
        MainEditor["Main Editor Area\n(MarkdownEditor / CodePane)"]
        SecondaryPane["Secondary Pane\n(dual-pane mode)"]
        Toolbar["Top Toolbar\n(pane controls, sync, diff, tools)"]
    end

    subgraph LeftTabs["Left Panel Tabs"]
        ChatTab["Chat Tab → ChatPanel"]
        FilesTab["Files Tab → FilePanel"]
        SeqTab["Sequences Tab → SequencesPanel"]
        VarsTab["Variables Tab → VariablesPanel"]
    end

    subgraph EditorStore["useEditorStore"]
        tabs["tabs[]\n(content, dirty, handle, path)"]
        activeTabId
        secondaryTabId
        fileTree["fileTree[]"]
        contextPaths["contextPaths[]\n(files in AI context)"]
    end

    subgraph FS["File System"]
        dirHandle["editorDirectoryHandle"]
        FileSystemAPI["File System Access API"]
    end

    LeftPanel --> LeftTabs
    MainEditor --> EditorStore
    SecondaryPane --> EditorStore
    FilesTab --> FS
    EditorStore --> FS
```

---

## 5.1 — Open File in Editor

```mermaid
flowchart TD
    A([User clicks file in FilePanel]) --> B["FilePanel: handleFileClick(fileHandle, path)"]
    B --> C{Tab already\nopen for this path?}
    C -->|Yes| D["useEditorStore.setActiveTab(existingTabId)"]
    C -->|No| E["fileHandle.getFile()\nRead file contents"]
    E --> F["useEditorStore.openTab({\npath, content, fileHandle,\ntype: detectType(path)\n})"]
    F --> G["tabs[] gets new entry\n(id: uuid, content, dirty:false)"]
    G --> H["setActiveTabId(newTabId)"]
    H --> I["MarkdownEditor receives\nnew content prop"]
    I --> J([Editor renders file content])

    K([User opens a folder]) --> L["showDirectoryPicker()\n(browser native)"]
    L --> M["useEditorStore.setDirectoryHandle(handle)"]
    M --> N["buildFileTree(handle)\nrecursive walk → fileTree[]"]
    N --> O["Save handle to IndexedDB"]
    O --> P([FilePanel shows file tree])
```

---

## 5.2 — Save File

```mermaid
flowchart TD
    A([User presses Ctrl+S / Cmd+S]) --> B["EditWorkflow keydown handler"]
    B --> C["Get active tab from useEditorStore"]
    C --> D{Tab has\nfileHandle?}
    D -->|Yes| E["fileHandle.createWritable()\nwrite content\nclose writable"]
    D -->|No| F["showSaveFilePicker()\n(browser native)"]
    F --> G["User picks save location"]
    G --> H["Write content to new handle"]
    H --> I["useEditorStore.updateTab(id, {fileHandle: newHandle, dirty:false})"]
    E --> J["useEditorStore.markTabClean(id)"]
    I --> J
    J --> K([Tab title loses dirty indicator *])

    L([Tool call: writeFile(path, content)]) --> M["actionExecutor.writeFile(path, content)"]
    M --> N["Resolve path against\nactive book project handle"]
    N --> O["Navigate FileSystemDirectoryHandle\nto parent dir (create if missing)"]
    O --> P["fileHandle.createWritable()\nwrite + close"]
    P --> Q{Tab open\nfor this path?}
    Q -->|Yes| R["useEditorStore.updateTabContent(id, content)\nmarkTabClean(id)"]
    Q -->|No| S[File written to disk only]
    R --> T([Editor updates to reflect tool-written content])
```

---

## 5.3 — Run Sequence from Edit Panel

```mermaid
flowchart TD
    A([User clicks 'Run' on a sequence\nin SequencesPanel]) --> B["SequencesPanel: handleRun(sequence)"]
    B --> C{Running another\nsequence already?}
    C -->|Yes| D["Show error: 'Sequence already running'"]
    C -->|No| E["actionExecutor.runNamedSequence(sequence.id)"]
    E --> F["2.3 Sequence Execution flow\n(same as chat-triggered)"]
    F --> G["Progress updates posted\nto useChatStore as messages"]
    G --> H["SequencesPanel shows live\nrunningSequence progress bar"]
    H --> I([Sequence completes\noutput files written to disk])
```

---

## 5.4 — Inline Edit Popup

Floating toolbar that appears when text is selected in the editor.

```mermaid
flowchart TD
    A([User selects text in MarkdownEditor]) --> B["Monaco editor 'onSelectionChange' event"]
    B --> C{Selection\nnon-empty?}
    C -->|No| D["InlineEditPopup hidden"]
    C -->|Yes| E["useInlineEditStore.setSelection(\ntext, startLine, endLine)"]
    E --> F["InlineEditPopup.jsx renders\n(floating toolbar near selection)"]

    F --> G{User action?}

    G -->|"Click built-in action\n(Expand, Condense, etc.)"| H["5.4.1 Built-in Script"]
    G -->|"Click saved prompt"| I["5.4.2 Prompt Template"]
    G -->|"Type custom instruction"| J["5.4.3 Custom Instruction"]

    H --> K["builtinScripts.js\napply transformation to selection text"]
    K --> L["Replace selection in editor"]

    I --> M["usePromptStore.getPrompt(id)"]
    M --> N["Resolve {{selection}} → selected text"]
    N --> O["Build pendingPromptText"]
    O --> P["Show editable preview textarea\n+ Run / Cancel buttons"]
    P --> Q([User edits prompt text, clicks Run])
    Q --> R["Send to chat as user message\n(in context of current file)"]

    J --> S["Build prompt:\n'Apply to this text: [selection]\nInstruction: [input]'"]
    S --> R
    R --> T["useChatSend.sendMessage()\n→ LLM responds with rewritten text"]
    T --> U{Response contains\nreplacement text?}
    U -->|Yes| V["Replace selection in editor\nvia Monaco API"]
    U -->|No| W["Show response in chat only"]
```

---

## 5.5 — Diff View

```mermaid
flowchart TD
    A([User clicks 'Diff' toggle in toolbar]) --> B["useEditorStore.setDiffMode(true)"]
    B --> C{Dual-pane\nactive?}
    C -->|No| D["Auto-enable dual-pane\nsetDualPane(true)"]
    C -->|Yes| E["Proceed"]
    D --> E
    E --> F["DiffView.jsx mounts\nwith originalContent=secondaryTab.content\nmodifiedContent=activeTab.content"]
    F --> G["Monaco DiffEditor renders\nside-by-side with change highlighting"]
    G --> H([User reviews changes])
    H --> I([User clicks 'Accept All' or 'Reject All'])
    I --> J["Update active tab content\nmarkTabDirty(id)"]
```

---

## 5.6 — Dual-Pane Mode

```mermaid
flowchart TD
    A([User clicks 'Dual Pane' toggle]) --> B["useEditorStore.toggleDualPane()"]
    B --> C["dualPane = !dualPane"]
    C --> D{dualPane now?}
    D -->|true| E["secondaryTabId set to\nnext tab in list (or same)"]
    D -->|false| E2["secondaryTabId = null\nSecondary pane hidden"]
    E --> F["EditWorkflow renders two\nMarkdownEditor instances side-by-side"]
    F --> G{Sync scroll\nenabled?}
    G -->|Yes| H["Both editors share scroll position\nvia ref.scrollTop sync"]
    G -->|No| I[Independent scroll]

    J([User opens file in secondary pane]) --> K["FilePanel: handleFileClick with target=secondary"]
    K --> L["useEditorStore.openTab({...})\nsetSecondaryTabId(newTabId)"]
```

---

## 5.7 — File Context Selection (AI Context)

Files in the context panel are injected into the chat system prompt.

```mermaid
flowchart TD
    A([User checks a file in FilePanel context list]) --> B["useEditorStore.toggleContextPath(path)"]
    B --> C["contextPaths[] toggled\n(add or remove path)"]
    C --> D["When user sends chat message:\ncontextBuilder.buildChatSystemPrompt()"]
    D --> E["Read each contextPath file content\nvia editorDirectoryHandle"]
    E --> F["Inject as:\n'### File: path\n```\ncontent\n```'"]
    F --> G["Append to system prompt\nbefore sending to LLM"]
    G --> H([LLM has file content in context])
```

---

## 5.8 — Key Files

| File | Role |
|------|------|
| `src/components/edit/EditWorkflow.jsx` | Root; panel layout, keyboard shortcuts, resize logic |
| `src/components/edit/FilePanel.jsx` | File tree browser, context selection checkboxes |
| `src/components/edit/MarkdownEditor.jsx` | Monaco editor wrapper; theme, keybindings, autosave |
| `src/components/edit/InlineEditPopup.jsx` | Floating popup for selection-level editing |
| `src/components/edit/DiffView.jsx` | Monaco DiffEditor wrapper |
| `src/components/edit/SearchReplaceBar.jsx` | Ctrl+H search/replace overlay |
| `src/components/edit/SequencesPanel.jsx` | Sequence library UI inside edit workflow |
| `src/components/edit/ToolsDropdown.jsx` | Text transformation tools menu |
| `src/store/useEditorStore.js` | `tabs[]`, `openTab`, `closeTab`, `updateTabContent`, `markTabClean`, `contextPaths`, `fileTree` |
| `src/hooks/useInlineEdit.js` | Selection tracking, popup state |
| `src/hooks/useSearchReplace.js` | Search/replace logic |
| `src/services/arcwriteFS.js` | `readFileByPath` used by actionExecutor for file reads |
