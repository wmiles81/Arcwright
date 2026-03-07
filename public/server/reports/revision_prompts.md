# Revision Pipeline Prompts

This document describes the prompts used by the AI chapter revision pipeline in Arcwright's Edit workflow.

## Overview

The revision pipeline is launched from the **Revise** button in the Edit toolbar. It processes selected chapter files, sending each to the AI with revision guidance derived from analysis data (dimension gaps, revision checklist items) or custom instructions.

---

## System Prompt

The system prompt establishes the AI's role and rules:

```
You are an expert developmental editor and prose stylist specializing in {genreName}, specifically {subgenreName}. Your task is to revise a chapter of fiction.

RULES:
1. Output ONLY the revised chapter text. No preamble, no commentary, no explanation, no meta-discussion.
2. Preserve the author's voice, style, and POV.
3. Maintain all plot points and character actions — do not add or remove scenes.
4. Apply the revision guidance provided to adjust narrative dimensions through prose craft: word choice, pacing, interiority, dialogue subtext, physical detail, and scene structure.
5. Keep approximately the same word count (within 10%).
6. Preserve any markdown formatting (headings, emphasis, etc.).
7. Do not include any text before or after the revised chapter.
```

**Variables:**
- `{genreName}` — The selected genre (e.g., "Romance", "Thriller")
- `{subgenreName}` — The selected subgenre (e.g., "Contemporary Romance", "Psychological Thriller")

---

## User Prompt Structure

The user prompt is built dynamically based on the selected revision source:

### Source: Checklist + Gaps (or Checklist only)

When revision checklist items match the chapter:

```markdown
## Revision Checklist

### {beatName} ({timePercent}%) — Priority: {priority}
Diagnosis: {aiDiagnosis}
Recommendation: {aiRecommendation}
- Reduce {dimensionName} by ~{amount} (currently {actual}, target ~{ideal})
- Increase {dimensionName} by ~{amount} (currently {actual}, target ~{ideal})

## Chapter Text to Revise

{chapterText}
```

### Source: Dimension Gaps (or Gaps only)

When dimension gaps are detected for the chapter:

```markdown
## Dimension Gap Analysis

| Dimension | Current | Ideal | Gap | Direction |
|-----------|---------|-------|-----|-----------|
| {dimensionName} | {actual} | {ideal} | {absGap} | {direction} |

## Chapter Text to Revise

{chapterText}
```

### Source: Custom Prompt

When using custom revision instructions:

```markdown
## Revision Instructions

{customPrompt}

## Chapter Text to Revise

{chapterText}
```

### Fallback (No Analysis Data)

When no specific gaps or checklist items match the chapter, generic guidance is provided:

```markdown
## Revision Focus

No specific dimension gaps were detected for this chapter, but please apply these general improvements:

1. **Prose Polish**: Tighten sentence structure, eliminate unnecessary words, and vary sentence rhythm
2. **Show Don't Tell**: Convert any telling passages into vivid sensory details and character actions
3. **Dialogue Enhancement**: Ensure dialogue sounds natural, has subtext, and reveals character
4. **Pacing**: Check that scene momentum matches the emotional beats — speed up action, slow down for emotional moments
5. **Interiority**: Deepen character internal thoughts where appropriate for POV

## Chapter Text to Revise

{chapterText}
```

---

## Chapter Matching Logic

The pipeline matches files to analyzed chapters using:

1. **Content Match** — Exact text comparison (trimmed)
2. **Filename Pattern** — `##-Title.md` format maps to chapter index
3. **Title Substring** — Fuzzy match on chapter title

### Revision Item Matching

Revision checklist items are matched to chapters via:

1. **Time Range** — Item's time falls within chapter's span (midpoint to midpoint)
2. **Exact Time** — Item's time matches chapter's calculated timePercent
3. **Beat Key** — Normalized beat key comparison (case-insensitive, alphanumeric only)

---

## API Call Parameters

```javascript
{
  maxTokens: Math.max(chatSettings.maxTokens || 4096, 8192),
  temperature: 0.7
}
```

- **maxTokens** — At least 8192 to accommodate full chapter output
- **temperature** — 0.7 for creative but controlled revision

---

## Source Files

- `src/chat/revisionPrompts.js` — Prompt building functions
- `src/hooks/useRevisionPipeline.js` — Pipeline orchestration
- `src/engine/revisionChecklist.js` — Checklist generation from gap analysis
- `src/components/edit/RevisionModal.jsx` — Configuration UI
