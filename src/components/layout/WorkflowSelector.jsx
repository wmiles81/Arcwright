import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SetupBanner from '../projects/SetupBanner';

function WelcomeModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-purple-500/40 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8">
        <h2 className="text-2xl font-bold text-white mb-4">Welcome to Arcwright</h2>
        <p className="text-purple-200 text-sm mb-5">
          Here are a few things to know:
        </p>
        <ol className="text-purple-100 text-sm space-y-3 mb-6 list-decimal list-inside">
          <li>
            <span className="font-semibold text-white">Your data lives in <code className="bg-purple-800/50 px-1 rounded text-xs">~/.arcwright</code></span> — settings,
            projects, and prompts are stored there automatically.
          </li>
          <li>
            <span className="font-semibold text-white">Set up your API key</span> — click the
            settings gear and enter your API key so the AI features work.
          </li>
          <li>
            <span className="font-semibold text-white">Import existing data</span> — if you have
            an Arcwrite folder from a previous version, use the banner on this page to import it.
          </li>
          <li>
            <span className="font-semibold text-white">Check out Help</span> — use the help page
            for guidance on workflows and features.
          </li>
        </ol>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default function WorkflowSelector() {
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem('arcwright-welcome-seen');
  });

  const dismissWelcome = () => {
    localStorage.setItem('arcwright-welcome-seen', '1');
    setShowWelcome(false);
  };

  return (
    <div>
      {showWelcome && <WelcomeModal onClose={dismissWelcome} />}

      {/* Hero splash with background image */}
      <div className="relative rounded-2xl overflow-hidden mb-10 -mt-2">
        <img
          src="/mascot.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative py-24" />
      </div>

      <SetupBanner />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <Link
          to="/scaffold"
          className="group bg-white/10 backdrop-blur rounded-xl p-8 border border-purple-500/30 hover:border-purple-400 hover:bg-white/15 transition-all"
        >
          <div className="text-3xl mb-4">&#x1F3D7;&#xFE0F;</div>
          <h2 className="text-2xl font-bold mb-3 group-hover:text-purple-300 transition-colors">
            Story Scaffolding
          </h2>
          <p className="text-purple-200 text-sm leading-relaxed mb-4">
            Build a new story's dimensional arc from scratch or start from a genre template.
            Set dimension values at each story beat and watch your narrative take shape in real time.
          </p>
          <ul className="text-xs text-purple-300 space-y-1">
            <li>+ Genre-specific beat templates</li>
            <li>+ Interactive dimension sliders per beat</li>
            <li>+ Live chart visualization</li>
            <li>+ Genre requirement validation</li>
            <li>+ Export/import scaffolds</li>
          </ul>
        </Link>

        <Link
          to="/analyze"
          className="group bg-white/10 backdrop-blur rounded-xl p-8 border border-purple-500/30 hover:border-purple-400 hover:bg-white/15 transition-all"
        >
          <div className="text-3xl mb-4">&#x1F50D;</div>
          <h2 className="text-2xl font-bold mb-3 group-hover:text-purple-300 transition-colors">
            Reverse Engineer & Diagnose
          </h2>
          <p className="text-purple-200 text-sm leading-relaxed mb-4">
            Analyze an existing book chapter-by-chapter. AI scores the narrative dimensions,
            you refine, then compare against genre ideals with a full editorial get-well plan.
          </p>
          <ul className="text-xs text-purple-300 space-y-1">
            <li>+ AI-assisted dimension scoring (via OpenRouter)</li>
            <li>+ Manual score adjustment</li>
            <li>+ Actual vs ideal comparison overlay</li>
            <li>+ Beat-by-beat editorial recommendations</li>
            <li>+ Exportable get-well plan</li>
          </ul>
        </Link>

        <Link
          to="/edit"
          className="group bg-white/10 backdrop-blur rounded-xl p-8 border border-purple-500/30 hover:border-purple-400 hover:bg-white/15 transition-all"
        >
          <div className="text-3xl mb-4">&#x270F;&#xFE0F;</div>
          <h2 className="text-2xl font-bold mb-3 group-hover:text-purple-300 transition-colors">
            Edit
          </h2>
          <p className="text-purple-200 text-sm leading-relaxed mb-4">
            Write and edit your manuscript in markdown. Browse local files, use AI chat for
            writing assistance, and view chapter variables alongside your text.
          </p>
          <ul className="text-xs text-purple-300 space-y-1">
            <li>+ Markdown source editing with formatting bar</li>
            <li>+ Local file browser (open folders)</li>
            <li>+ AI chat panel for writing help</li>
            <li>+ Dual-pane mode for side-by-side editing</li>
            <li>+ Chapter variable reference panel</li>
          </ul>
        </Link>
      </div>
    </div>
  );
}
