# Arcwright

Arcwright is a React + Vite application for planning, analyzing, and revising long-form fiction.
It combines story scaffolding tools, AI-assisted narrative analysis, and a multi-file editing workflow in a single local-first interface.

## What this project includes

- **Scaffold workflow** for building story arcs from templates, dimensions, and beat structures.
- **Analyze workflow** for chapter-level scoring and editorial feedback.
- **Edit workflow** with markdown editing, diff views, inline AI revision helpers, and scriptable text operations.
- **Projects workflow** for organizing writing artifacts.
- **Settings + providers** to connect supported AI APIs.

## Tech stack

- **Frontend:** React 18, Vite 5, Tailwind CSS, Zustand
- **Backend:** Node.js, Express, better-sqlite3
- **Architecture:** Dual-process development (Vite dev server + Express API), single-process production

## Prerequisites

- **Node.js 18+** (Node.js 20 LTS or later recommended)
- **npm 9+** (ships with Node)
- A modern browser (Chrome, Edge, Firefox, or Safari)

```bash
node -v
npm -v
```

## Data directory

Arcwright stores all settings, prompts, sequences, projects, chat history, and extension packs server-side under:

```
~/.arcwright/
```

Inside that directory, the SQLite database lives at `arcwright.db` and JSON artifacts live in matching subfolders (see the header of `server/routes/files.js`). The directory is created automatically on first run.

The editor's open-folder workspace is **separate** — it uses the browser's File System Access API and points wherever you choose (your manuscripts, drafts, etc.). That handle is persisted in IndexedDB so it reopens on relaunch.

The server data directory can be overridden for development/testing:

```bash
ARCWRIGHT_DATA=/path/to/custom/dir npm run dev
```

The standalone MCP server (`mcp/arcwright-mcp-server.js`, used by external ACP agents) reads from a different env var — `ARCWRITE_DATA_DIR` — and is not part of the main app build.

## Run locally (development)

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd Arcwright
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.

In development, two processes run in parallel:
- **Vite** on port 5173 (frontend with HMR)
- **Express API** on port 5174 (database + filesystem)

Vite proxies `/api/*` requests to the Express server automatically.

## Build for production

```bash
npm run build
```

This creates optimized static assets in `dist/`.

## Run in production

```bash
npm start
```

The Express server serves both the API and the static frontend on a single port (default 3000). Override with:

```bash
PORT=4000 npm start
```

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server (Vite HMR + API) |
| `npm run build` | Build static assets to `dist/` |
| `npm start` | Production server (single port) |
| `npm test` | Run unit tests (Vitest) |
| `npm run preview` | Preview build with Vite preview server |

## AI provider setup

Many features (chat, analysis, inline editing, revision pipeline) require an API key.

1. Launch the app.
2. Open **Settings** (gear icon).
3. Choose a provider and paste your API key.

Supported providers:

- **Cloud:** OpenRouter, OpenAI, Anthropic, Perplexity
- **Local (OpenAI-compatible REST on localhost):** Ollama, LM Studio, Jan.ai, LocalAI

Local providers require CORS to be enabled on their server — see the header comment in `src/api/providers.js` for per-provider setup (e.g., `OLLAMA_ORIGINS=http://localhost:5173 ollama serve`).

API keys and local-provider config are stored in `~/.arcwright/settings.json`.

## Troubleshooting

- **Port in use:** Kill existing processes or set `PORT` for production:

  ```bash
  PORT=4000 npm start
  ```

- **Dependencies fail:** Delete and reinstall:

  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

- **Reset data:** Delete `~/.arcwright/` (or your custom `ARCWRIGHT_DATA` directory) to start with an empty install. The directory is recreated on next launch.

## License

See [LICENSE](LICENSE) for details.
