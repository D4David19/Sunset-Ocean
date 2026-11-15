import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Camera, ChevronDown, ChevronUp, Hand, Lock, Unlock, Zap } from 'lucide-react';
import { useAudioManager } from '../context/AudioManagerContext';
import { useRelease } from '../context/ReleaseContext';
import {
  isTypingTarget,
  useStudio,
  type SceneCommandPayload,
} from '../context/StudioContext';
import { InfoBadge } from './studio/InfoBadge';
import {
  computeSceneRenderBudget,
  type FramePacingMode,
  type GpuClass,
} from '../utils/hardwareProfile';
import {
  createCyclist3dEngine,
  type CyclistCameraView,
} from '../cyclist/cyclist3dEngine';
import { drawCyclistAndBike } from '../cyclist/cyclistIK';
import {
  computeSceneMetrics,
  drawForegroundParallaxMist,
  drawRuralEnvironment,
  type BiomeMode,
} from '../cyclist/ruralWorld';

const LOOP_DURATION_MS = 24000;
const BASE_RPM = 45;
const CLICK_WINDOW_MS = 1600;
const MAX_SPEED_MULTIPLIER = 10.0;
const BIOME_ORDER: BiomeMode[] = ['usa-tour', 'mountains', 'desert', 'homes'];

interface RuralCyclistSceneProps {
  globalAiMode: boolean;
  aiSyncVersion: number;
}

