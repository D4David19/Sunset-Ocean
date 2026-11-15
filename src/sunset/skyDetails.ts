import { mixRgb, rgbCss, type SunsetPaletteState } from './palette';
import type { HorizonBirdSystem } from './horizonBirds';

interface StarSpec {
  xNorm: number;
  yNorm: number;
  size: number;
  brightness: number;
  twinkleCycles: number;
  twinkleOffset: number;
  warmth: number;
}

interface SeagullSpec {
  direction: 1 | -1;
  cycles: number; // integer cycles across screen per 36s loop
  startOffset: number;
  baseYNorm: number;
  bobAmpNorm: number;
  bobCycles: number; // integer
  flapCycles: number; // integer
  glideCycles: number; // integer
  scale: number;
  depth: number; // 0 = distant, 1 = closer
  seed: number;
}

function pseudoRandom(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

const STARS: StarSpec[] = Array.from({ length: 84 }, (_, i) => {
  const yBias = Math.pow(pseudoRandom(i, 2), 1.35);
  return {
    xNorm: 0.02 + pseudoRandom(i, 1) * 0.96,
    yNorm: 0.02 + yBias * 0.36,
    size: 0.65 + Math.pow(pseudoRandom(i, 3), 2.1) * 1.45,
    brightness: 0.45 + pseudoRandom(i, 4) * 0.55,
    twinkleCycles: [3, 4, 5, 7][i % 4],
    twinkleOffset: pseudoRandom(i, 5) * Math.PI * 2,
    warmth: pseudoRandom(i, 6),
  };
});

const SEAGULLS: SeagullSpec[] = [
  {
    // Lead mid-sky gull gliding left-to-right
    direction: 1,
    cycles: 1,
    startOffset: 0.14,
    baseYNorm: 0.22,
    bobAmpNorm: 0.022,
    bobCycles: 3,
    flapCycles: 20,
    glideCycles: 3,
    scale: 1.05,
    depth: 0.9,
    seed: 0.4,
  },
  {
    // Companion gull trailing slightly higher
    direction: 1,
    cycles: 1,
    startOffset: 0.07,
    baseYNorm: 0.185,
    bobAmpNorm: 0.018,
    bobCycles: 3,
    flapCycles: 22,
    glideCycles: 3,
    scale: 0.82,
    depth: 0.68,
    seed: 1.7,
  },
  {
    // Distant gull near horizon glow moving right-to-left
    direction: -1,
    cycles: 1,
    startOffset: 0.52,
    baseYNorm: 0.34,
    bobAmpNorm: 0.011,
    bobCycles: 4,
    flapCycles: 26,
    glideCycles: 4,
    scale: 0.52,
    depth: 0.25,
    seed: 2.9,
  },
  {
    // Second distant gull in loose formation
    direction: -1,
    cycles: 1,
    startOffset: 0.48,
    baseYNorm: 0.358,
    bobAmpNorm: 0.010,
    bobCycles: 4,
    flapCycles: 28,
    glideCycles: 4,
    scale: 0.44,
    depth: 0.18,
    seed: 4.1,
  },
  {
    // Higher brisker gull soaring across upper dusk sky
    direction: 1,
    cycles: 2,
    startOffset: 0.36,
    baseYNorm: 0.145,
    bobAmpNorm: 0.016,
    bobCycles: 4,
    flapCycles: 24,
    glideCycles: 4,
    scale: 0.68,
    depth: 0.45,
    seed: 5.2,
  },
  {
    // Low coastal gull skimming above distant horizon mist
    direction: 1,
    cycles: 1,
    startOffset: 0.78,
    baseYNorm: 0.385,
    bobAmpNorm: 0.009,
    bobCycles: 5,
    flapCycles: 24,
    glideCycles: 5,
    scale: 0.62,
    depth: 0.38,
    seed: 3.3,
  },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

let cachedMoonCanvas: HTMLCanvasElement | null = null;
function getMoonScratchCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!cachedMoonCanvas) {
    cachedMoonCanvas = document.createElement('canvas');
    cachedMoonCanvas.width = 128;
    cachedMoonCanvas.height = 128;
  }
  return cachedMoonCanvas;
}

function getParallaxOffset(w: number, h: number, theta: number, depthFactor: number) {
  return {
    dx: Math.sin(theta) * w * 0.022 * depthFactor,
    dy: Math.cos(theta * 2) * h * 0.0045 * depthFactor,
  };
}

