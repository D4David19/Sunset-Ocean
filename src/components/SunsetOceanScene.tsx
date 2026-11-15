import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  Globe,
  Hand,
  Orbit,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useAudioManager } from '../context/AudioManagerContext';
import { useRelease } from '../context/ReleaseContext';
import { useStudio, type SceneCommandPayload } from '../context/StudioContext';
import { InfoBadge } from './studio/InfoBadge';
import {
  computeSceneRenderBudget,
  type FramePacingMode,
  type GpuClass,
} from '../utils/hardwareProfile';
import { safeReadStorage, safeWriteStorage } from '../utils/safeStorage';
import { evaluateBrokenArrowSolar } from '../sunset/brokenArrowSolar';
import {
  createGalacticZoomController,
  type GalacticController,
  type GalacticStatus,
  type SolarBodyScreenLabel,
} from '../sunset/galacticScene';
import {
  ALL_SOLAR_BODIES,
  buildSelectedBodyTelemetry,
  type SolarBodyName,
  type SolarScaleMode,
} from '../sunset/solarSystemEphemeris';
import { createOcean3dEngine, type Ocean3dEngine } from '../sunset/ocean3dEngine';
import { createOceanShaderRenderer } from '../sunset/oceanShader';
import { renderPainterlyWaves } from '../sunset/waveCanvas';
import { createHorizonBirdSystem } from '../sunset/horizonBirds';
import {
  blendSunsetStates,
  evaluateBrokenArrowSunsetState,
  evaluateSunsetState,
  type SunsetPaletteState,
} from '../sunset/palette';
import { useBrokenArrowAstronomy } from '../sunset/useBrokenArrowAstronomy';

const DEFAULT_WAVE_SPEED = 1.0;
const DEFAULT_SKY_DURATION_SEC = 36;
const BASE_WAVE_LOOP_MS = 36000;
const SKY_MODE_STORAGE_KEY = 'sunset_ocean_sky_mode_v1';

export type QualityMode = 'auto' | 'fast' | 'high';
export type SkyMode = 'classic' | 'broken-arrow';
export type MoonSyncMode = 'live' | 'cycle';

function readSavedSkyMode(): SkyMode {
  const raw = safeReadStorage(SKY_MODE_STORAGE_KEY);
  return raw === 'broken-arrow' ? 'broken-arrow' : 'classic';
}

function saveSkyMode(mode: SkyMode) {
  safeWriteStorage(SKY_MODE_STORAGE_KEY, mode);
}

function LunarPhaseDisc({
  phaseFraction,
  isWaxing,
}: {
  phaseFraction: number;
  isWaxing: boolean;
}) {
  const lit = 0.5 * (1 - Math.cos(((phaseFraction % 1) + 1) % 1 * Math.PI * 2));
  const r = 10;
  const cx = 12;
  const cy = 12;
  const termRx = Math.max(0.2, r * Math.abs(1 - 2 * lit));

  // Build exact SVG path for lit half + terminator arc
  let litPath = '';
  if (lit >= 0.985) {
    litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  } else if (lit <= 0.015) {
    litPath = '';
  } else if (isWaxing) {
    // Lit on right (+X): outer arc from top to bottom clockwise (sweep=1)
    const sweepTerm = lit <= 0.5 ? 0 : 1;
    litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${termRx} ${r} 0 0 ${sweepTerm} ${cx} ${cy - r}`;
  } else {
    // Lit on left (-X): outer arc from top to bottom counter-clockwise (sweep=0)
    const sweepTerm = lit <= 0.5 ? 1 : 0;
    litPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${termRx} ${r} 0 0 ${sweepTerm} ${cx} ${cy - r}`;
  }

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#18223d"
        stroke="rgba(226,232,240,0.3)"
        strokeWidth="1"
      />
      {litPath && <path d={litPath} fill="#eef4ff" />}
    </svg>
  );
}

interface SunsetOceanSceneProps {
  globalAiMode: boolean;
  aiSyncVersion: number;
}

