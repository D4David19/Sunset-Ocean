import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Flame, Hand, RotateCcw, Sparkles } from 'lucide-react';
import { useAudioManager } from '../context/AudioManagerContext';
import { useRelease } from '../context/ReleaseContext';
import {
  isTypingTarget,
  useStudio,
  type NetParticleMode,
  type SceneCommandPayload,
} from '../context/StudioContext';
import { InfoBadge } from './studio/InfoBadge';
import {
  computeSceneRenderBudget,
  type FramePacingMode,
  type GpuClass,
} from '../utils/hardwareProfile';
import {
  BALL_RADIUS,
  createHoopController,
  createNetMesh,
  DEFAULT_SHOOT_X,
  DEFAULT_SHOOT_Y,
  FLOOR_Y,
  GRAVITY,
  RIM_CENTER_X,
  RIM_Y,
  solveMovingShotPlan,
  stepBasketballPhysics,
  stepHoopController,
  type BasketballState,
  type ConcreteShotKind,
  type CourtPlayMode,
  type HoopControllerState,
  type NetConstraint,
  type NetNode,
  type RimSpringState,
  type ShooterMode,
  type ShotStyle,
  type ShotTracker,
  type TrailPoint,
} from '../basketball/hoopPhysics';
import {
  createBasketball3dEngine,
  type Basketball3dEngine,
  type Hoops3dCameraMode,
} from '../basketball/basketball3dEngine';
import {
  computeCourtViewport,
  renderBasketballScene,
} from '../basketball/hoopRenderer';
import {
  createShooterState,
  getShooterBallTarget,
  SHOOTER_MAX_X,
  SHOOTER_MIN_X,
  stepShooterState,
  triggerShooterCelebrate,
  triggerShooterJumpShot,
  type CourtVenue,
  type ShooterState,
} from '../basketball/shooterIK';

interface SwishRing { x: number; y: number; radius: number; alpha: number; color: string }
interface ConfettiPiece {
  x: number; y: number; vx: number; vy: number; rot: number; vRot: number;
  flipPhase: number; flipSpeed: number; flutterFreq: number; w: number; h: number;
  color: string; life: number; maxLife: number; settled?: boolean;
}
interface SmokePuff {
  x: number; y: number; vx: number; vy: number; radius: number; growth: number;
  alpha: number; life: number; maxLife: number; tint: string;
}
interface CameraFlash { x: number; y: number; radius: number; life: number; maxLife: number }

interface BasketballSceneProps {
  globalAiMode: boolean;
  aiSyncVersion: number;
}

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

const SHOT_SEQUENCE: ConcreteShotKind[] = ['swish', 'rim-bounce', 'bank'];
const AUTO_COURT_SPOTS = [165, 275, 415, 560, 690, 340];
const MAX_SHOT_SPEED = 1520;
const CONFETTI_COLORS = ['#fbbf24', '#f8fafc', '#fb923c', '#38bdf8', '#f43f5e'];

