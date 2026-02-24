import { dimensions, DIMENSION_KEYS } from '../data/dimensions';

/**
 * Build a system prompt for chapter revision.
 */
export function buildRevisionSystemPrompt(genreName, subgenreName) {
  return `You are an expert developmental editor and prose stylist specializing in ${genreName}, specifically ${subgenreName}. Your task is to revise a chapter of fiction.

RULES:
1. Output ONLY the revised chapter text. No preamble, no commentary, no explanation, no meta-discussion.
2. Preserve the author's voice, style, and POV.
3. Maintain all plot points and character actions — do not add or remove scenes.
4. Apply the revision guidance provided to adjust narrative dimensions through prose craft: word choice, pacing, interiority, dialogue subtext, physical detail, and scene structure.
5. Keep approximately the same word count (within 10%).
6. Preserve any markdown formatting (headings, emphasis, etc.).
7. Do not include any text before or after the revised chapter.`;
}

/**
 * Build a user prompt with chapter text and revision guidance.
 * @param {string} chapterText - Full chapter text
 * @param {'checklist'|'gaps'|'both'|'custom'} source - Revision source type
 * @param {object} analysisData - Source-specific data
 */
export function buildRevisionUserPrompt(chapterText, source, analysisData) {
  let guidance = '';

  if (source === 'checklist' || source === 'both') {
    const items = analysisData.revisionItems || [];
    if (items.length > 0) {
      guidance += '## Revision Checklist\n\n';
      items.forEach((item) => {
        guidance += `### ${item.beat} (${item.time}%) — Priority: ${item.priority}\n`;
        if (item.aiDiagnosis) guidance += `Diagnosis: ${item.aiDiagnosis}\n`;
        if (item.aiRecommendation) guidance += `Recommendation: ${item.aiRecommendation}\n`;
        item.adjustments.forEach((adj) => {
          guidance += `- ${adj.direction === 'reduce' ? 'Reduce' : 'Increase'} ${adj.dimensionName} by ~${adj.amount.toFixed(1)} (currently ${adj.actual.toFixed(1)}, target ~${adj.ideal.toFixed(1)})\n`;
        });
        guidance += '\n';
      });
    }
  }

  if (source === 'gaps' || source === 'both') {
    const details = analysisData.gapDetails || [];
    if (details.length > 0) {
      guidance += '## Dimension Gap Analysis\n\n';
      guidance += '| Dimension | Current | Ideal | Gap | Direction |\n';
      guidance += '|-----------|---------|-------|-----|-----------|\n';
      details.forEach((g) => {
        guidance += `| ${g.dimensionName} | ${g.actual.toFixed(1)} | ${g.ideal.toFixed(1)} | ${g.absGap.toFixed(1)} | ${g.direction} |\n`;
      });
      guidance += '\n';
    }
  }

  if (source === 'custom') {
    guidance += '## Revision Instructions\n\n';
    guidance += analysisData.customPrompt + '\n\n';
  }

  // Fallback: if no specific guidance was generated, provide default revision instructions
  if (!guidance.trim()) {
    guidance = `## Revision Focus

No specific dimension gaps were detected for this chapter, but please apply these general improvements:

1. **Prose Polish**: Tighten sentence structure, eliminate unnecessary words, and vary sentence rhythm
2. **Show Don't Tell**: Convert any telling passages into vivid sensory details and character actions
3. **Dialogue Enhancement**: Ensure dialogue sounds natural, has subtext, and reveals character
4. **Pacing**: Check that scene momentum matches the emotional beats — speed up action, slow down for emotional moments
5. **Interiority**: Deepen character internal thoughts where appropriate for POV

`;
  }

  return `${guidance}## Chapter Text to Revise\n\n${chapterText}`;
}

/**
 * Match a file's content/name to an analyzed chapter in the store.
 * Returns the matched chapter or null.
 */
export function matchFileToChapter(fileContent, fileName, chapters) {
  if (!chapters || chapters.length === 0) return null;

  // Primary: exact content match (trimmed)
  const trimmed = fileContent.trim();
  const contentMatch = chapters.find((ch) => ch.text?.trim() === trimmed);
  if (contentMatch) return contentMatch;

  // Secondary: filename pattern "##-Title.md" → match by index
  const nameMatch = fileName.match(/^(\d+)[_-](.+)\.md$/i);
  if (nameMatch) {
    const fileIndex = parseInt(nameMatch[1], 10) - 1;
    if (fileIndex >= 0 && fileIndex < chapters.length) {
      return chapters[fileIndex];
    }
    // Try title substring match
    const fileTitle = nameMatch[2].replace(/[-_]/g, ' ').toLowerCase();
    const titleMatch = chapters.find(
      (ch) =>
        ch.title?.toLowerCase().includes(fileTitle) ||
        fileTitle.includes(ch.title?.toLowerCase() || '')
    );
    if (titleMatch) return titleMatch;
  }

  return null;
}
