# Semantic Physics Engine (SPE)

> **A constraint-based system for enforcing "High Entropy" prose in AI-generated fiction.**

---

## Background

AI language models tend to generate "First Probability" text—the most statistically likely output given the training data. In fiction, this manifests as:

- **Clichéd phrases:** "shivers down spines," "breath hitched," "practiced ease"
- **Overused names:** Marcus, Elena, Kael, Chen
- **AI structural tells:** "couldn't help but," "found herself," "seemed to"
- **Generic description:** Abstract rather than concrete, sensory-specific prose

The SPE addresses this by creating **negative constraints** (ban lists) and **positive constraints** (sensory lenses, entropy profiles) that force the AI to reach deeper into its probability space—producing prose that feels more human, specific, and immersive.

---

## Core Philosophy: First Probability Avoidance

If a phrase could appear in *any* romance novel, it's too generic.

The SPE operates on the principle that **high-entropy prose is better prose**. By systematically blocking the "easy" paths, we force generation of more unique, specific, and emotionally resonant text.

---

## The Scoring System (Entropy Penalties)

The `penalty_score` (0.0 - 1.0) quantifies how "low entropy" or "AI-generated" a phrase appears.

### Derivation
Scores are derived from:
1.  **Likelihood:** How frequently the phrase appears in "First Probability" AI outputs.
2.  **Lethality:** How much the phrase disrupts immersion (e.g., "shiver down spine" is instant disengagement).

### Scale & Manifestation

| Score | Severity | Manifestation in Workflow |
| :--- | :--- | :--- |
| **1.0** | **Strict Ban** | **Must Replace.** Represents lazy, cliché, or hallmark AI phrases (e.g., "shiver down spine", "released a breath"). |
| **0.7 - 0.9** | **High Priority** | **Rewrite Required.** Allow only if contextually vital and heavily justified (e.g., "charged air"). |
| **0.1 - 0.6** | **Watch List** | **Style Monitor.** Accumulation creates "Entropy Debt." If a paragraph has too many, it requires a full rewrite. |

### Entropy Debt
During editing, scores are summed. A scene with high "Entropy Debt" indicates a need for a complete conceptual redraft, not just line editing.

---

## Character-Aware Tolerance

Different characters have different cliché tolerances based on their role and voice. The `character_entropy_budgets.yaml` file defines modifiers that adjust the base entropy profile tolerance.

### Formula
```
effective_tolerance = profile.cliche_tolerance × character.modifier × stress.modifier × context.modifier
```

### Example
```
breezy_dialogue (0.3) × comic_sidekick (2.5) × calm (1.0) × dialogue (1.3) = 0.975 effective tolerance
high_entropy_action (0.0) × protagonist (1.0) × panicked (2.0) × action (0.7) = 0.0 (strict stays strict)
```

### Character Archetypes

| Archetype | Base Modifier | Rationale |
|-----------|---------------|-----------|
| Protagonist | 1.0 | Standard - thoughts should feel original |
| Love Interest | 1.0 | Matches protagonist for balanced POV |
| Comic Sidekick | 2.5 | High tolerance - clichés are characterization |
| Naive Newcomer | 1.8 | Elevated - prefab language shows inexperience |
| Villain | 1.5 | Stylized - theatrical villainy allowed |
| Mentor | 0.8 | Lower - wisdom should sound specific |
| Minor Character | 1.5 | Economy of characterization |

---

## Files in This Folder

| File | Purpose |
|------|---------|
| `cliche_collider.yaml` | Ban list of forbidden phrases (somatic clichés, purple prose, AI patterns) |
| `sensory_lenses.yaml` | 7 "camera filters" for description (Acoustics, Thermodynamics, Somatics, Proprioception, Tactile-Micro, Tactile-Intimacy, Specific-Grounding) |
| `entropy_profiles.yaml` | "Heat levels" for scene types (High Action, Deep POV, Breezy Dialogue) |
| `name_collider.yaml` | Forbidden AI-default names by genre |
| `place_collider.yaml` | Forbidden AI-default location names (Willow Creek, Maplewood, etc.) |
| `character_entropy_budgets.yaml` | Character archetype tolerance modifiers and stress states |
| `npe_to_spe_mappings.yaml` | NPE→SPE translation rules (tension, MCS, stress, scene types) |
| `line_editing_protocol.yaml` | AI Writing Fixer principles for post-draft cleanup |

---

## How to Use

### During Drafting (Chapter Drafter, Serial Inhabitation)

