# 6 — Projects & Storage

> **Entry points covered:** First-run folder setup (6.1), Project switch (6.2), Create project (6.3), Delete project (6.4), Chat history persistence (6.5), File system layer / arcwriteFS (6.6), Path resolution for tool file reads (6.7).

---

## 6.0 — Storage Architecture Overview

```mermaid
graph TD
    subgraph Browser["Browser"]
        LocalStorage["localStorage\n(Zustand persist)"]
        IDB["IndexedDB\n(directory handles only)"]
        FSAA["File System Access API\n(native disk)"]
    end

    subgraph Stores["Zustand Stores"]
        AppStore["useAppStore\n(settings → localStorage)"]
        ProjectStore["useProjectStore\n(projects → FSAA via arcwriteFS)"]
        SeqStore["useSequenceStore\n(sequences → FSAA)"]
        PromptStore["usePromptStore\n(prompts → FSAA)"]
    end

    subgraph ArcwriteFolder["Arcwrite/ Folder Structure"]
        settings["settings.json"]
        BooksDir["projects/books/\n  {name}/\n    active.json\n    {name}.md\n    ...support files"]
        AIDir["projects/ai/\n  {name}.json"]
        SeqDir["sequences/\n  {name}.json\n  logs/{name}-{date}.md"]
        PromptsDir["prompts/\n  {name}.md"]
        ArtifactsDir["artifacts/\n  (images, outputs)"]
        ExtDir["extensions/\n  {pack-name}/"]
    end

    AppStore -->|persist middleware| LocalStorage
    ProjectStore -->|save handle| IDB
    ProjectStore -->|all project I/O| FSAA
    SeqStore -->|sequences CRUD| FSAA
    PromptStore -->|prompts CRUD| FSAA
    FSAA --> ArcwriteFolder
```

---

## 6.1 — First-Run Folder Setup

```mermaid
flowchart TD
    A([User visits app with no Arcwrite folder]) --> B["useProjectStore.arcwriteHandle = null"]
    B --> C["SetupBanner renders on every workflow page"]
    C --> D([User clicks 'Pick Storage Folder'])
    D --> E["window.showDirectoryPicker()\n(browser native dialog)"]
    E --> F["User selects a parent folder\n(e.g. ~/Documents)"]
    F --> G["useProjectStore.setRootDirectory(handle)"]
    G --> H["handle.requestPermission('readwrite')"]
    H --> I{Permission\ngranted?}
    I -->|No| J["Show error: permission denied"]
    I -->|Yes| K["arcwriteFS.initArcwrite(handle)\nCreate subfolder structure:"]
    K --> L["Ensure Arcwrite/ exists\nEnsure projects/books/\nEnsure projects/ai/\nEnsure sequences/\nEnsure prompts/\nEnsure artifacts/"]
    L --> M["Write default settings.json\nif it doesn't exist"]
    M --> N["idbHandleStore.saveHandle('arcwrite', handle)"]
    N --> O["loadProjects() — scan for existing projects"]
    O --> P["loadSettings() → syncFromProjectSettings()"]
    P --> Q["loadSequences() + loadPrompts()"]
    Q --> R([SetupBanner hidden\nFull UI available])
```

---

## 6.2 — Project Switch

```mermaid
flowchart TD
    A([User opens Projects dialog]) --> B["ProjectsDialog.jsx renders\nbook projects + AI projects lists"]
    B --> C([User clicks a Book Project])
    C --> D["useProjectStore.activateBookProject(project)"]
    D --> E["activeMode = 'book'\nactiveBookProject = project"]
    E --> F["Load book project chat history:\narcwriteFS.readBookChatHistory(handle, project.name)"]
    F --> G{active.json\nexists?}
    G -->|Yes| H["useChatStore.setMessages(history.messages)"]
    G -->|No| I["useChatStore.clearMessages()"]
    H --> J["Load project settings\n(if project has settings overrides)"]
    I --> J
    J --> K([Chat context now scoped to book project\nFiles from project folder available])

    B --> L([User clicks an AI Project])
    L --> M["useProjectStore.activateAiProject(project)"]
    M --> N["activeMode = 'ai'\nactiveAiProject = project"]
    N --> O["Load AI project chat history:\narcwriteFS.readAiChatHistory(handle, project.name)"]
    O --> P{active.json\nexists?}
    P -->|Yes| Q["useChatStore.setMessages(history.messages)"]
    P -->|No| R["useChatStore.clearMessages()"]
    Q --> S([Chat context uses AI project's custom prompt])
    R --> S
```

