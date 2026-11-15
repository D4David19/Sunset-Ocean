import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Hand,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { useAudioManager } from '../context/AudioManagerContext';
import { useRelease } from '../context/ReleaseContext';
import {
  isTypingTarget,
  useStudio,
  type AngryBirdsCleanupMode,
  type AngryBirdsFireMode,
  type AngryBirdsFlightMode,
  type SceneCommandPayload,
  type SlingshotEnvPreset,
  type SlingshotGroundFxMode,
  type SlingshotTrajLen,
} from '../context/StudioContext';
import { InfoBadge } from './studio/InfoBadge';
import { computeSceneRenderBudget } from '../utils/hardwareProfile';
import {
  activateBirdAbilityInWorld,
  BIRD_ROSTER_ORDER,
  BIRD_SPECS,
  createPhysicsWorld,
  getEnvironmentParams,
  GRAVITY,
  GROUND_Y,
  launchBodyInWorld,
  removeBodyFromWorld,
  setWorldBirdPassThrough,
  setWorldEnvironment,
  SLING_ANCHOR_X,
  SLING_ANCHOR_Y,
  spawnBirdByType,
  stepPhysicsWorld,
  triggerExplosionInWorld,
  wakeBodiesNear,
  WORLD_H,
  WORLD_W,
  type BirdType,
  type BlockKind,
  type ExplosionEvent,
  type PhysicsWorld,
  type PigVariant,
  type RigidBody,
} from '../slingshot/physics2d';
import {
  buildTowerPreset,
  getLevelDef,
  LEVEL_CATALOG,
  TOWER_PRESETS,
  type TowerPreset,
} from '../slingshot/levels';
import {
  createSlingshot3dEngine,
  type Slingshot3dCameraMode,
  type Slingshot3dEngine,
} from '../slingshot/slingshot3dEngine';
import {
  clientToWorldCoords,
  renderSlingshotScene,
} from '../slingshot/slingshotRenderer';

interface TrailDot { x: number; y: number; r: number; alpha: number; color?: string }
interface DebrisParticle {
  x: number; y: number; vx: number; vy: number; angle: number; omega: number;
  size: number; color: string; alpha: number; life: number; maxLife: number; shape: 'rect' | 'circle' | 'feather';
}
interface GroundDivot { x: number; halfWidth: number; depth: number; targetDepth: number; wobble: number; age: number; maxAge: number }
interface GroundShockwave { x: number; radius: number; maxRadius: number; alpha: number; thickness: number; tint: string }
interface DustCloudPuff { x: number; y: number; vx: number; vy: number; radius: number; growth: number; alpha: number; life: number; maxLife: number; color: string }
interface ExplosionFlash { x: number; y: number; radius: number; maxRadius: number; alpha: number; tint: string; isSonic: boolean }
interface ScorchDecal { x: number; radius: number; alpha: number }
interface FloatingPopup { x: number; y: number; vy: number; text: string; color: string; scale: number; life: number; maxLife: number }

const MAX_PULL_DIST = 132;
const LAUNCH_GAIN = 7.85;
const QUIVER_SIZE = 3;

const AUTO_PULL_TARGETS: Array<{ dx: number; dy: number }> = [
  { dx: -112, dy: 52 },
  { dx: -104, dy: 66 },
  { dx: -118, dy: 40 },
];

function computeAutoPullTarget(
  bodies: RigidBody[],
  shotIndex: number,
  gravityScale: number,
  windFactor: number
): { dx: number; dy: number; targetX: number; targetY: number } {
  const tnts = bodies.filter((b) => b.isActive && b.kind === 'tnt');
  const pigs = bodies.filter((b) => b.isActive && b.kind === 'pig');
  const pool = tnts.length > 0 && shotIndex % 2 === 0 ? tnts : pigs;

  if (pool.length === 0) {
    const fallback = AUTO_PULL_TARGETS[shotIndex % AUTO_PULL_TARGETS.length];
    return { ...fallback, targetX: 960, targetY: GROUND_Y - 80 };
  }
  const target = pool[shotIndex % pool.length];
  const tFlight = (0.94 + (shotIndex % 2) * 0.14) / Math.sqrt(Math.max(0.5, gravityScale));
  const denom = 1 - LAUNCH_GAIN * tFlight;
  const gx = GRAVITY * gravityScale * windFactor;
  const gy = GRAVITY * gravityScale;
  let dx = (target.x - SLING_ANCHOR_X - 0.5 * gx * tFlight * tFlight) / denom;
  let dy = (target.y - SLING_ANCHOR_Y - 0.5 * gy * tFlight * tFlight) / denom;

  const dist = Math.hypot(dx, dy);
  if (dist > MAX_PULL_DIST) {
    dx = (dx / dist) * MAX_PULL_DIST;
    dy = (dy / dist) * MAX_PULL_DIST;
  }
  dy = Math.min(GROUND_Y - SLING_ANCHOR_Y - 24, dy);
  return { dx, dy, targetX: target.x, targetY: target.y };
}

type SimPhase = 'ready' | 'auto_pulling' | 'dragging' | 'flying' | 'settling' | 'cleared';
type CameraMode = 'wide' | 'follow';

interface SlingshotSceneProps {
  globalAiMode: boolean;
  aiSyncVersion: number;
}