1. **Select an Entropy Profile** based on scene type
2. **Activate a Sensory Lens** (1-2 per scene) to focus description
3. **Apply Character Entropy Budget** based on POV character archetype and stress state
4. **Avoid all items** in the `cliche_collider` ban list
5. **Check character names** against `name_collider` for genre
6. **Check location names** against `place_collider`

### During Editing (Line Editor, AI Writing Fixer)

1. **Run a "Semantic Pass"** scanning for banned patterns
2. **Apply `line_editing_protocol`** principles
3. **Replace violations** with higher-entropy alternatives
4. **Verify character-appropriate tolerance** - a comic sidekick can use more familiar language

### During Character Development

1. **Check proposed names** against `name_collider` for genre
2. **If forbidden**, generate a less common alternative
3. **Assign character archetype** from `character_entropy_budgets.yaml` for tolerance tracking

### During World Building

1. **Check proposed locations** against `place_collider`
2. **Avoid AI-default patterns** (Willow-, -brook, -wood, -haven)
3. **Prefer unexpected combinations** or historically-grounded names

---

## Updating the SPE

### Adding New Banned Phrases

Edit `cliche_collider.yaml`:

```yaml
category_name:
  - phrase: "new banned phrase"
    penalty_score: 0.7  # 0.0-1.0 (1.0 = strict ban)
    suggested_fix: "Alternative approach"
```

### Adding New Sensory Lenses

Edit `sensory_lenses.yaml`:

```yaml
lenses:
  new_lens_name:
    description: "What this lens emphasizes"
    triggers:
      - "Question to guide the writer"
    vocabulary_bias: [word1, word2, word3]
```

### Adding Genre-Specific Names

Edit `name_collider.yaml`:

```yaml
new_genre:
  forbidden_first_names_female: [Name1, Name2, ...]
  forbidden_first_names_male: [Name1, Name2, ...]
  forbidden_surnames: [Surname1, Surname2, ...]
```

### Adding Character Archetypes

Edit `character_entropy_budgets.yaml`:

```yaml
character_archetypes:
  new_archetype:
    base_tolerance_modifier: 1.0
    description: "What makes this archetype's voice distinct"
    stress_modifiers:
      calm: 1.0
      stressed: 1.5
    notes: "Guidance for applying this archetype"
```

---

## Integration Points

The SPE is referenced by:

- **`agents.md`:** Chapter Drafter (Semantic Entropy Protocol), Character Developer (Name Collision Check)
- **`GEMINI.md`:** Global Quality Standards section
- **`serial_inhabitation_agent.md`:** Semantic Entropy Check in Quality Rules
- **Voice Mechanics:** `female_voice_mechanics.md` and `male_voice_mechanics.md` in documentation folder

## Relationship to Semantic-Field-Engine (SFE)

The SPE is the **operational implementation** of the theoretical **Semantic-Field-Engine (SFE)**.

- **SFE** provides the conceptual framework: semantic fields, cliché-as-gravity, entropy budgets
- **SPE** provides the concrete tools: YAML configs, ban lists, tolerance modifiers

For the full theoretical background, see the SFE documentation at `/Workflows/projects/Semantic-Field-engine/`

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-18 | Initial SPE creation with cliche_collider, sensory_lenses, entropy_profiles |
| 2025-12-18 | Added name_collider with 5 genre lists |
| 2025-12-18 | Added line_editing_protocol (AI Writing Fixer) |
| 2025-12-18 | Added ai_structural_patterns to cliche_collider |
| 2026-01-15 | Synced SPE.md from Secret Twins—added banned_cliches, weak_vague_phrasing, watch_list_limited_use sections |
| 2026-01-15 | Added broad 'out of spite' rule for inanimate objects to cliche_collider |
| 2026-01-24 | Added place_collider.yaml for forbidden location names |
| 2026-01-24 | Expanded sensory_lenses.yaml to 7 lenses (added proprioception_grounded, tactile_intimacy, specific_grounding) |
| 2026-01-24 | Added character_entropy_budgets.yaml with 8 archetypes, stress modifiers, voice rigidity levels, and context modifiers |
| 2026-01-24 | Updated entropy_profiles.yaml with character-aware tolerance formula |
| 2026-01-24 | Added npe_to_spe_mappings.yaml for NPE→SPE translation (tension, MCS, stress, scene types) |

---

## Credits

Based on research into:
- AI prose compression bias
- "First Probability" generation patterns
- Community feedback on overused AI-generated phrases
- Professional line editing principles