---

## 6.3 — Create Project

```mermaid
flowchart TD
    A([User clicks 'New Book Project' in ProjectsDialog]) --> B["Input: project name"]
    B --> C{Name\nnon-empty?}
    C -->|No| D["Validation error"]
    C -->|Yes| E["arcwriteFS.createBookProject(handle, name)"]
    E --> F["Ensure projects/books/{name}/ directory"]
    F --> G["Write placeholder {name}.md\nwith front matter template"]
    G --> H["useProjectStore.loadProjects()\nRefresh project lists"]
    H --> I([Project appears in list\nUser can activate it])

    J([User clicks 'New AI Project']) --> K["AiProjectEditor.jsx opens\n(blank form)"]
    K --> L["User fills: name, system prompt,\ncatalog files (file picker)"]
    L --> M([User clicks Save])
    M --> N["arcwriteFS.saveAiProject(handle, project)"]
    N --> O["Write projects/ai/{name}.json"]
    O --> P["useProjectStore.loadProjects()"]
    P --> Q([AI project appears in list])
```

---

## 6.4 — Delete Project

```mermaid
flowchart TD
    A([User clicks Delete on a project]) --> B["Confirm dialog:\n'Delete {name}? Cannot be undone.'"]
    B --> C{Confirmed?}
    C -->|No| D[No-op]
    C -->|Yes| E["arcwriteFS.deleteBookProject(handle, name)\nOR arcwriteFS.deleteAiProject(handle, name)"]
    E --> F["Remove directory (books)\nor file (AI) from disk"]
    F --> G{Deleted project\nwas active?}
    G -->|Yes| H["useProjectStore.deactivateProject()\nactiveMode = null"]
    G -->|No| I[No deactivation needed]
    H --> J["useProjectStore.loadProjects()"]
    I --> J
    J --> K([Project removed from list])
```

---

## 6.5 — Chat History Persistence

```mermaid
flowchart TD
    A["useChatStore messages[] changes\n(any message added/removed)"] --> B["App.jsx useEffect\n(debounced 2000ms)"]
    B --> C{activeMode?}

    C -->|"book"| D["arcwriteFS.writeBookChatHistory(\nhandle, projectName, messages)"]
    C -->|"ai"| E["arcwriteFS.writeAiChatHistory(\nhandle, projectName, messages)"]
    C -->|"null (Full Context)"| F["useAppStore persist handles\nglobal chat history via localStorage"]

    D --> G["Write to:\nprojects/books/{name}/active.json\n{messages: [...]}"]
    E --> H["Write to:\nprojects/ai/{name}/active.json"]

    I([User clicks 'New Chat']) --> J["Confirm dialog"]
    J --> K["Archive current active.json:\nRename to {timestamp}.json"]
    K --> L["useChatStore.clearMessages()"]
    L --> M[Fresh chat begins]
```

---

## 6.6 — arcwriteFS File System Layer

The `arcwriteFS.js` service is the sole interface to the File System Access API for the Arcwrite folder. All path navigation is relative to the `arcwriteHandle` root.

