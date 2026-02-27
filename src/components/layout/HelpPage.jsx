import React, { useState, useEffect, useRef } from 'react';
import { dimensions, DIMENSION_KEYS } from '../../data/dimensions';
import { WEIGHT_KEYS } from '../../engine/weights';
import { plotStructures, referenceStructures } from '../../data/plotStructures';
import { genreSystem } from '../../data/genreSystem';
import ActStructuresTab from './ActStructuresTab';

/**
 * Renders a Mermaid flowchart diagram. Mermaid is lazy-imported so it only
 * loads when the Help page is opened.
 */
function MermaidDiagram({ chart, id }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    import('mermaid').then((m) => {
      if (cancelled) return;
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#7C3AED',
          primaryTextColor: '#e9d5ff',
          primaryBorderColor: '#9333ea',
          lineColor: '#a78bfa',
          secondaryColor: '#1e1b4b',
          tertiaryColor: '#312e81',
          background: '#0f172a',
          mainBkg: '#1e1b4b',
          nodeBorder: '#7C3AED',
          clusterBkg: '#1e1b4b',
          titleColor: '#e9d5ff',
          edgeLabelBackground: '#1e1b4b',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
        },
      });
      const uid = `mermaid-${id || Math.random().toString(36).slice(2)}`;
      m.default.render(uid, chart).then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      }).catch((e) => {
        if (!cancelled && ref.current) ref.current.textContent = `Diagram error: ${e.message}`;
      });
    });
    return () => { cancelled = true; };
  }, [chart, id]);

  return (
    <div
      ref={ref}
      style={{ margin: '16px 0', overflowX: 'auto', textAlign: 'center' }}
    />
  );
}

const tabs = ['about', 'interface', 'mainPages', 'sequences', 'dataPacks', 'structures', 'actStructures', 'dimensions', 'changelog'];

function Tab({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-semibold rounded-t transition-colors ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-slate-800/50 text-purple-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-purple-300 mb-3 border-b border-purple-500/30 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function AboutTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="What is Arcwright?">
        <p>
          Arcwright is a multi-dimensional narrative analysis and writing tool that treats fiction
          as a system of interacting forces. Instead of thinking about plot as a single rising-and-falling
          line, it tracks <strong>11 narrative dimensions</strong> simultaneously &mdash; intimacy, power,
          information asymmetry, danger, trust, and more &mdash; to reveal the hidden physics of storytelling.
        </p>
        <p className="mt-2">
          The core insight is that <strong>tension emerges from mismatches</strong>: desire without intimacy,
          vulnerability without trust, proximity without safety. The tool calculates these gaps and weights
          them by genre to produce a tension curve that mirrors what a reader actually feels.
        </p>
      </Section>

      <Section title="Workflows">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h4 className="font-bold text-white mb-2">Scaffold</h4>
            <p>
              Build a new story's dimensional arc from scratch or start from a genre template.
              Set dimension values at each story beat and watch your narrative take shape in real time.
              Use this when you're <strong>planning a new story</strong> and want to ensure it hits
              the right emotional beats for your genre.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h4 className="font-bold text-white mb-2">Analyze</h4>
            <p>
              Analyze an existing manuscript chapter-by-chapter. AI scores the narrative dimensions,
              you refine the scores, then compare against genre ideals. The tool generates a visual
              comparison overlay and a written <strong>get-well plan</strong> with specific editorial
              recommendations.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h4 className="font-bold text-white mb-2">Edit</h4>
            <p>
              A full writing environment with file browser, markdown editor, <strong>inline AI editing</strong>,
              and <strong>AI chapter revision pipeline</strong>. Open a folder, edit files, use dual-pane mode
              with <strong>side-by-side diff/merge view</strong> to compare and cherry-pick revisions
              paragraph-by-paragraph. Design <strong>named sequences</strong> — reusable prompt pipelines
              that chain steps together and write output to disk. Run scripts to split chapters, clean up formatting, and more.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h4 className="font-bold text-white mb-2">Projects</h4>
            <p>
              Manage book projects with AI-assisted metadata editing. Track project details, genres,
              and settings across multiple works.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Getting Started">
        <p className="mb-3 text-purple-200">
          New to Arcwright? Follow this flow to get set up and start writing.
        </p>
        <MermaidDiagram id="getting-started" chart={`
flowchart TD
    A([Open Arcwright]) --> B{Storage\\nconfigured?}

    B -- No --> C[Click the Setup banner]
    C --> D{Pick a folder}
    D -- "Folder named Arcwrite or Arcwright" --> E{Is this your\\nhome folder?}
    E -- Yes --> F[Use folder as-is]
    E -- No --> G["Create Arcwrite/ subfolder\\ninside the selected folder"]
    D -- Any other folder --> G
    F & G --> H

    B -- Yes --> H{Provider\\nconfigured?}
    H -- No --> I["Settings ⚙ → Providers tab\\nAdd API key for OpenRouter,\\nAnthropic, or OpenAI"]
    I --> J
    H -- Yes --> J{What do you\\nwant to do?}

    J -- Write a book --> K["Projects → New Book\\nOpen a folder → start editing"]
    J -- Chat with AI --> L["Open AI panel →\\njust start typing"]
    J -- Use an AI assistant --> M["Projects → AI Projects\\nCreate → add knowledge files → Activate"]

    K & L & M --> N([You're ready!])

    style A fill:#7C3AED,color:#fff,stroke:#9333ea
    style N fill:#059669,color:#fff,stroke:#10b981
    style I fill:#b45309,color:#fff,stroke:#d97706
    style C fill:#b45309,color:#fff,stroke:#d97706
`} />
        <p className="text-xs text-purple-400 mt-1">
          Storage is set once and remembered across sessions via IndexedDB. Your Arcwrite folder holds all projects, chat history, prompts, sequences, and images.
        </p>
      </Section>

      <Section title="AI Chat Assistant">
        <p>
          Click the toggle on the left edge of the screen to open the AI chat panel. The assistant
          is deeply integrated with the application &mdash; it knows which workflow you're on, can
          read all your current data (beats, scores, genre settings), and can <strong>modify fields
          directly</strong> via natural language commands like "set trust to 8 on the first beat"
          or "change genre to Science Fiction."
        </p>
        <p className="mt-2">
          The assistant can also <strong>generate images</strong> when an image provider and model
          are configured in <strong>Settings &rarr; Image</strong>. Generated images are saved
          to the <code className="text-purple-200 bg-slate-700/50 px-1 rounded">artifacts/</code> folder
          and displayed inline in chat messages and in the editor when referenced via markdown image syntax.
        </p>
        <p className="mt-2">
          Requires an API key &mdash; configure one in <strong>Settings</strong> (gear icon in the nav bar).
          Supports OpenRouter, OpenAI, Anthropic, and Perplexity.
          Click the <em>"Mode"</em> button in the chat header to inspect exactly what context
          the assistant receives.
        </p>
      </Section>

      <Section title="Genre System">
        <p>
          Each genre has a default <strong>plot structure</strong> (Romancing the Beat, Hero's Journey,
          Three Act, Mystery/Suspense) and <strong>dimension weights</strong> that define what creates
          tension in that genre. A romance weights the desire-intimacy gap heavily; a thriller weights
          info asymmetry and danger.
        </p>
        <p className="mt-2">
          <strong>Subgenres</strong> refine these weights further (Dark Romance amplifies danger and power
          differential; Cozy Mystery amplifies mystery while reducing stakes). <strong>Modifiers</strong> add
          a final layer (a "Mafia" modifier pushes danger and power even higher).
        </p>
      </Section>

      <Section title="Credits">
        <p>
          The <strong>Narrative Physics Engine</strong> &mdash; the general concept of modeling stories as
          systems of interacting dimensional forces &mdash; was developed by{' '}
          <strong>Elizabeth Ann West</strong>, CEO of the{' '}
          <strong>Future Fiction Academy</strong>.
        </p>
        <p className="mt-2">
          <strong>Rachel Heller</strong> introduced the Future Fiction Academy to{' '}
          <strong>John Truby</strong> and his organic approach to story structure.
        </p>
      </Section>

      <Section title="How Tension Works">
        <p>The tension score is computed from 9 weighted channels:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-purple-200">
          <li><strong>Info Asymmetry</strong> &mdash; direct from the dimension value</li>
          <li><strong>Stakes</strong> &mdash; direct from the dimension value</li>
          <li><strong>Misalignment</strong> &mdash; inverted goal alignment (10 - alignment)</li>
          <li><strong>Power Differential</strong> &mdash; absolute value of power difference</li>
          <li><strong>Vulnerability-Trust Gap</strong> &mdash; vulnerability * (10 - trust) / 10</li>
          <li><strong>Desire-Intimacy Gap</strong> &mdash; desire * (10 - intimacy) / 10</li>
          <li><strong>Proximity-Trust Gap</strong> &mdash; proximity * (10 - trust) / 10</li>
          <li><strong>Danger</strong> &mdash; direct from the dimension value</li>
          <li><strong>Mystery</strong> &mdash; direct from the dimension value</li>
        </ul>
        <p className="mt-2">
          Each channel is multiplied by its <strong>weight</strong> (0&ndash;3 scale), summed, and
          normalized to a 0&ndash;10 scale. Weights vary by genre/subgenre and can be adjusted manually.
        </p>
      </Section>
    </div>
  );
}

function InterfaceSubTabs({ active, onChange }) {
  const subs = [
    { id: 'nav', label: 'Nav Bar' },
    { id: 'settings', label: 'Settings' },
    { id: 'chat', label: 'Chat Panel' },
    { id: 'scaffold', label: 'Scaffold' },
    { id: 'analyze', label: 'Analyze' },
    { id: 'edit', label: 'Editor' },
    { id: 'projects', label: 'Projects' },
    { id: 'keys', label: 'Shortcuts' },
  ];
  return (
    <div className="flex flex-wrap gap-1 mb-5">
      {subs.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
            active === s.id
              ? 'bg-purple-500 text-white'
              : 'bg-slate-700/60 text-purple-300 hover:bg-slate-600 hover:text-white'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="inline-block bg-slate-700/70 text-purple-200 text-[10px] px-1.5 py-0.5 rounded font-mono border border-slate-600/50">
      {children}
    </kbd>
  );
}

function ControlRow({ name, children }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-purple-500/10 last:border-0">
      <span className="text-purple-300 font-semibold w-40 flex-shrink-0 text-xs">{name}</span>
      <span className="text-purple-200 text-xs flex-1">{children}</span>
    </div>
  );
}

