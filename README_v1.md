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

Arcwright stores all project data (settings, prompts, sequences, projects, chat history) in:

```
~/.arcwright/
```

This directory is created automatically on first run. If you have an existing Arcwrite folder from a previous version, the app will prompt you to import that data.

The data directory can be overridden for development/testing:

```bash
ARCWRIGHT_DATA=/path/to/custom/dir npm run dev
```

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

- OpenRouter
- OpenAI
- Anthropic
- Perplexity

API keys are stored in `~/.arcwright/settings.json`.

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

- **Data migration:** If upgrading from the browser-based version, use the import banner on the landing page to copy data from your old Arcwrite folder.

## License

See [LICENSE](LICENSE) for details.
