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
- **Local static serving for distribution builds:** Node.js `server.js`

## Prerequisites

Install the following on your local machine:

- **Node.js 18+** (Node.js 20 LTS recommended)
- **npm 9+** (ships with Node)
- A modern browser (Chrome, Edge, Firefox, or Safari)

Check your versions:

```bash
node -v
npm -v
```

## Run locally (development)

1. Clone the repository and move into it:

   ```bash
   git clone <your-repo-url>
   cd Arcwright
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the Vite dev server:

   ```bash
   npm run dev
   ```

4. Open the URL shown in your terminal (typically `http://localhost:5173`).

### Convenience scripts

You can also use included launcher scripts:

- **macOS/Linux:**

  ```bash
  ./start.sh
  ```

- **Windows (Command Prompt):**

  ```bat
  start.bat
  ```

## Build for production

Create a production build:

```bash
npm run build
```

This command creates/updates:

- `dist/` (Vite output)
- `Arcwright-dist/` (packaged static app files + `server.js`)

Preview the Vite production build locally:

```bash
npm run preview
```

## Run packaged distribution locally

The packaged output is intended to run behind a local web server (not via double-clicking `index.html`).

1. Build first:

   ```bash
   npm run build
   ```

2. Start the packaged server:

   ```bash
   cd Arcwright-dist
   node server.js
   ```

3. Open `http://localhost:3000`.

> The included `server.js` also provides an `/or-image-models` proxy endpoint used by OpenRouter image-model discovery.

## AI provider setup

Many features (chat, analysis, inline editing, revision pipeline) require an API key.

1. Launch the app.
2. Open **Settings** (gear icon).
3. Choose a provider and paste your API key.

Supported providers in the current codebase:

- OpenRouter
- OpenAI
- Anthropic
- Perplexity

API keys are stored in local browser storage for the running app.

## Useful npm scripts

- `npm run dev` — start development server
- `npm run build` — build and package distribution artifacts
- `npm run preview` — preview built app with Vite preview server

## Troubleshooting

- If the app appears blank after opening `index.html` directly, run a server (`npm run dev`, `npm run preview`, or `node server.js`).
- If ports are in use, stop other local servers or set `PORT` when running `server.js`:

  ```bash
  PORT=4000 node server.js
  ```

- If dependencies fail to install, delete `node_modules` and `package-lock.json`, then reinstall:

  ```bash
  rm -rf node_modules
  npm install
  ```

## License

No license file is currently included in this repository. Add one if you plan to distribute publicly.
