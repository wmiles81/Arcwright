# 3 — Scaffold Workflow

> **Entry points covered:** Genre selection (3.1), Beat add/edit (3.2), Beat drag-reorder (3.3), Template load (3.4), Export (3.5). Also: blend mode, dimension toggles, tension calculation, validation.

---

## 3.0 — Scaffold Workflow Overview

```mermaid
graph TD
    subgraph ScaffoldingWorkflow["ScaffoldingWorkflow.jsx (root)"]
        GenreSelector
        GenreBlender
        StructureSelector
        BeatEditor["BeatEditor / BeatEditorRow"]
        NarrativeChart
        ValidationPanel
        ScaffoldOutput
    end

    subgraph AppStore["useAppStore"]
        genre["genre, subgenre,\nmodifier, pacing"]
        weights["activeWeights\n(per-dimension, 0–3)"]
        beats["scaffoldBeats[]"]
        blending["blendEnabled,\nsecondaryGenre, blendRatio"]
    end

    subgraph Engine["Narrative Engine"]
        tension["tension.js\ncalculateTension()"]
        validation_e["validation.js\nvalidateAgainstGenre()"]
        blending_e["blending.js\nblendArcs(), blendWeights()"]
        suggestions_e["suggestions.js\ngenerateSuggestions()"]
        scaffoldOutput_e["scaffoldOutput.js\nformatScaffold()"]
    end

    subgraph Data["Static Data"]
        genreSystem["genreSystem.js"]
        plotStructures["plotStructures.js"]
        presetArcs["presetArcs.js"]
        dimensions["dimensions.js"]
    end

    GenreSelector --> AppStore
    BeatEditor --> AppStore
    AppStore --> Engine
    Engine --> NarrativeChart
    Engine --> ValidationPanel
    Engine --> ScaffoldOutput
    Data --> Engine
    Data --> AppStore
```

---

## 3.1 — Genre Selection

```mermaid
flowchart TD
    A([User changes Genre dropdown]) --> B["useAppStore.setGenre(genre)"]
    B --> C["Look up genreSystem[genre]\n→ get default subgenre, modifier"]
    C --> D["setSubgenre(defaultSubgenre)\nsetModifier(defaultModifier)"]
    D --> E["remapBeatsToStructure()\nUpdate each beat's .beat key\nto match new structure's beat list"]
    E --> F["useMemo recomputes in ScaffoldingWorkflow:"]

    F --> G["activeWeights =\ngenreWeights + modifier scaling"]
    G --> H["idealCurve =\npresetArcs[genre][subgenre]"]
    H --> I["enrichedData =\nscaffoldBeats.map → calculateTension(beat, weights)"]
    I --> J["validation =\nvalidateAgainstGenre(enrichedData, subgenreRequirements)"]
    J --> K([NarrativeChart, ValidationPanel, BeatSheetView re-render])

    A2([User changes Subgenre dropdown]) --> L["useAppStore.setSubgenre(sub)"]
    L --> M["Look up subgenreRequirements\nfrom genreSystem"]
    M --> F

    A3([User changes Modifier dropdown]) --> N["useAppStore.setModifier(mod)"]
    N --> O["Apply modifierEffects[mod]\nscale weights up or down"]
    O --> F
```

---

## 3.2 — Beat Add / Edit

### 3.2.1 — Add Beat

```mermaid
flowchart TD
    A([User clicks '+ Add Beat' button]) --> B["Find largest gap\nin scaffoldBeats[].time array"]
    B --> C["Create new beat:\n{id: uuid, time: midpoint,\nlabel: 'Beat N', beat: structureBeat,\nall dimensions: 0}"]
    C --> D["useAppStore.addBeat(beat)"]
    D --> E["scaffoldBeats[] = [...existing, newBeat]\nsorted by time"]
    E --> F([BeatSheetView re-renders\nnew row appears])

    A2([User hovers between two beats]) --> G["InsertionZone appears (+)"]
    G --> H([User clicks +])
    H --> I["Compute midpoint time\nbetween beat[i] and beat[i+1]"]
    I --> J["Average dimension values\nfrom surrounding beats"]
    J --> D
```

### 3.2.2 — Edit Beat (Expand Row)

```mermaid
flowchart TD
    A([User clicks Beat Row header]) --> B["BeatEditorRow: setExpanded(true)"]
    B --> C["Expanded view shows:\n- Label input\n- Time % input\n- Beat Type select\n- Dimension sliders (11×)\n- Live tension bar\n- Beat Suggestions panel"]

    D([User drags a DimensionSlider]) --> E["DimensionSlider onChange(key, value)"]
    E --> F["BeatEditorRow.handleDimChange(key, value)"]
    F --> G["onUpdate(beat.id, {key: value})\n→ useAppStore.updateBeat(id, patch)"]
    G --> H["scaffoldBeats updated\n(new array reference)"]
    H --> I["useMemo(enrichedData) recomputes\nfor this beat's tension"]
    I --> J["BeatEditorRow re-renders:\nlive T:x.x badge + tension bar update"]
    I --> K["NarrativeChart re-renders\ntension line moves"]

    L([User changes Label input]) --> M["updateBeat(id, {label: newLabel})"]
    N([User changes Time % input]) --> O["Parse int, clamp 0-100"]
    O --> P["updateBeat(id, {time: clampedVal})"]
    P --> Q["scaffoldBeats re-sorted by time\nrow may reorder in list"]
```

---

## 3.3 — Beat Drag-Reorder

