# 2 — Chat System

> **Entry points covered:** Send message (2.1), Tool calling loop (2.2), Sequence execution (2.3), Slash menu (2.4), Abort stream (2.5).

---

## 2.0 — Chat System Overview

```mermaid
graph TD
    subgraph ChatPanel["ChatPanel.jsx (UI)"]
        Input["Text Input\n(Enter to send)"]
        SlashMenu["/ Slash Menu\n(sequences + prompts)"]
        StopBtn["Stop Button\n(abort mid-stream)"]
        ModeBtn["Mode Button\n(view system prompt)"]
        PromptsBtn["Prompts Button\n(manage templates)"]
        ProjDropdown["Project Dropdown\n(context mode switch)"]
    end

    subgraph Hooks
        useChatSend["useChatSend.js\n(main orchestrator)"]
    end

    subgraph API
        contextBuilder["contextBuilder.js\n(build system prompt)"]
        providerAdapter["providerAdapter.js\n(call LLM)"]
        actionExecutor["actionExecutor.js\n(execute tools)"]
        sequenceRunner["sequenceRunner logic\n(in actionExecutor)"]
    end

    subgraph Stores
        ChatStore["useChatStore\n(messages, streaming)"]
        AppStore["useAppStore\n(beats, chapters — modified by tools)"]
        SeqStore["useSequenceStore"]
        PromptStore["usePromptStore"]
        ProjectStore["useProjectStore\n(handle, settings)"]
    end

    Input -->|2.1| useChatSend
    SlashMenu -->|2.4| useChatSend
    StopBtn -->|2.5| ChatStore
    useChatSend --> contextBuilder
    useChatSend --> providerAdapter
    useChatSend --> actionExecutor
    actionExecutor -->|2.3| sequenceRunner
    useChatSend --> ChatStore
    actionExecutor --> AppStore
    actionExecutor --> ProjectStore
    ChatPanel --> SeqStore
    ChatPanel --> PromptStore
```

---

## 2.1 — Send Chat Message

```mermaid
flowchart TD
    A([User types message + presses Enter]) --> B["ChatPanel: handleSend()"]
    B --> C{Input empty\nor streaming?}
    C -->|Yes| Z[No-op]
    C -->|No| D["useChatStore.addMessage()\n{role:'user', content:input}"]
    D --> E["setInput('')\nclear draft"]
    E --> F["useChatSend.sendMessage(input)"]
    F --> G["2.1.1 Build system prompt\ncontextBuilder"]
    G --> H["2.1.2 Determine tool mode\n(toolsActive flag)"]
    H --> I{Tools\nenabled?}
    I -->|Yes| J["2.2 Tool Calling Loop"]
    I -->|No| K["2.1.3 Simple stream\nproviderAdapter.callCompletion()"]
    K --> L["Stream chunks → useChatStore.updateStreamBuffer()"]
    L --> M["On done → useChatStore.finalizeStream()\n(moves buffer → messages[])"]
    M --> N([Response shown in chat])
    J --> N
```

### 2.1.1 — Build System Prompt

```mermaid
flowchart TD
    A["useChatSend calls\ncontextBuilder"] --> B{Active mode?}
    B -->|"ai (AI project)"| C["buildAiProjectSystemPrompt()\nCustom prompt + file index"]
    B -->|"book (book project)"| D["buildChatSystemPrompt(route)\nFull context with beat table,\nchapter list, editor content"]
    B -->|"none (Full Context)"| D
    D --> E["Inline genre config\nweights, subgenre, modifier"]
    E --> F["Inline scaffold beats table\n(time%, label, dimensions, tension)"]
    F --> G["Inline chapter list with scores"]
    G --> H["Inline open editor content\n(if Edit workflow)"]
    H --> I[System prompt string returned]
    C --> I
```

---

## 2.2 — Tool Calling Loop

Executes when `toolsActive = true` and LLM returns `tool_use` blocks.