export default function RuralCyclistScene({
  globalAiMode,
  aiSyncVersion,
}: RuralCyclistSceneProps) {
  const { setCyclistSpeed, setCoastlineBiome } = useAudioManager();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(0);
  const tourProgressRef = useRef(0.15);
  const clickTimestampsRef = useRef<number[]>([]);
  const impulseBoostRef = useRef(0);
  const wheelieFactorRef = useRef(0);
  const currentSpeedRef = useRef(globalAiMode ? 1.8 : 0.0);

  const {
    prefs,
    updatePrefs,
    activePreset,
    records,
    hardwareProfile,
    zenMode,
    paletteOpen,
    shortcutsOpen,
    reportTelemetry,
    bumpRecords,
  } = useStudio();
  const { released60 } = useRelease();
  const released60Ref = useRef(released60);
  useEffect(() => {
    released60Ref.current = released60;
  }, [released60]);

  const [autoMode, setAutoMode] = useState(globalAiMode);
  const [controlsOpen, setControlsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [biomeMode, setBiomeMode] = useState<BiomeMode>('usa-tour');
  const [cameraView, setCameraView] = useState<CyclistCameraView>('chase');
  const [activeBiomeLabel, setActiveBiomeLabel] = useState<string>('Rocky Mountains');
  const [displaySpeed, setDisplaySpeed] = useState(globalAiMode ? 1.8 : 0.0);
  const [autoCruiseBase, setAutoCruiseBase] = useState(1.65);
  const [showWindStreaks, setShowWindStreaks] = useState(true);

  const autoModeRef = useRef(globalAiMode);
  const biomeModeRef = useRef<BiomeMode>('usa-tour');
  const cameraViewRef = useRef<CyclistCameraView>('chase');
  const autoCruiseRef = useRef(1.65);
  const windStreaksRef = useRef(true);
  const qualityTierRef = useRef(prefs.qualityTier);
  const framePacingRef = useRef<FramePacingMode>(prefs.framePacingMode);
  const gpuClassRef = useRef<GpuClass>(hardwareProfile.gpuClass);
  const nativeDprRef = useRef(hardwareProfile.nativeDpr);
  const sandboxRef = useRef({
    coastlineBoost: prefs.sandboxCoastlineBoost,
    timeScale: prefs.sandboxTimeScale,
    gravityScale: prefs.sandboxGravityScale,
    freeOrbit: prefs.sandboxFreeOrbit,
    shaderMood: prefs.shaderMood,
    weather: prefs.sandboxWeather,
  });
  const modalOpenRef = useRef(paletteOpen || shortcutsOpen);
  const bumpRecordsRef = useRef(bumpRecords);
  const lastSavedBestRef = useRef(records.bestCyclistSpeed);
  const lastSyncRef = useRef(aiSyncVersion);

  useEffect(() => {
    cameraViewRef.current = cameraView;
  }, [cameraView]);

  useEffect(() => {
    bumpRecordsRef.current = bumpRecords;
    modalOpenRef.current = paletteOpen || shortcutsOpen;
    qualityTierRef.current = prefs.qualityTier;
    framePacingRef.current = prefs.framePacingMode;
    gpuClassRef.current = hardwareProfile.gpuClass;
    nativeDprRef.current = hardwareProfile.nativeDpr;
    sandboxRef.current = {
      coastlineBoost: prefs.sandboxCoastlineBoost,
      timeScale: prefs.sandboxTimeScale,
      gravityScale: prefs.sandboxGravityScale,
      freeOrbit: prefs.sandboxFreeOrbit,
      shaderMood: prefs.shaderMood,
      weather: prefs.sandboxWeather,
    };
  }, [
    bumpRecords,
    hardwareProfile.gpuClass,
    hardwareProfile.nativeDpr,
    paletteOpen,
    prefs.framePacingMode,
    prefs.qualityTier,
    prefs.sandboxCoastlineBoost,
    prefs.sandboxFreeOrbit,
    prefs.sandboxGravityScale,
    prefs.sandboxTimeScale,
    prefs.sandboxWeather,
    prefs.shaderMood,
    shortcutsOpen,
  ]);

  useEffect(() => {
    if (records.bestCyclistSpeed > lastSavedBestRef.current) {
      lastSavedBestRef.current = records.bestCyclistSpeed;
    }
  }, [records.bestCyclistSpeed]);

  useEffect(() => {
    autoCruiseRef.current = autoCruiseBase;
  }, [autoCruiseBase]);

  useEffect(() => {
    windStreaksRef.current = showWindStreaks;
  }, [showWindStreaks]);

  const unitMult = prefs.cyclistUnit === 'kmh' ? 22.8 : 14.2;
  const unitLabel = prefs.cyclistUnit === 'kmh' ? 'km/h' : 'mph';

  useEffect(() => {
    const curRpm = Math.round(BASE_RPM * displaySpeed);
    const roadSpeed = (displaySpeed * unitMult).toFixed(0);
    reportTelemetry({
      scene: 'cyclist',
      title: released60 ? 'Coastline Tour 6.0' : 'Coastline Tour',
      status: activeBiomeLabel,
      metrics: [
        { label: 'Speed', value: `${roadSpeed} ${unitLabel}`, accent: true },
        { label: 'Cadence', value: `${curRpm} RPM` },
        {
          label: 'Peak',
          value: `${Math.max(records.bestCyclistSpeed, displaySpeed).toFixed(1)}x`,
        },
        { label: 'Mode', value: autoMode ? 'Auto Cruise' : 'Manual' },
      ],
    });
  }, [
    activeBiomeLabel,
    autoMode,
    displaySpeed,
    records.bestCyclistSpeed,
    released60,
    reportTelemetry,
    unitLabel,
    unitMult,
  ]);

  useEffect(() => {
    if (aiSyncVersion !== lastSyncRef.current) {
      lastSyncRef.current = aiSyncVersion;
      setAutoMode(globalAiMode);
    }
  }, [globalAiMode, aiSyncVersion]);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  useEffect(() => {
    biomeModeRef.current = biomeMode;
  }, [biomeMode]);

  const handlePedalClick = useCallback(() => {
    const now = performance.now();
    clickTimestampsRef.current.push(now);
    clickTimestampsRef.current = clickTimestampsRef.current.filter(
      (t) => now - t <= CLICK_WINDOW_MS
    );
    const maxImpulse = released60Ref.current ? 11.2 : 9.0;
    impulseBoostRef.current = Math.min(maxImpulse, impulseBoostRef.current + 1.05);
  }, []);

  const triggerWheelie = useCallback(() => {
    wheelieFactorRef.current = 1.0;
    impulseBoostRef.current = Math.min(12.0, impulseBoostRef.current + 0.65);
  }, []);

  // Space-key manual sprint pedal boost & W/ArrowUp wheelie
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || modalOpenRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space' && !e.repeat && !autoModeRef.current) {
        e.preventDefault();
        handlePedalClick();
      } else if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) {
        triggerWheelie();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePedalClick, triggerWheelie]);

  // Listen to Command Palette biome jump & tutorial commands
  useEffect(() => {
    const onSceneCommand = (e: Event) => {
      const cmd = (e as CustomEvent<SceneCommandPayload>).detail;
      if (!cmd || cmd.scene !== 'cyclist') return;
      if (cmd.type === 'jump-biome') {
        const nextBiome = BIOME_ORDER[cmd.biomeIndex % BIOME_ORDER.length] ?? 'usa-tour';
        setBiomeMode(nextBiome);
      } else if (cmd.type === 'set-controls-open') {
        setControlsOpen(cmd.open);
      }
    };
    window.addEventListener('kas:scene-command', onSceneCommand);
    return () => window.removeEventListener('kas:scene-command', onSceneCommand);
  }, []);

  const renderMode = prefs.renderMode;

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const is2d = renderMode === '2d';
    const engine = is2d ? null : createCyclist3dEngine(mountEl);
    let canvas2d: HTMLCanvasElement | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    if (is2d) {
      canvas2d = document.createElement('canvas');
      canvas2d.style.display = 'block';
      canvas2d.style.width = '100%';
      canvas2d.style.height = '100%';
      mountEl.appendChild(canvas2d);
      ctx2d = canvas2d.getContext('2d');
    }

    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    const syncSize = (dpr: number) => {
      const w = mountEl.clientWidth || window.innerWidth;
      const h = mountEl.clientHeight || window.innerHeight;
      if (w !== lastW || h !== lastH || Math.abs(dpr - lastDpr) > 0.01) {
        lastW = w;
        lastH = h;
        lastDpr = dpr;
        if (engine) {
          engine.resize(w, h, dpr);
        } else if (canvas2d) {
          canvas2d.width = Math.max(1, Math.round(w * dpr));
          canvas2d.height = Math.max(1, Math.round(h * dpr));
        }
      }
    };

    const initBudget = computeSceneRenderBudget({
      framePacingMode: framePacingRef.current,
      qualityTier: qualityTierRef.current,
      gpuClass: gpuClassRef.current,
      nativeDpr: nativeDprRef.current,
      sceneKind: is2d ? '2d' : '3d-light',
      cssWidth: mountEl.clientWidth || window.innerWidth,
    });
    syncSize(initBudget.dpr);

    const ro = new ResizeObserver(() => {
      syncSize(lastDpr || initBudget.dpr);
    });
    ro.observe(mountEl);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    let rafId = 0;
    let lastTime = performance.now();
    let hudTick = 0;
    let pacerClock = 0;

    const frame = (now: number) => {
      const rawDt = Math.max(0, now - lastTime);
      const cssW = mountEl.clientWidth || window.innerWidth;
      const budget = computeSceneRenderBudget({
        framePacingMode: framePacingRef.current,
        qualityTier: qualityTierRef.current,
        gpuClass: gpuClassRef.current,
        nativeDpr: nativeDprRef.current,
        sceneKind: '3d-light',
        cssWidth: cssW,
      });

      if (budget.minFrameMs > 0 && rawDt < budget.minFrameMs - 0.6) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      syncSize(budget.dpr);

      const sb = sandboxRef.current;
      const dt = Math.min(Math.max(1, rawDt), 100);
      const dtSec = (dt / 1000) * Math.max(0.2, sb.timeScale);
      lastTime = now;
      pacerClock += dtSec;

      const recent = clickTimestampsRef.current.filter(
        (t) => now - t <= CLICK_WINDOW_MS
      );
      clickTimestampsRef.current = recent;

      const clicksPerSec = recent.length / (CLICK_WINDOW_MS / 1000);
      impulseBoostRef.current *= Math.exp(-dtSec * 1.35);
      wheelieFactorRef.current *= Math.exp(-dtSec * 2.2);

      const boostMult = Math.max(0.5, sb.coastlineBoost);
      const clickDrivenBoost = (clicksPerSec * 1.15 + impulseBoostRef.current) * boostMult;
      let targetSpeed = 0;

      const speedCap = (released60Ref.current ? 12.0 : MAX_SPEED_MULTIPLIER) * boostMult;
      if (autoModeRef.current) {
        const waveA = 0.5 + 0.5 * Math.sin(pacerClock * 0.42);
        const sprintWave = Math.pow(
          Math.max(0, Math.sin(pacerClock * 0.19 - 0.6)),
          3
        );
        const autoBase = (autoCruiseRef.current + waveA * 1.9 + sprintWave * 4.0) * boostMult;
        targetSpeed = Math.min(
          speedCap,
          autoBase + clickDrivenBoost * 0.75
        );
      } else {
        targetSpeed = Math.min(speedCap, clickDrivenBoost);
      }

      const blendRate = targetSpeed > currentSpeedRef.current ? 11.5 : 1.9;
      currentSpeedRef.current +=
        (targetSpeed - currentSpeedRef.current) *
        (1 - Math.exp(-dtSec * blendRate));
      if (currentSpeedRef.current < 0.01 && targetSpeed === 0) {
        currentSpeedRef.current = 0;
      }

      const motionScale = reducedMotion ? 0.35 : 1.0;
      const effectiveSpeed = currentSpeedRef.current * motionScale;
      const deltaPhase = (dt * Math.max(0.2, sb.timeScale) * effectiveSpeed) / LOOP_DURATION_MS;

      phaseRef.current = (phaseRef.current + deltaPhase) % 1;
      tourProgressRef.current = (tourProgressRef.current + deltaPhase * 0.85) % 3;

      let biomeText = 'Rocky Mountains';
      if (engine) {
        const res = engine.update({
          dt: dtSec,
          speedMult: effectiveSpeed,
          phase: phaseRef.current,
          biomeMode: biomeModeRef.current,
          tourProgress: tourProgressRef.current,
          wheelieFactor: wheelieFactorRef.current,
          cameraView: cameraViewRef.current,
          freeOrbit: sb.freeOrbit,
          gravityScale: sb.gravityScale,
          shaderMood: sb.shaderMood,
          weather: sb.weather,
          showWindStreaks: windStreaksRef.current,
          budget,
        });
        biomeText = res.activeBiomeLabel;
      } else if (ctx2d && canvas2d) {
        const cssH = mountEl.clientHeight || window.innerHeight;
        ctx2d.save();
        ctx2d.setTransform(budget.dpr, 0, 0, budget.dpr, 0, 0);
        const metrics = computeSceneMetrics(cssW, cssH);
        const envRes = drawRuralEnvironment(
          ctx2d,
          cssW,
          cssH,
          metrics,
          phaseRef.current,
          tourProgressRef.current,
          biomeModeRef.current,
          effectiveSpeed
        );
        biomeText = envRes.activeBiomeLabel;
        const crankAngle = phaseRef.current * metrics.crankCycles * Math.PI * 2;
        const wheelAngle = phaseRef.current * metrics.wheelCycles * Math.PI * 2;
        ctx2d.save();
        if (wheelieFactorRef.current > 0.01) {
          const rearX = metrics.bbX - 56 * metrics.bikeScale;
          const rearY = metrics.bbY + 41 * metrics.bikeScale;
          ctx2d.translate(rearX, rearY);
          ctx2d.rotate(-wheelieFactorRef.current * 0.36);
          ctx2d.translate(-rearX, -rearY);
        }
        drawCyclistAndBike(
          ctx2d,
          metrics.bbX,
          metrics.bbY,
          metrics.bikeScale,
          crankAngle,
          wheelAngle
        );
        ctx2d.restore();
        drawForegroundParallaxMist(ctx2d, cssW, cssH, phaseRef.current, envRes.roadTravel);
        ctx2d.restore();
      }

      hudTick += dt;
      if (hudTick >= 80) {
        hudTick = 0;
        const spd = Number(currentSpeedRef.current.toFixed(2));
        setDisplaySpeed(spd);
        setActiveBiomeLabel(biomeText);
        setCyclistSpeed(currentSpeedRef.current);
        setCoastlineBiome(
          biomeText.includes('Desert') || biomeText.includes('Canyon')
            ? 'desert'
            : biomeText.includes('Homes') || biomeText.includes('Town')
              ? 'homes'
              : 'mountains'
        );
        if (spd > lastSavedBestRef.current + 0.05) {
          lastSavedBestRef.current = spd;
          bumpRecordsRef.current({}, { bestCyclistSpeed: spd });
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      motionQuery.removeEventListener('change', handleMotionChange);
      engine?.dispose();
      if (canvas2d && canvas2d.parentNode === mountEl) {
        mountEl.removeChild(canvas2d);
      }
    };
  }, [renderMode, setCoastlineBiome, setCyclistSpeed]);

  const rpm = Math.round(BASE_RPM * displaySpeed);
  const roadSpeedDisplay = (displaySpeed * unitMult).toFixed(0);
  const isBiomeLocked = biomeMode !== 'usa-tour';

  const toggleBiomeLock = () => {
    if (isBiomeLocked) {
      setBiomeMode('usa-tour');
    } else if (activeBiomeLabel.includes('Desert')) {
      setBiomeMode('desert');
    } else if (activeBiomeLabel.includes('Homes')) {
      setBiomeMode('homes');
    } else {
      setBiomeMode('mountains');
    }
  };

  const isSwiss = prefs.skin === 'swiss';
  const cardStyle = isSwiss
    ? {
        backgroundColor: `rgba(248, 250, 252, ${Math.max(0.76, prefs.hudOpacity)})`,
        borderColor: 'rgba(15, 23, 42, 0.16)',
        color: '#0f172a',
      }
    : {
        backgroundColor: activePreset.hudBg,
        borderColor: activePreset.hudBorder,
        color: activePreset.hudText,
        opacity: Math.max(0.45, Math.min(1, prefs.hudOpacity + 0.08)),
      };
  const accentColor =
    isSwiss && !activePreset.isLight ? '#0284c7' : activePreset.accent;

  return (
    <main
      onPointerDown={(e) => {
        if (prefs.sandboxFreeOrbit) return;
        if (e.button === 0 || e.pointerType === 'touch') handlePedalClick();
      }}
      aria-label="Interactive 3D Coastline Tour cyclist — tap rapidly or press Space to pedal, W for wheelie"
      className="relative h-full w-full touch-none cursor-pointer overflow-hidden bg-[#1c154a] select-none"
    >
      <div
        ref={mountRef}
        className={`h-full w-full touch-none ${
          prefs.sandboxFreeOrbit ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none'
        }`}
      />

      {!zenMode && (
      <>
      <section
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Coastline Tour speed and region controls"
        style={cardStyle}
        className={`absolute top-14 left-2 z-20 max-h-[calc(100dvh-9.5rem)] w-[320px] max-w-[calc(100%-1rem)] overflow-y-auto border p-3.5 shadow-xl md:top-14 md:left-3 md:max-h-none md:overflow-visible ${
          isSwiss ? 'hud-swiss' : ''
        } ${
          prefs.skin === 'scoreboard'
            ? 'rounded-md border-2'
            : prefs.skin === 'obsidian'
              ? 'rounded-lg'
              : 'rounded-xl'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h1 className="font-display text-sm font-semibold tracking-wide" style={{ color: accentColor }}>
              Coastline Tour
            </h1>
            <InfoBadge id="cyclist-card" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono-num text-xs font-semibold" style={{ color: accentColor }}>
              {roadSpeedDisplay} {unitLabel} · {rpm} RPM
            </span>
            <button
              type="button"
              onClick={() => setControlsOpen((prev) => !prev)}
              aria-expanded={controlsOpen}
              aria-label={controlsOpen ? 'Collapse Coastline Tour controls' : 'Expand Coastline Tour controls'}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-75 transition-colors hover:bg-white/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
            >
              {controlsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-85 font-mono-num">
          <div className="flex items-center gap-1.5">
            <span>{activeBiomeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{displaySpeed.toFixed(1)}x</span>
          </div>
          <div data-tour-id="cyclist-top-badges" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                updatePrefs({
                  cyclistUnit: prefs.cyclistUnit === 'mph' ? 'kmh' : 'mph',
                })
              }
              className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase hover:bg-white/15"
            >
              <span>{unitLabel}</span>
              <InfoBadge id="cyclist-units" />
            </button>
            <button
              type="button"
              onClick={toggleBiomeLock}
              aria-pressed={isBiomeLocked}
              title={isBiomeLocked ? 'Unlock biome auto-tour' : 'Lock current biome'}
              className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                isBiomeLocked
                  ? 'border-amber-300/45 bg-amber-400 text-slate-950'
                  : 'border-white/15 bg-white/8 hover:bg-white/15'
              }`}
            >
              {isBiomeLocked ? (
                <Lock className="h-2.5 w-2.5" />
              ) : (
                <Unlock className="h-2.5 w-2.5" />
              )}
              <span>{isBiomeLocked ? 'Locked' : 'Tour'}</span>
              <InfoBadge id="cyclist-biome-lock" />
            </button>
          </div>
        </div>

        {controlsOpen && (
          <>
            <div data-tour-id="cyclist-scenery" className="mt-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium opacity-80">
                  Highway Scenery
                </span>
                <InfoBadge id="cyclist-scenery" />
              </div>
              <div
                className="grid grid-cols-4 gap-1 rounded-lg bg-white/8 p-1"
                role="group"
                aria-label="Landscape region selector"
              >
                {(
                  [
                    { id: 'usa-tour', label: 'USA Tour' },
                    { id: 'mountains', label: 'Rockies' },
                    { id: 'desert', label: 'Desert' },
                    { id: 'homes', label: 'Suburbs' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBiomeMode(opt.id)}
                    className={`h-7 rounded-md px-1 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                      biomeMode === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoMode((prev) => !prev)}
                aria-pressed={autoMode}
                className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                  autoMode
                    ? 'border-amber-300/45 bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'border-white/15 bg-white/8 text-slate-100 hover:bg-white/15'
                }`}
              >
                {autoMode ? (
                  <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{autoMode ? 'Auto' : 'Manual'}</span>
                <InfoBadge id="cyclist-auto-manual" />
              </button>

              <div className="flex flex-1 flex-col gap-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${Math.min(100, (displaySpeed / MAX_SPEED_MULTIPLIER) * 100)}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
            </div>

            <div data-tour-id="cyclist-speed-row" className="mt-2.5 flex items-center justify-between gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] opacity-80">
                  <span className="inline-flex items-center gap-1">
                    Cruise Target <InfoBadge id="cyclist-cruise" />
                  </span>
                  <span className="font-mono-num">{autoCruiseBase.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={3.2}
                  step={0.1}
                  value={autoCruiseBase}
                  onChange={(e) => setAutoCruiseBase(parseFloat(e.target.value))}
                  className="studio-range h-1.5 w-full cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowWindStreaks((p) => !p)}
                aria-pressed={showWindStreaks}
                className="mt-3 inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/15 px-2 text-[10px] font-medium whitespace-nowrap transition-colors hover:bg-white/10"
                style={
                  showWindStreaks
                    ? { borderColor: accentColor, color: accentColor }
                    : { opacity: 0.7 }
                }
              >
                <span>Wind {showWindStreaks ? 'On' : 'Off'}</span>
                <InfoBadge id="cyclist-wind" />
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-white/8 p-0.5" role="group" aria-label="3D Camera Angle">
                <Camera className="ml-1 h-3 w-3 opacity-65" aria-hidden="true" />
                {(['chase', 'side', 'pov', 'drone'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCameraView(view)}
                    className={`h-6 rounded-md px-1.5 text-[10px] font-medium uppercase transition-colors ${
                      cameraView === view
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={triggerWheelie}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300/35 bg-amber-400/20 px-2 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/30"
                title="Pop a 3D wheelie (W)"
              >
                <Zap className="h-3 w-3" aria-hidden="true" />
                <span>Wheelie</span>
              </button>
            </div>

            <p className="mt-2 text-[11px] opacity-75">
              {prefs.sandboxFreeOrbit
                ? 'Free 3D Orbit active — drag or pinch to inspect the 3D cyclist & hills.'
                : autoMode
                  ? '3D Auto cruises across undulating terrain. Tap or press W to wheelie.'
                  : 'Tap fast or press Space to sprint in 3D up to overdrive.'}
            </p>
          </>
        )}
      </section>

      {!autoMode && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePedalClick();
          }}
          className="pointer-events-auto absolute right-3 bottom-16 z-20 inline-flex h-11 items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-400 px-4 text-xs font-bold text-slate-950 shadow-xl active:scale-95 md:hidden"
        >
          <span>Tap to Pedal!</span>
        </button>
      )}
      </>
      )}
    </main>
  );
}