```mermaid
flowchart TD
    A([User drags grip handle on BeatEditorRow]) --> B["onDragStart(index)\nStore dragIndex in BeatEditor state"]
    B --> C["BeatEditorRow shows opacity:50%\n(isDragging = true)"]
    C --> D([User drags over another row])
    D --> E["onDragOver(targetIndex)\nStore dropIndex"]
    E --> F["Target row shows\ngreen border (isDropTarget)"]
    F --> G([User releases])
    G --> H["onDrop(dropIndex)"]
    H --> I["Reorder beats array:\nremove from dragIndex\ninsert at dropIndex"]
    I --> J["Recalculate time% values:\nevenly redistribute based on\nnew position order"]
    J --> K["useAppStore.setScaffoldBeats(reordered)"]
    K --> L([BeatSheetView re-renders\nbeats in new order])
```

---

## 3.4 — Template Load

```mermaid
flowchart TD
    A([User opens Template dropdown\n+ selects a template]) --> B["TemplateLoader:\nfetch template definition\nfrom presetArcs or customStructures"]
    B --> C["Template has beats[]:\n[{time, beat, dimensions...}, ...]"]
    C --> D{Confirm overwrite\ncurrent beats?}
    D -->|Cancel| E[No-op]
    D -->|OK| F["useAppStore.setScaffoldBeats(template.beats)"]
    F --> G["Recompute enrichedData, idealCurve"]
    G --> H([Chart and beat list show template values])
```

---

## 3.5 — Export Scaffold

```mermaid
flowchart TD
    A([User clicks 'Export Markdown' / 'Export HTML']) --> B["ScaffoldOutput component"]
    B --> C["engine/scaffoldOutput.js\nformatScaffold(enrichedData, genre, weights)"]
    C --> D["Build markdown:\n- Beat table with dimensions\n- Tension drivers per beat\n- Emotional coordinates\n- Writing guidance (from beatGuidance.js)"]
    D --> E{Export format?}
    E -->|Markdown| F["Blob download\n.md file"]
    E -->|HTML| G["Wrap in standalone HTML template\nwith inline CSS\nBlob download .html file"]
    F --> H([File saved to user's Downloads])
    G --> H
```

---

## 3.6 — Blend Mode

```mermaid
flowchart TD
    A([User toggles Blend Mode switch]) --> B["useAppStore.setBlendEnabled(true)"]
    B --> C["GenreBlender shown\n(secondary genre selector + ratio slider)"]
    C --> D([User selects secondary genre])
    D --> E["useAppStore.setSecondaryGenre(genre)"]
    E --> F["useMemo recomputes:\nblendedWeights = blending.blendWeights(\n  primaryWeights, secondaryWeights, ratio)"]
    F --> G["blendedIdealCurve = blending.blendArcs(\n  primaryArc, secondaryArc, ratio)"]
    G --> H([Chart shows blended ideal curve\nWeights reflect blend])

    I([User moves Blend Ratio slider]) --> J["useAppStore.setBlendRatio(value)"]
    J --> F
```

---

## 3.7 — Tension Calculation (Engine Detail)

```mermaid
flowchart TD
    A["calculateTension(beat, weights)"] --> B["Compute 9 channels:"]
    B --> C1["infoAsym × weights.infoAsym"]
    B --> C2["stakes × weights.stakes"]
    B --> C3["(10 - alignment) × weights.misalignment"]
    B --> C4["abs(powerDiff) × weights.powerDiff"]
    B --> C5["vulnerability × (10 - trust)/10 × weights.vulnerability"]
    B --> C6["desire × (10 - intimacy)/10 × weights.desire"]
    B --> C7["proximity × (10 - trust)/10 × weights.proximity"]
    B --> C8["danger × weights.danger"]
    B --> C9["mystery × weights.mystery"]

    C1 & C2 & C3 & C4 & C5 & C6 & C7 & C8 & C9 --> D["rawTension = sum of all channels"]
    D --> E["maxPossible = sum of (maxValue × weight) for each channel"]
    E --> F["tension = (rawTension / maxPossible) × 10"]
    F --> G["Clamped 0–10"]
    G --> H(["T:x.x value used in:\n- BeatEditorRow badge\n- BeatEditorRow expanded bar\n- NarrativeChart tension line\n- ValidationPanel"])
```

---

## 3.8 — Key Files

| File | Role |
|------|------|
| `src/components/scaffolding/ScaffoldingWorkflow.jsx` | Root component; useMemo chains for weights/idealCurve/enrichedData/validation |
| `src/components/scaffolding/BeatEditor.jsx` | Beat add/remove orchestration |
| `src/components/scaffolding/BeatEditorRow.jsx` | Collapsed/expanded row; live tension badge |
| `src/components/scaffolding/DimensionSlider.jsx` | Single dimension slider |
| `src/components/scaffolding/BeatSuggestions.jsx` | Compare beat vs. ideal; apply suggestions |
| `src/components/scaffolding/NarrativeChart.jsx` | Recharts line chart |
| `src/components/scaffolding/StructureSelector.jsx` | Plot structure dropdown |
| `src/components/scaffolding/TemplateLoader.jsx` | Load preset arcs |
| `src/components/scaffolding/ScaffoldOutput.jsx` | Markdown/HTML export |
| `src/engine/tension.js` | `calculateTension()` — core formula |
| `src/engine/blending.js` | `blendWeights()`, `blendArcs()` |
| `src/engine/validation.js` | `validateAgainstGenre()` |
| `src/engine/suggestions.js` | Dimension suggestions vs. ideal |
| `src/engine/scaffoldOutput.js` | Format scaffold as markdown |
| `src/data/genreSystem.js` | Genre catalog |
| `src/data/plotStructures.js` | Beat structure definitions |
| `src/data/presetArcs.js` | Ideal tension curves per genre |
| `src/data/dimensions.js` | 11 dimension definitions |
| `src/store/useAppStore.js` | `scaffoldBeats`, `addBeat`, `updateBeat`, `removeBeat`, genre state |
