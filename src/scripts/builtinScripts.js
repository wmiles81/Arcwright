const builtinScripts = [
  {
    id: 'builtin-split-chapters',
    name: 'Split into Chapters',
    description: 'Detect chapter headings and split into individual files in a subfolder',
    language: 'js',
    context: 'file',
    builtin: true,
    code: `
const filePath = ctx.selectedNode?.path || ctx.getActiveFilePath();
if (!filePath) { ctx.error('No file selected'); return; }

ctx.log('Reading ' + filePath + '...');
const content = await ctx.readFile(filePath);

// Split on chapter headings: # Chapter, ## Chapter, CHAPTER, or just "Chapter N"
const chapterRegex = /^(?:#{1,3}\\s+)?(?:Chapter|CHAPTER)\\s+\\S+.*$/gm;
const matches = [...content.matchAll(chapterRegex)];

if (matches.length === 0) {
  ctx.error('No chapter headings found. Expected lines like "# Chapter 1" or "CHAPTER ONE".');
  return;
}

const folderName = ctx.prompt('Folder name for chapters:', 'Chapters');
if (!folderName) return;

// Determine base path (sibling of the source file)
const lastSlash = filePath.lastIndexOf('/');
const basePath = lastSlash > 0 ? filePath.substring(0, lastSlash) + '/' + folderName : folderName;

await ctx.createFolder(basePath);
ctx.log('Created folder: ' + basePath);

// Split content at each heading
const chapters = [];
for (let i = 0; i < matches.length; i++) {
  const start = matches[i].index;
  const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
  chapters.push({
    heading: matches[i][0].trim(),
    text: content.substring(start, end).trim(),
  });
}

let totalWords = 0;
for (let i = 0; i < chapters.length; i++) {
  const num = String(i + 1).padStart(2, '0');
  const filename = basePath + '/chapter-' + num + '.md';
  await ctx.writeFile(filename, chapters[i].text);
  const words = chapters[i].text.split(/\\s+/).length;
  totalWords += words;
  ctx.log('  ' + filename + ' (' + words + ' words) — ' + chapters[i].heading);
  ctx.progress(i + 1, chapters.length);
}

ctx.log('Split into ' + chapters.length + ' chapters (' + totalWords + ' total words).');
`,
  },

  {
    id: 'builtin-combine-chapters',
    name: 'Combine Chapters into Book',
    description: 'Read all .md files in a folder (sorted by name) and combine into a single book file',
    language: 'js',
    context: 'folder',
    builtin: true,
    code: `
const folderPath = ctx.selectedNode?.path;
if (!folderPath) { ctx.error('No folder selected'); return; }

ctx.log('Reading folder: ' + folderPath);
const entries = await ctx.readDir(folderPath);
const mdFiles = entries
  .filter(e => e.type === 'file' && /\\.(md|txt|markdown)$/i.test(e.name))
  .sort((a, b) => a.name.localeCompare(b.name));

if (mdFiles.length === 0) {
  ctx.error('No .md or .txt files found in ' + folderPath);
  return;
}

ctx.log('Found ' + mdFiles.length + ' text files.');

const defaultName = 'full-book-v1.md';
const outputName = ctx.prompt('Output filename (will be placed in ' + folderPath + '):', defaultName);
if (!outputName) return;

const parts = [];
let totalWords = 0;
for (let i = 0; i < mdFiles.length; i++) {
  const filePath = folderPath + '/' + mdFiles[i].name;
  const content = await ctx.readFile(filePath);
  parts.push(content);
  const words = content.split(/\\s+/).length;
  totalWords += words;
  ctx.log('  ' + mdFiles[i].name + ' (' + words + ' words)');
  ctx.progress(i + 1, mdFiles.length);
}

const combined = parts.join('\\n\\n');
const outputPath = folderPath + '/' + outputName;
await ctx.writeFile(outputPath, combined);
ctx.log('Combined ' + mdFiles.length + ' files into ' + outputPath + ' (' + totalWords + ' total words).');
`,
  },

  {
    id: 'builtin-emdash-cleanup',
    name: 'Em-dash Cleanup',
    description: 'Replace non-interruption em-dashes with comma-space',
    language: 'js',
    context: 'both',
    builtin: true,
    code: `
// Determine target: single file or all files in folder
let filePaths = [];

if (ctx.selectedNode?.type === 'dir') {
  const entries = await ctx.readDir(ctx.selectedNode.path);
  filePaths = entries
    .filter(e => e.type === 'file' && /\\.(md|txt)$/i.test(e.name))
    .map(e => ctx.selectedNode.path + '/' + e.name);
} else {
  const path = ctx.selectedNode?.path || ctx.getActiveFilePath();
  if (!path) { ctx.error('No file or folder selected'); return; }
  filePaths = [path];
}

if (filePaths.length === 0) { ctx.error('No text files found'); return; }

ctx.log('Processing ' + filePaths.length + ' file(s)...');

// Pattern: word character followed by em-dash followed by word character
// This catches "word—word" (non-interruption) but NOT:
//   "word—" (trailing, interruption)
//   "—word" (resumption)
//   "word—" before quotes (dialogue interruption)
const pattern = /(\\w)\\u2014(\\w)/g;

let totalReplacements = 0;
for (let i = 0; i < filePaths.length; i++) {
  const path = filePaths[i];
  const content = await ctx.readFile(path);
  const matches = content.match(pattern);
  const count = matches ? matches.length : 0;

  if (count > 0) {
    const cleaned = content.replace(pattern, '$1, $2');
    await ctx.writeFile(path, cleaned);
    totalReplacements += count;
    ctx.log('  ' + path + ': ' + count + ' replacements');
  } else {
    ctx.log('  ' + path + ': no changes');
  }
  ctx.progress(i + 1, filePaths.length);
}

ctx.log('Total: ' + totalReplacements + ' em-dashes replaced across ' + filePaths.length + ' file(s).');
`,
  },

  {
    id: 'builtin-regex-replace',
    name: 'Regex Search & Replace',
    description: 'Describe what to find in plain English or enter a regex directly',
    language: 'js',
    context: 'both',
    builtin: true,
    code: `
// Step 1: Optional AI-assisted description
const description = ctx.prompt('Describe what you want to find (or leave empty to enter regex directly):');
if (description === null) return;

let suggestedPattern = '';
if (description.trim()) {
  ctx.log('Asking AI to generate a regex pattern...');
  try {
    const aiResponse = await ctx.askAI(
      'I need a JavaScript regex pattern to find the following in prose/markdown text:\\n\\n' + description + '\\n\\nRespond with ONLY the regex pattern on a single line. No explanation, no slashes, no flags — just the raw pattern.',
      'You are a regex expert. Output only the raw regex pattern, nothing else.'
    );
    suggestedPattern = aiResponse.trim();
    ctx.log('AI suggested: /' + suggestedPattern + '/');
  } catch (e) {
    ctx.warn('AI request failed: ' + e.message);
  }
}

// Step 2: Direct regex input (pre-filled with AI suggestion if available)
const searchPattern = ctx.prompt('Regex pattern:', suggestedPattern);
if (!searchPattern) return;

// Step 3: Replacement (empty = find only)
const replacement = ctx.prompt('Replacement (empty = find only, use $1 $2 for groups):', '');
if (replacement === null) return;

const findOnly = replacement === '';
const flags = ctx.prompt('Flags:', 'g');
if (flags === null) return;

let regex;
try {
  regex = new RegExp(searchPattern, flags);
} catch (e) {
  ctx.error('Invalid regex: ' + e.message);
  return;
}

// Determine target files
let filePaths = [];

if (ctx.selectedNode?.type === 'dir') {
  const entries = await ctx.readDir(ctx.selectedNode.path);
  filePaths = entries
    .filter(e => e.type === 'file' && /\\.(md|txt)$/i.test(e.name))
    .map(e => ctx.selectedNode.path + '/' + e.name);
} else {
  const path = ctx.selectedNode?.path || ctx.getActiveFilePath();
  if (!path) { ctx.error('No file or folder selected'); return; }
  filePaths = [path];
}

if (filePaths.length === 0) { ctx.error('No text files found'); return; }

ctx.log((findOnly ? 'Searching' : 'Replacing in') + ' ' + filePaths.length + ' file(s) for /' + searchPattern + '/' + flags);

let totalMatches = 0;
let totalFiles = 0;
for (let i = 0; i < filePaths.length; i++) {
  const path = filePaths[i];
  const content = await ctx.readFile(path);

  const matches = content.match(new RegExp(searchPattern, flags.replace('g', '') + 'g'));
  const count = matches ? matches.length : 0;

  if (count > 0) {
    if (findOnly) {
      ctx.log('  ' + path + ': ' + count + ' matches');
      matches.forEach((m, j) => {
        if (j < 20) ctx.log('    ' + (j + 1) + '. "' + m + '"');
      });
      if (matches.length > 20) ctx.log('    ... and ' + (matches.length - 20) + ' more');
    } else {
      const updated = content.replace(regex, replacement);
      await ctx.writeFile(path, updated);
      ctx.log('  ' + path + ': ' + count + ' matches replaced');
    }
    totalMatches += count;
    totalFiles++;
  } else {
    ctx.log('  ' + path + ': no matches');
  }
  ctx.progress(i + 1, filePaths.length);
}

if (findOnly) {
  ctx.log('Found ' + totalMatches + ' matches across ' + totalFiles + ' file(s).');
} else {
  ctx.log('Replaced ' + totalMatches + ' matches across ' + totalFiles + ' file(s).');
}
`,
  },
  {
    id: 'builtin-rename-chapters',
    name: 'Rename Chapter Files',
    description: 'Rename files like "01-##-Chapter-1.md" → "chapter-01.md" in the current folder',
    language: 'js',
    context: 'both',
    builtin: true,
    code: `
// Determine target folder from selected dir node or active file's parent
let folderPath;
if (ctx.selectedNode?.type === 'dir') {
  folderPath = ctx.selectedNode.path;
} else {
  const activeFile = ctx.getActiveFilePath();
  if (!activeFile) {
    ctx.error('No folder selected and no file open. Select a folder in the Files panel or open a file in the target folder.');
    return;
  }
  const lastSlash = activeFile.lastIndexOf('/');
  folderPath = lastSlash > 0 ? activeFile.substring(0, lastSlash) : '';
}

ctx.log('Scanning: ' + (folderPath || '(root)'));
const entries = await ctx.readDir(folderPath);

// Match files like 01-##-Chapter-1.md (## are literal hash characters)
const pattern = /^(\\d+)-##-.+\\.md$/;
const candidates = entries.filter(e => e.type === 'file' && pattern.test(e.name));

if (candidates.length === 0) {
  ctx.log('No files matching the pattern "NN-##-*.md" found in this folder.');
  return;
}

ctx.log('Found ' + candidates.length + ' file(s) to rename:');
candidates.forEach(e => {
  const num = e.name.match(/^(\\d+)/)[1];
  const newName = 'chapter-' + num.padStart(2, '0') + '.md';
  ctx.log('  ' + e.name + '  →  ' + newName);
});

const ok = ctx.confirm('Rename ' + candidates.length + ' file(s)?');
if (!ok) { ctx.log('Cancelled.'); return; }

let renamed = 0;
for (let i = 0; i < candidates.length; i++) {
  const entry = candidates[i];
  const num = entry.name.match(/^(\\d+)/)[1];
  const newName = 'chapter-' + num.padStart(2, '0') + '.md';
  const oldPath = folderPath ? folderPath + '/' + entry.name : entry.name;
  const newPath = folderPath ? folderPath + '/' + newName : newName;

  if (oldPath === newPath) {
    ctx.log('  Skipped (already correct): ' + entry.name);
    ctx.progress(i + 1, candidates.length);
    continue;
  }

  const content = await ctx.readFile(oldPath);
  await ctx.writeFile(newPath, content);
  await ctx.deleteFile(oldPath);
  ctx.log('  ' + entry.name + '  →  ' + newName);
  renamed++;
  ctx.progress(i + 1, candidates.length);
}

ctx.log('Done. ' + renamed + ' file(s) renamed.');
await ctx.refreshFileTree();
`,
  },
];

export default builtinScripts;
