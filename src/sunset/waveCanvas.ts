import { mixRgb, rgbCss, type SunsetPaletteState } from './palette';
import type { HorizonBirdSystem } from './horizonBirds';
import { renderSkyDetails } from './skyDetails';

interface WaveBandConfig {
  yStartRatio: number;
  yEndRatio: number;
  slots: number;
  cyclesPerLoop: number; // integer for seamless loop
  amplitudePx: number;
  wavelengthPx: number;
  lateralDriftCycles: number; // integer
  corridorHalfWidthRatio: number;
  bodyAlpha: number;
  rimAlpha: number;
  foamIntensity: number;
  glintIntensity: number;
  phaseOffset: number;
}

const HORIZON_RATIO = 0.44; // matches WebGL HORIZON_Y = 0.56 from bottom

// Seven distinct parallax wave bands accelerating toward the shore at integer-locked speeds
const WAVE_BANDS: WaveBandConfig[] = [
  {
    // Layer 1: Distant horizon swells (slowest: 2 cycles/loop)
    yStartRatio: 0.442,
    yEndRatio: 0.495,
    slots: 3,
    cyclesPerLoop: 2,
    amplitudePx: 2.2,
    wavelengthPx: 140,
    lateralDriftCycles: 1,
    corridorHalfWidthRatio: 0.11,
    bodyAlpha: 0.34,
    rimAlpha: 0.28,
    foamIntensity: 0.0,
    glintIntensity: 0.55,
    phaseOffset: 0.2,
  },
  {
    // Layer 2: Far ocean rollers (3 cycles/loop)
    yStartRatio: 0.475,
    yEndRatio: 0.548,
    slots: 3,
    cyclesPerLoop: 3,
    amplitudePx: 3.4,
    wavelengthPx: 195,
    lateralDriftCycles: -2,
    corridorHalfWidthRatio: 0.14,
    bodyAlpha: 0.40,
    rimAlpha: 0.34,
    foamIntensity: 0.04,
    glintIntensity: 0.68,
    phaseOffset: 1.4,
  },
  {
    // Layer 3: Mid-far swells (5 cycles/loop)
    yStartRatio: 0.522,
    yEndRatio: 0.618,
    slots: 3,
    cyclesPerLoop: 5,
    amplitudePx: 5.0,
    wavelengthPx: 255,
    lateralDriftCycles: 2,
    corridorHalfWidthRatio: 0.18,
    bodyAlpha: 0.46,
    rimAlpha: 0.42,
    foamIntensity: 0.10,
    glintIntensity: 0.80,
    phaseOffset: 2.7,
  },
  {
    // Layer 4: Mid-ocean waves (7 cycles/loop)
    yStartRatio: 0.585,
    yEndRatio: 0.695,
    slots: 3,
    cyclesPerLoop: 7,
    amplitudePx: 7.2,
    wavelengthPx: 320,
    lateralDriftCycles: -3,
    corridorHalfWidthRatio: 0.23,
    bodyAlpha: 0.54,
    rimAlpha: 0.52,
    foamIntensity: 0.20,
    glintIntensity: 0.92,
    phaseOffset: 0.9,
  },
  {
    // Layer 5: Approaching breakers (10 cycles/loop)
    yStartRatio: 0.655,
    yEndRatio: 0.775,
    slots: 3,
    cyclesPerLoop: 10,
    amplitudePx: 9.8,
    wavelengthPx: 390,
    lateralDriftCycles: 3,
    corridorHalfWidthRatio: 0.28,
    bodyAlpha: 0.62,
    rimAlpha: 0.62,
    foamIntensity: 0.38,
    glintIntensity: 1.0,
    phaseOffset: 4.1,
  },
  {
    // Layer 6: Near-shore rollers (13 cycles/loop)
    yStartRatio: 0.735,
    yEndRatio: 0.855,
    slots: 3,
    cyclesPerLoop: 13,
    amplitudePx: 12.2,
    wavelengthPx: 460,
    lateralDriftCycles: -4,
    corridorHalfWidthRatio: 0.34,
    bodyAlpha: 0.68,
    rimAlpha: 0.70,
    foamIntensity: 0.62,
    glintIntensity: 0.95,
    phaseOffset: 5.3,
  },
  {
    // Layer 7: Foreground shorebreak crests (fastest: 17 cycles/loop)
    yStartRatio: 0.815,
    yEndRatio: 0.915,
    slots: 2,
    cyclesPerLoop: 17,
    amplitudePx: 10.5,
    wavelengthPx: 540,
    lateralDriftCycles: 4,
    corridorHalfWidthRatio: 0.38,
    bodyAlpha: 0.60,
    rimAlpha: 0.76,
    foamIntensity: 0.85,
    glintIntensity: 0.82,
    phaseOffset: 3.1,
  },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

let cachedMistSprite: HTMLCanvasElement | null = null;
let cachedHeadlandSprite: HTMLCanvasElement | null = null;

function getMistSprite(): HTMLCanvasElement {
  if (cachedMistSprite) return cachedMistSprite;
  const size = 128;
  const r = size * 0.5;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(r, r, r * 0.08, r, r, r);
    grad.addColorStop(0, 'rgba(255, 232, 206, 0.2)');
    grad.addColorStop(0.55, 'rgba(255, 212, 178, 0.08)');
    grad.addColorStop(1, 'rgba(255, 212, 178, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
  }
  cachedMistSprite = c;
  return c;
}

function getHeadlandSprite(): HTMLCanvasElement {
  if (cachedHeadlandSprite) return cachedHeadlandSprite;
  const w = 320;
  const h = 110;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    // Sculpted distant coastal headland cape & sea stacks silhouetted along horizon
    g.fillStyle = 'rgba(18, 20, 38, 0.88)';
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, 42);
    g.lineTo(54, 48);
    g.lineTo(106, 60);
    g.lineTo(154, 68);
    g.lineTo(192, 82);
    g.lineTo(222, 92);
    g.lineTo(246, h);
    g.closePath();
    g.fill();

    // Sea stack off the point
    g.beginPath();
    g.moveTo(262, h);
    g.lineTo(270, 88);
    g.lineTo(282, 86);
    g.lineTo(292, h);
    g.closePath();
    g.fill();

    // Classic whitewashed headland lighthouse tower at ridge (x = 92, top = 32)
    g.fillStyle = '#1f293b';
    g.beginPath();
    g.moveTo(86, 60);
    g.lineTo(89, 32);
    g.lineTo(96, 32);
    g.lineTo(99, 60);
    g.closePath();
    g.fill();

    // Lantern cupola & warm amber lantern pane
    g.fillStyle = '#0f172a';
    g.fillRect(88, 26, 9, 6);
    g.fillStyle = '#fef08a';
    g.fillRect(90, 27, 5, 4);
  }
  cachedHeadlandSprite = c;
  return c;
}

