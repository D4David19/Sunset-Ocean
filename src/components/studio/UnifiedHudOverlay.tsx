import {
  Box,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Palette,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  SkipBack,
  SkipForward,
  Wand2,
} from 'lucide-react';
import { formatCountdown, useRelease } from '../../context/ReleaseContext';
import { SCENE_META, useStudio, type TourStatus } from '../../context/StudioContext';

interface UnifiedHudOverlayProps {
  tourStatus: TourStatus;
  tourRemainingSec: number;
  tourProgress: number;
  tourBannerTitle: string | null;
  onTourPrev: () => void;
  onTourNext: () => void;
  onTourTogglePause: () => void;
  onHudHoverChange?: (hovered: boolean) => void;
}

export default function UnifiedHudOverlay({
  tourStatus,
  tourRemainingSec,
  tourProgress,
  tourBannerTitle,
  onTourPrev,
  onTourNext,
  onTourTogglePause,
  onHudHoverChange,
}: UnifiedHudOverlayProps) {
  const {
    prefs,
    activePreset,
    telemetry,
    fps,
    zenMode,
    altPeekZen,
    setZenMode,
    drawerOpen,
    setDrawerOpen,
    setDrawerTab,
    sandboxOpen,
    setSandboxOpen,
    updatePrefs,
    notify,
    toasts,
  } = useStudio();

  const {
    released60,
    timerStatus,
    remainingMs,
    setReleaseModalOpen,
  } = useRelease();

  const skin = prefs.skin;
  const isCompact = prefs.hudDensity === 'compact';
  const effectiveZen = zenMode && !altPeekZen;

  const getSkinContainerClass = () => {
    if (skin === 'obsidian') {
      return 'rounded-lg border shadow-none';
    }
    if (skin === 'scoreboard') {
      return 'rounded-md border-2 shadow-lg';
    }
    return 'rounded-xl border shadow-lg';
  };

  const skinColors =
    skin === 'swiss'
      ? {
          backgroundColor: `rgba(248, 250, 252, ${Math.max(0.92, prefs.hudOpacity)})`,
          borderColor: 'rgba(15, 23, 42, 0.16)',
          color: '#0f172a',
        }
      : {
          backgroundColor: 'rgba(9, 13, 25, 0.88)',
          borderColor: activePreset.hudBorder,
          color: activePreset.hudText,
          opacity: Math.max(0.55, Math.min(1, prefs.hudOpacity + 0.08)),
        };

  const mutedColor = skin === 'swiss' ? '#475569' : activePreset.hudMuted;
  const accentColor =
    skin === 'swiss' && activePreset.isLight === false ? '#0284c7' : activePreset.accent;

  if (effectiveZen) {
    return (
      <>
        <button
          type="button"
          onClick={() => setZenMode(false)}
          onMouseEnter={() => onHudHoverChange?.(true)}
          onMouseLeave={() => onHudHoverChange?.(false)}
          aria-label="Show HUD overlay"
          title="Restore UI (H) · Hold Alt to peek"
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-40 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/85 px-2.5 text-[11px] font-medium whitespace-nowrap text-slate-200 opacity-35 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
        >
          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Show UI (H)</span>
        </button>

        {prefs.tourEnabled && tourStatus === 'touring' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-0 left-0 z-30 h-[2px] bg-white/10"
          >
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, tourProgress * 100))}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Minimal Left Telemetry Capsule (Title + max 2 primary metrics + FPS) */}
      {prefs.showTelemetryBar && (
        <aside
          data-tour-id="hud-telemetry"
          aria-label="Session telemetry HUD"
          style={skinColors}
          onMouseEnter={() => onHudHoverChange?.(true)}
          onMouseLeave={() => onHudHoverChange?.(false)}
          className={`pointer-events-auto absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 z-30 hidden items-center gap-2.5 sm:inline-flex md:top-3 md:left-3 ${getSkinContainerClass()} ${
            isCompact ? 'px-2.5 py-1' : 'px-3 py-1.5'
          }`}
        >
          <span
            className={`font-display whitespace-nowrap font-semibold tracking-tight ${
              skin === 'scoreboard' ? 'text-xs tracking-wider uppercase' : 'text-xs'
            }`}
          >
            {telemetry.title}
          </span>

          {telemetry.metrics.slice(0, 2).map((m) => (
            <div
              key={m.label}
              className="flex items-baseline gap-1 border-l pl-2 whitespace-nowrap"
              style={{ borderColor: skinColors.borderColor }}
            >
              <span className="text-[10px] font-medium" style={{ color: mutedColor }}>
                {m.label}
              </span>
              <span
                className="font-mono-num text-xs font-semibold"
                style={{ color: m.accent ? accentColor : skinColors.color }}
              >
                {m.value}
              </span>
            </div>
          ))}

          {prefs.showFps && (
            <div
              data-tour-id="hud-fps"
              className="hidden items-baseline gap-1 border-l pl-2 font-mono-num text-[10.5px] whitespace-nowrap md:inline-flex"
              style={{ borderColor: skinColors.borderColor, color: mutedColor }}
            >
              <span style={{ color: accentColor }} className="font-semibold">
                {fps}
              </span>
              <span>FPS</span>
            </div>
          )}
        </aside>
      )}

      {/* Minimal Top-Right Action Bar: Sandbox · v6.0 Log · Studio · Hide UI (+ active tour mini-control) */}
      <div
        style={skinColors}
        onMouseEnter={() => onHudHoverChange?.(true)}
        onMouseLeave={() => onHudHoverChange?.(false)}
        className={`no-scrollbar pointer-events-auto absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2 z-30 flex max-w-[calc(100%-1rem)] items-center gap-1 overflow-x-auto md:top-3 md:right-3 md:overflow-visible ${getSkinContainerClass()} ${
          isCompact ? 'p-0.5' : 'p-1'
        }`}
      >
        {prefs.tourEnabled && (
          <div
            className="flex items-center gap-0.5 border-r pr-1"
            style={{ borderColor: skinColors.borderColor }}
          >
            <button
              type="button"
              onClick={onTourPrev}
              aria-label="Previous tour scene"
              title="Previous scene ([)"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/10 focus-visible:outline-none"
            >
              <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onTourTogglePause}
              aria-label={tourStatus === 'paused' ? 'Resume Auto Tour' : 'Pause Auto Tour'}
              className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-mono-num text-[11px] whitespace-nowrap transition-colors hover:bg-white/10 focus-visible:outline-none"
            >
              {tourStatus === 'paused' ? (
                <Play className="h-3 w-3 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
              ) : (
                <Pause className="h-3 w-3 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
              )}
              <span>{tourStatus === 'paused' ? 'Hold' : `${tourRemainingSec}s`}</span>
            </button>
            <button
              type="button"
              onClick={onTourNext}
              aria-label="Next tour scene"
              title="Next scene (])"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/10 focus-visible:outline-none"
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <button
          data-tour-id="hud-render-mode"
          type="button"
          onClick={() => {
            const nextMode = prefs.renderMode === '3d' ? '2d' : '3d';
            updatePrefs({ renderMode: nextMode });
            notify(
              nextMode === '2d' ? 'Classic 2D View' : 'Enhanced 3D View',
              telemetry.scene === 'temple'
                ? 'Temple Run stays native 3D'
                : 'Press V anytime to toggle 3D ↔ 2D'
            );
          }}
          aria-pressed={prefs.renderMode === '2d'}
          title={
            telemetry.scene === 'temple'
              ? 'Temple Run is native 3D (switches other 4 games between 3D and Classic 2D) (V)'
              : `Switch between Enhanced 3D and Classic 2D (V) · Currently ${prefs.renderMode.toUpperCase()}`
          }
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-white/10 focus-visible:outline-none"
          style={
            prefs.renderMode === '2d'
              ? { backgroundColor: accentColor, color: activePreset.accentFg }
              : undefined
          }
        >
          {prefs.renderMode === '2d' ? (
            <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Box className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{prefs.renderMode === '2d' ? '2D' : '3D'}</span>
        </button>

        <button
          data-tour-id="hud-sandbox"
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            setSandboxOpen((p) => !p);
          }}
          aria-pressed={sandboxOpen}
          title="Freedom Sandbox, Shaders & Potato Mode (B)"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-white/10 focus-visible:outline-none"
          style={
            sandboxOpen
              ? { backgroundColor: accentColor, color: activePreset.accentFg }
              : undefined
          }
        >
          <Wand2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Sandbox</span>
        </button>

        <button
          data-tour-id="hud-release-timer"
          type="button"
          onClick={() => setReleaseModalOpen(true)}
          title="Updates Log, 25 Features & 6.0 Timer (U)"
          aria-label="Open Update 6.0 Log and Timer"
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-mono-num text-[11px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none ${
            released60
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
              : timerStatus === 'counting'
                ? 'border-amber-400/55 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
          }`}
        >
          {released60 ? (
            <Rocket className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
          ) : (
            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
          )}
          <span>
            {released60
              ? 'v6.0 Log'
              : timerStatus === 'counting'
                ? `6.0 ${formatCountdown(remainingMs)}`
                : timerStatus === 'paused'
                  ? '6.0 Hold'
                  : '6.0 Timer'}
          </span>
        </button>

        <button
          data-tour-id="hud-studio"
          type="button"
          onClick={() => {
            setSandboxOpen(false);
            setDrawerTab('themes');
            setDrawerOpen((p) => !p);
          }}
          aria-pressed={drawerOpen}
          title="Studio Settings, Themes, Guide & Tools (C)"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-white/10 focus-visible:outline-none"
          style={
            drawerOpen
              ? { backgroundColor: accentColor, color: activePreset.accentFg }
              : undefined
          }
        >
          {prefs.presetAutoCycle ? (
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ animationDuration: '6s' }} aria-hidden="true" />
          ) : (
            <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>Studio</span>
        </button>

        <button
          data-tour-id="hud-zen-btn"
          type="button"
          onClick={() => setZenMode(true)}
          title="Hide UI overlay (H)"
          aria-label="Hide UI overlay"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium whitespace-nowrap transition-colors hover:bg-white/10 focus-visible:outline-none"
        >
          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Hide UI</span>
        </button>
      </div>

      {/* Auto Tour Transition Caption Banner */}
      {tourBannerTitle && (
        <div
          style={skinColors}
          className={`pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 px-4 py-1.5 text-center ${getSkinContainerClass()}`}
        >
          <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
            Auto Tour
          </span>
          <span className="mx-2" style={{ color: mutedColor }} aria-hidden="true">
            ·
          </span>
          <span className="font-display text-xs font-semibold" style={{ color: accentColor }}>
            {tourBannerTitle}
          </span>
        </div>
      )}

      {/* Non-blocking Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute right-3 bottom-16 z-40 flex flex-col items-end gap-1.5"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={skinColors}
              className={`px-3 py-1.5 text-xs ${getSkinContainerClass()}`}
            >
              <span className="font-semibold" style={{ color: accentColor }}>
                {t.title}
              </span>
              {t.detail && (
                <>
                  <span className="mx-1.5" style={{ color: mutedColor }} aria-hidden="true">
                    ·
                  </span>
                  <span style={{ color: skinColors.color }}>{t.detail}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stage Bottom Hairline Progress Indicator for Idle Auto Tour */}
      {prefs.tourEnabled && (
        <div
          aria-label={`Auto Tour progress for ${SCENE_META[telemetry.scene].label}`}
          className="pointer-events-none absolute right-0 bottom-0 left-0 z-30 h-[2.5px] bg-white/10"
        >
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${Math.max(0, Math.min(100, tourProgress * 100))}%`,
              backgroundColor:
                tourStatus === 'touring' ? accentColor : 'rgba(148, 163, 184, 0.5)',
            }}
          />
        </div>
      )}
    </>
  );
}