```mermaid
flowchart TD
    subgraph arcwriteFS["arcwriteFS.js — key operations"]
        initArcwrite["initArcwrite(handle)\nEnsure folder structure"]
        readSettings["readSettings(handle)"]
        writeSettings["writeSettings(handle, settings)"]
        listBookProjects["listBookProjects(handle)"]
        createBookProject["createBookProject(handle, name)"]
        deleteBookProject["deleteBookProject(handle, name)"]
        listAiProjects["listAiProjects(handle)"]
        saveAiProject["saveAiProject(handle, project)"]
        readBookChatHistory["readBookChatHistory(handle, name)"]
        writeBookChatHistory["writeBookChatHistory(handle, name, msgs)"]
        listCustomSequences["listCustomSequences(handle)"]
        saveCustomSequence["saveCustomSequence(handle, seq)"]
        deleteCustomSequence["deleteCustomSequence(handle, id)"]
        listCustomPrompts["listCustomPrompts(handle)"]
        saveCustomPrompt["saveCustomPrompt(handle, prompt)"]
        deleteCustomPrompt["deleteCustomPrompt(handle, id)"]
        readFileByPath["readFileByPath(handle, relativePath)"]
        walkArtifactsTree["walkArtifactsTree(handle)"]
    end

    subgraph Internals["Internal helpers"]
        ensureDir["ensureDir(parent, name)\ngetDirectoryHandle({create:true})"]
        readJsonFile["readJsonFile(dir, filename)\nparse JSON or return null"]
        writeJsonFile["writeJsonFile(dir, filename, data)\nJSON.stringify + write"]
    end

    arcwriteFS --> Internals
    arcwriteFS --> FSAA["File System Access API\n(browser native)"]
```

---

## 6.7 — File Path Resolution (Tool Calls)

When the LLM or a sequence calls `readProjectFile(path)` or `writeFile(path, content)`, paths must be resolved relative to the correct handle. This is where the nested-folder bugs have historically occurred.

```mermaid
flowchart TD
    A["ACTION_HANDLERS.readProjectFile(path)"] --> B["Normalize: strip 'Arcwrite/' prefix\nif present (legacy paths)"]
    B --> C{cleanPath starts\nwith 'projects/books/'?}

    C -->|Yes — Try 1| D["readFileByPath(arcwriteHandle, cleanPath)\ne.g. projects/books/Name.md"]
    D --> E{File\nfound?}
    E -->|Yes| Z["Return content"]
    E -->|No — Try 1.5| F{cleanPath ends\nwith a file extension?}
    F -->|Yes| G["Extract stem from path\nTry nested: projects/books/{stem}/{filename}"]
    G --> H{Nested file\nfound?}
    H -->|Yes| Z
    H -->|No — Try 2| I["Try bare filename only:\nreadFileByPath(arcwriteHandle, filename)"]
    I --> J{Found?}
    J -->|Yes| Z
    J -->|No| K["Search all open tabs\nin useEditorStore"]
    K --> L{Tab content\nmatches path?}
    L -->|Yes| Z
    L -->|No| M["Return error: file not found"]

    C -->|No — may be Arcwrite-relative| N["readFileByPath(arcwriteHandle, cleanPath)"]
    N --> O{Found?}
    O -->|Yes| Z
    O -->|No| M

    P["ACTION_HANDLERS.writeFile(path, content)"] --> Q["Resolve book project root handle"]
    Q --> R["Navigate path segments\nensureDir() for each directory segment"]
    R --> S["Write content to final\nFileSystemFileHandle"]
    S --> T{Tab open\nfor this path?}
    T -->|Yes| U["updateTabContent() + markTabClean()"]
    T -->|No| V[File on disk only]
```

---

## 6.8 — Key Files

| File | Role |
|------|------|
| `src/services/arcwriteFS.js` | All Arcwrite/ I/O — projects, sequences, prompts, history, artifacts |
| `src/services/idbHandleStore.js` | `saveHandle`, `getHandle` — IndexedDB persistence for directory handles |
| `src/store/useProjectStore.js` | `setRootDirectory`, `restoreFromIDB`, `loadProjects`, `activateBookProject`, `activateAiProject`, `saveCurrentChatHistory` |
| `src/store/useSequenceStore.js` | `loadSequences`, `createSequence`, `updateSequence`, `deleteSequence` |
| `src/store/usePromptStore.js` | `loadPrompts`, `createPrompt`, `updatePrompt`, `deletePrompt` |
| `src/components/projects/ProjectsDialog.jsx` | Book/AI project list; activate, create, delete |
| `src/components/projects/AiProjectEditor.jsx` | Create/edit AI project definition |
| `src/components/projects/SetupBanner.jsx` | First-run folder picker UI |
| `src/chat/actionExecutor.js` | `readProjectFile`, `writeFile`, `writeArtifact` — resolve and execute file I/O |
