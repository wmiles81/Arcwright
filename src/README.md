# Arcwright

A multi-dimensional narrative analysis and writing tool that maps fiction across 11 narrative dimensions. Build story arcs from genre templates, reverse-engineer existing manuscripts with AI-powered analysis, and write and revise with a full editor featuring diff/merge, inline AI editing, and multi-file revision pipelines.

## Quick Start

### Option 1: Run the dev server (recommended for development)

Requires [Node.js](https://nodejs.org/) (v18+).

```bash
npm install
npm run dev
```

Or use the start scripts:

- **Mac/Linux:** `./start.sh`
- **Windows:** `start.bat`

### Option 2: Use the pre-built distribution

The `Arcwright-dist/` folder contains a ready-to-run build.

**Important:** This app requires a local web server. Double-clicking `index.html` will not work due to browser security restrictions on ES modules.

```bash
cd Arcwright-dist
./start.sh        # Mac/Linux
start.bat         # Windows
# Or: npx serve -s . -l 3000
```

### Option 3: Build and preview

```bash
npm run build
npm run preview
```

## AI Features

The AI chat panel, chapter analysis, inline editing, and revision pipeline require an API key from a supported provider. Configure your key in **Settings** (gear icon in the nav bar).

Supported providers:

- **OpenRouter** — Access 200+ models through a unified API
- **OpenAI** — GPT-4o, GPT-4.1, o3, and more
- **Anthropic** — Claude models via direct API
- **Perplexity** — Search-augmented AI models

Keys are stored locally in your browser and sent only to the selected provider's API.

## Workflows

- **Scaffold** — Build story arcs from genre templates with 11-dimension beat editing, genre blending, drag-and-drop reordering, and AI-powered suggestions
- **Analyze** — Add chapters (single or bulk split) and get AI-scored dimensional analysis, comparison overlays against genre ideals, and editorial get-well plans
- **Edit** — Full writing environment with file browser, markdown editor, dual-pane mode, side-by-side diff/merge view with word-level highlighting and gutter arrows, AI chapter revision pipeline, inline AI editing with preset prompts, and script execution (split/combine chapters, em-dash cleanup, regex search & replace)
- **Projects** — Manage book projects with AI-assisted metadata editing
- **Help** — In-app documentation covering all workflows, story structures, narrative dimensions, and a full changelog

## Chat Panel

Click the toggle on the left edge to open the AI chat assistant. It's context-aware — it knows which workflow you're on, can read your current data, and can modify fields directly via natural language. Supports multiple prompt modes (Full Context, Line Editor, Writing Partner, Critic, Version Comparator).
