import React, { useState, useEffect, useCallback, useRef } from 'react';
import useAppStore from '../../store/useAppStore';
import useSeriesStore from '../../store/useSeriesStore';
import useProjectStore from '../../store/useProjectStore';
import { genreSystem } from '../../data/genreSystem';
import { callCompletionSync } from '../../api/providerAdapter';
import { createSeriesFolder, ensureDir } from '../../services/arcwriteFS';

const SERIES_TYPES = [
    { key: 'trilogy', label: 'Trilogy', desc: '3-book arc' },
    { key: 'saga', label: 'Saga', desc: '5–7 books' },
    { key: 'continuing', label: 'Continuing', desc: 'Open-ended' },
    { key: 'common_world', label: 'Common World', desc: 'Shared world' },
];

const WORD_DEFAULTS = {
    romance: 70000,
    scienceFiction: 90000,
    fantasy: 100000,
    mysteryThrillerSuspense: 80000,
    womensFiction: 85000,
    sonataForm: 90000,
};

const CHAPTER_DEFAULTS = {
    romance: 24,
    scienceFiction: 28,
    fantasy: 30,
    mysteryThrillerSuspense: 26,
    womensFiction: 24,
    sonataForm: 28,
};

const STEP_LABELS = [
    'Series Name',
    'Parameters',
    'Market Survey',
    'Viability',
    'Series Premises',
];

// ── Prompt templates ──

function buildMarketSurveyPrompt(genre, subgenre, seriesType, bookCount) {
    const genreName = genreSystem[genre]?.name || genre;
    const subgenreName = genreSystem[genre]?.subgenres?.[subgenre]?.name || subgenre;
    const typeLabel = SERIES_TYPES.find(t => t.key === seriesType)?.label || seriesType;

    return `You are a publishing market analyst. Provide a concise market survey for a planned book series.

Series parameters:
- Genre: ${genreName}
- Subgenre: ${subgenreName}
- Series type: ${typeLabel} (${bookCount} book${bookCount > 1 ? 's' : ''})

Provide your analysis in these sections (use markdown headers):

## Comparable Titles
List 5–8 recent successful series (last 5 years preferred) in this genre/subgenre. For each: title, author, approximate sales category (bestseller/strong mid-list/breakout), and what made it successful.

## Market Trends
3–5 current trends in this genre. What's hot, what's fading, what's emerging.

## Reader Expectations
What readers in this subgenre specifically want: tropes, tone, heat level norms, pacing expectations, series length preferences.

## Market Assessment
- Demand level (high/medium/low) with reasoning
- Competition density
- Opportunity gaps — what's underserved
- Recommended positioning strategy

## Viability Score
Rate 1–10 with a one-sentence justification.

Be specific, data-informed, and honest. If the market is saturated, say so. If there's a clear opportunity, highlight it.`;
}

function buildPremisesPrompt(genre, subgenre, seriesType, bookCount, marketSurvey) {
    const genreName = genreSystem[genre]?.name || genre;
    const subgenreName = genreSystem[genre]?.subgenres?.[subgenre]?.name || subgenre;
    const typeLabel = SERIES_TYPES.find(t => t.key === seriesType)?.label || seriesType;

    return `You are a creative series architect. Generate 10 high-concept series premises for a planned book series.

Series parameters:
- Genre: ${genreName}
- Subgenre: ${subgenreName}
- Series type: ${typeLabel} (${bookCount} book${bookCount > 1 ? 's' : ''})

Market context (use this to inform your premises — lean into opportunities, avoid saturated angles):
${marketSurvey}

Generate exactly 10 series-level premises. These are SERIES arcs (the overarching story/world/concept that spans all books), NOT individual book plots.

For each premise, provide:
1. A compelling series title (working title)
2. A 2–3 sentence high-concept pitch that captures the series hook, the central tension, and what makes it fresh
3. A one-line "series engine" — the repeatable mechanism that drives each book (e.g., "Each book follows a different couple in the same small town" or "Each book escalates the stakes of the central conspiracy")

Format each as:

### [Number]. [Series Title]
[2–3 sentence pitch]

**Series Engine:** [one-line mechanism]

---

Make the premises diverse: vary the hooks, settings, character dynamics, and tonal register. At least 2 should be high-concept/unique, at least 2 should be market-proven/commercial, and the rest should balance between.`;
}

