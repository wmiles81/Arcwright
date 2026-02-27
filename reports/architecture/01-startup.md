# 1 — Startup & Initialization

> **Entry points covered:** Cold start (no stored handle), Warm start (handle restored from IndexedDB), Permission re-grant (handle exists but permission lapsed).

---

## 1.1 — Top-Level Boot Sequence

```mermaid
flowchart TD
    A([Browser loads index.html]) --> B[main.jsx\nReactDOM.createRoot + render]
    B --> C[HashRouter wraps App]
    C --> D[App.jsx mounts]
    D --> E{IndexedDB has\narcwriteHandle?}

    E -->|No| F[1.2 Cold Start]
    E -->|Yes| G[1.3 Warm Start]

    F --> Z[AppShell renders\nSetupBanner visible]
    G --> Z2[AppShell renders\nFull UI available]
```

---

## 1.2 — Cold Start (No Storage Handle)

User has never picked a folder, or cleared site data.

```mermaid
flowchart TD
    A([App mounts]) --> B["useProjectStore.restoreFromIDB()"]
    B --> C{IDB entry\nexists?}
    C -->|No| D["isInitialized = true\narcwriteHandle = null"]
    D --> E[AppShell renders]
    E --> F{arcwriteHandle\nnull?}
    F -->|Yes| G["SetupBanner shown\n(every workflow page)"]
    G --> H([User clicks 'Pick Folder'])
    H --> I["showDirectoryPicker()\n(browser native dialog)"]
    I --> J["useProjectStore.setRootDirectory(handle)"]
    J --> K["requestPermission('readwrite')"]
    K --> L["arcwriteFS.initArcwrite(handle)\nEnsure folder structure exists"]
    L --> M["Save handle to IndexedDB\nidbHandleStore.saveHandle()"]
    M --> N["loadProjects() → list books + AI projects"]
    N --> O["loadSettings() → sync to useAppStore"]
    O --> P["loadSequences() → populate useSequenceStore"]
    P --> Q["loadPrompts() → populate usePromptStore"]
    Q --> R([Full UI available])
```

---

## 1.3 — Warm Start (Handle in IndexedDB)

User returns; browser may or may not retain permission.

```mermaid
flowchart TD
    A([App mounts]) --> B["useProjectStore.restoreFromIDB()"]
    B --> C["idbHandleStore.getHandle('arcwrite')"]
    C --> D{Handle\nfound?}
    D -->|No| E[Cold Start path]
    D -->|Yes| F["handle.queryPermission('readwrite')"]
    F --> G{Permission\nstate?}

    G -->|granted| H[1.3a — Silent Restore]
    G -->|prompt| I[1.3b — Deferred Grant]
    G -->|denied| J["arcwriteHandle = null\nSetupBanner shown"]

    H --> K["arcwriteFS operations proceed immediately"]
    K --> L["loadProjects, loadSettings,\nloadSequences, loadPrompts"]
    L --> M["syncFromProjectSettings()\noverride AppStore with disk values"]
    M --> N([Full UI available])

    I --> O["arcwriteHandle stored but handle.granted = false"]
    O --> P["SetupBanner shown with 'Re-connect' button"]
    P --> Q([User clicks Re-connect])
    Q --> R["handle.requestPermission('readwrite')"]
    R --> K
```

---

## 1.4 — Editor Directory Handle Restore

Independent from arcwrite handle — for the file editor open-folder feature.

```mermaid
flowchart TD
    A([App mounts]) --> B["idbHandleStore.getHandle('editor')"]
    B --> C{Handle\nfound?}
    C -->|No| D[No editor directory\nUser opens manually in Edit workflow]
    C -->|Yes| E["handle.queryPermission('readwrite')"]
    E --> F{Granted?}
    F -->|Yes| G["useEditorStore.setDirectoryHandle(handle)"]
    G --> H["buildFileTree(handle) → update fileTree[]"]
    H --> I["EditWorkflow file panel populated"]
    F -->|No| J[Editor starts with no directory\nUser picks via 'Open Folder' button]
```

---

## 1.5 — Data Pack / Extension Load

Happens after arcwrite handle is valid.

```mermaid
flowchart TD
    A["arcwriteHandle ready"] --> B["useProjectStore.loadDataPacks()"]
    B --> C["arcwriteFS.listExtensionPacks(handle)"]
    C --> D{Packs\nfound?}
    D -->|None| E[Use built-in genre/structure data only]
    D -->|Yes| F["For each pack:\narcwriteFS.loadPackContent(handle, packName)"]
    F --> G["Parse pack JSON\n(genres, structures, weights overrides)"]
    G --> H["Merge into genreSystem / plotStructures\nvia useAppStore.mergeDataPack()"]
    H --> I[Extended genre and structure options available]
```

---

## 1.6 — Chat History Persistence (Runtime)

Not a startup concern but defined in App.jsx alongside boot effects.

```mermaid
flowchart TD
    A["useChatStore messages change"] --> B["App.jsx useEffect\n(debounced 2000ms)"]
    B --> C{Active project\ntype?}
    C -->|Book| D["useProjectStore.saveCurrentChatHistory()\n→ arcwriteFS.writeBookChatHistory()"]
    C -->|AI| E["arcwriteFS.writeAiChatHistory()"]
    C -->|None| F[No-op]
    D --> G["Write active.json in\nprojects/books/{name}/"]
    E --> H["Write active.json in\nprojects/ai/{name}/"]
```

---

## 1.7 — Key Files

| File | Role |
|------|------|
| `src/main.jsx` | ReactDOM bootstrap, router wrapping |
| `src/App.jsx` | Mount effects: restore handles, load data, set up chat debounce |
| `src/store/useProjectStore.js` | `restoreFromIDB`, `setRootDirectory`, `loadProjects`, `loadSettings` |
| `src/services/arcwriteFS.js` | `initArcwrite`, `listBookProjects`, `readSettings`, `writeSettings` |
| `src/services/idbHandleStore.js` | `saveHandle`, `getHandle` — IndexedDB wrapper |
| `src/components/projects/SetupBanner.jsx` | "Pick Folder" UI shown when no handle |
