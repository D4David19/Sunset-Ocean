import { mixRgb, rgbCss, type SunsetPaletteState } from './palette';

export interface HorizonBirdSlot {
  active: boolean;
  xNorm: number;
  yNorm: number;
  vxNorm: number; // viewport widths per second (slow horizon drift)
  vyNorm: number; // gentle thermal rise/fall
  scale: number; // small distant silhouette size
  wingPhase: number;
  wingFreq: number; // rad/s
  glideBias: number;
  age: number;
  maxLife: number;
  seed: number;
}

export interface HorizonBirdSystem {
  update: (dtSec: number, sunVisible: number) => void;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, state: SunsetPaletteState) => void;
  spawnRandomEvent: (rng?: () => number) => number;
  getActiveCount: () => number;
  reset: () => void;
}

const MAX_HORIZON_BIRDS = 24;
const HORIZON_LINE_RATIO = 0.44;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createHorizonBirdSystem(): HorizonBirdSystem {
  const pool: HorizonBirdSlot[] = Array.from({ length: MAX_HORIZON_BIRDS }, (_, idx) => ({
    active: false,
    xNorm: 0,
    yNorm: 0.41,
    vxNorm: 0.015,
    vyNorm: 0,
    scale: 0.3,
    wingPhase: idx * 0.9,
    wingFreq: 6.5,
    glideBias: 0,
    age: 0,
    maxLife: 24,
    seed: idx * 1.37,
  }));

  let spawnCooldownSec = 1.6;
  let elapsed = 0;

  const allocSlot = (): HorizonBirdSlot | null => {
    for (let i = 0; i < MAX_HORIZON_BIRDS; i++) {
      if (!pool[i].active) return pool[i];
    }
    return null;
  };

  const spawnRandomEvent = (rng: () => number = Math.random): number => {
    // 45% solo silhouette, 55% loose distant flock of 2..5 birds
    const flockSize = rng() < 0.45 ? 1 : 2 + Math.floor(rng() * 4);
    const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
    const baseSpeed = (0.011 + rng() * 0.011) * dir; // slow ~40-85s full-sky horizon crossing
    const baseY = 0.386 + rng() * 0.044; // hugs just above the horizon haze band (0.44)
    const startX = dir === 1 ? -0.04 - rng() * 0.04 : 1.04 + rng() * 0.04;
    const maxLife = 36 + rng() * 24;
    const baseScale = 0.23 + rng() * 0.16;

    let spawned = 0;
    for (let i = 0; i < flockSize; i++) {
      const slot = allocSlot();
      if (!slot) break;
      const rank = i === 0 ? 0 : Math.ceil(i / 2);
      const wingSide = i % 2 === 1 ? -1 : 1;

      slot.active = true;
      slot.xNorm = startX - dir * rank * (0.016 + rng() * 0.012);
      slot.yNorm = Math.max(0.36, Math.min(0.432, baseY + wingSide * rank * (0.004 + rng() * 0.004)));
      slot.vxNorm = baseSpeed * (0.92 + rng() * 0.16);
      slot.vyNorm = (rng() - 0.52) * 0.00055;
      slot.scale = baseScale * (0.85 + rng() * 0.28);
      slot.wingPhase = rng() * Math.PI * 2;
      slot.wingFreq = 5.4 + rng() * 2.8;
      slot.glideBias = rng() * Math.PI * 2;
      slot.age = 0;
      slot.maxLife = maxLife;
      slot.seed = rng() * 100;
      spawned += 1;
    }
    return spawned;
  };

  const update = (dtSec: number, sunVisible: number) => {
    const dt = Math.max(0, Math.min(0.1, dtSec));
    elapsed += dt;

    spawnCooldownSec -= dt;
    if (spawnCooldownSec <= 0) {
      // Slightly more active near golden hour / dusk, quieter deep night
      const activityFactor = 0.35 + 0.65 * Math.max(0.2, sunVisible);
      spawnRandomEvent();
      spawnCooldownSec = (5.2 + Math.random() * 6.8) / activityFactor;
    }

    for (let i = 0; i < MAX_HORIZON_BIRDS; i++) {
      const b = pool[i];
      if (!b.active) continue;

      b.age += dt;
      b.xNorm += b.vxNorm * dt;
      b.yNorm += b.vyNorm * dt;
      b.wingPhase += b.wingFreq * dt;

      const outOfBounds = b.vxNorm > 0 ? b.xNorm > 1.12 : b.xNorm < -0.12;
      if (b.age >= b.maxLife || outOfBounds) {
        b.active = false;
      }
    }
  };

  const render = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: SunsetPaletteState
  ) => {
    const horizonY = h * HORIZON_LINE_RATIO;
    const parallaxX = Math.sin(state.driftTheta) * w * 0.022 * 0.22;
    const parallaxY = Math.cos(state.driftTheta * 2) * h * 0.0045 * 0.22;
    const widthScale = Math.max(0.75, Math.min(1.45, w / 1280));
    const birdBaseCol = mixRgb(state.cloudShadow, state.horizon, 0.42);
    const sunX = w * state.sunXNorm;

    ctx.save();
    for (let i = 0; i < MAX_HORIZON_BIRDS; i++) {
      const b = pool[i];
      if (!b.active) continue;

      const edgeX = smoothstep(-0.04, 0.08, b.xNorm) * smoothstep(1.04, 0.92, b.xNorm);
      const lifeFade =
        smoothstep(0, 1.8, b.age) * smoothstep(b.maxLife, b.maxLife - 2.5, b.age);
      const alpha = 0.62 * edgeX * lifeFade;
      if (alpha <= 0.015) continue;

      const x = b.xNorm * w + parallaxX;
      const thermalWave = Math.sin(elapsed * 0.45 + b.seed) * h * 0.0028;
      const y = Math.min(horizonY - 3, b.yNorm * h + thermalWave + parallaxY);

      // Slow distant wingbeat alternating with calm horizontal glides
      const glideGate = smoothstep(-0.1, 0.65, Math.sin(elapsed * 0.85 + b.glideBias));
      const flap = Math.sin(b.wingPhase) * glideGate + 0.18 * (1 - glideGate);

      const s = b.scale * widthScale;
      const span = 14 * s;
      const tipY = (-0.6 + flap * 4.4) * s;
      const midY = (-1.6 + flap * 1.9) * s;

      // Subtle atmospheric warmth when crossing close to the solar glare column
      const sunDistX = Math.abs(x - sunX) / Math.max(1, w);
      const sunGlareFade = 1 - 0.35 * Math.exp(-sunDistX * 14) * state.sunVisible;
      const finalCol = mixRgb(birdBaseCol, state.sunHalo, Math.exp(-sunDistX * 9) * 0.24 * state.sunVisible);

      ctx.strokeStyle = rgbCss(finalCol, alpha * sunGlareFade);
      ctx.lineWidth = Math.max(0.85, 1.45 * s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x - span, y + tipY);
      ctx.quadraticCurveTo(x - span * 0.46, y + midY, x, y + 0.4 * s);
      ctx.quadraticCurveTo(x + span * 0.46, y + midY, x + span, y + tipY);
      ctx.stroke();
    }
    ctx.restore();
  };

  const getActiveCount = () => {
    let count = 0;
    for (let i = 0; i < MAX_HORIZON_BIRDS; i++) {
      if (pool[i].active) count += 1;
    }
    return count;
  };

  const reset = () => {
    for (let i = 0; i < MAX_HORIZON_BIRDS; i++) {
      pool[i].active = false;
    }
    spawnCooldownSec = 1.6;
  };

  return {
    update,
    render,
    spawnRandomEvent,
    getActiveCount,
    reset,
  };
}