// ── Main Component ──

/** Write a markdown file to the series folder. */
async function writeSeriesFile(seriesName, filename, content) {
    const arcwriteHandle = useProjectStore.getState().arcwriteHandle;
    if (!arcwriteHandle) return;
    try {
        const seriesDir = await ensureDir(arcwriteHandle, 'projects', 'series', seriesName);
        const fh = await seriesDir.getFileHandle(filename, { create: true });
        const writable = await fh.createWritable();
        await writable.write(content);
        await writable.close();
        console.log(`[Wizard] Wrote ${filename} to series folder`);
    } catch (err) {
        console.warn(`[Wizard] Failed to write ${filename}:`, err.message);
    }
}

export default function NewSeriesWizard({ isOpen, onClose, colors: c, isDark }) {
    // --- State ---
    const [step, setStep] = useState(0);

    // Step 1
    const [seriesName, setSeriesName] = useState('');

    // Step 2
    const [bookCount, setBookCount] = useState(3);
    const [seriesType, setSeriesType] = useState('trilogy');
    const [wordsPerBook, setWordsPerBook] = useState(70000);
    const [chaptersPerBook, setChaptersPerBook] = useState(24);

    // Step 3/4
    const [marketSurvey, setMarketSurvey] = useState('');
    const [isLoadingMarket, setIsLoadingMarket] = useState(false);
    const [marketError, setMarketError] = useState('');

    // Step 5
    const [premises, setPremises] = useState('');
    const [isLoadingPremises, setIsLoadingPremises] = useState(false);
    const [premisesError, setPremisesError] = useState('');
    const [selectedPremise, setSelectedPremise] = useState(null);

    // Created series ID
    const [createdSeriesId, setCreatedSeriesId] = useState(null);

    // Scaffold state
    const selectedGenre = useAppStore((s) => s.selectedGenre);
    const selectedSubgenre = useAppStore((s) => s.selectedSubgenre);
    const createSeries = useSeriesStore((s) => s.createSeries);
    const updateActiveSeries = useSeriesStore((s) => s.updateActiveSeries);

    const abortRef = useRef(null);

    // Genre-aware defaults
    useEffect(() => {
        if (selectedGenre) {
            setWordsPerBook(WORD_DEFAULTS[selectedGenre] || 80000);
            setChaptersPerBook(CHAPTER_DEFAULTS[selectedGenre] || 25);
        }
    }, [selectedGenre]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setStep(0);
            setSeriesName('');
            setBookCount(3);
            setSeriesType('trilogy');
            setMarketSurvey('');
            setMarketError('');
            setPremises('');
            setPremisesError('');
            setSelectedPremise(null);
            setCreatedSeriesId(null);
            setIsLoadingMarket(false);
            setIsLoadingPremises(false);
        }
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [isOpen]);

    // --- Handlers ---

    const handleStep1Next = useCallback(async () => {
        if (!seriesName.trim()) return;
        // Ensure database is initialized before creating
        try {
            const { initDatabase } = await import('../../services/database');
            const dbInstance = await initDatabase();
            if (!dbInstance) {
                alert('Database could not be initialized. Check browser console for details.');
                return;
            }
            const id = createSeries({ name: seriesName.trim(), type: seriesType });
            setCreatedSeriesId(id);

            // Create filesystem folder: projects/series/<name>/
            const arcwriteHandle = useProjectStore.getState().arcwriteHandle;
            if (arcwriteHandle) {
                try {
                    await createSeriesFolder(arcwriteHandle, seriesName.trim());
                    console.log('[Wizard] Created series folder:', seriesName.trim());
                } catch (fsErr) {
                    console.warn('[Wizard] Could not create series folder:', fsErr.message);
                }
            }

            setStep(1);
        } catch (err) {
            alert('Failed to create series: ' + err.message);
        }
    }, [seriesName, seriesType, createSeries]);

    const handleStep2Next = useCallback(async () => {
        // Save metadata to series
        if (createdSeriesId) {
            const meta = { bookCount, wordsPerBook, chaptersPerBook, genre: selectedGenre, subgenre: selectedSubgenre };
            updateActiveSeries({ type: seriesType, notes: JSON.stringify(meta) });
        }
        setStep(2);

        // Start market survey
        setIsLoadingMarket(true);
        setMarketError('');
        setMarketSurvey('');

        try {
            const prompt = buildMarketSurveyPrompt(selectedGenre, selectedSubgenre, seriesType, bookCount);
            const result = await callCompletionSync(
                'You are a publishing market analyst with deep expertise in genre fiction markets.',
                prompt,
                { maxTokens: 4000 }
            );
            setMarketSurvey(result);
            setStep(3); // auto-advance to viability
        } catch (err) {
            setMarketError(err.message || 'Market survey failed.');
        } finally {
            setIsLoadingMarket(false);
        }
    }, [createdSeriesId, bookCount, wordsPerBook, chaptersPerBook, seriesType, selectedGenre, selectedSubgenre, updateActiveSeries]);

    const handleAcceptMarket = useCallback(async () => {
        // Save market survey to DB + filesystem
        if (createdSeriesId) {
            try {
                const existingNotes = useSeriesStore.getState().activeSeries?.notes || '{}';
                const meta = typeof existingNotes === 'string' ? JSON.parse(existingNotes) : existingNotes;
                meta.marketResearch = marketSurvey;
                updateActiveSeries({ notes: JSON.stringify(meta) });
            } catch { /* best effort */ }
        }

        // Write market-survey.md to series folder
        await writeSeriesFile(seriesName.trim(), 'market-survey.md',
            `# Market Survey: ${seriesName.trim()}\n\n${marketSurvey}`);

        setStep(4);

        // Generate premises
        setIsLoadingPremises(true);
        setPremisesError('');
        setPremises('');

        try {
            const prompt = buildPremisesPrompt(selectedGenre, selectedSubgenre, seriesType, bookCount, marketSurvey);
            const result = await callCompletionSync(
                'You are a creative fiction series architect specializing in commercial genre fiction.',
                prompt,
                { maxTokens: 6000 }
            );
            setPremises(result);
        } catch (err) {
            setPremisesError(err.message || 'Premise generation failed.');
        } finally {
            setIsLoadingPremises(false);
        }
    }, [createdSeriesId, marketSurvey, seriesName, selectedGenre, selectedSubgenre, seriesType, bookCount, updateActiveSeries]);

    const handleSelectPremise = useCallback((premiseIndex) => {
        setSelectedPremise(premiseIndex === selectedPremise ? null : premiseIndex);
    }, [selectedPremise]);

    const handleFinish = useCallback(async () => {
        // Save selected premise to DB
        if (createdSeriesId) {
            try {
                const existingNotes = useSeriesStore.getState().activeSeries?.notes || '{}';
                const meta = typeof existingNotes === 'string' ? JSON.parse(existingNotes) : existingNotes;
                if (selectedPremise !== null) meta.selectedPremise = selectedPremise;
                meta.premises = premises;
                updateActiveSeries({ notes: JSON.stringify(meta) });
            } catch { /* best effort */ }
        }

        // Write premises.md to series folder
        if (premises) {
            const header = selectedPremise !== null
                ? `# Series Premises: ${seriesName.trim()}\n\n> **Selected premise:** #${selectedPremise + 1}\n\n`
                : `# Series Premises: ${seriesName.trim()}\n\n`;
            await writeSeriesFile(seriesName.trim(), 'premises.md', header + premises);
        }

        onClose();
    }, [createdSeriesId, selectedPremise, premises, seriesName, updateActiveSeries, onClose]);

    // --- Render ---

    if (!isOpen) return null;

    const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const inputBorder = c.chromeBorder;
    const genreName = genreSystem[selectedGenre]?.name || selectedGenre;
    const subgenreName = genreSystem[selectedGenre]?.subgenres?.[selectedSubgenre]?.name || selectedSubgenre;

    const inputStyle = {
        background: inputBg,
        border: `1px solid ${inputBorder}`,
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 13,
        color: c.text,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    };

    const labelStyle = {
        fontSize: 11,
        fontWeight: 600,
        color: c.chromeText,
        marginBottom: 4,
        display: 'block',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    };

    const btnPrimary = {
        background: '#7C3AED',
        color: '#fff',
        border: 'none',
        padding: '8px 20px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
    };

    const btnSecondary = {
        background: 'transparent',
        color: c.chromeText,
        border: `1px solid ${inputBorder}`,
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
    };

    // --- Parse premises into cards ---
    const premiseCards = premises
        ? premises.split(/###\s+/).filter(Boolean).map((block, i) => {
            const lines = block.trim().split('\n');
            const title = lines[0]?.replace(/^\d+\.\s*/, '').trim() || `Premise ${i + 1}`;
            const rest = lines.slice(1).join('\n').trim();
            return { title, body: rest, index: i };
        })
        : [];

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    background: c.chrome,
                    color: c.text,
                    border: `1px solid ${c.chromeBorder}`,
                    borderRadius: 12,
                    width: 680,
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
                }}
            >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.chromeBorder}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>✨</span> New Series Wizard
                        </h2>
                        <button
                            onClick={onClose}
                            style={{ color: c.chromeText, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                        >
                            ✕
                        </button>
                    </div>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: 0, marginTop: 12 }}>
                        {STEP_LABELS.map((label, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    padding: '6px 4px',
                                    fontSize: 10,
                                    fontWeight: i === step ? 700 : 500,
                                    color: i === step ? '#7C3AED' : i < step ? '#10B981' : c.chromeText,
                                    borderBottom: i === step ? '2px solid #7C3AED' : i < step ? '2px solid #10B981' : `2px solid ${inputBorder}`,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {i < step ? '✓ ' : ''}{label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 200 }}>

                    {/* Step 1: Series Name */}
                    {step === 0 && (
                        <div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={labelStyle}>Series Working Title</label>
                                <input
                                    type="text"
                                    value={seriesName}
                                    onChange={(e) => setSeriesName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleStep1Next(); }}
                                    placeholder="Enter a working title for your series..."
                                    style={inputStyle}
                                    autoFocus
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: isDark ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.06)', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.12)'}` }}>
                                <span style={{ fontSize: 14 }}>📚</span>
                                <div>
                                    <div style={{ fontSize: 11, color: c.chromeText }}>From Scaffold</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{genreName} → {subgenreName}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Global Parameters */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Series Type</label>
                                <select
                                    value={seriesType}
                                    onChange={(e) => setSeriesType(e.target.value)}
                                    style={{ ...inputStyle, cursor: 'pointer' }}
                                >
                                    {SERIES_TYPES.map((t) => (
                                        <option key={t.key} value={t.key}>{t.label} — {t.desc}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>Number of Books</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={bookCount}
                                        onChange={(e) => setBookCount(Number(e.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Words per Book</label>
                                    <input
                                        type="number"
                                        min={10000}
                                        max={200000}
                                        step={5000}
                                        value={wordsPerBook}
                                        onChange={(e) => setWordsPerBook(Number(e.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Chapters per Book</label>
                                    <input
                                        type="number"
                                        min={5}
                                        max={60}
                                        value={chaptersPerBook}
                                        onChange={(e) => setChaptersPerBook(Number(e.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                            <div style={{ padding: '8px 12px', background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)', borderRadius: 6, border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.12)'}`, fontSize: 11, color: c.chromeText }}>
                                Total series: ~{(bookCount * wordsPerBook).toLocaleString()} words across {bookCount} book{bookCount > 1 ? 's' : ''} ({chaptersPerBook} ch/book × ~{Math.round(wordsPerBook / chaptersPerBook).toLocaleString()} words/ch)
                            </div>
                        </div>
                    )}

                    {/* Step 2.5 / 3: Market Survey (loading or loaded) */}
                    {step === 2 && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 2s linear infinite' }}>📊</div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Running Market Survey...</div>
                            <div style={{ fontSize: 12, color: c.chromeText }}>
                                Analyzing the {genreName} / {subgenreName} market for a {SERIES_TYPES.find(t => t.key === seriesType)?.label} series
                            </div>
                            {marketError && (
                                <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#DC2626', fontSize: 12, textAlign: 'left' }}>
                                    <strong>Error:</strong> {marketError}
                                </div>
                            )}
                            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {/* Step 3: Viability / Market Results */}
                    {step === 3 && (
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                                📊 Market Survey Results
                            </div>
                            <div
                                style={{
                                    maxHeight: 360,
                                    overflowY: 'auto',
                                    padding: '12px 16px',
                                    background: inputBg,
                                    border: `1px solid ${inputBorder}`,
                                    borderRadius: 8,
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                }}
                            >
                                {marketSurvey}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Premises */}
                    {step === 4 && (
                        <div>
                            {isLoadingPremises ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Generating Series Premises...</div>
                                    <div style={{ fontSize: 12, color: c.chromeText }}>
                                        Creating 10 high-concept series premises tailored to your market
                                    </div>
                                </div>
                            ) : premisesError ? (
                                <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#DC2626', fontSize: 12 }}>
                                    <strong>Error:</strong> {premisesError}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                                        ✨ Select a Series Premise (optional)
                                    </div>
                                    {premiseCards.map((card) => (
                                        <div
                                            key={card.index}
                                            onClick={() => handleSelectPremise(card.index)}
                                            style={{
                                                padding: '10px 14px',
                                                background: selectedPremise === card.index
                                                    ? (isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.08)')
                                                    : inputBg,
                                                border: `1px solid ${selectedPremise === card.index ? '#7C3AED' : inputBorder}`,
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: selectedPremise === card.index ? '#7C3AED' : c.text }}>
                                                {card.title}
                                            </div>
                                            <div style={{ fontSize: 11, color: c.chromeText, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                                {card.body}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '12px 20px',
                        borderTop: `1px solid ${c.chromeBorder}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div>
                        {step > 0 && step !== 2 && (
                            <button
                                onClick={() => setStep(Math.max(0, step - 1))}
                                style={btnSecondary}
                                disabled={isLoadingMarket || isLoadingPremises}
                            >
                                ← Back
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} style={btnSecondary}>
                            Cancel
                        </button>
                        {step === 0 && (
                            <button
                                onClick={handleStep1Next}
                                disabled={!seriesName.trim()}
                                style={{ ...btnPrimary, opacity: seriesName.trim() ? 1 : 0.5, cursor: seriesName.trim() ? 'pointer' : 'not-allowed' }}
                            >
                                Next →
                            </button>
                        )}
                        {step === 1 && (
                            <button onClick={handleStep2Next} style={btnPrimary}>
                                Run Market Survey →
                            </button>
                        )}
                        {step === 2 && marketError && (
                            <button onClick={handleStep2Next} style={btnPrimary}>
                                Retry
                            </button>
                        )}
                        {step === 3 && (
                            <>
                                <button onClick={() => setStep(1)} style={btnSecondary}>
                                    Revise Parameters
                                </button>
                                <button onClick={handleAcceptMarket} style={btnPrimary}>
                                    Accept & Generate Premises →
                                </button>
                            </>
                        )}
                        {step === 4 && !isLoadingPremises && !premisesError && (
                            <>
                                <button
                                    onClick={() => {
                                        setIsLoadingPremises(true);
                                        setPremises('');
                                        setPremisesError('');
                                        setSelectedPremise(null);
                                        const prompt = buildPremisesPrompt(selectedGenre, selectedSubgenre, seriesType, bookCount, marketSurvey);
                                        callCompletionSync(
                                            'You are a creative fiction series architect specializing in commercial genre fiction.',
                                            prompt,
                                            { maxTokens: 6000 }
                                        ).then(r => setPremises(r))
                                            .catch(e => setPremisesError(e.message || 'Premise generation failed.'))
                                            .finally(() => setIsLoadingPremises(false));
                                    }}
                                    style={btnSecondary}
                                >
                                    🔄 Regenerate
                                </button>
                                <button onClick={handleFinish} style={btnPrimary}>
                                    {selectedPremise !== null ? 'Save & Close' : 'Close'}
                                </button>
                            </>
                        )}
                        {step === 4 && premisesError && (
                            <button onClick={handleAcceptMarket} style={btnPrimary}>
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
