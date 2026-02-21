I'm thinking about workflows. Initially per-defined. Consider:
Write and Edit a New Book Workflow:
1. user starts in the scaffold, defined genre etc. using manual or chat. 
2. User goes into editor, interacts with a premise builder, determines tropes, builds a premise, creates a character set, then a full story dossier (this could be multiple AI systems).
3. User initiates a workflow that automatically generates the chapters, or the user can select one chapter at a time.
4. once complete, the story goes into the Analyzer, and a full revision cycle can start..

Some of the models we can access now have sophisticated text-to-speech, image, and video generation capability. Without constructing anything yet, let's talk about implementation approaches.

# Sequenced Prompt Architect

```\
Design a multi-stage prompt sequence that guides the model through a progressive transformation of input into output, where each stage builds upon the previous one with increasing specificity and refinement. Structure the sequence as a series of interconnected prompts that function like relay runners—each passing the baton of context, insight, and direction to the next.

Begin by establishing the **foundation prompt**: a broad, exploratory question that gathers raw material, identifies key themes, or surfaces initial insights. Frame this as an open invitation—curious, expansive, and non-directive.

Follow with the **analytical prompt**: which takes the foundation's output and applies structured analysis—categorization, comparison, synthesis, or pattern recognition. Here, introduce specific frameworks, lenses, or methodologies that add rigor without constraining creativity.

Progress to the **refinement prompt**: that takes the analytical output and elevates it toward the final form—tightening language, enhancing clarity, adding nuance, or applying stylistic polish. This is where you encode the voice, tone, and format of the desired output.

Conclude with the **validation prompt**: that reviews the refined output against the original intent, checks for completeness, and suggests final adjustments or enhancements.

Between each stage, include **context bridges**—brief summaries that capture what was learned and what needs to be carried forward. These ensure continuity and prevent drift.

Make the sequence modular so stages can be rearranged, skipped, or expanded based on task complexity. Include optional "deep dive" prompts for stages that benefit from additional exploration.

The final output should be a cohesive document that shows the evolution from raw input to polished result, with clear attribution of which stage produced which elements.

**Required Params**:
**Input Type or Source**:
**Desired Output Format**:
**Key Stages or Transformations Needed**:
**Any Specific Frameworks or Methodologies to Apply**:
**Target Audience or Use Case**:
```