export default function SunsetOceanScene({
  globalAiMode,
  aiSyncVersion,
}: SunsetOceanSceneProps) {
  const oceanMountRef = useRef<HTMLDivElement | null>(null);
  const oceanEngineRef = useRef<Ocean3dEngine | null>(null);
  const galacticMountRef = useRef<HTMLDivElement | null>(null);
  const galacticCtrlRef = useRef<GalacticController | null>(null);

  const { playPlanetFocusCue, setOceanSpaceBlend } = useAudioManager();
  const {
    prefs,
    updatePrefs,
    activePreset,
    hardwareProfile,
    zenMode,
    reportTelemetry,
    notify,
  } = useStudio();
  const { released60 } = useRelease();

  const [aiMode, setAiMode] = useState<boolean>(globalAiMode);
  const [manualSkyPhase, setManualSkyPhase] = useState<number>(0.18);
  const [skyMode, setSkyMode] = useState<SkyMode>(() => readSavedSkyMode());
  const [moonSyncMode, setMoonSyncMode] = useState<MoonSyncMode>('live');
  const [waveSpeed, setWaveSpeed] = useState(DEFAULT_WAVE_SPEED);
  const [skyDurationSec, setSkyDurationSec] = useState(
    DEFAULT_SKY_DURATION_SEC
  );
  const [controlsOpen, setControlsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  const [effectiveFast, setEffectiveFast] = useState(
    () => hardwareProfile.gpuClass !== 'discrete'
  );
  const [galacticStatus, setGalacticStatus] = useState<GalacticStatus>(() => ({
    phase: 'ocean',
    stageLabel: 'Horizon Ocean',
    tourProgress: 0,
    oceanBlend: 0,
    selectedBody: 'Earth',
    scaleMode: 'showcase',
    timeRate: 1,
    simDateMs: Date.now(),
  }));
  const [bodyLabels, setBodyLabels] = useState<SolarBodyScreenLabel[]>([]);
  const [showSpaceLabels, setShowSpaceLabels] = useState(true);
  const [showBeltsAndGrid, setShowBeltsAndGrid] = useState(true);
  const [savedRateBeforeInspect, setSavedRateBeforeInspect] = useState<
    number | null
  >(null);

  const astronomy = useBrokenArrowAstronomy();
  const {
    solar,
    lunar,
    sunriseLabel,
    sunsetLabel,
    dayLengthLabel,
    source,
    isFetching,
    lastUpdatedLabel,
    refresh,
  } = astronomy;

  const aiModeRef = useRef<boolean>(aiMode);
  const lastSyncRef = useRef<number>(aiSyncVersion);
  const skyModeRef = useRef<SkyMode>(skyMode);
  const moonSyncModeRef = useRef<MoonSyncMode>(moonSyncMode);
  const lunarPhaseRef = useRef<number>(lunar.phaseFraction);
  const waveSpeedRef = useRef(DEFAULT_WAVE_SPEED);
  const skyDurationRef = useRef(DEFAULT_SKY_DURATION_SEC);
  const qualityModeRef = useRef<QualityMode>('auto');
  const qualityTierRef = useRef(prefs.qualityTier);
  const framePacingRef = useRef<FramePacingMode>(prefs.framePacingMode);
  const gpuClassRef = useRef<GpuClass>(hardwareProfile.gpuClass);
  const nativeDprRef = useRef(hardwareProfile.nativeDpr);
  const oceanBlendRef = useRef(0);
  const skyPhaseRef = useRef(0);
  const wavePhaseRef = useRef(0);
  const driftPhaseRef = useRef(0);
  const modeBlendRef = useRef(skyMode === 'broken-arrow' ? 1 : 0);
  const timeRateRef = useRef<number>(1);
  const focusCueRef = useRef(playPlanetFocusCue);
  const notifyRef = useRef(notify);
  const sandboxRef = useRef({
    shaderMood: prefs.shaderMood,
    weather: prefs.sandboxWeather,
    waveChop: prefs.sandboxWaveChop,
    timeScale: prefs.sandboxTimeScale,
    freeOrbit: prefs.sandboxFreeOrbit,
    solarElevation: prefs.sandboxSolarElevation,
  });

  useEffect(() => {
    sandboxRef.current = {
      shaderMood: prefs.shaderMood,
      weather: prefs.sandboxWeather,
      waveChop: prefs.sandboxWaveChop,
      timeScale: prefs.sandboxTimeScale,
      freeOrbit: prefs.sandboxFreeOrbit,
      solarElevation: prefs.sandboxSolarElevation,
    };
  }, [
    prefs.sandboxFreeOrbit,
    prefs.sandboxSolarElevation,
    prefs.sandboxTimeScale,
    prefs.sandboxWaveChop,
    prefs.sandboxWeather,
    prefs.shaderMood,
  ]);

  useEffect(() => {
    focusCueRef.current = playPlanetFocusCue;
    notifyRef.current = notify;
  }, [notify, playPlanetFocusCue]);

  useEffect(() => {
    qualityTierRef.current = prefs.qualityTier;
    framePacingRef.current = prefs.framePacingMode;
    gpuClassRef.current = hardwareProfile.gpuClass;
    nativeDprRef.current = hardwareProfile.nativeDpr;
    const cssW =
      oceanMountRef.current?.clientWidth ||
      (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const cssH =
      oceanMountRef.current?.clientHeight ||
      (typeof window !== 'undefined' ? window.innerHeight : 1080);
    const budget = computeSceneRenderBudget({
      framePacingMode: prefs.framePacingMode,
      qualityTier: prefs.qualityTier,
      gpuClass: hardwareProfile.gpuClass,
      nativeDpr: hardwareProfile.nativeDpr,
      sceneKind: '3d-heavy',
      cssWidth: cssW,
    });
    oceanEngineRef.current?.resize(cssW, cssH, budget.dpr);
    galacticCtrlRef.current?.setRenderProfile({
      dpr: budget.dpr,
      minFrameMs: budget.minFrameMs,
    });
  }, [
    hardwareProfile.gpuClass,
    hardwareProfile.nativeDpr,
    prefs.framePacingMode,
    prefs.qualityTier,
  ]);

  useEffect(() => {
    timeRateRef.current = galacticStatus.timeRate;
  }, [galacticStatus.timeRate]);

  useEffect(() => {
    if (aiSyncVersion !== lastSyncRef.current) {
      lastSyncRef.current = aiSyncVersion;
      setAiMode(globalAiMode);
    }
  }, [globalAiMode, aiSyncVersion]);

  useEffect(() => {
    aiModeRef.current = aiMode;
    if (!aiMode) {
      setManualSkyPhase(Number(skyPhaseRef.current.toFixed(3)));
    }
  }, [aiMode]);

  useEffect(() => {
    skyModeRef.current = skyMode;
    saveSkyMode(skyMode);
  }, [skyMode]);

  useEffect(() => {
    moonSyncModeRef.current = moonSyncMode;
  }, [moonSyncMode]);

  useEffect(() => {
    lunarPhaseRef.current = lunar.phaseFraction;
  }, [lunar.phaseFraction]);

  useEffect(() => {
    waveSpeedRef.current = waveSpeed;
  }, [waveSpeed]);

  useEffect(() => {
    skyDurationRef.current = skyDurationSec;
  }, [skyDurationSec]);

  useEffect(() => {
    qualityModeRef.current = qualityMode;
    if (qualityMode === 'fast') setEffectiveFast(true);
    else if (qualityMode === 'high') setEffectiveFast(false);
  }, [qualityMode]);

  useEffect(() => {
    const mapped: QualityMode =
      prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato'
        ? 'fast'
        : prefs.qualityTier === 'high'
          ? 'high'
          : 'auto';
    setQualityMode(mapped);
    galacticCtrlRef.current?.setEcoMode(
      prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato'
    );
  }, [prefs.qualityTier]);

  useEffect(() => {
    galacticCtrlRef.current?.setShowBeltsAndGrid(showBeltsAndGrid);
  }, [showBeltsAndGrid]);

  const handleInspectBody = useCallback((name: SolarBodyName) => {
    const ctrl = galacticCtrlRef.current;
    if (!ctrl) return;
    // Decision 2: Auto-Slow / Auto-Pause fast orbital warp when clicking a planet so it stays inspectable!
    if (name !== 'Sun' && timeRateRef.current > 1) {
      setSavedRateBeforeInspect(timeRateRef.current);
      ctrl.setTimeRate(0);
    }
    ctrl.focusBody(name);
    focusCueRef.current();
  }, []);

  useEffect(() => {
    reportTelemetry({
      scene: 'ocean',
      title: released60 ? 'Solar Horizon 6.0' : 'Solar Horizon',
      status:
        galacticStatus.phase !== 'ocean'
          ? `Space · ${galacticStatus.selectedBody}`
          : skyMode === 'broken-arrow'
            ? solar.homericTitle
            : 'Classic Cycle',
      metrics: [
        { label: 'Solar Clock', value: solar.timeClock, accent: true },
        { label: 'Moon', value: `${lunar.illuminationPct}%` },
        {
          label: galacticStatus.phase !== 'ocean' ? 'Epoch' : 'View',
          value:
            galacticStatus.phase !== 'ocean'
              ? new Date(galacticStatus.simDateMs).toISOString().slice(0, 10)
              : galacticStatus.stageLabel,
        },
        { label: 'Wave', value: `${waveSpeed.toFixed(2)}x` },
      ],
    });
  }, [
    galacticStatus.phase,
    galacticStatus.selectedBody,
    galacticStatus.simDateMs,
    galacticStatus.stageLabel,
    lunar.illuminationPct,
    released60,
    reportTelemetry,
    skyMode,
    solar.homericTitle,
    solar.timeClock,
    waveSpeed,
  ]);

  useEffect(() => {
    oceanBlendRef.current = galacticStatus.oceanBlend;
    setOceanSpaceBlend(galacticStatus.oceanBlend);
  }, [galacticStatus.oceanBlend, setOceanSpaceBlend]);

  useEffect(() => {
    return () => setOceanSpaceBlend(0);
  }, [setOceanSpaceBlend]);

  // Periodic AI Showcase: gently triggers Galactic Zoom tour when idle in Ocean view
  useEffect(() => {
    if (!aiMode || galacticStatus.phase !== 'ocean') return;
    const timer = window.setTimeout(() => {
      if (aiModeRef.current) {
        galacticCtrlRef.current?.startTour();
      }
    }, 22000);
    return () => clearTimeout(timer);
  }, [aiMode, galacticStatus.phase]);

  // Initialize Three.js Galactic Zoom Cosmic Scene in isolated container
  useEffect(() => {
    const mountEl = galacticMountRef.current;
    if (!mountEl) return;

    const controller = createGalacticZoomController(
      mountEl,
      (status) => {
        setGalacticStatus(status);
      },
      (labels) => {
        setBodyLabels(labels);
      },
      (pickedName) => {
        handleInspectBody(pickedName);
      }
    );
    controller.setEcoMode(
      prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato'
    );
    controller.setShowBeltsAndGrid(showBeltsAndGrid);
    const initBudget = computeSceneRenderBudget({
      framePacingMode: framePacingRef.current,
      qualityTier: qualityTierRef.current,
      gpuClass: gpuClassRef.current,
      nativeDpr: nativeDprRef.current,
      sceneKind: '3d-heavy',
      cssWidth: mountEl.clientWidth || window.innerWidth,
    });
    controller.setRenderProfile({
      dpr: initBudget.dpr,
      minFrameMs: initBudget.minFrameMs,
    });
    galacticCtrlRef.current = controller;

    return () => {
      galacticCtrlRef.current = null;
      controller.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleInspectBody]);

  // Listen to Command Palette & Interactive Tutorial commands
  useEffect(() => {
    const onSceneCommand = (e: Event) => {
      const cmd = (e as CustomEvent<SceneCommandPayload>).detail;
      if (!cmd || cmd.scene !== 'ocean') return;
      if (cmd.type === 'enter-space' || cmd.type === 'focus-planet') {
        if (cmd.planetName) {
          const targetName = (cmd.planetName as SolarBodyName) || 'Earth';
          if (ALL_SOLAR_BODIES.includes(targetName)) {
            handleInspectBody(targetName);
          } else {
            galacticCtrlRef.current?.setOrbitPreset('solar');
          }
        } else {
          galacticCtrlRef.current?.startTour();
        }
      } else if (cmd.type === 'return-ocean') {
        setSavedRateBeforeInspect(null);
        galacticCtrlRef.current?.returnToOcean();
      } else if (cmd.type === 'jump-today') {
        setSavedRateBeforeInspect(null);
        galacticCtrlRef.current?.jumpToToday();
      } else if (cmd.type === 'set-controls-open') {
        setControlsOpen(cmd.open);
      }
    };
    window.addEventListener('kas:scene-command', onSceneCommand);
    return () => window.removeEventListener('kas:scene-command', onSceneCommand);
  }, [handleInspectBody]);

  const renderMode = prefs.renderMode;

  // Main 3D / Classic 2D Ocean, Alpine Bay & Gerstner Water Render Loop
  useEffect(() => {
    const mountEl = oceanMountRef.current;
    if (!mountEl) return;

    const is2d = renderMode === '2d';
    const oceanEngine = is2d ? null : createOcean3dEngine(mountEl);
    oceanEngineRef.current = oceanEngine;

    let glCanvas2d: HTMLCanvasElement | null = null;
    let overlayCanvas2d: HTMLCanvasElement | null = null;
    let glRenderer2d: ReturnType<typeof createOceanShaderRenderer> = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    const birdSys2d = is2d ? createHorizonBirdSystem() : null;

    if (is2d) {
      glCanvas2d = document.createElement('canvas');
      glCanvas2d.style.position = 'absolute';
      glCanvas2d.style.inset = '0';
      glCanvas2d.style.width = '100%';
      glCanvas2d.style.height = '100%';
      glCanvas2d.style.display = 'block';
      mountEl.appendChild(glCanvas2d);
      glRenderer2d = createOceanShaderRenderer(glCanvas2d);

      overlayCanvas2d = document.createElement('canvas');
      overlayCanvas2d.style.position = 'absolute';
      overlayCanvas2d.style.inset = '0';
      overlayCanvas2d.style.width = '100%';
      overlayCanvas2d.style.height = '100%';
      overlayCanvas2d.style.display = 'block';
      mountEl.appendChild(overlayCanvas2d);
      ctx2d = overlayCanvas2d.getContext('2d');
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
        if (oceanEngine) {
          oceanEngine.resize(w, h, dpr);
        } else if (overlayCanvas2d && glCanvas2d) {
          const pw = Math.max(1, Math.round(w * dpr));
          const ph = Math.max(1, Math.round(h * dpr));
          overlayCanvas2d.width = pw;
          overlayCanvas2d.height = ph;
          glCanvas2d.width = pw;
          glCanvas2d.height = ph;
        }
      }
    };

    const initBudget = computeSceneRenderBudget({
      framePacingMode: framePacingRef.current,
      qualityTier: qualityTierRef.current,
      gpuClass: gpuClassRef.current,
      nativeDpr: nativeDprRef.current,
      sceneKind: is2d ? '2d' : '3d-heavy',
      cssWidth: mountEl.clientWidth || window.innerWidth,
    });
    syncSize(initBudget.dpr);

    const ro = new ResizeObserver(() => {
      syncSize(lastDpr || initBudget.dpr);
    });
    ro.observe(mountEl);

    let autoFast = gpuClassRef.current !== 'discrete';
    let slowFrames = 0;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const rawDt = Math.max(0, now - lastTime);
      const cssW = mountEl.clientWidth || window.innerWidth;
      const budget = computeSceneRenderBudget({
        framePacingMode: framePacingRef.current,
        qualityTier:
          qualityModeRef.current === 'fast'
            ? qualityTierRef.current === 'potato'
              ? 'potato'
              : 'eco'
            : qualityModeRef.current === 'high'
              ? 'high'
              : qualityTierRef.current,
        gpuClass: gpuClassRef.current,
        nativeDpr: nativeDprRef.current,
        sceneKind: is2d ? '2d' : '3d-heavy',
        cssWidth: cssW,
      });

      if (budget.minFrameMs > 0 && rawDt < budget.minFrameMs - 0.6) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      const dt = Math.min(rawDt, 100);
      lastTime = now;

      if (qualityModeRef.current === 'auto' && !autoFast && dt > 26) {
        slowFrames += 1;
        if (slowFrames >= 20) {
          autoFast = true;
          setEffectiveFast(true);
        }
      } else if (dt <= 20) {
        slowFrames = Math.max(0, slowFrames - 1);
      }

      syncSize(budget.dpr);

      const sb = sandboxRef.current;
      const motionScale = (reducedMotion ? 0.4 : 1.0) * Math.max(0.2, sb.timeScale);
      const skyDurationMs = Math.max(1000, skyDurationRef.current * 1000);

      if (aiModeRef.current) {
        skyPhaseRef.current =
          (skyPhaseRef.current + (dt * motionScale) / skyDurationMs) % 1;
        wavePhaseRef.current =
          (wavePhaseRef.current +
            (dt * motionScale * waveSpeedRef.current) / BASE_WAVE_LOOP_MS) %
          1;
        driftPhaseRef.current =
          (driftPhaseRef.current + (dt * motionScale) / BASE_WAVE_LOOP_MS) % 1;
      } else {
        wavePhaseRef.current =
          (wavePhaseRef.current +
            (dt * motionScale * waveSpeedRef.current * 0.25) / BASE_WAVE_LOOP_MS) %
          1;
      }

      const liveSolar = evaluateBrokenArrowSolar(new Date());
      lunarPhaseRef.current = liveSolar.lunar.phaseFraction;
      const classicTerminatorDayFrac =
        0.72 + 0.08 * Math.sin(skyPhaseRef.current * Math.PI * 2);
      const activeDayFraction =
        skyModeRef.current === 'broken-arrow'
          ? liveSolar.clockDayFraction
          : classicTerminatorDayFrac;

      galacticCtrlRef.current?.syncParameters({
        moonPhaseFraction: liveSolar.lunar.phaseFraction,
        sunPhaseDayFraction: activeDayFraction,
      });

      // Pause 3D Ocean renders once Galactic camera is fully out in deep space
      if (oceanBlendRef.current < 0.995) {
        const targetBlend = skyModeRef.current === 'broken-arrow' ? 1 : 0;
        const blendRate = dt / 900;
        if (modeBlendRef.current < targetBlend) {
          modeBlendRef.current = Math.min(
            targetBlend,
            modeBlendRef.current + blendRate
          );
        } else if (modeBlendRef.current > targetBlend) {
          modeBlendRef.current = Math.max(
            targetBlend,
            modeBlendRef.current - blendRate
          );
        }

        const blend = modeBlendRef.current;
        const classicMoonArg =
          moonSyncModeRef.current === 'live'
            ? liveSolar.lunar.phaseFraction
            : undefined;
        let state: SunsetPaletteState;

        if (blend <= 0.001) {
          state = evaluateSunsetState(
            skyPhaseRef.current,
            wavePhaseRef.current,
            driftPhaseRef.current,
            classicMoonArg
          );
        } else if (blend >= 0.999) {
          state = evaluateBrokenArrowSunsetState(
            liveSolar,
            wavePhaseRef.current,
            driftPhaseRef.current
          );
        } else {
          const classicState = evaluateSunsetState(
            skyPhaseRef.current,
            wavePhaseRef.current,
            driftPhaseRef.current,
            classicMoonArg
          );
          const baState = evaluateBrokenArrowSunsetState(
            liveSolar,
            wavePhaseRef.current,
            driftPhaseRef.current
          );
          state = blendSunsetStates(classicState, baState, blend);
        }

        if (sb.solarElevation !== null) {
          state = {
            ...state,
            sunElevation: sb.solarElevation,
            sunVisible: Math.max(0, Math.min(1, (sb.solarElevation + 0.08) * 6)),
          };
        }

        const blendOut = oceanBlendRef.current;
        if (oceanEngine) {
          oceanEngine.render(
            {
              state,
              budget,
              shaderMood: sb.shaderMood,
              weather: sb.weather,
              waveChop: sb.waveChop * (0.65 + waveSpeedRef.current * 0.35),
              timeScale: sb.timeScale * (reducedMotion ? 0.45 : 1),
              freeOrbit: sb.freeOrbit,
              oceanOpacity: Math.max(0, Math.min(1, 1 - blendOut)),
              oceanScale: 1 - blendOut * 0.14,
            },
            dt / 1000
          );
        } else if (ctx2d && overlayCanvas2d && birdSys2d) {
          const cssH = mountEl.clientHeight || window.innerHeight;
          const pw = Math.max(1, Math.round(cssW * budget.dpr));
          const ph = Math.max(1, Math.round(cssH * budget.dpr));
          birdSys2d.update((dt / 1000) * Math.max(0.2, sb.timeScale), state.sunVisible);
          if (glRenderer2d) {
            glRenderer2d.render(pw, ph, state, budget.fastShader || autoFast);
          }
          ctx2d.save();
          ctx2d.setTransform(budget.dpr, 0, 0, budget.dpr, 0, 0);
          renderPainterlyWaves(
            ctx2d,
            cssW,
            cssH,
            state,
            Boolean(glRenderer2d),
            budget.fastShader || autoFast,
            birdSys2d
          );
          ctx2d.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      motionQuery.removeEventListener('change', handleMotionChange);
      oceanEngineRef.current = null;
      oceanEngine?.dispose();
      glRenderer2d?.dispose();
      if (glCanvas2d && glCanvas2d.parentNode === mountEl) {
        mountEl.removeChild(glCanvas2d);
      }
      if (overlayCanvas2d && overlayCanvas2d.parentNode === mountEl) {
        mountEl.removeChild(overlayCanvas2d);
      }
    };
  }, [renderMode]);

  const handleResetControls = () => {
    setWaveSpeed(DEFAULT_WAVE_SPEED);
    setSkyDurationSec(DEFAULT_SKY_DURATION_SEC);
  };

  const toggleSkyMode = () => {
    setSkyMode((prev) => (prev === 'classic' ? 'broken-arrow' : 'classic'));
  };

  const isLiveBrokenArrow = skyMode === 'broken-arrow';
  const daylightClamped = Math.max(0, Math.min(1, solar.daylightFraction));
  const isDaytime = solar.daylightFraction >= 0 && solar.daylightFraction <= 1;

  const isSpaceActive = galacticStatus.phase !== 'ocean';
  const oceanBlend = galacticStatus.oceanBlend;
  const oceanOpacity = Math.max(0, Math.min(1, 1 - oceanBlend));
  const oceanScale = 1 - oceanBlend * 0.14;

  const bodyTelemetry = useMemo(
    () =>
      isSpaceActive
        ? buildSelectedBodyTelemetry(
            galacticStatus.selectedBody,
            new Date(galacticStatus.simDateMs),
            prefs.spaceUnit
          )
        : null,
    [
      galacticStatus.selectedBody,
      galacticStatus.simDateMs,
      isSpaceActive,
      prefs.spaceUnit,
    ]
  );

  const cycleInspectBody = (dir: -1 | 1) => {
    const idx = ALL_SOLAR_BODIES.indexOf(galacticStatus.selectedBody);
    const nextIdx =
      (idx + dir + ALL_SOLAR_BODIES.length) % ALL_SOLAR_BODIES.length;
    handleInspectBody(ALL_SOLAR_BODIES[nextIdx]);
  };

  const TIME_WARP_OPTIONS = [
    { rate: 0, label: 'Pause' },
    { rate: 1, label: 'Live' },
    { rate: 86400, label: '1d/s' },
    { rate: 2592000, label: '1mo/s' },
    { rate: 31557600, label: '1yr/s' },
  ];

  const isSwiss = prefs.skin === 'swiss';
  const cardStyle = isSwiss
    ? {
        backgroundColor: `rgba(248, 250, 252, ${Math.max(0.84, prefs.hudOpacity)})`,
        borderColor: 'rgba(15, 23, 42, 0.16)',
        color: '#0f172a',
      }
    : {
        backgroundColor: activePreset.hudBg,
        borderColor: activePreset.hudBorder,
        color: activePreset.hudText,
        opacity: Math.max(0.55, Math.min(1, prefs.hudOpacity + 0.08)),
      };

  return (
    <main
      aria-label="Seamless animated ocean at sunset"
      className="relative h-full w-full overflow-hidden bg-[#030612] select-none"
    >
      {/* Layer 0: Three.js 3D Galactic Zoom (Spinning Earth, Synced Moon & Solar System) */}
      <div
        ref={galacticMountRef}
        aria-hidden={!isSpaceActive}
        style={{
          opacity: isSpaceActive ? Math.min(1, oceanBlend * 1.35 + 0.1) : 0,
        }}
        className={`absolute inset-0 h-full w-full transition-opacity duration-150 ${
          galacticStatus.phase === 'orbiting'
            ? 'pointer-events-auto touch-none cursor-grab active:cursor-grabbing'
            : 'pointer-events-none'
        }`}
      />

      {/* Ocean Horizon Wrapper: 100% Three.js 3D Ridged Alpine Mountains + Gerstner Shader Water */}
      <div
        style={{
          opacity: oceanOpacity,
          transform: `scale(${oceanScale.toFixed(4)})`,
        }}
        className={`absolute inset-0 h-full w-full origin-center will-change-transform ${
          prefs.sandboxFreeOrbit && !isSpaceActive
            ? 'pointer-events-auto touch-none cursor-grab active:cursor-grabbing'
            : 'pointer-events-none'
        }`}
      >
        <div
          ref={oceanMountRef}
          className="h-full w-full touch-none"
        />
      </div>

      {/* Top-Left Odyssey Chronometer & Live Broken Arrow Astronomy Plaque */}
      {!zenMode && (
      <section
        data-tour-id="ocean-plaque"
        aria-label="Broken Arrow Oklahoma live clock and astronomy ephemeris"
        style={cardStyle}
        className={`absolute top-14 left-2 z-20 w-[316px] max-w-[calc(100%-1rem)] border p-3.5 shadow-xl md:top-3 md:left-3 ${
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
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-amber-200/85">
            <InfoBadge id="ocean-plaque" />
            <span className="truncate">Broken Arrow, OK</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{solar.dateLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0 text-slate-300">
              {source === 'live-api' ? 'Live' : 'Solar Math'}
            </span>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            title="Refresh live sunrise and sunset schedule"
            aria-label="Refresh live astronomy data"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-amber-300' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Live Wall Clock with Ticking Seconds */}
        <div className="mt-1 flex items-baseline gap-2">
          <time
            dateTime={solar.timeClock}
            className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-amber-50 sm:text-[26px]"
          >
            {solar.timeClock}
          </time>
          <span className="text-xs font-semibold tracking-wide text-amber-300">
            {solar.dayPeriod} {solar.tzAbbr}
          </span>
        </div>

        {/* Homeric Phase Title & Verse */}
        <div className="mt-2.5 border-t border-amber-300/15 pt-2.5">
          <div className="font-epic text-xs font-semibold tracking-wider text-amber-200">
            {isLiveBrokenArrow ? solar.homericTitle : 'Solar Horizon'}
          </div>
          <p className="font-verse mt-0.5 hidden text-[14px] leading-snug italic text-slate-200/90 sm:block">
            “
            {isLiveBrokenArrow
              ? solar.homericVerse
              : 'Across the wine-dark deep, dusk and golden dawn chase without end.'}
            ”
          </p>
        </div>

        {/* Sunrise / Sunset & Live Moon Ephemeris (unboxed inline metadata) */}
        <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-300/90 tabular-nums">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>Sunrise {sunriseLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Sunset {sunsetLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{dayLengthLabel}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-slate-200">
              <span className="truncate font-medium text-amber-100">
                {lunar.phaseName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{lunar.illuminationPct}% lit</span>
            </div>

            <button
              type="button"
              onClick={() => setAlmanacOpen((prev) => !prev)}
              aria-expanded={almanacOpen}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-white/10 hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
            >
              <span>Almanac</span>
              <InfoBadge id="ocean-almanac" />
              {almanacOpen ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Lunar Calendar & Solar Altitude Drawer */}
        {almanacOpen && (
          <div className="mt-2.5 flex items-center gap-3 border-t border-white/10 pt-2.5 text-[11px] text-slate-300 tabular-nums">
            <LunarPhaseDisc
              phaseFraction={lunar.phaseFraction}
              isWaxing={lunar.isWaxing}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-x-1.5 text-slate-100">
                <span>Age {lunar.moonAgeDays.toFixed(1)}d</span>
                <span aria-hidden="true">·</span>
                <span>
                  Sun {solar.elevationDeg >= 0 ? '+' : ''}
                  {solar.elevationDeg.toFixed(1)}°
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-slate-300">
                <span>Next Full {lunar.nextFullMoonLabel}</span>
                <span aria-hidden="true">·</span>
                <span>Next New {lunar.nextNewMoonLabel}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Updated {lastUpdatedLabel}
              </div>
            </div>
          </div>
        )}

        {/* Primary Plaque Actions: Sync Sky & Galactic Zoom */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            data-tour-id="ocean-sync-sky"
            type="button"
            onClick={toggleSkyMode}
            aria-pressed={isLiveBrokenArrow}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
              isLiveBrokenArrow
                ? 'border-amber-300/45 bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'border-white/15 bg-white/8 text-slate-100 hover:bg-white/15'
            }`}
          >
            {isLiveBrokenArrow ? (
              <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Compass
                className="h-3.5 w-3.5 shrink-0 text-amber-300"
                aria-hidden="true"
              />
            )}
            <span className="truncate">
              {isLiveBrokenArrow ? 'BA Sky Live' : 'Sync BA Sky'}
            </span>
            <InfoBadge id="ocean-sync-sky" />
          </button>

          <button
            data-tour-id="ocean-space-view"
            type="button"
            onClick={() => {
              if (isSpaceActive) {
                galacticCtrlRef.current?.returnToOcean();
              } else {
                galacticCtrlRef.current?.startTour();
              }
            }}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
              isSpaceActive
                ? 'border-sky-300/50 bg-sky-400 text-slate-950 hover:bg-sky-300'
                : 'border-amber-300/35 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25'
            }`}
          >
            <Orbit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {isSpaceActive ? 'Back to Shore' : 'Space View'}
            </span>
            <InfoBadge id="ocean-space-view" />
          </button>
        </div>
      </section>
      )}

      {/* Projected 2D Clickable Planet Labels Layer */}
      {!zenMode &&
        isSpaceActive &&
        showSpaceLabels &&
        oceanBlend > 0.35 &&
        bodyLabels.length > 0 && (
          <div
            aria-label="Solar system clickable labels"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          >
            {bodyLabels.map((lbl) =>
              lbl.visible ? (
                <button
                  key={lbl.name}
                  type="button"
                  onClick={() => handleInspectBody(lbl.name)}
                  style={{
                    transform: `translate(${lbl.x.toFixed(1)}px, ${lbl.y.toFixed(1)}px) translate(-50%, -140%)`,
                    color: lbl.selected ? '#0f172a' : lbl.color,
                    backgroundColor: lbl.selected
                      ? lbl.color
                      : 'rgba(3, 6, 18, 0.78)',
                    borderColor: lbl.selected
                      ? lbl.color
                      : 'rgba(255, 255, 255, 0.22)',
                  }}
                  className="pointer-events-auto absolute top-0 left-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap transition-transform hover:scale-105 focus-visible:outline-none"
                >
                  {lbl.name}
                </button>
              ) : null
            )}
          </div>
        )}

      {/* Bottom-Center Galactic Zoom J2000 Flight & Time-Warp Dock */}
      {!zenMode && isSpaceActive && (
        <nav
          data-tour-id="space-dock"
          aria-label="Galactic Zoom flight controls"
          className="no-scrollbar absolute bottom-16 left-1/2 z-30 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 flex-nowrap items-center justify-start gap-1.5 overflow-x-auto rounded-xl border border-amber-300/25 bg-slate-950/94 px-3 py-2 text-slate-100 shadow-2xl sm:flex-wrap sm:justify-center sm:overflow-visible md:bottom-14"
        >
          <div className="flex shrink-0 items-center gap-1.5 pr-1">
            <Globe
              className="h-3.5 w-3.5 shrink-0 text-sky-300"
              aria-hidden="true"
            />
            <span className="text-[11px] font-medium whitespace-nowrap text-amber-100">
              {galacticStatus.stageLabel}
            </span>
          </div>

          {galacticStatus.phase === 'touring' && (
            <div
              className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-800 sm:block"
              aria-hidden="true"
            >
              <div
                className="h-full bg-amber-400 transition-all duration-100"
                style={{
                  width: `${Math.round(galacticStatus.tourProgress * 100)}%`,
                }}
              />
            </div>
          )}

          {/* Showcase vs True AU Scale Toggle */}
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/8 p-0.5"
            role="group"
            aria-label="Solar distance scale"
          >
            {(
              [
                { id: 'showcase', label: 'Showcase' },
                { id: 'true-au', label: 'True AU' },
              ] as Array<{ id: SolarScaleMode; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => galacticCtrlRef.current?.setScaleMode(opt.id)}
                className={`h-6 rounded-md px-2 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  galacticStatus.scaleMode === opt.id
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <InfoBadge id="space-scale-mode" />
          </div>

          {/* Time Warp Controls */}
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/8 p-0.5"
            role="group"
            aria-label="J2000 simulation speed"
          >
            {TIME_WARP_OPTIONS.map((opt) => (
              <button
                key={opt.rate}
                type="button"
                onClick={() => {
                  setSavedRateBeforeInspect(null);
                  galacticCtrlRef.current?.setTimeRate(opt.rate);
                }}
                className={`h-6 rounded-md px-1.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  galacticStatus.timeRate === opt.rate
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSavedRateBeforeInspect(null);
                galacticCtrlRef.current?.jumpToToday();
              }}
              title="Sync ephemeris clock to exact real-time UTC today"
              className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium whitespace-nowrap text-sky-200 transition-colors hover:bg-white/10"
            >
              <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Today</span>
            </button>
            <InfoBadge id="space-time-warp" />
          </div>

          {/* Units & Belts toggles */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() =>
                updatePrefs({
                  spaceUnit: prefs.spaceUnit === 'metric' ? 'imperial' : 'metric',
                })
              }
              className="h-6 rounded-md border border-white/15 bg-white/8 px-2 text-[10px] font-medium whitespace-nowrap text-slate-200 hover:bg-white/15"
            >
              {prefs.spaceUnit === 'metric' ? 'KM' : 'MI'}
            </button>
            <button
              type="button"
              onClick={() => setShowSpaceLabels((p) => !p)}
              title="Toggle planet labels"
              className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium whitespace-nowrap ${
                showSpaceLabels
                  ? 'border-sky-300/35 bg-sky-400/20 text-sky-100'
                  : 'border-white/15 bg-white/8 text-slate-300'
              }`}
            >
              {showSpaceLabels ? (
                <Eye className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              <span>Labels</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBeltsAndGrid((p) => !p)}
              title="Toggle Asteroid/Kuiper belts and AU ecliptic grid"
              className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium whitespace-nowrap ${
                showBeltsAndGrid
                  ? 'border-amber-300/35 bg-amber-400/20 text-amber-100'
                  : 'border-white/15 bg-white/8 text-slate-300'
              }`}
            >
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Belts</span>
            </button>
            <InfoBadge id="space-labels-belts" />
          </div>

          {galacticStatus.phase === 'orbiting' && (
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/8 p-0.5">
              <button
                type="button"
                onClick={() => handleInspectBody('Earth')}
                className={`h-6 rounded-md px-2 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  galacticStatus.selectedBody === 'Earth'
                    ? 'bg-white/18 text-white'
                    : 'text-slate-300 hover:bg-white/12'
                }`}
              >
                Earth
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedRateBeforeInspect(null);
                  galacticCtrlRef.current?.setOrbitPreset('solar');
                }}
                className={`h-6 rounded-md px-2 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  galacticStatus.selectedBody === 'Sun'
                    ? 'bg-white/18 text-white'
                    : 'text-slate-300 hover:bg-white/12'
                }`}
              >
                System
              </button>
            </div>
          )}

          {galacticStatus.phase === 'touring' && (
            <button
              type="button"
              onClick={() => galacticCtrlRef.current?.pauseInOrbit()}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/18"
            >
              <Pause className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Explore Orbit</span>
            </button>
          )}

          {galacticStatus.phase === 'orbiting' && (
            <button
              type="button"
              onClick={() => galacticCtrlRef.current?.resumeTour()}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/18"
            >
              <Play className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Tour</span>
            </button>
          )}

          {galacticStatus.phase !== 'returning' && (
            <button
              type="button"
              onClick={() => {
                setSavedRateBeforeInspect(null);
                galacticCtrlRef.current?.returnToOcean();
              }}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-amber-400 px-2.5 text-[11px] font-semibold whitespace-nowrap text-slate-950 transition-colors hover:bg-amber-300"
            >
              <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Ocean</span>
            </button>
          )}
        </nav>
      )}

      {/* Right-Side J2000 Ephemeris Telemetry Inspection Card (replaces Ocean Controls when orbiting in Space) */}
      {!zenMode && galacticStatus.phase === 'orbiting' && bodyTelemetry && (
        <aside
          aria-label="Selected celestial body J2000 telemetry"
          style={cardStyle}
          className={`absolute right-2 bottom-30 left-2 z-20 max-h-[38dvh] w-auto overflow-y-auto border p-3.5 shadow-xl sm:left-auto sm:w-72 sm:max-w-[calc(100%-1.5rem)] md:top-14 md:right-3 md:bottom-auto md:max-h-none md:overflow-visible ${
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
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                {bodyTelemetry.meta.classification}
              </div>
              <h2 className="font-display text-base font-bold leading-tight">
                {bodyTelemetry.meta.name}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => cycleInspectBody(-1)}
                aria-label="Previous celestial body"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/8 hover:bg-white/15"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => cycleInspectBody(1)}
                aria-label="Next celestial body"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/8 hover:bg-white/15"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Inspection Time Pause / Resume Bar (Decision 2) */}
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-mono-num">
            <span>
              {bodyTelemetry.simIsoDate} · JD {bodyTelemetry.julianDay.toFixed(1)}
            </span>
            <button
              type="button"
              onClick={() => {
                const ctrl = galacticCtrlRef.current;
                if (!ctrl) return;
                if (galacticStatus.timeRate === 0) {
                  const resumeRate = savedRateBeforeInspect ?? 1;
                  setSavedRateBeforeInspect(null);
                  ctrl.setTimeRate(resumeRate);
                } else {
                  setSavedRateBeforeInspect(galacticStatus.timeRate);
                  ctrl.setTimeRate(0);
                }
              }}
              className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950 hover:bg-amber-300"
            >
              {galacticStatus.timeRate === 0
                ? savedRateBeforeInspect
                  ? 'Resume Warp'
                  : 'Resume'
                : 'Pause'}
            </button>
          </div>

          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-mono-num">
            <div>
              <dt className="text-[10px] opacity-65">Sun Distance</dt>
              <dd className="font-semibold">{bodyTelemetry.distSunDisplay}</dd>
            </div>
            <div>
              <dt className="text-[10px] opacity-65">Earth Distance</dt>
              <dd className="font-semibold">{bodyTelemetry.distEarthDisplay}</dd>
            </div>
            <div>
              <dt className="text-[10px] opacity-65">Ecliptic Lon / Lat</dt>
              <dd className="font-semibold">
                {bodyTelemetry.state.lambdaDeg.toFixed(1)}° /{' '}
                {bodyTelemetry.state.betaDeg >= 0 ? '+' : ''}
                {bodyTelemetry.state.betaDeg.toFixed(2)}°
              </dd>
            </div>
            <div>
              <dt className="text-[10px] opacity-65">Orbital Speed</dt>
              <dd className="font-semibold">{bodyTelemetry.speedDisplay}</dd>
            </div>
            <div>
              <dt className="text-[10px] opacity-65">Axial Tilt</dt>
              <dd className="font-semibold">
                {bodyTelemetry.meta.axialTiltDeg.toFixed(2)}°
                {bodyTelemetry.meta.rotationPeriodHours < 0 ? ' (Retro)' : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] opacity-65">Eccentricity / Inc</dt>
              <dd className="font-semibold">
                e={bodyTelemetry.meta.eccentricity.toFixed(3)} ·{' '}
                {bodyTelemetry.meta.inclinationDeg.toFixed(1)}°
              </dd>
            </div>
          </dl>

          {bodyTelemetry.meta.moons.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-2 text-[10px] opacity-80">
              <span className="font-semibold opacity-95">Moons: </span>
              <span>
                {bodyTelemetry.meta.moons.map((m) => m.name).join(', ')}
              </span>
            </div>
          )}
        </aside>
      )}

      {/* Floating Ocean & Sky Controls Overlay (no backdrop-blur over animated canvases; clears UnifiedHudOverlay) */}
      {!zenMode && !isSpaceActive && (
      <aside
        data-tour-id="ocean-controls-panel"
        aria-label="Ocean and sky timing controls"
        style={cardStyle}
        className={`absolute right-2 bottom-16 left-2 z-20 max-h-[45dvh] w-auto overflow-y-auto border p-3.5 shadow-xl sm:left-auto sm:w-72 sm:max-w-[calc(100%-1.5rem)] md:top-14 md:right-3 md:bottom-auto md:max-h-none md:overflow-visible ${
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
          <button
            type="button"
            onClick={() => setControlsOpen((prev) => !prev)}
            aria-expanded={controlsOpen}
            className="inline-flex h-8 items-center gap-2 rounded-md px-1.5 text-xs font-semibold tracking-wide text-slate-100 whitespace-nowrap transition-colors duration-150 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
          >
            <SlidersHorizontal
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>Ocean Controls</span>
            <InfoBadge id="ocean-controls-panel" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAiMode((prev) => !prev)}
              aria-pressed={aiMode}
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                aiMode
                  ? 'border-amber-300/45 bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'border-white/15 bg-white/8 text-slate-100 hover:bg-white/15'
              }`}
            >
              {aiMode ? (
                <Bot className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <Hand className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              <span>{aiMode ? 'Auto' : 'Manual'}</span>
            </button>

            {controlsOpen && (
              <button
                type="button"
                onClick={handleResetControls}
                className="h-7 rounded-md px-2 text-xs font-medium text-slate-300 whitespace-nowrap transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {controlsOpen && (
          <div className="mt-3 flex flex-col gap-3.5">
            {/* Sky Mode Switcher */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                  Sky Mode <InfoBadge id="ocean-sky-mode" />
                </span>
                <span className="text-[11px] text-amber-300/90">
                  {isLiveBrokenArrow ? 'Broken Arrow' : 'Classic Loop'}
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1"
                role="group"
                aria-label="Sky cycle mode"
              >
                <button
                  type="button"
                  onClick={() => setSkyMode('classic')}
                  className={`h-7 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                    skyMode === 'classic'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Classic Cycle
                </button>
                <button
                  type="button"
                  onClick={() => setSkyMode('broken-arrow')}
                  className={`h-7 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                    skyMode === 'broken-arrow'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Broken Arrow
                </button>
              </div>
            </div>

            {/* Lunar Phase Sync Mode */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                  Moon Phase <InfoBadge id="ocean-moon-phase" />
                </span>
                <span className="text-[11px] text-slate-300">
                  {lunar.phaseName}
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1"
                role="group"
                aria-label="Moon phase synchronization"
              >
                <button
                  type="button"
                  onClick={() => setMoonSyncMode('live')}
                  className={`h-7 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                    moonSyncMode === 'live'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Live Tonight
                </button>
                <button
                  type="button"
                  onClick={() => setMoonSyncMode('cycle')}
                  className={`h-7 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                    moonSyncMode === 'cycle'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Mode Linked
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                  Wave Speed <InfoBadge id="ocean-wave-speed" />
                </span>
                <span className="font-mono tabular-nums text-amber-300">
                  {waveSpeed.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={3.0}
                step={0.05}
                value={waveSpeed}
                onChange={(e) => setWaveSpeed(parseFloat(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
              />
            </label>

            {skyMode === 'classic' ? (
              aiMode ? (
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      Sky Cycle Duration
                    </span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {skyDurationSec}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={1}
                    value={skyDurationSec}
                    onChange={(e) =>
                      setSkyDurationSec(parseInt(e.target.value, 10))
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      Manual Sky Phase
                    </span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {Math.round(manualSkyPhase * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.005}
                    value={manualSkyPhase}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setManualSkyPhase(v);
                      skyPhaseRef.current = v;
                    }}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
                  />
                </label>
              )
            ) : (
              <div className="flex flex-col gap-1.5 rounded-lg border border-amber-300/15 bg-white/5 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-amber-200">
                    Oklahoma Solar Arc
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-300">
                    {isDaytime ? 'Daylight' : 'Night Watch'}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{
                      width: `${isDaytime ? Math.round(daylightClamped * 100) : 100}%`,
                      opacity: isDaytime ? 1 : 0.35,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>{sunriseLabel}</span>
                  <span>{sunsetLabel}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                  Render Quality <InfoBadge id="ocean-quality" />
                </span>
                <span className="text-[11px] text-slate-400">
                  {qualityMode === 'auto'
                    ? effectiveFast
                      ? 'Auto (Fast)'
                      : 'Auto (High)'
                    : qualityMode === 'fast'
                      ? 'Fast 60fps'
                      : 'High'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1">
                {(['auto', 'fast', 'high'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQualityMode(mode)}
                    className={`h-7 rounded-md text-[11px] font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                      qualityMode === mode
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
      )}
    </main>
  );
}
