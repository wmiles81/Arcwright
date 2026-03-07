# Arcwright Workflow Architecture

## 1. Project Entry

Two paths in, one convergence point.

```mermaid
flowchart LR
    A[New Project] --> B{How are you starting?}
    B -->|Exploring the market| C[Market Study First]
    B -->|I know my genre| D[Genre Selection First]
    C --> E[Genre + Comps Established]
    D --> E
```

---

## 2. Full Pipeline — Stage Sequence

NPE stages are optional. All stages are composable modules.

```mermaid
flowchart TD
    A[Market Study] --> B[Concept Development]
    B --> C[NPE Modeling]
    C --> D[Series Framework]
    D --> E[Book-Level Development]
    E --> F[NPE Validation]
    F --> G[Drafting]
    G --> H[Revision and Editing]
    H --> I[Production]
    I -->|Next Book| E

    style C stroke-dasharray: 5 5
    style F stroke-dasharray: 5 5
```

> Dashed borders = optional NPE stages. Without NPE, the flow goes Concept → Framework → Book Dev → Drafting.

---

## 3. Phase Detail — Market Study

```mermaid
flowchart TD
    A[Research Agent runs] --> B[Identify Comp Titles]
    B --> C[Collect per comp:]
    C --> D[Author + Title]
    C --> E[Cover Image]
    C --> F[Blurb Text]
    C --> G[Kindle Ranking + Date]
    D & E & F & G --> H[Comp Database stored in project]
    H --> I[Trend Analysis Report]
    I --> J[Genre/Subgenre Recommendation]
```

---

## 4. Phase Detail — Concept Development

```mermaid
flowchart TD
    A[Market context + genre] --> B[Generate 3-5 Concept Pitches]
    B --> C[Craft Hooks and Loglines]
    C --> D[Map Core Themes]
    D --> E{User picks direction}
    E -->|Approved| F[Proceed to Framework]
    E -->|Revise| B
```

---

## 5. Phase Detail — Book Development

```mermaid
flowchart TD
    A[Series Framework] --> B[Character Design + Arcs]
    B --> C[Plot Architecture]
    C --> D[Subplot Weaving]
    D --> E[Voice and Style Guide]
    E --> F[Beat Sheet Selection]
    F --> G[Chapter Mapping]
    G --> H[Book Dossier Complete]
    H --> I{Review Gate}
    I -->|Approved| J[Proceed to Drafting]
    I -->|Revise| B
```

---

## 6. Phase Detail — Revision

```mermaid
flowchart TD
    A[First Draft] --> B[Developmental Edit]
    B --> C[Consistency Check]
    C --> D[Pacing Analysis]
    D --> E[Line Edit]
    E --> F[Copy Edit]
    F --> G[Beta Reader Feedback]
    G --> H{Issues found?}
    H -->|Major| B
    H -->|Minor| I[Proofread]
    I --> J[Final Manuscript]
```

---

## 7. Model Profiles

Stages bind to roles. Users configure what model backs each role.

```mermaid
flowchart LR
    subgraph Stages
        S1[Market Study]
        S2[Concept Dev]
        S3[Drafting]
        S4[Line Edit]
        S5[Continuity]
    end

    subgraph Profiles
        R1[Researcher]
        R2[Strategist]
        R3[Drafter]
        R4[Editor]
        R5[Analyst]
    end

    subgraph Models
        M1[Perplexity Sonar Pro]
        M2[Claude Sonnet 4.5]
        M3[Claude Sonnet 4.5]
        M4[GPT-4o]
        M5[Gemini 2.5 Pro]
    end

    S1 --> R1 --> M1
    S2 --> R2 --> M2
    S3 --> R3 --> M3
    S4 --> R4 --> M4
    S5 --> R5 --> M5
```

---

## 8. Data Model

```mermaid
flowchart TD
    A[Project] --> B[Series]
    B --> C[Comp Database]
    B --> D[Series Framework]
    B --> E[Model Profiles]
    B --> F[NPE State - optional]
    B --> G[Book 1]
    B --> H[Book 2]
    B --> I[Book N...]
    G --> J[Dossier]
    G --> K[Beat Sheet]
    G --> L[Chapters]
    G --> M[Drafts]
    G --> N[Edit Passes]
```

---

## 9. Three Presets

| Preset | Stages Included |
|---|---|
| **Full** | Market → Concept → NPE → Framework → Book Dev → NPE Validation → Draft → Revise → Produce |
| **Streamlined** | Market → Concept → Framework → Book Dev → Draft → Revise → Produce |
| **Custom** | User picks and orders from all available stages |

## 10. Existing Manuscript Entry

Two purposes, two entry points into the pipeline.

```mermaid
flowchart TD
    A[Existing Manuscript] --> B{Purpose?}
    B -->|Series reference| C[Summarize + Extract]
    C --> D[Populate Series Bible]
    D --> E[Continue from Framework]
    B -->|In for repairs| F[Revision Workflow]
```

---

## 11. Book Completion Cycle

```mermaid
flowchart TD
    A[Book N Complete] --> B[Generate Book Summary]
    B --> C[Update Series Bible]
    C --> D{More books?}
    D -->|Yes| E[Book N+1 uses updated bible]
    D -->|No| F[Series Complete]
```

---

## 12. Minimum Viable Path

```mermaid
flowchart LR
    A[Genre] --> B[Premise] --> C[Bible] --> D[Outline] --> E[Draft]
```

---

## 13. Custom Stages + Beta Feedback

- **Custom stages:** Same UI pattern as adding a beat in Scaffold — insert, remove, reorder
- **Beta reader feedback:** Re-enters at the revision entry point, severity determines how far back

---

## Resolved Decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Book or series? | Series-first. Standalone = 1-book series |
| 2 | Market study or genre first? | Flexible entry — user chooses |
| 3 | Model selection | Model profiles — named roles bound to provider/model |
| 4 | NPE required? | Three presets: Full, Streamlined, Custom |
| 5 | Existing manuscript? | Two paths: series reference or repairs |
| 6 | Book N+1 inheritance? | Summaries + bible update at each book completion |
| 7 | Custom stages? | Scaffold-style UI — add, remove, reorder |
| 8 | Minimum viable path? | Genre → Premise → Bible → Outline → Draft |
| 9 | Beta reader loop? | Re-enters at revision entry point |