function InterfaceGuideTab() {
  const [sub, setSub] = useState('nav');

  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <p className="text-xs text-purple-300 mb-1">
        Visual reference for every button, control, and status indicator in the app. Click a section below.
      </p>
      <InterfaceSubTabs active={sub} onChange={setSub} />

      <div key={sub}>
      {/* ── NAV BAR ── */}
      {sub === 'nav' && (
        <>
          <Section title="Navigation Bar">
            <p className="mb-3">The top bar is always visible. It provides workflow navigation, project status, and access to settings and help.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Logo / Home">Click the Arcwright logo or title to return to the home screen.</ControlRow>
              <ControlRow name="Scaffold">Navigate to the story scaffolding workflow. Purple highlight when active.</ControlRow>
              <ControlRow name="Analyze">Navigate to the chapter analysis workflow.</ControlRow>
              <ControlRow name="Edit">Navigate to the full writing/editing environment.</ControlRow>
              <ControlRow name="Projects">Opens the Projects dialog to manage book and AI projects. Disabled until the file system is initialized.</ControlRow>
              <ControlRow name={<>{'\u2699'} Settings</>}>Opens the Settings dialog (API keys, model selection, chat settings, appearance).</ControlRow>
              <ControlRow name="Help">Navigate to this documentation page.</ControlRow>
              <ControlRow name="Active Project Badge">Small purple badge showing the name of the active book or AI project. Truncates long names. Hidden when no project is active.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── SETTINGS ── */}
      {sub === 'settings' && (
        <>
          <Section title="Settings Dialog">
            <p className="mb-3">Opened via the gear icon in the nav bar. Six tabs: Providers, Chat, Appearance, Voice, Image, and Packs.</p>
          </Section>

          <Section title="Providers Tab">
            <p className="mb-2">Configure API keys and select models for each supported provider. Includes both cloud APIs and local LLM servers.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Active Provider">Dropdown at the top. Cloud providers appear when an API key is saved; local providers appear automatically. Determines which API is used for all AI features.</ControlRow>
              <ControlRow name="Cloud Provider Cards">OpenRouter, OpenAI, Anthropic, Perplexity. Each card has an API key input (password field with show/hide) and a model dropdown with pricing.</ControlRow>
              <ControlRow name="Local Provider Cards">Ollama, LM Studio, Jan.ai, LocalAI. No API key required — each card shows CORS setup instructions instead. Click ↻ to fetch models from the running local server.</ControlRow>
              <ControlRow name="API Key Input">Password field with show/hide toggle. Keys are stored locally in your browser and sent only to the selected provider.</ControlRow>
              <ControlRow name="Model Dropdown">Custom dropdown showing all available models. Each entry displays the model name and pricing (input/output cost per million tokens) when available.</ControlRow>
              <ControlRow name="Refresh Models">Button (↻) to re-fetch the model list from the provider&rsquo;s API or local server. Shows a spinner while loading. For local providers, enabled without an API key.</ControlRow>
            </div>
          </Section>

          <Section title="Chat Tab">
            <p className="mb-2">Fine-tune AI response behavior. Controls apply to all AI features (chat, inline edit, revision, analysis).</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Temperature">Slider 0&ndash;2. Controls randomness/creativity. Lower = more deterministic. Disabled if the selected model doesn&rsquo;t support it.</ControlRow>
              <ControlRow name="Max Tokens">Slider 256 to model&rsquo;s maximum. Caps the length of AI responses. Shows value as &ldquo;Xk&rdquo; when {'\u2265'}1000.</ControlRow>
              <ControlRow name="Native Tools">Toggle switch. When on, uses the provider&rsquo;s native tool-calling API. When off (or unsupported), falls back to fenced-block parsing. Shows a hint explaining the current state.</ControlRow>
              <ControlRow name="Reasoning">Toggle switch. Enables extended thinking / chain-of-thought on models that support it. Disabled with explanation on models that don&rsquo;t.</ControlRow>
              <ControlRow name="Model Info">Read-only section showing context length, max output tokens, input/output pricing, and modalities for the selected model.</ControlRow>
            </div>
          </Section>

          <Section title="Voice Tab">
            <p className="mb-2">Configure voice guides and narrator gender mechanics that are injected into every AI prompt.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Voice Guide">Dropdown listing all <code className="text-purple-200 bg-slate-700/50 px-1 rounded">.md</code> files in <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/voices/</code>. Selecting one loads the file and appends it to every system prompt as a style reference. The AI writes in the voice established by that guide.</ControlRow>
              <ControlRow name="Active Indicator">Shows the loaded voice file path. The guide content is injected into every AI call until cleared.</ControlRow>
              <ControlRow name="Narrator Gender">Three buttons: None / Female narrator / Male narrator. Selecting a gender loads the corresponding mechanics file from <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/gender-mechanics/female.md</code> or <code className="text-purple-200 bg-slate-700/50 px-1 rounded">male.md</code>. This content is appended <em>after</em> the voice guide as a supplemental layer &mdash; it doesn&rsquo;t replace the voice guide.</ControlRow>
              <ControlRow name="Gender Mechanics Files">Must be placed manually at <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/gender-mechanics/female.md</code> and <code className="text-purple-200 bg-slate-700/50 px-1 rounded">male.md</code>. An error is shown if the file is missing when you select a gender.</ControlRow>
            </div>
          </Section>

          <Section title="Appearance Tab">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Theme Picker">Grid of color swatches organized into Light and Dark sections. Click any swatch to apply that theme globally. The selected theme has a purple border.</ControlRow>
            </div>
          </Section>

          <Section title="Image Tab">
            <p className="mb-2">Configure AI image generation. Works with OpenRouter (via chat completions), OpenAI (DALL-E), and other providers that support image output.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Provider">Dropdown showing only providers with an API key configured. Selects which provider routes image generation requests.</ControlRow>
              <ControlRow name="Model">Free-text input for the model ID. Type any image model your provider supports (e.g., <code className="text-purple-200 bg-slate-700/50 px-1 rounded">openai/dall-e-3</code>, <code className="text-purple-200 bg-slate-700/50 px-1 rounded">black-forest-labs/flux-1.1-pro</code>).</ControlRow>
              <ControlRow name="Browse Button">Fetches image-capable models from the selected provider and displays them in a searchable list. Click a model to fill in the model ID field. Shows per-image or per-token pricing when available.</ControlRow>
              <ControlRow name="Model Browser">Searchable panel with a filter input. Shows model ID, display name, and pricing. The count footer shows filtered vs total results. Close to dismiss.</ControlRow>
              <ControlRow name="Default Size">Dropdown for default image dimensions: 1024&times;1024 (Square), 1792&times;1024 (Landscape), 1024&times;1792 (Portrait), or 512&times;512 (Small). Can be overridden per generation request.</ControlRow>
              <ControlRow name="Status Line">Shows &ldquo;Ready: Provider / model-id&rdquo; when configured. Shows a warning when no provider is selected.</ControlRow>
            </div>
          </Section>

          <Section title="Packs Tab">
            <p className="mb-2">View installed data packs from <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/extensions/</code>.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Pack Cards">Each installed pack displays its name, author, version, description, and content summary (genres, structures, prompts, sequences).</ControlRow>
              <ControlRow name="Pack Count">Header showing total installed packs and the extensions directory path.</ControlRow>
              <ControlRow name="Empty State">Instructions for installing packs when none are present.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── CHAT PANEL ── */}
      {sub === 'chat' && (
        <>
          <Section title="Chat Panel Overview">
            <p className="mb-3">
              The AI chat panel slides in from the left edge. Click the toggle arrow on the left edge of the screen to open/close it.
              The panel is resizable &mdash; drag the right edge to adjust width (280px to 50% of screen).
            </p>
          </Section>

          <Section title="Chat Header">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Provider / Model Badge">Shows &ldquo;Provider / model-name&rdquo; (e.g., &ldquo;OpenAI / gpt-4o&rdquo;). Click to open Settings and change provider or model.</ControlRow>
              <ControlRow name="Context Mode Badge">Purple badge indicating the current context mode (see below). Shows the active project name, or &ldquo;Full Context&rdquo; when no project is active.</ControlRow>
              <ControlRow name="&ldquo;tools&rdquo; Badge + AI Label">Small green &ldquo;tools&rdquo; badge visible in Full Context mode when native tools are enabled. When tools are active the &ldquo;AI&rdquo; label at the top-left also turns green. The AI can call tools to modify app state (beats, genres, scores).</ControlRow>
              <ControlRow name="Mode Button">Toggle button. When active (black background), an expandable panel shows the exact system prompt being sent to the AI. Use this to inspect what context the AI receives.</ControlRow>
              <ControlRow name="Prompts Button">Opens the Prompt Manager where you can create, edit, and delete saved prompt templates. Templates are stored as <code className="text-purple-200 bg-slate-700/50 px-1 rounded">.md</code> files in the <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/prompts/</code> folder and are also accessible via the <Kbd>/</Kbd> slash menu in the chat input.</ControlRow>
              <ControlRow name="Files Button">Toggle button. When active, shows a file tree panel listing files loaded from the open folder. Only visible when files are loaded. Files listed here are available as AI context.</ControlRow>
              <ControlRow name="New Chat Button">Document-with-plus icon. Clears all messages and starts a fresh conversation. Shows a confirmation dialog before clearing.</ControlRow>
            </div>
          </Section>

          <Section title="Context Modes">
            <p className="mb-3">
              The chat panel operates in different context modes that determine what system prompt and tools the AI receives.
              The mode is shown in the purple badge in the chat header.
            </p>
            <div className="space-y-3">
              <div className="bg-slate-800/50 rounded p-4 border-l-4 border-purple-500">
                <h5 className="font-bold text-white mb-1">Full Context</h5>
                <p className="text-xs text-purple-200 mb-2">
                  <strong>Default mode</strong> when no project is active. The AI receives a comprehensive system prompt
                  containing all app state: scaffold data (beats, genre, weights), analysis data (chapter scores, gaps),
                  editor content (open files, pane text), file tree, and the full set of tools for modifying fields.
                </p>
                <p className="text-xs text-purple-300">
                  <strong>Why &ldquo;Full Context&rdquo; gets prominent placement:</strong> It&rsquo;s the mode that makes the chat panel
                  most powerful &mdash; the AI can see and modify everything. The badge reminds you that the AI has deep access
                  to your current work. When you switch to a project mode, the badge changes to show the project name, so you
                  always know what context the AI is operating with.
                </p>
              </div>
              <div className="bg-slate-800/50 rounded p-4 border-l-4 border-blue-500">
                <h5 className="font-bold text-white mb-1">Book Project Mode</h5>
                <p className="text-xs text-purple-200">
                  Active when a book project is selected via the Projects dialog. The badge shows the project name.
                  The AI receives project files and metadata as context. Tools remain enabled.
                </p>
              </div>
              <div className="bg-slate-800/50 rounded p-4 border-l-4 border-green-500">
                <h5 className="font-bold text-white mb-1">AI Project Mode</h5>
                <p className="text-xs text-purple-200">
                  Active when an AI project is selected. The badge shows the project name.
                  Uses a custom system prompt defined in the project, plus the project&rsquo;s cataloged files.
                  Tools are disabled in this mode &mdash; the AI cannot modify app state.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Prompt Modes (Edit Workflow)">
            <p className="mb-2">
              When the chat panel is used within the Edit workflow, additional prompt modes are available
              that shape the AI&rsquo;s behavior for writing tasks:
            </p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Full Context">Default. AI sees all metadata, editor content, and has tools.</ControlRow>
              <ControlRow name="Line Editor">Focused on line-by-line editing. AI provides targeted corrections and rewrites for specific passages.</ControlRow>
              <ControlRow name="Writing Partner">Collaborative mode. AI suggests continuations, brainstorms ideas, and helps develop scenes.</ControlRow>
              <ControlRow name="Critic">Critical feedback mode. AI provides honest assessment of prose quality, pacing, character development, and structure.</ControlRow>
              <ControlRow name="Version Comparator">Compares two versions of text. Useful when you have original and revised content in dual-pane mode.</ControlRow>
            </div>
          </Section>

          <Section title="Message Area & Input">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Message Area">Scrollable area showing the conversation. User messages appear right-aligned; AI responses left-aligned with markdown rendering. Generated images appear inline below the message text.</ControlRow>
              <ControlRow name="Streaming Indicator">A blinking cursor animation while the AI is generating a response.</ControlRow>
              <ControlRow name="Loading Dots">Three bouncing dots appear while waiting for the first chunk of a streaming response.</ControlRow>
              <ControlRow name="Error Display">Red background box showing error details if an API call fails.</ControlRow>
              <ControlRow name="Text Input">Multi-line textarea. Press <Kbd>Enter</Kbd> to send, <Kbd>Shift+Enter</Kbd> for a new line.</ControlRow>
              <ControlRow name={<>{'\u2191'} Send Button</>}>Bottom-right of the input. Disabled when empty. Sends the message.</ControlRow>
              <ControlRow name={<>{'\u25A0'} Stop Button</>}>Replaces the send button while the AI is responding. Click to abort generation mid-stream.</ControlRow>
              <ControlRow name="/ Slash Menu">Type <Kbd>/</Kbd> in the chat input without a space to open a floating picker showing two groups: <strong>Sequences</strong> (run immediately on select) and <strong>Prompts</strong> (insert template text into the input for editing before sending). Arrow keys navigate, Enter or click selects, Escape or a space closes the menu. Typing after <Kbd>/</Kbd> filters both groups by name.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── SCAFFOLD ── */}
      {sub === 'scaffold' && (
        <>
          <Section title="Genre Configuration">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Genre Dropdown">Primary genre selection (Romance, Science Fiction, Fantasy, Mystery/Thriller/Suspense). Sets the default plot structure and dimension weights.</ControlRow>
              <ControlRow name="Subgenre Dropdown">Refines weights within the selected genre (e.g., Dark Romance, Space Opera, Cozy Mystery).</ControlRow>
              <ControlRow name="Modifier Dropdown">Applies a pacing modifier (Relaxed, Standard, Intense, Extreme) that scales tension weights up or down.</ControlRow>
              <ControlRow name="Blend Mode Toggle">Enable to merge two genres. Reveals a secondary genre selector and blend ratio slider.</ControlRow>
              <ControlRow name="Blend Ratio Slider">0&ndash;100%. Controls the mix between primary and secondary genre weights, arcs, and requirements.</ControlRow>
            </div>
          </Section>

          <Section title="Structure & Templates">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Beats Structure">Teal dropdown. Selects the beat structure template (Romancing the Beat, Hero&rsquo;s Journey, Three Act, Mystery/Suspense). Shows beat count.</ControlRow>
              <ControlRow name="Acts Structure">Indigo dropdown. Selects the act structure overlay. Includes &ldquo;None&rdquo; option. Shows act count.</ControlRow>
              <ControlRow name="Load Template">Loads a preset arc for the selected structure/genre. Populates all beats with default dimension values.</ControlRow>
              <ControlRow name="Save as Structure">Saves your current beats as a named, reusable custom template stored in localStorage.</ControlRow>
              <ControlRow name="Clear All">Red button. Confirms before clearing all beats. Resets to empty state.</ControlRow>
              <ControlRow name="Export / Import">Download beats as JSON or upload a previously exported scaffold file.</ControlRow>
              <ControlRow name="Structure Reference">Expandable panel showing the current structure&rsquo;s acts, beats, and related frameworks.</ControlRow>
            </div>
          </Section>

          <Section title="Beat Editor">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Beat Row (collapsed)">Shows beat number, name, time%, mini color bars summarizing dimension values, and a live <strong>T:x.x</strong> tension score badge (red). Click anywhere to expand.</ControlRow>
              <ControlRow name="Beat Name">Click to rename inline. Press Enter to confirm, Escape to cancel.</ControlRow>
              <ControlRow name="Time % Input">Number field (0&ndash;100). Position in the story timeline. Beats auto-sort by this value.</ControlRow>
              <ControlRow name="Dimension Sliders">One slider (0&ndash;10) per visible dimension inside the expanded beat row. Drag to set values. A live tension bar and numeric score update in real time as you move sliders.</ControlRow>
              <ControlRow name={<>{'\u2261'} Drag Handle</>}>Grip handle on each beat. Drag to reorder. Time% recalculates to fit the new position.</ControlRow>
              <ControlRow name="+ Insertion Zone">Hover between two beats to reveal a &ldquo;+&rdquo; button. Click to insert a new beat at the midpoint with averaged dimension values.</ControlRow>
              <ControlRow name="+ Add Beat">Finds the largest gap in the timeline and inserts there, not at the end.</ControlRow>
              <ControlRow name="Delete Beat">Remove button on each beat row. No undo.</ControlRow>
              <ControlRow name="Beat Suggestions">Panel showing how each dimension compares to the genre ideal. Click &ldquo;Apply Suggestions&rdquo; to snap to ideal values.</ControlRow>
            </div>
          </Section>

          <Section title="Narrative Chart">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Chart Area">Interactive Recharts visualization. X-axis = story progress (0&ndash;100%), Y-axis = intensity (0&ndash;10). Updates live as you edit beats.</ControlRow>
              <ControlRow name="Dimension Lines">Colored lines for each visible dimension. Hover for exact values via tooltips.</ControlRow>
              <ControlRow name="Tension Line">Red line, derived from all weighted dimensions. Not directly editable.</ControlRow>
              <ControlRow name="Beat Markers">Vertical lines with labels showing where each beat falls in the story.</ControlRow>
              <ControlRow name="Act Zones">Colored vertical bands when an act structure is selected.</ControlRow>
              <ControlRow name="Dimension Toggles">Checkboxes below the chart to show/hide individual dimensions.</ControlRow>
            </div>
          </Section>

          <Section title="Validation & Output">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Genre Analysis">Shows pass/fail for genre requirements: intimacy threshold, trust threshold, tension threshold. Green checkmark or red X for each.</ControlRow>
              <ControlRow name="Scaffold Output">Generated beat sheet with tension drivers, emotional coordinates, and narrative writing guidance. Exportable as Markdown or standalone HTML.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── ANALYZE ── */}
      {sub === 'analyze' && (
        <>
          <Section title="Setup">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Genre Selector">Same dropdowns as Scaffold. Sets the ideal curve your book is compared against.</ControlRow>
              <ControlRow name="Provider Status Bar">Shows the active provider and model, or &ldquo;No API key configured&rdquo; with a hint to open Settings.</ControlRow>
            </div>
          </Section>

          <Section title="Chapter Input">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Paste Button">Click to paste chapter text from your clipboard into the input area.</ControlRow>
              <ControlRow name="Text Area">Large text input for pasting chapter content.</ControlRow>
              <ControlRow name="Bulk Split">Paste an entire book. The tool splits on &ldquo;Chapter X&rdquo; markers, Markdown headings, or triple-newlines.</ControlRow>
              <ControlRow name="Chapter Cards">Each parsed chapter shows title, POV tag, word count, and status badge (pending/analyzed/reviewed).</ControlRow>
              <ControlRow name="Delete Chapter">Remove individual chapters from the list.</ControlRow>
              <ControlRow name="Analyze Button">Main action button. Shows &ldquo;Analyze X Chapter(s)&rdquo;. Disabled without an API key or while analysis is running.</ControlRow>
            </div>
          </Section>

          <Section title="Score Review">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Chapter Cards">Expandable rows for each analyzed chapter. Click to view/edit dimension scores.</ControlRow>
              <ControlRow name="AI Scores (blue)">Scores assigned by the AI. Shown in blue text.</ControlRow>
              <ControlRow name="User Overrides (amber)">When you manually adjust a score, it turns amber. Your values take precedence in all calculations.</ControlRow>
              <ControlRow name="Reset to AI Scores">Button to undo all manual overrides for a chapter.</ControlRow>
              <ControlRow name="Beat Assignment">Dropdown on each chapter to assign it to a specific story beat from the selected structure.</ControlRow>
              <ControlRow name="Pacing Badge">For romance genres with 3+ beats: shows the detected pacing pattern (Slow Burn, Standard, Rapid).</ControlRow>
            </div>
          </Section>

          <Section title="Comparison & Diagnosis">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Comparison Overlay">Chart showing solid lines (your book&rsquo;s actual values) vs dashed lines (genre ideal). Toggle dimensions with checkboxes.</ControlRow>
              <ControlRow name="Gap Heat Strip">Color-coded bar below the chart showing average gap per beat: green (good), yellow, orange, red (needs work).</ControlRow>
              <ControlRow name="Health Score">0&ndash;100 score based on weighted gap analysis across all dimensions and beats.</ControlRow>
              <ControlRow name="Get-Well Plan">Priority actions, beat-by-beat diagnosis, and per-dimension trend analysis. Click &ldquo;Generate AI Plan&rdquo; for detailed editorial recommendations.</ControlRow>
              <ControlRow name="Revision Checklist">Auto-generated from gap analysis. Interactive checkboxes with progress bar. AI-enhanced items when an API key is available.</ControlRow>
              <ControlRow name="Projection Slider">0&ndash;100% slider blending actual toward ideal curves. Shows before/after chart with projected health score.</ControlRow>
              <ControlRow name="Export to Editor">Green button. Creates a .md file for each chapter in a new folder and navigates to the Edit workflow.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── EDIT ── */}
      {sub === 'edit' && (
        <>
          <Section title="File Panel (left sidebar)">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Open Folder">Triggers the browser&rsquo;s directory picker. Loads the selected folder into the file tree.</ControlRow>
              <ControlRow name="+f / +d Buttons">Top-level: create a new file or folder in the root. On folders: hover to reveal +f/+d for creating children.</ControlRow>
              <ControlRow name={<>{'\u27F3'} Refresh</>}>Reload the file tree from disk.</ControlRow>
              <ControlRow name="File Tree">Hierarchical view. Folders expand/collapse with arrows. Click any .md or .txt file to open it in a tab.</ControlRow>
              <ControlRow name="Context Dots">Green or gray circle on each file/folder. Green = included in AI context for inline editing. Click to toggle. Clicking a folder&rsquo;s dot toggles all children.</ControlRow>
              <ControlRow name="Rename">Double-click a file or folder name. Type the new name, press Enter to commit or Escape to cancel.</ControlRow>
              <ControlRow name="Right-click Menu">Context menu with Rename and Delete options. Also provides access to context-appropriate scripts.</ControlRow>
              <ControlRow name="Drag & Drop">Drag files between folders to move them.</ControlRow>
            </div>
          </Section>

          <Section title="Tab Bar">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="File Tabs">Click to switch between open files. Active tab has a distinct background.</ControlRow>
              <ControlRow name="Orange Dot">Appears on tabs with unsaved changes.</ControlRow>
              <ControlRow name={<>{'\u00D7'} Close Button</>}>Hover over a tab to reveal. Closes the tab.</ControlRow>
              <ControlRow name="Double-click Tab">Rename the tab (and file) inline.</ControlRow>
              <ControlRow name="R: Dropdown">In dual-pane mode, appears on the right side. Select which file to show in the secondary pane.</ControlRow>
            </div>
          </Section>

          <Section title="Formatting Toolbar">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="B / I / U / ~">Bold, Italic, Underline, Strikethrough. Standard text formatting.</ControlRow>
              <ControlRow name="H1 / H2 / H3">Apply heading levels to the current line or selection.</ControlRow>
              <ControlRow name={<>{'\u2022'} / 1.</>}>Unordered list (bullet) and ordered list (numbered).</ControlRow>
              <ControlRow name={<>{'\u275D'} Blockquote</>}>Wrap the selection or line in a blockquote.</ControlRow>
              <ControlRow name="&lt;/&gt; Code">Wrap selection in inline code.</ControlRow>
              <ControlRow name={<>{'\uD83D\uDD17'} Link</>}>Prompts for a URL and wraps the selection in a markdown link.</ControlRow>
              <ControlRow name="&mdash; HR">Insert a horizontal rule.</ControlRow>
              <ControlRow name="A (text color)">Opens a color picker with 16 preset colors + reset to default. Changes text color of the selection.</ControlRow>
              <ControlRow name="A (background)">Opens a color picker for background highlight color. Same 16 presets + reset.</ControlRow>
            </div>
          </Section>

          <Section title="Right-side Toolbar Controls">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<>{'\uD83D\uDD0D'} Search</>}>Toggle search &amp; replace bar. Purple highlight when active. Supports regex, case-sensitive toggle, match counter, prev/next/replace/replace-all.</ControlRow>
              <ControlRow name="Revise">Opens the Revision Modal for AI-powered chapter revision. Select files, choose revision source (checklist, gaps, or custom prompt), and run a pipeline.</ControlRow>
              <ControlRow name="Tools">Dropdown menu listing built-in scripts (Split into Chapters, Combine Chapters, Em-dash Cleanup, Regex Search &amp; Replace) and any custom scripts.</ControlRow>
              <ControlRow name="Theme Picker">Color swatch button showing current theme. Click to open a popover with light and dark theme options. Each swatch shows a mini preview.</ControlRow>
              <ControlRow name="Diff">Only visible in dual-pane mode. Toggles the side-by-side diff view comparing left and right panes. Purple highlight when active.</ControlRow>
              <ControlRow name="Sync">Only visible in dual-pane mode. Toggles synchronized scrolling between the two panes. Purple highlight when active.</ControlRow>
              <ControlRow name={<>{'\u2225'} Dual Pane</>}>Toggle between single pane and dual pane mode. Shows &ldquo;1&rdquo; (single) or &ldquo;2&rdquo; (dual). Purple highlight when dual.</ControlRow>
            </div>
          </Section>

          <Section title="Editor Pane">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Content Area">Rich-text contentEditable surface with markdown rendering. Type directly to write and edit.</ControlRow>
              <ControlRow name="Focus Indicator">Purple 2px top border on the currently focused pane (in dual-pane mode).</ControlRow>
              <ControlRow name="Placeholder Text">&ldquo;Start writing...&rdquo; (primary pane) or &ldquo;Click a file to open...&rdquo; (secondary pane) when empty.</ControlRow>
              <ControlRow name={<>{'\u2728'} Inline AI Button</>}>Floating sparkle button that appears when you select text. Click to open the inline AI editing popup.</ControlRow>
              <ControlRow name="Slash Commands">Type &ldquo;/&rdquo; at the start of an empty line to open a searchable menu of preset prompts. Arrow keys to navigate, Enter to select.</ControlRow>
              <ControlRow name="Code View">For .js, .jsx, .py, .json files: shows a syntax-highlighted textarea instead of rich text.</ControlRow>
              <ControlRow name="Pane Divider">In dual-pane mode: vertical bar between panes. Drag to adjust split ratio. Double-click to reset to 50/50.</ControlRow>
            </div>
          </Section>

          <Section title="Diff & Merge View">
            <p className="mb-2">Activated by clicking Diff in dual-pane mode. Replaces the two editor panes with a structured comparison view.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Aligned Paragraphs">Side-by-side grid with paragraphs aligned using a diff algorithm with fuzzy matching (40% word overlap threshold).</ControlRow>
              <ControlRow name="Green Highlights">Words added in the revised version.</ControlRow>
              <ControlRow name="Red Strikethrough">Words removed from the original version.</ControlRow>
              <ControlRow name="Spacer Rows">Blank row on one side when a paragraph exists only on the other, keeping the grid aligned.</ControlRow>
              <ControlRow name={<><span className="text-green-400">{'\u2190'}</span> Accept Arrow</>}>In the gutter between panes. Click to accept the revised text into the original document for that row.</ControlRow>
              <ControlRow name={<><span className="text-red-400">{'\u2192'}</span> Reject Arrow</>}>In the gutter. Click to push the original text into the revised document for that row.</ControlRow>
              <ControlRow name={<><span className="text-amber-400">{'\u21BA'}</span> Revert Icon</>}>Appears in the gutter after any merge or direct edit. Click to undo that specific change and restore the previous state. Multiple changes revert one at a time.</ControlRow>
              <ControlRow name="Accept All">Button in the stats bar. Accepts every revision at once.</ControlRow>
              <ControlRow name="Reject All">Button in the stats bar. Rejects every revision at once.</ControlRow>
              <ControlRow name="Inline Editing">Click into any paragraph cell to edit its text directly. Changes save on blur and the diff recomputes.</ControlRow>
              <ControlRow name="Stats Bar">Top bar showing: character additions (green), character removals (red), change count, and paragraph counts for both sides.</ControlRow>
            </div>
          </Section>

          <Section title="Revision Pipeline">
            <p className="mb-2">Launched from the Revise button in the toolbar.</p>
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="File Selection">Checkboxes for each .md/.txt file. &ldquo;Select All&rdquo; and &ldquo;Deselect All&rdquo; buttons.</ControlRow>
              <ControlRow name="Revision Source">Radio buttons: Checklist + Gaps, Revision Checklist only, Dimension Gaps only, or Custom Prompt. First three are disabled if no analysis data exists.</ControlRow>
              <ControlRow name="Custom Prompt">Textarea for free-form revision instructions (tone, style, POV changes, etc.).</ControlRow>
              <ControlRow name="Pause Between">Checkbox. When on, the pipeline pauses after each file so you can review before continuing.</ControlRow>
              <ControlRow name="Start Revision">Purple button showing file count. Disabled without file selection or API key.</ControlRow>
              <ControlRow name="Progress Bar">Purple status bar below the tab bar during revision. Shows &ldquo;Revising X/Y&rdquo;, current file name, and pipeline controls.</ControlRow>
              <ControlRow name="Pause / Continue">Toggle pause state during the pipeline run.</ControlRow>
              <ControlRow name="Cancel">Stop the pipeline. Completed files are preserved.</ControlRow>
              <ControlRow name="Dismiss">Close the progress bar after completion, cancellation, or error.</ControlRow>
            </div>
          </Section>

          <Section title="Inline AI Editing">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<>{'\u2728'} AI Button</>}>Appears near selected text. Click to open the editing popup.</ControlRow>
              <ControlRow name="Preset Dropdown">Start typing to filter preset prompts (Continue, Revise, Go, Line Edit, Chapter Revision, etc.). Click to select.</ControlRow>
              <ControlRow name="Custom Instruction">Textarea for free-form editing instructions. Supports template variables.</ControlRow>
              <ControlRow name="Apply">Execute the edit. AI response streams in real-time.</ControlRow>
              <ControlRow name="Accept / Reject / Retry">After AI responds: Accept replaces the selection, Reject keeps original, Retry re-runs with same or modified prompt.</ControlRow>
              <ControlRow name="Diff Toggle">In the response popup: toggle side-by-side comparison of original vs AI output.</ControlRow>
            </div>
          </Section>

          <Section title="Left Panel Tabs">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Chat Tab">AI chat panel for conversational editing, orchestration, and app state modification via tools.</ControlRow>
              <ControlRow name="Files Tab">File browser tree for the open folder. Same as the File Panel described above.</ControlRow>
              <ControlRow name="Variables Tab">Read-only view of analyzed chapter dimension scores and scaffold beat values. Useful as a reference while writing.</ControlRow>
              <ControlRow name="Sequences Tab">Named sequence manager. Build, edit, and run reusable multi-step prompt pipelines. A pulsing purple dot appears on the tab when a sequence is actively running.</ControlRow>
            </div>
          </Section>

          <Section title="Status Bar">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="File Name">Active file name on the left.</ControlRow>
              <ControlRow name="&ldquo;unsaved&rdquo;">Orange text when the file has uncommitted changes.</ControlRow>
              <ControlRow name="Word Count">Live word count for the primary pane. Shows secondary pane count in dual mode.</ControlRow>
              <ControlRow name="Save Button">Blue when dirty, gray &ldquo;Saved&rdquo; when clean. Also triggered by <Kbd>{'\u2318'}S</Kbd>.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── PROJECTS ── */}
      {sub === 'projects' && (
        <>
          <Section title="Projects Dialog">
            <p className="mb-3">
              Opened from the nav bar&rsquo;s Projects button. Manages two types of projects: Book Projects and AI Projects.
            </p>
          </Section>

          <Section title="Book Projects">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Project List">Shows all book projects. Click a card to select it (pending activation).</ControlRow>
              <ControlRow name="Project Card">Displays project name, genre, and other metadata. Highlighted border when selected.</ControlRow>
              <ControlRow name="Create New">Button to create a new book project with metadata fields.</ControlRow>
              <ControlRow name="Delete">Per-project delete button. Confirms before deleting.</ControlRow>
            </div>
          </Section>

          <Section title="AI Projects">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Project List">Shows all AI projects. Click to select.</ControlRow>
              <ControlRow name="Create New">Create a new AI project with a custom system prompt and file catalog.</ControlRow>
              <ControlRow name="Edit">Edit an existing AI project&rsquo;s system prompt and files.</ControlRow>
              <ControlRow name="Delete">Per-project delete.</ControlRow>
            </div>
          </Section>

          <Section title="Dialog Footer">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name="Cancel">Close the dialog without changing the active project.</ControlRow>
              <ControlRow name="OK">Activate the selected project. Changes the chat context mode to the project&rsquo;s mode.</ControlRow>
            </div>
          </Section>
        </>
      )}

      {/* ── KEYBOARD SHORTCUTS ── */}
      {sub === 'keys' && (
        <>
          <Section title="Global Shortcuts">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<Kbd>Escape</Kbd>}>Close the currently open modal, dialog, popover, or dropdown.</ControlRow>
            </div>
          </Section>

          <Section title="Editor Shortcuts">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<Kbd>{'\u2318'}S</Kbd>}>Save the active file to disk.</ControlRow>
              <ControlRow name={<><Kbd>{'\u2318'}H</Kbd> / <Kbd>{'\u2318'}F</Kbd></>}>Toggle the search &amp; replace bar.</ControlRow>
              <ControlRow name={<Kbd>{'\u2318'}K</Kbd>}>Open the inline AI editing popup on the current selection.</ControlRow>
              <ControlRow name={<Kbd>{'\u2318'}B</Kbd>}>Bold the selected text.</ControlRow>
              <ControlRow name={<Kbd>{'\u2318'}I</Kbd>}>Italicize the selected text.</ControlRow>
              <ControlRow name={<Kbd>{'\u2318'}U</Kbd>}>Underline the selected text.</ControlRow>
            </div>
          </Section>

          <Section title="Chat Shortcuts">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<Kbd>Enter</Kbd>}>Send the current message.</ControlRow>
              <ControlRow name={<Kbd>Shift+Enter</Kbd>}>Insert a new line without sending.</ControlRow>
              <ControlRow name={<Kbd>/</Kbd>}>Type at the start of the chat input (no space after) to open the sequence picker. Shows all saved named sequences filtered by what you type.</ControlRow>
              <ControlRow name={<><Kbd>{'\u2191'}</Kbd> / <Kbd>{'\u2193'}</Kbd></>}>Navigate the sequence picker list.</ControlRow>
              <ControlRow name={<Kbd>Enter</Kbd>}>Run the highlighted sequence (when picker is open).</ControlRow>
              <ControlRow name={<Kbd>Escape</Kbd>}>Close the sequence picker without running.</ControlRow>
            </div>
          </Section>

          <Section title="Search & Replace Shortcuts">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<Kbd>Enter</Kbd>}>Jump to the next match.</ControlRow>
              <ControlRow name={<Kbd>Shift+Enter</Kbd>}>Jump to the previous match.</ControlRow>
              <ControlRow name={<Kbd>Escape</Kbd>}>Close the search bar.</ControlRow>
            </div>
          </Section>

          <Section title="Slash Commands">
            <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
              <ControlRow name={<Kbd>/</Kbd>}>Type at the start of an empty line to open the preset prompt menu.</ControlRow>
              <ControlRow name={<><Kbd>{'\u2191'}</Kbd> / <Kbd>{'\u2193'}</Kbd></>}>Navigate the menu.</ControlRow>
              <ControlRow name={<Kbd>Enter</Kbd>}>Select the highlighted preset.</ControlRow>
              <ControlRow name={<Kbd>Escape</Kbd>}>Close the menu without selecting.</ControlRow>
            </div>
          </Section>
        </>
      )}
      </div>
    </div>
  );
}

function ScaffoldingTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="Getting Started">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong>Select your genre</strong> &mdash; Choose Genre, Subgenre, and optionally a Modifier
            from the dropdowns at the top. This sets the plot structure, default dimension weights,
            and genre requirements.
          </li>
          <li>
            <strong>Load a template or start fresh</strong> &mdash; Click <em>"Load Template"</em> to
            pick from the genre's canonical arc or any custom structures you've saved.
            Or click <em>"+ Add Beat"</em> to build from scratch.
          </li>
          <li>
            <strong>Edit beats</strong> &mdash; Click a beat's name to rename it inline, or click
            the row to expand it. Set time percentage (0&ndash;100%), beat type, and all 11
            dimension values using sliders. The <strong>Beat Suggestions</strong> panel shows
            where your values diverge from the genre ideal.
          </li>
          <li>
            <strong>Watch the chart</strong> &mdash; The chart on the right updates live as you edit.
            Toggle which dimensions are visible using the checkboxes below the chart.
          </li>
          <li>
            <strong>Check validation</strong> &mdash; The Genre Analysis panel at the bottom shows
            whether your final beat meets genre requirements for intimacy, trust, and tension.
          </li>
        </ol>
      </Section>

      <Section title="Beat Editor Features">
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Inline label editing:</strong> Click on any beat's name to rename it directly in the collapsed row &mdash; no need to expand first.</li>
          <li><strong>Drag to reorder:</strong> Grab the grip handle ({'\u2261'}) on any beat and drag it to a new position. Its time% adjusts automatically to fit between its new neighbors.</li>
          <li><strong>Insert between beats:</strong> Hover between any two beats to reveal a "+" insertion zone. Click to add a new beat at the midpoint time%, with dimension values averaged from its neighbors.</li>
          <li><strong>Smart Add Beat:</strong> The "+ Add Beat" button finds the largest gap in your timeline and inserts there, rather than appending at the end.</li>
          <li><strong>Custom structures:</strong> Click "Save as Structure" to save your current beats as a named, reusable template. Load them later from the "Load Template" dropdown.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li>Beats auto-sort by time percentage. Change a beat's time to reposition it in the arc.</li>
          <li>The mini color bars on collapsed beats give you a quick visual summary of that beat's dimensions.</li>
          <li>Use <em>Export Scaffold</em> to save your work as JSON, and <em>Import Scaffold</em> to restore it later.</li>
          <li>Adjusting weights in the Dimension Toggles section changes how tension is calculated but doesn't change the raw dimension values.</li>
          <li>Modifiers apply multipliers to weights &mdash; look for the yellow arrow showing the effective weight after modifier adjustment.</li>
          <li><strong>Genre blending:</strong> Enable "Blend Mode" to merge two genres. The blend ratio controls how much of each genre's weights, arcs, and requirements are used.</li>
        </ul>
      </Section>

      <Section title="Understanding the Chart">
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li>X-axis: Story progress (0&ndash;100%)</li>
          <li>Y-axis: Intensity (0&ndash;10 for most dimensions, -5 to +5 for Power Differential)</li>
          <li>Each colored line represents one narrative dimension</li>
          <li>The red <strong>TENSION</strong> line is derived from all weighted dimensions &mdash; it's not editable directly</li>
          <li>The beat legend shows which structural beat corresponds to which percentage range</li>
        </ul>
      </Section>
    </div>
  );
}

function AnalysisTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="Step 1: Set Up">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong>Select your genre</strong> &mdash; Same as scaffolding. This determines the ideal
            curve your book will be compared against.
          </li>
          <li>
            <strong>Configure an API key</strong> &mdash; Required for AI-assisted scoring. Open
            <strong> Settings</strong> (gear icon in the nav bar) to add a key for OpenRouter, OpenAI,
            Anthropic, or Perplexity. Keys stay in your browser and are only sent to the selected provider.
          </li>
        </ol>
      </Section>

      <Section title="Step 2: Add Chapters">
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Single mode:</strong> Paste one chapter at a time with an optional title, click "Add Chapter".</li>
          <li><strong>Bulk Split mode:</strong> Paste an entire book. The tool splits on "Chapter X" markers, Markdown headings (<code className="text-purple-200 bg-slate-700/50 px-1 rounded">## Chapter X</code>), or triple-newlines.</li>
          <li>Each chapter appears in the list with word count and status (pending / analyzed / reviewed).</li>
        </ul>
      </Section>

      <Section title="Step 3: Analyze with AI">
        <p>
          Click the "Analyze" button to send pending chapters to your selected model. The AI reads each chapter and
          scores all 11 dimensions, assigns a time percentage and best-matching beat, and provides
          reasoning for its scores.
        </p>
        <p className="mt-2">
          Chapters are sent in batches of 5 to stay within context limits. Analysis may take
          30&ndash;60 seconds per batch.
        </p>
      </Section>

      <Section title="Step 4: Review & Adjust Scores">
        <p>
          The Score Review table shows AI-generated scores for each chapter. Click any row to expand
          and edit individual dimension values. <span className="text-blue-300">Blue values</span> are
          AI-generated; <span className="text-amber-300">amber values</span> have been manually adjusted.
        </p>
        <p className="mt-2">
          Click "Reset to AI Scores" on any chapter to undo your manual edits.
        </p>
      </Section>

      <Section title="Step 5: Compare Against Genre Ideal">
        <p>
          Once chapters are scored, the <strong>Comparison Overlay</strong> chart appears:
        </p>
        <ul className="list-disc list-inside space-y-1 text-purple-200 mt-2">
          <li><strong>Solid lines</strong> = your book's actual dimensional values</li>
          <li><strong>Dashed lines</strong> (40% opacity) = the genre's ideal template curve</li>
          <li>The <strong>Gap Heat Strip</strong> below the chart shows average gap per beat, color-coded green/yellow/orange/red</li>
        </ul>
      </Section>

      <Section title="Step 6: Get-Well Plan">
        <p>The Get-Well Plan provides:</p>
        <ul className="list-disc list-inside space-y-1 text-purple-200 mt-2">
          <li><strong>Overall Health Score</strong> (0&ndash;100) based on weighted gap analysis</li>
          <li><strong>Priority Actions</strong> &mdash; the most impactful changes ranked by severity</li>
          <li><strong>Beat-by-Beat Diagnosis</strong> &mdash; expand each beat to see specific dimensional gaps and suggestions</li>
          <li><strong>Dimension Summary</strong> &mdash; per-dimension trends across the whole book</li>
        </ul>
        <p className="mt-2">
          <strong>AI-Enhanced Plan:</strong> If you have an API key, click "Generate AI Plan" to get
          specific narrative recommendations from the AI (not just numerical gap data). It provides
          an executive summary, beat-specific editorial advice, and ranked priorities.
        </p>
        <p className="mt-2">
          Click <strong>Export Markdown</strong> to download the plan as a .md file you can share or
          reference while editing.
        </p>
      </Section>
    </div>
  );
}

function DimensionsTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="The 11 Narrative Dimensions">
        <p className="mb-4">
          Each dimension captures a different axis of the reader's experience. Together they form a
          multi-dimensional "context field" that the tension engine reads from.
        </p>
        <div className="space-y-3">
          {DIMENSION_KEYS.map((key) => {
            const dim = dimensions[key];
            return (
              <div key={key} className="bg-slate-800/50 rounded p-3 border-l-4" style={{ borderLeftColor: dim.color }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: dim.color }} className="font-bold">{dim.name}</span>
                  <span className="text-xs text-purple-400">Range: {dim.range[0]} to {dim.range[1]}</span>
                </div>
                <p className="text-xs text-purple-200">
                  {dimensionDescriptions[key]}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Weight Channels">
        <p className="mb-3">
          The tension engine uses <strong>9 weight channels</strong>, not the 11 raw dimensions directly.
          Some channels compute derived "gap" values from pairs of dimensions:
        </p>
        <div className="bg-slate-800/50 rounded p-4 text-xs space-y-2">
          {weightChannelDescriptions.map(({ key, formula, explanation }) => (
            <div key={key} className="flex gap-3">
              <span className="text-purple-300 font-semibold w-36 flex-shrink-0">{key}</span>
              <span className="text-purple-400 font-mono w-48 flex-shrink-0">{formula}</span>
              <span className="text-purple-200">{explanation}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function EditGuideTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="Getting Started">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong>Open a folder</strong> &mdash; Click <em>"Open Folder"</em> to grant the app access
            to a directory on your computer via the File System Access API. This loads your files
            into the file panel on the left.
          </li>
          <li>
            <strong>Click any .md or .txt file</strong> to open it in a tab. Multiple files can
            be open simultaneously &mdash; click tabs to switch between them.
          </li>
          <li>
            <strong>Start writing or editing</strong> using the rich-text toolbar, inline AI, or the
            chat panel for longer conversations about your work.
          </li>
        </ol>
      </Section>

      <Section title="File Panel">
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Tree view:</strong> Folders expand/collapse. Files are sorted alphabetically.</li>
          <li><strong>Open files:</strong> Click any text file (.md, .txt) to open it in a tab.</li>
          <li><strong>Rename:</strong> Double-click a file or folder name to rename it inline.</li>
          <li><strong>Create new:</strong> Hover over a folder to reveal <em>+f</em> (new file) and <em>+d</em> (new folder) buttons.</li>
          <li><strong>Right-click menu:</strong> Right-click any file or folder to access scripts (Split into Chapters, Combine Chapters, Em-dash Cleanup, Regex Search &amp; Replace).</li>
          <li><strong>Context dots:</strong> Each file has a green/gray circle on the right. Green means the file is included in AI context for inline editing prompts. Click to toggle. Clicking a folder's dot toggles all its children.</li>
        </ul>
      </Section>

      <Section title="Markdown Editor">
        <div className="space-y-3">
          <div>
            <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Formatting Toolbar</h5>
            <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
              <li><strong>Text styles:</strong> Bold, Italic, Underline, Strikethrough</li>
              <li><strong>Headers:</strong> H1 through H4</li>
              <li><strong>Colors:</strong> Text color (A) and background highlight (A) with color picker grid and reset-to-default option</li>
              <li><strong>Lists:</strong> Ordered and unordered lists</li>
              <li><strong>Block elements:</strong> Blockquote, horizontal rule</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Editor Features</h5>
            <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
              <li><strong>Themes:</strong> Choose from multiple editor themes (adjusts background, text color, and toolbar styling)</li>
              <li><strong>Search &amp; Replace:</strong> Click the search icon or use Ctrl+H to open the search bar with regex support</li>
              <li><strong>Dual pane:</strong> Split the editor to view two files side-by-side</li>
              <li><strong>Word count:</strong> Live word count shown in the status bar</li>
              <li><strong>Auto-save:</strong> Changes are saved to the file system automatically</li>
              <li><strong>Export:</strong> Download the current file as Markdown (.md)</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Inline AI Editing">
        <p className="mb-2">
          Select text in the editor and an <strong>AI button</strong> appears near your selection.
          Click it to open the editing popup.
        </p>
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Free-form prompt:</strong> Type any instruction ("make this more vivid", "rewrite in first person", etc.)</li>
          <li><strong>Preset prompts:</strong> Start typing to see matching presets (Continue, Revise, Go, Chapter Revision, Line Edit, etc.). These are full prompt templates with context variables built in.</li>
          <li><strong>Response actions:</strong> After AI responds, you can <em>Accept</em> (replace selection), <em>Reject</em> (keep original), or <em>Retry</em> (try again with same or modified prompt).</li>
          <li><strong>Diff view:</strong> Toggle to see a side-by-side comparison of original vs. AI response with color-coded additions and removals.</li>
          <li><strong>Prompt history:</strong> Previous prompts appear in the dropdown for quick reuse.</li>
        </ul>
      </Section>

      <Section title="AI Context System">
        <p className="mb-2">
          The inline AI editor and the chat panel receive different context:
        </p>
        <div className="bg-slate-800/50 rounded p-4 text-xs space-y-3">
          <div>
            <h5 className="font-semibold text-purple-300 mb-1">Inline AI (preset prompts)</h5>
            <ul className="list-disc list-inside text-purple-200 space-y-0.5">
              <li><code className="text-purple-200 bg-slate-700/50 px-1 rounded">{'{{selected_text}}'}</code> &mdash; the highlighted text in the editor</li>
              <li><code className="text-purple-200 bg-slate-700/50 px-1 rounded">{'{{before}}'}</code> &mdash; text before the cursor/selection (up to ~8,000 chars)</li>
              <li><code className="text-purple-200 bg-slate-700/50 px-1 rounded">{'{{after}}'}</code> &mdash; text after the cursor/selection (up to ~8,000 chars)</li>
              <li><code className="text-purple-200 bg-slate-700/50 px-1 rounded">{'{{selected_documents}}'}</code> &mdash; full content of all green-dot files from the file panel</li>
              <li><code className="text-purple-200 bg-slate-700/50 px-1 rounded">{'{{user_input}}'}</code> &mdash; any text you type after a preset name</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-purple-300 mb-1">Chat Panel</h5>
            <ul className="list-disc list-inside text-purple-200 space-y-0.5">
              <li>Full content of the active editor pane(s)</li>
              <li>Open tab names, directory name</li>
              <li>Story metadata (genre, structure, beats, chapters, scores)</li>
              <li>Native tools for modifying app state (when enabled)</li>
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs text-purple-300">
          <strong>Tip:</strong> Use green dots for inline presets that need multi-file context (e.g., a continuity check
          across chapters). Use the chat panel for conversational editing or when you need the AI to modify
          beats and genre settings.
        </p>
      </Section>

      <Section title="AI Chapter Revision">
        <p className="mb-2">
          Revise entire chapters or batches of files using AI. Click <strong>Revise</strong> in the toolbar
          to open the revision modal.
        </p>
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Single or multi-file:</strong> Select specific files or revise all files in the open folder.</li>
          <li><strong>Custom prompt:</strong> Write revision instructions (tone, style, POV changes, etc.).</li>
          <li><strong>Streaming output:</strong> Revised text streams into a new tab (filename-rev01) in real time.</li>
          <li><strong>Pipeline controls:</strong> Pause between files to review, or auto-advance through the batch. Cancel at any time.</li>
          <li><strong>Progress bar:</strong> Purple status bar shows current file, progress count, and pause/cancel controls.</li>
        </ul>
      </Section>

      <Section title="Diff & Merge View">
        <p className="mb-2">
          Compare original and revised documents side-by-side with word-level change highlighting.
          Enable dual-pane mode, select the revision in the right pane, then click <strong>Diff</strong> in the toolbar.
        </p>
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Smart alignment:</strong> Uses a diff algorithm with fuzzy paragraph matching to find anchors between the two versions, so similar paragraphs line up even when text has been added or removed.</li>
          <li><strong>Word-level highlighting:</strong> Within each aligned pair, additions are highlighted in green and removals in red with strikethrough.</li>
          <li><strong>Merge arrows:</strong> Each changed row has gutter arrows &mdash; click <span className="text-green-400">{'\u2190'}</span> to accept the revision into the original, or <span className="text-red-400">{'\u2192'}</span> to push the original into the revision.</li>
          <li><strong>Revert icon:</strong> After any merge or direct edit, an amber <span className="text-amber-400">{'\u21BA'}</span> revert icon appears in the gutter. Click to undo that change and restore the previous state. Chained edits revert one step at a time.</li>
          <li><strong>Bulk actions:</strong> "Accept All" and "Reject All" buttons in the stats bar for wholesale changes.</li>
          <li><strong>Inline editing:</strong> Click into any paragraph on either side to edit directly. Changes save on blur and the diff recomputes.</li>
          <li><strong>Stats bar:</strong> Shows character counts for additions/removals, number of changes, and paragraph counts for both sides.</li>
          <li><strong>Spacer rows:</strong> Paragraphs that exist only on one side show a blank spacer on the other, keeping the grid aligned.</li>
        </ul>
      </Section>

      <Section title="Tools & Scripts">
        <p className="mb-2">
          Click <strong>Tools</strong> in the toolbar to run built-in scripts, or right-click files/folders
          in the file panel for context-appropriate options.
        </p>
        <div className="space-y-3">
          <div>
            <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Built-in Scripts</h5>
            <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
              <li><strong>Split into Chapters:</strong> Splits a file on chapter headings into numbered files in a new folder</li>
              <li><strong>Combine Chapters:</strong> Merges all .md/.txt files in a folder into a single file</li>
              <li><strong>Em-dash Cleanup:</strong> Replaces non-interruption em-dashes with commas (leaves dialogue interruptions intact)</li>
              <li><strong>Regex Search &amp; Replace:</strong> Three-step flow &mdash; describe what to find in plain English (AI suggests a regex), review/edit the pattern, then provide a replacement (or leave empty for find-only mode with match previews)</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Script Output Panel</h5>
            <p className="text-xs text-purple-200">
              When a script runs, a panel appears at the bottom of the editor showing progress and logs.
              Each log entry is timestamped and color-coded by level (info, warning, error).
            </p>
          </div>
        </div>
      </Section>

      <Section title="Chat Panel (Edit Mode)">
        <p className="mb-2">
          The AI chat panel works alongside the editor with several specialized modes:
        </p>
        <ul className="list-disc list-inside space-y-1 text-purple-200">
          <li><strong>Full Context:</strong> Default mode &mdash; the AI sees all story metadata, editor content, and has access to tools.</li>
          <li><strong>Prompt modes:</strong> Switch to Line Editor, Writing Partner, Critic, or Version Comparator modes via the Chat tab in Settings for focused editing assistance.</li>
          <li><strong>Stop generation:</strong> While the AI is responding, the send button becomes a red stop square. Click it to cancel the response mid-stream.</li>
          <li><strong>System prompt viewer:</strong> Click "Prompt" in the chat header to inspect exactly what context the AI receives in the current mode.</li>
          <li><strong>Provider &amp; model:</strong> The active provider and model are shown in the chat header. Click the badge or open Settings to change them.</li>
        </ul>
      </Section>

      <Section title="Named Sequences">
        <p>
          Named Sequences are reusable multi-step prompt pipelines with support for loops, conditionals, chaining, and file output.
          See the dedicated <strong>Sequences</strong> tab for comprehensive documentation including step types, loop iteration,
          conditional branching, template variables, ASCII diagrams, and worked examples.
        </p>
      </Section>
    </div>
  );
}

function DiagramBox({ children }) {
  return (
    <pre className="bg-slate-900/80 border border-purple-500/30 rounded-lg p-4 text-[11px] leading-relaxed text-purple-200 font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function MainPagesTab() {
  const [subTab, setSubTab] = useState('scaffolding');
  const subTabs = [
    { id: 'scaffolding', label: 'Scaffold' },
    { id: 'analysis', label: 'Analyze' },
    { id: 'editing', label: 'Edit' },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
              subTab === t.id
                ? 'bg-purple-500 text-white'
                : 'bg-slate-700/50 text-purple-300 hover:bg-slate-600 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'scaffolding' && <ScaffoldingTab />}
      {subTab === 'analysis' && <AnalysisTab />}
      {subTab === 'editing' && <EditGuideTab />}
    </div>
  );
}

function SequencesTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="What Are Named Sequences?">
        <p>
          Named Sequences are reusable multi-step AI prompt pipelines you design once and run any time.
          They automate repetitive writing workflows &mdash; generating outlines, writing chapters in series,
          running quality checks, and producing final drafts &mdash; all without manual intervention between steps.
        </p>
        <p className="mt-2">
          Each sequence is a list of <strong>steps</strong>. Steps come in three types:
          <strong> Action</strong> (run a prompt), <strong>Loop</strong> (repeat steps), and
          <strong> Condition</strong> (branch on AI evaluation). Steps can chain their output forward,
          write results to files, and use template variables for dynamic content.
        </p>
      </Section>

      <Section title="Quick Start: Your First Sequence">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Navigate to the <strong>Edit</strong> workflow and open the <strong>Sequences</strong> tab in the left panel.
          </li>
          <li>
            Click <strong>+ New Sequence</strong>. Give it a name (e.g., &ldquo;Chapter Outline&rdquo;).
          </li>
          <li>
            Click <strong>+ Add Step</strong>. Leave the type as <strong>Action</strong>.
          </li>
          <li>
            Choose <strong>Inline Template</strong> and type your prompt, e.g.:<br />
            <code className="text-purple-200 bg-slate-700/50 px-1 rounded text-xs">Write a detailed chapter outline for a fantasy novel with 12 chapters.</code>
          </li>
          <li>
            Set <strong>Output File</strong> to <code className="text-purple-200 bg-slate-700/50 px-1 rounded text-xs">outline.md</code> to save the result to disk.
          </li>
          <li>
            Click <strong>Save</strong>, then click the <strong>{'\u25B6'}</strong> play button to run it.
          </li>
        </ol>
      </Section>

      <Section title="The Three Step Types">
        <div className="space-y-4">
          {/* Action */}
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h4 className="font-bold text-white mb-2">Action Steps</h4>
            <p className="text-xs text-purple-200 mb-3">
              The workhorse of sequences. An action step sends a prompt to the AI and optionally writes the response to a file.
            </p>
            <div className="space-y-0.5">
              <ControlRow name="Prompt Source">Choose <strong>Inline Template</strong> (write the prompt directly) or <strong>Prompt Tool</strong> (select a saved prompt from the Prompts panel).</ControlRow>
              <ControlRow name="Output File">Optional. A file path relative to the open folder (e.g., <code className="text-purple-200 bg-slate-700/50 px-1 rounded text-xs">chapters/ch01.md</code>). If set, the AI response is written to this file.</ControlRow>
              <ControlRow name="Chain">Toggle. When enabled, this step&rsquo;s output is passed as context into the next step under a &ldquo;Context from previous step&rdquo; heading.</ControlRow>
              <ControlRow name="Model Override">Optional. Run this specific step with a different model than your default (e.g., a cheaper model for simple tasks).</ControlRow>
            </div>
          </div>

          {/* Loop */}
          <div className="bg-slate-800/50 rounded p-4 border border-blue-500/20">
            <h4 className="font-bold text-blue-300 mb-2">Loop Steps</h4>
            <p className="text-xs text-purple-200 mb-3">
              Repeat a set of body steps multiple times. Use loops to write series of chapters, generate variations,
              or iterate until a quality threshold is met.
            </p>
            <div className="space-y-0.5">
              <ControlRow name="Fixed Count">Set a number (e.g., 5) and the body runs exactly that many times.</ControlRow>
              <ControlRow name="Exit Condition">Instead of a fixed count, provide a template that the AI evaluates after each iteration. If the AI responds &ldquo;STOP&rdquo;, the loop ends. If &ldquo;CONTINUE&rdquo;, it keeps going.</ControlRow>
              <ControlRow name="Max Iterations">Safety cap for exit-condition loops (default: 20). Prevents runaway loops.</ControlRow>
              <ControlRow name="Body Steps">The steps that run on each iteration. Can include Action and Condition steps (no nested loops).</ControlRow>
              <ControlRow name="Chain">When enabled on the loop, the final iteration&rsquo;s output is passed as context to the next top-level step.</ControlRow>
            </div>
            <div className="mt-3">
              <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-2">Loop Variables</h5>
              <div className="space-y-1 text-xs">
                <div className="flex gap-3">
                  <code className="text-blue-300 bg-slate-700/50 px-1 rounded w-40 flex-shrink-0">{'##'}</code>
                  <span className="text-purple-200">In output file names, replaced with the zero-padded iteration number (01, 02, 03&hellip;). E.g., <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Chapter_##.md</code> {'\u2192'} <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Chapter_01.md</code>, <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Chapter_02.md</code>, etc.</span>
                </div>
                <div className="flex gap-3">
                  <code className="text-blue-300 bg-slate-700/50 px-1 rounded w-40 flex-shrink-0">{'{{loop_index}}'}</code>
                  <span className="text-purple-200">Zero-based iteration number (0, 1, 2&hellip;) available in templates.</span>
                </div>
                <div className="flex gap-3">
                  <code className="text-blue-300 bg-slate-700/50 px-1 rounded w-40 flex-shrink-0">{'{{loop_count}}'}</code>
                  <span className="text-purple-200">Total iteration count (for fixed-count loops). Null for exit-condition loops.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Condition */}
          <div className="bg-slate-800/50 rounded p-4 border border-amber-500/20">
            <h4 className="font-bold text-amber-300 mb-2">Condition Steps</h4>
            <p className="text-xs text-purple-200 mb-3">
              Ask the AI a YES/NO question based on the current context. The answer determines what happens next:
              continue the sequence, end it early, or retry the previous step.
            </p>
            <div className="space-y-0.5">
              <ControlRow name="Question Template">The prompt sent to the AI. It should be phrased as a yes/no question. Use <code className="text-purple-200 bg-slate-700/50 px-1 rounded text-xs">{'{{chained_context}}'}</code> to reference the output from the previous step.</ControlRow>
              <ControlRow name="If YES">What to do when the AI answers YES: <strong>Continue</strong> to the next step, or <strong>End</strong> the sequence.</ControlRow>
              <ControlRow name="If NO">What to do when the AI answers NO: <strong>Continue</strong>, <strong>End</strong>, or <strong>Retry</strong> the previous step.</ControlRow>
              <ControlRow name="Max Retries">When &ldquo;If NO&rdquo; is set to Retry, this caps how many times the previous step can be re-run (default: 3). After max retries, the sequence continues.</ControlRow>
            </div>
          </div>
        </div>
      </Section>

      <Section title="How Steps Flow Together">
        <p className="mb-3 text-xs text-purple-300">
          Steps execute top-to-bottom. Chain passes context forward. Conditions can redirect flow.
        </p>
        <MermaidDiagram id="seq-flow" chart={`
flowchart TD
    S1["Step 1 · Action
    Write outline for 5 chapters
    saves to outline.md"]
    S1 -->|"chained context"| S2
    S2["Step 2 · Loop × 5
    Write chapter for each iteration
    saves to chapters/Chapter_##.md"]
    S2 -->|"chained context"| S3
    S3{"Step 3 · Condition
    Is this chapter complete
    and well-paced?"}
    S3 -->|"YES → continue"| S4
    S3 -->|"NO → retry, max 2×"| S2
    S4["Step 4 · Action
    Write synopsis of all chapters
    saves to synopsis.md"]
    S4 --> Done([Sequence complete])

    style S1 fill:#1e1b4b,stroke:#7C3AED,color:#e9d5ff
    style S2 fill:#1e293b,stroke:#3b82f6,color:#bfdbfe
    style S3 fill:#1c1917,stroke:#d97706,color:#fef3c7
    style S4 fill:#1e1b4b,stroke:#7C3AED,color:#e9d5ff
    style Done fill:#14532d,stroke:#16a34a,color:#bbf7d0
        `} />
      </Section>

      <Section title="Template Variables Reference">
        <p className="mb-3 text-xs text-purple-300">
          These placeholders can be used in any inline template or prompt tool template.
        </p>
        <div className="bg-slate-800/50 rounded p-4 space-y-1 text-xs">
          <div className="flex gap-3 py-1.5 border-b border-purple-500/10">
            <code className="text-purple-300 bg-slate-700/50 px-1 rounded w-48 flex-shrink-0 font-semibold">{'{{chained_context}}'}</code>
            <span className="text-purple-200">Output from the previous step (when chain is enabled). This is the primary way to pass information between steps.</span>
          </div>
          <div className="flex gap-3 py-1.5 border-b border-purple-500/10">
            <code className="text-purple-300 bg-slate-700/50 px-1 rounded w-48 flex-shrink-0 font-semibold">{'{{loop_index}}'}</code>
            <span className="text-purple-200">Current iteration number (0-based) inside a loop body. Use for &ldquo;Write chapter {'{{loop_index}}'}&rdquo;.</span>
          </div>
          <div className="flex gap-3 py-1.5 border-b border-purple-500/10">
            <code className="text-purple-300 bg-slate-700/50 px-1 rounded w-48 flex-shrink-0 font-semibold">{'{{loop_count}}'}</code>
            <span className="text-purple-200">Total number of iterations (fixed-count loops only). Null for exit-condition loops.</span>
          </div>
          <div className="flex gap-3 py-1.5 border-b border-purple-500/10">
            <code className="text-purple-300 bg-slate-700/50 px-1 rounded w-48 flex-shrink-0 font-semibold">{'{{user_input}}'}</code>
            <span className="text-purple-200">If the sequence was launched with user input (e.g., from the chat / picker), the typed value is available here.</span>
          </div>
          <div className="flex gap-3 py-1.5">
            <code className="text-purple-300 bg-slate-700/50 px-1 rounded w-48 flex-shrink-0 font-semibold">{'##'}</code>
            <span className="text-purple-200">In <strong>output file names only</strong>: replaced with zero-padded iteration index (01, 02, ...). Not a template variable &mdash; only works in the Output File field inside a loop body.</span>
          </div>
        </div>
      </Section>

      <Section title="Loop Deep-Dive">
        <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-2">Fixed-Count Loop</h5>
        <p className="text-xs text-purple-200 mb-3">
          Set a specific number and the body runs that many times. Ideal when you know exactly how many outputs you need.
        </p>
        <DiagramBox>{`
  Loop: "Write 5 Chapters" (count: 5)
  ┌──────────────────────────────────────────────┐
  │  iter 0 → Chapter_01.md   (## = 01)         │
  │  iter 1 → Chapter_02.md   (## = 02)         │
  │  iter 2 → Chapter_03.md   (## = 03)         │
  │  iter 3 → Chapter_04.md   (## = 04)         │
  │  iter 4 → Chapter_05.md   (## = 05)         │
  └──────────────────────────────────────────────┘
  {{loop_index}} = 0,1,2,3,4    {{loop_count}} = 5
        `}</DiagramBox>

        <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-2 mt-4">Exit-Condition Loop</h5>
        <p className="text-xs text-purple-200 mb-3">
          Instead of a fixed count, you provide an exit template &mdash; a prompt the AI evaluates after each iteration.
          If the AI responds with &ldquo;STOP&rdquo;, the loop ends. If &ldquo;CONTINUE&rdquo;, it keeps going. A max-iterations
          cap (default: 20) prevents runaway loops.
        </p>
        <MermaidDiagram id="seq-exit-loop" chart={`
flowchart TD
    A([Loop starts]) --> B
    B["Run body steps"] --> C{"Exit condition:
    Is this done?
    Answer CONTINUE or STOP"}
    C -->|CONTINUE| B
    C -->|STOP| D([Loop ends — next step])
    C -->|"max iterations reached"| D

    style A fill:#312e81,stroke:#7C3AED,color:#e9d5ff
    style B fill:#1e293b,stroke:#3b82f6,color:#bfdbfe
    style C fill:#1c1917,stroke:#d97706,color:#fef3c7
    style D fill:#14532d,stroke:#16a34a,color:#bbf7d0
        `} />
      </Section>

      <Section title="Condition Deep-Dive">
        <p className="text-xs text-purple-200 mb-3">
          Condition steps evaluate quality, check completeness, or gate progression. The AI answers
          YES or NO and the sequence follows the configured path.
        </p>
        <MermaidDiagram id="seq-condition" chart={`
flowchart TD
    Prev["Previous step output"] --> Q
    Q{"Condition step
    AI answers YES or NO"}
    Q -->|"YES → continue"| Next["Next step"]
    Q -->|"YES → end"| Stop([Sequence ends])
    Q -->|"NO → continue"| Next
    Q -->|"NO → end"| Stop
    Q -->|"NO → retry"| Retry["Re-run previous step"]
    Retry -->|"within maxRetries"| Prev
    Retry -->|"retries exhausted"| Next

    style Prev fill:#1e1b4b,stroke:#7C3AED,color:#e9d5ff
    style Q fill:#1c1917,stroke:#d97706,color:#fef3c7
    style Next fill:#1e1b4b,stroke:#7C3AED,color:#e9d5ff
    style Stop fill:#450a0a,stroke:#dc2626,color:#fecaca
    style Retry fill:#1e293b,stroke:#3b82f6,color:#bfdbfe
        `} />
      </Section>

      <Section title="Three Ways to Run a Sequence">
        <div className="space-y-3">
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h5 className="font-semibold text-white text-xs uppercase tracking-wider mb-1">1. From the Sequences Panel</h5>
            <p className="text-xs text-purple-200">
              Click the <strong>{'\u25B6'}</strong> play button next to any saved sequence. A running view replaces
              the editor list, showing real-time progress with spinners, checkmarks, output file paths, and word counts.
              Loop iterations expand inline showing per-iteration details.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h5 className="font-semibold text-white text-xs uppercase tracking-wider mb-1">2. From the Chat Input (/ Picker)</h5>
            <p className="text-xs text-purple-200">
              Type <Kbd>/</Kbd> at the start of the chat input (no space after) to open a floating sequence picker.
              Arrow keys navigate the list, Enter or click runs the highlighted sequence. Type to filter by name.
              Escape closes the picker.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
            <h5 className="font-semibold text-white text-xs uppercase tracking-wider mb-1">3. Via AI Chat Tools</h5>
            <p className="text-xs text-purple-200">
              Ask the AI to run a sequence by name. It uses the <code className="text-purple-200 bg-slate-700/50 px-1 rounded">listSequences</code> tool
              to find available sequences, then <code className="text-purple-200 bg-slate-700/50 px-1 rounded">runNamedSequence</code> to execute one.
              You can also ask the AI to build a one-off pipeline using <code className="text-purple-200 bg-slate-700/50 px-1 rounded">runSequence</code> without saving it first.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Running View">
        <p className="text-xs text-purple-200 mb-3">
          While a sequence is running, the Sequences panel shows a live status view. A pulsing purple dot appears on the
          Sequences tab badge, visible even when you&rsquo;re on another panel.
        </p>
        <DiagramBox>{`
  Running: "Write & Verify Chapters"
  ──────────────────────────────────────────────
  ✓  Write outline              → outline.md (450 words)
  ↻  Write chapters             (iteration 3 / 5)
       ✓  Iteration 1  → Chapter_01.md  (1,200 words)
       ✓  Iteration 2  → Chapter_02.md  (1,150 words)
       ↻  Iteration 3  (running...)
       ○  Iteration 4
       ○  Iteration 5
  ○  Quality check
  ○  Write synopsis
  ──────────────────────────────────────────────
  ✓ = done    ↻ = running    ○ = pending    ✗ = error
        `}</DiagramBox>
      </Section>

      <Section title="Worked Example: Chapter Writing Pipeline">
        <p className="text-xs text-purple-200 mb-3">
          Here&rsquo;s a complete sequence that generates an outline, writes chapters in a loop,
          quality-checks each one, and produces a final synopsis.
        </p>
        <div className="bg-slate-800/50 rounded p-4 text-xs space-y-3">
          <div>
            <h5 className="font-semibold text-purple-300 mb-1">Step 1: Generate Outline (Action)</h5>
            <ul className="list-disc list-inside text-purple-200 space-y-0.5">
              <li>Type: Action, Inline Template</li>
              <li>Template: <em>&ldquo;Write a detailed chapter-by-chapter outline for a 5-chapter fantasy story about a reluctant healer who discovers she can raise the dead.&rdquo;</em></li>
              <li>Output File: <code className="bg-slate-700/50 px-1 rounded">outline.md</code></li>
              <li>Chain: <strong>ON</strong> (passes outline to next step)</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-blue-300 mb-1">Step 2: Write Chapters (Loop, count: 5)</h5>
            <ul className="list-disc list-inside text-purple-200 space-y-0.5">
              <li>Type: Loop, Fixed Count = 5</li>
              <li>Chain: <strong>ON</strong></li>
              <li>Body Step A (Action):</li>
              <li className="ml-4">Template: <em>&ldquo;Using the outline provided, write chapter {'{{loop_index}}'} (chapter {'{{loop_index}}'} of {'{{loop_count}}'}).
                Write 1,500&ndash;2,000 words. Match the tone and pacing described in the outline.&rdquo;</em></li>
              <li className="ml-4">Output File: <code className="bg-slate-700/50 px-1 rounded">chapters/Chapter_##.md</code></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-amber-300 mb-1">Step 3: Quality Check (Condition)</h5>
            <ul className="list-disc list-inside text-purple-200 space-y-0.5">
              <li>Type: Condition</li>
              <li>Template: <em>&ldquo;Review the final chapter. Does it provide a satisfying conclusion? Answer YES or NO.&rdquo;</em></li>
              <li>If YES: Continue</li>
              <li>If NO: Retry (max 2 retries)</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-purple-300 mb-1">Step 4: Synopsis (Action)</h5>
            <ul className="list-disc list-inside text-purple-200 space-y-0.5">
              <li>Type: Action, Inline Template</li>
              <li>Template: <em>&ldquo;Write a 200-word synopsis of the complete story.&rdquo;</em></li>
              <li>Output File: <code className="bg-slate-700/50 px-1 rounded">synopsis.md</code></li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Sequence Editor UI Reference">
        <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
          <ControlRow name="+ New Sequence">Create a new blank sequence with name and description fields.</ControlRow>
          <ControlRow name="Name / Description">Text fields at the top of the editor. Name is required.</ControlRow>
          <ControlRow name="+ Add Step">Append a new step to the sequence. Defaults to Action type.</ControlRow>
          <ControlRow name="Type Selector">Three buttons at the top of each step: Action | Loop | Condition. Click to switch.</ControlRow>
          <ControlRow name="Step Label">Optional display name for the step (shown in the running view).</ControlRow>
          <ControlRow name="Inline / Prompt Tool Toggle">For Action steps: switch between writing a template directly or selecting a saved Prompt Tool.</ControlRow>
          <ControlRow name={<>{'\u2191'} / {'\u2193'} Arrows</>}>Reorder steps within the sequence.</ControlRow>
          <ControlRow name={<>{'\u00D7'} Remove</>}>Delete a step from the sequence.</ControlRow>
          <ControlRow name="Save / Cancel">Save commits the sequence to disk as JSON. Cancel discards changes.</ControlRow>
          <ControlRow name={<>{'\u25B6'} Play</>}>Run the sequence. Only available when a sequence is saved.</ControlRow>
          <ControlRow name="Edit / Delete">Per-sequence actions in the list view.</ControlRow>
        </div>
      </Section>

      <Section title="Tips & Best Practices">
        <ul className="list-disc list-inside space-y-1 text-purple-200 text-xs">
          <li><strong>Chain sparingly:</strong> Only chain when the next step actually needs the previous output. Unnecessary chaining bloats context and increases costs.</li>
          <li><strong>Use ## for loop file output:</strong> Always use <code className="bg-slate-700/50 px-1 rounded">##</code> in output file names inside loops to generate unique files per iteration.</li>
          <li><strong>Condition + Retry for quality:</strong> Place a condition step after an important action step with &ldquo;If NO &rarr; Retry&rdquo; to automatically re-run if quality is insufficient.</li>
          <li><strong>Model overrides for cost control:</strong> Use a cheaper model for simple steps (outlines, lists) and a more capable model for creative writing steps.</li>
          <li><strong>Exit-condition loops for open-ended tasks:</strong> When you don&rsquo;t know how many iterations you need, use an exit condition instead of a fixed count. Set a reasonable max-iterations cap.</li>
          <li><strong>Prompt Tools for reuse:</strong> If you use the same template across multiple sequences, save it as a Prompt Tool in the Prompts panel and reference it by name.</li>
          <li><strong>Storage:</strong> Sequences are saved as individual JSON files in <code className="bg-slate-700/50 px-1 rounded">Arcwrite/sequences/</code>. You can share them by copying these files.</li>
        </ul>
      </Section>
    </div>
  );
}

function DataPacksTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="What Are Data Packs?">
        <p>
          Data Packs are extension bundles that add new genres, plot structures, prompts, and sequences
          to Arcwright without modifying any code. A data pack is simply a folder with a
          <code className="text-purple-200 bg-slate-700/50 px-1 rounded"> pack.json</code> manifest and
          optional content files. Drop it into <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/extensions/</code> and
          it&rsquo;s loaded automatically on startup.
        </p>
        <p className="mt-2">
          This is the first tier of Arcwright&rsquo;s extensibility system: declarative data only, no code execution.
          Packs are safe to share &mdash; they contain only JSON definitions.
        </p>
      </Section>

      <Section title="Folder Structure">
        <DiagramBox>{`
  Arcwrite/
  └── extensions/
      ├── horror-pack/                   ← one pack
      │   ├── pack.json                  ← manifest (required)
      │   ├── genres.json                ← genre definitions
      │   ├── structures.json            ← plot structure definitions
      │   ├── prompts/                   ← prompt files
      │   │   ├── horror-outline.json
      │   │   └── monster-design.json
      │   └── sequences/                 ← sequence files
      │       └── horror-pipeline.json
      │
      └── romance-expansion/             ← another pack
          ├── pack.json
          ├── genres.json
          └── prompts/
              └── meet-cute-generator.json
        `}</DiagramBox>
        <p className="mt-2 text-xs text-purple-300">
          Each pack is a subfolder of <code className="bg-slate-700/50 px-1 rounded">Arcwrite/extensions/</code>.
          The only required file is <code className="bg-slate-700/50 px-1 rounded">pack.json</code>.
          All other content files are optional &mdash; include only what your pack provides.
        </p>
      </Section>

      <Section title="Step-by-Step: Creating a Data Pack">
        <ol className="list-decimal list-inside space-y-3">
          <li>
            <strong>Create the folder</strong> &mdash; Inside your <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/extensions/</code> directory,
            create a new folder for your pack (e.g., <code className="text-purple-200 bg-slate-700/50 px-1 rounded">my-pack</code>).
          </li>
          <li>
            <strong>Create pack.json</strong> &mdash; This is the manifest that identifies your pack and declares what content it includes:
            <DiagramBox>{`
  {
    "name": "Horror Pack",
    "id": "horror-pack",
    "version": "1.0.0",
    "description": "Genres, structures, and prompts for horror fiction.",
    "author": "Jane Doe",
    "includes": {
      "genres": "genres.json",
      "structures": "structures.json",
      "prompts": "prompts/",
      "sequences": "sequences/"
    }
  }
            `}</DiagramBox>
            <p className="text-xs text-purple-300 mt-1">
              All <code className="bg-slate-700/50 px-1 rounded">includes</code> keys are optional. Only list content types your pack actually provides.
            </p>
          </li>
          <li>
            <strong>Add content files</strong> (see format specifications below).
          </li>
          <li>
            <strong>Reload the app</strong> &mdash; Data packs are loaded on startup. Refresh the page to pick up new or changed packs.
          </li>
          <li>
            <strong>Verify</strong> &mdash; Open <strong>Settings {'\u2192'} Packs</strong> to see your pack listed with its content summary.
          </li>
        </ol>
      </Section>

      <Section title="pack.json Manifest Reference">
        <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
          <ControlRow name="name">Display name shown in the Packs tab. Required.</ControlRow>
          <ControlRow name="id">Unique identifier. Defaults to the folder name if omitted. Used to tag pack content internally.</ControlRow>
          <ControlRow name="version">Semantic version string (e.g., &ldquo;1.0.0&rdquo;). Optional but recommended.</ControlRow>
          <ControlRow name="description">Short description shown in the Packs tab. Optional.</ControlRow>
          <ControlRow name="author">Author name. Optional.</ControlRow>
          <ControlRow name="includes.genres">Path to a JSON file with genre definitions (relative to the pack folder).</ControlRow>
          <ControlRow name="includes.structures">Path to a JSON file with plot structure definitions.</ControlRow>
          <ControlRow name="includes.prompts">Path to a directory containing prompt JSON files.</ControlRow>
          <ControlRow name="includes.sequences">Path to a directory containing sequence JSON files.</ControlRow>
        </div>
      </Section>

      <Section title="Content Format: genres.json">
        <p className="text-xs text-purple-200 mb-3">
          Genre definitions follow the same shape as Arcwright&rsquo;s built-in genres. Each top-level key is a genre ID.
          The optional <code className="bg-slate-700/50 px-1 rounded">_dimensionRanges</code> key defines expected dimension ranges per genre.
        </p>
        <DiagramBox>{`
  {
    "_dimensionRanges": {
      "horror": {
        "intimacy": [0, 3],
        "danger": [4, 10],
        "mystery": [3, 9],
        "stakes": [5, 10],
        ...all 11 dimensions
      }
    },
    "horror": {
      "name": "Horror",
      "structure": "horrorArc",       ← key into plotStructures
      "subgenres": {
        "slasher": {
          "name": "Slasher",
          "weights": {
            "infoAsym": 1.2,
            "stakes": 1.8,
            "misalignment": 0.8,
            "powerDiff": 0.9,
            "vulnerabilityTrust": 1.5,
            "desireIntimacy": 0.3,
            "proximityTrust": 1.1,
            "danger": 1.8,
            "mystery": 1.2
          },
          "requirements": {
            "finalTension": [6, 10]
          },
          "modifiers": ["Cabin", "Summer Camp", "Urban"]
        }
      }
    }
  }
        `}</DiagramBox>
        <ul className="list-disc list-inside space-y-1 text-purple-200 text-xs mt-3">
          <li><strong>structure</strong> must be a key that exists in <code className="bg-slate-700/50 px-1 rounded">plotStructures</code> (built-in or from a pack&rsquo;s structures.json).</li>
          <li><strong>weights</strong> use the 9 tension engine channels: infoAsym, stakes, misalignment, powerDiff, vulnerabilityTrust, desireIntimacy, proximityTrust, danger, mystery.</li>
          <li><strong>requirements</strong> define pass/fail ranges for the genre&rsquo;s validation (optional).</li>
          <li><strong>modifiers</strong> are flavor tags shown in the UI (optional).</li>
        </ul>
      </Section>

      <Section title="Content Format: structures.json">
        <p className="text-xs text-purple-200 mb-3">
          Plot structures define the act divisions and named beats of a narrative framework.
        </p>
        <DiagramBox>{`
  {
    "horrorArc": {
      "name": "Horror Arc",
      "description": "Classic horror progression...",
      "acts": [
        {
          "name": "Normalcy",
          "range": [0, 25],
          "beats": ["setup", "warning"]
        },
        {
          "name": "Escalation",
          "range": [25, 75],
          "beats": ["firstEncounter", "isolation", "revelation"]
        },
        {
          "name": "Confrontation",
          "range": [75, 100],
          "beats": ["finalStand", "aftermath"]
        }
      ],
      "beats": {
        "setup": {
          "name": "Setup",
          "range": [0, 10],
          "color": "#64748b"
        },
        "warning": {
          "name": "Warning Signs",
          "range": [10, 25],
          "color": "#fb923c"
        },
        ...more beats
      }
    }
  }
        `}</DiagramBox>
        <ul className="list-disc list-inside space-y-1 text-purple-200 text-xs mt-3">
          <li><strong>acts</strong> define the macro divisions with percentage ranges that must tile 0&ndash;100%.</li>
          <li><strong>beats</strong> define named moments within acts with percentage ranges and display colors.</li>
          <li>Beat keys in the <code className="bg-slate-700/50 px-1 rounded">beats</code> field must match the beat names referenced in <code className="bg-slate-700/50 px-1 rounded">acts[].beats</code>.</li>
        </ul>
      </Section>

      <Section title="Content Format: Prompts &amp; Sequences">
        <p className="text-xs text-purple-200 mb-3">
          Pack prompts and sequences use the exact same JSON format as user-created ones. Place each as a
          separate <code className="bg-slate-700/50 px-1 rounded">.json</code> file in the
          <code className="bg-slate-700/50 px-1 rounded"> prompts/</code> or
          <code className="bg-slate-700/50 px-1 rounded"> sequences/</code> directory.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-2">Prompt File</h5>
            <DiagramBox>{`
  {
    "id": "horror-outline",
    "title": "Horror Outline",
    "template": "Write a horror
      outline with {{user_input}}
      chapters...",
    "description": "Generates a
      horror story outline."
  }
            `}</DiagramBox>
          </div>
          <div>
            <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-2">Sequence File</h5>
            <DiagramBox>{`
  {
    "id": "horror-pipeline",
    "name": "Horror Pipeline",
    "description": "Full horror
      story generation.",
    "steps": [
      {
        "id": "step_1",
        "type": "action",
        "template": "...",
        "outputFile": "outline.md",
        "chain": true
      }
    ]
  }
            `}</DiagramBox>
          </div>
        </div>
        <p className="text-xs text-purple-300 mt-3">
          Pack-provided prompts and sequences appear in the UI with a small badge indicating their source pack.
          They are <strong>read-only</strong> &mdash; users cannot edit or delete pack content (edit the pack files directly instead).
        </p>
      </Section>

      <Section title="Viewing Installed Packs">
        <p className="text-xs text-purple-200 mb-2">
          Open <strong>Settings {'\u2192'} Packs</strong> tab to see all loaded data packs.
        </p>
        <div className="bg-slate-800/50 rounded p-4 space-y-0.5">
          <ControlRow name="Pack Card">Shows the pack name, version badge, author, and description.</ControlRow>
          <ControlRow name="Content Summary">Purple text below each card showing what the pack provides (e.g., &ldquo;3 genres &middot; 1 structure &middot; 5 prompts&rdquo;).</ControlRow>
          <ControlRow name="Empty State">When no packs are installed, the tab shows instructions for where to place pack folders.</ControlRow>
        </div>
      </Section>

      <Section title="How Packs Are Loaded">
        <DiagramBox>{`
  App Startup
  ─────────────────────────────────────────────────────
  1. restoreFromIDB()
     └─ Load Arcwrite/ handle from IndexedDB
     └─ Read settings, load projects

  2. loadPrompts() + loadSequences()
     └─ Load user-created prompts and sequences

  3. loadDataPacks()                          ← NEW
     └─ Scan Arcwrite/extensions/ for subdirs
     └─ Read pack.json from each subdirectory
     └─ Load genres.json, structures.json,
        prompts/*.json, sequences/*.json

  4. applyDataPacks()                         ← NEW
     └─ Merge genres into genreSystem
     └─ Merge structures into plotStructures
     └─ Inject pack prompts (tagged with _packId)
     └─ Inject pack sequences (tagged with _packId)
  ─────────────────────────────────────────────────────
  Pack content is merged AT RUNTIME — built-in data
  files are never modified. Removing a pack folder
  and reloading removes its content cleanly.
        `}</DiagramBox>
      </Section>

      <Section title="Tips &amp; Limitations">
        <ul className="list-disc list-inside space-y-1 text-purple-200 text-xs">
          <li><strong>No code execution:</strong> Data packs are JSON only. They cannot add UI components, tools, or custom logic.</li>
          <li><strong>Reload required:</strong> Packs are loaded on startup. After adding, removing, or modifying a pack, refresh the page.</li>
          <li><strong>ID conflicts:</strong> If two packs define the same genre key, the last one loaded wins. Use unique keys.</li>
          <li><strong>Structure references:</strong> If your genre references a custom structure (e.g., <code className="bg-slate-700/50 px-1 rounded">&ldquo;structure&rdquo;: &ldquo;horrorArc&rdquo;</code>), that structure must exist &mdash; either built-in or defined in the same pack&rsquo;s <code className="bg-slate-700/50 px-1 rounded">structures.json</code>.</li>
          <li><strong>Sharing packs:</strong> Zip the pack folder and share the archive. Recipients unzip it into their <code className="bg-slate-700/50 px-1 rounded">Arcwrite/extensions/</code> directory.</li>
          <li><strong>Dimensions are fixed:</strong> Packs cannot add new narrative dimensions (the 11 dimensions are hardcoded). They can only define weights and ranges for existing dimensions.</li>
        </ul>
      </Section>
    </div>
  );
}

