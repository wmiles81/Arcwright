import React, { useState, useEffect, useCallback } from 'react';
import useSequenceStore from '../../store/useSequenceStore';
import usePromptStore from '../../store/usePromptStore';
import { ACTION_HANDLERS } from '../../chat/actionExecutor';
import useChatStore from '../../store/useChatStore';

export default function SequencesPanel() {
  const customSequences = useSequenceStore((s) => s.customSequences);
  const runningSequence = useSequenceStore((s) => s.runningSequence);
  const isLoaded = useSequenceStore((s) => s.isLoaded);

  const [view, setView] = useState(() =>
    useSequenceStore.getState().runningSequence ? 'running' : 'list'
  );
  const [editTarget, setEditTarget] = useState(null); // null = new, string = id

  // Snapshot of last running state — persists after runningSequence clears so panel can show final state
  const [snapshotRun, setSnapshotRun] = useState(null);

  useEffect(() => {
    if (runningSequence) {
      setSnapshotRun(runningSequence);
      setView('running');
    }
  }, [runningSequence]);

  const handleNewSequence = () => {
    setEditTarget(null);
    setView('edit');
  };

  const handleEditSequence = (seq) => {
    setEditTarget(seq.id);
    setView('edit');
  };

  const handleDeleteSequence = async (id) => {
    if (!window.confirm('Delete this sequence?')) return;
    await useSequenceStore.getState().deleteSequence(id);
  };

  const handleRunSequence = async (seq) => {
    useChatStore.getState().addMessage({
      id: `seq_trigger_${Date.now()}`,
      role: 'user',
      content: `/run "${seq.name}"`,
      timestamp: Date.now(),
    });
    try {
      await ACTION_HANDLERS.runNamedSequence({ sequenceId: seq.id });
    } catch (e) {
      useChatStore.getState().addMessage({
        id: `seq_err_${Date.now()}`,
        role: 'assistant',
        content: `Error running "${seq.name}": ${e.message}`,
        timestamp: Date.now(),
      });
      useSequenceStore.getState().clearRunningSequence();
    }
  };

  const handleSave = async (draft) => {
    if (editTarget) {
      await useSequenceStore.getState().updateSequence({ ...draft, id: editTarget });
    } else {
      await useSequenceStore.getState().createSequence(draft);
    }
    setView('list');
  };

  const displayRun = runningSequence || snapshotRun;
  const isRunning = !!runningSequence;

  if (view === 'running') {
    return (
      <RunningView
        running={displayRun}
        isRunning={isRunning}
        onBack={() => { setSnapshotRun(null); setView('list'); }}
      />
    );
  }

  if (view === 'edit') {
    const editSeq = editTarget ? customSequences.find((s) => s.id === editTarget) : null;
    const initialDraft = editSeq
      ? { name: editSeq.name, description: editSeq.description || '', steps: editSeq.steps ? [...editSeq.steps] : [] }
      : { name: '', description: '', steps: [] };
    return (
      <EditView
        key={editTarget || 'new'}
        initialDraft={initialDraft}
        isNew={!editTarget}
        onSave={handleSave}
        onCancel={() => setView('list')}
      />
    );
  }

  // List view
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-black/10 shrink-0 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase">Sequences</span>
        <button
          onClick={handleNewSequence}
          className="text-[11px] px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium transition-colors"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!isLoaded && (
          <p className="text-xs text-gray-400 p-4 text-center">Loading…</p>
        )}
        {isLoaded && customSequences.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400 mb-3">No sequences yet.</p>
            <p className="text-[11px] text-gray-400">
              Create a sequence to build a reusable pipeline of prompt steps.
            </p>
          </div>
        )}
        {customSequences.map((seq) => (
          <div key={seq.id} className="border-b border-black/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-black truncate">{seq.name}</div>
                {seq.description && (
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">{seq.description}</div>
                )}
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {seq.steps?.length || 0} step{(seq.steps?.length || 0) !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRunSequence(seq)}
                  disabled={isRunning}
                  className="text-[10px] px-1.5 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-40 transition-colors"
                  title="Run sequence"
                >
                  ▶
                </button>
                <button
                  onClick={() => handleEditSequence(seq)}
                  className="text-[10px] px-1.5 py-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                  title="Edit"
                >
                  ✏
                </button>
                <button
                  onClick={() => handleDeleteSequence(seq.id)}
                  className="text-[10px] px-1.5 py-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Running View ─────────────────────────────────────────────────────────────

function RunningView({ running, isRunning, onBack }) {
  if (!running) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <p className="text-xs text-gray-400 mb-3">No sequence running.</p>
        <button onClick={onBack} className="text-xs text-purple-600 underline">Back to list</button>
      </div>
    );
  }

  const doneCount = running.steps.filter((s) => s.status === 'done').length;
  const errorCount = running.steps.filter((s) => s.status === 'error').length;
  const allDone = !isRunning && doneCount + errorCount === running.totalSteps;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-black/10 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-black truncate">{running.sequenceName}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {isRunning
                ? `Step ${running.currentStep} of ${running.totalSteps}…`
                : allDone
                  ? errorCount > 0 ? `Finished with ${errorCount} error${errorCount !== 1 ? 's' : ''}` : 'Complete'
                  : `${doneCount}/${running.totalSteps} done`
              }
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onBack}
              className="text-[10px] text-purple-600 hover:text-purple-800 underline shrink-0"
            >
              Back
            </button>
          )}
        </div>
        {isRunning && (
          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${Math.round((running.currentStep / running.totalSteps) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {running.steps.map((step, i) => {
          const stepType = step.type || 'action';
          return (
            <div key={step.id || i}>
              {/* Main step row */}
              <div className={`flex items-start gap-2 p-2 rounded text-xs ${step.status === 'running' ? 'bg-purple-50' : 'bg-gray-50'}`}>
                <StatusDot status={step.status} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-black truncate">
                    {step.label}
                    {stepType === 'loop' && step.status !== 'pending' && (
                      <span className="text-gray-400 font-normal ml-1">
                        (iteration {step.currentIteration}/{step.totalIterations ?? '?'})
                      </span>
                    )}
                  </div>
                  {/* Action: file + word count */}
                  {stepType === 'action' && step.outputFile && (
                    <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{step.outputFile}</div>
                  )}
                  {stepType === 'action' && step.status === 'done' && step.wordCount > 0 && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{step.wordCount.toLocaleString()} words</div>
                  )}
                  {/* Condition: decision */}
                  {stepType === 'condition' && step.decision && (
                    <div className="text-[10px] text-gray-500 mt-0.5">{step.decision}</div>
                  )}
                </div>
              </div>
              {/* Loop: iteration sub-rows */}
              {stepType === 'loop' && step.iterations && step.iterations.length > 0 && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {step.iterations.map((it, ii) => (
                    <div key={ii} className={`flex items-start gap-2 px-2 py-1 rounded text-[11px] ${it.status === 'running' ? 'bg-purple-50/70' : 'bg-gray-50/70'}`}>
                      <StatusDot status={it.status} />
                      <div className="min-w-0 flex-1">
                        <span className="text-black">{it.label}</span>
                        {it.outputFile && <span className="text-gray-400 font-mono ml-1 text-[10px]">→ {it.outputFile}</span>}
                        {it.status === 'done' && it.wordCount > 0 && (
                          <span className="text-gray-400 ml-1 text-[10px]">({it.wordCount.toLocaleString()} words)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  if (status === 'running') {
    return (
      <span className="w-3 h-3 shrink-0 mt-0.5">
        <span className="block w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </span>
    );
  }
  if (status === 'done') return <span className="text-green-500 shrink-0 mt-0.5 text-[10px] leading-none">✓</span>;
  if (status === 'error') return <span className="text-red-500 shrink-0 mt-0.5 text-[10px] leading-none">✕</span>;
  // pending
  return <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0 mt-1" />;
}

// ── Edit View ─────────────────────────────────────────────────────────────────

function EditView({ initialDraft, isNew, onSave, onCancel }) {
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [allPrompts] = useState(() => usePromptStore.getState().getAllPrompts());

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const updateStep = useCallback((idx, updates) => {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === idx ? { ...s, ...updates } : s)),
    }));
  }, []);

  const addStep = useCallback(() => {
    const newStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: '',
      promptRef: '',
      template: '',
      outputFile: '',
      chain: false,
      modelOverride: '',
    };
    setDraft((d) => ({ ...d, steps: [...d.steps, newStep] }));
  }, []);

  const removeStep = useCallback((idx) => {
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== idx) }));
  }, []);

  const moveStep = useCallback((idx, dir) => {
    setDraft((d) => {
      const newSteps = [...d.steps];
      const target = idx + dir;
      if (target < 0 || target >= newSteps.length) return d;
      [newSteps[idx], newSteps[target]] = [newSteps[target], newSteps[idx]];
      return { ...d, steps: newSteps };
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-black/10 shrink-0 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase">
          {isNew ? 'New Sequence' : 'Edit Sequence'}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onCancel}
            className="text-[11px] px-2 py-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!draft.name.trim() || saving}
            className="text-[11px] px-2 py-1 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name *</label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="My Sequence"
            autoComplete="off"
            spellCheck={false}
            className="w-full text-xs text-black bg-white px-2 py-1.5 border border-black/20 rounded focus:outline-none focus:border-black/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description</label>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional description"
            autoComplete="off"
            spellCheck={false}
            className="w-full text-xs text-black bg-white px-2 py-1.5 border border-black/20 rounded focus:outline-none focus:border-black/50"
          />
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Steps</label>
            <button
              onClick={addStep}
              className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              + Add Step
            </button>
          </div>

          {draft.steps.length === 0 && (
            <p className="text-[11px] text-gray-400 text-center py-3">No steps yet. Add a step to get started.</p>
          )}

          <div className="space-y-3">
            {draft.steps.map((step, idx) => (
              <StepEditor
                key={step.id}
                step={step}
                idx={idx}
                total={draft.steps.length}
                allPrompts={allPrompts}
                onChange={(updates) => updateStep(idx, updates)}
                onRemove={() => removeStep(idx)}
                onMoveUp={() => moveStep(idx, -1)}
                onMoveDown={() => moveStep(idx, 1)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step Editor ───────────────────────────────────────────────────────────────

function makeBodyStep() {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    type: 'action',
    promptRef: '',
    template: '',
    outputFile: '',
    chain: false,
    modelOverride: '',
  };
}

// depth: 0 = top-level, 1 = inside loop body (no nested loops)
function StepEditor({ step, idx, total, allPrompts, onChange, onRemove, onMoveUp, onMoveDown, depth = 0 }) {
  const type = step.type || 'action';
  const sourceMode = step.promptRef ? 'prompt' : 'inline';
  const [showAdvanced, setShowAdvanced] = useState(false);
  const loopCountMode = step.exitTemplate != null ? 'exit' : 'fixed';

  const setType = (newType) => {
    if (newType === 'action') {
      onChange({ type: 'action', promptRef: '', template: '', outputFile: '', chain: false, modelOverride: '' });
    } else if (newType === 'loop') {
      onChange({ type: 'loop', count: 3, exitTemplate: null, maxIterations: 20, steps: [], chain: false });
    } else if (newType === 'condition') {
      onChange({ type: 'condition', template: '', ifYes: 'continue', ifNo: 'end', maxRetries: 3 });
    }
  };

  return (
    <div className={`border border-black/10 rounded-lg p-2.5 space-y-2 ${depth === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
      {/* Step header: number + name + reorder + delete */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-gray-400 shrink-0 w-4">{idx + 1}.</span>
        <input
          type="text"
          value={step.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={`Step ${idx + 1} label`}
          className="flex-1 min-w-0 text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white"
        />
        <button onClick={onMoveUp} disabled={idx === 0}
          className="text-gray-400 hover:text-black disabled:opacity-20 text-xs px-1 transition-colors" title="Move up">↑</button>
        <button onClick={onMoveDown} disabled={idx === total - 1}
          className="text-gray-400 hover:text-black disabled:opacity-20 text-xs px-1 transition-colors" title="Move down">↓</button>
        <button onClick={onRemove}
          className="text-gray-400 hover:text-red-500 text-xs px-1 transition-colors" title="Remove step">✕</button>
      </div>

      {/* Type selector */}
      <div className="flex rounded overflow-hidden border border-black/10 text-[10px] font-medium">
        {['action', ...(depth === 0 ? ['loop'] : []), 'condition'].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-1 capitalize transition-colors ${type === t ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Action content ── */}
      {type === 'action' && (<>
        {/* Source mode toggle */}
        <div className="flex rounded overflow-hidden border border-black/10 text-[10px] font-medium">
          <button
            onClick={() => onChange({ promptRef: '', template: step.template })}
            className={`flex-1 py-1 transition-colors ${sourceMode === 'inline' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >Inline</button>
          <button
            onClick={() => onChange({ promptRef: allPrompts[0]?.id || '', template: '' })}
            className={`flex-1 py-1 transition-colors ${sourceMode === 'prompt' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >Prompt Tool</button>
        </div>

        {sourceMode === 'inline' && (
          <textarea
            value={step.template || ''}
            onChange={(e) => onChange({ template: e.target.value })}
            placeholder={"Enter template… Use {{variable}}, {{loop_index}}, {{loop_count}}"}
            rows={3}
            className="w-full text-xs text-black px-2 py-1.5 border border-black/15 rounded focus:outline-none focus:border-black/40 resize-none bg-white font-mono"
          />
        )}
        {sourceMode === 'prompt' && (
          <select
            value={step.promptRef || ''}
            onChange={(e) => onChange({ promptRef: e.target.value })}
            className="w-full text-xs text-black px-2 py-1.5 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white"
          >
            <option value="">— Select a Prompt Tool —</option>
            {allPrompts.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.title || p.id}</option>
            ))}
          </select>
        )}

        <div>
          <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
            Output File (optional) — use ## for loop index
          </label>
          <input
            type="text"
            value={step.outputFile || ''}
            onChange={(e) => onChange({ outputFile: e.target.value })}
            placeholder="chapters/Chapter_##.md"
            className="w-full text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 font-mono bg-white"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!step.chain} onChange={(e) => onChange({ chain: e.target.checked })} className="w-3 h-3 rounded" />
          <span className="text-[11px] text-gray-600">Pass output to next step <span className="text-gray-400">(chain)</span></span>
        </label>

        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
          {showAdvanced ? '▲ Less' : '▼ More'}
        </button>
        {showAdvanced && (
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Model Override</label>
            <input
              type="text"
              value={step.modelOverride || ''}
              onChange={(e) => onChange({ modelOverride: e.target.value })}
              placeholder="e.g. anthropic/claude-haiku-4-5"
              className="w-full text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 font-mono bg-white"
            />
          </div>
        )}
      </>)}

      {/* ── Loop content ── */}
      {type === 'loop' && (<>
        {/* Count mode toggle */}
        <div className="flex rounded overflow-hidden border border-black/10 text-[10px] font-medium">
          <button
            onClick={() => onChange({ exitTemplate: null, count: step.count ?? 3 })}
            className={`flex-1 py-1 transition-colors ${loopCountMode === 'fixed' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >Fixed Count</button>
          <button
            onClick={() => onChange({ exitTemplate: '', count: null })}
            className={`flex-1 py-1 transition-colors ${loopCountMode === 'exit' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >Exit Condition</button>
        </div>

        {loopCountMode === 'fixed' && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Repeat</label>
            <input
              type="number"
              min={1} max={100}
              value={step.count ?? 3}
              onChange={(e) => onChange({ count: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-16 text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white text-center"
            />
            <span className="text-[10px] text-gray-400">times</span>
          </div>
        )}

        {loopCountMode === 'exit' && (<>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
              Exit Condition — LLM answers CONTINUE or STOP
            </label>
            <textarea
              value={step.exitTemplate || ''}
              onChange={(e) => onChange({ exitTemplate: e.target.value })}
              placeholder={"Should I continue? Use {{chained_context}} for last output. Answer CONTINUE or STOP."}
              rows={2}
              className="w-full text-xs text-black px-2 py-1.5 border border-black/15 rounded focus:outline-none focus:border-black/40 resize-none bg-white font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Max iterations</label>
            <input
              type="number"
              min={1} max={100}
              value={step.maxIterations ?? 20}
              onChange={(e) => onChange({ maxIterations: Math.max(1, parseInt(e.target.value) || 20) })}
              className="w-16 text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white text-center"
            />
          </div>
        </>)}

        {/* Loop body steps */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[9px] font-bold text-gray-400 uppercase">Body Steps</label>
            <button
              onClick={() => {
                const body = step.steps ? [...step.steps, makeBodyStep()] : [makeBodyStep()];
                onChange({ steps: body });
              }}
              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >+ Add</button>
          </div>
          {(!step.steps || step.steps.length === 0) && (
            <p className="text-[10px] text-gray-400 text-center py-2">No body steps. Add at least one action step.</p>
          )}
          <div className="space-y-2">
            {(step.steps || []).map((bodyStep, bi) => (
              <StepEditor
                key={bodyStep.id}
                step={bodyStep}
                idx={bi}
                total={(step.steps || []).length}
                allPrompts={allPrompts}
                depth={1}
                onChange={(updates) => {
                  const body = (step.steps || []).map((s, ii) => ii === bi ? { ...s, ...updates } : s);
                  onChange({ steps: body });
                }}
                onRemove={() => {
                  onChange({ steps: (step.steps || []).filter((_, ii) => ii !== bi) });
                }}
                onMoveUp={() => {
                  const body = [...(step.steps || [])];
                  if (bi > 0) { [body[bi - 1], body[bi]] = [body[bi], body[bi - 1]]; onChange({ steps: body }); }
                }}
                onMoveDown={() => {
                  const body = [...(step.steps || [])];
                  if (bi < body.length - 1) { [body[bi], body[bi + 1]] = [body[bi + 1], body[bi]]; onChange({ steps: body }); }
                }}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!step.chain} onChange={(e) => onChange({ chain: e.target.checked })} className="w-3 h-3 rounded" />
          <span className="text-[11px] text-gray-600">Pass last iteration to next step <span className="text-gray-400">(chain)</span></span>
        </label>
      </>)}

      {/* ── Condition content ── */}
      {type === 'condition' && (<>
        <div>
          <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
            Question — LLM answers YES or NO
          </label>
          <textarea
            value={step.template || ''}
            onChange={(e) => onChange({ template: e.target.value })}
            placeholder={"Is the output satisfactory? Use {{chained_context}} for prior output."}
            rows={3}
            className="w-full text-xs text-black px-2 py-1.5 border border-black/15 rounded focus:outline-none focus:border-black/40 resize-none bg-white font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">If YES</label>
            <select
              value={step.ifYes || 'continue'}
              onChange={(e) => onChange({ ifYes: e.target.value })}
              className="w-full text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white"
            >
              <option value="continue">Continue</option>
              <option value="end">End sequence</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">If NO</label>
            <select
              value={step.ifNo || 'end'}
              onChange={(e) => onChange({ ifNo: e.target.value })}
              className="w-full text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white"
            >
              <option value="continue">Continue</option>
              <option value="end">End sequence</option>
              <option value="retry">Retry previous step</option>
            </select>
          </div>
        </div>
        {(step.ifNo || 'end') === 'retry' && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Max retries</label>
            <input
              type="number"
              min={1} max={10}
              value={step.maxRetries ?? 3}
              onChange={(e) => onChange({ maxRetries: Math.max(1, parseInt(e.target.value) || 3) })}
              className="w-12 text-xs text-black px-1.5 py-1 border border-black/15 rounded focus:outline-none focus:border-black/40 bg-white text-center"
            />
          </div>
        )}
      </>)}
    </div>
  );
}
