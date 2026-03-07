# 4 — Analysis Workflow

> **Entry points covered:** Score chapter (4.1), Get-Well Plan (4.2), Revision checklist (4.3), Projection overlay (4.4), Comparison mode toggle (4.5).

---

## 4.0 — Analysis Workflow Overview

```mermaid
graph TD
    subgraph UI["AnalysisWorkflow.jsx"]
        TextInput["TextInputPanel\n(paste/import text)"]
        ScoringReview["ScoringReviewPanel\n(display + edit scores)"]
        ComparisonOverlay["ComparisonOverlay\n(gap chart)"]
        GetWellPlan["GetWellPlan\n(recommendations)"]
        RevisionChecklist["RevisionChecklist\n(action items)"]
        ProjectionOverlay["ProjectionOverlay\n(full arc projection)"]
    end

    subgraph Hooks["Hooks"]
        useClaudeAnalysis["useClaudeAnalysis.js\n(score + get-well)"]
        useRevisionPipeline["useRevisionPipeline.js\n(checklist)"]
    end

    subgraph API["API"]
        providerAdapter
        prompts_api["api/prompts.js\n(scoring + get-well prompts)"]
    end

    subgraph Engine["Engine"]
        validation_e["validation.js\ncomputeGapAnalysis()"]
        projection_e["projection.js\nprojectFullArc()"]
    end

    subgraph AppStore["useAppStore"]
        chapters["chapters[]\n(text + scores)"]
        genreConfig["genre config\n(ideal curve reference)"]
    end

    TextInput --> useClaudeAnalysis
    useClaudeAnalysis --> API
    useClaudeAnalysis --> AppStore
    ScoringReview --> AppStore
    ComparisonOverlay --> Engine
    GetWellPlan --> useClaudeAnalysis
    RevisionChecklist --> useRevisionPipeline
    ProjectionOverlay --> Engine
    Engine --> AppStore
```

---

## 4.1 — Score Chapter

```mermaid
flowchart TD
    A([User pastes chapter text in TextInputPanel]) --> B["Local state: chapterText = input"]
    B --> C([User clicks 'Analyze' button])
    C --> D["useClaudeAnalysis.analyzeChapter(chapterText)"]
    D --> E["useAppStore.setAnalysisInProgress(true)"]
    E --> F["Build scoring prompt:\napi/prompts.js → buildScoringSystemPrompt()"]
    F --> G["buildScoringUserMessage(chapterText)"]
    G --> H["providerAdapter.callCompletion(\nsystemPrompt, userMessage)"]
    H --> I["LLM responds with JSON:\n{intimacy:N, trust:N, stakes:N, ...}"]
    I --> J["Parse JSON — validate all 11 dimensions present"]
    J --> K{Parse\nsuccess?}
    K -->|No| L["Show parse error\nAllow manual entry"]
    K -->|Yes| M["useAppStore.updateChapterScores(\nchapterIndex, scores)"]
    M --> N["chapters[i].scores = parsed values\nchapters[i].text = chapterText"]
    N --> O["computeGapAnalysis(\nactualBeats, idealBeats, weights)"]
    O --> P["Store gapAnalysis result\nin local state"]
    P --> Q(["ScoringReviewPanel shows scores\nComparisonOverlay shows gap chart"])
    Q --> R["useAppStore.setAnalysisInProgress(false)"]
```

---

## 4.2 — Get-Well Plan

Generates editorial recommendations from gap analysis.

```mermaid
flowchart TD
    A([User clicks 'Generate Recommendations']) --> B["useClaudeAnalysis.generateGetWell(\ngapAnalysis, enrichedData, genre)"]
    B --> C["api/prompts.js\nbuildGetWellSystemPrompt()"]
    C --> D["buildGetWellUserMessage(\ngapAnalysis, perDimensionSummary,\npriorityActions)"]
    D --> E["providerAdapter.callCompletion()"]
    E --> F["Stream response\n(markdown prose)"]
    F --> G["Accumulate streamed text"]
    G --> H["setGetWellPlan(text)"]
    H --> I(["GetWellPlan component renders\nmarkdown recommendations"])

    J([User clicks 'Build Revision Checklist']) --> K["useRevisionPipeline.buildChecklist(\ngapAnalysis, getWellPlan)"]
    K --> L["4.3 Revision Checklist"]
```

---