function ChangelogTab() {
  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="Changelog">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.6.0</span>
              <span className="text-purple-300 text-xs">2026-02-25</span>
            </div>
            <h4 className="font-bold text-white mb-2">Storage Reorganization &amp; Chat History Archiving</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Folder Structure</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>AI project configs moved from <code className="text-purple-200 bg-slate-700/50 px-1 rounded">projects/ai/Name.json</code> to <code className="text-purple-200 bg-slate-700/50 px-1 rounded">chat-history/Name/project.json</code></li>
                  <li>Each AI project now has its own subfolder under <code className="text-purple-200 bg-slate-700/50 px-1 rounded">chat-history/</code> containing both config and all chat history in one place</li>
                  <li><code className="text-purple-200 bg-slate-700/50 px-1 rounded">projects/ai/</code> is now unused &mdash; all AI project data lives under <code className="text-purple-200 bg-slate-700/50 px-1 rounded">chat-history/</code></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Chat History Archiving</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>&ldquo;New Chat&rdquo; archives the current conversation to a timestamped file before clearing &mdash; no history is ever destroyed</li>
                  <li>Archives stored as <code className="text-purple-200 bg-slate-700/50 px-1 rounded">chat-history/Name/2026-02-25T20-30-00.json</code></li>
                  <li>Restore any archived session by renaming it to <code className="text-purple-200 bg-slate-700/50 px-1 rounded">active.json</code></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Storage Setup</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Picking an existing <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite</code> folder now asks: &ldquo;Is this your home folder?&rdquo; &mdash; OK uses it directly, Cancel creates a subfolder inside it</li>
                  <li>Prevents accidentally nesting <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/Arcwrite/</code></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Image Generation</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Fixed OpenRouter routing &mdash; dual-output models (Gemini Image, GPT-5-image) use text+image modalities; image-only models (Flux, Seedream) use image-only</li>
                  <li>Regenerate button on image messages re-runs image generation directly instead of sending to the chat model</li>
                  <li>Images save to the active book project&rsquo;s <code className="text-purple-200 bg-slate-700/50 px-1 rounded">images/</code> folder, or <code className="text-purple-200 bg-slate-700/50 px-1 rounded">Arcwrite/images/</code> when no project is open</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Context Efficiency</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Reference-mode files no longer cache content in the project JSON &mdash; loaded from disk on demand</li>
                  <li>Switching a file to reference mode immediately clears its cached content</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.5.0</span>
              <span className="text-purple-300 text-xs">2026-02-21</span>
            </div>
            <h4 className="font-bold text-white mb-2">Local LLM Support</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Local Providers</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Four local LLM providers added: Ollama, LM Studio, Jan.ai, and LocalAI</li>
                  <li>No API key required — local servers use the OpenAI-compatible REST protocol on localhost</li>
                  <li>Each provider card shows CORS setup instructions instead of an API key field</li>
                  <li>Refresh button (↻) enabled without a key — fetches models from the running local server</li>
                  <li>Local providers appear in the Active Provider dropdown alongside cloud providers</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Default Ports</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Ollama: <code className="text-purple-200 bg-slate-700/50 px-1 rounded">localhost:11434</code> — run with <code className="text-purple-200 bg-slate-700/50 px-1 rounded">OLLAMA_ORIGINS=http://localhost:5173 ollama serve</code></li>
                  <li>LM Studio: <code className="text-purple-200 bg-slate-700/50 px-1 rounded">localhost:1234</code> — enable Local Server and allow CORS in Developer settings</li>
                  <li>Jan.ai: <code className="text-purple-200 bg-slate-700/50 px-1 rounded">localhost:1337</code> — Settings &rarr; Advanced &rarr; CORS &rarr; add <code className="text-purple-200 bg-slate-700/50 px-1 rounded">http://localhost:5173</code></li>
                  <li>LocalAI: <code className="text-purple-200 bg-slate-700/50 px-1 rounded">localhost:8080</code> — CORS enabled by default</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.4.0</span>
              <span className="text-purple-300 text-xs">2026-02-20</span>
            </div>
            <h4 className="font-bold text-white mb-2">AI Image Generation &amp; Model Browser</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Image Generation</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Open provider system &mdash; works with OpenRouter (Flux, Seedream, Gemini Image, etc.), OpenAI (DALL-E), and other image-capable providers</li>
                  <li>AI <code className="text-purple-200 bg-slate-700/50 px-1 rounded">generateImage</code> tool &mdash; the chat assistant can generate images via natural language and save them as PNG artifacts</li>
                  <li>Images appear inline in chat messages with filename and prompt preview</li>
                  <li>Generated images saved to <code className="text-purple-200 bg-slate-700/50 px-1 rounded">artifacts/</code> folder with manifest tracking (type: &lsquo;image&rsquo;)</li>
                  <li>Editor supports <code className="text-purple-200 bg-slate-700/50 px-1 rounded">![alt](url)</code> markdown image syntax &mdash; renders inline in the contentEditable editor</li>
                  <li>Blob URL registry for session-scoped image rendering without persistent URLs</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Image Model Browser</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Browse button in Settings &rarr; Image fetches image-capable models from the selected provider</li>
                  <li>Uses provider-specific discovery endpoints to find all available image models</li>
                  <li>Searchable model list with model ID, display name, and per-image or per-token pricing</li>
                  <li>Click any model to populate the model ID field</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Settings &amp; Documentation</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>New Image tab in Settings with provider selector, model input/browser, and default size</li>
                  <li>Interface Guide updated with Image tab and Packs tab documentation</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.3.0</span>
              <span className="text-purple-300 text-xs">2026-02-20</span>
            </div>
            <h4 className="font-bold text-white mb-2">Loops, Conditionals, Data Packs &amp; Trial Expiration</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Sequence Loops &amp; Conditionals</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Three step types: Action (existing), Loop (new), and Condition (new)</li>
                  <li>Loop steps repeat a body of sub-steps a fixed number of times or until an AI exit condition returns STOP</li>
                  <li>Condition steps evaluate AI YES/NO responses with configurable outcomes: continue, end, or retry previous step</li>
                  <li><code>##</code> substitution in loop body output files &mdash; replaced with zero-padded iteration index (01, 02, ...)</li>
                  <li>Template variables <code>{'{{loop_index}}'}</code> and <code>{'{{loop_count}}'}</code> available inside loop body prompts</li>
                  <li>Retry logic: condition with &ldquo;If NO &rarr; Retry&rdquo; re-runs the previous step up to maxRetries times</li>
                  <li>Running view shows loop iteration progress with expandable sub-rows and condition decision text</li>
                  <li>Type selector UI (Action | Loop | Condition) on each step in the sequence editor</li>
                  <li>Nested loop prevention: body steps cannot contain another loop (depth=1 limit)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Data Packs (Extension System)</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>JSON-based extension bundles in <code>Arcwrite/extensions/</code> for adding genres, structures, prompts, and sequences</li>
                  <li>Each pack is a folder with a <code>pack.json</code> manifest and optional content files</li>
                  <li>Pack genres merged into genreSystem at runtime via Object.assign</li>
                  <li>Pack structures merged into plotStructures and allStructures</li>
                  <li>Pack prompts and sequences injected into stores with _packId tags (read-only in UI)</li>
                  <li>New &ldquo;Packs&rdquo; tab in Settings showing installed packs with content summaries</li>
                  <li>Graceful fallback when no extensions/ folder exists</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Trial Expiration</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Build-time trial expiration constant prevents use of outdated builds</li>
                  <li>Expired builds show a clear expiration screen with the date and instructions</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Documentation</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Comprehensive Sequences tab in Help with step types, loop/condition deep-dives, ASCII diagrams, worked examples, and UI reference</li>
                  <li>Data Packs tab in Help with folder structure, manifest format, content specifications, and step-by-step pack creation guide</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.2.0</span>
              <span className="text-purple-300 text-xs">2026-02-20</span>
            </div>
            <h4 className="font-bold text-white mb-2">Named Sequences, Voice Guide &amp; Prompt Tools</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Named Sequences</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>New Sequences tab in the Edit workflow left panel for designing reusable multi-step prompt pipelines</li>
                  <li>Steps reference saved Prompt Tools or inline templates with optional output file paths and per-step model overrides</li>
                  <li>Chain flag passes step output as context into the next step</li>
                  <li>/ slash-command in chat input opens a floating sequence picker &mdash; arrow keys navigate, Enter runs immediately</li>
                  <li>Pulsing purple dot on the Sequences tab badge while any sequence is actively running</li>
                  <li>Running view shows per-step progress: spinner &rarr; &#x2713;/&#x2717;, output file path, and word count</li>
                  <li>AI tools: listSequences and runNamedSequence for orchestrated pipeline execution via chat</li>
                  <li>Sequences stored as JSON files in Arcwrite/sequences/ inside the open folder</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Voice Guide &amp; Narrator Gender</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>New Voice tab in Settings &mdash; select a .md file from Arcwrite/voices/ to inject a style guide into every AI prompt</li>
                  <li>Narrator Gender overlay: None / Female / Male buttons load mechanics files from Arcwrite/gender-mechanics/</li>
                  <li>Gender mechanics append after the voice guide as a supplemental layer, stacking rather than replacing</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Prompt Tools</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Custom Prompt Tools stored in Arcwrite/prompts/ and available as presets in the inline AI popup</li>
                  <li>runSequence action: AI-constructed one-off pipelines via chat without needing a saved named sequence</li>
                  <li>getCustomPrompts tool for AI to discover available Prompt Tools before using them in sequences</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.1.0</span>
              <span className="text-purple-300 text-xs">2026-02-17</span>
            </div>
            <h4 className="font-bold text-white mb-2">Diff/Merge View, Multi-Provider API &amp; Non-Fiction Data Layer</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Diff &amp; Merge View</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Side-by-side diff view comparing original and revised documents in dual-pane mode</li>
                  <li>Smart paragraph alignment using diffArrays with fuzzy matching (40% word overlap threshold)</li>
                  <li>Word-level change highlighting: green additions, red strikethrough removals</li>
                  <li>Gutter merge arrows: accept revision ({'\u2190'}) or keep original ({'\u2192'}) per paragraph</li>
                  <li>Bulk "Accept All" and "Reject All" buttons for wholesale changes</li>
                  <li>Inline editing: click into any paragraph on either side to edit directly, saves on blur</li>
                  <li>Stats bar: character additions/removals, change count, paragraph counts</li>
                  <li>Spacer rows for paragraphs that exist only on one side</li>
                  <li>Content preserved when exiting diff mode (contentEditable re-sync on toggle)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Multi-Provider API System</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Unified provider adapter routing to OpenRouter, OpenAI, Anthropic, and Perplexity</li>
                  <li>Anthropic native protocol support (Messages API, x-api-key auth, SSE streaming)</li>
                  <li>Dynamic model fetching from all providers with API-backed model lists</li>
                  <li>Provider cards in Settings with custom dropdown showing pricing per million tokens</li>
                  <li>Known model metadata enrichment for Anthropic (context length, supported parameters)</li>
                  <li>Pagination support for Anthropic model list (has_more / after_id)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Non-Fiction Data Layer</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Non-fiction dimensions: authority, clarity, evidence density, narrative pull, practical value, emotional resonance, intellectual challenge</li>
                  <li>Non-fiction structures: linear argument, problem-solution, narrative non-fiction, how-to guide, essay collection</li>
                  <li>Non-fiction genres: self-help, memoir, popular science, business, history, true crime, essay</li>
                  <li>Engagement pressure engine (non-fiction equivalent of tension)</li>
                  <li>Genre-specific weight channels aligned to engagement pressure</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Projects</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>New Projects workflow for managing book projects</li>
                  <li>AI-assisted project metadata editing</li>
                  <li>Project list with book details and genre tracking</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v2.0.0</span>
              <span className="text-purple-300 text-xs">2026-02-13</span>
            </div>
            <h4 className="font-bold text-white mb-2">Edit Workflow, Inline AI &amp; Script Execution</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Edit Workflow</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>New Edit workflow: full-featured writing environment with file browser and markdown editor</li>
                  <li>File System Access API integration &mdash; open, read, write, rename, and create files/folders directly from the browser</li>
                  <li>File panel with tree view, expand/collapse folders, and tabbed file editing</li>
                  <li>Rich-text toolbar: bold, italic, underline, strikethrough, headers (H1&ndash;H4), lists, blockquotes, text color, background highlight</li>
                  <li>Color picker with reset-to-default for both text color and highlight</li>
                  <li>Multiple editor themes with customizable colors</li>
                  <li>Search &amp; Replace with regex support (Ctrl+H)</li>
                  <li>Dual pane mode for side-by-side file editing</li>
                  <li>Live word count in status bar</li>
                  <li>Markdown export</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Inline AI Editing</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Select text to reveal a floating AI button; click to open the editing popup</li>
                  <li>18 preset prompts (Continue, Revise, Go, EPBM, Chapter Revision, Line Edit, Adverb Reduction, Dialogue Tag Refinement, and more)</li>
                  <li>Template variables: {'{{selected_text}}'}, {'{{before}}'}, {'{{after}}'}, {'{{selected_documents}}'}, {'{{user_input}}'}</li>
                  <li>Accept, reject, or retry AI responses with diff view showing additions/removals</li>
                  <li>Prompt history dropdown for quick reuse of previous instructions</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">AI Context Selection</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Green/gray context dots on every file in the file panel</li>
                  <li>Green-dot files are included as context when using preset prompts with {'{{selected_documents}}'}</li>
                  <li>Folder dots toggle all children at once</li>
                  <li>Separate from the chat panel's context (chat sees editor panes; inline AI sees green-dot files)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Script Execution System</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Tools dropdown in the editor toolbar with 4 built-in scripts</li>
                  <li>Split into Chapters: split a file on chapter headings into numbered .md files</li>
                  <li>Combine Chapters: merge all files in a folder into a single document</li>
                  <li>Em-dash Cleanup: smart em-dash replacement (preserves dialogue interruptions)</li>
                  <li>AI-assisted Regex Search &amp; Replace: describe what to find in plain English, AI suggests a regex pattern</li>
                  <li>Right-click context menu on files/folders for context-appropriate scripts</li>
                  <li>Script output panel with timestamped logs, progress bar, and color-coded messages</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Chat Panel Improvements</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Stop button: click the red square to cancel AI generation mid-stream</li>
                  <li>Prompt modes: Full Context, Line Editor, Writing Partner, Critic, Version Comparator</li>
                  <li>Settings dialog for configuring prompt mode, tools, temperature, and multi-provider API keys</li>
                  <li>AbortController integration for clean stream cancellation</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v1.4.0</span>
              <span className="text-purple-300 text-xs">2026-02-10</span>
            </div>
            <h4 className="font-bold text-white mb-2">Story Structure Reference &amp; Robust JSON Parsing</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Structure Reference</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Collapsible structure reference panel in Scaffolding workflow showing current structure's acts, beats, and related frameworks</li>
                  <li>New "Story Structures" tab in Help page with all 4 app structures displayed with act distribution bars and beat timelines</li>
                  <li>Reference library of 11 external story frameworks: Three-Act/Syd Field, Kishotenketsu, Freytag's Pyramid, Eight-Sequence, Michael Hauge, W-Plot, Fichtean Curve, Save the Cat, Truby 22 Steps, Story Circle, Seven-Point</li>
                  <li>Each reference framework shown as collapsible card with type badge, step positions, distribution, and summary</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Stability</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Robust JSON parser with 3 fallback strategies: direct parse, trailing comma/control char repair, truncated JSON recovery</li>
                  <li>Increased max tokens from 4096 to 8192 for chapter analysis to prevent truncation</li>
                  <li>Improved API error messages for authentication failures (Clerk/OpenRouter)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v1.3.0</span>
              <span className="text-purple-300 text-xs">2026-02-10</span>
            </div>
            <h4 className="font-bold text-white mb-2">Beat Editor: Drag-and-Drop, Insertion &amp; Custom Structures</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Beat Editor Improvements</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Inline label editing &mdash; click a beat's name to rename it directly in the collapsed row</li>
                  <li>Drag-and-drop beat reordering with grip handle &mdash; time% recalculates to fit new position</li>
                  <li>"+" insertion zones between beats &mdash; hover to reveal, click to insert at midpoint time%</li>
                  <li>Inserted beats inherit averaged dimension values from their neighbors</li>
                  <li>Smarter "Add Beat" button finds the largest gap in the timeline instead of appending at end</li>
                  <li>Visual drag feedback: dragged row dims, drop target gets green border highlight</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Custom Story Structures</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>"Save as Structure" button saves current beats as a named, reusable template</li>
                  <li>"Load Template" dropdown shows genre template + all saved custom structures</li>
                  <li>Custom structures persist across sessions in localStorage</li>
                  <li>Delete custom structures from the dropdown menu</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v1.2.0</span>
              <span className="text-purple-300 text-xs">2026-02-10</span>
            </div>
            <h4 className="font-bold text-white mb-2">AI Chat Panel, Genre Blending &amp; Beat Suggestions</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">AI Chat Panel</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Sliding chat drawer on the left edge with toggle button</li>
                  <li>Context-aware: knows which workflow is open, reads all current state</li>
                  <li>Can modify beats, genre settings, weights, and chapter scores via natural language</li>
                  <li>Streaming responses with action badges showing what was changed</li>
                  <li>"Prompt" button to view the live system prompt sent to the LLM</li>
                  <li>Uses the API key and model configured in Settings</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Genre Blending</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Blend two genres with adjustable ratio (1&ndash;99%)</li>
                  <li>Blends dimension weights, preset arcs, and genre requirements</li>
                  <li>"Load Blended Template" creates a merged arc from both genres</li>
                  <li>Blend metadata shown in scaffold output and exports</li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Beat Suggestions</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Each beat shows dimension suggestions comparing actual vs genre ideal values</li>
                  <li>Color-coded badges indicate which dimensions need adjustment</li>
                  <li>One-click "Apply Suggestions" to snap dimensions to ideal values</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v1.1.0</span>
              <span className="text-purple-300 text-xs">2026-02-09</span>
            </div>
            <h4 className="font-bold text-white mb-2">Pacing System, Scaffold Output &amp; Analysis Output</h4>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Pacing Templates &amp; Classifier</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>6 pacing patterns: Slow Burn, Instalove, One Night Stand, Second Chance, Enemies to Lovers, Friends to Lovers</li>
                  <li>Pacing templates overwrite intimacy curve when loading scaffold (romance genres)</li>
                  <li>Optional companion dimension adjustments (desire, vulnerability) per pacing pattern</li>
                  <li>Algorithmic pacing classifier: detects pattern + confidence from any intimacy curve</li>
                  <li>Pacing selector dropdown integrated into genre configuration (romance-only)</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Scaffold Output &amp; Writing Guide</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Summary card: genre configuration, turning points, arc shape, validation status</li>
                  <li>Beat sheet with tension drivers, emotional coordinates, and narrative writing guidance</li>
                  <li>Beat guidance for all 4 plot structures: purpose, emotional goal, establish/avoid lists</li>
                  <li>Export as Markdown (.md) or standalone HTML (printable to PDF)</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Revision Checklist &amp; Projection</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Auto-generated revision checklist from gap analysis with priority sorting</li>
                  <li>Interactive checkboxes with progress bar tracking</li>
                  <li>AI-enhanced checklist items when an API key is configured</li>
                  <li>Before/after projection slider (0&ndash;100%) blending actual toward ideal curves</li>
                  <li>Triple-layer comparison chart: actual (solid), ideal (dashed), projected (dotted)</li>
                  <li>Projected health score recalculated at each slider position</li>
                  <li>Markdown export for revision checklists</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Stability</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Error boundary added to prevent blank screens from runtime errors</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-mono">v1.0.0</span>
              <span className="text-purple-300 text-xs">2026-02-09</span>
            </div>
            <h4 className="font-bold text-white mb-2">Initial Release &mdash; Full Application</h4>
            <p className="text-purple-200 mb-2">
              Complete rebuild from the original single-file UniversalNarrativeAnalyzer into a
              full Vite + React application with two distinct workflows.
            </p>
            <div className="space-y-3">
              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Architecture</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Vite + React 18 standalone application with Tailwind CSS</li>
                  <li>Zustand state management with localStorage persistence</li>
                  <li>React Router with lazy-loaded workflow pages</li>
                  <li>Extracted data modules: dimensions, plot structures, genre system, modifiers, preset arcs</li>
                  <li>Extracted engine modules: tension calculator, validation/gap analysis, weights, defaults</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Story Scaffolding Workflow</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Genre/subgenre/modifier selection with auto-configured weights</li>
                  <li>Load genre template arcs as starting points</li>
                  <li>Interactive beat editor with expandable rows and 11 dimension sliders per beat</li>
                  <li>Live Recharts visualization updating in real time</li>
                  <li>Genre requirement validation (intimacy, trust, tension targets)</li>
                  <li>JSON export/import for scaffolds</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Reverse Engineering & Diagnosis Workflow</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Chapter input: single-chapter paste or bulk split on "Chapter X" markers</li>
                  <li>Multi-provider API integration (OpenRouter, OpenAI, Anthropic, Perplexity) for AI-assisted dimension scoring (batched in groups of 5)</li>
                  <li>Score review table with per-chapter expandable editing</li>
                  <li>Comparison overlay chart: solid (actual) vs dashed (ideal) lines with gap heat strip</li>
                  <li>Get-Well Plan: health score, priority actions, beat-by-beat diagnosis</li>
                  <li>Algorithmic recommendations (always available) + AI-enhanced editorial advice (optional)</li>
                  <li>Markdown export for get-well plans</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Supported Genres</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Romance: Contemporary, Dark, Serial Killer, Paranormal, Romantic Suspense</li>
                  <li>Science Fiction: Space Opera, Cyberpunk, Hard SF</li>
                  <li>Fantasy: Epic, Urban, Dark</li>
                  <li>Mystery/Thriller/Suspense: Cozy Mystery, Psychological Thriller, Hardboiled Detective</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-1">Plot Structures</h5>
                <ul className="list-disc list-inside text-xs text-purple-200 space-y-0.5">
                  <li>Romancing the Beat (Romance)</li>
                  <li>Hero's Journey (Science Fiction, Fantasy)</li>
                  <li>Three Act Structure (General)</li>
                  <li>Mystery/Suspense Structure (Mystery/Thriller)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-slate-600 text-white text-xs px-2 py-0.5 rounded font-mono">v0.1.0</span>
              <span className="text-purple-300 text-xs">Pre-release</span>
            </div>
            <h4 className="font-bold text-white mb-2">Original Prototype</h4>
            <p className="text-purple-200">
              Single-file React component (UniversalNarrativeAnalyzer) with embedded data,
              hardcoded sample arcs, and basic chart visualization. Served as proof-of-concept
              for the multi-dimensional narrative analysis approach.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

const ACT_COLORS = ['#60a5fa', '#4ade80', '#fb923c', '#c084fc', '#f87171', '#22d3ee'];

// Build a map of structureKey -> [genre names that use it]
const structureGenreMap = {};
Object.entries(genreSystem).forEach(([, genre]) => {
  const key = genre.structure;
  if (!structureGenreMap[key]) structureGenreMap[key] = [];
  structureGenreMap[key].push(genre.name);
});

function ActDistributionBar({ acts }) {
  if (!acts || acts.length === 0) return null;
  return (
    <div>
      <div className="flex rounded overflow-hidden h-6">
        {acts.map((act, i) => {
          const width = act.range[1] - act.range[0];
          return (
            <div
              key={i}
              className="flex items-center justify-center text-[10px] font-semibold text-white/90 overflow-hidden"
              style={{
                width: `${width}%`,
                backgroundColor: ACT_COLORS[i % ACT_COLORS.length],
                minWidth: 0,
              }}
              title={`${act.name}: ${act.range[0]}%-${act.range[1]}%`}
            >
              {width >= 12 ? act.name : ''}
            </div>
          );
        })}
      </div>
      <div className="flex mt-0.5">
        {acts.map((act, i) => {
          const width = act.range[1] - act.range[0];
          return (
            <div
              key={i}
              className="text-[9px] text-purple-400 text-center overflow-hidden"
              style={{ width: `${width}%`, minWidth: 0 }}
            >
              {width >= 10 ? `${act.range[0]}-${act.range[1]}%` : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferenceCard({ item }) {
  const [open, setOpen] = useState(false);
  const typeBadge = {
    act: { label: 'Act', bg: 'bg-blue-600/60' },
    beat: { label: 'Beat', bg: 'bg-green-600/60' },
    hybrid: { label: 'Hybrid', bg: 'bg-amber-600/60' },
  }[item.type] || { label: item.type, bg: 'bg-slate-600/60' };

  return (
    <div className="bg-slate-800/50 rounded border border-purple-500/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`transition-transform inline-block text-xs text-purple-400 ${open ? 'rotate-90' : ''}`}>
          {'\u25B6'}
        </span>
        <span className="font-semibold text-white text-sm flex-1">{item.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeBadge.bg}`}>{typeBadge.label}</span>
        <span className="text-xs text-purple-400">{item.countLabel}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-3 border-t border-purple-500/10">
          <p className="text-xs text-purple-200 leading-relaxed mt-2">{item.summary}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
            <span><span className="text-purple-400">Distribution:</span> <span className="text-purple-200">{item.distribution}</span></span>
            <span><span className="text-purple-400">Symmetric:</span> <span className="text-purple-200">{item.symmetric ? 'Yes' : 'No'}</span></span>
            <span><span className="text-purple-400">Genres:</span> <span className="text-purple-200">{item.genres}</span></span>
          </div>
          {item.steps && item.steps.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
              {item.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-purple-500 w-4 text-right flex-shrink-0">{i + 1}.</span>
                  <span className="text-purple-200 flex-1">{step.name}</span>
                  <span className="text-purple-500 flex-shrink-0">{step.position}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StructuresTab() {
  const actStructures = referenceStructures.filter((s) => s.type === 'act' || s.type === 'hybrid');
  const beatStructuresRef = referenceStructures.filter((s) => s.type === 'beat');

  return (
    <div className="space-y-4 text-sm text-purple-100 leading-relaxed">
      <Section title="App Structures">
        <p className="mb-4 text-xs text-purple-300">
          These are the 4 story structures used by Arcwright for scaffolding and analysis.
          Each structure defines named beats at specific story percentages, grouped into acts.
        </p>
        <div className="space-y-6">
          {Object.entries(plotStructures).map(([key, struct]) => {
            const genres = structureGenreMap[key] || [];
            const beatEntries = Object.entries(struct.beats);
            return (
              <div key={key} className="bg-slate-800/50 rounded p-4 border border-purple-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-bold text-white">{struct.name}</h4>
                  {genres.length > 0 && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                      {genres.join(', ')}
                    </span>
                  )}
                </div>
                {struct.description && (
                  <p className="text-xs text-purple-200 mb-3">{struct.description}</p>
                )}

                <ActDistributionBar acts={struct.acts} />

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  {beatEntries.map(([bKey, beat]) => (
                    <div key={bKey} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: beat.color }}
                      />
                      <span className="text-purple-200 truncate">{beat.name}</span>
                      <span className="text-purple-500 ml-auto flex-shrink-0">
                        {beat.range[0] === beat.range[1] ? `${beat.range[0]}%` : `${beat.range[0]}-${beat.range[1]}%`}
                      </span>
                    </div>
                  ))}
                </div>

                {struct.relatedFrameworks && (
                  <p className="text-[10px] text-purple-400 mt-2 italic">{struct.relatedFrameworks}</p>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Reference: Act Structures">
        <p className="mb-3 text-xs text-purple-300">
          Act structures define the macro divisions of a story and what percentage each occupies.
          They answer: "How many major sections? How long is each?"
        </p>
        <div className="space-y-2">
          {actStructures.map((item, i) => (
            <ReferenceCard key={i} item={item} />
          ))}
        </div>
      </Section>

      <Section title="Reference: Beat Structures">
        <p className="mb-3 text-xs text-purple-300">
          Beat structures define specific story moments or turning points at prescribed positions.
          They answer: "What happens at this point in the story?"
        </p>
        <div className="space-y-2">
          {beatStructuresRef.map((item, i) => (
            <ReferenceCard key={i} item={item} />
          ))}
        </div>
      </Section>

      <Section title="Key Insights">
        <ul className="list-disc list-inside space-y-1 text-xs text-purple-200">
          <li><strong>Act structures are almost universally non-linear.</strong> The dominant pattern is 25/50/25 with the middle act consuming the bulk of the narrative.</li>
          <li><strong>Only Freytag's original Pyramid is truly symmetric</strong> at the act level (20/20/20/20/20).</li>
          <li><strong>Beat positions are percentage-based, not chapter-based.</strong> A 30-chapter three-act novel has ~8/~15/~7 chapters, not 10/10/10.</li>
          <li><strong>Truby's organic approach</strong> rejects imposed act divisions. Structure grows from character need and moral argument.</li>
          <li><strong>Act structures define the shape; beat structures fill in the moments.</strong> The app handles this separation: plotStructures = act/beat ranges; presetArcs = specific moments with dimension values.</li>
        </ul>
      </Section>
    </div>
  );
}

const dimensionDescriptions = {
  intimacy: 'Emotional entanglement between characters — how enmeshed, engaged, and emotionally invested they are in each other, regardless of whether that engagement is positive or negative. Anger, rivalry, forced proximity, and obsession all drive high intimacy because they create intense emotional engagement (supported by excitation transfer theory). Low intimacy = indifference; high intimacy = deep entanglement, whether as love, fury, or fixation. Vulnerability is tracked separately — high intimacy with low vulnerability means the connection is charged but guarded.',
  powerDiff: 'The power imbalance between key characters. Positive = Character A dominates; negative = Character B dominates; zero = equal footing. Power shifts drive conflict in nearly every genre, from corporate thrillers to fantasy courts.',
  infoAsym: 'How much one character (or the reader) knows vs. others. High info asymmetry creates dramatic irony, suspense, and the drive to reveal. Mysteries live and die on this dimension.',
  alignment: 'How closely characters\' goals align. High alignment = working together; low = actively opposing. Goal misalignment is one of the most fundamental sources of narrative tension.',
  proximity: 'How physically close the characters are forced to be. Forced proximity amplifies every other dimension -- tension rises when you can\'t escape someone you don\'t trust, or desire someone you\'re stuck with.',
  vulnerability: 'How emotionally or physically exposed a character is. Vulnerability without trust creates anxiety; vulnerability with trust creates catharsis. It\'s the dimension that makes readers hold their breath.',
  desire: 'Wanting -- whether romantic, professional, or existential. The gap between desire and fulfillment (intimacy, goal achievement, safety) drives characters forward. In romance, this is the ache; in thrillers, the obsession.',
  stakes: 'What\'s at risk if things go wrong. Low stakes = a mild inconvenience; high stakes = death, loss of love, end of the world. Stakes give weight to every other dimension.',
  trust: 'How much characters rely on each other. Trust is slow to build and fast to destroy. Its interaction with vulnerability and proximity creates some of fiction\'s most powerful moments.',
  danger: 'External threat level -- physical, psychological, or social. Danger raises stakes, reduces safety, and forces characters to reveal who they really are under pressure.',
  mystery: 'The unknown -- unanswered questions that pull readers forward. What\'s in the box? Who killed them? What does the prophecy mean? Mystery is the engine of page-turning.',
};

const weightChannelDescriptions = [
  { key: 'infoAsym', formula: 'point.infoAsym', explanation: 'Direct: information asymmetry value' },
  { key: 'stakes', formula: 'point.stakes', explanation: 'Direct: stakes value' },
  { key: 'misalignment', formula: '10 - point.alignment', explanation: 'Inverted: low alignment = high misalignment' },
  { key: 'powerDiff', formula: 'abs(point.powerDiff)', explanation: 'Absolute: any power imbalance creates tension' },
  { key: 'vulnerabilityTrust', formula: 'vuln * (10 - trust) / 10', explanation: 'Gap: being vulnerable without trust' },
  { key: 'desireIntimacy', formula: 'desire * (10 - intimacy) / 10', explanation: 'Gap: wanting without having' },
  { key: 'proximityTrust', formula: 'proximity * (10 - trust) / 10', explanation: 'Gap: closeness without safety' },
  { key: 'danger', formula: 'point.danger', explanation: 'Direct: danger/threat value' },
  { key: 'mystery', formula: 'point.mystery', explanation: 'Direct: mystery/unknown value' },
];

const tabLabels = {
  about: 'About',
  interface: 'Interface Guide',
  mainPages: 'Main Pages',
  sequences: 'Sequences',
  dataPacks: 'Data Packs',
  structures: 'Story Structures',
  actStructures: 'Act Structures Survey',
  dimensions: 'Dimensions Reference',
  changelog: 'Changelog',
};

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState('about');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Help & Documentation</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <Tab
            key={tab}
            id={tab}
            label={tabLabels[tab]}
            active={activeTab === tab}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* Content */}
      <div className="bg-white/10 backdrop-blur rounded-b-lg rounded-tr-lg p-6 border border-purple-500/20 border-t-0">
        {activeTab === 'about' && <AboutTab />}
        {activeTab === 'interface' && <InterfaceGuideTab />}
        {activeTab === 'mainPages' && <MainPagesTab />}
        {activeTab === 'sequences' && <SequencesTab />}
        {activeTab === 'dataPacks' && <DataPacksTab />}
        {activeTab === 'structures' && <StructuresTab />}
        {activeTab === 'actStructures' && <ActStructuresTab />}
        {activeTab === 'dimensions' && <DimensionsTab />}
        {activeTab === 'changelog' && <ChangelogTab />}
      </div>
    </div>
  );
}