```mermaid
flowchart TD
    A["useChatSend: agentic loop starts\n(max 5 iterations)"] --> B["providerAdapter.callCompletion()\nwith toolDefinitions array"]
    B --> C{Response contains\ntool_use blocks?}
    C -->|No| D["Final text response\n→ finalizeStream()"]
    C -->|Yes| E["parseToolCalls(response)\nExtract tool name + input args"]
    E --> F["For each tool call:"]
    F --> G["ACTION_HANDLERS[toolName](args)"]
    G --> H{Tool type?}

    H -->|"read (getScaffoldBeats, etc.)"| I["Read from store / file\nReturn JSON string"]
    H -->|"write (updateBeat, etc.)"| J["Modify useAppStore\n(beats, chapters, genre)"]
    H -->|"file (writeFile, readProjectFile)"| K["arcwriteFS file I/O\nvia arcwriteHandle"]
    H -->|"run (runNamedSequence)"| L["2.3 Sequence Execution"]
    H -->|"generate (generateImage)"| M["imageGeneration.js\n→ save artifact"]

    I --> N["Build tool_result message\n{role:'tool', tool_use_id, content}"]
    J --> N
    K --> N
    L --> N
    M --> N

    N --> O["Add tool_result to\nconversation history"]
    O --> P{Iteration\n< 5?}
    P -->|Yes| B
    P -->|No| Q["Force-finalize\nwith last text content"]
    D --> R([UI updated — beats/chapters\nchanged if write tools ran])
    Q --> R
```

---

## 2.3 — Sequence Execution

Sequences are stored as JSON in `Arcwrite/sequences/`. Each has an array of steps.

```mermaid
flowchart TD
    A(["Entry: /run 'name' in chat\nOR Sequences panel Run button\nOR LLM calls runNamedSequence tool"]) --> B["actionExecutor: runNamedSequence(id)"]
    B --> C["useSequenceStore.getSequence(id)"]
    C --> D{Sequence\nfound?}
    D -->|No| E["Return error to LLM/chat"]
    D -->|Yes| F["setRunningSequence(seq)\n(shows live progress in UI)"]
    F --> G["For each step in sequence.steps[]"]

    G --> H{Step type?}

    H -->|action| I["2.3.1 Action Step"]
    H -->|loop| J["2.3.2 Loop Step"]

    I --> K{More steps?}
    J --> K
    K -->|Yes| G
    K -->|No| L["_seqAppendLog()\nWrite run log to sequences/logs/"]
    L --> M["setRunningSequence(null)"]
    M --> N([Sequence complete])
```

### 2.3.1 — Sequence Action Step

```mermaid
flowchart TD
    A["Step: {type:'action', template, promptRef?,\noutputFile?, chain?, model?}"] --> B{promptRef\nset?}
    B -->|Yes| C["usePromptStore.getPrompt(promptRef)\nReplace template with prompt content"]
    B -->|No| D["Use step.template directly"]
    C --> E["Resolve template variables\n{{variable}} → value from ctx"]
    D --> E
    E --> F{chain: true?}
    F -->|Yes| G["Prepend previous step output\nto user message"]
    F -->|No| H["Use template as-is"]
    G --> I["providerAdapter.callCompletion()\n(model override if step.model set)"]
    H --> I
    I --> J["Collect full response text"]
    J --> K{outputFile\nset?}
    K -->|Yes| L["writeFile(outputFile, responseText)"]
    K -->|No| M[Response held in ctx.lastOutput]
    L --> M
    M --> N["useChatStore.addMessage()\nProgress update in chat"]
    N --> O["updateRunningSequence()\nUpdate UI progress bar"]
```

### 2.3.2 — Loop Step

```mermaid
flowchart TD
    A["Step: {type:'loop', count, steps:[]}"] --> B["For i = 0 to count-1"]
    B --> C["ctx.loopIndex = i"]
    C --> D["Execute each step in loop.steps[]\n(same as action step logic)"]
    D --> E{More\niterations?}
    E -->|Yes| B
    E -->|No| F[Return last output]
```

---