function renderStars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const twilightStrength = state.starStrength;
  if (twilightStrength <= 0.01) return;

  const horizonY = h * 0.44;
  const sunX = w * state.sunXNorm;
  const sunY = horizonY - h * state.sunElevation;
  const aspect = w / Math.max(h, 1);
  const { dx: px, dy: py } = getParallaxOffset(w, h, state.driftTheta, 0.06);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const x = s.xNorm * w + px;
    const y = s.yNorm * h + py;

    // Fade smoothly toward the brighter horizon band and away from solar glow
    const altMask = smoothstep(0.40, 0.12, s.yNorm);
    const dx = ((x - sunX) / w) * aspect;
    const dy = (y - sunY) / h;
    const sunDist = Math.hypot(dx, dy);
    const sunMask = state.sunVisible > 0.05 ? smoothstep(0.11, 0.34, sunDist) : 1;

    const twinkle = 0.58 + 0.42 * Math.sin(s.twinkleCycles * state.driftTheta + s.twinkleOffset);
    const alpha = twilightStrength * altMask * sunMask * s.brightness * twinkle;
    if (alpha <= 0.02) continue;

    // Subtle warm-gold to cool-starlight tint
    const starColor = mixRgb([0.84, 0.91, 1.0], [1.0, 0.93, 0.80], s.warmth);

    // Soft halo for brighter stars
    if (s.size > 1.2) {
      ctx.fillStyle = rgbCss(starColor, alpha * 0.22);
      ctx.beginPath();
      ctx.arc(x, y, s.size * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp star core
    ctx.fillStyle = rgbCss(starColor, alpha * 0.92);
    ctx.beginPath();
    ctx.arc(x, y, s.size * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Delicate 4-point diffraction sparkle on brightest stars
    if (s.size > 1.55 && alpha > 0.35) {
      const ray = s.size * (2.6 + 1.2 * twinkle);
      ctx.strokeStyle = rgbCss(starColor, alpha * 0.35);
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(x - ray, y);
      ctx.lineTo(x + ray, y);
      ctx.moveTo(x, y - ray);
      ctx.lineTo(x, y + ray);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawGullSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  flapPose: number, // -1 (downstroke) to +1 (upstroke), ~0.15 when gliding
  bankAngle: number,
  fillStyle: string,
  rimStyle: string,
  rimAlpha: number
) {
  const span = 18 * scale;
  const bodyLen = 5.5 * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bankAngle);

  // Wingtip vertical displacement & mid-wing arch
  const elbowLift = (-2.6 + flapPose * 3.4) * scale;
  const tipLift = (-1.2 + flapPose * 7.8) * scale;
  const wingThick = 1.65 * scale;

  // Sculpted gull silhouette (curved inner wing -> wrist -> tapered outer pinion)
  ctx.beginPath();
  // Head/beak center top
  ctx.moveTo(0, -0.9 * scale);
  // Right wing top edge
  ctx.quadraticCurveTo(span * 0.26, elbowLift - wingThick, span * 0.48, elbowLift - wingThick * 0.65);
  ctx.quadraticCurveTo(span * 0.76, (elbowLift + tipLift) * 0.52 - wingThick * 0.45, span, tipLift);
  // Right wing bottom trailing edge
  ctx.quadraticCurveTo(span * 0.72, (elbowLift + tipLift) * 0.56 + wingThick * 0.32, span * 0.46, elbowLift + wingThick * 0.65);
  ctx.quadraticCurveTo(span * 0.22, elbowLift + wingThick * 0.95, 1.3 * scale, 1.2 * scale);
  // Subtle tail wedge
  ctx.lineTo(0, bodyLen * 0.42);
  ctx.lineTo(-1.3 * scale, 1.2 * scale);
  // Left wing bottom trailing edge
  ctx.quadraticCurveTo(-span * 0.22, elbowLift + wingThick * 0.95, -span * 0.46, elbowLift + wingThick * 0.65);
  ctx.quadraticCurveTo(-span * 0.72, (elbowLift + tipLift) * 0.56 + wingThick * 0.32, -span, tipLift);
  // Left wing top edge
  ctx.quadraticCurveTo(-span * 0.76, (elbowLift + tipLift) * 0.52 - wingThick * 0.45, -span * 0.48, elbowLift - wingThick * 0.65);
  ctx.quadraticCurveTo(-span * 0.26, elbowLift - wingThick, 0, -0.9 * scale);
  ctx.closePath();

  ctx.fillStyle = fillStyle;
  ctx.fill();

  // Warm sunset rim-light grazing the underside/leading curve near the sun
  if (rimAlpha > 0.03) {
    ctx.strokeStyle = rimStyle;
    ctx.lineWidth = Math.max(0.6, 0.85 * scale);
    ctx.beginPath();
    ctx.moveTo(-span * 0.88, tipLift + 0.3 * scale);
    ctx.quadraticCurveTo(-span * 0.42, elbowLift + wingThick * 0.7, 0, 1.35 * scale);
    ctx.quadraticCurveTo(span * 0.42, elbowLift + wingThick * 0.7, span * 0.88, tipLift + 0.3 * scale);
    ctx.stroke();
  }

  ctx.restore();
}

function renderSeagulls(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const { driftPhase: phase, driftTheta: theta, sunXNorm } = state;
  const sunX = w * sunXNorm;
  const sunY = h * 0.44 - h * state.sunElevation;
  const scaleBase = Math.max(0.75, Math.min(1.35, w / 1280));

  for (let i = 0; i < SEAGULLS.length; i++) {
    const g = SEAGULLS[i];

    // Integer-locked seamless progress across the viewport width [-0.08W .. 1.08W]
    const rawU = (g.startOffset + g.cycles * phase) % 1;
    const u = rawU < 0 ? rawU + 1 : rawU;
    const travel = g.direction === 1 ? u : 1 - u;
    const pShift = getParallaxOffset(w, h, theta, 0.28 + g.depth * 0.55);

    const x = (-0.08 + travel * 1.16) * w + pShift.dx;
    const bobWave = Math.sin(g.bobCycles * theta + g.seed);
    const bobDeriv = Math.cos(g.bobCycles * theta + g.seed);
    const y = (g.baseYNorm + bobWave * g.bobAmpNorm) * h + pShift.dy;

    // Smooth entry/exit margin fade
    const edgeAlpha = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
    if (edgeAlpha <= 0.01) continue;

    // Realistic glide-and-flap cadence (alternates effortless soaring with gentle wingbeats)
    const glideEnvelope = smoothstep(-0.15, 0.65, Math.sin(g.glideCycles * theta + g.seed * 1.7));
    const wingBeat = Math.sin(g.flapCycles * theta + g.seed * 2.3);
    const soarPose = 0.22 + 0.08 * Math.sin(g.bobCycles * theta + g.seed);
    const flapPose = soarPose * (1 - glideEnvelope) + wingBeat * glideEnvelope;

    // Gentle banking angle following vertical climb/descent + thermal curve
    const bankAngle = bobDeriv * 0.075 * g.direction + Math.sin(g.glideCycles * theta + g.seed) * 0.04;

    // Distance-attenuated silhouette color bathed in sunset atmosphere
    const nearColor = mixRgb(state.cloudShadow, state.deepWater, 0.42);
    const farColor = mixRgb(state.midSky, state.cloudShadow, 0.55);
    const birdColor = mixRgb(farColor, nearColor, g.depth);

    const distToSun = Math.hypot((x - sunX) / w, (y - sunY) / h);
    const sunProximity = Math.exp(-distToSun * 3.8);
    const rimAlpha = (0.14 + 0.45 * sunProximity) * g.depth * edgeAlpha;

    drawGullSilhouette(
      ctx,
      x,
      y,
      g.scale * scaleBase,
      flapPose,
      bankAngle,
      rgbCss(birdColor, (0.52 + 0.36 * g.depth) * edgeAlpha),
      rgbCss(state.sunHalo, rimAlpha),
      rimAlpha
    );
  }
}

function renderDistantShips(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const { driftPhase: phase, driftTheta: theta, sunXNorm } = state;
  const sunX = w * sunXNorm;
  const scaleBase = Math.max(0.7, Math.min(1.3, w / 1280));
  const navLightAlpha = state.starStrength;
  const shipParallax = getParallaxOffset(w, h, theta, 0.36);

  // 1. Distant three-masted schooner gliding left-to-right along the far horizon
  {
    const u = (0.20 + phase) % 1;
    const edgeAlpha = smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.93, u);
    if (edgeAlpha > 0.01) {
      const x = (-0.06 + u * 1.12) * w + shipParallax.dx;
      const heave = Math.sin(6 * theta + 0.4) * 1.0;
      const pitch = Math.sin(6 * theta + 1.1) * 0.022;
      const y = h * 0.442 + heave + shipParallax.dy * 0.4;
      const s = 0.85 * scaleBase;

      const shipDark = mixRgb(state.cloudShadow, state.deepWater, 0.45);
      const hazeBlend = mixRgb(shipDark, state.horizon, 0.28);
      const sailTint = mixRgb(shipDark, state.midSky, 0.22);
      const sunProx = Math.exp(-Math.abs(x / w - sunXNorm) * 4.5);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pitch);

      // Subtle hull reflection smudge in distant water
      ctx.fillStyle = rgbCss(state.deepWater, 0.34 * edgeAlpha);
      ctx.beginPath();
      ctx.ellipse(0, 3.2 * s, 18 * s, 1.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hull + bowsprit
      ctx.fillStyle = rgbCss(hazeBlend, 0.85 * edgeAlpha);
      ctx.beginPath();
      ctx.moveTo(-17 * s, 0);
      ctx.lineTo(14 * s, 0);
      ctx.lineTo(19 * s, -3.2 * s);
      ctx.lineTo(24 * s, -4.8 * s); // bowsprit tip
      ctx.lineTo(15 * s, -2.2 * s);
      ctx.lineTo(-15.5 * s, -2.4 * s);
      ctx.lineTo(-18.5 * s, -3.5 * s);
      ctx.closePath();
      ctx.fill();

      // Three masts & billowing sails
      const masts = [-9.5 * s, -1.0 * s, 7.2 * s];
      const heights = [17 * s, 21 * s, 15.5 * s];
      ctx.strokeStyle = rgbCss(hazeBlend, 0.78 * edgeAlpha);
      ctx.lineWidth = Math.max(0.7, 0.9 * s);
      for (let m = 0; m < masts.length; m++) {
        const mx = masts[m];
        const mh = heights[m];
        ctx.beginPath();
        ctx.moveTo(mx, -2 * s);
        ctx.lineTo(mx, -mh);
        ctx.stroke();

        // Main sail curve
        ctx.fillStyle = rgbCss(sailTint, 0.72 * edgeAlpha);
        ctx.beginPath();
        ctx.moveTo(mx, -mh * 0.92);
        ctx.quadraticCurveTo(mx + 6.2 * s, -mh * 0.56, mx + 4.8 * s, -3.2 * s);
        ctx.lineTo(mx, -3.2 * s);
        ctx.closePath();
        ctx.fill();

        // Warm sunset edge highlight on sail facing sun
        if (sunProx > 0.08) {
          ctx.strokeStyle = rgbCss(state.sunHalo, 0.45 * sunProx * edgeAlpha);
          ctx.lineWidth = 0.85 * s;
          ctx.beginPath();
          const rimX = x < sunX ? mx + 4.8 * s : mx;
          ctx.moveTo(rimX, -mh * 0.88);
          ctx.lineTo(rimX, -3.4 * s);
          ctx.stroke();
        }
      }

      // Fore-jib
      ctx.fillStyle = rgbCss(sailTint, 0.65 * edgeAlpha);
      ctx.beginPath();
      ctx.moveTo(7.2 * s, -14.5 * s);
      ctx.quadraticCurveTo(15 * s, -8.5 * s, 21.5 * s, -4.3 * s);
      ctx.lineTo(13.5 * s, -2.5 * s);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // 2. Distant coastal freighter moving right-to-left with faint funnel smoke & dusk lights
  {
    const u = (0.64 + phase) % 1;
    const edgeAlpha = smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.93, u);
    if (edgeAlpha > 0.01) {
      const x = (1.06 - u * 1.12) * w + shipParallax.dx;
      const heave = Math.sin(5 * theta + 2.0) * 0.8;
      const y = h * 0.445 + heave + shipParallax.dy * 0.4;
      const s = 0.78 * scaleBase;

      const hullCol = mixRgb(state.cloudShadow, state.deepWater, 0.55);
      const hazeHull = mixRgb(hullCol, state.horizon, 0.22);

      ctx.save();
      ctx.translate(x, y);

      // Subtle hull shadow on water
      ctx.fillStyle = rgbCss(state.deepWater, 0.32 * edgeAlpha);
      ctx.beginPath();
      ctx.ellipse(0, 2.4 * s, 21 * s, 1.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Freighter hull + bridge + funnel
      ctx.fillStyle = rgbCss(hazeHull, 0.84 * edgeAlpha);
      ctx.beginPath();
      ctx.moveTo(-20 * s, 0);
      ctx.lineTo(20 * s, 0);
      ctx.lineTo(18 * s, -3.5 * s);
      ctx.lineTo(-16 * s, -3.2 * s);
      ctx.lineTo(-22 * s, -4.2 * s); // bow facing left
      ctx.closePath();
      ctx.fill();

      // Aft superstructure & bridge
      ctx.fillRect(4 * s, -7.2 * s, 9.5 * s, 4.0 * s);
      ctx.fillRect(6 * s, -9.6 * s, 5.2 * s, 2.5 * s);
      // Funnel
      ctx.fillRect(9.2 * s, -12.6 * s, 2.4 * s, 3.2 * s);

      // Soft drifting funnel smoke wisps (integer-locked periodic puffs)
      for (let p = 0; p < 3; p++) {
        const puffPhase = ((phase * 8 + p / 3) % 1);
        const px = (11.2 + puffPhase * 18) * s;
        const py = (-13.2 - puffPhase * 4.5 + Math.sin(puffPhase * Math.PI * 2 + theta * 2) * 0.8) * s;
        const pr = (1.4 + puffPhase * 2.8) * s;
        const pAlpha = (1 - puffPhase) * 0.20 * edgeAlpha;
        ctx.fillStyle = rgbCss(state.cloudShadow, pAlpha);
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 1.45, pr * 0.85, -0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tiny warm cabin/mast navigation lights glowing during dusk & twilight
      if (navLightAlpha > 0.04) {
        ctx.fillStyle = rgbCss(state.sunCore, navLightAlpha * 0.88 * edgeAlpha);
        ctx.beginPath();
        ctx.arc(7.5 * s, -8.3 * s, 0.9 * s, 0, Math.PI * 2);
        ctx.arc(10.0 * s, -8.3 * s, 0.9 * s, 0, Math.PI * 2);
        ctx.arc(-14.5 * s, -6.5 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // 3. Small distant sloop sailboat slightly closer to shore, near the golden path
  {
    const u = (0.86 + phase) % 1;
    const edgeAlpha = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
    if (edgeAlpha > 0.01) {
      const sailboatParallax = getParallaxOffset(w, h, theta, 0.44);
      const x = (-0.05 + u * 1.10) * w + sailboatParallax.dx;
      const heave = Math.sin(7 * theta + 1.2) * 1.3;
      const roll = Math.sin(7 * theta + 2.1) * 0.045;
      const y = h * 0.453 + heave + sailboatParallax.dy * 0.5;
      const s = 0.72 * scaleBase;

      const boatCol = mixRgb(state.cloudShadow, state.deepWater, 0.5);
      const sunProx = Math.exp(-Math.abs(x / w - sunXNorm) * 4.0);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(roll);

      // Subtle dark reflection under hull
      ctx.fillStyle = rgbCss(state.deepWater, 0.35 * edgeAlpha);
      ctx.beginPath();
      ctx.ellipse(0, 2.2 * s, 8.5 * s, 1.3 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hull
      ctx.fillStyle = rgbCss(boatCol, 0.88 * edgeAlpha);
      ctx.beginPath();
      ctx.moveTo(-7.5 * s, 0);
      ctx.lineTo(7.5 * s, 0);
      ctx.lineTo(9.5 * s, -2.5 * s);
      ctx.lineTo(-8.2 * s, -2.2 * s);
      ctx.closePath();
      ctx.fill();

      // Mainsail + jib
      ctx.beginPath();
      ctx.moveTo(-0.4 * s, -2.2 * s);
      ctx.lineTo(-0.4 * s, -15.5 * s);
      ctx.quadraticCurveTo(-5.8 * s, -8.8 * s, -6.5 * s, -2.5 * s);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0.4 * s, -13.5 * s);
      ctx.quadraticCurveTo(5.2 * s, -7.2 * s, 8.2 * s, -2.5 * s);
      ctx.lineTo(0.4 * s, -2.5 * s);
      ctx.closePath();
      ctx.fill();

      if (sunProx > 0.08) {
        ctx.strokeStyle = rgbCss(state.sunHalo, 0.55 * sunProx * edgeAlpha);
        ctx.lineWidth = 0.85 * s;
        ctx.beginPath();
        ctx.moveTo(0.4 * s, -13.5 * s);
        ctx.quadraticCurveTo(5.2 * s, -7.2 * s, 8.2 * s, -2.5 * s);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}

interface CloudBankSpec {
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
  startOffset: number;
  cycles: number; // integer cycles per 36s loop
  direction: 1 | -1;
  opacity: number;
  puffs: Array<{ dx: number; dy: number; rx: number; ry: number }>;
}

const CLOUD_BANKS: CloudBankSpec[] = [
  {
    yNorm: 0.14,
    widthNorm: 0.28,
    heightNorm: 0.048,
    startOffset: 0.12,
    cycles: 1,
    direction: 1,
    opacity: 0.44,
    puffs: [
      { dx: -0.36, dy: 0.15, rx: 0.34, ry: 0.55 },
      { dx: -0.12, dy: -0.12, rx: 0.40, ry: 0.78 },
      { dx: 0.16, dy: -0.05, rx: 0.36, ry: 0.68 },
      { dx: 0.38, dy: 0.18, rx: 0.28, ry: 0.48 },
    ],
  },
  {
    yNorm: 0.22,
    widthNorm: 0.34,
    heightNorm: 0.052,
    startOffset: 0.56,
    cycles: 1,
    direction: 1,
    opacity: 0.48,
    puffs: [
      { dx: -0.40, dy: 0.16, rx: 0.30, ry: 0.48 },
      { dx: -0.16, dy: -0.10, rx: 0.42, ry: 0.76 },
      { dx: 0.12, dy: -0.18, rx: 0.38, ry: 0.82 },
      { dx: 0.36, dy: 0.08, rx: 0.34, ry: 0.54 },
    ],
  },
  {
    yNorm: 0.29,
    widthNorm: 0.24,
    heightNorm: 0.034,
    startOffset: 0.82,
    cycles: 1,
    direction: 1,
    opacity: 0.40,
    puffs: [
      { dx: -0.32, dy: 0.10, rx: 0.34, ry: 0.52 },
      { dx: 0.0, dy: -0.12, rx: 0.44, ry: 0.74 },
      { dx: 0.32, dy: 0.12, rx: 0.34, ry: 0.50 },
    ],
  },
  {
    yNorm: 0.175,
    widthNorm: 0.22,
    heightNorm: 0.032,
    startOffset: 0.38,
    cycles: 1,
    direction: -1,
    opacity: 0.34,
    puffs: [
      { dx: -0.34, dy: 0.12, rx: 0.34, ry: 0.52 },
      { dx: 0.02, dy: -0.10, rx: 0.45, ry: 0.72 },
      { dx: 0.34, dy: 0.14, rx: 0.30, ry: 0.46 },
    ],
  },
  {
    yNorm: 0.345,
    widthNorm: 0.30,
    heightNorm: 0.026,
    startOffset: 0.27,
    cycles: 1,
    direction: 1,
    opacity: 0.38,
    puffs: [
      { dx: -0.38, dy: 0.08, rx: 0.36, ry: 0.48 },
      { dx: -0.05, dy: -0.08, rx: 0.44, ry: 0.68 },
      { dx: 0.30, dy: 0.06, rx: 0.38, ry: 0.52 },
    ],
  },
];

function renderClouds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const { driftPhase: phase, driftTheta: theta, sunXNorm } = state;
  const sunX = w * sunXNorm;
  const sunY = h * 0.44 - h * state.sunElevation;

  for (let c = 0; c < CLOUD_BANKS.length; c++) {
    const bank = CLOUD_BANKS[c];
    const rawU = (bank.startOffset + bank.cycles * phase) % 1;
    const u = rawU < 0 ? rawU + 1 : rawU;
    const travel = bank.direction === 1 ? u : 1 - u;

    const cloudParallax = getParallaxOffset(w, h, theta, 0.16 + c * 0.04);
    const cx = (-0.24 + travel * 1.48) * w + cloudParallax.dx;
    const cy = bank.yNorm * h + Math.sin(theta * 2 + c * 1.3) * (h * 0.004) + cloudParallax.dy;
    const bw = bank.widthNorm * w;
    const bh = bank.heightNorm * h;

    const edgeAlpha = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
    if (edgeAlpha <= 0.01) continue;

    const distToSun = Math.hypot((cx - sunX) / w, (cy - sunY) / h);
    const sunProx = Math.exp(-distToSun * 2.8);
    const baseAlpha = bank.opacity * edgeAlpha;

    // 1. Soft upper cloud volume (cooler twilight shadow)
    for (let p = 0; p < bank.puffs.length; p++) {
      const puff = bank.puffs[p];
      const px = cx + puff.dx * bw * 0.5;
      const py = cy + puff.dy * bh * 0.5;
      const rx = puff.rx * bw * 0.55;
      const ry = puff.ry * bh * 0.62;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, ry / Math.max(rx, 1));
      const grad = ctx.createRadialGradient(0, -rx * 0.18, rx * 0.12, 0, 0, rx);
      const topCol = mixRgb(state.cloudShadow, state.midSky, 0.25);
      grad.addColorStop(0, rgbCss(topCol, baseAlpha * 0.72));
      grad.addColorStop(0.65, rgbCss(state.cloudShadow, baseAlpha * 0.42));
      grad.addColorStop(1, rgbCss(state.cloudShadow, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Warm backlit sunset underside glow
    const litColor = mixRgb(state.cloudLit, state.sunHalo, sunProx * 0.55);
    for (let p = 0; p < bank.puffs.length; p++) {
      const puff = bank.puffs[p];
      const px = cx + puff.dx * bw * 0.5;
      const py = cy + puff.dy * bh * 0.5 + bh * 0.24;
      const rx = puff.rx * bw * 0.5;
      const ry = puff.ry * bh * 0.38;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, ry / Math.max(rx, 1));
      const grad = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
      grad.addColorStop(0, rgbCss(litColor, baseAlpha * (0.48 + 0.45 * sunProx)));
      grad.addColorStop(0.6, rgbCss(state.cloudLit, baseAlpha * 0.24));
      grad.addColorStop(1, rgbCss(state.cloudLit, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function renderMoon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const { driftTheta: theta, moonStrength: visibility, moonPhaseFraction } = state;
  if (visibility <= 0.01) return;

  const { dx: px, dy: py } = getParallaxOffset(w, h, theta, 0.05);
  const riseProgress = Math.sin(Math.max(0, Math.min(1, visibility)) * Math.PI * 0.5);
  const moonX = w * 0.78 + px;
  const moonY = h * (0.21 - 0.065 * riseProgress) + py;
  const radius = Math.min(w, h) * 0.030;

  // Astronomical illumination fraction [0..1] from synodic phase [0..1)
  const p = ((moonPhaseFraction % 1) + 1) % 1;
  const litFraction = 0.5 * (1 - Math.cos(p * Math.PI * 2));
  const isWaxing = p < 0.5;
  const glowScale = 0.35 + 0.65 * litFraction;

  // 1. Soft atmospheric silver-blue lunar corona scaled by actual lunar illumination
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const haloR = radius * (3.8 + 2.0 * litFraction);
  const haloGrad = ctx.createRadialGradient(moonX, moonY, radius * 0.4, moonX, moonY, haloR);
  haloGrad.addColorStop(0, `rgba(218, 232, 255, ${(0.30 * visibility * glowScale).toFixed(3)})`);
  haloGrad.addColorStop(0.38, `rgba(162, 194, 248, ${(0.13 * visibility * glowScale).toFixed(3)})`);
  haloGrad.addColorStop(1, 'rgba(130, 170, 240, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, haloR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Subtle earthshine on unlit disc (always faintly visible even at New Moon)
  ctx.save();
  ctx.fillStyle = `rgba(180, 200, 235, ${(0.12 * visibility).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Crisp lit lunar phase terminator using offscreen canvas mask
  const scratch = getMoonScratchCanvas();
  if (scratch && litFraction > 0.015) {
    const sCtx = scratch.getContext('2d');
    if (sCtx) {
      const c = 64;
      const r = 46;
      sCtx.clearRect(0, 0, 128, 128);

      sCtx.save();
      sCtx.translate(c, c);

      // Lit lunar surface + faint maria shading
      sCtx.beginPath();
      sCtx.arc(0, 0, r, 0, Math.PI * 2);
      sCtx.clip();

      const surfGrad = sCtx.createRadialGradient(-r * 0.25, -r * 0.15, r * 0.1, 0, 0, r * 1.15);
      surfGrad.addColorStop(0, '#fcfdff');
      surfGrad.addColorStop(0.7, '#e2ebff');
      surfGrad.addColorStop(1, '#bccbe8');
      sCtx.fillStyle = surfGrad;
      sCtx.fillRect(-r, -r, r * 2, r * 2);

      // Faint lunar maria patches
      sCtx.fillStyle = 'rgba(130, 148, 185, 0.24)';
      sCtx.beginPath();
      sCtx.ellipse(-r * 0.25, -r * 0.18, r * 0.34, r * 0.22, -0.3, 0, Math.PI * 2);
      sCtx.ellipse(r * 0.12, -r * 0.30, r * 0.22, r * 0.18, 0.4, 0, Math.PI * 2);
      sCtx.ellipse(-r * 0.10, r * 0.26, r * 0.28, r * 0.16, 0.2, 0, Math.PI * 2);
      sCtx.ellipse(r * 0.28, r * 0.14, r * 0.20, r * 0.15, -0.4, 0, Math.PI * 2);
      sCtx.fill();

      // Northern hemisphere orientation:
      // Waxing (+X right limb lit), Waning (-X left limb lit), with subtle natural axial tilt
      if (litFraction < 0.985) {
        const celestialTilt = isWaxing ? -0.22 : Math.PI + 0.22;
        sCtx.rotate(celestialTilt);
        sCtx.globalCompositeOperation = 'destination-out';
        sCtx.fillStyle = '#000000';

        const termRx = Math.max(0.5, r * Math.abs(1 - 2 * litFraction));
        sCtx.beginPath();
        if (litFraction <= 0.5) {
          // Crescent: shadow covers -X semicircle plus +X inner terminator bulge
          sCtx.arc(0, 0, r + 2, Math.PI / 2, -Math.PI / 2, false);
          sCtx.ellipse(0, 0, termRx, r + 2, 0, -Math.PI / 2, Math.PI / 2, false);
        } else {
          // Gibbous: shadow covers -X semicircle minus -X terminator bulge
          sCtx.arc(0, 0, r + 2, Math.PI / 2, -Math.PI / 2, false);
          sCtx.ellipse(0, 0, termRx, r + 2, 0, -Math.PI / 2, Math.PI / 2, true);
        }
        sCtx.closePath();
        sCtx.fill();
      }
      sCtx.restore();

      ctx.save();
      ctx.globalAlpha = visibility * 0.95;
      const drawSize = (radius / r) * 128;
      ctx.drawImage(scratch, moonX - drawSize * 0.5, moonY - drawSize * 0.5, drawSize, drawSize);
      ctx.restore();
    }
  }
}

function renderHorizonHeatShimmer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const horizonY = h * 0.44;
  const sunX = w * state.sunXNorm;
  const warmth = 0.35 + 0.65 * state.sunVisible;
  const shimmerAlphaBase = 0.075 * warmth;
  if (shimmerAlphaBase <= 0.005) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const shimmerCol = mixRgb(state.horizon, state.sunHalo, 0.62);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const waveX = Math.sin(state.waveTheta * 3 + i * 1.9) * (w * 0.035);
    const waveY = Math.cos(state.waveTheta * 4 + i * 2.3) * 1.6;
    const bandY = horizonY - 5 + t * 8 + waveY;
    const bandW = w * (0.16 + t * 0.08);
    const alpha = shimmerAlphaBase * (0.6 + 0.4 * Math.sin(state.waveTheta * 5 + i * 1.4));
    ctx.fillStyle = rgbCss(shimmerCol, alpha);
    ctx.beginPath();
    ctx.ellipse(sunX + waveX, bandY, bandW, 2.2 - t * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderSkyDetails(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState,
  horizonBirds?: HorizonBirdSystem
) {
  renderStars(ctx, w, h, state);
  renderMoon(ctx, w, h, state);
  renderHorizonHeatShimmer(ctx, w, h, state);
  if (horizonBirds) {
    horizonBirds.render(ctx, w, h, state);
  }
  renderClouds(ctx, w, h, state);
  renderDistantShips(ctx, w, h, state);
  renderSeagulls(ctx, w, h, state);
}