export default function BasketballScene({
  globalAiMode,
  aiSyncVersion,
}: BasketballSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engine3dRef = useRef<Basketball3dEngine | null>(null);
  const {
    playBasketballSwishCue,
    playBasketballRimCue,
    playBasketballBoardCue,
    playBasketballBounceCue,
    playBasketballHornCue,
    playBasketballCheerCue,
  } = useAudioManager();

  const {
    prefs,
    activePreset,
    records,
    hardwareProfile,
    zenMode,
    updatePrefs,
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
  const [venue, setVenue] = useState<CourtVenue>('arena');
  const [cameraMode, setCameraMode] = useState<Hoops3dCameraMode>('sideline');
  const [shooterMode, setShooterMode] = useState<ShooterMode>('player');
  const [playMode, setPlayMode] = useState<CourtPlayMode>('arcade');
  const [shotStyle, setShotStyle] = useState<ShotStyle>('mixed');
  const [statusLabel, setStatusLabel] = useState(
    globalAiMode ? 'Auto Shooter Active' : 'Click Hoop or Drag to Shoot'
  );
  const [stats, setStats] = useState({ makes: 0, swishes: 0, streak: 0, shots: 0 });

  const autoModeRef = useRef(globalAiMode);
  const venueRef = useRef<CourtVenue>('arena');
  const cameraModeRef = useRef<Hoops3dCameraMode>('sideline');
  const shooterModeRef = useRef<ShooterMode>('player');
  const playModeRef = useRef<CourtPlayMode>('arcade');
  const shotStyleRef = useRef<ShotStyle>('mixed');
  const streakRef = useRef(0);
  const makesRef = useRef(0);
  const swishPulseIdRef = useRef(0);
  const lastSyncRef = useRef(aiSyncVersion);
  const showAimGuidesRef = useRef(prefs.showAimGuides);
  const showTrailsRef = useRef(prefs.showTrails);
  const reducedShakeRef = useRef(prefs.reducedShake);
  const netParticleModeRef = useRef<NetParticleMode>(prefs.netParticleMode);
  const aimSensitivityRef = useRef(prefs.basketballAimSensitivity);
  const isEcoRef = useRef(
    prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato'
  );
  const qualityTierRef = useRef(prefs.qualityTier);
  const framePacingRef = useRef<FramePacingMode>(prefs.framePacingMode);
  const gpuClassRef = useRef<GpuClass>(hardwareProfile.gpuClass);
  const nativeDprRef = useRef(hardwareProfile.nativeDpr);
  const sandboxRef = useRef({
    shaderMood: prefs.shaderMood,
    weather: prefs.sandboxWeather,
    freeOrbit: prefs.sandboxFreeOrbit,
    timeScale: prefs.sandboxTimeScale,
    gravityScale: prefs.sandboxGravityScale,
    fireball: prefs.sandboxHoopsFireball,
    hoopsSpeed: prefs.sandboxHoopsSpeed,
  });
  const bumpRecordsRef = useRef(bumpRecords);
  const keysRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    showAimGuidesRef.current = prefs.showAimGuides;
    showTrailsRef.current = prefs.showTrails;
    reducedShakeRef.current = prefs.reducedShake;
    netParticleModeRef.current = prefs.netParticleMode;
    aimSensitivityRef.current = prefs.basketballAimSensitivity;
    isEcoRef.current =
      prefs.qualityTier === 'eco' || prefs.qualityTier === 'potato';
    qualityTierRef.current = prefs.qualityTier;
    framePacingRef.current = prefs.framePacingMode;
    gpuClassRef.current = hardwareProfile.gpuClass;
    nativeDprRef.current = hardwareProfile.nativeDpr;
    sandboxRef.current = {
      shaderMood: prefs.shaderMood,
      weather: prefs.sandboxWeather,
      freeOrbit: prefs.sandboxFreeOrbit,
      timeScale: prefs.sandboxTimeScale,
      gravityScale: prefs.sandboxGravityScale,
      fireball: prefs.sandboxHoopsFireball,
      hoopsSpeed: prefs.sandboxHoopsSpeed,
    };
    bumpRecordsRef.current = bumpRecords;
  }, [
    bumpRecords,
    hardwareProfile.gpuClass,
    hardwareProfile.nativeDpr,
    prefs.basketballAimSensitivity,
    prefs.framePacingMode,
    prefs.netParticleMode,
    prefs.qualityTier,
    prefs.reducedShake,
    prefs.sandboxFreeOrbit,
    prefs.sandboxGravityScale,
    prefs.sandboxHoopsFireball,
    prefs.sandboxHoopsSpeed,
    prefs.sandboxTimeScale,
    prefs.sandboxWeather,
    prefs.shaderMood,
    prefs.showAimGuides,
    prefs.showTrails,
  ]);

  useEffect(() => {
    const accuracy =
      stats.shots > 0 ? `${Math.round((stats.makes / stats.shots) * 100)}%` : '—';
    reportTelemetry({
      scene: 'basketball',
      title: released60 ? 'All-Star Hoops 6.0' : 'All-Star Hoops',
      status: statusLabel,
      metrics: [
        { label: 'Current Streak', value: String(stats.streak), accent: true },
        { label: 'Best', value: String(Math.max(records.bestBasketballStreak, stats.streak)) },
        { label: 'Makes', value: String(stats.makes) },
        { label: 'Accuracy', value: accuracy },
      ],
    });
  }, [
    records.bestBasketballStreak,
    released60,
    reportTelemetry,
    stats.makes,
    stats.shots,
    stats.streak,
    statusLabel,
  ]);

  const swishCueRef = useRef(playBasketballSwishCue);
  const rimCueRef = useRef(playBasketballRimCue);
  const boardCueRef = useRef(playBasketballBoardCue);
  const bounceCueRef = useRef(playBasketballBounceCue);
  const hornCueRef = useRef(playBasketballHornCue);
  const cheerCueRef = useRef(playBasketballCheerCue);

  useEffect(() => {
    swishCueRef.current = playBasketballSwishCue;
    rimCueRef.current = playBasketballRimCue;
    boardCueRef.current = playBasketballBoardCue;
    bounceCueRef.current = playBasketballBounceCue;
    hornCueRef.current = playBasketballHornCue;
    cheerCueRef.current = playBasketballCheerCue;
  }, [
    playBasketballSwishCue,
    playBasketballRimCue,
    playBasketballBoardCue,
    playBasketballBounceCue,
    playBasketballHornCue,
    playBasketballCheerCue,
  ]);

  const simRef = useRef<{
    isDragging: boolean;
    autoCooldown: number;
    shotCount: number;
    shooter: ShooterState;
    ball: BasketballState;
    rim: RimSpringState;
    hoopCtrl: HoopControllerState;
    nodes: NetNode[];
    constraints: NetConstraint[];
    trail: TrailPoint[];
    trailTimer: number;
    rings: SwishRing[];
    confetti: ConfettiPiece[];
    smokePuffs: SmokePuff[];
    flashes: CameraFlash[];
    tracker: ShotTracker;
    dragAnchorX: number;
    dragAnchorY: number;
    ptrHistory: PointerSample[];
    aimOriginX: number;
    aimOriginY: number;
    aimTargetX: number | null;
    aimTargetY: number | null;
    aimVx: number;
    aimVy: number;
    shake: number;
    crowdExcitement: number;
    goalLightFlash: number;
    boardFlash: number;
    netEmitCooldown: number;
    shotClockSec: number;
    bannerAlert: string;
    timeSec: number;
  } | null>(null);

  const dropLiveCourtBall = useCallback(
    (sim: NonNullable<typeof simRef.current>, x = DEFAULT_SHOOT_X, vxDrift = 0) => {
      sim.ball.x = x;
      sim.ball.y = FLOOR_Y - 195;
      sim.ball.vx = vxDrift;
      sim.ball.vy = -75;
      sim.ball.omega = vxDrift * 0.03;
      sim.ball.active = true;
      sim.ball.alpha = 0.06;
      sim.ball.fadeInRate = 5.0;
      sim.trail = [];
      sim.tracker = {
        touchedRim: false,
        touchedBoard: false,
        scored: false,
        inFlightShot: false,
        prevBallY: sim.ball.y,
        postScoreBounces: 0,
        postMissBounces: 0,
      };
    },
    []
  );

  const attachBallToShooterDribble = useCallback(
    (sim: NonNullable<typeof simRef.current>, resetX?: number) => {
      if (resetX !== undefined) {
        sim.shooter.x = resetX;
        sim.shooter.targetX = null;
        sim.shooter.vx = 0;
      }
      const hand = getShooterBallTarget(sim.shooter);
      sim.ball.x = hand.x;
      sim.ball.y = hand.y;
      sim.ball.vx = 0;
      sim.ball.vy = 0;
      sim.ball.omega = hand.omega;
      sim.ball.active = false;
      sim.ball.alpha = 0.12;
      sim.ball.fadeInRate = 5.4;
      sim.trail = [];
      sim.tracker = {
        touchedRim: false,
        touchedBoard: false,
        scored: false,
        inFlightShot: false,
        prevBallY: hand.y,
        postScoreBounces: 0,
        postMissBounces: 0,
      };
    },
    []
  );

  const initSim = useCallback(
    (startAuto: boolean) => {
      const { nodes, constraints } = createNetMesh();
      const shooter = createShooterState(DEFAULT_SHOOT_X);
      const hand = getShooterBallTarget(shooter);
      const isFree = shooterModeRef.current === 'free';
      simRef.current = {
        isDragging: false,
        autoCooldown: startAuto ? 0.55 : 0,
        shotCount: 0,
        shooter,
        ball: {
          x: isFree ? DEFAULT_SHOOT_X : hand.x,
          y: isFree ? FLOOR_Y - 195 : hand.y,
          vx: 0,
          vy: isFree ? -80 : 0,
          angle: 0,
          omega: 0,
          radius: BALL_RADIUS,
          active: isFree,
          alpha: 0.06,
          fadeInRate: 4.5,
        },
        rim: {
          offsetY: 0,
          velY: 0,
          tilt: 0,
          tiltVel: 0,
          ringVib: 0,
          ringVibVel: 0,
          boardFlex: 0,
          boardFlexVel: 0,
        },
        hoopCtrl: createHoopController(),
        nodes,
        constraints,
        trail: [],
        trailTimer: 0,
        rings: [],
        confetti: [],
        smokePuffs: [],
        flashes: [],
        tracker: {
          touchedRim: false,
          touchedBoard: false,
          scored: false,
          inFlightShot: false,
          prevBallY: isFree ? FLOOR_Y - 195 : hand.y,
          postScoreBounces: 0,
          postMissBounces: 0,
        },
        dragAnchorX: DEFAULT_SHOOT_X,
        dragAnchorY: DEFAULT_SHOOT_Y,
        ptrHistory: [],
        aimOriginX: DEFAULT_SHOOT_X + 24,
        aimOriginY: FLOOR_Y - 134,
        aimTargetX: null,
        aimTargetY: null,
        aimVx: 560,
        aimVy: -920,
        shake: 0,
        crowdExcitement: 0,
        goalLightFlash: 0,
        boardFlash: 0,
        netEmitCooldown: 0,
        shotClockSec: 24.0,
        bannerAlert: '',
        timeSec: 0,
      };
      streakRef.current = 0;
      makesRef.current = 0;
      setStatusLabel(
        startAuto
          ? 'Auto Shooter Active'
          : isFree
            ? 'Free Ball Live — Click or Drag to Shoot'
            : 'Click Hoop or Drag to Shoot'
      );
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
    if (!sim) return;
    if (!autoMode && !sim.isDragging) {
      if (!sim.tracker.inFlightShot) {
        if (shooterModeRef.current === 'free') {
          dropLiveCourtBall(sim, sim.ball.x, 18);
        } else {
          attachBallToShooterDribble(sim);
        }
      }
      setStatusLabel(
        shooterModeRef.current === 'free'
          ? 'Free Ball Live — Click or Drag to Shoot'
          : 'Click Hoop or Drag to Shoot · A/D Move'
      );
    } else if (autoMode) {
      sim.autoCooldown = Math.min(sim.autoCooldown, 0.45);
      setStatusLabel('Auto Shooter Active');
    }
  }, [autoMode, attachBallToShooterDribble, dropLiveCourtBall]);

  useEffect(() => {
    venueRef.current = venue;
  }, [venue]);

  useEffect(() => {
    shooterModeRef.current = shooterMode;
    const sim = simRef.current;
    if (!sim) return;
    if (!sim.tracker.inFlightShot) {
      if (shooterMode === 'free') {
        dropLiveCourtBall(sim, sim.shooter.x, 30);
      } else {
        attachBallToShooterDribble(sim, sim.ball.x);
      }
    }
    if (!autoModeRef.current) {
      setStatusLabel(
        shooterMode === 'free'
          ? 'Free Ball Live — Click or Drag to Shoot'
          : 'Click Hoop or Drag to Shoot · A/D Move'
      );
    }
  }, [shooterMode, attachBallToShooterDribble, dropLiveCourtBall]);

  useEffect(() => {
    playModeRef.current = playMode;
    const sim = simRef.current;
    if (!sim) return;
    if (playMode === 'tee' && !sim.tracker.inFlightShot) {
      if (shooterModeRef.current === 'player') {
        attachBallToShooterDribble(sim, DEFAULT_SHOOT_X);
      } else {
        dropLiveCourtBall(sim, DEFAULT_SHOOT_X);
      }
    }
  }, [playMode, attachBallToShooterDribble, dropLiveCourtBall]);

  useEffect(() => {
    shotStyleRef.current = shotStyle;
  }, [shotStyle]);

  // Full-court keyboard steering (A/D or Left/Right Arrows) + R reset
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = true;
      } else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
        setStats({ makes: 0, swishes: 0, streak: 0, shots: 0 });
        initSim(autoModeRef.current);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      }
    };
    const onBlur = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
    };
    const onSceneCmd = (e: Event) => {
      const detail = (e as CustomEvent<SceneCommandPayload>).detail;
      if (!detail || detail.scene !== 'basketball') return;
      if (detail.type === 'reset-session') {
        setStats({ makes: 0, swishes: 0, streak: 0, shots: 0 });
        initSim(autoModeRef.current);
      } else if (detail.type === 'set-controls-open') {
        setControlsOpen(detail.open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('kas:scene-command', onSceneCmd);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('kas:scene-command', onSceneCmd);
    };
  }, [initSim]);

  const launchConcreteShot = useCallback((kind: ConcreteShotKind) => {
    const sim = simRef.current;
    if (!sim) return;

    const isPlayer = shooterModeRef.current === 'player';
    const shooterOrigin = isPlayer
      ? {
          x:
            playModeRef.current === 'tee'
              ? DEFAULT_SHOOT_X
              : Math.max(SHOOTER_MIN_X, Math.min(SHOOTER_MAX_X, sim.shooter.x + 24)),
          y: FLOOR_Y - 134,
        }
      : playModeRef.current === 'arcade' && sim.ball.x >= 95 && sim.ball.x <= 775
        ? { x: sim.ball.x, y: Math.min(FLOOR_Y - BALL_RADIUS, Math.max(260, sim.ball.y)) }
        : { x: DEFAULT_SHOOT_X, y: FLOOR_Y - 125 };

    if (isPlayer && playModeRef.current === 'tee') {
      sim.shooter.x = DEFAULT_SHOOT_X;
      sim.shooter.targetX = null;
    }

    const plan = solveMovingShotPlan(
      kind,
      sim.shotCount,
      sim.hoopCtrl,
      streakRef.current,
      shooterOrigin
    );

    if (isPlayer) {
      triggerShooterJumpShot(sim.shooter, plan.vx, plan.vy);
    }

    sim.shotCount += 1;
    sim.ball.x = plan.startX;
    sim.ball.y = plan.startY;
    sim.ball.vx = plan.vx;
    sim.ball.vy = plan.vy;
    sim.ball.omega = plan.omega;
    sim.ball.active = true;
    sim.ball.alpha = 1;
    sim.trail = [];
    sim.trailTimer = 0;
    sim.autoCooldown = 1.65;
    sim.shotClockSec = 24.0;
    sim.tracker = {
      touchedRim: false,
      touchedBoard: false,
      scored: false,
      inFlightShot: true,
      prevBallY: plan.startY,
      postScoreBounces: 0,
      postMissBounces: 0,
    };

    setStats((prev) => ({ ...prev, shots: prev.shots + 1 }));
    setStatusLabel(
      kind === 'swish'
        ? 'Pure Swish Arc'
        : kind === 'rim-bounce'
          ? 'Rim-Bounce Shot'
          : 'Backboard Bank Shot'
    );
  }, []);

  const renderMode = prefs.renderMode;

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const is2d = renderMode === '2d';
    const engine3d = is2d ? null : createBasketball3dEngine(mountEl);
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
      initSim(autoModeRef.current);
    }

    let rafId = 0;
    let lastNow = performance.now();
    let lastRenderNow = lastNow;
    let accumulator = 0;
    const fixedDt = 1 / 240;

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
      const rawMs = Math.max(1, now - lastNow);
      const dt = Math.min(0.05, rawMs / 1000) * Math.max(0.2, sb.timeScale);
      lastNow = now;

      const sim = simRef.current;
      if (sim) {
        sim.timeSec += dt;
        sim.crowdExcitement = Math.max(0, sim.crowdExcitement - dt * 0.58);
        sim.goalLightFlash = Math.max(0, sim.goalLightFlash - dt * 1.15);
        sim.boardFlash = Math.max(0, sim.boardFlash - dt * 2.8);
        sim.netEmitCooldown = Math.max(0, sim.netEmitCooldown - dt);

        if (!sim.tracker.inFlightShot) {
          sim.shotClockSec = Math.max(0, sim.shotClockSec - dt);
          if (sim.shotClockSec <= 0) sim.shotClockSec = 24.0;
        }

        // Moving hoop with progressive speed scaling + sandbox patrol speed
        stepHoopController(
          sim.hoopCtrl,
          streakRef.current,
          dt * Math.max(0.2, sb.hoopsSpeed)
        );

        // Human Shooter IK Kinematics & Live Dribble Synchronization
        if (shooterModeRef.current === 'player') {
          const kbDir =
            autoModeRef.current
              ? 0
              : (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);

          if (kbDir !== 0 && autoModeRef.current) {
            setAutoMode(false);
            autoModeRef.current = false;
          }

          stepShooterState(
            sim.shooter,
            dt,
            kbDir,
            sim.isDragging,
            sim.tracker.inFlightShot || sim.ball.active,
            () => {
              if (sim.ball.alpha > 0.5) {
                bounceCueRef.current(0.32);
              }
            }
          );

          // While not in flight, keep ball physically coupled to shooter's live dribble/pocket
          if (!sim.tracker.inFlightShot && !sim.ball.active) {
            const target = getShooterBallTarget(sim.shooter);
            sim.ball.x = target.x;
            sim.ball.y = target.y;
            sim.ball.vx = 0;
            sim.ball.vy = 0;
            sim.ball.angle += target.omega * dt * 2.2;
            if (sim.ball.alpha < 1) {
              sim.ball.alpha = Math.min(1, sim.ball.alpha + sim.ball.fadeInRate * dt);
            }
          }
        }

        // Flight breadcrumb trail
        if (sim.ball.active && Math.hypot(sim.ball.vx, sim.ball.vy) > 170) {
          sim.trailTimer += dt;
          if (sim.trailTimer >= 0.026) {
            sim.trailTimer = 0;
            sim.trail.push({ x: sim.ball.x, y: sim.ball.y, alpha: 1 });
            if (sim.trail.length > 20) sim.trail.shift();
          }
        }

        // Seamless Auto Shooter pacing (relocates across full court between shots)
        if (autoModeRef.current && !sim.isDragging) {
          sim.autoCooldown -= dt;
          if (
            sim.autoCooldown <= 0 &&
            !sim.tracker.inFlightShot &&
            (!sim.ball.active || shooterModeRef.current === 'free') &&
            sim.shooter.targetX === null
          ) {
            const style = shotStyleRef.current;
            const nextKind: ConcreteShotKind =
              style === 'mixed'
                ? SHOT_SEQUENCE[sim.shotCount % SHOT_SEQUENCE.length]
                : style;
            launchConcreteShot(nextKind);
          } else if (sim.autoCooldown <= -1.6) {
            sim.tracker.inFlightShot = false;
            if (shooterModeRef.current === 'player') {
              attachBallToShooterDribble(sim);
            }
            sim.autoCooldown = 0.25;
          }
        }

        // Fixed 240Hz physics substeps
        accumulator += dt;
        while (accumulator >= fixedDt) {
          accumulator -= fixedDt;
          stepBasketballPhysics(
            sim.ball,
            sim.rim,
            sim.nodes,
            sim.constraints,
            fixedDt,
            sim.tracker,
            {
              onRimHit: (intensity) => {
                sim.shake = Math.min(7.5, sim.shake + intensity * 6.0);
                rimCueRef.current(intensity);
              },
              onBoardHit: (intensity) => {
                sim.shake = Math.min(5.0, sim.shake + intensity * 3.8);
                sim.boardFlash = Math.max(sim.boardFlash, Math.min(1, intensity * 1.1));
                boardCueRef.current(intensity);
              },
              onNetContact: (info) => {
                if (sim.netEmitCooldown > 0) return;
                sim.netEmitCooldown = 0.028;

                const mode = netParticleModeRef.current;
                const eco = isEcoRef.current;
                const maxSmoke = eco ? 14 : 64;
                const maxConfetti = eco ? 18 : 110;

                if (mode === 'both' || mode === 'smoke') {
                  const puffCount = eco ? 1 : info.energy > 0.7 ? 3 : 2;
                  for (let p = 0; p < puffCount; p++) {
                    if (sim.smokePuffs.length >= maxSmoke) sim.smokePuffs.shift();
                    const spread = (Math.random() - 0.5) * 46;
                    const maxLife = 0.55 + Math.random() * 0.35;
                    sim.smokePuffs.push({
                      x: info.x + (Math.random() - 0.5) * 16,
                      y: info.y + (Math.random() - 0.5) * 12,
                      vx: info.vx * 0.36 + spread,
                      vy: info.vy * 0.16 - 35 - Math.random() * 25,
                      radius: 4.5 + Math.random() * 4.5,
                      growth: 18 + info.energy * 16,
                      alpha: 0.28 + Math.min(0.24, info.energy * 0.18),
                      life: maxLife,
                      maxLife,
                      tint:
                        venueRef.current === 'retro_gym'
                          ? '#fef3c7'
                          : '#f8fafc',
                    });
                  }
                }

                if ((mode === 'both' || mode === 'confetti') && info.energy > 0.44) {
                  const ribbonCount = eco ? 1 : 2;
                  for (let c = 0; c < ribbonCount; c++) {
                    if (sim.confetti.length >= maxConfetti) sim.confetti.shift();
                    const maxLife = 1.1 + Math.random() * 0.6;
                    sim.confetti.push({
                      x: info.x + (Math.random() - 0.5) * 20,
                      y: info.y + (Math.random() - 0.5) * 10,
                      vx: info.vx * 0.55 + (Math.random() - 0.5) * 120,
                      vy: info.vy * 0.25 - 60 - Math.random() * 80,
                      rot: Math.random() * Math.PI * 2,
                      vRot: (Math.random() - 0.5) * 13,
                      flipPhase: Math.random() * Math.PI * 2,
                      flipSpeed: 7 + Math.random() * 6,
                      flutterFreq: 4.5 + Math.random() * 4,
                      w: 5.5 + Math.random() * 4,
                      h: 3.2 + Math.random() * 2.5,
                      color:
                        CONFETTI_COLORS[
                          Math.floor(Math.random() * CONFETTI_COLORS.length)
                        ],
                      life: maxLife,
                      maxLife,
                    });
                  }
                }
              },
              onFloorBounce: (intensity) => {
                if (intensity > 0.14) {
                  bounceCueRef.current(intensity);
                }
                if (sim.tracker.inFlightShot) {
                  if (!sim.tracker.scored) {
                    streakRef.current = 0;
                    setStats((prev) =>
                      prev.streak === 0 ? prev : { ...prev, streak: 0 }
                    );
                    sim.tracker.postMissBounces += 1;
                    if (!autoModeRef.current) {
                      setStatusLabel('Rebound Live — Swipe Anytime');
                    }
                  } else {
                    sim.tracker.postScoreBounces += 1;
                  }

                  sim.tracker.inFlightShot = false;
                  if (autoModeRef.current) {
                    sim.autoCooldown = 0.58;
                    if (
                      shooterModeRef.current === 'player' &&
                      playModeRef.current === 'arcade'
                    ) {
                      sim.shooter.targetX =
                        AUTO_COURT_SPOTS[sim.shotCount % AUTO_COURT_SPOTS.length];
                    }
                  }

                  if (shooterModeRef.current === 'player') {
                    const nextX =
                      playModeRef.current === 'tee'
                        ? DEFAULT_SHOOT_X
                        : sim.shooter.x;
                    attachBallToShooterDribble(sim, nextX);
                  } else if (
                    playModeRef.current === 'tee' ||
                    sim.ball.x > 740
                  ) {
                    dropLiveCourtBall(sim, DEFAULT_SHOOT_X, 24);
                  }
                } else if (
                  shooterModeRef.current === 'free' &&
                  playModeRef.current === 'arcade' &&
                  sim.ball.x > 780 &&
                  Math.abs(sim.ball.vx) < 95
                ) {
                  dropLiveCourtBall(sim, DEFAULT_SHOOT_X, 28);
                }
              },
              onNetSwish: (cleanSwish) => {
                swishCueRef.current();
                swishPulseIdRef.current += 1;
                const rimCx = RIM_CENTER_X + sim.hoopCtrl.offset.x;
                const rimCy = RIM_Y + sim.hoopCtrl.offset.y;

                sim.rings.push({
                  x: rimCx,
                  y: rimCy + 46,
                  radius: 26,
                  alpha: 0.9,
                  color: cleanSwish
                    ? 'rgba(251, 191, 36, ALPHA)'
                    : 'rgba(248, 250, 252, ALPHA)',
                });

                const nextStreak = streakRef.current + 1;
                streakRef.current = nextStreak;
                const bonusMake = released60Ref.current && nextStreak >= 3 ? 2 : 1;
                makesRef.current += bonusMake;

                // Arena excitement wave: jumping crowd, goal lights, flashes, confetti & smoke!
                sim.crowdExcitement = 1.0;
                sim.goalLightFlash = 1.0;
                sim.shotClockSec = 24.0;
                sim.bannerAlert =
                  nextStreak === 3
                    ? '3-STREAK! TRACK ACTIVE!'
                    : bonusMake === 2
                      ? '6.0 2X FIREBALL!'
                      : cleanSwish
                        ? 'CLEAN SWISH!'
                        : 'BUCKET!';

                if (shooterModeRef.current === 'player') {
                  triggerShooterCelebrate(sim.shooter);
                }

                if (venueRef.current === 'arena') {
                  const flashCount = isEcoRef.current ? 3 : 7;
                  for (let f = 0; f < flashCount; f++) {
                    sim.flashes.push({
                      x: 60 + Math.random() * 1160,
                      y: 350 + Math.random() * 245,
                      radius: 26 + Math.random() * 24,
                      life: 0.22 + Math.random() * 0.14,
                      maxLife: 0.36,
                    });
                  }
                }

                const mode = netParticleModeRef.current;
                const eco = isEcoRef.current;

                if (mode === 'both' || mode === 'smoke') {
                  const maxSmoke = eco ? 14 : 64;
                  const smokeCount = eco ? 4 : cleanSwish ? 12 : 7;
                  for (let s = 0; s < smokeCount; s++) {
                    if (sim.smokePuffs.length >= maxSmoke) sim.smokePuffs.shift();
                    const ang = (s / smokeCount) * Math.PI * 2 + Math.random() * 0.4;
                    const maxLife = 0.72 + Math.random() * 0.4;
                    sim.smokePuffs.push({
                      x: rimCx + Math.cos(ang) * 20,
                      y: rimCy + 48 + Math.sin(ang) * 14,
                      vx: Math.cos(ang) * (55 + Math.random() * 55),
                      vy: -25 + Math.sin(ang) * 35,
                      radius: 7 + Math.random() * 6,
                      growth: 24 + Math.random() * 14,
                      alpha: cleanSwish ? 0.38 : 0.26,
                      life: maxLife,
                      maxLife,
                      tint: cleanSwish ? '#fef3c7' : '#f8fafc',
                    });
                  }
                }

                if ((mode === 'both' || mode === 'confetti') && (cleanSwish || nextStreak >= 2)) {
                  const maxConfetti = eco ? 18 : 110;
                  const count = eco ? 12 : nextStreak === 3 ? 32 : cleanSwish ? 24 : 14;
                  for (let c = 0; c < count; c++) {
                    if (sim.confetti.length >= maxConfetti) sim.confetti.shift();
                    const ang = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
                    const spd = 150 + Math.random() * 250;
                    const maxLife = 1.65 + Math.random() * 0.75;
                    sim.confetti.push({
                      x: rimCx + (Math.random() - 0.5) * 44,
                      y: rimCy + 38,
                      vx: Math.cos(ang) * spd,
                      vy: Math.sin(ang) * spd - 65,
                      rot: Math.random() * Math.PI * 2,
                      vRot: (Math.random() - 0.5) * 14,
                      flipPhase: Math.random() * Math.PI * 2,
                      flipSpeed: 7 + Math.random() * 7,
                      flutterFreq: 4 + Math.random() * 4.5,
                      w: 6 + Math.random() * 4.5,
                      h: 3.4 + Math.random() * 2.8,
                      color: CONFETTI_COLORS[c % CONFETTI_COLORS.length],
                      life: maxLife,
                      maxLife,
                    });
                  }
                }

                if (nextStreak === 3) {
                  hornCueRef.current();
                  cheerCueRef.current(1.0);
                  setStatusLabel('3-Streak! Moving Hoop!');
                } else {
                  if (cleanSwish || nextStreak >= 2) {
                    cheerCueRef.current(cleanSwish ? 0.85 : 0.65);
                  }
                  setStatusLabel(cleanSwish ? 'Clean Swish' : 'Bucket');
                }

                setStats((prev) => ({
                  ...prev,
                  makes: prev.makes + 1,
                  swishes: prev.swishes + (cleanSwish ? 1 : 0),
                  streak: nextStreak,
                }));
                bumpRecordsRef.current(
                  {
                    totalBasketballMakes: 1,
                    totalBasketballSwishes: cleanSwish ? 1 : 0,
                  },
                  { bestBasketballStreak: nextStreak }
                );
              },
            },
            sim.hoopCtrl.offset
          );
        }

        for (let i = sim.trail.length - 1; i >= 0; i--) {
          sim.trail[i].alpha -= dt * 1.1;
          if (sim.trail[i].alpha <= 0) sim.trail.splice(i, 1);
        }
        for (let i = sim.rings.length - 1; i >= 0; i--) {
          const r = sim.rings[i];
          r.radius += dt * 115;
          r.alpha -= dt * 1.45;
          if (r.alpha <= 0) sim.rings.splice(i, 1);
        }
        for (let i = sim.smokePuffs.length - 1; i >= 0; i--) {
          const s = sim.smokePuffs[i];
          const drag = Math.exp(-3.1 * dt);
          s.vx *= drag;
          s.vy = s.vy * drag - 26 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.radius += s.growth * dt;
          s.life -= dt;
          if (s.life <= 0) sim.smokePuffs.splice(i, 1);
        }
        for (let i = sim.confetti.length - 1; i >= 0; i--) {
          const c = sim.confetti[i];
          c.life -= dt;
          if (!c.settled) {
            c.vy += 420 * dt;
            // Aerodynamic flutter & quadratic air drag
            const flutter = Math.sin(sim.timeSec * c.flutterFreq + c.flipPhase) * 85;
            c.vx += flutter * dt;
            c.vx *= 1 - Math.min(0.4, 1.55 * dt);
            c.vy = Math.min(230, c.vy * (1 - Math.min(0.25, 0.85 * dt)));
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            c.rot += c.vRot * dt;
            c.flipPhase += c.flipSpeed * dt;
            if (c.y >= FLOOR_Y - 1) {
              c.y = FLOOR_Y - 1;
              if (Math.abs(c.vy) > 55) {
                c.vy = -c.vy * 0.28;
                c.vx *= 0.65;
              } else {
                c.vy = 0;
                c.vx = 0;
                c.vRot = 0;
                c.settled = true;
              }
            }
          }
          if (c.life <= 0) sim.confetti.splice(i, 1);
        }
        for (let i = sim.flashes.length - 1; i >= 0; i--) {
          sim.flashes[i].life -= dt;
          if (sim.flashes[i].life <= 0) sim.flashes.splice(i, 1);
        }
        sim.shake = Math.max(0, sim.shake - dt * 20);

        const previewArc: Array<{ x: number; y: number }> = [];
        if (showAimGuidesRef.current && sim.isDragging && Math.hypot(sim.aimVx, sim.aimVy) > 50) {
          for (let i = 1; i <= 18; i++) {
            const t = i * 0.045;
            previewArc.push({
              x: sim.aimOriginX + sim.aimVx * t,
              y: sim.aimOriginY + sim.aimVy * t + 0.5 * GRAVITY * t * t,
            });
          }
        }

        const movingHoopActive = streakRef.current >= 3;
        if (engine3d) {
          engine3d.update({
            dt,
            ball: sim.ball,
            rimY: RIM_Y + sim.hoopCtrl.offset.y,
            rimCenterX: RIM_CENTER_X + sim.hoopCtrl.offset.x,
            floorY: FLOOR_Y,
            rimSpring: sim.rim,
            hoopCtrl: sim.hoopCtrl,
            shooter: sim.shooter,
            netNodes: sim.nodes,
            trail: showTrailsRef.current ? sim.trail : [],
            previewArc,
            venue: venueRef.current,
            fireballActive: sb.fireball || streakRef.current >= 3,
            cameraMode: cameraModeRef.current,
            freeOrbit: sb.freeOrbit,
            shaderMood: sb.shaderMood,
            weather: sb.weather,
            budget,
            swishPulseId: swishPulseIdRef.current,
            makes: makesRef.current,
            streak: streakRef.current,
            shotClockSec: sim.shotClockSec,
            bannerAlert: sim.bannerAlert,
            movingHoopActive,
            boardFlash: sim.boardFlash,
            goalLightFlash: sim.goalLightFlash,
            crowdExcitement: sim.crowdExcitement,
            confetti: sim.confetti,
            smokePuffs: sim.smokePuffs,
            flashes: sim.flashes,
            shooterMode: shooterModeRef.current,
          });
        } else if (ctx2d && canvas2d) {
          const cssH = mountEl.clientHeight || window.innerHeight;
          ctx2d.save();
          ctx2d.setTransform(budget.dpr, 0, 0, budget.dpr, 0, 0);
          renderBasketballScene(ctx2d, cssW, cssH, {
            venue: venueRef.current,
            shooterMode: shooterModeRef.current,
            shooter: sim.shooter,
            ball: sim.ball,
            rim: sim.rim,
            nodes: sim.nodes,
            trail: showTrailsRef.current ? sim.trail : [],
            rings: sim.rings,
            confetti: sim.confetti,
            smokePuffs: sim.smokePuffs,
            flashes: sim.flashes,
            hoopOffset: sim.hoopCtrl.offset,
            movingHoopActive,
            crowdExcitement: sim.crowdExcitement,
            goalLightFlash: sim.goalLightFlash,
            boardFlash: sim.boardFlash,
            shotClockSec: sim.shotClockSec,
            makes: makesRef.current,
            streak: streakRef.current,
            bannerAlert: sim.bannerAlert,
            isDraggingAim: showAimGuidesRef.current && sim.isDragging,
            aimOriginX: sim.aimOriginX,
            aimOriginY: sim.aimOriginY,
            aimTargetX: sim.aimTargetX,
            aimTargetY: sim.aimTargetY,
            aimVx: sim.aimVx,
            aimVy: sim.aimVy,
            shake: sim.shake,
            timeSec: sim.timeSec,
          });
          ctx2d.restore();
        }
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
    attachBallToShooterDribble,
    dropLiveCourtBall,
    initSim,
    launchConcreteShot,
    renderMode,
  ]);

  const getManualShotOrigin = (sim: NonNullable<typeof simRef.current>) => {
    if (shooterModeRef.current === 'player') {
      const clampedShooterX =
        playModeRef.current === 'tee'
          ? DEFAULT_SHOOT_X
          : Math.max(SHOOTER_MIN_X, Math.min(SHOOTER_MAX_X, sim.shooter.x));
      return {
        x: clampedShooterX + 24,
        y: FLOOR_Y - 134,
      };
    }
    if (playModeRef.current === 'tee' || sim.ball.x > 760 || sim.ball.x < 85) {
      return { x: DEFAULT_SHOOT_X, y: FLOOR_Y - 130 };
    }
    return {
      x: Math.max(95, Math.min(735, sim.ball.x)),
      y: Math.min(FLOOR_Y - BALL_RADIUS, Math.max(240, sim.ball.y)),
    };
  };

  const solveAimedArcVelocity = (
    originX: number,
    originY: number,
    targetX: number,
    targetY: number
  ): { vx: number; vy: number } => {
    const horizDist = Math.abs(targetX - originX);
    const arcLift = Math.min(235, Math.max(82, horizDist * 0.34));
    const yPeak = Math.max(58, Math.min(originY, targetY) - arcLift);
    const tUp = Math.sqrt(Math.max(0.015, (2 * (originY - yPeak)) / GRAVITY));
    const tDown = Math.sqrt(Math.max(0.015, (2 * (targetY - yPeak)) / GRAVITY));
    const tFlight = tUp + tDown;
    let vx = (targetX - originX) / tFlight;
    let vy = -GRAVITY * tUp;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_SHOT_SPEED) {
      const s = MAX_SHOT_SPEED / speed;
      vx *= s;
      vy *= s;
    }
    return { vx, vy };
  };

  const fireManualShot = (
    sim: NonNullable<typeof simRef.current>,
    originX: number,
    originY: number,
    vx: number,
    vy: number
  ) => {
    const speed = Math.hypot(vx, vy);
    if (shooterModeRef.current === 'player') {
      if (playModeRef.current === 'tee') {
        sim.shooter.x = DEFAULT_SHOOT_X;
      }
      sim.shooter.targetX = null;
      sim.ball.x = originX;
      sim.ball.y = originY;
      triggerShooterJumpShot(sim.shooter, vx, vy);
    } else {
      sim.ball.x = originX;
      sim.ball.y = originY;
    }

    sim.ball.vx = vx;
    sim.ball.vy = vy;
    sim.ball.omega = -Math.min(11, speed * 0.0082);
    sim.ball.active = true;
    sim.ball.alpha = 1;
    sim.trail = [];
    sim.trailTimer = 0;
    sim.shotClockSec = 24.0;
    sim.tracker = {
      touchedRim: false,
      touchedBoard: false,
      scored: false,
      inFlightShot: true,
      prevBallY: originY,
      postScoreBounces: 0,
      postMissBounces: 0,
    };
    setStats((prev) => ({ ...prev, shots: prev.shots + 1 }));
    setStatusLabel('Shot Released');
  };

  const updateManualAimState = (
    wx: number,
    wy: number,
    nowMs: number,
    sim: NonNullable<typeof simRef.current>
  ) => {
    sim.ptrHistory.push({ x: wx, y: wy, t: nowMs });
    while (sim.ptrHistory.length > 2 && nowMs - sim.ptrHistory[0].t > 105) {
      sim.ptrHistory.shift();
    }

    const origin = getManualShotOrigin(sim);
    sim.aimOriginX = origin.x;
    sim.aimOriginY = origin.y;

    const dx = wx - sim.dragAnchorX;
    const dy = wy - sim.dragAnchorY;
    const dragDist = Math.hypot(dx, dy);

    if (dragDist <= 14) {
      // Click-to-shoot aim preview when hovering/pressing above floor strip
      if (wy < FLOOR_Y - 90) {
        const tgtX =
          wx >= origin.x + 35
            ? wx
            : RIM_CENTER_X + sim.hoopCtrl.offset.x;
        const tgtY =
          wx >= origin.x + 35
            ? wy
            : Math.min(RIM_Y + 20, Math.max(120, wy));
        const aimed = solveAimedArcVelocity(origin.x, origin.y, tgtX, tgtY);
        sim.aimVx = aimed.vx;
        sim.aimVy = aimed.vy;
        sim.aimTargetX = tgtX;
        sim.aimTargetY = tgtY;
      } else {
        sim.aimVx = 0;
        sim.aimVy = 0;
        sim.aimTargetX = null;
        sim.aimTargetY = null;
      }
      return;
    }

    sim.aimTargetX = null;
    sim.aimTargetY = null;

    // Supports BOTH pull-back slingshot drag (dragging left) AND forward swipe (dragging right)
    const isPullBack = dx < -12;
    const aimDx = isPullBack ? -dx : dx;
    const aimDy = isPullBack ? -dy : dy;

    const newest = sim.ptrHistory[sim.ptrHistory.length - 1];
    const oldest = sim.ptrHistory[0];
    const dtWin = Math.max(0.016, (newest.t - oldest.t) / 1000);
    const velVx = (newest.x - oldest.x) / dtWin;
    const velVy = (newest.y - oldest.y) / dtWin;
    const flickSpeed = Math.hypot(velVx, velVy);

    const sens = aimSensitivityRef.current;
    let rawVx = aimDx * 7.6 * sens;
    let rawVy = aimDy * 7.6 * sens;
    if (!isPullBack && flickSpeed > 320 && velVx > 140 && velVy < -80 && sim.ptrHistory.length >= 2) {
      rawVx = rawVx * 0.45 + velVx * 0.65 * sens;
      rawVy = rawVy * 0.45 + velVy * 0.65 * sens;
    }

    const speed = Math.hypot(rawVx, rawVy);
    const scale = speed > MAX_SHOT_SPEED ? MAX_SHOT_SPEED / speed : 1;
    sim.aimVx = rawVx * scale;
    sim.aimVy = rawVy * scale;
  };

  const getCourtPoint = (clientX: number, clientY: number, mountEl: HTMLDivElement) => {
    if (engine3dRef.current) {
      return engine3dRef.current.clientToCourt(clientX, clientY);
    }
    const rect = mountEl.getBoundingClientRect();
    const { scale, offsetX, offsetY } = computeCourtViewport(
      rect.width || window.innerWidth,
      rect.height || window.innerHeight
    );
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit) return;
    const mountEl = mountRef.current;
    const sim = simRef.current;
    if (!mountEl || !sim) return;

    const pt = getCourtPoint(e.clientX, e.clientY, mountEl);

    if (autoModeRef.current) {
      setAutoMode(false);
      autoModeRef.current = false;
    }

    sim.isDragging = true;
    sim.dragAnchorX = pt.x;
    sim.dragAnchorY = pt.y;
    const nowMs = performance.now();
    sim.ptrHistory = [{ x: pt.x, y: pt.y, t: nowMs }];
    updateManualAimState(pt.x, pt.y, nowMs, sim);
    mountEl.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit) return;
    const mountEl = mountRef.current;
    const sim = simRef.current;
    if (!mountEl || !sim || !sim.isDragging) return;
    const pt = getCourtPoint(e.clientX, e.clientY, mountEl);
    updateManualAimState(pt.x, pt.y, performance.now(), sim);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sandboxRef.current.freeOrbit) return;
    const mountEl = mountRef.current;
    const sim = simRef.current;
    if (!mountEl || !sim || !sim.isDragging) return;
    if (mountEl.hasPointerCapture(e.pointerId)) {
      mountEl.releasePointerCapture(e.pointerId);
    }

    const pt = getCourtPoint(e.clientX, e.clientY, mountEl);
    updateManualAimState(pt.x, pt.y, performance.now(), sim);
    sim.isDragging = false;

    const dragDist = Math.hypot(pt.x - sim.dragAnchorX, pt.y - sim.dragAnchorY);
    const speed = Math.hypot(sim.aimVx, sim.aimVy);
    const origin = getManualShotOrigin(sim);

    if (dragDist > 14 && speed > 90) {
      fireManualShot(sim, origin.x, origin.y, sim.aimVx, sim.aimVy);
    } else if (pt.y < FLOOR_Y - 90) {
      // Direct Click-to-Shoot anywhere above the floor!
      const tgtX =
        pt.x >= origin.x + 35
          ? pt.x
          : RIM_CENTER_X + sim.hoopCtrl.offset.x;
      const tgtY =
        pt.x >= origin.x + 35
          ? pt.y
          : Math.min(RIM_Y + 20, Math.max(120, pt.y));
      const aimed = solveAimedArcVelocity(origin.x, origin.y, tgtX, tgtY);
      fireManualShot(sim, origin.x, origin.y, aimed.vx, aimed.vy);
    } else if (shooterModeRef.current === 'player') {
      // Click on court floor moves the dribbling shooter cleanly (interrupting stale post-shot wait)
      if (playModeRef.current === 'arcade') {
        const destX = Math.max(SHOOTER_MIN_X, Math.min(SHOOTER_MAX_X, pt.x));
        if (sim.tracker.inFlightShot) {
          attachBallToShooterDribble(sim);
        }
        if (Math.abs(destX - sim.shooter.x) > 14) {
          sim.shooter.targetX = destX;
          setStatusLabel('Moving Across Court');
        } else {
          setStatusLabel('Click Hoop or Drag to Shoot');
        }
      }
    } else {
      // Click on court floor in Free Ball mode pops a lively dribble bounce toward cursor
      if (sim.tracker.inFlightShot) {
        sim.tracker.inFlightShot = false;
      }
      sim.ball.active = true;
      sim.ball.vy = -520;
      sim.ball.vx = Math.max(-340, Math.min(340, (pt.x - sim.ball.x) * 1.4));
      sim.ball.omega = sim.ball.vx / BALL_RADIUS;
      bounceCueRef.current(0.55);
      setStatusLabel('Free Ball Live — Click Hoop or Drag to Shoot');
    }

    sim.aimTargetX = null;
    sim.aimTargetY = null;
  };

  const handleQuickShot = () => {
    const sim = simRef.current;
    if (!sim) return;
    const style = shotStyleRef.current;
    const kind: ConcreteShotKind =
      style === 'mixed'
        ? SHOT_SEQUENCE[sim.shotCount % SHOT_SEQUENCE.length]
        : style;
    launchConcreteShot(kind);
  };

  const handleMoveToSpot = (spotX: number) => {
    const sim = simRef.current;
    if (!sim) return;
    setAutoMode(false);
    autoModeRef.current = false;
    setPlayMode('arcade');
    playModeRef.current = 'arcade';
    if (shooterModeRef.current === 'player') {
      sim.shooter.targetX = spotX;
      setStatusLabel('Moving to Court Spot');
    } else {
      dropLiveCourtBall(sim, spotX, 0);
      setStatusLabel('Ball Placed on Spot');
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
      aria-label="Interactive 3D All-Star Hoops basketball arena and Verlet net"
      className="relative h-full w-full overflow-hidden bg-[#070b18] select-none"
    >
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`h-full w-full touch-none ${
          prefs.sandboxFreeOrbit
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-crosshair'
        }`}
      />

      {/* Top-Left All-Star Hoops Scoreboard & Controls */}
      {!zenMode && (
      <section
        aria-label="All-Star Hoops controls and scoreboard"
        style={cardStyle}
        className={`absolute top-14 left-2 z-20 max-h-[calc(100dvh-9.5rem)] w-[308px] max-w-[calc(100%-1rem)] overflow-y-auto border p-3 shadow-xl md:top-14 md:left-3 md:max-h-none md:overflow-visible ${
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
              All-Star Hoops
            </h1>
            <InfoBadge id="hoops-card" />
            {stats.streak >= 3 && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                <Flame className="h-3 w-3" aria-hidden="true" />
                Moving
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold tabular-nums text-amber-300">
              {stats.makes} made
            </span>
            <button
              type="button"
              onClick={() => setControlsOpen((prev) => !prev)}
              aria-expanded={controlsOpen}
              aria-label={controlsOpen ? 'Collapse controls' : 'Expand controls'}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
            >
              {controlsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-300 tabular-nums">
          <span>{statusLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{stats.swishes} swishes</span>
          <span aria-hidden="true">·</span>
          <span>{stats.streak} streak</span>
        </div>

        {controlsOpen && (
          <>
            {/* Venue Switcher */}
            <div data-tour-id="hoops-venue" className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-300">Venue</span>
                <InfoBadge id="hoops-venue" />
              </div>
              <div
                className="grid grid-cols-3 gap-1 rounded-lg bg-white/8 p-1"
                role="group"
                aria-label="Court venue"
              >
                {(
                  [
                    { id: 'arena', label: 'Pro Arena' },
                    { id: 'streetball', label: 'Streetball' },
                    { id: 'retro_gym', label: 'Retro Gym' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVenue(opt.id)}
                    className={`h-7 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                      venue === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div
                className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg bg-white/8 p-1"
                role="group"
                aria-label="3D Camera View"
              >
                {(
                  [
                    { id: 'sideline', label: 'Side 3D' },
                    { id: 'baseline', label: 'Base 3D' },
                    { id: 'shooter', label: 'Shooter' },
                    { id: 'overhead', label: 'Skycam' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraMode(cam.id)}
                    className={`h-6 rounded-md px-1 text-[10px] font-medium whitespace-nowrap transition-colors ${
                      cameraMode === cam.id
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shooter, Court, Shot Style & Spots */}
            <div data-tour-id="hoops-play-options" className="mt-2 flex flex-col gap-2">
            {/* Shooter & Court Play Switches */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
                  Shooter <InfoBadge id="hoops-shooter" />
                </span>
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg bg-white/8 p-1"
                  role="group"
                  aria-label="Shooter presence"
                >
                  {(
                    [
                      { id: 'player', label: 'Player' },
                      { id: 'free', label: 'Free Ball' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setShooterMode(opt.id)}
                      className={`h-7 rounded-md px-1 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                        shooterMode === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
                  Court <InfoBadge id="hoops-court" />
                </span>
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg bg-white/8 p-1"
                  role="group"
                  aria-label="Court movement mode"
                >
                  {(
                    [
                      { id: 'arcade', label: 'Full Court' },
                      { id: 'tee', label: 'Fixed Spot' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPlayMode(opt.id)}
                      className={`h-7 rounded-md px-1 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                        playMode === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Auto Shot Style Selector */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-300">
                  Shot Style
                </span>
                <InfoBadge id="hoops-shot-style" />
              </div>
              <div
                className="grid grid-cols-4 gap-1 rounded-lg bg-white/8 p-1"
                role="group"
                aria-label="Basketball shot style"
              >
                {(
                  [
                    { id: 'mixed', label: 'Mixed' },
                    { id: 'swish', label: 'Swish' },
                    { id: 'rim-bounce', label: 'Rim' },
                    { id: 'bank', label: 'Bank' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setShotStyle(opt.id)}
                    className={`h-7 rounded-md px-1 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
                      shotStyle === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Quick Court Spot Teleports */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-300">
                  Court Spot
                </span>
                <InfoBadge id="hoops-spots" />
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-white/8 p-1">
                {(
                  [
                    { label: 'Deep', x: 150 },
                    { label: 'Wing', x: 295 },
                    { label: 'Top Key', x: 465 },
                    { label: 'Paint', x: 645 },
                  ] as const
                ).map((spot) => (
                  <button
                    key={spot.label}
                    type="button"
                    onClick={() => handleMoveToSpot(spot.x)}
                    className="h-6 rounded-md px-1 text-[10px] font-medium whitespace-nowrap text-slate-200 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none"
                  >
                    {spot.label}
                  </button>
                ))}
              </div>
            </div>
            </div>

            {/* 4.1 Net-Contact Particle FX Mode & Shot Arc / Aim Sensitivity */}
            <div data-tour-id="hoops-fx-controls" className="mt-2 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
                  Net FX <InfoBadge id="hoops-net-fx" />
                </span>
                <button
                  type="button"
                  onClick={() => updatePrefs({ showAimGuides: !prefs.showAimGuides })}
                  className="text-[10px] font-medium text-amber-300 hover:underline"
                >
                  Arc: {prefs.showAimGuides ? 'On' : 'Off'}
                </button>
              </div>
              <div
                className="grid grid-cols-3 gap-1 rounded-lg bg-white/8 p-1"
                role="group"
                aria-label="Net contact particle mode"
              >
                {(
                  [
                    { id: 'both', label: 'Both' },
                    { id: 'confetti', label: 'Confetti' },
                    { id: 'smoke', label: 'Smoke' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePrefs({ netParticleMode: opt.id })}
                    className={`h-6 rounded-md px-1 text-[10px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none ${
                      prefs.netParticleMode === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                Throw Power <InfoBadge id="hoops-throw-power" />
              </span>
              <input
                type="range"
                min={0.7}
                max={1.5}
                step={0.05}
                value={prefs.basketballAimSensitivity}
                onChange={(e) =>
                  updatePrefs({ basketballAimSensitivity: parseFloat(e.target.value) })
                }
                className="studio-range h-1 flex-1 cursor-pointer"
              />
              <span className="font-mono-num w-8 text-right font-semibold text-amber-300">
                {prefs.basketballAimSensitivity.toFixed(1)}x
              </span>
            </label>
            </div>
          </>
        )}

        {/* Auto / Manual Toggle, Shoot, Reset */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setAutoMode((prev) => !prev)}
            aria-pressed={autoMode}
            className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none ${
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
          </button>

          <button
            type="button"
            onClick={handleQuickShot}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/8 px-2 text-[11px] font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
          >
            <Sparkles
              className="h-3.5 w-3.5 shrink-0 text-amber-300"
              aria-hidden="true"
            />
            <span>Shoot</span>
            <InfoBadge id="hoops-actions" />
          </button>

          <button
            type="button"
            onClick={() => {
              setStats({ makes: 0, swishes: 0, streak: 0, shots: 0 });
              initSim(autoModeRef.current);
            }}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/8 px-2 text-[11px] font-medium whitespace-nowrap text-slate-100 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:outline-none"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>

        {controlsOpen && (
          <p className="mt-2 text-[11px] text-slate-400">
            {autoMode
              ? 'Auto moves & shoots across the court. 3 makes trigger the motorized track.'
              : shooterMode === 'player'
                ? 'Click any target to shoot · Drag/pull to aim · Tap floor or A/D to move · R reset.'
                : 'Click any target to shoot · Drag/pull to aim · Tap floor to bounce · R reset.'}
          </p>
        )}
      </section>
      )}
    </main>
  );
}