## 2.4 — Slash Menu (/ Command)

```mermaid
flowchart TD
    A([User types / in chat input]) --> B{Next character\nis a space?}
    B -->|Yes| C[No menu — treat as normal text]
    B -->|No| D["setSlashMenuOpen(true)\nsetSlashQuery(text after /)"]
    D --> E["Filter sequences by name\n+ Filter prompts by title"]
    E --> F["Render floating dropdown\nGrouped: Sequences | Prompts"]
    F --> G{User action?}

    G -->|"Arrow keys"| H["Move slashIndex\n(cycles through filteredItems)"]
    G -->|"Enter or click"| I["handleSlashSelect(item)"]
    G -->|"Space or Escape"| J["setSlashMenuOpen(false)"]

    H --> F

    I --> K{item._type?}
    K -->|sequence| L["setInput('/run \"name\"')\nuseChatSend will detect /run prefix"]
    K -->|prompt| M["setInput(item.content)\nTemplate text in input box\n(user edits, then sends manually)"]
    L --> N["setSlashMenuOpen(false)"]
    M --> N
    N --> O([Input populated — user sends when ready])
```

---

## 2.5 — Abort Stream

```mermaid
flowchart TD
    A([User clicks Stop button]) --> B["useChatStore.abortStream()"]
    B --> C["abortController.abort()"]
    C --> D["Fetch/SSE request cancelled\n(in chatStreaming.js / anthropicStreaming.js)"]
    D --> E["Stream ends with AbortError"]
    E --> F["useChatSend catch block\ndetects AbortError"]
    F --> G{streamBuffer\nnot empty?}
    G -->|Yes| H["finalizeStream(buffer)\nSave partial response as message"]
    G -->|No| I["setStreaming(false)"]
    H --> J["setStreaming(false)\nsetAbortController(null)"]
    I --> J
    J --> K([Chat returns to idle state])
```

---

## 2.6 — Context Mode Switching

```mermaid
flowchart TD
    A([User opens Project dropdown in ChatPanel]) --> B["Show dropdown:\n- Full Context\n- Presets list\n- User AI projects"]
    B --> C{Selection?}

    C -->|"Full Context"| D["useProjectStore.deactivateProject()"]
    C -->|"Preset (e.g. Nova)"| E["useProjectStore.activateAiProject(preset)"]
    C -->|"User AI project"| F["useProjectStore.activateAiProject(project)"]
    C -->|"Book project (via Projects dialog)"| G["useProjectStore.activateBookProject(project)"]

    D --> H["activeMode = null\nactiveAiProject = null"]
    E --> I["activeMode = 'ai'\nactiveAiProject = preset"]
    F --> I
    G --> J["activeMode = 'book'\nactiveBookProject = project"]

    H --> K["Next chat send uses\nbuildChatSystemPrompt (Full Context)"]
    I --> L["Next chat send uses\nbuildAiProjectSystemPrompt"]
    J --> K
```

---

## 2.7 — Key Files

| File | Role |
|------|------|
| `src/components/chat/ChatPanel.jsx` | UI — input, slash menu, header buttons, message list |
| `src/hooks/useChatSend.js` | Orchestrator — system prompt, LLM call, tool loop |
| `src/chat/contextBuilder.js` | Build system prompt from app state |
| `src/chat/actionExecutor.js` | 100+ tool handlers; sequence runner |
| `src/api/providerAdapter.js` | Unified LLM call across all providers |
| `src/api/chatStreaming.js` | OpenAI-compat SSE streaming + tool call parsing |
| `src/api/anthropicStreaming.js` | Anthropic SDK streaming |
| `src/store/useChatStore.js` | messages[], streaming state, draftInput |
| `src/store/useSequenceStore.js` | Sequence library and run state |
| `src/store/usePromptStore.js` | Prompt template library |
| `src/components/chat/ChatMessage.jsx` | Render one message (markdown, actions, images) |
| `src/components/prompts/PromptEditorDialog.jsx` | CRUD UI for prompt templates |
