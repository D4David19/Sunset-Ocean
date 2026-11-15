import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  MousePointerClick,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { useGuide } from '../../context/GuideContext';
import { TUTORIAL_CHAPTERS, TUTORIAL_STEPS } from '../../data/helpCatalog';

interface TargetBox {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

const CUTOUT_PAD = 7;

export default function TutorialSpotlightOverlay() {
  const {
    tourActive,
    tourAutoPlay,
    toggleTourAutoPlay,
    tourAutoPlaySec,
    setTourAutoPlaySec,
    autoPlayRemainingSec,
    autoPlayProgress,
    activeStep,
    activeStepIndex,
    activeChapter,
    nextStep,
    prevStep,
    skipChapter,
    stopTour,
    setHubOpen,
  } = useGuide();

  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const advancingRef = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Continuously locate and track [data-tour-id="<step.targetId>"] cleanly
  useEffect(() => {
    if (!tourActive || !activeStep) {
      setTargetBox(null);
      return;
    }

    advancingRef.current = false;
    let disposed = false;
    let pollCount = 0;
    let ro: ResizeObserver | null = null;
    let trackedEl: Element | null = null;

    const measure = () => {
      if (disposed) return;
      const el = document.querySelector(`[data-tour-id="${activeStep.targetId}"]`);
      if (!el) {
        if (pollCount < 25) {
          setTargetBox(null);
        }
        return;
      }

      if (el !== trackedEl) {
        trackedEl = el;
        // Auto-scroll target smoothly into view if inside scrollable StudioDrawer
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        ro?.disconnect();
        ro = new ResizeObserver(() => measure());
        ro.observe(el);
      }

      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;

      const pad = CUTOUT_PAD;
      const left = Math.max(0, r.left - pad);
      const top = Math.max(0, r.top - pad);
      const right = Math.min(window.innerWidth, r.right + pad);
      const bottom = Math.min(window.innerHeight, r.bottom + pad);
      setTargetBox({
        left,
        top,
        right,
        bottom,
        width: Math.max(12, right - left),
        height: Math.max(12, bottom - top),
      });
    };

    measure();
    const intervalId = window.setInterval(() => {
      pollCount++;
      measure();
    }, 100);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, true);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [tourActive, activeStep]);

  // Keyboard shortcuts while interactive tour is active
  useEffect(() => {
    if (!tourActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopTour();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextStep, prevStep, stopTour, tourActive]);

  // Capture clicks inside the glowing cutout so the REAL button triggers AND advances the step!
  useEffect(() => {
    if (!tourActive || !activeStep?.advanceOnClick || !targetBox) return;

    const onClickCapture = (e: MouseEvent) => {
      if (advancingRef.current) return;
      if (cardRef.current?.contains(e.target as Node)) return;
      const x = e.clientX;
      const y = e.clientY;
      const insideCutout =
        x >= targetBox.left &&
        x <= targetBox.right &&
        y >= targetBox.top &&
        y <= targetBox.bottom;
      if (!insideCutout) return;

      // Ignore clicks directly on an "i" info badge
      const el = e.target as HTMLElement | null;
      if (el?.closest('[aria-label^="Info:"]')) return;

      advancingRef.current = true;
      window.setTimeout(() => {
        nextStep();
      }, 340);
    };

    window.addEventListener('click', onClickCapture, true);
    return () => window.removeEventListener('click', onClickCapture, true);
  }, [activeStep?.advanceOnClick, nextStep, targetBox, tourActive]);

  const chapterProgress = useMemo(() => {
    if (!activeChapter || !activeStep) return { idxInChapter: 1, totalInChapter: 1 };
    const inCh = TUTORIAL_STEPS.filter((s) => s.chapterId === activeChapter.id);
    const pos = inCh.findIndex((s) => s.id === activeStep.id);
    return {
      idxInChapter: pos >= 0 ? pos + 1 : 1,
      totalInChapter: Math.max(1, inCh.length),
    };
  }, [activeChapter, activeStep]);

  if (!tourActive || !activeStep || !activeChapter) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;

  // Smartly position the futuristic guide card so it never covers the highlighted cutout
  const cardWidth = Math.min(372, vw - 24);
  const estCardHeight = vw < 640 ? 292 : 250;
  const gap = 16;

  let cardLeft = Math.round((vw - cardWidth) / 2);
  let cardTop = Math.round((vh - estCardHeight) / 2);

  if (targetBox) {
    const spaceTop = targetBox.top;
    const spaceBottom = vh - targetBox.bottom;
    const spaceLeft = targetBox.left;
    const spaceRight = vw - targetBox.right;

    const pref = activeStep.preferPlacement ?? 'auto';
    let chosen: 'top' | 'bottom' | 'left' | 'right' = 'bottom';

    if (pref === 'top' && spaceTop >= estCardHeight + gap) chosen = 'top';
    else if (pref === 'bottom' && spaceBottom >= estCardHeight + gap) chosen = 'bottom';
    else if (pref === 'left' && spaceLeft >= cardWidth + gap) chosen = 'left';
    else if (pref === 'right' && spaceRight >= cardWidth + gap) chosen = 'right';
    else {
      const candidates: Array<{ dir: 'top' | 'bottom' | 'left' | 'right'; room: number }> = [
        { dir: 'bottom', room: spaceBottom >= estCardHeight + gap ? spaceBottom : -1 },
        { dir: 'top', room: spaceTop >= estCardHeight + gap ? spaceTop : -1 },
        { dir: 'left', room: spaceLeft >= cardWidth + gap ? spaceLeft : -1 },
        { dir: 'right', room: spaceRight >= cardWidth + gap ? spaceRight : -1 },
      ];
      candidates.sort((a, b) => b.room - a.room);
      chosen = candidates[0].room > 0 ? candidates[0].dir : spaceBottom >= spaceTop ? 'bottom' : 'top';
    }

    if (chosen === 'top') {
      cardTop = Math.max(8, targetBox.top - estCardHeight - gap);
      cardLeft = Math.max(
        12,
        Math.min(vw - cardWidth - 12, targetBox.left + targetBox.width / 2 - cardWidth / 2)
      );
    } else if (chosen === 'bottom') {
      cardTop = Math.max(8, Math.min(vh - estCardHeight - 8, targetBox.bottom + gap));
      cardLeft = Math.max(
        12,
        Math.min(vw - cardWidth - 12, targetBox.left + targetBox.width / 2 - cardWidth / 2)
      );
    } else if (chosen === 'left') {
      cardLeft = Math.max(12, targetBox.left - cardWidth - gap);
      cardTop = Math.max(
        8,
        Math.min(vh - estCardHeight - 8, targetBox.top + targetBox.height / 2 - estCardHeight / 2)
      );
    } else {
      cardLeft = Math.min(vw - cardWidth - 12, targetBox.right + gap);
      cardTop = Math.max(
        8,
        Math.min(vh - estCardHeight - 8, targetBox.top + targetBox.height / 2 - estCardHeight / 2)
      );
    }
  }

  const totalPct = Math.round(((activeStepIndex + 1) / TUTORIAL_STEPS.length) * 100);
  const isLastStep = activeStepIndex >= TUTORIAL_STEPS.length - 1;

  // Gentle dim ("darker but not too dark") — ZERO backdrop-blur for 179Hz Intel UHD 770 performance
  const scrimStyle = { backgroundColor: 'rgba(5, 9, 20, 0.56)' };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[105]"
    >
      {/* 4-Quadrant Non-Blur Spotlight Scrim leaving the highlighted control 100% crisp & clickable */}
      {targetBox ? (
        <>
          <div
            onClick={() => {}}
            style={{
              ...scrimStyle,
              top: 0,
              left: 0,
              right: 0,
              height: `${targetBox.top}px`,
            }}
            className="pointer-events-auto fixed transition-all duration-200"
          />
          <div
            style={{
              ...scrimStyle,
              top: `${targetBox.bottom}px`,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            className="pointer-events-auto fixed transition-all duration-200"
          />
          <div
            style={{
              ...scrimStyle,
              top: `${targetBox.top}px`,
              left: 0,
              width: `${targetBox.left}px`,
              height: `${targetBox.height}px`,
            }}
            className="pointer-events-auto fixed transition-all duration-200"
          />
          <div
            style={{
              ...scrimStyle,
              top: `${targetBox.top}px`,
              left: `${targetBox.right}px`,
              right: 0,
              height: `${targetBox.height}px`,
            }}
            className="pointer-events-auto fixed transition-all duration-200"
          />

          {/* Futuristic Holographic Targeting Scanner Frame */}
          <div
            aria-hidden="true"
            style={{
              top: `${targetBox.top}px`,
              left: `${targetBox.left}px`,
              width: `${targetBox.width}px`,
              height: `${targetBox.height}px`,
              boxShadow: `0 0 0 1.5px ${activeChapter.accent}aa, 0 0 26px ${activeChapter.accent}55`,
            }}
            className="pointer-events-none fixed rounded-xl transition-all duration-200"
          >
            {/* 4 Corner Scanner L-Brackets */}
            <span
              className="absolute -top-1.5 -left-1.5 h-4 w-4 rounded-tl-md border-t-2 border-l-2"
              style={{ borderColor: activeChapter.accent }}
            />
            <span
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-tr-md border-t-2 border-r-2"
              style={{ borderColor: activeChapter.accent }}
            />
            <span
              className="absolute -bottom-1.5 -left-1.5 h-4 w-4 rounded-bl-md border-b-2 border-l-2"
              style={{ borderColor: activeChapter.accent }}
            />
            <span
              className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-br-md border-b-2 border-r-2"
              style={{ borderColor: activeChapter.accent }}
            />

            {/* Animated Futuristic Click-Here Beacon */}
            {activeStep.advanceOnClick && (
              <div
                style={{
                  backgroundColor: 'rgba(6, 12, 26, 0.94)',
                  borderColor: activeChapter.accent,
                  color: '#f8fafc',
                }}
                className="absolute -top-7 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap shadow-lg"
              >
                <MousePointerClick
                  className="h-3 w-3 animate-bounce"
                  style={{ color: activeChapter.accent }}
                  aria-hidden="true"
                />
                <span>CLICK HERE</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          style={scrimStyle}
          className="pointer-events-auto fixed inset-0"
        />
      )}

      {/* Futuristic Interactive Guide Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Interactive Tutorial: ${activeStep.title}`}
        style={{
          top: `${Math.round(cardTop)}px`,
          left: `${Math.round(cardLeft)}px`,
          width: `${cardWidth}px`,
          backgroundColor: 'rgba(7, 12, 26, 0.96)',
          borderColor: `${activeChapter.accent}88`,
          boxShadow: `0 22px 60px rgba(0, 0, 0, 0.78), 0 0 0 1px ${activeChapter.accent}33, 0 0 36px ${activeChapter.accent}24`,
        }}
        className="pointer-events-auto fixed max-h-[calc(100dvh-16px)] overflow-y-auto rounded-2xl border p-4 text-slate-100 transition-all duration-200"
      >
        {/* Top Glowing Energy Progress Track */}
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${totalPct}%`,
              background: `linear-gradient(90deg, #38bdf8, ${activeChapter.accent})`,
            }}
          />
        </div>

        {/* Chapter Header + Close */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              stopTour();
              setHubOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/6 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors hover:bg-white/12"
            style={{ color: activeChapter.accent }}
          >
            <Compass className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              CH {activeChapter.number}/{TUTORIAL_CHAPTERS.length} · {activeChapter.title}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="font-mono-num text-[10px] text-slate-400">
              {chapterProgress.idxInChapter}/{chapterProgress.totalInChapter}
            </span>
            <button
              type="button"
              onClick={stopTour}
              aria-label="Exit tutorial"
              title="Close Tutorial (Esc)"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Title & Friendly Kid-Simple Explanation */}
        <h3 className="font-display mt-2.5 text-base font-bold tracking-tight text-white">
          {activeStep.title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
          {activeStep.description}
        </p>

        {/* Action Prompt Box */}
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] leading-snug"
          style={{
            borderColor: `${activeChapter.accent}44`,
            backgroundColor: `${activeChapter.accent}14`,
            color: '#e2e8f0',
          }}
        >
          <Sparkles
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: activeChapter.accent }}
            aria-hidden="true"
          />
          <span>{activeStep.tryThis}</span>
        </div>

        {/* Navigation Footer + Hands-Free Auto-Play Controls */}
        <div className="mt-3.5 flex flex-col gap-2">
          {/* Auto-Play Self-Running Bar */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
            <button
              type="button"
              onClick={toggleTourAutoPlay}
              aria-pressed={tourAutoPlay}
              className={`inline-flex h-6 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-all ${
                tourAutoPlay
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'border border-sky-400/35 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
              }`}
            >
              {tourAutoPlay ? (
                <Pause className="h-3 w-3 shrink-0 fill-current" aria-hidden="true" />
              ) : (
                <Play className="h-3 w-3 shrink-0 fill-current" aria-hidden="true" />
              )}
              <span>
                {tourAutoPlay ? `Auto-Playing (${autoPlayRemainingSec}s)` : 'Auto-Play Tour'}
              </span>
            </button>

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">Pace:</span>
              {([4, 6, 9] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setTourAutoPlaySec(sec)}
                  className={`h-5 rounded px-1.5 font-mono-num text-[10px] font-semibold transition-colors ${
                    tourAutoPlaySec === sec
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {tourAutoPlay && (
            <div
              aria-hidden="true"
              className="h-1 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${Math.round(autoPlayProgress * 100)}%`,
                  backgroundColor: '#34d399',
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevStep}
                disabled={activeStepIndex === 0}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-white/6 px-2.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={skipChapter}
                title="Jump straight to the next chapter"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 px-2 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SkipForward className="h-3 w-3" aria-hidden="true" />
                <span>Skip Ch.</span>
              </button>
            </div>

            <button
              type="button"
              onClick={nextStep}
              style={{
                backgroundColor: activeChapter.accent,
                color: '#060c18',
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-3.5 text-xs font-bold shadow-md transition-transform hover:brightness-110 active:scale-95"
            >
              <span>{isLastStep ? 'Finish Tour' : 'Next'}</span>
              {!isLastStep && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
