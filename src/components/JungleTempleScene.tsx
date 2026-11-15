import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Flame,
  Hand,
  Heart,
  Magnet,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
  type SceneRenderBudget,
} from '../utils/hardwareProfile';
import {
  createWeatherSystem,
  detectSoftwareWebGL,
  SHADER_MOOD_META,
  type ShaderMood,
  type WeatherFx,
} from '../utils/threeShaders';
import { safeReadStorage, safeWriteStorage } from '../utils/safeStorage';
import { computeAutoplayDecision } from '../temple/autoplayAI';
import { createExplorerRig, type ExplorerAction } from '../temple/explorerModel';
import { createParticlePool } from '../temple/particles';
import { createTempleTextures } from '../temple/textures';
import { createVistaBackdrop } from '../temple/vistaBackdrop';
import {
  CHUNK_LENGTH,
  LANE_X,
  TempleWorldGenerator,
  type TempleBiomeId,
  type TempleChunk,
} from '../temple/worldGenerator';

const JUMP_VELOCITY = 10.9;
const GRAVITY = 27.0;
const SLIDE_DURATION = 0.68;
const SPEED_BOOST_DURATION = 6.0;
const SHIELD_DURATION = 10.0;
const MAGNET_DURATION = 8.0;
const FEVER_DURATION = 6.5;
const COMBO_DECAY_SEC = 4.2;
const REVIVE_COST = 15;
const MAX_HEARTS = 3;
const CHUNKS_AHEAD = 5;
const BIOME_SPAN_METERS = 300;
const BEST_DISTANCE_KEY = 'jungle_temple_best_distance_v1';
const BEST_SCORE_KEY = 'jungle_temple_best_score_v55';

type GamePhase = 'playing' | 'gameover';
type DeathCause = 'crashed' | 'fell';
type QualityMode = 'auto' | 'fast' | 'high';

interface BiomePaletteDef {
  id: TempleBiomeId;
  label: string;
  accentHex: string;
  fogHex: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  sunColor: number;
  sunIntensity: number;
  zenith: number;
  mid: number;
  horizon: number;
  sunGlow: number;
  peakNear: number;
  peakFar: number;
  beam: number;
  stoneTint: number;
  moss: number;
  foliage: number;
  foliageLight: number;
  water: number;
  barrier: number;
}

const BIOMES: readonly BiomePaletteDef[] = [
  {
    id: 'emerald',
    label: 'Emerald Canopy',
    accentHex: '#34d399',
    fogHex: 0x213d34,
    fogDensity: 0.0072,
    hemiSky: 0xaadcc7,
    hemiGround: 0x243326,
    sunColor: 0xffcf88,
    sunIntensity: 2.65,
    zenith: 0x0c2124,
    mid: 0x275148,
    horizon: 0xd67e46,
    sunGlow: 0xffca7a,
    peakNear: 0x1d3b34,
    peakFar: 0x385249,
    beam: 0xffd788,
    stoneTint: 0xffffff,
    moss: 0x386634,
    foliage: 0x224e2b,
    foliageLight: 0x356d37,
    water: 0x164a4f,
    barrier: 0xc2552b,
  },
  {
    id: 'ember',
    label: 'Ember Caldera',
    accentHex: '#fb923c',
    fogHex: 0x382019,
    fogDensity: 0.0078,
    hemiSky: 0xffb892,
    hemiGround: 0x2b1712,
    sunColor: 0xff9352,
    sunIntensity: 2.75,
    zenith: 0x1c0d14,
    mid: 0x5c2720,
    horizon: 0xeb6c34,
    sunGlow: 0xffb366,
    peakNear: 0x2e1718,
    peakFar: 0x522923,
    beam: 0xffa15c,
    stoneTint: 0xeed9c9,
    moss: 0x6b3e24,
    foliage: 0x452b1c,
    foliageLight: 0x664026,
    water: 0x4c1d14,
    barrier: 0xef4444,
  },
  {
    id: 'jade',
    label: 'Moonlit Sanctum',
    accentHex: '#38bdf8',
    fogHex: 0x152736,
    fogDensity: 0.0074,
    hemiSky: 0x99d4ff,
    hemiGround: 0x182530,
    sunColor: 0xbfe3ff,
    sunIntensity: 2.45,
    zenith: 0x071022,
    mid: 0x19364f,
    horizon: 0x4a829c,
    sunGlow: 0xa3dcff,
    peakNear: 0x102233,
    peakFar: 0x234157,
    beam: 0xa6e3ff,
    stoneTint: 0xd6e6f2,
    moss: 0x1e5c5c,
    foliage: 0x143844,
    foliageLight: 0x1f525c,
    water: 0x0f3b57,
    barrier: 0xec4899,
  },
];

interface HudSnapshot {
  phase: GamePhase;
  deathCause: DeathCause;
  distance: number;
  score: number;
  bestDistance: number;
  bestScore: number;
  isNewBest: boolean;
  coins: number;
  hearts: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  biomeIndex: number;
  maneuver: string;
  speedTimer: number;
  shieldTimer: number;
  magnetTimer: number;
  feverTimer: number;
  doubleJumpReady: boolean;
  airborne: boolean;
  calloutText: string;
  calloutAccent: string;
}

function readBestInt(key: string): number {
  const raw = safeReadStorage(key);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function saveBestInt(key: string, val: number) {
  safeWriteStorage(key, String(Math.floor(val)));
}

function detectLowEndDevice(): boolean {
  if (detectSoftwareWebGL()) return true;
  if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') {
    return navigator.hardwareConcurrency <= 4;
  }
  return false;
}

interface JungleTempleSceneProps {
  globalAiMode: boolean;
  aiSyncVersion: number;
}

