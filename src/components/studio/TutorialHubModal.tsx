import { useEffect } from 'react';
import {
  CheckCircle2,
  Compass,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useGuide } from '../../context/GuideContext';
import { TUTORIAL_CHAPTERS, TUTORIAL_STEPS } from '../../data/helpCatalog';

export default function TutorialHubModal() {
  const {
    hubOpen,
    setHubOpen,
    helpHintsEnabled,
    toggleHelpHints,
    completedChapters,
    hasProgress,
    startFullTour,
    startAutoTour,
    resumeTour,
    startChapter,
  } = useGuide();

  useEffect(() => {
    if (!hubOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setHubOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hubOpen, setHubOpen]);

  if (!hubOpen) return null;

  const doneCount = completedChapters.length;

  return (
      <div
        onClick={() => setHubOpen(false)}
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/72 p-3 sm:p-4"
      >
      <div
        role="dialog"
        aria-label="Interactive Tutorial & Help Hub"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'rgba(7, 12, 26, 0.97)',
          borderColor: 'rgba(56, 189, 248, 0.42)',
          boxShadow:
            '0 28px 80px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(56, 189, 248, 0.2), 0 0 48px rgba(56, 189, 248, 0.14)',
        }}
        className="flex max-h-[90dvh] w-[760px] max-w-full flex-col overflow-hidden rounded-2xl border text-slate-100"
      >
        {/* Top Glowing Scanner Accent */}
        <div
          aria-hidden="true"
          className="h-1 w-full"
          style={{
            background: 'linear-gradient(90deg, #38bdf8, #a78bfa, #34d399, #fbbf24)',
          }}
        />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/15 text-sky-300">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-white">
                Interactive Studio Guide
              </h2>
              <p className="text-xs text-slate-300">
                Simple step-by-step spotlight tours across all 5 games &amp; every Studio setting
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHubOpen(false)}
            aria-label="Close guide hub"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Action Strip: Start Tour + Info Hints ("i") Mode Toggle */}
        <div className="grid gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3.5 sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2">
            {hasProgress && (
              <button
                type="button"
                onClick={resumeTour}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-sky-400 px-3.5 text-xs font-bold text-slate-950 shadow-md transition-transform hover:brightness-110 active:scale-95"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Resume Tour</span>
              </button>
            )}
            <button
              type="button"
              onClick={startFullTour}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-transform hover:brightness-110 active:scale-95 ${
                hasProgress
                  ? 'border border-sky-400/45 bg-sky-500/15 text-sky-200'
                  : 'bg-sky-400 text-slate-950 shadow-md'
              }`}
            >
              {hasProgress ? (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{hasProgress ? 'Restart Tour' : 'Start 12-Chapter Tour'}</span>
            </button>
            <button
              type="button"
              onClick={startAutoTour}
              title="Sit back! Runs the entire 12-chapter spotlight tutorial automatically step by step"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-200 transition-transform hover:bg-emerald-500/25 active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current text-emerald-300" aria-hidden="true" />
              <span>Auto-Play Hands-Free</span>
            </button>
          </div>

          {/* Pervasive Little "i" Badges Toggle Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/25 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sky-400/70 bg-sky-400/20 font-mono-num text-xs font-bold text-sky-200">
                i
              </span>
              <div>
                <div className="text-xs font-semibold text-white">
                  Little &ldquo;i&rdquo; Info Badges
                </div>
                <div className="text-[10.5px] text-slate-300">
                  Show friendly explanations next to every button &amp; setting
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleHelpHints}
              aria-pressed={helpHintsEnabled}
              className={`h-7 shrink-0 rounded-lg px-2.5 text-[11px] font-bold transition-colors ${
                helpHintsEnabled
                  ? 'bg-emerald-400 text-slate-950'
                  : 'border border-white/20 bg-white/8 text-slate-200 hover:bg-white/15'
              }`}
            >
              {helpHintsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* 12 Chapters Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Jump To Any Chapter
            </span>
            <span className="font-mono-num text-[11px] text-sky-300">
              {doneCount} / {TUTORIAL_CHAPTERS.length} Completed
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TUTORIAL_CHAPTERS.map((ch) => {
              const stepCount = TUTORIAL_STEPS.filter((s) => s.chapterId === ch.id).length;
              const isDone = completedChapters.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => startChapter(ch.id)}
                  style={{
                    borderColor: isDone ? 'rgba(52, 211, 153, 0.45)' : 'rgba(255, 255, 255, 0.12)',
                  }}
                  className="group flex flex-col justify-between gap-2 rounded-xl border bg-white/[0.04] p-3 text-left transition-all hover:border-sky-400/60 hover:bg-sky-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono-num text-[10px] font-bold"
                        style={{
                          backgroundColor: `${ch.accent}22`,
                          color: ch.accent,
                        }}
                      >
                        CH {ch.number}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono-num text-[10px] text-slate-400">
                          {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                        </span>
                        {isDone && (
                          <CheckCircle2
                            className="h-3.5 w-3.5 text-emerald-400"
                            aria-label="Completed"
                          />
                        )}
                      </div>
                    </div>
                    <h3 className="font-display mt-2 text-xs font-bold text-white group-hover:text-sky-200">
                      {ch.title}
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-slate-300">
                      {ch.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