## 4.3 — Revision Checklist

```mermaid
flowchart TD
    A["useRevisionPipeline.buildChecklist(\ngapAnalysis, recommendations)"] --> B["engine/revisionChecklist.js\ngenerateChecklist(priorityActions, getWellPlan)"]
    B --> C["For each HIGH priority dimension gap:"]
    C --> D["Create checklist item:\n{dimension, description, beats[], priority}"]
    D --> E["Parse structured items\nfrom getWellPlan prose if available"]
    E --> F["Merge engine-generated + LLM-generated items"]
    F --> G["setRevisionChecklist(items)"]
    G --> H(["RevisionChecklist renders\ncheckboxes + priority badges"])
    H --> I([User checks items])
    I --> J["toggleRevisionItem(index)\nLocally tracks completion"]
```

---

## 4.4 — Projection Overlay

Projects the full manuscript arc from scored chapters onto the ideal curve.

```mermaid
flowchart TD
    A([User opens Projection tab / panel]) --> B["ProjectionOverlay mounts"]
    B --> C["engine/projection.js\nprojectFullArc(\nchapters, idealCurve, weights)"]
    C --> D["For each scored chapter:\ncompute chapter's midpoint time%\nbased on position in chapter list"]
    D --> E["Interpolate ideal values\nat each chapter's time%"]
    E --> F["Compute per-chapter delta\nfrom ideal for each dimension"]
    F --> G["Return merged dataset:\n{time, actual_*, ideal_*, gap_*}"]
    G --> H(["ProjectionOverlay chart renders\ndual lines: actual vs. ideal"])

    I([User moves ProjectionSlider]) --> J["Adjust threshold for\n'significant gap' highlighting"]
    J --> K["Re-color gap areas above threshold\non chart"]
```

---

## 4.5 — Comparison Mode Toggle

```mermaid
flowchart TD
    A([User clicks 'Compare vs. My Scaffold' toggle]) --> B["useAppStore.setUseScaffoldAsIdeal(true)"]
    B --> C{useScaffoldAsIdeal?}
    C -->|true| D["idealCurve = enrichedData\n(from scaffold beats, not presetArc)"]
    C -->|false| E["idealCurve = presetArcs[genre][subgenre]"]
    D --> F["Re-run computeGapAnalysis\nwith scaffold as reference"]
    E --> F
    F --> G([ComparisonOverlay, GetWellPlan\nupdate to reflect new ideal])
```

---

## 4.6 — Manual Score Editing

```mermaid
flowchart TD
    A([User clicks score cell in ScoringReviewPanel]) --> B["Cell becomes editable input"]
    B --> C([User types new value])
    C --> D["Validate: number 0–10"]
    D --> E["useAppStore.updateChapterScores(\nchapterIndex, {dimension: newValue})"]
    E --> F["Re-run gap analysis with corrected score"]
    F --> G([ComparisonOverlay refreshes])
```

---

## 4.7 — Key Files

| File | Role |
|------|------|
| `src/components/analysis/AnalysisWorkflow.jsx` | Root component; orchestrates sub-panels |
| `src/hooks/useClaudeAnalysis.js` | `analyzeChapter()`, `generateGetWell()` — LLM calls |
| `src/hooks/useRevisionPipeline.js` | `buildChecklist()` |
| `src/api/prompts.js` | `buildScoringSystemPrompt/UserMessage`, `buildGetWellSystemPrompt/UserMessage` |
| `src/engine/validation.js` | `computeGapAnalysis()`, `interpolateAtTime()`, `mergeForComparison()` |
| `src/engine/projection.js` | `projectFullArc()` |
| `src/engine/revisionChecklist.js` | `generateChecklist()` |
| `src/components/analysis/TextInputPanel.jsx` | Paste/import chapter text |
| `src/components/analysis/ScoringReviewPanel.jsx` | Display + edit dimension scores |
| `src/components/analysis/ComparisonOverlay.jsx` | Gap chart |
| `src/components/analysis/GetWellPlan.jsx` | Render recommendations |
| `src/components/analysis/RevisionChecklist.jsx` | Checkbox list of revision items |
| `src/components/analysis/ProjectionOverlay.jsx` | Full-arc projection chart |
| `src/store/useAppStore.js` | `chapters[]`, `addChapter`, `updateChapterScores`, `setUseScaffoldAsIdeal` |