function drawHeadlandAndLighthouse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const horizonY = h * HORIZON_RATIO;
  const scale = Math.max(0.7, Math.min(1.35, w / 1280));
  const capeW = 320 * scale;
  const capeH = 110 * scale;
  const capeX = 0;
  const capeY = horizonY - capeH + 8 * scale;

  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.drawImage(getHeadlandSprite(), capeX, capeY, capeW, capeH);

  // Rotating warm amber lighthouse beam sweep
  const lanternX = capeX + 92.5 * scale;
  const lanternY = capeY + 29 * scale;
  const sweepAngle = Math.sin(state.driftTheta * 2) * 0.42;
  const beamAlpha = 0.14 + 0.18 * (1 - state.sunVisible);

  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(lanternX, lanternY);
  ctx.rotate(sweepAngle);
  ctx.fillStyle = `rgba(254, 240, 138, ${beamAlpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(0, -1.5 * scale);
  ctx.lineTo(145 * scale, -14 * scale);
  ctx.lineTo(145 * scale, 14 * scale);
  ctx.lineTo(0, 1.5 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFallbackSkyAndOcean(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState
) {
  const horizonY = h * HORIZON_RATIO;
  const sunX = w * state.sunXNorm;
  const sunY = horizonY - h * state.sunElevation;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbCss(state.zenith));
  skyGrad.addColorStop(0.56, rgbCss(state.midSky));
  skyGrad.addColorStop(1, rgbCss(state.horizon));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY + 2);

  // Broad solar bloom & disc (when above horizon)
  if (state.sunVisible > 0.02) {
    const haloR = Math.max(w, h) * 0.45;
    const haloGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, haloR);
    haloGrad.addColorStop(0, rgbCss(state.sunCore, 0.92 * state.sunVisible));
    haloGrad.addColorStop(0.14, rgbCss(state.sunHalo, 0.56 * state.sunVisible));
    haloGrad.addColorStop(0.45, rgbCss(state.sunHalo, 0.16 * state.sunVisible));
    haloGrad.addColorStop(1, rgbCss(state.sunHalo, 0));
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, w, horizonY + 2);

    const discR = Math.min(w, h) * 0.044;
    ctx.beginPath();
    ctx.arc(sunX, sunY, discR, 0, Math.PI * 2);
    ctx.fillStyle = rgbCss(state.sunCore, 0.98 * state.sunVisible);
    ctx.fill();
  }

  // Base ocean fill
  const seaGrad = ctx.createLinearGradient(0, horizonY, 0, h * 0.9);
  seaGrad.addColorStop(0, rgbCss(mixRgb(state.horizon, state.midWater, 0.45)));
  seaGrad.addColorStop(0.32, rgbCss(state.deepWater));
  seaGrad.addColorStop(0.76, rgbCss(state.midWater));
  seaGrad.addColorStop(1, rgbCss(state.shallowWater));
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Wet sand base
  const sandGrad = ctx.createLinearGradient(0, h * 0.86, 0, h);
  sandGrad.addColorStop(0, rgbCss(state.shallowWater, 0));
  sandGrad.addColorStop(0.35, rgbCss(state.wetSand, 0.85));
  sandGrad.addColorStop(1, rgbCss(state.wetSand, 1));
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

let scratchCapacity = 0;
let scratchYs = new Float32Array(0);
let scratchSlopes = new Float32Array(0);

function ensureWaveScratch(needed: number) {
  if (needed <= scratchCapacity) return;
  scratchCapacity = Math.max(needed, 128);
  scratchYs = new Float32Array(scratchCapacity);
  scratchSlopes = new Float32Array(scratchCapacity);
}

function drawShoreWash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState,
  fastMode: boolean
) {
  const { waveTheta: theta, sunXNorm } = state;
  const sunX = w * sunXNorm;
  const shoreBaseY = h * 0.905;

  // Three overlapping periodic swash sheets advancing and receding up the wet sand
  const swashConfigs = [
    { cycles: 4, ampY: h * 0.036, phase: 0.0, alpha: 0.42 },
    { cycles: 6, ampY: h * 0.028, phase: 2.1, alpha: 0.50 },
    { cycles: 9, ampY: h * 0.020, phase: 4.3, alpha: 0.58 },
  ];

  const steps = fastMode ? Math.max(28, Math.round(w / 32)) : Math.max(48, Math.round(w / 18));

  for (let s = 0; s < swashConfigs.length; s++) {
    const cfg = swashConfigs[s];
    const surge = Math.sin(cfg.cycles * theta + cfg.phase);
    const frontYBase = shoreBaseY + surge * cfg.ampY;
    const isAdvancing = Math.cos(cfg.cycles * theta + cfg.phase) > 0;

    ctx.beginPath();
    ctx.moveTo(0, shoreBaseY - h * 0.08);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = u * w;
      const lobe =
        Math.sin(u * Math.PI * 5 + s * 1.7 + Math.sin(theta * 2) * 0.8) * (h * 0.011) +
        Math.sin(u * Math.PI * 13 - cfg.cycles * theta * 0.5) * (h * 0.0045);
      const y = frontYBase + lobe;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, shoreBaseY - h * 0.08);
    ctx.closePath();

    const washGrad = ctx.createLinearGradient(0, shoreBaseY - h * 0.07, 0, frontYBase + h * 0.02);
    washGrad.addColorStop(0, rgbCss(state.shallowWater, 0));
    washGrad.addColorStop(0.55, rgbCss(mixRgb(state.shallowWater, state.sunHalo, 0.22), cfg.alpha * 0.65));
    washGrad.addColorStop(1, rgbCss(state.foamTint, isAdvancing ? cfg.alpha * 0.88 : cfg.alpha * 0.55));
    ctx.fillStyle = washGrad;
    ctx.fill();

    // Crisp lacy foam edge along the swash front
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = u * w;
      const lobe =
        Math.sin(u * Math.PI * 5 + s * 1.7 + Math.sin(theta * 2) * 0.8) * (h * 0.011) +
        Math.sin(u * Math.PI * 13 - cfg.cycles * theta * 0.5) * (h * 0.0045);
      const y = frontYBase + lobe;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgbCss(state.foamTint, isAdvancing ? 0.72 : 0.42);
    ctx.lineWidth = isAdvancing ? 2.1 : 1.3;
    ctx.stroke();

    // Subtle mirror-sand sun glints near the wet swash boundary
    const glintCount = 16;
    const bandWidth = w * 0.34;
    for (let g = 0; g < glintCount; g++) {
      const gu = (g + 0.5) / glintCount - 0.5;
      const gx = sunX + gu * bandWidth + Math.sin(cfg.cycles * theta + g * 1.9) * 18;
      const u = gx / w;
      const lobe =
        Math.sin(u * Math.PI * 5 + s * 1.7 + Math.sin(theta * 2) * 0.8) * (h * 0.011) +
        Math.sin(u * Math.PI * 13 - cfg.cycles * theta * 0.5) * (h * 0.0045);
      const gy = frontYBase + lobe - 3;

      const shimmerGate = Math.sin(cfg.cycles * theta * 2 + g * 2.7 + s * 1.1);
      if (shimmerGate > 0.15) {
        const proximity = Math.exp(-gu * gu * 14);
        const len = (10 + 22 * shimmerGate) * proximity;
        ctx.fillStyle = rgbCss(state.sunCore, 0.38 * proximity * shimmerGate);
        ctx.fillRect(gx - len * 0.5, gy, len, 1.4);
      }
    }

    // Twilight bioluminescent dinoflagellate glow along agitated swash foam & wet sand
    const bioStrength = state.bioStrength;

    if (bioStrength > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Soft outer cyan halo along the curling foam edge
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = u * w;
        const lobe =
          Math.sin(u * Math.PI * 5 + s * 1.7 + Math.sin(theta * 2) * 0.8) * (h * 0.011) +
          Math.sin(u * Math.PI * 13 - cfg.cycles * theta * 0.5) * (h * 0.0045);
        const y = frontYBase + lobe;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const edgePulse = isAdvancing ? 0.42 : 0.24;
      ctx.strokeStyle = `rgba(34, 211, 238, ${(bioStrength * edgePulse).toFixed(3)})`;
      ctx.lineWidth = isAdvancing ? 6.5 : 4.2;
      ctx.stroke();

      ctx.strokeStyle = `rgba(125, 249, 255, ${(bioStrength * (isAdvancing ? 0.62 : 0.34)).toFixed(3)})`;
      ctx.lineWidth = isAdvancing ? 1.8 : 1.1;
      ctx.stroke();

      // Sparkling bioluminescent plankton motes lingering in the damp sand behind the wave
      const moteCount = 26;
      for (let m = 0; m < moteCount; m++) {
        const mu = ((m * 0.6180339 + s * 0.23) % 1);
        const mx = mu * w;
        const lobe =
          Math.sin(mu * Math.PI * 5 + s * 1.7 + Math.sin(theta * 2) * 0.8) * (h * 0.011) +
          Math.sin(mu * Math.PI * 13 - cfg.cycles * theta * 0.5) * (h * 0.0045);
        const my = frontYBase + lobe + 4 + ((m * 17) % 24);
        const twinkle = 0.5 + 0.5 * Math.sin(cfg.cycles * theta * 2 + m * 2.4 + s);
        if (twinkle > 0.35 && my < h - 2) {
          const r = 1.1 + twinkle * 1.3;
          ctx.fillStyle = `rgba(94, 242, 255, ${(bioStrength * twinkle * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(mx, my, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }
}

export function renderPainterlyWaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SunsetPaletteState,
  hasWebGL: boolean,
  fastMode = false,
  horizonBirds?: HorizonBirdSystem
) {
  ctx.clearRect(0, 0, w, h);

  if (!hasWebGL) {
    drawFallbackSkyAndOcean(ctx, w, h, state);
  }

  renderSkyDetails(ctx, w, h, state, horizonBirds);
  drawHeadlandAndLighthouse(ctx, w, h, state);

  const { wavePhase, waveTheta: theta, sunXNorm } = state;
  const sunX = w * sunXNorm;
  const scaleFactor = Math.max(0.7, Math.min(1.4, w / 1280));
  const pointsCount = fastMode ? Math.max(36, Math.round(w / 28)) : Math.max(58, Math.round(w / 16));
  ensureWaveScratch(pointsCount + 1);
  const ys = scratchYs;
  const slopes = scratchSlopes;

  // Render the 7 depth-sorted parallax wave bands
  for (let b = 0; b < WAVE_BANDS.length; b++) {
    const band = WAVE_BANDS[b];
    const yStart = h * band.yStartRatio;
    const yEnd = h * band.yEndRatio;
    const bandDepth = b / (WAVE_BANDS.length - 1);

    for (let slot = 0; slot < band.slots; slot++) {
      // Integer-locked conveyor travel in [0, 1)
      const rawProgress = (slot / band.slots + (band.cyclesPerLoop * wavePhase) / band.slots) % 1;
      const u = rawProgress < 0 ? rawProgress + 1 : rawProgress;

      // Perspective acceleration as waves roll toward shore
      const perspU = u * u * 0.55 + u * 0.45;
      const baseY = yStart + (yEnd - yStart) * perspU;

      // Smooth fade in at top of band, fade out at bottom
      const lifeAlpha = smoothstep(0.0, 0.24, u) * smoothstep(1.0, 0.72, u);
      if (lifeAlpha <= 0.01) continue;

      const amp = band.amplitudePx * scaleFactor * (0.65 + 0.55 * perspU);
      const waveLen = band.wavelengthPx * scaleFactor * (0.85 + 0.3 * perspU);
      const k = (Math.PI * 2) / waveLen;

      // Multi-plane parallax depth: distant swells shift subtly (0.42x), foreground breakers shift more (1.05x)
      const depthParallax = 0.42 + bandDepth * 0.63;
      const parallaxShiftX = Math.sin(theta) * w * 0.022 * depthParallax;
      const parallaxShiftY = Math.cos(theta * 2) * h * 0.0045 * depthParallax;

      // Lateral phase uses integer harmonic cycles so loop wraps cleanly
      const lateralPhase = band.lateralDriftCycles * theta + band.phaseOffset + slot * 2.094;
      const crestLift = Math.sin(u * Math.PI) * 0.45 + 0.55;

      for (let i = 0; i <= pointsCount; i++) {
        const x = (i / pointsCount) * w;
        const px = x - parallaxShiftX;
        const p1 = px * k + lateralPhase;
        const p2 = px * (k * 2.15) - lateralPhase * 1.0 + band.phaseOffset;
        const p3 = px * (k * 3.7) + band.lateralDriftCycles * theta * 2;

        // Asymmetric trochoidal ridge profile (sharper crests, broader troughs)
        const h1 = Math.sin(p1) + 0.28 * Math.sin(2 * p1 - 0.5);
        const h2 = 0.38 * Math.sin(p2);
        const h3 = 0.16 * Math.cos(p3);

        const y = baseY + parallaxShiftY - amp * (h1 * 0.65 + h2 + h3) * crestLift;
        ys[i] = y;

        // Analytical horizontal slope sign & ripple curvature for breaking specular light
        const dh =
          Math.cos(p1) +
          0.56 * Math.cos(2 * p1 - 0.5) +
          0.82 * Math.cos(p2) -
          0.59 * Math.sin(p3);
        slopes[i] = dh;
      }

      // 1. Sculpted wave face + shadowed trough body
      const troughHeight = Math.max(12, amp * 3.1 + 14 * bandDepth);
      ctx.beginPath();
      ctx.moveTo(0, ys[0]);
      for (let i = 1; i <= pointsCount; i++) {
        const x = (i / pointsCount) * w;
        ctx.lineTo(x, ys[i]);
      }
      ctx.lineTo(w, baseY + troughHeight);
      ctx.lineTo(0, baseY + troughHeight);
      ctx.closePath();

      const waveBodyGrad = ctx.createLinearGradient(0, baseY - amp, 0, baseY + troughHeight);
      const crestTint = mixRgb(state.midWater, state.shallowWater, bandDepth * 0.72);
      const troughTint = mixRgb(state.deepWater, state.midWater, bandDepth * 0.35);
      waveBodyGrad.addColorStop(0, rgbCss(crestTint, band.bodyAlpha * lifeAlpha * 0.85));
      waveBodyGrad.addColorStop(0.32, rgbCss(troughTint, band.bodyAlpha * lifeAlpha));
      waveBodyGrad.addColorStop(1, rgbCss(troughTint, 0));
      ctx.fillStyle = waveBodyGrad;
      ctx.fill();

      // 2. Broken Sun Reflection Fragments along this wave ridge:
      // Each wave facet tilts independently — sunlit facets ignite into molten gold shards
      // while shadowed troughs remain dark, preventing any static reflection bar.
      const corridorHalfW = w * band.corridorHalfWidthRatio * (0.85 + 0.35 * perspU);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < pointsCount; i++) {
        const x0 = (i / pointsCount) * w;
        const x1 = ((i + 1) / pointsCount) * w;
        const xm = (x0 + x1) * 0.5;
        const dx = xm - sunX;
        const normDx = dx / corridorHalfW;

        if (Math.abs(normDx) > 1.35) continue;

        const corridorFalloff = Math.exp(-normDx * normDx * 2.2);

        // Local wave tilt toward sun azimuth + secondary capillary flicker (integer-locked!)
        const localSlope = slopes[i];
        const flickerWave =
          Math.sin(xm * 0.045 - band.cyclesPerLoop * theta + b * 1.3) * 0.5 +
          Math.cos(xm * 0.095 + band.lateralDriftCycles * theta * 2 + slot * 2.1) * 0.5;

        // Tilt alignment: light only catches facets facing the sun/viewer angle
        const tiltScore = localSlope * 0.55 + flickerWave * 0.52 - normDx * 0.18;

        if (tiltScore > 0.14) {
          const strength = Math.min(1, (tiltScore - 0.14) * 1.45) * corridorFalloff * lifeAlpha * band.glintIntensity;
          const ym = (ys[i] + ys[i + 1]) * 0.5 + 1.5;
          const segW = (x1 - x0) * (0.75 + 0.55 * strength);
          const segH = (1.6 + 2.6 * bandDepth) * (0.7 + 0.5 * strength);

          // Warm outer halo fragment
          ctx.fillStyle = rgbCss(state.sunHalo, strength * 0.52);
          ctx.beginPath();
          ctx.ellipse(xm, ym + 1.0, segW * 0.72, segH * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();

          // Bright molten-gold core shard on sharpest wave tilts
          if (tiltScore > 0.38) {
            const coreStrength = Math.min(1, (tiltScore - 0.38) * 1.9) * corridorFalloff * lifeAlpha;
            ctx.fillStyle = rgbCss(state.sunCore, coreStrength * 0.78);
            ctx.beginPath();
            ctx.ellipse(xm, ym, segW * 0.45, segH * 0.36, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Subtle broken silver-blue lunar shimmer under the rising moon during twilight
      const moonVis = state.moonStrength;
      if (moonVis > 0.04) {
        const moonX = w * 0.78 + Math.sin(state.driftTheta) * w * 0.022 * 0.05;
        const moonCorridor = w * (0.06 + bandDepth * 0.08);
        for (let i = 0; i < pointsCount; i++) {
          const x0 = (i / pointsCount) * w;
          const x1 = ((i + 1) / pointsCount) * w;
          const xm = (x0 + x1) * 0.5;
          const normMx = (xm - moonX) / moonCorridor;
          if (Math.abs(normMx) > 1.25) continue;

          const falloff = Math.exp(-normMx * normMx * 2.6);
          const tilt =
            slopes[i] * 0.52 +
            Math.cos(xm * 0.065 + band.lateralDriftCycles * theta * 2 + b) * 0.48;
          if (tilt > 0.24) {
            const mStrength =
              Math.min(1, (tilt - 0.24) * 1.6) * falloff * lifeAlpha * moonVis * (0.38 - bandDepth * 0.14);
            if (mStrength > 0.01) {
              const ym = (ys[i] + ys[i + 1]) * 0.5 + 1.4;
              ctx.fillStyle = `rgba(205, 225, 255, ${mStrength.toFixed(3)})`;
              ctx.beginPath();
              ctx.ellipse(xm, ym, (x1 - x0) * 0.48, 1.35 + bandDepth * 1.1, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();

      // 3. Rim-lit crest edge & shoreward foam lace
      ctx.beginPath();
      ctx.moveTo(0, ys[0]);
      for (let i = 1; i <= pointsCount; i++) {
        const x = (i / pointsCount) * w;
        ctx.lineTo(x, ys[i]);
      }

      const rimGrad = ctx.createLinearGradient(sunX - corridorHalfW * 1.5, 0, sunX + corridorHalfW * 1.5, 0);
      const edgeRim = mixRgb(state.shallowWater, state.crestRim, 0.38);
      rimGrad.addColorStop(0, rgbCss(edgeRim, band.rimAlpha * lifeAlpha * 0.45));
      rimGrad.addColorStop(0.5, rgbCss(state.crestRim, band.rimAlpha * lifeAlpha * 0.95));
      rimGrad.addColorStop(1, rgbCss(edgeRim, band.rimAlpha * lifeAlpha * 0.45));

      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = (1.0 + 1.4 * bandDepth) * scaleFactor;
      ctx.stroke();

      // Soft lacy foam flecks + twilight bioluminescence on breaking near-shore crests (layers 4-7)
      if (band.foamIntensity > 0.05) {
        const bioStrength = state.bioStrength;
        const stride = fastMode ? 3 : 2;

        for (let i = 0; i < pointsCount; i += stride) {
          const foamGate = Math.sin(i * 0.85 + band.cyclesPerLoop * theta * 0.5 + slot * 1.9);
          if (foamGate > 0.25) {
            const x = (i / pointsCount) * w;
            const y = ys[i];
            const fAlpha = (foamGate - 0.25) * 0.65 * band.foamIntensity * lifeAlpha;
            const rx = (3.5 + 6.5 * bandDepth) * scaleFactor;
            const ry = (1.1 + 1.2 * bandDepth) * scaleFactor;
            ctx.fillStyle = rgbCss(state.foamTint, fAlpha);
            ctx.beginPath();
            ctx.ellipse(x, y + 1.2, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Batched electric cyan-aqua bioluminescent glow (zero inner-loop save/restore!)
        if (bioStrength > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < pointsCount; i += stride) {
            const foamGate = Math.sin(i * 0.85 + band.cyclesPerLoop * theta * 0.5 + slot * 1.9);
            if (foamGate > 0.25) {
              const x = (i / pointsCount) * w;
              const y = ys[i];
              const rx = (3.5 + 6.5 * bandDepth) * scaleFactor;
              const ry = (1.1 + 1.2 * bandDepth) * scaleFactor;
              const normSunDist = Math.abs(x - sunX) / (w * 0.22);
              const awayFromCoreSun = Math.min(1, 0.32 + normSunDist * 0.68);
              const bioAlpha =
                (foamGate - 0.25) * 0.58 * band.foamIntensity * lifeAlpha * bioStrength * awayFromCoreSun;

              ctx.fillStyle = `rgba(34, 211, 238, ${(bioAlpha * 0.62).toFixed(3)})`;
              ctx.beginPath();
              ctx.ellipse(x, y + 2.2, rx * 1.65, ry * 2.1, 0, 0, Math.PI * 2);
              ctx.fill();

              if (foamGate > 0.55) {
                ctx.fillStyle = `rgba(165, 243, 252, ${(bioAlpha * 0.75).toFixed(3)})`;
                ctx.beginPath();
                ctx.ellipse(x, y + 1.6, rx * 0.65, ry * 0.75, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          ctx.restore();
        }
      }
    }
  }

  // Wet-sand receding shoreline foam wash
  drawShoreWash(ctx, w, h, state, fastMode);

  // Foreground coastal sea-mist wisps using cached radial sprite (zero per-frame gradients)
  const mistParallaxX = Math.sin(theta) * w * 0.022 * 1.32;
  const mistSprite = getMistSprite();
  for (let m = 0; m < 4; m++) {
    const rawU = (m * 0.27 + wavePhase) % 1;
    const u = rawU < 0 ? rawU + 1 : rawU;
    const edgeFade = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
    const mx = (-0.2 + u * 1.4) * w + mistParallaxX;
    const my = h * (0.79 + m * 0.045) + Math.sin(theta * 2 + m * 1.6) * 5;
    const rx = w * (0.16 + (m % 2) * 0.06);
    const ry = h * 0.032;

    ctx.save();
    ctx.globalAlpha = 0.42 * edgeFade;
    ctx.drawImage(mistSprite, mx - rx, my - ry, rx * 2, ry * 2);
    ctx.restore();
  }
}