export default function SlingshotScene({
  globalAiMode,
  aiSyncVersion,
}: SlingshotSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engine3dRef = useRef<Slingshot3dEngine | null>(null);
  const {
    playSlingshotStretchCue,
    playSlingshotReleaseCue,
    playBlockImpactCue,
    playGroundImpactCue,
    playAbilityCue,
    playExplosionCue,
    playVictoryFanfareCue,
  } = useAudioManager();

  const {
    prefs,
    updatePrefs,
    activePreset,
    zenMode,
    paletteOpen,
    shortcutsOpen,
    hardwareProfile,
    reportTelemetry,
    bumpRecords,
    notify,
  } = useStudio();
  const { released60 } = useRelease();
  const released60Ref = useRef(released60);
  useEffect(() => {
    released60Ref.current = released60;
  }, [released60]);

  const [autoMode, setAutoMode] = useState(globalAiMode);
  const [infiniteBirds, setInfiniteBirds] = useState(true);
  const [quiverSize, setQuiverSize] = useState<3 | 5 | 7>(QUIVER_SIZE);
  const [preset, setPreset] = useState<TowerPreset>('arch');
  const [selectedBird, setSelectedBird] = useState<BirdType>('red');
  const [squadCycle, setSquadCycle] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('wide');
  const [camera3dPreset, setCamera3dPreset] = useState<Slingshot3dCameraMode>('classic');
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [clearedBanner, setClearedBanner] = useState<{
    levelName: string;
    score: number;
    stars: number;
    birdsUsed: number;
  } | null>(null);

  const [stats, setStats] = useState({
    pigsLeft: 3,
    blocksLeft: 14,
    score: 0,
    birdsLeft: QUIVER_SIZE,
    birdsUsed: 0,
    activeBird: 'red' as BirdType,
    abilityReady: false,
  });
  const [phaseLabel, setPhaseLabel] = useState(
    globalAiMode ? 'Pulling Back' : 'Drag Slingshot to Shoot'
  );

  const autoModeRef = useRef(globalAiMode);
  const infiniteBirdsRef = useRef(true);
  const quiverSizeRef = useRef<3 | 5 | 7>(QUIVER_SIZE);
  const lastSyncRef = useRef(aiSyncVersion);
  const presetRef = useRef<TowerPreset>('arch');
  const selectedBirdRef = useRef<BirdType>('red');
  const squadCycleRef = useRef(true);
  const cameraModeRef = useRef<CameraMode>('wide');
  const camera3dPresetRef = useRef<Slingshot3dCameraMode>('classic');

  const stretchCueRef = useRef(playSlingshotStretchCue);
  const releaseCueRef = useRef(playSlingshotReleaseCue);
  const impactCueRef = useRef(playBlockImpactCue);
  const groundImpactCueRef = useRef(playGroundImpactCue);
  const abilityCueRef = useRef(playAbilityCue);
  const explosionCueRef = useRef(playExplosionCue);
  const victoryCueRef = useRef(playVictoryFanfareCue);

  const showAimGuidesRef = useRef(prefs.showAimGuides);
  const showTrailsRef = useRef(prefs.showTrails);
  const reducedShakeRef = useRef(prefs.reducedShake);
  const groundFxRef = useRef<SlingshotGroundFxMode>(prefs.slingshotGroundFx);
  const trajLenRef = useRef<SlingshotTrajLen>(prefs.slingshotTrajLen);
  const envPresetRef = useRef<SlingshotEnvPreset>(prefs.slingshotEnvPreset);
  const flightModeRef = useRef<AngryBirdsFlightMode>(prefs.angryBirdsFlightMode);
  const fireModeRef = useRef<AngryBirdsFireMode>(prefs.angryBirdsFireMode);
  const cleanupModeRef = useRef<AngryBirdsCleanupMode>(prefs.angryBirdsCleanup);
  const framePacingRef = useRef(prefs.framePacingMode);
  const qualityTierRef = useRef(prefs.qualityTier);
  const gpuClassRef = useRef(hardwareProfile.gpuClass);
  const nativeDprRef = useRef(hardwareProfile.nativeDpr);
  const isEcoRef = useRef(
    prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato'
  );
  const sandboxRef = useRef({
    shaderMood: prefs.shaderMood,
    weather: prefs.sandboxWeather,
    freeOrbit: prefs.sandboxFreeOrbit,
    timeScale: prefs.sandboxTimeScale,
    gravityScale: prefs.sandboxGravityScale,
    birdsPower: prefs.sandboxBirdsPower,
    giantBirds: prefs.sandboxGiantBirds,
  });
  const explosionPulseRef = useRef<{ x: number; y: number; colorHex: number; id: number } | null>(null);
  const explosionPulseIdRef = useRef(0);
  const modalOpenRef = useRef(paletteOpen || shortcutsOpen);
  const bumpRecordsRef = useRef(bumpRecords);
  const notifyRef = useRef(notify);
  const rapidReticleRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    showAimGuidesRef.current = prefs.showAimGuides;
    showTrailsRef.current = prefs.showTrails;
    reducedShakeRef.current = prefs.reducedShake;
    groundFxRef.current = prefs.slingshotGroundFx;
    trajLenRef.current = prefs.slingshotTrajLen;
    envPresetRef.current = prefs.slingshotEnvPreset;
    flightModeRef.current = prefs.angryBirdsFlightMode;
    fireModeRef.current = prefs.angryBirdsFireMode;
    cleanupModeRef.current = prefs.angryBirdsCleanup;
    framePacingRef.current = prefs.framePacingMode;
    qualityTierRef.current = prefs.qualityTier;
    gpuClassRef.current = hardwareProfile.gpuClass;
    nativeDprRef.current = hardwareProfile.nativeDpr;
    isEcoRef.current =
      prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato';
    sandboxRef.current = {
      shaderMood: prefs.shaderMood,
      weather: prefs.sandboxWeather,
      freeOrbit: prefs.sandboxFreeOrbit,
      timeScale: prefs.sandboxTimeScale,
      gravityScale: prefs.sandboxGravityScale,
      birdsPower: prefs.sandboxBirdsPower,
      giantBirds: prefs.sandboxGiantBirds,
    };
    modalOpenRef.current = paletteOpen || shortcutsOpen;
    bumpRecordsRef.current = bumpRecords;
    notifyRef.current = notify;
    stretchCueRef.current = playSlingshotStretchCue;
    releaseCueRef.current = playSlingshotReleaseCue;
    impactCueRef.current = playBlockImpactCue;
    groundImpactCueRef.current = playGroundImpactCue;
    abilityCueRef.current = playAbilityCue;
    explosionCueRef.current = playExplosionCue;
    victoryCueRef.current = playVictoryFanfareCue;
    if (simRef.current) {
      setWorldBirdPassThrough(simRef.current.world, prefs.angryBirdsFlightMode === 'pass-through');
      simRef.current.world.engine.gravity.y = prefs.sandboxGravityScale;
    }
  }, [
    bumpRecords,
    hardwareProfile.gpuClass,
    hardwareProfile.nativeDpr,
    notify,
    paletteOpen,
    playAbilityCue,
    playBlockImpactCue,
    playExplosionCue,
    playGroundImpactCue,
    playSlingshotReleaseCue,
    playSlingshotStretchCue,
    playVictoryFanfareCue,
    prefs.angryBirdsCleanup,
    prefs.angryBirdsFireMode,
    prefs.angryBirdsFlightMode,
    prefs.framePacingMode,
    prefs.qualityTier,
    prefs.reducedShake,
    prefs.sandboxBirdsPower,
    prefs.sandboxFreeOrbit,
    prefs.sandboxGiantBirds,
    prefs.sandboxGravityScale,
    prefs.sandboxTimeScale,
    prefs.sandboxWeather,
    prefs.shaderMood,
    prefs.showAimGuides,
    prefs.showTrails,
    prefs.slingshotEnvPreset,
    prefs.slingshotGroundFx,
    prefs.slingshotTrajLen,
    shortcutsOpen,
  ]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    camera3dPresetRef.current = camera3dPreset;
  }, [camera3dPreset]);

  useEffect(() => {
    squadCycleRef.current = squadCycle;
  }, [squadCycle]);

  useEffect(() => {
    selectedBirdRef.current = selectedBird;
  }, [selectedBird]);

  useEffect(() => {
    reportTelemetry({
      scene: 'slingshot',
      title: released60 ? 'Angry Birds 6.0' : 'Angry Birds 5.0',
      status: phaseLabel,
      metrics: [
        { label: 'Bird', value: BIRD_SPECS[stats.activeBird].name, accent: true },
        { label: 'Fired', value: String(stats.birdsUsed) },
        { label: 'Left', value: infiniteBirds ? '∞' : String(stats.birdsLeft) },
        { label: 'Score', value: String(stats.score) },
        { label: 'Pigs', value: String(stats.pigsLeft) },
      ],
    });
  }, [
    infiniteBirds,
    phaseLabel,
    released60,
    reportTelemetry,
    stats.activeBird,
    stats.birdsLeft,
    stats.birdsUsed,
    stats.pigsLeft,
    stats.score,
  ]);

  interface DelayedTnt {
    body: RigidBody;
    delay: number;
  }

  const simRef = useRef<{
    phase: SimPhase;
    phaseTimer: number;
    shotIndex: number;
    autoTarget: { dx: number; dy: number; targetX: number; targetY: number };
    autoAbilityUsedThisShot: boolean;
    birdsLeft: number;
    birdsUsed: number;
    levelShotsUsed: number;
    birdAlpha: number;
    towerAlpha: number;
    bird: RigidBody;
    activeBirdType: BirdType;
    world: PhysicsWorld;
    pouchX: number;
    pouchY: number;
    pouchVx: number;
    pouchVy: number;
    trailDots: TrailDot[];
    trailTimer: number;
    hasCollided: boolean;
    particles: DebrisParticle[];
    groundDivots: GroundDivot[];
    shockwaves: GroundShockwave[];
    dustClouds: DustCloudPuff[];
    explosions: ExplosionFlash[];
    scorches: ScorchDecal[];
    popups: FloatingPopup[];
    tntQueue: DelayedTnt[];
    slideCooldowns: Map<number, number>;
    shake: number;
    score: number;
    lastSavedBestScore: number;
    comboCount: number;
    comboTimer: number;
    timeSec: number;
    dragMode: 'sling' | 'target';
    camFocusX: number;
    camFocusY: number;
    camZoom: number;
  } | null>(null);

  const pickBirdTypeForShot = useCallback((shotNum: number, lvlId: TowerPreset): BirdType => {
    if (!squadCycleRef.current) return selectedBirdRef.current;
    const def = getLevelDef(lvlId);
    return def.squad[shotNum % def.squad.length];
  }, []);

  const addPopup = (
    sim: NonNullable<typeof simRef.current>,
    x: number,
    y: number,
    text: string,
    color = '#fde047',
    scale = 1
  ) => {
    if (sim.popups.length >= 24) sim.popups.shift();
    sim.popups.push({
      x,
      y,
      vy: -42,
      text,
      color,
      scale,
      life: 0,
      maxLife: 0.95,
    });
  };

  const spawnBurst = (
    particles: DebrisParticle[],
    x: number,
    y: number,
    kind: BlockKind | 'soil' | BirdType,
    count: number,
    speedScale = 1
  ) => {
    const palette =
      kind === 'wood'
        ? ['#d99b52', '#a86728', '#7c4516']
        : kind === 'ice'
          ? ['#bae6fd', '#7dd3fc', '#ffffff']
          : kind === 'stone' || kind === 'boulder'
            ? ['#94a3b8', '#64748b', '#475569']
            : kind === 'tnt'
              ? ['#ef4444', '#f97316', '#fde047']
              : kind === 'pig'
                ? ['#bef264', '#84cc16', '#ffffff']
                : kind === 'soil'
                  ? ['#5c3a1f', '#7c4d29', '#4c9937', '#3a2210']
                  : kind === 'chuck'
                    ? ['#facc15', '#fef08a', '#92400e']
                    : kind === 'blues'
                      ? ['#38bdf8', '#bae6fd', '#0284c7']
                      : kind === 'bomb'
                        ? ['#334155', '#f97316', '#94a3b8']
                        : kind === 'terence'
                          ? ['#991b1b', '#ef4444', '#e7d3be']
                          : ['#ef4444', '#fca5a5', '#ffffff'];

    const isBirdLike =
      kind === 'bird' ||
      kind === 'red' ||
      kind === 'chuck' ||
      kind === 'blues' ||
      kind === 'bomb' ||
      kind === 'terence';
    const maxDebris = isEcoRef.current ? 32 : 76;
    for (let i = 0; i < count; i++) {
      if (particles.length >= maxDebris) particles.shift();
      const a =
        kind === 'soil'
          ? -Math.PI * (0.15 + Math.random() * 0.7)
          : Math.random() * Math.PI * 2;
      const spd = (55 + Math.random() * 210) * speedScale;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 70,
        angle: Math.random() * Math.PI * 2,
        omega: (Math.random() - 0.5) * 14,
        size:
          kind === 'pig'
            ? 6 + Math.random() * 7
            : kind === 'soil'
              ? 4 + Math.random() * 5
              : isBirdLike
                ? 7 + Math.random() * 6
                : 5 + Math.random() * 7,
        color: palette[i % palette.length],
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.42,
        shape: isBirdLike ? 'feather' : kind === 'pig' ? 'circle' : 'rect',
      });
    }
  };

  const awardPoints = (
    sim: NonNullable<typeof simRef.current>,
    basePoints: number,
    x: number,
    y: number,
    label?: string,
    color = '#fde047'
  ) => {
    sim.comboTimer = 1.25;
    sim.comboCount = Math.min(4, sim.comboCount + 1);
    const mult = sim.comboCount >= 3 ? 1.5 : sim.comboCount === 2 ? 1.25 : 1;
    const pts = Math.round((basePoints * mult) / 10) * 10;
    sim.score += pts;
    const text = label ? `${label} +${pts}` : `+${pts}`;
    addPopup(sim, x, y - 14, text, color, pts >= 500 ? 1.15 : 0.92);
  };

  const processExplosionOutcome = (
    sim: NonNullable<typeof simRef.current>,
    ex: ExplosionEvent
  ) => {
    const isSonic = ex.source === 'sonic';
    explosionPulseIdRef.current += 1;
    explosionPulseRef.current = {
      x: ex.x,
      y: ex.y,
      colorHex: isSonic ? 0xfca5a5 : 0xf97316,
      id: explosionPulseIdRef.current,
    };
    sim.explosions.push({
      x: ex.x,
      y: ex.y,
      radius: 18,
      maxRadius: ex.radius * 0.95,
      alpha: 0.95,
      tint: isSonic ? '#fca5a5' : '#f97316',
      isSonic,
    });

    if (!isSonic) {
      explosionCueRef.current(ex.power);
      sim.shake = Math.min(13, sim.shake + ex.power * 6.2);
      if (Math.abs(ex.y - GROUND_Y) < 130 && groundFxRef.current !== 'dust') {
        if (sim.scorches.length >= 16) sim.scorches.shift();
        sim.scorches.push({ x: ex.x, radius: 52 * ex.power, alpha: 0.9 });
      }
      spawnBurst(sim.particles, ex.x, ex.y, 'tnt', isEcoRef.current ? 10 : 18, 1.35);
      addPopup(sim, ex.x, ex.y - 26, ex.source === 'bomb' ? 'MEGA BLAST!' : 'BOOM!', '#fb923c', 1.25);
    } else {
      sim.shake = Math.min(7, sim.shake + 2.8);
      addPopup(sim, ex.x, ex.y - 24, 'SONIC CRY!', '#fca5a5', 1.05);
    }

    for (let i = 0; i < ex.destroyedBodies.length; i++) {
      const db = ex.destroyedBodies[i];
      const basePts =
        db.kind === 'pig'
          ? db.pigVariant === 'king'
            ? 1500
            : db.pigVariant === 'helmet'
              ? 750
              : 500
          : db.kind === 'stone'
            ? 150
            : 100;
      awardPoints(
        sim,
        basePts,
        db.x,
        db.y,
        db.pigVariant === 'king' ? 'KING DOWN!' : undefined,
        db.kind === 'pig' ? '#bef264' : '#e2e8f0'
      );
      spawnBurst(
        sim.particles,
        db.x,
        db.y,
        db.kind,
        db.kind === 'pig' ? 12 : 7,
        1.15
      );
    }

    for (let i = 0; i < ex.chainTnts.length; i++) {
      const tntBody = ex.chainTnts[i];
      const alreadyQueued = sim.tntQueue.some((q) => q.body.id === tntBody.id);
      if (!alreadyQueued) {
        sim.tntQueue.push({ body: tntBody, delay: 0.08 + i * 0.07 });
      }
    }
  };

  const resetWorld = useCallback(
    (nextPreset: TowerPreset, startAuto = autoModeRef.current) => {
      const world = createPhysicsWorld(envPresetRef.current);
      world.engine.gravity.y = sandboxRef.current.gravityScale;
      const { gravityScale, windFactor } = getEnvironmentParams(envPresetRef.current);
      const firstBirdType = pickBirdTypeForShot(0, nextPreset);
      const bird = spawnBirdByType(
        firstBirdType,
        SLING_ANCHOR_X,
        SLING_ANCHOR_Y,
        flightModeRef.current === 'pass-through',
        false
      );
      const tower = buildTowerPreset(nextPreset, world);

      const prevTime = simRef.current?.timeSec ?? 0;
      const prevUsed = simRef.current?.birdsUsed ?? 0;
      const startQuiver = quiverSizeRef.current;

      setClearedBanner(null);

      simRef.current = {
        phase: startAuto ? 'auto_pulling' : 'ready',
        phaseTimer: 0,
        shotIndex: 0,
        autoTarget: computeAutoPullTarget(tower, 0, gravityScale, windFactor),
        autoAbilityUsedThisShot: false,
        birdsLeft: startQuiver,
        birdsUsed: prevUsed,
        levelShotsUsed: 0,
        birdAlpha: 0.05,
        towerAlpha: 0.08,
        bird,
        activeBirdType: firstBirdType,
        world,
        pouchX: SLING_ANCHOR_X,
        pouchY: SLING_ANCHOR_Y,
        pouchVx: 0,
        pouchVy: 0,
        trailDots: [],
        trailTimer: 0,
        hasCollided: false,
        particles: [],
        groundDivots: [],
        shockwaves: [],
        dustClouds: [],
        explosions: [],
        scorches: [],
        popups: [],
        tntQueue: [],
        slideCooldowns: new Map(),
        shake: 0,
        score: 0,
        lastSavedBestScore: 0,
        comboCount: 0,
        comboTimer: 0,
        timeSec: prevTime,
        dragMode: 'sling',
        camFocusX: WORLD_W * 0.5,
        camFocusY: WORLD_H * 0.52,
        camZoom: 1,
      };

      const pigs = tower.filter((b) => b.kind === 'pig').length;
      const blocks = tower.filter(
        (b) => b.kind !== 'pig' && b.kind !== 'ground'
      ).length;
      setStats({
        pigsLeft: pigs,
        blocksLeft: blocks,
        score: 0,
        birdsLeft: startQuiver,
        birdsUsed: prevUsed,
        activeBird: firstBirdType,
        abilityReady: false,
      });
      setPhaseLabel(startAuto ? 'Pulling Back' : 'Drag Slingshot to Shoot');
    },
    [pickBirdTypeForShot]
  );

  // Live bird switch when user clicks a bird in the Roster while ready in pouch
  const handleSelectBirdFromRoster = useCallback((bType: BirdType) => {
    setSquadCycle(false);
    squadCycleRef.current = false;
    setSelectedBird(bType);
    selectedBirdRef.current = bType;

    const sim = simRef.current;
    if (
      sim &&
      (sim.phase === 'ready' || sim.phase === 'auto_pulling')
    ) {
      const replacement = spawnBirdByType(
        bType,
        sim.bird.x,
        sim.bird.y,
        flightModeRef.current === 'pass-through',
        false
      );
      replacement.angle = sim.bird.angle;
      sim.bird = replacement;
      sim.activeBirdType = bType;
      setStats((prev) => ({ ...prev, activeBird: bType }));
    }
  }, []);

  const handleToggleSquadCycle = useCallback(() => {
    setSquadCycle((prev) => {
      const next = !prev;
      squadCycleRef.current = next;
      if (next && simRef.current && (simRef.current.phase === 'ready' || simRef.current.phase === 'auto_pulling')) {
        const cycled = pickBirdTypeForShot(simRef.current.levelShotsUsed, presetRef.current);
        const replacement = spawnBirdByType(
          cycled,
          simRef.current.bird.x,
          simRef.current.bird.y,
          flightModeRef.current === 'pass-through',
          false
        );
        simRef.current.bird = replacement;
        simRef.current.activeBirdType = cycled;
        setStats((s) => ({ ...s, activeBird: cycled }));
      }
      return next;
    });
  }, [pickBirdTypeForShot]);

  // Sync runtime gravity & wind preset live
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const { gravityScale, windFactor } = setWorldEnvironment(
      sim.world,
      prefs.slingshotEnvPreset
    );
    if (sim.phase === 'auto_pulling') {
      sim.autoTarget = computeAutoPullTarget(
        sim.world.bodies,
        sim.shotIndex,
        gravityScale,
        windFactor
      );
    }
  }, [prefs.slingshotEnvPreset]);

  const reloadNextBird = useCallback(
    (sim: NonNullable<typeof simRef.current>, nextPhase: SimPhase) => {
      const { gravityScale, windFactor } = getEnvironmentParams(envPresetRef.current);
      const nextType = pickBirdTypeForShot(sim.levelShotsUsed, presetRef.current);
      sim.activeBirdType = nextType;
      sim.bird = spawnBirdByType(
        nextType,
        SLING_ANCHOR_X,
        SLING_ANCHOR_Y,
        flightModeRef.current === 'pass-through',
        false
      );
      sim.birdAlpha = 0.05;
      sim.phase = nextPhase;
      sim.phaseTimer = 0;
      sim.autoAbilityUsedThisShot = false;
      sim.autoTarget = computeAutoPullTarget(
        sim.world.bodies,
        sim.shotIndex,
        gravityScale,
        windFactor
      );
      sim.hasCollided = false;
      sim.pouchX = SLING_ANCHOR_X;
      sim.pouchY = SLING_ANCHOR_Y;
      sim.pouchVx = 0;
      sim.pouchVy = 0;
      sim.trailDots = [];
      setStats((prev) => ({
        ...prev,
        activeBird: nextType,
        abilityReady: false,
      }));
    },
    [pickBirdTypeForShot]
  );

  const triggerActiveBirdAbility = useCallback(
    (sim: NonNullable<typeof simRef.current>): boolean => {
      // Find newest active airborne unspent bird (supports both Drag mode and Rapid-Fire!)
      const candidates: RigidBody[] = [];
      if (
        sim.bird.isActive &&
        !sim.bird.abilityUsed &&
        !sim.bird.hasStruck
      ) {
        candidates.push(sim.bird);
      } else {
        for (let i = sim.world.bodies.length - 1; i >= 0; i--) {
          const b = sim.world.bodies[i];
          if (
            b.isActive &&
            b.kind === 'bird' &&
            !b.abilityUsed &&
            !b.hasStruck &&
            b.flightAge > 0.04
          ) {
            candidates.push(b);
            if (candidates.length >= (fireModeRef.current === 'rapid' ? 3 : 1)) break;
          }
        }
      }

      if (candidates.length === 0) return false;

      let triggeredAny = false;
      const passThrough = flightModeRef.current === 'pass-through';
      for (let i = 0; i < candidates.length; i++) {
        const targetBird = candidates[i];
        const outcome = activateBirdAbilityInWorld(sim.world, targetBird, passThrough);
        if (!outcome.triggered) continue;
        triggeredAny = true;

        abilityCueRef.current(outcome.birdType);
        spawnBurst(sim.particles, outcome.x, outcome.y, outcome.birdType, 10, 1.1);

        if (outcome.birdType === 'chuck') {
          addPopup(sim, outcome.x, outcome.y - 20, 'TURBO DASH!', '#facc15', 1.05);
        } else if (outcome.birdType === 'blues') {
          addPopup(sim, outcome.x, outcome.y - 20, 'TRIPLE SPLIT!', '#38bdf8', 1.05);
        } else if (outcome.birdType === 'terence') {
          addPopup(sim, outcome.x, outcome.y - 20, 'METEOR SLAM!', '#ef4444', 1.15);
        }

        if (outcome.explosion) {
          processExplosionOutcome(sim, outcome.explosion);
        }
      }

      if (triggeredAny) {
        setStats((prev) => ({ ...prev, abilityReady: false }));
      }
      return triggeredAny;
    },
    []
  );

  useEffect(() => {
    if (aiSyncVersion !== lastSyncRef.current) {
      lastSyncRef.current = aiSyncVersion;
      setAutoMode(globalAiMode);
    }
  }, [globalAiMode, aiSyncVersion]);

  useEffect(() => {
    autoModeRef.current = autoMode;
    const sim = simRef.current;
    const { gravityScale, windFactor } = getEnvironmentParams(envPresetRef.current);
    if (sim && autoMode && sim.phase === 'ready') {
      sim.autoTarget = computeAutoPullTarget(
        sim.world.bodies,
        sim.shotIndex,
        gravityScale,
        windFactor
      );
      sim.phase = 'auto_pulling';
      sim.phaseTimer = 0;
      setPhaseLabel('Pulling Back');
    } else if (sim && !autoMode && sim.phase === 'auto_pulling') {
      sim.phase = 'ready';
      sim.phaseTimer = 0;
      setPhaseLabel('Drag Slingshot to Shoot');
    }
  }, [autoMode]);

  useEffect(() => {
    infiniteBirdsRef.current = infiniteBirds;
  }, [infiniteBirds]);

  useEffect(() => {
    quiverSizeRef.current = quiverSize;
  }, [quiverSize]);

  useEffect(() => {
    presetRef.current = preset;
    resetWorld(preset, autoModeRef.current);
  }, [preset, resetWorld]);

  // Listen to Command Palette & Interactive Tutorial scene commands
  useEffect(() => {
    const onSceneCommand = (e: Event) => {
      const cmd = (e as CustomEvent<SceneCommandPayload>).detail;
      if (!cmd || cmd.scene !== 'slingshot') return;
      if (cmd.type === 'load-level') {
        const next = TOWER_PRESETS[cmd.levelIndex % TOWER_PRESETS.length];
        if (next) setPreset(next);
      } else if (cmd.type === 'reset-level') {
        resetWorld(presetRef.current, autoModeRef.current);
      } else if (cmd.type === 'set-controls-open') {
        setPanelCollapsed(!cmd.open);
      }
    };
    window.addEventListener('kas:scene-command', onSceneCommand);
    return () => window.removeEventListener('kas:scene-command', onSceneCommand);
  }, [resetWorld]);

  // Keyboard shortcuts: Space/E = Ability, Q = Cycle Bird, N = Next Bird, R = Rebuild, Shift+1..6 = Levels
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || modalOpenRef.current) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.shiftKey) {
        const idxMap: Record<string, number> = {
          Digit1: 0,
          Digit2: 1,
          Digit3: 2,
          Digit4: 3,
          Digit5: 4,
          Digit6: 5,
        };
        if (e.code in idxMap) {
          e.preventDefault();
          const next = TOWER_PRESETS[idxMap[e.code]];
          if (next) setPreset(next);
        }
        return;
      }
      const sim = simRef.current;
      if (!sim) return;

      if (e.code === 'Space' || k === 'e') {
        e.preventDefault();
        triggerActiveBirdAbility(sim);
      } else if (k === 'q') {
        e.preventDefault();
        const curIdx = BIRD_ROSTER_ORDER.indexOf(selectedBirdRef.current);
        const nextBird = BIRD_ROSTER_ORDER[(curIdx + 1) % BIRD_ROSTER_ORDER.length];
        handleSelectBirdFromRoster(nextBird);
      } else if (k === 'r') {
        resetWorld(presetRef.current, autoModeRef.current);
      } else if (k === 'n') {
        if (!infiniteBirdsRef.current && sim.birdsLeft <= 0) {
          resetWorld(presetRef.current, autoModeRef.current);
        } else {
          reloadNextBird(sim, autoModeRef.current ? 'auto_pulling' : 'ready');
          setPhaseLabel(autoModeRef.current ? 'Pulling Back' : 'Drag Slingshot to Shoot');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectBirdFromRoster, reloadNextBird, resetWorld, triggerActiveBirdAbility]);

  const spawnGroundImpact = (
    sim: NonNullable<typeof simRef.current>,
    x: number,
    impulse: number,
    hitKind: BlockKind,
    extentW: number,
    mode: SlingshotGroundFxMode,
    isEco: boolean
  ) => {
    const intensity = Math.min(1.4, Math.max(0.24, (impulse - 85) / 520));
    const maxDivots = isEco ? 6 : 18;
    const maxWaves = isEco ? 4 : 10;
    const maxDust = isEco ? 24 : 64;

    if (mode !== 'dust') {
      const targetDepth = Math.min(
        16,
        (4 + intensity * 8.5) * (mode === 'craters' ? 1.28 : 1)
      );
      const halfWidth = Math.min(54, Math.max(16, extentW * 0.55 + intensity * 14));
      let merged = false;
      for (let i = 0; i < sim.groundDivots.length; i++) {
        const d = sim.groundDivots[i];
        if (Math.abs(d.x - x) < 20) {
          d.targetDepth = Math.min(18, Math.max(d.targetDepth, targetDepth) + 2.2);
          d.halfWidth = Math.min(58, Math.max(d.halfWidth, halfWidth));
          d.wobble = Math.min(1, d.wobble + 0.55);
          d.age = Math.min(d.age, 1.5);
          merged = true;
          break;
        }
      }
      if (!merged) {
        if (sim.groundDivots.length >= maxDivots) sim.groundDivots.shift();
        sim.groundDivots.push({
          x,
          halfWidth,
          depth: 0.8,
          targetDepth,
          wobble: 0.85,
          age: 0,
          maxAge: mode === 'craters' ? 16 : 11,
        });
      }

      if (sim.shockwaves.length >= maxWaves) sim.shockwaves.shift();
      sim.shockwaves.push({
        x,
        radius: 10,
        maxRadius: 34 + intensity * (mode === 'craters' ? 58 : 42),
        alpha: 0.72,
        thickness: 1.8 + intensity * 2.1,
        tint:
          hitKind === 'ice'
            ? '#bae6fd'
            : hitKind === 'stone' || hitKind === 'boulder'
              ? '#e2e8f0'
              : '#fde68a',
      });
    }

    if (mode !== 'craters') {
      const dustColors =
        hitKind === 'ice'
          ? ['rgba(224,242,254,0.82)', 'rgba(186,230,253,0.72)', 'rgba(217,197,154,0.65)']
          : hitKind === 'stone' || hitKind === 'boulder'
            ? ['rgba(203,213,225,0.82)', 'rgba(148,163,184,0.74)', 'rgba(214,193,164,0.68)']
            : hitKind === 'wood'
              ? ['rgba(214,184,141,0.8)', 'rgba(184,146,106,0.72)', 'rgba(226,204,174,0.65)']
              : hitKind === 'pig'
                ? ['rgba(190,242,100,0.7)', 'rgba(217,197,154,0.78)', 'rgba(241,245,249,0.6)']
                : ['rgba(200,166,121,0.82)', 'rgba(156,122,80,0.72)', 'rgba(232,216,192,0.66)'];

      const puffCount = Math.round((isEco ? 4 : 8) + intensity * (isEco ? 3 : 7));
      for (let i = 0; i < puffCount; i++) {
        if (sim.dustClouds.length >= maxDust) sim.dustClouds.shift();
        const side = i % 2 === 0 ? -1 : 1;
        const spread = (0.35 + Math.random() * 0.95) * (45 + intensity * 85);
        sim.dustClouds.push({
          x: x + side * (4 + Math.random() * Math.min(24, extentW * 0.4)),
          y: GROUND_Y - 2 - Math.random() * 6,
          vx: side * spread + (Math.random() - 0.5) * 28,
          vy: -(16 + Math.random() * (34 + intensity * 46)),
          radius: 7 + Math.random() * (6 + intensity * 8),
          growth: 18 + Math.random() * 14,
          alpha: 0.72,
          life: 0,
          maxLife: 0.55 + Math.random() * 0.45,
          color: dustColors[i % dustColors.length],
        });
      }

      spawnBurst(
        sim.particles,
        x,
        GROUND_Y - 5,
        'soil',
        isEco ? 3 : Math.round(4 + intensity * 5),
        0.65 + intensity * 0.4
      );
    }

    sim.shake = Math.min(9.5, sim.shake + intensity * (mode === 'craters' ? 3.8 : 2.5));
    const cueKind: BlockKind | 'soil' =
      hitKind === 'ground' ? 'soil' : hitKind;
    groundImpactCueRef.current(Math.min(1, intensity), cueKind);
  };

  const launchBirdFromPull = useCallback(
    (sim: NonNullable<typeof simRef.current>) => {
      const dx = SLING_ANCHOR_X - sim.bird.x;
      const dy = SLING_ANCHOR_Y - sim.bird.y;
      const gainBoost = (released60Ref.current ? 1.12 : 1.0) * sandboxRef.current.birdsPower;
      const vx = dx * LAUNCH_GAIN * gainBoost;
      const vy = dy * LAUNCH_GAIN * gainBoost;

      launchBodyInWorld(sim.world, sim.bird, sim.bird.x, sim.bird.y, vx, vy);
      sim.hasCollided = false;
      sim.trailDots = [];
      sim.trailTimer = 0;

      if (!infiniteBirdsRef.current) {
        sim.birdsLeft = Math.max(0, sim.birdsLeft - 1);
      }
      sim.birdsUsed += 1;
      sim.levelShotsUsed += 1;
      bumpRecordsRef.current({ totalBirdsUsed: 1 }, { bestSlingshotScore: sim.score });

      sim.pouchVx = dx * 2.4;
      sim.pouchVy = dy * 2.4;

      sim.phase = 'flying';
      sim.phaseTimer = 0;
      const spec = BIRD_SPECS[sim.bird.birdType ?? 'red'];
      setStats((prev) => ({
        ...prev,
        birdsLeft: sim.birdsLeft,
        birdsUsed: sim.birdsUsed,
        abilityReady: true,
      }));
      setPhaseLabel(`Flying (${spec.abilityName}: Space / Click)`);
      releaseCueRef.current();
    },
    []
  );

  const renderMode = prefs.renderMode;

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const is2d = renderMode === '2d';
    const engine3d = is2d ? null : createSlingshot3dEngine(mountEl);
    engine3dRef.current = engine3d;

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
        if (engine3d) {
          engine3d.resize(w, h, dpr);
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

    if (!simRef.current) {
      resetWorld(presetRef.current, autoModeRef.current);
    }

    let rafId = 0;
    let lastNow = performance.now();
    let lastRenderNow = lastNow;
    let accumulator = 0;
    let statsTimer = 0;

    const frame = (now: number) => {
      const cssW = mountEl.clientWidth || window.innerWidth;
      const budget = computeSceneRenderBudget({
        framePacingMode: framePacingRef.current,
        qualityTier: qualityTierRef.current,
        gpuClass: gpuClassRef.current,
        nativeDpr: nativeDprRef.current,
        sceneKind: is2d ? '2d' : '3d-light',
        cssWidth: cssW,
      });

      if (budget.minFrameMs > 0 && now - lastRenderNow < budget.minFrameMs - 0.6) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      lastRenderNow = now;
      syncSize(budget.dpr);

      const sb = sandboxRef.current;
      const rawDtMs = Math.max(1, now - lastNow);
      const dt = Math.min(0.05, rawDtMs / 1000) * Math.max(0.2, sb.timeScale);
      lastNow = now;

      const sim = simRef.current;
      if (sim) {
        sim.world.engine.gravity.y = sb.gravityScale;
        sim.timeSec += dt;
        if (sim.birdAlpha < 1) {
          sim.birdAlpha = Math.min(1, sim.birdAlpha + dt * 6.5);
        }
        if (sim.towerAlpha < 1) {
          sim.towerAlpha = Math.min(1, sim.towerAlpha + dt * 5);
        }
        if (sim.comboTimer > 0) {
          sim.comboTimer -= dt;
          if (sim.comboTimer <= 0) sim.comboCount = 0;
        }

        if (sim.phase === 'auto_pulling') {
          sim.phaseTimer += dt;
          const target = sim.autoTarget;
          const pullDuration = 0.9;
          const holdDuration = 0.22;
          const u = Math.min(1, sim.phaseTimer / pullDuration);
          const ease = 1 - Math.pow(1 - u, 3);
          sim.bird.x = SLING_ANCHOR_X + target.dx * ease;
          sim.bird.y = SLING_ANCHOR_Y + target.dy * ease;
          sim.bird.angle = Math.atan2(-target.dy, -target.dx);
          const pullLen =
            Math.hypot(sim.bird.x - SLING_ANCHOR_X, sim.bird.y - SLING_ANCHOR_Y) || 1;
          sim.pouchX = sim.bird.x + ((sim.bird.x - SLING_ANCHOR_X) / pullLen) * 12;
          sim.pouchY = sim.bird.y + ((sim.bird.y - SLING_ANCHOR_Y) / pullLen) * 12;

          if (sim.phaseTimer >= pullDuration + holdDuration) {
            sim.shotIndex += 1;
            launchBirdFromPull(sim);
          }
        } else if (sim.phase === 'ready') {
          sim.bird.x = SLING_ANCHOR_X;
          sim.bird.y = SLING_ANCHOR_Y;
          sim.bird.angle = 0;
          sim.pouchX = SLING_ANCHOR_X;
          sim.pouchY = SLING_ANCHOR_Y;
        }

        if (sim.phase === 'flying' || sim.phase === 'settling' || sim.phase === 'cleared') {
          const springK = 540;
          const damping = 12.0;
          const ax = (SLING_ANCHOR_X - sim.pouchX) * springK - sim.pouchVx * damping;
          const ay = (SLING_ANCHOR_Y - sim.pouchY) * springK - sim.pouchVy * damping;
          sim.pouchVx += ax * dt;
          sim.pouchVy += ay * dt;
          sim.pouchX += sim.pouchVx * dt;
          sim.pouchY += sim.pouchVy * dt;
        }

        accumulator += dt;
        const fixedDt = 1 / 60;
        if (accumulator > fixedDt * 2.5) accumulator = fixedDt * 2;
        let physSteps = 0;
        while (accumulator >= fixedDt && physSteps < 2) {
          accumulator -= fixedDt;
          physSteps += 1;

          stepPhysicsWorld(sim.world, fixedDt, (ev) => {
            if (ev.isBouncer) {
              impactCueRef.current(0.85, 'bouncer');
              addPopup(sim, ev.x, ev.y - 16, 'BOING!', '#fb7185', 0.9);
              return;
            }

            if (ev.armorBroken && ev.armorBreakX !== undefined && ev.armorBreakY !== undefined) {
              awardPoints(
                sim,
                250,
                ev.armorBreakX,
                ev.armorBreakY,
                ev.armorVariant === 'king' ? 'CROWN OFF!' : 'HELMET OFF!',
                '#cbd5e1'
              );
              spawnBurst(sim.particles, ev.armorBreakX, ev.armorBreakY, 'stone', 7, 0.9);
            }

            const involvesBird = ev.kindA === 'bird' || ev.kindB === 'bird';
            if (involvesBird && !sim.hasCollided) {
              sim.hasCollided = true;
              spawnBurst(
                sim.particles,
                ev.x,
                ev.y,
                sim.bird.birdType ?? 'red',
                8,
                0.95
              );
            }

            if (ev.impulse > 280) {
              sim.shake = Math.min(8.5, sim.shake + ev.impulse * 0.008);
              wakeBodiesNear(sim.world.bodies, ev.x, ev.y, 185);
            }

            const involvesGround = ev.kindA === 'ground' || ev.kindB === 'ground';
            const partnerKind = ev.kindA === 'ground' ? ev.kindB : ev.kindA;

            if (involvesGround && ev.isFloor && ev.impulse > 105) {
              spawnGroundImpact(
                sim,
                ev.x,
                ev.impulse,
                partnerKind,
                ev.extentW,
                groundFxRef.current,
                isEcoRef.current
              );
            } else {
              const targetKind =
                ev.kindA !== 'bird' && ev.kindA !== 'ground' ? ev.kindA : ev.kindB;
              if (ev.impulse > 185 && targetKind !== 'ground' && targetKind !== 'bird') {
                impactCueRef.current(Math.min(1, ev.impulse / 900), targetKind);
                spawnBurst(sim.particles, ev.x, ev.y, targetKind, 4, 0.7);
              }
            }
          });

          // Handle TNT collisions triggered in Matter collisionStart
          if (sim.world.pendingTntDetonations.length > 0) {
            for (let i = 0; i < sim.world.pendingTntDetonations.length; i++) {
              const tntBody = sim.world.pendingTntDetonations[i];
              if (tntBody.isActive) {
                removeBodyFromWorld(sim.world, tntBody);
                awardPoints(sim, 250, tntBody.x, tntBody.y, undefined, '#fb923c');
                const ex = triggerExplosionInWorld(sim.world, tntBody.x, tntBody.y, 205, 1.25, 'tnt');
                processExplosionOutcome(sim, ex);
              }
            }
            sim.world.pendingTntDetonations.length = 0;
          }

          // Process delayed chain-reaction TNT queue
          for (let i = sim.tntQueue.length - 1; i >= 0; i--) {
            sim.tntQueue[i].delay -= fixedDt;
            if (sim.tntQueue[i].delay <= 0) {
              const item = sim.tntQueue[i];
              sim.tntQueue.splice(i, 1);
              if (item.body.isActive) {
                removeBodyFromWorld(sim.world, item.body);
                awardPoints(sim, 250, item.body.x, item.body.y, 'CHAIN!', '#f97316');
                const ex = triggerExplosionInWorld(
                  sim.world,
                  item.body.x,
                  item.body.y,
                  210,
                  1.28,
                  'tnt'
                );
                processExplosionOutcome(sim, ex);
              }
            }
          }

          // Bomb bird timed fuses after collision
          for (let i = 0; i < sim.world.bodies.length; i++) {
            const b = sim.world.bodies[i];
            if (
              b.isActive &&
              b.kind === 'bird' &&
              b.birdType === 'bomb' &&
              b.fuseTimer !== undefined
            ) {
              b.fuseTimer -= fixedDt;
              if (b.fuseTimer <= 0) {
                b.fuseTimer = undefined;
                b.abilityUsed = true;
                const bx = b.x;
                const by = b.y;
                removeBodyFromWorld(sim.world, b);
                const ex = triggerExplosionInWorld(sim.world, bx, by, 230, 1.35, 'bomb');
                processExplosionOutcome(sim, ex);
              }
            }
          }

          // Destroy defeated blocks & pigs
          for (let i = 0; i < sim.world.bodies.length; i++) {
            const b = sim.world.bodies[i];
            if (!b.isStatic && b.isActive && b.kind !== 'bird' && b.kind !== 'ground' && b.hp <= 0) {
              removeBodyFromWorld(sim.world, b);
              wakeBodiesNear(sim.world.bodies, b.x, b.y, 200);
              if (b.kind === 'tnt') {
                const ex = triggerExplosionInWorld(sim.world, b.x, b.y, 205, 1.25, 'tnt');
                processExplosionOutcome(sim, ex);
              } else {
                const pts =
                  b.kind === 'pig'
                    ? b.pigVariant === 'king'
                      ? 1500
                      : b.pigVariant === 'helmet'
                        ? 750
                        : 500
                    : b.kind === 'stone'
                      ? 150
                      : 100;
                awardPoints(
                  sim,
                  pts,
                  b.x,
                  b.y,
                  b.pigVariant === 'king' ? 'KING DOWN!' : undefined,
                  b.kind === 'pig' ? '#bef264' : '#fde047'
                );
                spawnBurst(
                  sim.particles,
                  b.x,
                  b.y,
                  b.kind,
                  b.kind === 'pig' ? 12 : 9,
                  1.1
                );
                impactCueRef.current(1.0, b.kind);
              }
            }
          }

          // Settled-bird cleanup policy (never deletes flying birds)
          const cleanupPolicy = cleanupModeRef.current;
          const settledBirds: RigidBody[] = [];
          for (let i = 0; i < sim.world.bodies.length; i++) {
            const b = sim.world.bodies[i];
            if (!b.isActive || b.kind !== 'bird' || b === sim.bird || b.fadingOut) continue;
            if (b.x < -220 || b.x > WORLD_W + 260 || b.y > WORLD_H + 140) {
              removeBodyFromWorld(sim.world, b);
              continue;
            }
            const spd = Math.hypot(b.vx, b.vy);
            const isSettled =
              (b.flightAge > 0.95 &&
                (b.hasStruck || b.y >= GROUND_Y - b.radius - 14 || b.matterBody.isSleeping) &&
                spd < 38) ||
              (b.flightAge > 4.5 && spd < 68);
            if (isSettled) {
              if (cleanupPolicy === 'fade-4s' && b.restAge >= 4.0) {
                b.fadingOut = true;
              } else {
                settledBirds.push(b);
              }
            }
          }
          if (cleanupPolicy === 'fade-30' && settledBirds.length > 30) {
            const excess = settledBirds.length - 30;
            for (let i = 0; i < excess; i++) {
              settledBirds[i].fadingOut = true;
            }
          } else if (cleanupPolicy === 'keep-60' && settledBirds.length > 60) {
            const excess = settledBirds.length - 60;
            for (let i = 0; i < excess; i++) {
              settledBirds[i].fadingOut = true;
            }
          }
        }

        // Fast floor-sliding blocks kick up trailing turf dust
        if (groundFxRef.current !== 'craters') {
          const maxDust = isEcoRef.current ? 24 : 64;
          for (let i = 0; i < sim.world.bodies.length; i++) {
            const b = sim.world.bodies[i];
            if (b.isStatic || !b.isActive || b.kind === 'bird') continue;
            if (b.y + b.hh >= GROUND_Y - 6 && Math.abs(b.vx) > 95) {
              const lastSlide = sim.slideCooldowns.get(b.id) ?? -99;
              if (sim.timeSec - lastSlide > (isEcoRef.current ? 0.08 : 0.045)) {
                sim.slideCooldowns.set(b.id, sim.timeSec);
                if (sim.dustClouds.length >= maxDust) sim.dustClouds.shift();
                sim.dustClouds.push({
                  x: b.x - Math.sign(b.vx) * b.hw * 0.45,
                  y: GROUND_Y - 3,
                  vx: -b.vx * 0.16 + (Math.random() - 0.5) * 20,
                  vy: -(14 + Math.random() * 24),
                  radius: 5 + Math.random() * 5,
                  growth: 14,
                  alpha: 0.55,
                  life: 0,
                  maxLife: 0.45 + Math.random() * 0.25,
                  color:
                    b.kind === 'ice'
                      ? 'rgba(224,242,254,0.68)'
                      : 'rgba(214,193,164,0.68)',
                });
              }
            }
          }
        }

        // Smart Auto AI mid-air ability trigger & flight tracking
        if (sim.phase === 'flying') {
          sim.phaseTimer += dt;
          if (!sim.hasCollided) {
            sim.bird.angle = Math.atan2(sim.bird.vy, sim.bird.vx);
            sim.trailTimer += dt;
            if (sim.trailTimer >= 0.025) {
              sim.trailTimer = 0;
              const bSpec = BIRD_SPECS[sim.bird.birdType ?? 'red'];
              sim.trailDots.push({
                x: sim.bird.x,
                y: sim.bird.y,
                r: (sim.bird.dashTimer ?? 0) > 0 ? 4.4 : 3.3,
                alpha: 0.78,
                color: (sim.bird.dashTimer ?? 0) > 0 ? bSpec.accentColor : undefined,
              });
              if (sim.trailDots.length > 34) sim.trailDots.shift();
            }

            if (
              autoModeRef.current &&
              !sim.autoAbilityUsedThisShot &&
              !sim.bird.abilityUsed &&
              sim.bird.x > 460
            ) {
              const distToTarget = Math.hypot(
                sim.bird.x - sim.autoTarget.targetX,
                sim.bird.y - sim.autoTarget.targetY
              );
              const bType = sim.bird.birdType ?? 'red';
              const shouldTrigger =
                (bType === 'blues' && sim.bird.x >= sim.autoTarget.targetX - 240) ||
                (bType === 'chuck' && sim.bird.x >= 560 && sim.bird.vx > 100) ||
                (bType === 'terence' && Math.abs(sim.bird.x - sim.autoTarget.targetX) < 95) ||
                (bType === 'bomb' && distToTarget < 115) ||
                (bType === 'red' && distToTarget < 110);
              if (shouldTrigger) {
                sim.autoAbilityUsedThisShot = true;
                triggerActiveBirdAbility(sim);
              }
            }
          }

          const speed = Math.hypot(sim.bird.vx, sim.bird.vy);
          if (
            (sim.hasCollided && sim.phaseTimer > 0.95) ||
            !sim.bird.isActive ||
            sim.bird.x > WORLD_W + 120 ||
            sim.phaseTimer > 3.1 ||
            (speed < 34 && sim.phaseTimer > 0.65)
          ) {
            sim.phase = 'settling';
            sim.phaseTimer = 0;
          }
        } else if (sim.phase === 'settling') {
          sim.phaseTimer += dt;
          if (sim.phaseTimer >= 0.55) {
            const pigsLeft = sim.world.bodies.filter(
              (b) => b.isActive && b.kind === 'pig'
            ).length;
            const outOfBirds = !infiniteBirdsRef.current && sim.birdsLeft <= 0;

            if (pigsLeft === 0) {
              sim.phase = 'cleared';
              sim.phaseTimer = 0;
              const def = getLevelDef(presetRef.current);
              const earnedStars =
                sim.score >= def.starScores[2]
                  ? 3
                  : sim.score >= def.starScores[1]
                    ? 2
                    : 1;
              bumpRecordsRef.current({}, { bestSlingshotScore: sim.score });
              victoryCueRef.current(earnedStars);
              setClearedBanner({
                levelName: def.name,
                score: sim.score,
                stars: earnedStars,
                birdsUsed: sim.levelShotsUsed,
              });
              setPhaseLabel(`${def.name} Cleared!`);
            } else if (outOfBirds) {
              resetWorld(presetRef.current, autoModeRef.current);
            } else {
              reloadNextBird(sim, autoModeRef.current ? 'auto_pulling' : 'ready');
              setPhaseLabel(
                autoModeRef.current ? 'Pulling Back' : 'Drag Slingshot to Shoot'
              );
            }
          }
        } else if (sim.phase === 'cleared') {
          sim.phaseTimer += dt;
          if (autoModeRef.current && sim.phaseTimer >= 2.6) {
            const curIdx = TOWER_PRESETS.indexOf(presetRef.current);
            const nextPreset = TOWER_PRESETS[(curIdx + 1) % TOWER_PRESETS.length];
            setPreset(nextPreset);
          }
        }

        // Smooth cinema camera interpolation (Wide vs Follow)
        if (cameraModeRef.current === 'follow') {
          const isFlight = sim.phase === 'flying' && sim.bird.isActive;
          const targetX = isFlight
            ? Math.max(460, Math.min(WORLD_W - 340, sim.bird.x + 120))
            : sim.phase === 'dragging'
              ? 580
              : 860;
          const targetY = isFlight
            ? Math.max(250, Math.min(WORLD_H * 0.62, sim.bird.y + 40))
            : WORLD_H * 0.54;
          const targetZoom = isFlight ? 1.18 : 1.08;
          const k = Math.min(1, dt * 4.5);
          sim.camFocusX += (targetX - sim.camFocusX) * k;
          sim.camFocusY += (targetY - sim.camFocusY) * k;
          sim.camZoom += (targetZoom - sim.camZoom) * k;
        } else {
          const k = Math.min(1, dt * 6);
          sim.camFocusX += (WORLD_W * 0.5 - sim.camFocusX) * k;
          sim.camFocusY += (WORLD_H * 0.52 - sim.camFocusY) * k;
          sim.camZoom += (1 - sim.camZoom) * k;
        }

        sim.shake = Math.max(0, sim.shake - dt * 24);
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.life += dt;
          if (p.life >= p.maxLife) {
            sim.particles.splice(i, 1);
            continue;
          }
          p.vy += 680 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += p.omega * dt;
          if (p.y > GROUND_Y - 2) {
            p.y = GROUND_Y - 2;
            p.vy *= -0.35;
            p.vx *= 0.72;
          }
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }

        for (let i = sim.explosions.length - 1; i >= 0; i--) {
          const ex = sim.explosions[i];
          ex.radius += (ex.maxRadius - ex.radius) * Math.min(1, dt * 13) + dt * 95;
          ex.alpha -= dt * 2.4;
          if (ex.alpha <= 0 || ex.radius >= ex.maxRadius * 1.05) {
            sim.explosions.splice(i, 1);
          }
        }

        for (let i = sim.scorches.length - 1; i >= 0; i--) {
          sim.scorches[i].alpha -= dt * 0.04;
          if (sim.scorches[i].alpha <= 0) sim.scorches.splice(i, 1);
        }

        for (let i = sim.popups.length - 1; i >= 0; i--) {
          const pop = sim.popups[i];
          pop.life += dt;
          pop.y += pop.vy * dt;
          pop.vy *= 0.94;
          if (pop.life >= pop.maxLife) sim.popups.splice(i, 1);
        }

        for (let i = sim.groundDivots.length - 1; i >= 0; i--) {
          const d = sim.groundDivots[i];
          d.age += dt;
          if (d.age >= d.maxAge) {
            sim.groundDivots.splice(i, 1);
            continue;
          }
          d.depth += (d.targetDepth - d.depth) * Math.min(1, dt * 16);
          d.wobble = Math.max(0, d.wobble - dt * 3.2);
        }

        for (let i = sim.shockwaves.length - 1; i >= 0; i--) {
          const sw = sim.shockwaves[i];
          sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 9.5) + dt * 45;
          sw.alpha -= dt * 1.9;
          if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
            sim.shockwaves.splice(i, 1);
          }
        }

        const { gravityScale, windFactor } = getEnvironmentParams(envPresetRef.current);
        for (let i = sim.dustClouds.length - 1; i >= 0; i--) {
          const dc = sim.dustClouds[i];
          dc.life += dt;
          if (dc.life >= dc.maxLife) {
            sim.dustClouds.splice(i, 1);
            continue;
          }
          dc.vx += windFactor * 160 * dt;
          dc.vx *= 1 - Math.min(0.6, dt * 2.2);
          dc.vy += 12 * dt;
          dc.x += dc.vx * dt;
          dc.y += dc.vy * dt;
          dc.radius += dc.growth * dt;
          const t = dc.life / dc.maxLife;
          dc.alpha = (1 - t) * (1 - t) * 0.72;
        }

        statsTimer += dt;
        if (statsTimer >= 0.16) {
          statsTimer = 0;
          const pigs = sim.world.bodies.filter((b) => b.isActive && b.kind === 'pig').length;
          const blocks = sim.world.bodies.filter(
            (b) => b.isActive && !b.isStatic && b.kind !== 'bird' && b.kind !== 'pig'
          ).length;
          if (sim.score > sim.lastSavedBestScore) {
            sim.lastSavedBestScore = sim.score;
            bumpRecordsRef.current({}, { bestSlingshotScore: sim.score });
          }
          const abilityNowReady =
            sim.phase === 'flying' &&
            sim.bird.isActive &&
            !sim.bird.abilityUsed &&
            !sim.bird.hasStruck;
          setStats((prev) =>
            prev.pigsLeft === pigs &&
            prev.blocksLeft === blocks &&
            prev.score === sim.score &&
            prev.birdsLeft === sim.birdsLeft &&
            prev.birdsUsed === sim.birdsUsed &&
            prev.activeBird === sim.activeBirdType &&
            prev.abilityReady === abilityNowReady
              ? prev
              : {
                  pigsLeft: pigs,
                  blocksLeft: blocks,
                  score: sim.score,
                  birdsLeft: sim.birdsLeft,
                  birdsUsed: sim.birdsUsed,
                  activeBird: sim.activeBirdType,
                  abilityReady: abilityNowReady,
                }
          );
        }

        const isAiming = sim.phase === 'auto_pulling' || sim.phase === 'dragging';
        const trajDots =
          trajLenRef.current === 'short'
            ? 10
            : trajLenRef.current === 'extended'
              ? 28
              : 18;
        const trajectoryPts: Array<{ x: number; y: number }> = [];
        if (showAimGuidesRef.current && isAiming) {
          const gainBoost = (released60Ref.current ? 1.12 : 1.0) * sb.birdsPower;
          const vx = (SLING_ANCHOR_X - sim.bird.x) * LAUNCH_GAIN * gainBoost;
          const vy = (SLING_ANCHOR_Y - sim.bird.y) * LAUNCH_GAIN * gainBoost;
          const effectiveG = GRAVITY * gravityScale * sb.gravityScale;
          const gx = effectiveG * windFactor;
          const gy = effectiveG;
          for (let i = 1; i <= trajDots; i++) {
            const t = i * 0.052;
            trajectoryPts.push({
              x: sim.bird.x + vx * t + 0.5 * gx * t * t,
              y: sim.bird.y + vy * t + 0.5 * gy * t * t,
            });
          }
        }

        const lvlIdx = LEVEL_CATALOG.findIndex((l) => l.id === presetRef.current);
        const atmosphereHint = ((lvlIdx >= 0 ? lvlIdx : 0) % 3) as 0 | 1 | 2;
        const birdInSling =
          sim.phase === 'ready' || sim.phase === 'dragging' || sim.phase === 'auto_pulling';
        const showReticle =
          fireModeRef.current === 'rapid' ? rapidReticleRef.current : null;
        const quiverTypes: BirdType[] = [
          pickBirdTypeForShot(sim.levelShotsUsed + 1, presetRef.current),
          pickBirdTypeForShot(sim.levelShotsUsed + 2, presetRef.current),
          pickBirdTypeForShot(sim.levelShotsUsed + 3, presetRef.current),
        ];

        if (engine3d) {
          engine3d.update({
            dt,
            bodies: sim.world.bodies,
            activeBird: sim.bird,
            birdAlpha: sim.birdAlpha,
            phase: sim.phase,
            camFocusX: sim.camFocusX,
            camFocusY: sim.camFocusY,
            camZoom: sim.camZoom,
            budget,
            shaderMood: sb.shaderMood,
            weather: sb.weather,
            cameraPreset: camera3dPresetRef.current,
            freeOrbit: sb.freeOrbit,
            giantBirds: sb.giantBirds,
            showTrajGuide: showAimGuidesRef.current && isAiming,
            trajectoryPts,
            slingAnchorX: SLING_ANCHOR_X,
            slingAnchorY: SLING_ANCHOR_Y,
            floorY: GROUND_Y,
            pouchX: sim.pouchX,
            pouchY: sim.pouchY,
            activeBirdType: sim.activeBirdType,
            explosionPulse: explosionPulseRef.current,
            quiverTypes,
            quiverCount: sim.birdsLeft,
            infiniteBirds: infiniteBirdsRef.current,
            birdInSling,
            atmosphereHint,
            particles: sim.particles,
            dustClouds: sim.dustClouds,
            scorches: sim.scorches,
            groundDivots: sim.groundDivots,
            popups: sim.popups,
            trailDots: sim.trailDots,
            rapidReticle: showReticle,
          });
        } else if (ctx2d && canvas2d) {
          const cssH = mountEl.clientHeight || window.innerHeight;
          const gainBoost = (released60Ref.current ? 1.12 : 1.0) * sb.birdsPower;
          ctx2d.save();
          ctx2d.setTransform(budget.dpr, 0, 0, budget.dpr, 0, 0);
          renderSlingshotScene(ctx2d, cssW, cssH, {
            bird: sim.bird,
            activeBirdType: sim.activeBirdType,
            quiverTypes,
            bodies: sim.world.bodies,
            isAiming: showAimGuidesRef.current && isAiming,
            birdInSling,
            pouchX: sim.pouchX,
            pouchY: sim.pouchY,
            launchVx: (SLING_ANCHOR_X - sim.bird.x) * LAUNCH_GAIN * gainBoost,
            launchVy: (SLING_ANCHOR_Y - sim.bird.y) * LAUNCH_GAIN * gainBoost,
            trailDots: sim.trailDots,
            particles: sim.particles,
            groundDivots: sim.groundDivots,
            shockwaves: sim.shockwaves,
            dustClouds: sim.dustClouds,
            explosions: sim.explosions,
            scorches: sim.scorches,
            popups: sim.popups,
            trajectoryDotCount: trajDots,
            gravityScale: gravityScale * sb.gravityScale,
            windFactor,
            shakeMagnitude: sim.shake,
            timeSec: sim.timeSec,
            quiverCount: sim.birdsLeft,
            infiniteBirds: infiniteBirdsRef.current,
            birdAlpha: sim.birdAlpha,
            towerAlpha: sim.towerAlpha,
            atmosphereHint,
            camera: {
              focusX: sim.camFocusX,
              focusY: sim.camFocusY,
              zoom: sim.camZoom,
            },
            rapidReticle: showReticle,
            fastRender: budget.fastShader,
          });
          ctx2d.restore();
        }
        explosionPulseRef.current = null;
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      engine3dRef.current = null;
      engine3d?.dispose();
      if (canvas2d && canvas2d.parentNode === mountEl) {
        mountEl.removeChild(canvas2d);
      }
    };
  }, [
    launchBirdFromPull,
    pickBirdTypeForShot,
    reloadNextBird,
    renderMode,
    resetWorld,
    triggerActiveBirdAbility,
  ]);

  const updateDragPosition = (
    wx: number,
    wy: number,
    sim: NonNullable<typeof simRef.current>
  ) => {
    let dx = wx - SLING_ANCHOR_X;
    let dy = wy - SLING_ANCHOR_Y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_PULL_DIST) {
      dx = (dx / dist) * MAX_PULL_DIST;
      dy = (dy / dist) * MAX_PULL_DIST;
    }
    const clampedY = Math.min(GROUND_Y - SLING_ANCHOR_Y - 22, dy);
    sim.bird.x = SLING_ANCHOR_X + dx;
    sim.bird.y = SLING_ANCHOR_Y + clampedY;
    sim.bird.angle = Math.atan2(-clampedY, -dx);

    const pLen = Math.hypot(dx, clampedY) || 1;
    sim.pouchX = sim.bird.x + (dx / pLen) * 12;
    sim.pouchY = sim.bird.y + (clampedY / pLen) * 12;
  };

  const aimSlingAtTarget = (
    tx: number,
    ty: number,
    sim: NonNullable<typeof simRef.current>
  ) => {
    const { gravityScale, windFactor } = getEnvironmentParams(envPresetRef.current);
    const gx = GRAVITY * gravityScale * windFactor;
    const gy = GRAVITY * gravityScale;

    const safeTx = Math.max(SLING_ANCHOR_X + 80, tx);
    const safeTy = Math.min(GROUND_Y - 12, ty);
    const yPeak = Math.max(
      70,
      Math.min(SLING_ANCHOR_Y, safeTy) -
        Math.min(185, Math.max(60, (safeTx - SLING_ANCHOR_X) * 0.2))
    );
    const tUp = Math.sqrt(Math.max(0.015, (2 * (SLING_ANCHOR_Y - yPeak)) / gy));
    const tDown = Math.sqrt(Math.max(0.015, (2 * (safeTy - yPeak)) / gy));
    const tFlight = tUp + tDown;
    const desiredVx = (safeTx - SLING_ANCHOR_X - 0.5 * gx * tFlight * tFlight) / tFlight;
    const desiredVy = -gy * tUp;

    let dx = -desiredVx / LAUNCH_GAIN;
    let dy = -desiredVy / LAUNCH_GAIN;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_PULL_DIST) {
      dx = (dx / dist) * MAX_PULL_DIST;
      dy = (dy / dist) * MAX_PULL_DIST;
    }
    const clampedY = Math.min(GROUND_Y - SLING_ANCHOR_Y - 22, dy);
    sim.bird.x = SLING_ANCHOR_X + dx;
    sim.bird.y = SLING_ANCHOR_Y + clampedY;
    sim.bird.angle = Math.atan2(-clampedY, -dx);

    const pLen = Math.hypot(dx, clampedY) || 1;
    sim.pouchX = sim.bird.x + (dx / pLen) * 12;
    sim.pouchY = sim.bird.y + (clampedY / pLen) * 12;
  };

  const getWorldPoint = (
    clientX: number,
    clientY: number,
    mountEl: HTMLDivElement,
    sim: NonNullable<typeof simRef.current>
  ) => {
    if (engine3dRef.current) {
      return engine3dRef.current.clientToWorld(clientX, clientY);
    }
    return clientToWorldCoords(clientX, clientY, mountEl.getBoundingClientRect(), {
      focusX: sim.camFocusX,
      focusY: sim.camFocusY,
      zoom: sim.camZoom,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit) return;
    const mountEl = mountRef.current;
    let sim = simRef.current;
    if (!mountEl || !sim) return;

    if (e.button === 2) {
      e.preventDefault();
      triggerActiveBirdAbility(sim);
      return;
    }
    if (e.button !== 0 && e.pointerType !== 'touch') return;

    const pt = getWorldPoint(e.clientX, e.clientY, mountEl, sim);
    rapidReticleRef.current = pt;
    const distToAnchor = Math.hypot(pt.x - SLING_ANCHOR_X, pt.y - SLING_ANCHOR_Y);

    if (autoModeRef.current) {
      setAutoMode(false);
      autoModeRef.current = false;
    }

    if (sim.phase === 'cleared') {
      resetWorld(presetRef.current, false);
      sim = simRef.current;
      if (!sim) return;
    }

    // In Drag mode: first mid-air click triggers unspent bird ability before reloading!
    if (
      fireModeRef.current === 'drag' &&
      sim.phase === 'flying' &&
      sim.bird.isActive &&
      !sim.bird.abilityUsed &&
      !sim.bird.hasStruck
    ) {
      if (triggerActiveBirdAbility(sim)) {
        return;
      }
    }

    if (sim.phase === 'flying' || sim.phase === 'settling') {
      if (!infiniteBirdsRef.current && sim.birdsLeft <= 0) {
        resetWorld(presetRef.current, false);
        sim = simRef.current;
        if (!sim) return;
      } else {
        reloadNextBird(sim, fireModeRef.current === 'rapid' ? 'ready' : 'dragging');
      }
    }

    if (fireModeRef.current === 'rapid') {
      if (pt.x < 420 && distToAnchor < 180) {
        updateDragPosition(pt.x, pt.y, sim);
      } else {
        aimSlingAtTarget(pt.x, pt.y, sim);
      }
      sim.birdAlpha = 1;
      launchBirdFromPull(sim);
      return;
    }

    sim.phase = 'dragging';
    sim.birdAlpha = 1;
    stretchCueRef.current();
    mountEl.setPointerCapture(e.pointerId);

    if (pt.x < 520 || distToAnchor < 220) {
      sim.dragMode = 'sling';
      setPhaseLabel('Pull Back & Release');
      updateDragPosition(pt.x, pt.y, sim);
    } else {
      sim.dragMode = 'target';
      setPhaseLabel('Release to Fire at Target');
      aimSlingAtTarget(pt.x, pt.y, sim);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit) return;
    const mountEl = mountRef.current;
    const sim = simRef.current;
    if (!mountEl || !sim) return;
    const pt = getWorldPoint(e.clientX, e.clientY, mountEl, sim);
    rapidReticleRef.current = pt;
    if (sim.phase !== 'dragging') return;
    if (sim.dragMode === 'target') {
      aimSlingAtTarget(pt.x, pt.y, sim);
    } else {
      updateDragPosition(pt.x, pt.y, sim);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit) return;
    const mountEl = mountRef.current;
    const sim = simRef.current;
    if (!mountEl || !sim || sim.phase !== 'dragging') return;
    if (mountEl.hasPointerCapture(e.pointerId)) {
      mountEl.releasePointerCapture(e.pointerId);
    }

    const pullDist = Math.hypot(
      SLING_ANCHOR_X - sim.bird.x,
      SLING_ANCHOR_Y - sim.bird.y
    );
    if (pullDist > 12 || sim.dragMode === 'target') {
      launchBirdFromPull(sim);
    } else {
      sim.phase = 'ready';
      sim.bird.x = SLING_ANCHOR_X;
      sim.bird.y = SLING_ANCHOR_Y;
      sim.pouchX = SLING_ANCHOR_X;
      sim.pouchY = SLING_ANCHOR_Y;
      setPhaseLabel('Drag Slingshot or Click Target');
    }
  };

  const isSwiss = prefs.skin === 'swiss';
  const cardStyle = isSwiss
    ? {
        backgroundColor: `rgba(248, 250, 252, ${Math.max(0.92, prefs.hudOpacity)})`,
        borderColor: 'rgba(15, 23, 42, 0.16)',
        color: '#0f172a',
      }
    : {
        backgroundColor: 'rgba(9, 13, 25, 0.88)',
        borderColor: activePreset.hudBorder,
        color: activePreset.hudText,
        opacity: Math.max(0.85, Math.min(1, prefs.hudOpacity + 0.08)),
      };
  const accentColor =
    isSwiss && !activePreset.isLight ? '#0284c7' : activePreset.accent;

  const handleQuiverChange = (next: 'inf' | 3 | 5 | 7) => {
    if (next === 'inf') {
      setInfiniteBirds(true);
      infiniteBirdsRef.current = true;
    } else {
      setInfiniteBirds(false);
      infiniteBirdsRef.current = false;
      setQuiverSize(next);
      quiverSizeRef.current = next;
      if (simRef.current) {
        simRef.current.birdsLeft = next;
        setStats((prev) => ({ ...prev, birdsLeft: next }));
      }
    }
  };

  const levelDef = getLevelDef(preset);
  const currentStars =
    stats.score >= levelDef.starScores[2]
      ? 3
      : stats.score >= levelDef.starScores[1]
        ? 2
        : stats.score >= levelDef.starScores[0]
          ? 1
          : 0;

  return (
    <main
      aria-label="Interactive 3D Angry Birds 6.0 game"
      className="relative h-full w-full overflow-hidden bg-[#1e4e96] select-none"
    >
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => {
          e.preventDefault();
          if (simRef.current && !prefs.sandboxFreeOrbit) {
            triggerActiveBirdAbility(simRef.current);
          }
        }}
        onPointerLeave={() => {
          rapidReticleRef.current = null;
        }}
        className={`h-full w-full touch-none ${
          prefs.sandboxFreeOrbit
            ? 'cursor-grab active:cursor-grabbing'
            : prefs.angryBirdsFireMode === 'rapid'
              ? 'cursor-crosshair'
              : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {!zenMode && (
        <section
          aria-label="Angry Birds 6.0 controls and score"
          style={cardStyle}
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute top-14 left-2 z-20 max-h-[calc(100dvh-11.5rem)] w-[336px] max-w-[calc(100%-1rem)] overflow-y-auto border p-3.5 shadow-xl md:top-14 md:left-3 md:max-h-none md:overflow-visible ${
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
            <div className="flex items-center gap-2">
              <h1
                className="font-display text-sm font-semibold tracking-wide"
                style={{ color: accentColor }}
              >
                Angry Birds
              </h1>
              <span className="font-mono-num text-[11px] opacity-65">
                {released60 ? '6.0' : '5.0'}
              </span>
              <InfoBadge id="birds-card" />
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5" aria-label={`${currentStars} of 3 stars`}>
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${
                      currentStars >= s ? 'fill-amber-400 text-amber-400' : 'opacity-25'
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="font-mono-num text-xs font-semibold" style={{ color: accentColor }}>
                {stats.score}
              </span>
              <button
                type="button"
                onClick={() => setPanelCollapsed((p) => !p)}
                aria-expanded={!panelCollapsed}
                aria-label={
                  panelCollapsed
                    ? 'Expand Angry Birds controls'
                    : 'Collapse Angry Birds controls'
                }
                className="rounded p-0.5 opacity-75 hover:bg-white/10 hover:opacity-100"
              >
                {panelCollapsed ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] opacity-85 font-mono-num">
            <span>{levelDef.name}</span>
            <span aria-hidden="true">·</span>
            <span>{stats.pigsLeft} pigs</span>
            <span aria-hidden="true">·</span>
            <span>{infiniteBirds ? '∞ left' : `${stats.birdsLeft} left`}</span>
          </div>

          {!panelCollapsed && (
            <>
              {/* 6-Level Selector */}
              <div data-tour-id="birds-fortresses" className="mt-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-80">
                    Fortress Stages <InfoBadge id="birds-fortresses" />
                  </span>
                  <span className="font-mono-num text-[10px] opacity-60">Shift+1..6</span>
                </div>
                <div
                  className="grid grid-cols-3 gap-1 rounded-lg bg-white/8 p-1"
                  role="group"
                  aria-label="Fortress levels"
                >
                  {LEVEL_CATALOG.map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setPreset(lvl.id)}
                      title={lvl.subtitle}
                      className={`h-6 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none ${
                        preset === lvl.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {lvl.index + 1}. {lvl.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quiver & Camera Framing */}
              <div data-tour-id="birds-quiver-cam" className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                    Quiver <InfoBadge id="birds-quiver" />
                  </span>
                  <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-white/8 p-0.5">
                    {(
                      [
                        { id: 'inf', label: '∞', active: infiniteBirds },
                        { id: 3, label: '3', active: !infiniteBirds && quiverSize === 3 },
                        { id: 5, label: '5', active: !infiniteBirds && quiverSize === 5 },
                        { id: 7, label: '7', active: !infiniteBirds && quiverSize === 7 },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={String(opt.id)}
                        type="button"
                        onClick={() => handleQuiverChange(opt.id)}
                        className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                          opt.active
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                    3D Angle <InfoBadge id="birds-camera" />
                  </span>
                  <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-white/8 p-0.5">
                    {(
                      [
                        { id: 'classic', label: 'Wide', follow: 'wide' },
                        { id: 'tactical', label: 'Tact', follow: 'follow' },
                        { id: 'shoulder', label: 'Sling', follow: 'wide' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCamera3dPreset(opt.id);
                          setCameraMode(opt.follow);
                        }}
                        className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                          camera3dPreset === opt.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ground FX, Aim Arc & Gravity */}
              <div data-tour-id="birds-physics-grid" className="mt-2 flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                    Ground FX <InfoBadge id="birds-ground-fx" />
                  </span>
                  <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-white/8 p-0.5">
                    {(
                      [
                        { id: 'full', label: 'Full' },
                        { id: 'dust', label: 'Dust' },
                        { id: 'craters', label: 'Crater' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePrefs({ slingshotGroundFx: opt.id })}
                        className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                          prefs.slingshotGroundFx === opt.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                    Aim Arc <InfoBadge id="birds-aim-arc" />
                  </span>
                  <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-white/8 p-0.5">
                    {(
                      [
                        { id: 'short', label: 'Short' },
                        { id: 'classic', label: 'Std' },
                        { id: 'extended', label: 'Long' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePrefs({ slingshotTrajLen: opt.id })}
                        className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                          prefs.slingshotTrajLen === opt.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gravity & Wind */}
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                  Gravity &amp; Wind <InfoBadge id="birds-env" />
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/8 p-0.5">
                  {(
                    [
                      { id: 'standard', label: 'Standard' },
                      { id: 'low-g', label: 'Low-G' },
                      { id: 'breeze', label: 'Headwind' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ slingshotEnvPreset: opt.id })}
                      className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                        prefs.slingshotEnvPreset === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              </div>

              {/* Fire Style, Mid-Air Collision & Cleanup */}
              <div data-tour-id="birds-rapid-grid" className="mt-2 flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                    Fire Style <InfoBadge id="birds-fire-mode" />
                  </span>
                  <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-white/8 p-0.5">
                    {(
                      [
                        { id: 'drag', label: 'Drag' },
                        { id: 'rapid', label: 'Rapid' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePrefs({ angryBirdsFireMode: opt.id })}
                        className={`inline-flex h-6 items-center justify-center gap-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                          prefs.angryBirdsFireMode === opt.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {opt.id === 'rapid' && <Zap className="h-2.5 w-2.5" aria-hidden="true" />}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                    Mid-Air Birds <InfoBadge id="birds-midair" />
                  </span>
                  <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-white/8 p-0.5">
                    {(
                      [
                        { id: 'pass-through', label: 'Pass' },
                        { id: 'collide', label: 'Collide' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePrefs({ angryBirdsFlightMode: opt.id })}
                        className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                          prefs.angryBirdsFlightMode === opt.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Landed Cleanup */}
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-75">
                  Landed Cleanup <InfoBadge id="birds-cleanup" />
                </span>
                <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-white/8 p-0.5">
                  {(
                    [
                      { id: 'fade-30', label: 'Fade 30' },
                      { id: 'keep-60', label: 'Keep 60' },
                      { id: 'fade-4s', label: '4s Idle' },
                      { id: 'manual', label: 'Until R' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ angryBirdsCleanup: opt.id })}
                      className={`h-6 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                        prefs.angryBirdsCleanup === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoMode((prev) => !prev)}
                  aria-pressed={autoMode}
                  className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none ${
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
                  <span>{autoMode ? 'Auto AI' : 'Manual'}</span>
                  <InfoBadge id="birds-auto-rebuild" />
                </button>

                <button
                  type="button"
                  onClick={() => resetWorld(preset, autoMode)}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/8 px-2 text-[11px] font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/15 focus-visible:outline-none"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Rebuild (R)</span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Bird Flock Roster & Mid-Air Ability Trigger Bar */}
      {!zenMode && (
        <section
          data-tour-id="birds-roster-bar"
          aria-label="Bird flock selector and ability trigger"
          style={cardStyle}
          onPointerDown={(e) => e.stopPropagation()}
          className={`no-scrollbar absolute right-2 bottom-16 left-2 z-20 flex flex-nowrap items-center gap-1.5 overflow-x-auto border p-1.5 shadow-xl md:right-3 md:bottom-3 md:left-auto md:flex-wrap md:overflow-visible ${
            isSwiss ? 'hud-swiss' : ''
          } rounded-xl`}
        >
          <InfoBadge id="birds-roster" />
          <button
            type="button"
            onClick={handleToggleSquadCycle}
            aria-pressed={squadCycle}
            title="Auto-rotate through each stage's optimal bird squad"
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              squadCycle
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/8 text-slate-200 hover:bg-white/15'
            }`}
          >
            <RefreshCw className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Squad</span>
          </button>

          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/8 p-0.5">
            {BIRD_ROSTER_ORDER.map((bId) => {
              const spec = BIRD_SPECS[bId];
              const isSelected = stats.activeBird === bId;
              return (
                <button
                  key={bId}
                  type="button"
                  onClick={() => handleSelectBirdFromRoster(bId)}
                  title={`${spec.name} — ${spec.tagline} (Q to cycle)`}
                  aria-pressed={isSelected}
                  className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                    style={{ backgroundColor: spec.accentColor }}
                    aria-hidden="true"
                  />
                  <span>{spec.name}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (simRef.current) triggerActiveBirdAbility(simRef.current);
            }}
            disabled={!stats.abilityReady && prefs.angryBirdsFireMode !== 'rapid'}
            title="Trigger active bird mid-air ability (Space / E / Right-Click)"
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              stats.abilityReady
                ? 'bg-rose-500 text-white shadow-sm hover:bg-rose-400'
                : 'bg-white/8 text-slate-300 hover:bg-white/15 disabled:opacity-45'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{BIRD_SPECS[stats.activeBird].abilityName} (Space)</span>
            <InfoBadge id="birds-ability" />
          </button>
        </section>
      )}

      {/* Stage Victory Overlay Card */}
      {clearedBanner && !zenMode && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            style={cardStyle}
            className="w-[340px] max-w-full rounded-2xl border p-5 text-center shadow-2xl"
          >
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`h-7 w-7 ${
                    clearedBanner.stars >= s
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-500 opacity-35'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <h2 className="font-display mt-2.5 text-lg font-bold">
              {clearedBanner.levelName} Cleared
            </h2>
            <p className="font-mono-num mt-1 text-xs opacity-80">
              {clearedBanner.score} pts · {clearedBanner.birdsUsed} birds fired
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => resetWorld(preset, autoMode)}
                className="h-9 rounded-lg border border-white/20 bg-white/10 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/20"
              >
                Replay Stage
              </button>
              <button
                type="button"
                onClick={() => {
                  const curIdx = TOWER_PRESETS.indexOf(preset);
                  const next = TOWER_PRESETS[(curIdx + 1) % TOWER_PRESETS.length];
                  setPreset(next);
                }}
                className="h-9 rounded-lg bg-amber-400 text-xs font-semibold whitespace-nowrap text-slate-950 transition-colors hover:bg-amber-300"
              >
                Next Fortress
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
