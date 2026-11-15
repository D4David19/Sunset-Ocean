import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useGuide } from '../../context/GuideContext';
import { useStudio } from '../../context/StudioContext';
import { HELP_CATALOG } from '../../data/helpCatalog';

interface InfoBadgeProps {
  id: string;
  className?: string;
  alwaysVisible?: boolean;
}

/**
 * Tiny unobtrusive futuristic "i" circle badge.
 * Uses <span role="button"> so it stays 100% valid DOM even when placed inside tight button headers.
 */
export function InfoBadge({
  id,
  className = '',
  alwaysVisible = false,
}: InfoBadgeProps) {
  const {
    helpHintsEnabled,
    activePopover,
    openPopover,
    scheduleClosePopover,
  } = useGuide();
  const { activePreset } = useStudio();
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const entry = HELP_CATALOG[id];
  if (!entry) return null;
  if (!helpHintsEnabled && !alwaysVisible) return null;

  const isOpen = activePopover?.id === id;

  const showNow = () => {
    const el = badgeRef.current;
    if (!el) return;
    openPopover(id, el.getBoundingClientRect());
  };

  const handleClick = (e: MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    showNow();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      showNow();
    }
  };

  return (
    <span
      ref={badgeRef}
      role="button"
      tabIndex={0}
      aria-label={`Info: ${entry.title}`}
      title={entry.title}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => {
        if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = window.setTimeout(showNow, 110);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current !== null) {
          window.clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        scheduleClosePopover();
      }}
      style={{
        borderColor: isOpen ? '#38bdf8' : `${activePreset.accent}88`,
        backgroundColor: isOpen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(6, 12, 26, 0.86)',
        color: isOpen ? '#e0f2fe' : '#bae6fd',
        boxShadow: isOpen ? '0 0 10px rgba(56, 189, 248, 0.55)' : undefined,
      }}
      className={`relative inline-flex h-[15px] w-[15px] shrink-0 cursor-pointer items-center justify-center rounded-full border font-mono-num text-[9.5px] leading-none font-bold select-none transition-transform duration-150 after:absolute after:-inset-2 after:content-[''] hover:scale-115 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none ${className}`}
    >
      i
    </span>
  );
}

/**
 * Viewport-clamped futuristic popover card rendered at document.body so scrollable drawers never clip it.
 */
export function InfoPopoverPortal() {
  const {
    activePopover,
    closePopover,
    cancelClosePopover,
    scheduleClosePopover,
  } = useGuide();
  const { activePreset } = useStudio();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activePopover) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (cardRef.current?.contains(target)) return;
      if (target?.closest('[aria-label^="Info:"]')) return;
      closePopover();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [activePopover, closePopover]);

  if (!activePopover || typeof document === 'undefined') return null;

  const entry = HELP_CATALOG[activePopover.id];
  if (!entry) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = Math.min(276, vw - 24);
  const estHeight = 154;
  const pad = 12;
  const { rect } = activePopover;

  // Prefer opening below or above without leaving screen bounds
  let top = rect.bottom + 8;
  if (top + estHeight > vh - pad) {
    top = Math.max(pad, rect.top - estHeight - 8);
  }
  let left = rect.left + rect.width / 2 - cardWidth / 2;
  left = Math.max(pad, Math.min(vw - cardWidth - pad, left));

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={entry.title}
      onMouseEnter={cancelClosePopover}
      onMouseLeave={scheduleClosePopover}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${cardWidth}px`,
        backgroundColor: 'rgba(6, 11, 24, 0.96)',
        borderColor: 'rgba(56, 189, 248, 0.45)',
        boxShadow:
          '0 18px 48px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(56, 189, 248, 0.16), 0 0 24px rgba(56, 189, 248, 0.18)',
      }}
      className="fixed z-[120] rounded-xl border p-3 text-slate-100"
    >
      {/* Subtle futuristic top scanner line */}
      <div
        aria-hidden="true"
        className="mb-2 h-[2px] w-full rounded-full"
        style={{
          background: `linear-gradient(90deg, #38bdf8, ${activePreset.accent}, transparent)`,
        }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-sky-400/60 bg-sky-400/15 font-mono-num text-[10px] font-bold text-sky-300">
            i
          </span>
          <h4 className="font-display text-xs font-semibold tracking-tight text-white">
            {entry.title}
          </h4>
        </div>
        <button
          type="button"
          onClick={closePopover}
          aria-label="Close info card"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-200">
        {entry.whatItDoes}
      </p>

      {entry.tryThis && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2 py-1.5 text-[10.5px] leading-snug text-sky-200">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" aria-hidden="true" />
          <span>{entry.tryThis}</span>
        </div>
      )}
    </div>,
    document.body
  );
}