export default function JungleTempleScene({
  globalAiMode,
  aiSyncVersion,
}: JungleTempleSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const {
    prefs,
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

  const [autoplay, setAutoplay] = useState(globalAiMode);
  const autoplayRef = useRef(globalAiMode);
  const lastSyncRef = useRef(aiSyncVersion);
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  const [controlsOpen, setControlsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const qualityModeRef = useRef<QualityMode>('auto');
  const qualityTierRef = useRef(prefs.qualityTier);
  const framePacingRef = useRef<FramePacingMode>(prefs.framePacingMode);
  const gpuClassRef = useRef<GpuClass>(hardwareProfile.gpuClass);
  const nativeDprRef = useRef(hardwareProfile.nativeDpr);
  const reducedShakeRef = useRef(prefs.reducedShake);
  const sandboxRef = useRef<{
    shaderMood: ShaderMood;
    weather: WeatherFx;
    timeScale: number;
    gravityScale: number;
    invincible: boolean;
    freeOrbit: boolean;
  }>({
    shaderMood: prefs.shaderMood,
    weather: prefs.sandboxWeather,
    timeScale: prefs.sandboxTimeScale,
    gravityScale: prefs.sandboxGravityScale,
    invincible: prefs.sandboxTempleInvincible,
    freeOrbit: prefs.sandboxFreeOrbit,
  });
  const orbitStateRef = useRef({ yaw: 0, pitch: 0.28, dist: 7.4, dragging: false, lastX: 0, lastY: 0 });
  const modalOpenRef = useRef(paletteOpen || shortcutsOpen);
  const bumpRecordsRef = useRef(bumpRecords);
  const [effectiveFast, setEffectiveFast] = useState<boolean>(
    () => detectLowEndDevice() || hardwareProfile.gpuClass === 'igpu-uhd'
  );
  const applyQualityRef = useRef<((mode: QualityMode) => void) | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    phase: 'playing',
    deathCause: 'crashed',
    distance: 0,
    score: 0,
    bestDistance: readBestInt(BEST_DISTANCE_KEY),
    bestScore: readBestInt(BEST_SCORE_KEY),
    isNewBest: false,
    coins: 0,
    hearts: MAX_HEARTS,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    biomeIndex: 0,
    maneuver: 'Running',
    speedTimer: 0,
    shieldTimer: 0,
    magnetTimer: 0,
    feverTimer: 0,
    doubleJumpReady: true,
    airborne: false,
    calloutText: '',
    calloutAccent: '#fbbf24',
  }));
  const [contextLost, setContextLost] = useState(false);

  const slideHeldRef = useRef(false);

  useEffect(() => {
    reducedShakeRef.current = prefs.reducedShake;
    qualityTierRef.current = prefs.qualityTier;
    framePacingRef.current = prefs.framePacingMode;
    gpuClassRef.current = hardwareProfile.gpuClass;
    nativeDprRef.current = hardwareProfile.nativeDpr;
    sandboxRef.current = {
      shaderMood: prefs.shaderMood,
      weather: prefs.sandboxWeather,
      timeScale: prefs.sandboxTimeScale,
      gravityScale: prefs.sandboxGravityScale,
      invincible: prefs.sandboxTempleInvincible,
      freeOrbit: prefs.sandboxFreeOrbit,
    };
    if (!prefs.sandboxFreeOrbit) {
      orbitStateRef.current.yaw = 0;
      orbitStateRef.current.pitch = 0.28;
      orbitStateRef.current.dist = 7.4;
      orbitStateRef.current.dragging = false;
    }
    modalOpenRef.current = paletteOpen || shortcutsOpen;
    if (paletteOpen || shortcutsOpen) {
      slideHeldRef.current = false;
    }
    bumpRecordsRef.current = bumpRecords;
    applyQualityRef.current?.(qualityModeRef.current);
  }, [
    bumpRecords,
    hardwareProfile.gpuClass,
    hardwareProfile.nativeDpr,
    paletteOpen,
    prefs.framePacingMode,
    prefs.qualityTier,
    prefs.reducedShake,
    prefs.sandboxFreeOrbit,
    prefs.sandboxGravityScale,
    prefs.sandboxTempleInvincible,
    prefs.sandboxTimeScale,
    prefs.sandboxWeather,
    prefs.shaderMood,
    shortcutsOpen,
  ]);

  useEffect(() => {
    const mapped: QualityMode =
      prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato'
        ? 'fast'
        : prefs.qualityTier === 'high'
          ? 'high'
          : 'auto';
    setQualityMode(mapped);
  }, [prefs.qualityTier]);

  useEffect(() => {
    const topBest = Math.max(hud.bestDistance, records.bestTempleDistance);
    const activeBiome = BIOMES[hud.biomeIndex % BIOMES.length];
    reportTelemetry({
      scene: 'temple',
      title: released60 ? 'Temple Run 6.0' : 'Temple Run 5.5',
      status:
        hud.phase === 'gameover'
          ? 'Run Ended'
          : hud.feverTimer > 0
            ? `Fever · ${activeBiome.label}`
            : `${hud.maneuver} · ${activeBiome.label}`,
      metrics: [
        { label: 'Score', value: hud.score.toLocaleString(), accent: true },
        { label: 'Distance', value: `${hud.distance} m` },
        { label: 'Combo', value: hud.feverTimer > 0 ? `×${hud.multiplier} FEVER` : `×${hud.multiplier}` },
        { label: 'Best', value: `${topBest} m` },
      ],
    });
    if (hud.bestDistance > records.bestTempleDistance) {
      bumpRecords({}, { bestTempleDistance: hud.bestDistance });
    }
  }, [
    bumpRecords,
    hud.bestDistance,
    hud.biomeIndex,
    hud.distance,
    hud.feverTimer,
    hud.maneuver,
    hud.multiplier,
    hud.phase,
    hud.score,
    records.bestTempleDistance,
    released60,
    reportTelemetry,
  ]);

  const {
    playCoinChime,
    playJumpCue,
    playPowerUpCue,
    playShieldBreakCue,
    playHurtCue,
  } = useAudioManager();

  const audioRefs = useRef({
    playCoinChime,
    playJumpCue,
    playPowerUpCue,
    playShieldBreakCue,
    playHurtCue,
  });

  useEffect(() => {
    audioRefs.current = {
      playCoinChime,
      playJumpCue,
      playPowerUpCue,
      playShieldBreakCue,
      playHurtCue,
    };
  }, [playCoinChime, playJumpCue, playPowerUpCue, playShieldBreakCue, playHurtCue]);

  const manualQueueRef = useRef<{
    laneDelta: number;
    jump: boolean;
    slide: boolean;
  }>({ laneDelta: 0, jump: false, slide: false });

  const commandRef = useRef<{
    restart: boolean;
    revive: boolean;
  }>({ restart: false, revive: false });

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (aiSyncVersion !== lastSyncRef.current) {
      lastSyncRef.current = aiSyncVersion;
      setAutoplay(globalAiMode);
      autoplayRef.current = globalAiMode;
    }
  }, [globalAiMode, aiSyncVersion]);

  const toggleMode = useCallback(() => {
    setAutoplay((prev) => {
      const next = !prev;
      autoplayRef.current = next;
      return next;
    });
  }, []);

  const handleRestart = useCallback(() => {
    commandRef.current.restart = true;
  }, []);

  const handleRevive = useCallback(() => {
    commandRef.current.revive = true;
  }, []);

  useEffect(() => {
    qualityModeRef.current = qualityMode;
    applyQualityRef.current?.(qualityMode);
  }, [qualityMode]);

  useEffect(() => {
    const onSceneCommand = (e: Event) => {
      const cmd = (e as CustomEvent<SceneCommandPayload>).detail;
      if (!cmd || cmd.scene !== 'temple') return;
      if (cmd.type === 'restart') {
        commandRef.current.restart = true;
      } else if (cmd.type === 'set-controls-open') {
        setControlsOpen(cmd.open);
      }
    };
    window.addEventListener('kas:scene-command', onSceneCommand);
    return () => window.removeEventListener('kas:scene-command', onSceneCommand);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || modalOpenRef.current) {
        return;
      }
      if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        commandRef.current.restart = true;
        return;
      }
      if (autoplayRef.current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (!e.repeat) manualQueueRef.current.laneDelta = -1;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (!e.repeat) manualQueueRef.current.laneDelta = 1;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) manualQueueRef.current.jump = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        slideHeldRef.current = true;
        if (!e.repeat) {
          manualQueueRef.current.slide = true;
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        slideHeldRef.current = false;
      }
    };
    const onBlur = () => {
      slideHeldRef.current = false;
    };
    const onVisibility = () => {
      if (document.hidden) slideHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const initBudget = computeSceneRenderBudget({
      framePacingMode: framePacingRef.current,
      qualityTier: qualityTierRef.current,
      gpuClass: gpuClassRef.current,
      nativeDpr: nativeDprRef.current,
      sceneKind: '3d-light',
      cssWidth: Math.max(1, container.clientWidth),
    });
    const budgetRef: { current: SceneRenderBudget } = { current: initBudget };
    const initialLowEnd = isSoftwareGl || detectLowEndDevice() || initBudget.fastShader;
    let autoFastLatched = initialLowEnd;
    let fastMode =
      qualityModeRef.current === 'fast' ||
      (qualityModeRef.current === 'auto' && autoFastLatched);
    let slowFrames = 0;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !initialLowEnd,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(
      fastMode ? Math.min(1.0, initBudget.glScale) : Math.min(initBudget.dpr, 1.5)
    );
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !fastMode && !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(BIOMES[0].fogHex, BIOMES[0].fogDensity);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.25, 320);
    camera.position.set(0, 3.45, 7.4);

    // Skip expensive PMREM RoomEnvironment generation on iGPU / fastMode
    let envTarget: THREE.WebGLRenderTarget | null = null;
    if (!initialLowEnd) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envTarget = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      roomEnv.dispose();
      pmrem.dispose();
    }

    const vista = createVistaBackdrop();
    scene.add(vista.group);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(
      BIOMES[0].hemiSky,
      BIOMES[0].hemiGround,
      fastMode ? 1.42 : 1.05
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(BIOMES[0].sunColor, BIOMES[0].sunIntensity);
    sunLight.position.set(16, 24, -18);
    if (!isSoftwareGl && !initialLowEnd) {
      sunLight.castShadow = !fastMode;
      sunLight.shadow.mapSize.set(512, 512);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 90;
      sunLight.shadow.camera.left = -18;
      sunLight.shadow.camera.right = 18;
      sunLight.shadow.camera.top = 24;
      sunLight.shadow.camera.bottom = -24;
      sunLight.shadow.bias = -0.0008;
    }
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0xffe4b8, 0.25);
    rimLight.position.set(-12, 9, -14);
    scene.add(rimLight);
    scene.add(rimLight.target);

    const weatherSys = createWeatherSystem(320);
    scene.add(weatherSys.points);

    const syncQualitySettings = (mode: QualityMode) => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const effectiveTier =
        qualityTierRef.current === 'potato'
          ? 'potato'
          : mode === 'fast'
            ? 'eco'
            : mode === 'high'
              ? 'high'
              : qualityTierRef.current;
      const budget = computeSceneRenderBudget({
        framePacingMode: framePacingRef.current,
        qualityTier: effectiveTier,
        gpuClass: gpuClassRef.current,
        nativeDpr: nativeDprRef.current,
        sceneKind: '3d-light',
        cssWidth: w,
      });
      budgetRef.current = budget;
      const isPotato = effectiveTier === 'potato';
      const nextFast =
        isPotato ||
        mode === 'fast' ||
        (mode === 'auto' && (autoFastLatched || budget.fastShader));
      fastMode = nextFast;
      renderer.setPixelRatio(
        isPotato
          ? Math.min(0.65, budget.glScale)
          : nextFast
            ? Math.min(1.0, budget.glScale)
            : Math.min(budget.dpr, 1.5)
      );
      renderer.setSize(w, h);
      hemiLight.intensity = nextFast && !envTarget ? 1.42 : 1.05;
      const shadowsOn = !isPotato && !nextFast && !isSoftwareGl && !initialLowEnd;
      renderer.shadowMap.enabled = shadowsOn;
      sunLight.castShadow = shadowsOn;
      renderer.shadowMap.needsUpdate = true;
      setEffectiveFast(nextFast);
    };
    applyQualityRef.current = syncQualitySettings;
    setEffectiveFast(fastMode);

    // Pooled warm torch PointLights (1 hero torch on UHD 770 fastMode, 4 on discrete GPUs)
    const torchLights: THREE.PointLight[] = [];
    const maxTorchLights = initialLowEnd ? 1 : 4;
    for (let i = 0; i < maxTorchLights; i++) {
      const pl = new THREE.PointLight(0xff8e2b, 4.2, 16, 1.7);
      pl.position.set(0, -100, 0);
      scene.add(pl);
      torchLights.push(pl);
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createTempleTextures(initialLowEnd ? Math.min(2, maxAniso) : maxAniso);
    const worldGen = new TempleWorldGenerator(textures, !isSoftwareGl && !initialLowEnd, initialLowEnd);
    const explorer = createExplorerRig(!isSoftwareGl && !initialLowEnd);
    scene.add(explorer.root);

    const particles = createParticlePool(textures.particleSprite);
    scene.add(particles.points);

    // Streamed procedural chunks
    const chunks: TempleChunk[] = [];
    let nextChunkIndex = 0;
    const ensureChunksAhead = (playerZ: number) => {
      const neededChunk = Math.floor(-playerZ / CHUNK_LENGTH) + CHUNKS_AHEAD;
      while (nextChunkIndex <= neededChunk) {
        const chunk = worldGen.createChunk(nextChunkIndex);
        chunks.push(chunk);
        scene.add(chunk.group);
        nextChunkIndex++;
      }

      while (chunks.length > 0 && chunks[0].zEnd > playerZ + 22) {
        const old = chunks.shift()!;
        scene.remove(old.group);
        old.dispose();
      }
    };

    // Pre-allocated scratch vectors & biome color lerpers (Zero GC in render loop)
    const leftFootPos = new THREE.Vector3();
    const rightFootPos = new THREE.Vector3();
    const camTargetPos = new THREE.Vector3();
    const camLookTarget = new THREE.Vector3();
    const nearestTorches: { x: number; y: number; z: number; dist: number; phase: number }[] = [];

    const curFogCol = new THREE.Color(BIOMES[0].fogHex);
    const curHemiSky = new THREE.Color(BIOMES[0].hemiSky);
    const curHemiGnd = new THREE.Color(BIOMES[0].hemiGround);
    const curSunCol = new THREE.Color(BIOMES[0].sunColor);
    const curVistaPalette = {
      zenith: new THREE.Color(BIOMES[0].zenith),
      mid: new THREE.Color(BIOMES[0].mid),
      horizon: new THREE.Color(BIOMES[0].horizon),
      sunGlow: new THREE.Color(BIOMES[0].sunGlow),
      peakNear: new THREE.Color(BIOMES[0].peakNear),
      peakFar: new THREE.Color(BIOMES[0].peakFar),
      beam: new THREE.Color(BIOMES[0].beam),
    };
    const curWorldPalette = {
      stoneTint: new THREE.Color(BIOMES[0].stoneTint),
      moss: new THREE.Color(BIOMES[0].moss),
      foliage: new THREE.Color(BIOMES[0].foliage),
      foliageLight: new THREE.Color(BIOMES[0].foliageLight),
      water: new THREE.Color(BIOMES[0].water),
      barrier: new THREE.Color(BIOMES[0].barrier),
    };
    const scratchTargetCol = new THREE.Color();

    // Simulation State (Temple Run 5.5)
    let phase: GamePhase = 'playing';
    let deathCause: DeathCause = 'crashed';
    let playerZ = 0;
    let prevDistFloor = 0;
    let playerX = 0;
    let prevPlayerX = 0;
    let playerY = 0;
    let velY = 0;
    let targetLane = 1;
    let action: ExplorerAction = 'run';
    let doubleJumpsLeft = 1;
    let doubleJumpSpinTimer = 0;
    let slideTimer = 0;
    let slideElapsed = 0;
    let coyoteTimer = 0;
    let jumpBufferTimer = 0;
    let fastFallPendingSlide = false;
    let runPhase = 0;
    let prevSinPhase = 0;
    let coinsCollected = 0;
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let comboDecayTimer = 0;
    let biomeIndex = 0;
    let lastMilestoneDist = 0;
    let hearts = MAX_HEARTS;
    let bestDistance = readBestInt(BEST_DISTANCE_KEY);
    let bestScore = readBestInt(BEST_SCORE_KEY);
    let lastPersistedBestDist = bestDistance;
    let isNewBest = false;
    let speedBoostTimer = 0;
    let shieldTimer = 0;
    let magnetTimer = 0;
    let feverTimer = 0;
    let invulnTimer = 0;
    let stumbleTimer = 0;
    let shakeTimer = 0;
    let emberSpawnAccum = 0;
    let mistSpawnAccum = 0;
    let fireflySpawnAccum = 0;
    let speedParticleAccum = 0;
    let shieldParticleAccum = 0;
    let magnetParticleAccum = 0;
    let shieldOrbAngle = 0;
    let magnetOrbAngle = 0;
    let hudSyncAccum = 0;
    let currentManeuver = 'Running';
    let calloutText = '';
    let calloutAccent = '#fbbf24';
    let calloutTimer = 0;
    let elapsed = 0;

    const triggerCallout = (text: string, accent = '#fbbf24', duration = 2.0) => {
      calloutText = text;
      calloutAccent = accent;
      calloutTimer = duration;
    };

    const getMultiplier = () => {
      const baseMult = 1 + Math.min(4, Math.floor(combo / 4));
      return feverTimer > 0 ? baseMult * 2 : baseMult;
    };

    const addCombo = (amount: number) => {
      combo += amount;
      if (combo > maxCombo) maxCombo = combo;
      comboDecayTimer = COMBO_DECAY_SEC;
      if (combo >= 12 && feverTimer <= 0) {
        feverTimer = FEVER_DURATION;
        particles.spawnFeverBurst(playerX, playerY, playerZ);
        audioRefs.current.playPowerUpCue('fever');
        triggerCallout('GOLDEN FEVER! 2× SCORE', '#fde047', 2.4);
      }
    };

    const applyBiomeImmediate = (idx: number) => {
      const b = BIOMES[idx % BIOMES.length];
      curFogCol.setHex(b.fogHex);
      fog.color.copy(curFogCol);
      fog.density = b.fogDensity;
      curHemiSky.setHex(b.hemiSky);
      curHemiGnd.setHex(b.hemiGround);
      hemiLight.color.copy(curHemiSky);
      hemiLight.groundColor.copy(curHemiGnd);
      curSunCol.setHex(b.sunColor);
      sunLight.color.copy(curSunCol);
      sunLight.intensity = b.sunIntensity;

      curVistaPalette.zenith.setHex(b.zenith);
      curVistaPalette.mid.setHex(b.mid);
      curVistaPalette.horizon.setHex(b.horizon);
      curVistaPalette.sunGlow.setHex(b.sunGlow);
      curVistaPalette.peakNear.setHex(b.peakNear);
      curVistaPalette.peakFar.setHex(b.peakFar);
      curVistaPalette.beam.setHex(b.beam);
      vista.setBiomeColors(curVistaPalette);

      curWorldPalette.stoneTint.setHex(b.stoneTint);
      curWorldPalette.moss.setHex(b.moss);
      curWorldPalette.foliage.setHex(b.foliage);
      curWorldPalette.foliageLight.setHex(b.foliageLight);
      curWorldPalette.water.setHex(b.water);
      curWorldPalette.barrier.setHex(b.barrier);
      worldGen.applyBiomeColors(curWorldPalette);
    };

    const morphBiome = (idx: number, dt: number) => {
      const b = BIOMES[idx % BIOMES.length];
      const alpha = Math.min(1, dt * 1.35);

      scratchTargetCol.setHex(b.fogHex);
      curFogCol.lerp(scratchTargetCol, alpha);
      fog.color.copy(curFogCol);
      fog.density = THREE.MathUtils.lerp(fog.density, b.fogDensity, alpha);

      scratchTargetCol.setHex(b.hemiSky);
      curHemiSky.lerp(scratchTargetCol, alpha);
      hemiLight.color.copy(curHemiSky);
      scratchTargetCol.setHex(b.hemiGround);
      curHemiGnd.lerp(scratchTargetCol, alpha);
      hemiLight.groundColor.copy(curHemiGnd);

      scratchTargetCol.setHex(b.sunColor);
      curSunCol.lerp(scratchTargetCol, alpha);
      sunLight.color.copy(curSunCol);
      sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, b.sunIntensity, alpha);

      scratchTargetCol.setHex(b.zenith);
      curVistaPalette.zenith.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.mid);
      curVistaPalette.mid.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.horizon);
      curVistaPalette.horizon.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.sunGlow);
      curVistaPalette.sunGlow.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.peakNear);
      curVistaPalette.peakNear.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.peakFar);
      curVistaPalette.peakFar.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.beam);
      curVistaPalette.beam.lerp(scratchTargetCol, alpha);
      vista.setBiomeColors(curVistaPalette);

      scratchTargetCol.setHex(b.stoneTint);
      curWorldPalette.stoneTint.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.moss);
      curWorldPalette.moss.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.foliage);
      curWorldPalette.foliage.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.foliageLight);
      curWorldPalette.foliageLight.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.water);
      curWorldPalette.water.lerp(scratchTargetCol, alpha);
      scratchTargetCol.setHex(b.barrier);
      curWorldPalette.barrier.lerp(scratchTargetCol, alpha);
      worldGen.applyBiomeColors(curWorldPalette);
    };

    const resetRun = () => {
      if (bestDistance > lastPersistedBestDist) {
        lastPersistedBestDist = bestDistance;
        saveBestInt(BEST_DISTANCE_KEY, bestDistance);
      }
      saveBestInt(BEST_SCORE_KEY, bestScore);

      for (const chunk of chunks) {
        scene.remove(chunk.group);
        chunk.dispose();
      }
      chunks.length = 0;
      nextChunkIndex = 0;

      phase = 'playing';
      deathCause = 'crashed';
      playerZ = 0;
      prevDistFloor = 0;
      playerX = 0;
      prevPlayerX = 0;
      playerY = 0;
      velY = 0;
      targetLane = 1;
      action = 'run';
      doubleJumpsLeft = 1;
      doubleJumpSpinTimer = 0;
      slideTimer = 0;
      slideElapsed = 0;
      coyoteTimer = 0;
      jumpBufferTimer = 0;
      fastFallPendingSlide = false;
      runPhase = 0;
      prevSinPhase = 0;
      coinsCollected = 0;
      score = 0;
      combo = 0;
      maxCombo = 0;
      comboDecayTimer = 0;
      biomeIndex = 0;
      lastMilestoneDist = 0;
      hearts = MAX_HEARTS;
      isNewBest = false;
      speedBoostTimer = 0;
      shieldTimer = 0;
      magnetTimer = 0;
      feverTimer = 0;
      invulnTimer = 0;
      stumbleTimer = 0;
      shakeTimer = 0;
      calloutText = '';
      calloutTimer = 0;
      manualQueueRef.current = { laneDelta: 0, jump: false, slide: false };
      applyBiomeImmediate(0);
      ensureChunksAhead(0);

      setHud({
        phase: 'playing',
        deathCause: 'crashed',
        distance: 0,
        score: 0,
        bestDistance,
        bestScore,
        isNewBest: false,
        coins: 0,
        hearts: MAX_HEARTS,
        combo: 0,
        maxCombo: 0,
        multiplier: 1,
        biomeIndex: 0,
        maneuver: autoplayRef.current ? 'Auto Cruise' : 'Running',
        speedTimer: 0,
        shieldTimer: 0,
        magnetTimer: 0,
        feverTimer: 0,
        doubleJumpReady: true,
        airborne: false,
        calloutText: '',
        calloutAccent: '#fbbf24',
      });
    };

    const isSolidAtZ = (z: number): boolean => {
      for (const c of chunks) {
        if (c.gap && z < c.gap.zStart - 0.15 && z > c.gap.zEnd + 0.15) {
          return false;
        }
      }
      return true;
    };

    const sampleGroundY = (z: number): number => {
      if (isSolidAtZ(z - 0.34) || isSolidAtZ(z + 0.34)) {
        return 0;
      }
      return -16.5;
    };

    const enterGameOver = (cause: DeathCause) => {
      if (phase === 'gameover') return;
      phase = 'gameover';
      deathCause = cause;
      action = 'crash';
      shakeTimer = 0.42;
      const dist = Math.floor(-playerZ);
      const roundedScore = Math.floor(score);
      if (dist > bestDistance) {
        bestDistance = dist;
        isNewBest = true;
      }
      if (roundedScore > bestScore) {
        bestScore = roundedScore;
        isNewBest = true;
      }
      lastPersistedBestDist = bestDistance;
      saveBestInt(BEST_DISTANCE_KEY, bestDistance);
      saveBestInt(BEST_SCORE_KEY, bestScore);

      audioRefs.current.playHurtCue();
      setHud({
        phase: 'gameover',
        deathCause: cause,
        distance: dist,
        score: roundedScore,
        bestDistance,
        bestScore,
        isNewBest,
        coins: coinsCollected,
        hearts: 0,
        combo,
        maxCombo,
        multiplier: getMultiplier(),
        biomeIndex,
        maneuver: cause === 'fell' ? 'Fell in Chasm' : 'Crashed',
        speedTimer: 0,
        shieldTimer: 0,
        magnetTimer: 0,
        feverTimer: 0,
        doubleJumpReady: false,
        airborne: false,
        calloutText: '',
        calloutAccent: '#fbbf24',
      });
    };

    const reviveRun = () => {
      if (phase !== 'gameover' || coinsCollected < REVIVE_COST) return;
      coinsCollected -= REVIVE_COST;
      hearts = 2;
      phase = 'playing';
      action = 'run';
      velY = 0;
      doubleJumpsLeft = 1;
      doubleJumpSpinTimer = 0;
      slideTimer = 0;
      slideElapsed = 0;
      coyoteTimer = 0.14;
      jumpBufferTimer = 0;
      fastFallPendingSlide = false;
      invulnTimer = 2.6;
      shieldTimer = Math.max(shieldTimer, 2.6);

      for (const c of chunks) {
        if (c.gap && playerZ <= c.gap.zStart + 0.5 && playerZ >= c.gap.zEnd - 1.2) {
          playerZ = c.gap.zEnd - 1.5;
          break;
        }
      }
      playerY = 0.15;
      targetLane = 1;
      playerX = LANE_X[1];
      prevPlayerX = playerX;
      manualQueueRef.current = { laneDelta: 0, jump: false, slide: false };
      particles.spawnShieldShatter(playerX, 0.5, playerZ);
      audioRefs.current.playPowerUpCue('shield');
      triggerCallout('REVIVED!', '#5eead4', 1.8);

      setHud({
        phase: 'playing',
        deathCause: 'crashed',
        distance: Math.floor(-playerZ),
        score: Math.floor(score),
        bestDistance,
        bestScore,
        isNewBest,
        coins: coinsCollected,
        hearts,
        combo,
        maxCombo,
        multiplier: getMultiplier(),
        biomeIndex,
        maneuver: 'Revived!',
        speedTimer: speedBoostTimer,
        shieldTimer,
        magnetTimer,
        feverTimer,
        doubleJumpReady: true,
        airborne: false,
        calloutText,
        calloutAccent,
      });
    };

    ensureChunksAhead(0);
    // Warm up shaders once at startup so first jump, powerup, or biome shift never stutters
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onPrepareCapture = () => {
      renderer.render(scene, camera);
    };
    window.addEventListener('kas:prepare-capture', onPrepareCapture);

    // Context loss / restore handlers
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      syncQualitySettings(qualityModeRef.current);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    resizeObserver?.observe(container);

    // Frame loop pacing (cached budget + SwiftShader fenceSync yielding)
    let cancelled = false;
    let rafId = 0;
    let timeoutId = 0;
    let lastNow = performance.now();

    const glContext = isSoftwareGl ? renderer.getContext() : null;
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' &&
      glContext instanceof WebGL2RenderingContext;

    const scheduleNext = (fn: () => void) => {
      if (cancelled) return;
      if (isSoftwareGl && isWebGL2) {
        const gl2 = glContext as WebGL2RenderingContext;
        const fence = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (fence) {
          const poll = () => {
            if (cancelled) {
              gl2.deleteSync(fence);
              return;
            }
            const status = gl2.clientWaitSync(fence, 0, 0);
            if (status === gl2.TIMEOUT_EXPIRED) {
              timeoutId = window.setTimeout(poll, 16);
              return;
            }
            gl2.deleteSync(fence);
            timeoutId = window.setTimeout(() => {
              if (!cancelled) rafId = requestAnimationFrame(fn);
            }, 80);
          };
          poll();
          return;
        }
      }
      rafId = requestAnimationFrame(fn);
    };

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const rawMs = now - lastNow;

      // Hardware-matched frame pacing gate using cached budgetRef (zero per-frame overhead)
      if (!isSoftwareGl && budgetRef.current.minFrameMs > 0 && rawMs < budgetRef.current.minFrameMs - 0.6) {
        scheduleNext(tick);
        return;
      }

      const rawDt = Math.min(0.05, Math.max(0.001, rawMs / 1000));
      const sb = sandboxRef.current;
      const dt = rawDt * Math.max(0.25, Math.min(2.0, sb.timeScale));
      lastNow = now;
      elapsed += dt;

      if (qualityModeRef.current === 'auto' && !autoFastLatched && !isSoftwareGl) {
        if (rawMs > 28) {
          slowFrames += 1;
          if (slowFrames >= 20) {
            autoFastLatched = true;
            syncQualitySettings('auto');
          }
        } else {
          slowFrames = Math.max(0, slowFrames - 1);
        }
      }

      if (commandRef.current.restart) {
        commandRef.current.restart = false;
        resetRun();
      }
      if (commandRef.current.revive) {
        commandRef.current.revive = false;
        reviveRun();
      }

      if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);
      if (calloutTimer > 0) {
        calloutTimer = Math.max(0, calloutTimer - dt);
        if (calloutTimer <= 0) calloutText = '';
      }

      const distance = -playerZ;
      const baseSpeed = 13.6 + Math.min(6.4, distance * 0.0068);
      const speedMult = speedBoostTimer > 0 ? 1.42 : feverTimer > 0 ? 1.18 : 1.0;
      const boostedSpeed = baseSpeed * speedMult;
      const speed =
        phase === 'gameover'
          ? 0
          : stumbleTimer > 0
            ? boostedSpeed * 0.68
            : boostedSpeed;

      // Speed-normalized jump arc keeps airtime consistent (scaled by Sandbox gravity)
      const speedRatio = Math.max(1, speed / 14.5);
      const effectiveJumpVel = JUMP_VELOCITY * Math.pow(speedRatio, 0.55);
      const effectiveGravity =
        GRAVITY * Math.pow(speedRatio, 1.35) * Math.max(0.25, Math.min(2.0, sb.gravityScale));

      if (phase === 'playing') {
        if (stumbleTimer > 0) stumbleTimer = Math.max(0, stumbleTimer - dt);
        if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
        if (speedBoostTimer > 0) speedBoostTimer = Math.max(0, speedBoostTimer - dt);
        if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - dt);
        if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
        if (feverTimer > 0) feverTimer = Math.max(0, feverTimer - dt);
        if (doubleJumpSpinTimer > 0) doubleJumpSpinTimer = Math.max(0, doubleJumpSpinTimer - dt);

        if (combo > 0) {
          comboDecayTimer -= dt;
          if (comboDecayTimer <= 0) {
            combo = 0;
          }
        }

        // Biome cycling every 300m + smooth visual morphing
        const nextBiomeIndex = Math.floor(distance / BIOME_SPAN_METERS) % BIOMES.length;
        if (nextBiomeIndex !== biomeIndex) {
          biomeIndex = nextBiomeIndex;
          triggerCallout(`ENTERING ${BIOMES[biomeIndex].label.toUpperCase()}`, BIOMES[biomeIndex].accentHex, 2.5);
          audioRefs.current.playPowerUpCue('fever');
        }
        morphBiome(biomeIndex, dt);

        // Distance score & 500m milestone celebration
        const curDistFloor = Math.floor(distance);
        if (curDistFloor > prevDistFloor) {
          const deltaM = curDistFloor - prevDistFloor;
          prevDistFloor = curDistFloor;
          score += deltaM * 10 * getMultiplier();
          if (curDistFloor >= lastMilestoneDist + 250 && curDistFloor > 0) {
            lastMilestoneDist = Math.floor(curDistFloor / 250) * 250;
            if (!calloutText) {
              triggerCallout(`${lastMilestoneDist}m MILESTONE!`, '#fbbf24', 1.9);
            }
          }
        }

        const preGroundY = sampleGroundY(playerZ);
        const groundedBefore = preGroundY >= 0 && playerY <= 0.08 && action !== 'jump';
        coyoteTimer = groundedBefore ? 0.14 : Math.max(0, coyoteTimer - dt);
        if (groundedBefore) {
          doubleJumpsLeft = 1;
        }

        // 1. AI Decision or Manual Input (Jump, Double-Jump Vault, Slide, Fast-Fall)
        if (autoplayRef.current) {
          const decision = computeAutoplayDecision({
            playerZ,
            playerY,
            currentLane: targetLane,
            action,
            runSpeed: speed,
            doubleJumpsLeft,
            chunks,
          });
          targetLane = decision.targetLane;
          currentManeuver = decision.statusLabel;

          if (decision.wantJump) {
            if (playerY <= 0.06 && action !== 'jump') {
              velY = effectiveJumpVel;
              action = 'jump';
              doubleJumpsLeft = 1;
              doubleJumpSpinTimer = 0;
              slideTimer = 0;
              slideElapsed = 0;
              coyoteTimer = 0;
              particles.spawnDust(playerX, 0.05, playerZ, 7, 0.45);
              audioRefs.current.playJumpCue();
            } else if (action === 'jump' && doubleJumpsLeft > 0) {
              doubleJumpsLeft = 0;
              velY = effectiveJumpVel * 0.92;
              doubleJumpSpinTimer = 0.44;
              particles.spawnDoubleJumpRing(playerX, playerY, playerZ);
              audioRefs.current.playJumpCue();
            }
          } else if (decision.wantSlide && playerY <= 0.08 && action !== 'jump') {
            if (action !== 'slide') {
              slideElapsed = 0;
              particles.spawnDust(playerX, 0.08, playerZ + 0.2, 6, 0.4);
            }
            action = 'slide';
            slideTimer = Math.max(slideTimer, 0.38);
          }
        } else {
          const q = manualQueueRef.current;
          if (q.laneDelta !== 0) {
            targetLane = Math.max(0, Math.min(2, targetLane + q.laneDelta));
            q.laneDelta = 0;
          }
          if (q.jump) {
            q.jump = false;
            if ((playerY <= 0.08 || coyoteTimer > 0) && action !== 'jump') {
              if (playerY < 0) playerY = 0;
              velY = effectiveJumpVel;
              action = 'jump';
              doubleJumpsLeft = released60Ref.current ? 2 : 1;
              doubleJumpSpinTimer = 0;
              slideTimer = 0;
              slideElapsed = 0;
              coyoteTimer = 0;
              jumpBufferTimer = 0;
              fastFallPendingSlide = false;
              particles.spawnDust(playerX, 0.05, playerZ, 7, 0.45);
              audioRefs.current.playJumpCue();
            } else if (action === 'jump' && doubleJumpsLeft > 0 && playerY > 0.08) {
              // Temple Run 5.5 Aerial Double Vault / 6.0 Triple-Jump Cloud Vault!
              const isThirdVault = released60Ref.current && doubleJumpsLeft === 1;
              doubleJumpsLeft = Math.max(0, doubleJumpsLeft - 1);
              velY = effectiveJumpVel * (isThirdVault ? 0.96 : 0.92);
              doubleJumpSpinTimer = 0.44;
              fastFallPendingSlide = false;
              jumpBufferTimer = 0;
              const bonusPts = (isThirdVault ? 65 : 40) * getMultiplier();
              score += bonusPts;
              particles.spawnDoubleJumpRing(playerX, playerY, playerZ);
              audioRefs.current.playJumpCue();
              triggerCallout(
                isThirdVault ? `6.0 TRIPLE VAULT +${bonusPts}` : `AIR VAULT +${bonusPts}`,
                isThirdVault ? '#fbbf24' : '#5eead4',
                1.2
              );
            } else {
              jumpBufferTimer = 0.15;
            }
          } else if (jumpBufferTimer > 0) {
            jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
          }

          if (q.slide) {
            q.slide = false;
            if (action === 'jump' || playerY > 0.12) {
              velY = Math.min(velY, -16.8);
              fastFallPendingSlide = true;
              jumpBufferTimer = 0;
            } else if (action !== 'slide') {
              action = 'slide';
              slideTimer = SLIDE_DURATION;
              slideElapsed = 0;
              particles.spawnDust(playerX, 0.08, playerZ + 0.2, 6, 0.4);
            }
          } else if (slideHeldRef.current && action === 'run' && playerY <= 0.08) {
            action = 'slide';
            slideTimer = SLIDE_DURATION;
            slideElapsed = 0;
            particles.spawnDust(playerX, 0.08, playerZ + 0.2, 5, 0.35);
          }

          currentManeuver =
            doubleJumpSpinTimer > 0
              ? 'Air Vault'
              : action === 'jump'
                ? 'Jumping'
                : action === 'slide'
                  ? slideHeldRef.current
                    ? 'Sliding (Hold)'
                    : 'Sliding'
                  : 'Running';
        }

        // 2. Sub-stepped Explorer Z/Y Kinematics
        prevPlayerX = playerX;
        playerX = THREE.MathUtils.damp(playerX, LANE_X[targetLane], 14.5, dt);
        const lateralVel = (playerX - prevPlayerX) / dt;

        const stepCount = Math.min(6, Math.max(1, Math.ceil((speed * dt) / 0.35)));
        const subDt = dt / stepCount;
        let groundY = preGroundY;

        for (let s = 0; s < stepCount; s++) {
          if (phase !== 'playing') break;
          playerZ -= speed * subDt;
          groundY = sampleGroundY(playerZ);

          if (action === 'jump' || playerY > groundY + 0.01) {
            velY -= effectiveGravity * subDt;
            playerY += velY * subDt;

            if (groundY >= 0 && velY <= 2.5 && playerY <= groundY + 0.01 && playerY >= -0.58) {
              playerY = groundY;
              velY = 0;
              coyoteTimer = 0.14;
              doubleJumpsLeft = 1;
              doubleJumpSpinTimer = 0;
              if (fastFallPendingSlide || (slideHeldRef.current && !autoplayRef.current)) {
                fastFallPendingSlide = false;
                action = 'slide';
                slideTimer = SLIDE_DURATION * (slideHeldRef.current ? 1 : 0.88);
                slideElapsed = 0;
                particles.spawnDust(playerX, 0.07, playerZ + 0.1, 12, 0.65);
              } else if (jumpBufferTimer > 0 && !autoplayRef.current) {
                jumpBufferTimer = 0;
                coyoteTimer = 0;
                velY = effectiveJumpVel;
                action = 'jump';
                slideTimer = 0;
                slideElapsed = 0;
                particles.spawnDust(playerX, 0.05, playerZ, 7, 0.45);
                audioRefs.current.playJumpCue();
              } else {
                action = 'run';
                particles.spawnDust(playerX, 0.05, playerZ, 8, 0.52);
              }
            } else if (groundY < -5 && playerY < -2.4) {
              if (autoplayRef.current || sb.invincible) {
                playerY = 1.6;
                velY = effectiveJumpVel * 1.1;
                if (sb.invincible && !autoplayRef.current) {
                  triggerCallout('GOD MODE BOUNCE', '#38bdf8', 1.2);
                }
              } else {
                enterGameOver('fell');
                break;
              }
            }
          } else {
            playerY = Math.max(0, groundY);
            coyoteTimer = 0.14;
            doubleJumpsLeft = 1;
            if (jumpBufferTimer > 0 && !autoplayRef.current && action !== 'crash') {
              jumpBufferTimer = 0;
              coyoteTimer = 0;
              velY = effectiveJumpVel;
              action = 'jump';
              slideTimer = 0;
              slideElapsed = 0;
              particles.spawnDust(playerX, 0.05, playerZ, 7, 0.45);
              audioRefs.current.playJumpCue();
            }
          }
        }

        const isSlidingHeldNow = slideHeldRef.current && !autoplayRef.current;
        if (action === 'slide') {
          slideElapsed += dt;
          if (Math.random() < 0.52) {
            particles.spawnDust(playerX, 0.08, playerZ + 0.35, 1, 0.34);
          }
          if (isSlidingHeldNow) {
            slideTimer = Math.max(slideTimer, 0.16);
          } else {
            slideTimer -= dt;
            if (slideTimer <= 0) {
              action = 'run';
              slideTimer = 0;
              slideElapsed = 0;
            }
          }
        } else {
          slideElapsed = 0;
        }

        runPhase += dt * speed * 1.12;
        const curSin = Math.sin(runPhase);
        if (action === 'run' && playerY <= 0.04) {
          if ((prevSinPhase <= 0 && curSin > 0) || (prevSinPhase >= 0 && curSin < 0)) {
            explorer.getFootWorldPositions(leftFootPos, rightFootPos);
            const foot = curSin > 0 ? leftFootPos : rightFootPos;
            particles.spawnDust(foot.x, 0.04, foot.z + 0.22, 3, 0.24);
          }
        }
        prevSinPhase = curSin;

        // Power-Up Particle Emitters on Explorer
        if (speedBoostTimer > 0 || feverTimer > 0) {
          speedParticleAccum += dt;
          if (speedParticleAccum >= 0.03) {
            speedParticleAccum = 0;
            particles.spawnSpeedTrail(playerX, playerY, playerZ);
          }
        }
        if (shieldTimer > 0) {
          shieldParticleAccum += dt;
          shieldOrbAngle += dt * 7.5;
          if (shieldParticleAccum >= 0.045) {
            shieldParticleAccum = 0;
            particles.spawnShieldOrb(playerX, playerY, playerZ, shieldOrbAngle);
          }
        }
        if (magnetTimer > 0) {
          magnetParticleAccum += dt;
          magnetOrbAngle += dt * 6.5;
          if (magnetParticleAccum >= 0.055) {
            magnetParticleAccum = 0;
            particles.spawnMagnetPulse(playerX, playerY, playerZ, magnetOrbAngle);
          }
        }

        explorer.root.position.set(playerX, playerY, playerZ);
        explorer.updatePose({
          time: elapsed,
          runPhase,
          action,
          jumpVelY: velY,
          doubleJumpSpin: doubleJumpSpinTimer > 0 ? 1 - doubleJumpSpinTimer / 0.44 : 0,
          slideProgress: 1 - slideTimer / SLIDE_DURATION,
          slideElapsed,
          slideRemaining: slideTimer,
          slideHeld: isSlidingHeldNow,
          lateralVel,
          playerY,
          groundY,
          shieldActive: shieldTimer > 0,
          speedActive: speedBoostTimer > 0,
          magnetActive: magnetTimer > 0,
          feverActive: feverTimer > 0,
          hurtFlash: invulnTimer > 0 && shieldTimer <= 0,
        });
      } else {
        if (deathCause === 'fell' && playerY > -15) {
          velY -= GRAVITY * dt;
          playerY += velY * dt;
        }
        explorer.root.position.set(playerX, playerY, playerZ);
        explorer.updatePose({
          time: elapsed,
          runPhase,
          action: 'crash',
          jumpVelY: velY,
          doubleJumpSpin: 0,
          slideProgress: 0,
          lateralVel: 0,
          playerY,
          groundY: sampleGroundY(playerZ),
          shieldActive: false,
          speedActive: false,
          magnetActive: false,
          feverActive: false,
          hurtFlash: false,
        });
      }

      // 3. Stream Chunks & Animate World Elements
      ensureChunksAhead(playerZ);
      textures.waterfallMap.offset.y -= dt * 1.65;

      const playerLane =
        Math.abs(playerX - LANE_X[0]) < 1.2
          ? 0
          : Math.abs(playerX - LANE_X[2]) < 1.2
            ? 2
            : 1;
      const explorerTopY = playerY + (action === 'slide' ? 0.92 : 1.75);
      const explorerBottomY = playerY;

      nearestTorches.length = 0;
      emberSpawnAccum += dt;
      mistSpawnAccum += dt;
      fireflySpawnAccum += dt;
      const emberInterval = fastMode ? 0.18 : 0.08;
      const mistInterval = fastMode ? 0.2 : 0.09;
      const fireflyInterval = fastMode ? 0.36 : 0.16;
      const spawnEmberNow = emberSpawnAccum > emberInterval;
      if (spawnEmberNow) emberSpawnAccum = 0;
      const spawnMistNow = mistSpawnAccum > mistInterval;
      if (spawnMistNow) mistSpawnAccum = 0;

      if (fireflySpawnAccum > fireflyInterval) {
        fireflySpawnAccum = 0;
        const side = Math.random() < 0.5 ? -1 : 1;
        particles.spawnFirefly(
          side * (4.8 + Math.random() * 5.2),
          1.2 + Math.random() * 4.5,
          playerZ - 10 - Math.random() * 24
        );
      }

      const magnetRange =
        (magnetTimer > 0 ? 15.0 : feverTimer > 0 ? 10.5 : 0) *
        (released60Ref.current ? 1.2 : 1.0);

      for (const chunk of chunks) {
        for (const vine of chunk.vines) {
          vine.pivot.rotation.z = Math.sin(elapsed * 1.9 + vine.phase) * vine.amp;
          vine.pivot.rotation.x = Math.cos(elapsed * 1.4 + vine.phase) * (vine.amp * 0.6);
        }

        for (const torch of chunk.torches) {
          const flicker =
            0.88 +
            Math.sin(elapsed * 15 + torch.phase) * 0.14 +
            Math.cos(elapsed * 23 + torch.phase) * 0.08;
          torch.flameMesh.scale.set(0.95, flicker, 0.95);
          const dz = playerZ - torch.worldZ;
          if (dz > -6 && dz < 42) {
            nearestTorches.push({
              x: torch.worldX,
              y: torch.worldY,
              z: torch.worldZ,
              dist: Math.abs(dz),
              phase: torch.phase,
            });
            if (spawnEmberNow && dz < 28 && Math.random() < 0.45) {
              particles.spawnEmber(torch.worldX, torch.worldY + 0.1, torch.worldZ);
            }
          }
        }

        if (spawnMistNow) {
          for (const wf of chunk.waterfalls) {
            const dz = playerZ - wf.z;
            if (dz > -8 && dz < 48) {
              particles.spawnMist(wf.x * 0.85, wf.y + 1.5, wf.z);
            }
          }
        }

        // Coins spin, magnetic attraction & pickup
        for (const coin of chunk.coins) {
          if (coin.collected) continue;
          coin.mesh.rotation.y = elapsed * 3.1 + coin.id * 0.4;

          if (phase === 'playing') {
            if (magnetRange > 0 && Math.abs(playerZ - coin.z) < magnetRange) {
              const pullRate = Math.min(1, dt * 12.5);
              coin.x = THREE.MathUtils.lerp(coin.x, playerX, pullRate);
              coin.y = THREE.MathUtils.lerp(coin.y, playerY + 0.9, pullRate);
              coin.z = THREE.MathUtils.lerp(coin.z, playerZ - 0.15, pullRate);
              coin.mesh.position.set(coin.x, coin.y, coin.z - chunk.zStart);
            } else {
              coin.mesh.position.y = coin.y + Math.sin(elapsed * 3.6 + coin.id) * 0.08;
            }

            const dx = Math.abs(playerX - coin.x);
            const dz = Math.abs(playerZ - coin.z);
            const dy = Math.abs(playerY + 0.85 - coin.y);
            if (dx < 1.15 && dz < 1.25 && dy < 1.35) {
              coin.collected = true;
              coin.mesh.visible = false;
              coinsCollected += 1;
              addCombo(1);
              score += 25 * getMultiplier();
              particles.spawnCoinBurst(coin.x, coin.y, coin.z);
              audioRefs.current.playCoinChime();
            }
          }
        }

        // v5.5 Golden Track Boost Pads
        for (const pad of chunk.boostPads) {
          if (pad.triggered) continue;
          const pulse = 1 + Math.sin(elapsed * 7 + pad.id) * 0.06;
          pad.mesh.scale.set(pulse, 1, pulse);

          if (phase === 'playing') {
            const dx = Math.abs(playerX - pad.x);
            const dz = Math.abs(playerZ - pad.z);
            if (dx < 1.08 && dz < 1.25 && playerY < 0.72) {
              pad.triggered = true;
              speedBoostTimer = Math.max(speedBoostTimer, 2.0);
              addCombo(2);
              const pts = 150 * getMultiplier();
              score += pts;
              particles.spawnSpeedTrail(pad.x, playerY + 0.1, pad.z);
              audioRefs.current.playPowerUpCue('speed');
              triggerCallout(`BOOST PAD +${pts}`, '#fbbf24', 1.4);
            }
          }
        }

        // Power-Up Relics (Speed / Shield / Magnet) spin & pickup
        for (const pu of chunk.powerUps) {
          if (pu.collected) continue;
          pu.mesh.rotation.y = elapsed * 2.5 + pu.id;
          pu.mesh.rotation.x = Math.sin(elapsed * 2.0 + pu.id) * 0.25;
          pu.mesh.position.y = pu.y + Math.sin(elapsed * 3.2 + pu.id) * 0.14;

          if (phase === 'playing') {
            const dx = Math.abs(playerX - pu.x);
            const dz = Math.abs(playerZ - pu.z);
            const dy = Math.abs(playerY + 0.85 - pu.y);
            if (dx < 1.2 && dz < 1.3 && dy < 1.4) {
              pu.collected = true;
              pu.mesh.visible = false;
              addCombo(2);
              const pts = 200 * getMultiplier();
              score += pts;
              if (pu.kind === 'speed') {
                speedBoostTimer = SPEED_BOOST_DURATION;
                particles.spawnCoinBurst(pu.x, pu.y, pu.z);
                particles.spawnSpeedTrail(playerX, playerY, playerZ);
                triggerCallout(`SPEED RELIC +${pts}`, '#fbbf24', 1.6);
              } else if (pu.kind === 'magnet') {
                magnetTimer = MAGNET_DURATION;
                particles.spawnFeverBurst(pu.x, pu.y, pu.z);
                triggerCallout(`COIN MAGNET +${pts}`, '#e879f9', 1.7);
              } else {
                shieldTimer = SHIELD_DURATION;
                particles.spawnShieldShatter(pu.x, pu.y, pu.z);
                triggerCallout(`TEMPLE SHIELD +${pts}`, '#2dd4bf', 1.6);
              }
              audioRefs.current.playPowerUpCue(pu.kind);
            }
          }
        }

        // Obstacle Collision + Close Call Detection
        if (phase === 'playing') {
          for (const obs of chunk.obstacles) {
            if (obs.passed) continue;

            if (!autoplayRef.current && Math.abs(playerZ - obs.z) < obs.halfDepth + 0.28) {
              if (obs.lanes.includes(playerLane)) {
                const verticalOverlap =
                  explorerTopY > obs.minY + 0.08 && explorerBottomY < obs.maxY - 0.08;
                if (verticalOverlap) {
                  obs.passed = true;
                  if (sb.invincible) {
                    particles.spawnShieldShatter(playerX, playerY, playerZ);
                    audioRefs.current.playShieldBreakCue();
                    triggerCallout('INVINCIBLE SHATTER!', '#38bdf8', 1.1);
                  } else if (shieldTimer > 0) {
                    shieldTimer = 0;
                    invulnTimer = 1.2;
                    shakeTimer = 0.24;
                    particles.spawnShieldShatter(playerX, playerY, playerZ);
                    audioRefs.current.playShieldBreakCue();
                    triggerCallout('SHIELD SAVED!', '#2dd4bf', 1.4);
                  } else if (invulnTimer <= 0) {
                    hearts -= 1;
                    combo = 0;
                    feverTimer = 0;
                    invulnTimer = 1.3;
                    stumbleTimer = 0.5;
                    shakeTimer = 0.32;
                    particles.spawnDamageBurst(playerX, playerY, playerZ);
                    if (hearts <= 0) {
                      enterGameOver('crashed');
                    } else {
                      audioRefs.current.playHurtCue();
                    }
                  }
                  continue;
                }
              }
            }

            // Close Call reward when dodging over/under an obstacle cleanly!
            if (playerZ < obs.z - obs.halfDepth - 0.45) {
              obs.passed = true;
              if (obs.lanes.includes(playerLane)) {
                addCombo(1);
                const pts = 85 * getMultiplier();
                score += pts;
                if (!calloutText) {
                  triggerCallout(`CLOSE CALL +${pts}`, '#38bdf8', 1.15);
                }
              }
            }
          }
        }
      }

      nearestTorches.sort((a, b) => a.dist - b.dist);
      const isPotatoTier = qualityTierRef.current === 'potato';
      const activeTorchBudget =
        isPotatoTier || fastMode ? Math.min(1, torchLights.length) : torchLights.length;
      for (let i = 0; i < torchLights.length; i++) {
        const t = i < activeTorchBudget ? nearestTorches[i] : undefined;
        const pl = torchLights[i];
        if (t) {
          pl.position.set(t.x, t.y + 0.2, t.z);
          pl.intensity =
            3.8 + Math.sin(elapsed * 16 + t.phase) * 0.65 + Math.cos(elapsed * 25 + t.phase) * 0.35;
        } else {
          pl.intensity = 0;
        }
      }

      // 4. Particles, Weather FX, Shader Mood Rim Light & Vista Backdrop Anchor
      particles.update(dt);
      weatherSys.update(rawDt, sb.weather, explorer.root.position, budgetRef.current.particleScale);
      vista.update(playerZ, elapsed);
      sunLight.position.set(16, 24, playerZ - 14);
      sunLight.target.position.set(0, 0, playerZ - 18);
      sunLight.target.updateMatrixWorld();

      const moodMeta = SHADER_MOOD_META[sb.shaderMood];
      rimLight.color.setHex(moodMeta.rimHex);
      rimLight.intensity = 0.2 + moodMeta.rimStrength * 2.2;
      rimLight.position.set(playerX - 11, 8.5, playerZ - 14);
      rimLight.target.position.set(playerX, playerY + 1, playerZ);
      rimLight.target.updateMatrixWorld();
      if (sb.shaderMood !== 'standard') {
        scratchTargetCol.setHex(moodMeta.rimHex);
        fog.color.lerp(scratchTargetCol, 0.14);
      }

      // 5. Smooth Damped Third-Person Chase Camera (or Free 3D Orbit in Sandbox)
      const slideDip = action === 'slide' ? -0.22 : 0;
      const shakeScale = reducedShakeRef.current ? 0.25 : 1.0;
      const shakeX =
        shakeTimer > 0 ? Math.sin(elapsed * 58) * shakeTimer * 0.45 * shakeScale : 0;
      const shakeY =
        shakeTimer > 0 ? Math.cos(elapsed * 49) * shakeTimer * 0.38 * shakeScale : 0;

      if (sb.freeOrbit) {
        const orb = orbitStateRef.current;
        const focusX = playerX * 0.72;
        const focusY = 1.5 + Math.max(-1.0, playerY * 0.36);
        const horizDist = Math.cos(orb.pitch) * orb.dist;
        camTargetPos.set(
          focusX + Math.sin(orb.yaw) * horizDist + shakeX,
          focusY + Math.sin(orb.pitch) * orb.dist + shakeY,
          playerZ + Math.cos(orb.yaw) * horizDist
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, 9.5, rawDt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, 9.5, rawDt);
        camera.position.z = camTargetPos.z;
        camLookTarget.set(focusX, focusY, playerZ - 2.2);
        camera.lookAt(camLookTarget);
      } else {
        camTargetPos.set(
          playerX * 0.56 + shakeX,
          3.42 + Math.max(-1.2, playerY * 0.42) + slideDip + shakeY,
          playerZ + 7.4
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, 7.2, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, 7.6, dt);
        camera.position.z = camTargetPos.z;

        camLookTarget.set(
          playerX * 0.72,
          1.48 + Math.max(-1.0, playerY * 0.32) + slideDip * 0.4,
          playerZ - 11.5
        );
        camera.lookAt(camLookTarget);
      }

      const lateralCamRoll =
        !sb.freeOrbit && phase === 'playing' ? -(playerX - prevPlayerX) / Math.max(dt, 0.001) : 0;
      camera.rotation.z = THREE.MathUtils.damp(
        camera.rotation.z,
        -lateralCamRoll * 0.012,
        8.5,
        dt
      );

      const speedFovBonus = speedBoostTimer > 0 ? 7.0 : feverTimer > 0 ? 4.2 : 0;
      const aspectPad =
        camera.aspect < 1.5 ? Math.min(18, (1.5 - camera.aspect) * 26) : 0;
      const targetFov =
        53 + aspectPad + Math.max(0, baseSpeed - 13.6) * 0.95 + speedFovBonus;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 5.2, dt);
        camera.updateProjectionMatrix();
      }

      renderer.render(scene, camera);

      // Periodic HUD sync (~10 Hz) + debounced storage persistence
      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.1 && phase === 'playing') {
        hudSyncAccum = 0;
        const curDist = Math.floor(-playerZ);
        const curScore = Math.floor(score);
        if (curDist > bestDistance) {
          bestDistance = curDist;
          isNewBest = true;
          if (bestDistance >= lastPersistedBestDist + 20) {
            lastPersistedBestDist = bestDistance;
            saveBestInt(BEST_DISTANCE_KEY, bestDistance);
          }
        }
        if (curScore > bestScore) {
          bestScore = curScore;
        }
        setHud({
          phase,
          deathCause,
          distance: curDist,
          score: curScore,
          bestDistance,
          bestScore,
          isNewBest,
          coins: coinsCollected,
          hearts,
          combo,
          maxCombo,
          multiplier: getMultiplier(),
          biomeIndex,
          maneuver: currentManeuver,
          speedTimer: speedBoostTimer,
          shieldTimer,
          magnetTimer,
          feverTimer,
          doubleJumpReady: doubleJumpsLeft > 0,
          airborne: playerY > 0.1,
          calloutText,
          calloutAccent,
        });
      }

      scheduleNext(tick);
    };

    scheduleNext(tick);

    return () => {
      cancelled = true;
      applyQualityRef.current = null;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      saveBestInt(BEST_DISTANCE_KEY, bestDistance);
      saveBestInt(BEST_SCORE_KEY, bestScore);
      window.removeEventListener('kas:prepare-capture', onPrepareCapture);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      for (const chunk of chunks) {
        scene.remove(chunk.group);
        chunk.dispose();
      }
      chunks.length = 0;

      explorer.dispose();
      particles.dispose();
      weatherSys.dispose();
      worldGen.dispose();
      textures.dispose();
      vista.dispose();
      if (envTarget) envTarget.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    if (sandboxRef.current.freeOrbit) {
      orbitStateRef.current.dragging = true;
      orbitStateRef.current.lastX = e.clientX;
      orbitStateRef.current.lastY = e.clientY;
      return;
    }
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const triggerSwipeFromDelta = (dx: number, dy: number, threshold: number): boolean => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < threshold) return false;
    if (absX > absY) {
      manualQueueRef.current.laneDelta = dx > 0 ? 1 : -1;
    } else if (dy < 0) {
      manualQueueRef.current.jump = true;
    } else {
      manualQueueRef.current.slide = true;
    }
    return true;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit && orbitStateRef.current.dragging) {
      const dx = e.clientX - orbitStateRef.current.lastX;
      const dy = e.clientY - orbitStateRef.current.lastY;
      orbitStateRef.current.lastX = e.clientX;
      orbitStateRef.current.lastY = e.clientY;
      orbitStateRef.current.yaw = Math.max(
        -2.2,
        Math.min(2.2, orbitStateRef.current.yaw - dx * 0.007)
      );
      orbitStateRef.current.pitch = Math.max(
        0.04,
        Math.min(1.05, orbitStateRef.current.pitch + dy * 0.006)
      );
      return;
    }
    const start = pointerStartRef.current;
    if (!start || autoplayRef.current || hud.phase !== 'playing') return;
    if (e.pointerType !== 'touch' && e.buttons === 0) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (triggerSwipeFromDelta(dx, dy, 26)) {
      pointerStartRef.current = null;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    orbitStateRef.current.dragging = false;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (sandboxRef.current.freeOrbit) return;
    if (!start || autoplayRef.current || hud.phase !== 'playing') return;
    triggerSwipeFromDelta(e.clientX - start.x, e.clientY - start.y, 20);
  };

  const canRevive = hud.coins >= REVIVE_COST;
  const activeBiome = BIOMES[hud.biomeIndex % BIOMES.length];

  return (
    <div
      className="relative h-full w-full touch-none overflow-hidden bg-[#0e1f1b] select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartRef.current = null;
        orbitStateRef.current.dragging = false;
      }}
      onDoubleClick={() => {
        if (sandboxRef.current.freeOrbit) {
          orbitStateRef.current.yaw = 0;
          orbitStateRef.current.pitch = 0.28;
          orbitStateRef.current.dist = 7.4;
        }
      }}
      onWheel={(e) => {
        if (sandboxRef.current.freeOrbit) {
          orbitStateRef.current.dist = Math.max(
            4.2,
            Math.min(16, orbitStateRef.current.dist + e.deltaY * 0.005)
          );
        }
      }}
    >
      <div
        ref={mountRef}
        className="h-full w-full"
        aria-label="3D Temple Run 6.0 Endless Runner scene"
      />

      {contextLost && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c1815]/92 text-sm text-emerald-100">
          Restoring 3D Temple Run 5.5 graphics context...
        </div>
      )}

      {/* Real-time In-Game HUD (zero backdrop-blur over active WebGL canvas) */}
      {!zenMode && (
      <>
        <div className="pointer-events-none absolute top-14 right-2 left-2 z-20 flex flex-col gap-2 md:top-3 md:right-auto md:left-3">
          <div
            style={
              prefs.skin === 'swiss'
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
                  }
            }
            data-tour-id="temple-score-card"
            className="flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2 shadow-lg"
          >
            {/* Hearts */}
            <div className="flex items-center gap-1 pr-2.5 border-r border-white/15">
              <InfoBadge id="temple-score-card" className="mr-1" />
              {[0, 1, 2].map((idx) => {
                const active = idx < hud.hearts;
                return (
                  <Heart
                    key={idx}
                    className={`h-4 w-4 transition-colors duration-150 ${
                      active ? 'fill-rose-500 text-rose-400' : 'opacity-25'
                    }`}
                    aria-hidden="true"
                  />
                );
              })}
            </div>

            {/* Score & Combo */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/15">
              <Flame
                className="h-4 w-4"
                style={{ color: hud.feverTimer > 0 ? '#fde047' : activePreset.accent }}
                aria-hidden="true"
              />
              <div>
                <div className="text-[10px] font-semibold tracking-wider opacity-65 uppercase">
                  Score
                </div>
                <div className="font-mono-num flex items-center gap-1.5 text-xs font-semibold">
                  <span>{hud.score.toLocaleString()}</span>
                  {hud.multiplier > 1 && (
                    <span
                      className="rounded px-1 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: hud.feverTimer > 0 ? '#facc15' : activeBiome.accentHex,
                        color: '#090d16',
                      }}
                    >
                      ×{hud.multiplier}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Distance */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/15">
              <Compass className="h-4 w-4" style={{ color: activeBiome.accentHex }} aria-hidden="true" />
              <div>
                <div className="text-[10px] font-semibold tracking-wider opacity-65 uppercase">
                  {activeBiome.label}
                </div>
                <div className="font-mono-num text-xs font-semibold">
                  {hud.distance} m
                </div>
              </div>
            </div>

            {/* Coins */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/15">
              <Coins className="h-4 w-4" style={{ color: activePreset.accent }} aria-hidden="true" />
              <div>
                <div className="text-[10px] font-semibold tracking-wider opacity-65 uppercase">
                  Coins
                </div>
                <div className="font-mono-num text-xs font-semibold" style={{ color: activePreset.accent }}>
                  {hud.coins}
                </div>
              </div>
            </div>

            {/* Best Distance */}
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 opacity-80" style={{ color: activePreset.accent }} aria-hidden="true" />
              <div>
                <div className="text-[10px] font-semibold tracking-wider opacity-65 uppercase">
                  Best
                </div>
                <div className="font-mono-num text-xs font-semibold">
                  {hud.bestDistance} m
                </div>
              </div>
            </div>
          </div>

          {/* Active Power-Up Timers & Airborne Double Jump Indicator */}
          {(hud.speedTimer > 0 ||
            hud.shieldTimer > 0 ||
            hud.magnetTimer > 0 ||
            hud.feverTimer > 0 ||
            (hud.airborne && hud.doubleJumpReady)) && (
            <div className="flex flex-wrap items-center gap-2">
              {hud.feverTimer > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-yellow-300/45 bg-[#231b06]/92 px-3 py-1.5 text-xs text-yellow-200 shadow-md">
                  <Flame className="h-3.5 w-3.5 text-yellow-300" aria-hidden="true" />
                  <span className="font-semibold">Golden Fever 2×</span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-yellow-950">
                    <div
                      className="h-full bg-yellow-300"
                      style={{
                        width: `${Math.min(100, (hud.feverTimer / FEVER_DURATION) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono-num text-[11px]">{hud.feverTimer.toFixed(1)}s</span>
                </div>
              )}

              {hud.speedTimer > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-amber-400/35 bg-[#1b190d]/90 px-3 py-1.5 text-xs text-amber-200 shadow-md">
                  <Zap className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                  <span className="font-medium">Speed</span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-amber-950">
                    <div
                      className="h-full bg-amber-400"
                      style={{
                        width: `${Math.min(100, (hud.speedTimer / SPEED_BOOST_DURATION) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono-num text-[11px]">
                    {hud.speedTimer.toFixed(1)}s
                  </span>
                </div>
              )}

              {hud.magnetTimer > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-fuchsia-400/40 bg-[#230e26]/90 px-3 py-1.5 text-xs text-fuchsia-200 shadow-md">
                  <Magnet className="h-3.5 w-3.5 text-fuchsia-300" aria-hidden="true" />
                  <span className="font-medium">Magnet</span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-fuchsia-950">
                    <div
                      className="h-full bg-fuchsia-400"
                      style={{
                        width: `${Math.min(100, (hud.magnetTimer / MAGNET_DURATION) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono-num text-[11px]">
                    {hud.magnetTimer.toFixed(1)}s
                  </span>
                </div>
              )}

              {hud.shieldTimer > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-teal-300/35 bg-[#0c211e]/90 px-3 py-1.5 text-xs text-teal-200 shadow-md">
                  <Shield className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
                  <span className="font-medium">Shield</span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-teal-950">
                    <div
                      className="h-full bg-teal-300"
                      style={{
                        width: `${Math.min(100, (hud.shieldTimer / SHIELD_DURATION) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono-num text-[11px]">
                    {hud.shieldTimer.toFixed(1)}s
                  </span>
                </div>
              )}

              {hud.airborne && hud.doubleJumpReady && !autoplay && (
                <div className="flex items-center gap-1.5 rounded-md border border-cyan-300/35 bg-[#0b1f24]/90 px-2.5 py-1 text-[11px] font-medium text-cyan-200 shadow-md">
                  <Sparkles className="h-3 w-3 text-cyan-300" aria-hidden="true" />
                  <span>W / Space: Air Vault Ready</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Top Event Callout Banner (Biomes / Fever / Boost Pads / Close Calls) */}
        {hud.calloutText && hud.phase === 'playing' && (
          <div className="pointer-events-none absolute top-16 left-1/2 z-20 -translate-x-1/2">
            <div
              className="rounded-lg border px-3.5 py-1 text-xs font-bold tracking-wider uppercase shadow-lg"
              style={{
                backgroundColor: 'rgba(8, 16, 15, 0.9)',
                borderColor: hud.calloutAccent,
                color: hud.calloutAccent,
              }}
            >
              {hud.calloutText}
            </div>
          </div>
        )}

        {/* Mode Toggle, Quality Selector & Collapsible Controls Hint */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute top-29 right-2 z-20 flex flex-col items-end gap-1.5 md:top-14 md:right-3"
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            {controlsOpen && (
              <div
                data-tour-id="temple-quality"
                className="flex items-center gap-1 rounded-lg border border-emerald-200/20 bg-[#0b1815]/92 p-1 shadow-lg"
                role="group"
                aria-label="Render quality mode"
              >
                <span className="inline-flex items-center gap-1 px-1.5 text-[10px] font-semibold tracking-wider text-emerald-200/70 uppercase">
                  {qualityMode === 'auto'
                    ? effectiveFast
                      ? 'Auto·Fast'
                      : 'Auto·High'
                    : 'Quality'}
                  <InfoBadge id="temple-quality" />
                </span>
                {(['auto', 'fast', 'high'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQualityMode(mode)}
                    className={`h-7 rounded-md px-2 text-[11px] font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                      qualityMode === mode
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            <button
              data-tour-id="temple-auto-manual"
              type="button"
              onClick={toggleMode}
              aria-pressed={autoplay}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium shadow-lg transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                autoplay
                  ? 'border-amber-300/40 bg-[#142a22]/94 text-amber-200 hover:bg-[#19362b]'
                  : 'border-emerald-200/20 bg-[#0b1815]/92 text-emerald-100 hover:bg-[#132924]'
              }`}
            >
              {autoplay ? (
                <Bot className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              ) : (
                <Hand className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              )}
              <span>{autoplay ? 'Auto' : 'Manual'}</span>
              <InfoBadge id="temple-auto-manual" />
            </button>

            <button
              type="button"
              onClick={() => setControlsOpen((prev) => !prev)}
              aria-expanded={controlsOpen}
              aria-label={controlsOpen ? 'Collapse Temple Run options' : 'Expand Temple Run options'}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-emerald-200/20 bg-[#0b1815]/92 px-2.5 text-emerald-100 shadow-lg transition-colors hover:bg-[#132924] focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
            >
              {controlsOpen ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
              <InfoBadge id="temple-controls-btn" />
            </button>
          </div>

          {controlsOpen && !autoplay && hud.phase === 'playing' && (
            <div className="rounded-md border border-emerald-200/15 bg-[#0b1815]/90 px-2.5 py-1 text-[11px] text-emerald-100/85 shadow-md">
              Swipe or use pads on mobile · A/D Lanes · W/Space Jump · S Slide · R Restart
            </div>
          )}
        </div>

        {/* Mobile Thumb Touch Controls in Manual Mode */}
        {!autoplay && hud.phase === 'playing' && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="pointer-events-none absolute right-2 bottom-16 left-2 z-20 flex items-center justify-between gap-2 md:hidden"
          >
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Steer left"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  manualQueueRef.current.laneDelta = -1;
                }}
                className="flex h-11 w-12 items-center justify-center rounded-xl border border-emerald-200/25 bg-[#0b1815]/88 text-base font-bold text-emerald-100 shadow-lg active:scale-95 active:bg-emerald-400 active:text-slate-950"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Steer right"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  manualQueueRef.current.laneDelta = 1;
                }}
                className="flex h-11 w-12 items-center justify-center rounded-xl border border-emerald-200/25 bg-[#0b1815]/88 text-base font-bold text-emerald-100 shadow-lg active:scale-95 active:bg-emerald-400 active:text-slate-950"
              >
                →
              </button>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Slide under trap"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  slideHeldRef.current = true;
                  manualQueueRef.current.slide = true;
                }}
                onPointerUp={() => {
                  slideHeldRef.current = false;
                }}
                onPointerCancel={() => {
                  slideHeldRef.current = false;
                }}
                className="flex h-11 items-center justify-center rounded-xl border border-emerald-200/25 bg-[#0b1815]/88 px-3.5 text-xs font-bold text-emerald-100 shadow-lg active:scale-95 active:bg-emerald-400 active:text-slate-950"
              >
                Slide
              </button>
              <button
                type="button"
                aria-label="Jump or double vault"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  manualQueueRef.current.jump = true;
                }}
                className="flex h-11 items-center justify-center rounded-xl border border-amber-300/45 bg-amber-400/90 px-4 text-xs font-bold text-slate-950 shadow-lg active:scale-95"
              >
                Jump
              </button>
            </div>
          </div>
        )}
      </>
      )}

      {/* Game Over Overlay (v5.5 Summary) */}
      {hud.phase === 'gameover' && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute inset-0 z-20 flex items-center justify-center bg-[#060f0d]/72 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-amber-300/25 bg-[#0d1c18]/96 p-6 text-emerald-50 shadow-2xl">
            <div className="mb-1 text-[11px] font-semibold tracking-widest text-rose-400 uppercase">
              {hud.deathCause === 'fell' ? 'Fell Into the Chasm' : 'Temple Trap Impact'}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Run Ended</h2>
              <span className="text-[11px] font-semibold text-emerald-300/80">
                {released60 ? 'Temple Run 6.0' : 'Temple Run 5.5'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-lg border border-emerald-200/10 bg-[#081310] p-3">
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
                  Total Score
                </div>
                <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-amber-300">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
                  Distance
                </div>
                <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-white">
                  {hud.distance} m
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
                  Coins · Max Combo
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-200">
                  {hud.coins} · {hud.maxCombo}x
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
                  Best Run
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-300">
                  {hud.bestDistance} m · {hud.bestScore.toLocaleString()}
                </div>
              </div>
            </div>

            {hud.isNewBest && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-amber-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New Personal Record!</span>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRevive}
                disabled={!canRevive}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none ${
                  canRevive
                    ? 'bg-teal-400 text-slate-950 hover:bg-teal-300'
                    : 'cursor-not-allowed border border-emerald-200/15 bg-emerald-950/40 text-emerald-200/40'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {canRevive
                    ? `Revive with ${REVIVE_COST} Coins`
                    : `Need ${REVIVE_COST} Coins to Revive`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:outline-none"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
