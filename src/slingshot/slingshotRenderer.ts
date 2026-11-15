import {
  GRAVITY,
  GROUND_Y,
  SLING_ANCHOR_X,
  SLING_ANCHOR_Y,
  WORLD_H,
  WORLD_W,
  type BirdType,
  type RigidBody,
} from './physics2d';

export interface TrailDot {
  x: number;
  y: number;
  r: number;
  alpha: number;
  color?: string;
}

export interface DebrisParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'rect' | 'circle' | 'feather';
}

export interface GroundDivot {
  x: number;
  halfWidth: number;
  depth: number;
  targetDepth: number;
  wobble: number;
  age: number;
  maxAge: number;
}

export interface GroundShockwave {
  x: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  thickness: number;
  tint: string;
}

export interface DustCloudPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  growth: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ExplosionFlash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  tint: string;
  isSonic?: boolean;
}

export interface ScorchDecal {
  x: number;
  radius: number;
  alpha: number;
}

export interface FloatingPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface CameraTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface SlingshotVisualState {
  bird: RigidBody;
  activeBirdType: BirdType;
  quiverTypes: BirdType[];
  bodies: RigidBody[];
  isAiming: boolean;
  birdInSling: boolean;
  pouchX: number;
  pouchY: number;
  launchVx: number;
  launchVy: number;
  trailDots: TrailDot[];
  particles: DebrisParticle[];
  groundDivots: GroundDivot[];
  shockwaves: GroundShockwave[];
  dustClouds: DustCloudPuff[];
  explosions: ExplosionFlash[];
  scorches: ScorchDecal[];
  popups: FloatingPopup[];
  trajectoryDotCount: number;
  gravityScale: number;
  windFactor: number;
  shakeMagnitude: number;
  timeSec: number;
  quiverCount: number;
  infiniteBirds: boolean;
  birdAlpha: number;
  towerAlpha: number;
  atmosphereHint?: 0 | 1 | 2;
  camera: {
    focusX: number;
    focusY: number;
    zoom: number;
  };
  rapidReticle?: { x: number; y: number } | null;
  fastRender?: boolean;
}

const BACK_FORK_X = SLING_ANCHOR_X + 11;
const BACK_FORK_Y = SLING_ANCHOR_Y - 3;
const FRONT_FORK_X = SLING_ANCHOR_X - 13;
const FRONT_FORK_Y = SLING_ANCHOR_Y + 3;

const CACHE_PAD_X = 960;
const CACHE_W = WORLD_W + CACHE_PAD_X * 2;
const MOUNT_Y0 = 280;
const MOUNT_H = 280;
const PINE_Y0 = 420;
const PINE_H = 148;
const FG_Y0 = 480;
const FG_H = WORLD_H - FG_Y0 + 260;

interface ValleyTheme {
  skyStops: [string, string, string, string, string];
  sunCore: string;
  sunMid: string;
  sunOuter: string;
  mountainFar: string;
  mountainSnow: string;
  mountainLit: string;
  mistRibbon: string;
  pineRidge: string;
  pineSpire: string;
  meadow: string;
  hillock: string;
  hasStars?: boolean;
}

const VALLEY_THEMES: ValleyTheme[] = [
  {
    // 0: Morning Orchard
    skyStops: ['#1e4e96', '#3978c2', '#86c5eb', '#e6f1df', '#fce7b8'],
    sunCore: 'rgba(255, 252, 228, 0.96)',
    sunMid: 'rgba(255, 229, 158, 0.45)',
    sunOuter: 'rgba(255, 214, 140, 0.14)',
    mountainFar: '#7094b0',
    mountainSnow: 'rgba(241, 248, 255, 0.42)',
    mountainLit: 'rgba(255, 232, 198, 0.24)',
    mistRibbon: 'rgba(232, 244, 248, 0.34)',
    pineRidge: '#52806d',
    pineSpire: '#436e5b',
    meadow: '#53914a',
    hillock: '#457c3a',
  },
  {
    // 1: Golden Canyon
    skyStops: ['#2b285c', '#743f7d', '#c96b67', '#f1a96d', '#ffe1a1'],
    sunCore: 'rgba(255, 245, 200, 0.96)',
    sunMid: 'rgba(255, 190, 110, 0.52)',
    sunOuter: 'rgba(244, 128, 92, 0.18)',
    mountainFar: '#675987',
    mountainSnow: 'rgba(255, 224, 198, 0.32)',
    mountainLit: 'rgba(255, 198, 145, 0.28)',
    mistRibbon: 'rgba(255, 210, 175, 0.28)',
    pineRidge: '#476b5e',
    pineSpire: '#38574c',
    meadow: '#4c7a3d',
    hillock: '#3e6931',
  },
  {
    // 2: Starlit Twilight Citadel
    skyStops: ['#0d132b', '#1f2b59', '#49467d', '#9e6277', '#dca07f'],
    sunCore: 'rgba(255, 228, 175, 0.88)',
    sunMid: 'rgba(240, 140, 120, 0.36)',
    sunOuter: 'rgba(180, 88, 128, 0.12)',
    mountainFar: '#3a426b',
    mountainSnow: 'rgba(226, 204, 235, 0.24)',
    mountainLit: 'rgba(244, 168, 148, 0.18)',
    mistRibbon: 'rgba(195, 178, 220, 0.22)',
    pineRidge: '#2d4b46',
    pineSpire: '#213834',
    meadow: '#355c39',
    hillock: '#2a4d2d',
    hasStars: true,
  },
];

interface CachedValleyLayers {
  sunGlow: HTMLCanvasElement;
  sunY: number;
  mountains: HTMLCanvasElement;
  pines: HTMLCanvasElement;
  foreground: HTMLCanvasElement;
}

const cachedLayers: Array<CachedValleyLayers | null> = [null, null, null];

const STAR_COORDS: Array<{ x: number; y: number; r: number }> = Array.from({ length: 68 }, (_, s) => ({
  x: -760 + ((s * 293) % (WORLD_W + 1500)),
  y: -220 + ((s * 179) % 420),
  r: s % 3 === 0 ? 1.8 : 1.0,
}));

function makeOffscreenBand(y0: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = CACHE_W;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(CACHE_PAD_X, -y0);
  return [canvas, ctx];
}

function drawOrchardTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number
) {
  ctx.fillStyle = '#4f321e';
  ctx.fillRect(x - 4 * scale, groundY - 34 * scale, 8 * scale, 36 * scale);
  ctx.fillStyle = '#3a6f33';
  ctx.beginPath();
  ctx.arc(x, groundY - 46 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x - 15 * scale, groundY - 38 * scale, 16 * scale, 0, Math.PI * 2);
  ctx.arc(x + 16 * scale, groundY - 37 * scale, 15 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#539444';
  ctx.beginPath();
  ctx.arc(x + 4 * scale, groundY - 50 * scale, 14 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function getValleyLayers(index: number): CachedValleyLayers {
  const safeIdx = ((index % 3) + 3) % 3;
  const existing = cachedLayers[safeIdx];
  if (existing) return existing;

  const theme = VALLEY_THEMES[safeIdx];

  // Compact 480x480 sun halo sprite instead of a 3400x1400 sky bitmap
  const sunGlowCanvas = document.createElement('canvas');
  sunGlowCanvas.width = 480;
  sunGlowCanvas.height = 480;
  const sCtx = sunGlowCanvas.getContext('2d')!;
  const sunY = safeIdx === 0 ? 128 : safeIdx === 1 ? 196 : 268;
  const sunGlow = sCtx.createRadialGradient(240, 240, 10, 240, 240, 240);
  sunGlow.addColorStop(0, theme.sunCore);
  sunGlow.addColorStop(0.22, theme.sunMid);
  sunGlow.addColorStop(0.58, theme.sunOuter);
  sunGlow.addColorStop(1, 'rgba(255, 214, 140, 0)');
  sCtx.fillStyle = sunGlow;
  sCtx.fillRect(0, 0, 480, 480);

  // Layer 2: Distant Mountain Ridge + Valley Mist (cropped Y band 280..560)
  const [mountains, mCtx] = makeOffscreenBand(MOUNT_Y0, MOUNT_H);
  mCtx.fillStyle = theme.mountainFar;
  mCtx.beginPath();
  mCtx.moveTo(-CACHE_PAD_X, GROUND_Y);
  mCtx.lineTo(-CACHE_PAD_X, 420);
  mCtx.lineTo(-320, 345);
  mCtx.lineTo(110, 412);
  mCtx.lineTo(375, 318);
  mCtx.lineTo(620, 405);
  mCtx.lineTo(895, 304);
  mCtx.lineTo(1140, 388);
  mCtx.lineTo(1420, 326);
  mCtx.lineTo(WORLD_W + CACHE_PAD_X, 408);
  mCtx.lineTo(WORLD_W + CACHE_PAD_X, GROUND_Y);
  mCtx.closePath();
  mCtx.fill();

  mCtx.fillStyle = theme.mountainLit;
  mCtx.beginPath();
  mCtx.moveTo(375, 318);
  mCtx.lineTo(545, 412);
  mCtx.lineTo(430, 412);
  mCtx.closePath();
  mCtx.moveTo(895, 304);
  mCtx.lineTo(1075, 396);
  mCtx.lineTo(942, 396);
  mCtx.closePath();
  mCtx.fill();

  mCtx.fillStyle = theme.mountainSnow;
  mCtx.beginPath();
  mCtx.moveTo(375, 318);
  mCtx.lineTo(412, 338);
  mCtx.lineTo(386, 335);
  mCtx.lineTo(360, 341);
  mCtx.closePath();
  mCtx.moveTo(895, 304);
  mCtx.lineTo(936, 328);
  mCtx.lineTo(905, 323);
  mCtx.lineTo(872, 330);
  mCtx.closePath();
  mCtx.fill();

  const mistGrad = mCtx.createLinearGradient(0, 410, 0, 505);
  mistGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  mistGrad.addColorStop(0.55, theme.mistRibbon);
  mistGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  mCtx.fillStyle = mistGrad;
  mCtx.fillRect(-CACHE_PAD_X, 410, CACHE_W, 95);

  // Layer 3: Pine Foothills (cropped Y band 420..568)
  const [pines, pCtx] = makeOffscreenBand(PINE_Y0, PINE_H);
  pCtx.fillStyle = theme.pineRidge;
  pCtx.beginPath();
  pCtx.moveTo(-CACHE_PAD_X, GROUND_Y);
  pCtx.lineTo(-CACHE_PAD_X, 495);
  pCtx.quadraticCurveTo(220, 440, 510, 498);
  pCtx.quadraticCurveTo(850, 435, 1210, 495);
  pCtx.quadraticCurveTo(1520, 460, WORLD_W + CACHE_PAD_X, 495);
  pCtx.lineTo(WORLD_W + CACHE_PAD_X, GROUND_Y);
  pCtx.closePath();
  pCtx.fill();

  pCtx.fillStyle = theme.pineSpire;
  for (let px = -560; px <= WORLD_W + 560; px += 32) {
    const base = 478 + Math.sin(px * 0.012) * 16;
    const th = 22 + ((Math.abs(px) * 7) % 14);
    pCtx.beginPath();
    pCtx.moveTo(px, base - th);
    pCtx.lineTo(px + 9, base + 12);
    pCtx.lineTo(px - 9, base + 12);
    pCtx.closePath();
    pCtx.fill();
  }

  // Layer 4: Foreground Meadow, Barn, Orchard Trees, Fence, Quiver Perch & Soil (cropped Y band 480..980)
  const [foreground, fgCtx] = makeOffscreenBand(FG_Y0, FG_H);
  fgCtx.fillStyle = theme.meadow;
  fgCtx.beginPath();
  fgCtx.moveTo(-CACHE_PAD_X, GROUND_Y);
  fgCtx.lineTo(-CACHE_PAD_X, 545);
  fgCtx.quadraticCurveTo(190, 510, 460, 548);
  fgCtx.quadraticCurveTo(790, 504, 1120, 548);
  fgCtx.quadraticCurveTo(1420, 520, WORLD_W + CACHE_PAD_X, 546);
  fgCtx.lineTo(WORLD_W + CACHE_PAD_X, GROUND_Y);
  fgCtx.closePath();
  fgCtx.fill();

  const barnX = 540;
  const barnY = 528;
  fgCtx.fillStyle = '#9e382e';
  fgCtx.fillRect(barnX - 24, barnY - 22, 48, 24);
  fgCtx.fillStyle = '#472a23';
  fgCtx.beginPath();
  fgCtx.moveTo(barnX - 27, barnY - 21);
  fgCtx.lineTo(barnX, barnY - 38);
  fgCtx.lineTo(barnX + 27, barnY - 21);
  fgCtx.closePath();
  fgCtx.fill();
  fgCtx.fillStyle = safeIdx === 2 ? '#fde68a' : '#f8fafc';
  fgCtx.fillRect(barnX - 6, barnY - 14, 12, 14);
  fgCtx.fillStyle = '#cbd5e1';
  fgCtx.fillRect(barnX + 28, barnY - 28, 12, 30);
  fgCtx.beginPath();
  fgCtx.arc(barnX + 34, barnY - 28, 6, Math.PI, Math.PI * 2);
  fgCtx.fill();

  drawOrchardTree(fgCtx, -90, 560, 0.9);
  drawOrchardTree(fgCtx, 42, 558, 0.95);
  drawOrchardTree(fgCtx, 422, 556, 0.78);
  drawOrchardTree(fgCtx, 1365, 558, 1.05);
  drawOrchardTree(fgCtx, 1445, 566, 0.85);
  drawOrchardTree(fgCtx, 1595, 562, 0.92);

  fgCtx.strokeStyle = '#6f4c30';
  fgCtx.lineWidth = 2.2;
  fgCtx.beginPath();
  fgCtx.moveTo(-CACHE_PAD_X, GROUND_Y - 17);
  fgCtx.lineTo(WORLD_W + CACHE_PAD_X, GROUND_Y - 17);
  fgCtx.moveTo(-CACHE_PAD_X, GROUND_Y - 9);
  fgCtx.lineTo(WORLD_W + CACHE_PAD_X, GROUND_Y - 9);
  fgCtx.stroke();
  fgCtx.fillStyle = '#5a3b23';
  for (let fx = -640; fx <= WORLD_W + 640; fx += 58) {
    fgCtx.fillRect(fx - 2, GROUND_Y - 24, 4, 24);
  }

  fgCtx.fillStyle = theme.hillock;
  fgCtx.beginPath();
  fgCtx.moveTo(64, GROUND_Y);
  fgCtx.quadraticCurveTo(222, 556, 378, GROUND_Y);
  fgCtx.closePath();
  fgCtx.fill();

  // Wooden quiver perch beside slingshot base
  fgCtx.fillStyle = '#5c3a1f';
  fgCtx.fillRect(72, GROUND_Y - 11, 126, 9);
  fgCtx.fillStyle = '#7b502d';
  fgCtx.fillRect(74, GROUND_Y - 11, 122, 3);

  const soilGrad = fgCtx.createLinearGradient(0, GROUND_Y, 0, WORLD_H + 260);
  soilGrad.addColorStop(0, '#623f25');
  soilGrad.addColorStop(0.22, '#4a2e1a');
  soilGrad.addColorStop(1, '#26170b');
  fgCtx.fillStyle = soilGrad;
  fgCtx.fillRect(-CACHE_PAD_X, GROUND_Y, CACHE_W, WORLD_H - GROUND_Y + 260);

  fgCtx.fillStyle = '#4c9937';
  fgCtx.fillRect(-CACHE_PAD_X, GROUND_Y - 5, CACHE_W, 13);
  fgCtx.fillStyle = '#79c953';
  fgCtx.fillRect(-CACHE_PAD_X, GROUND_Y - 5, CACHE_W, 4);

  fgCtx.fillStyle = '#3f842c';
  for (let gx = -560; gx < WORLD_W + 560; gx += 42) {
    fgCtx.beginPath();
    fgCtx.moveTo(gx, GROUND_Y - 4);
    fgCtx.lineTo(gx + 5, GROUND_Y - 12);
    fgCtx.lineTo(gx + 9, GROUND_Y - 4);
    fgCtx.fill();
  }

  const bundle: CachedValleyLayers = { sunGlow: sunGlowCanvas, sunY, mountains, pines, foreground };
  cachedLayers[safeIdx] = bundle;
  return bundle;
}

function drawCroppedLayer(
  ctx: CanvasRenderingContext2D,
  layerA: HTMLCanvasElement,
  layerB: HTMLCanvasElement,
  blend: number,
  xShift: number,
  y0: number,
  layerH: number,
  visLeft: number,
  visRight: number
) {
  const minWorldX = -CACHE_PAD_X + xShift;
  const maxWorldX = minWorldX + CACHE_W;
  const clampedLeft = Math.max(minWorldX, Math.floor(visLeft) - 2);
  const clampedRight = Math.min(maxWorldX, Math.ceil(visRight) + 2);
  const sw = clampedRight - clampedLeft;
  if (sw <= 0) return;
  const sx = clampedLeft - minWorldX;

  ctx.drawImage(layerA, sx, 0, sw, layerH, clampedLeft, y0, sw, layerH);
  if (blend > 0.015) {
    ctx.save();
    ctx.globalAlpha = blend;
    ctx.drawImage(layerB, sx, 0, sw, layerH, clampedLeft, y0, sw, layerH);
    ctx.restore();
  }
}

function renderBackdrop(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  atmosphereHint: number,
  visLeft: number,
  visTop: number,
  visRight: number,
  fastRender: boolean
) {
  let idxA = ((atmosphereHint % 3) + 3) % 3;
  let idxB = (idxA + 1) % 3;
  let smoothBlend = 0;

  if (!fastRender) {
    const cycle = (atmosphereHint + timeSec * 0.025) % 3;
    idxA = Math.floor(cycle) % 3;
    idxB = (idxA + 1) % 3;
    const frac = cycle - Math.floor(cycle);
    const blendT = frac > 0.64 ? (frac - 0.64) / 0.36 : 0;
    smoothBlend = blendT * blendT * (3 - 2 * blendT);
  }

  const themeA = VALLEY_THEMES[idxA];
  const layersA = getValleyLayers(idxA);
  const layersB = smoothBlend > 0.015 ? getValleyLayers(idxB) : layersA;

  // Hardware-accelerated direct sky gradient fill over visible world bounds
  const skyTop = Math.min(-320, visTop - 10);
  const skyGrad = ctx.createLinearGradient(0, -340, 0, GROUND_Y);
  skyGrad.addColorStop(0, themeA.skyStops[0]);
  skyGrad.addColorStop(0.28, themeA.skyStops[1]);
  skyGrad.addColorStop(0.65, themeA.skyStops[2]);
  skyGrad.addColorStop(0.92, themeA.skyStops[3]);
  skyGrad.addColorStop(1, themeA.skyStops[4]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(visLeft - 8, skyTop, visRight - visLeft + 16, GROUND_Y - skyTop + 10);

  if (themeA.hasStars) {
    ctx.fillStyle = 'rgba(255, 250, 235, 0.72)';
    for (let s = 0; s < STAR_COORDS.length; s++) {
      const st = STAR_COORDS[s];
      if (st.x < visLeft - 4 || st.x > visRight + 4 || st.y < skyTop) continue;
      ctx.fillRect(st.x - st.r, st.y - st.r, st.r * 2, st.r * 2);
    }
  }

  // Compact cached sun glow
  ctx.drawImage(layersA.sunGlow, 1190 - 240, layersA.sunY - 240);

  const farDrift = Math.sin(timeSec * 0.08) * 14;
  const midDrift = Math.sin(timeSec * 0.08) * 26;

  const clouds = [
    { x: 180, y: 112, scale: 1.0, speed: 6.5 },
    { x: 560, y: 84, scale: 1.25, speed: 4.8 },
    { x: 960, y: 158, scale: 0.9, speed: 7.2 },
    { x: 1360, y: 108, scale: 1.05, speed: 5.5 },
  ];
  ctx.fillStyle = idxA === 2 ? 'rgba(226, 232, 240, 0.38)' : 'rgba(255, 250, 244, 0.72)';
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    const span = WORLD_W + 480;
    const cx = ((c.x + timeSec * c.speed) % span) - 240;
    if (cx < visLeft - 90 || cx > visRight + 90) continue;
    const cy = c.y;
    const s = c.scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 46 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 26 * s, cy + 5 * s, 30 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 28 * s, cy + 6 * s, 32 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCroppedLayer(ctx, layersA.mountains, layersB.mountains, smoothBlend, farDrift, MOUNT_Y0, MOUNT_H, visLeft, visRight);
  drawCroppedLayer(ctx, layersA.pines, layersB.pines, smoothBlend, midDrift, PINE_Y0, PINE_H, visLeft, visRight);

  // Soaring distant silhouettes
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.42)';
  ctx.lineWidth = 1.6;
  for (let b = 0; b < 3; b++) {
    const bx = ((340 + b * 68 + timeSec * 18) % (WORLD_W + 240)) - 120;
    if (bx < visLeft - 20 || bx > visRight + 20) continue;
    const by = 228 + b * 14 + Math.sin(timeSec * 2.2 + b) * 6;
    const wing = Math.sin(timeSec * 7.5 + b * 1.3) * 4;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by + wing);
    ctx.quadraticCurveTo(bx - 3, by - 4, bx, by);
    ctx.quadraticCurveTo(bx + 3, by - 4, bx + 8, by + wing);
    ctx.stroke();
  }

  drawCroppedLayer(ctx, layersA.foreground, layersB.foreground, smoothBlend, 0, FG_Y0, FG_H, visLeft, visRight);
}

function renderGroundImpacts(
  ctx: CanvasRenderingContext2D,
  divots: GroundDivot[],
  shockwaves: GroundShockwave[],
  scorches: ScorchDecal[],
  windFactor: number,
  timeSec: number
) {
  if (windFactor !== 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    const dir = Math.sign(windFactor);
    for (let i = 0; i < 6; i++) {
      const span = WORLD_W + 260;
      const rawX = (i * 275 + timeSec * dir * 210) % span;
      const x = rawX < -130 ? rawX + span : rawX;
      const y = 128 + (i % 3) * 118 + Math.sin(timeSec * 2 + i) * 12;
      const len = 46 + (i % 3) * 18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5 * dir, y - 5, x + len * dir, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (scorches.length > 0) {
    ctx.save();
    for (let i = 0; i < scorches.length; i++) {
      const sc = scorches[i];
      if (sc.alpha <= 0.02) continue;
      ctx.globalAlpha = sc.alpha * 0.72;
      ctx.fillStyle = '#1c120c';
      ctx.beginPath();
      ctx.ellipse(sc.x, GROUND_Y + 2, sc.radius, sc.radius * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = sc.alpha * 0.35;
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(sc.x, GROUND_Y + 1, sc.radius * 0.55, sc.radius * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (divots.length > 0) {
    ctx.save();
    for (let i = 0; i < divots.length; i++) {
      const d = divots[i];
      if (d.depth <= 0.35) continue;
      const fade =
        d.age > d.maxAge * 0.72
          ? Math.max(0, 1 - (d.age - d.maxAge * 0.72) / (d.maxAge * 0.28))
          : 1;
      if (fade <= 0.01) continue;

      const curDepth = Math.max(
        0.5,
        d.depth + Math.sin(d.age * 34) * d.wobble * 2.4
      );
      const hw = d.halfWidth;
      const x = d.x;

      ctx.globalAlpha = fade;
      ctx.fillStyle = '#361f10';
      ctx.beginPath();
      ctx.moveTo(x - hw, GROUND_Y - 5);
      ctx.quadraticCurveTo(x, GROUND_Y + curDepth * 1.45, x + hw, GROUND_Y - 5);
      ctx.lineTo(x + hw * 0.85, GROUND_Y + 7);
      ctx.quadraticCurveTo(x, GROUND_Y + curDepth * 1.9 + 5, x - hw * 0.85, GROUND_Y + 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#52321b';
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.92, GROUND_Y - 4);
      ctx.quadraticCurveTo(x, GROUND_Y + curDepth * 1.1, x + hw * 0.92, GROUND_Y - 4);
      ctx.quadraticCurveTo(x, GROUND_Y - 1, x - hw * 0.92, GROUND_Y - 4);
      ctx.fill();

      const moundH = Math.min(8, curDepth * 0.45);
      ctx.fillStyle = '#6b4527';
      ctx.beginPath();
      ctx.ellipse(x - hw * 0.84, GROUND_Y - 4, hw * 0.28, moundH, -0.18, Math.PI, Math.PI * 2);
      ctx.ellipse(x + hw * 0.84, GROUND_Y - 4, hw * 0.28, moundH, 0.18, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#6fc14c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.88, GROUND_Y - 4);
      ctx.lineTo(x - hw * 1.06, GROUND_Y - 11 - moundH * 0.35);
      ctx.moveTo(x + hw * 0.88, GROUND_Y - 4);
      ctx.lineTo(x + hw * 1.06, GROUND_Y - 11 - moundH * 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (shockwaves.length > 0) {
    ctx.save();
    for (let i = 0; i < shockwaves.length; i++) {
      const sw = shockwaves[i];
      if (sw.alpha <= 0.01) continue;
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.tint;
      ctx.lineWidth = sw.thickness;
      ctx.beginPath();
      ctx.ellipse(
        sw.x,
        GROUND_Y - 1,
        sw.radius,
        Math.max(2.5, sw.radius * 0.22),
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.globalAlpha = sw.alpha * 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, sw.thickness * 0.45);
      ctx.beginPath();
      ctx.ellipse(
        sw.x,
        GROUND_Y - 1,
        sw.radius * 0.72,
        Math.max(1.8, sw.radius * 0.16),
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

function renderExplosions(ctx: CanvasRenderingContext2D, explosions: ExplosionFlash[]) {
  if (explosions.length === 0) return;
  ctx.save();
  for (let i = 0; i < explosions.length; i++) {
    const ex = explosions[i];
    if (ex.alpha <= 0.01) continue;
    if (ex.isSonic) {
      ctx.globalAlpha = ex.alpha;
      ctx.strokeStyle = ex.tint;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = ex.alpha * 0.45;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = ex.alpha * 0.42;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius * 0.82, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = ex.alpha * 0.85;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = ex.alpha;
      ctx.strokeStyle = ex.tint;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderDustClouds(ctx: CanvasRenderingContext2D, dustClouds: DustCloudPuff[]) {
  if (dustClouds.length === 0) return;
  ctx.save();
  for (let i = 0; i < dustClouds.length; i++) {
    const p = dustClouds[i];
    if (p.alpha <= 0.01) continue;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderTrajectoryPreview(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  vx0: number,
  vy0: number,
  steps: number,
  gravityScale: number,
  windFactor: number
) {
  const speed = Math.hypot(vx0, vy0);
  if (speed < 40) return;

  const gx = GRAVITY * gravityScale * windFactor;
  const gy = GRAVITY * gravityScale;

  ctx.save();
  const dtStep = 0.056;
  for (let i = 1; i <= steps; i++) {
    const t = i * dtStep;
    const px = startX + vx0 * t + 0.5 * gx * t * (t + 1 / 120);
    const py = startY + vy0 * t + 0.5 * gy * t * (t + 1 / 120);
    if (py > GROUND_Y - 4) break;
    const alpha = Math.max(0.14, 0.88 * (1 - i / (steps + 1)));
    const r = Math.max(2.1, 5.2 - i * 0.14);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(15, 23, 42, ${(alpha * 0.45).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function renderSlingshotBack(
  ctx: CanvasRenderingContext2D,
  pouchX: number,
  pouchY: number,
  stretchDist: number
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = '#4a2a14';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(SLING_ANCHOR_X, GROUND_Y - 10);
  ctx.lineTo(SLING_ANCHOR_X, SLING_ANCHOR_Y + 46);
  ctx.lineTo(BACK_FORK_X, BACK_FORK_Y);
  ctx.stroke();

  ctx.strokeStyle = '#6e4223';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(SLING_ANCHOR_X, GROUND_Y - 12);
  ctx.lineTo(SLING_ANCHOR_X, SLING_ANCHOR_Y + 46);
  ctx.lineTo(BACK_FORK_X, BACK_FORK_Y);
  ctx.stroke();

  const bandWidth = Math.max(3.4, 9.2 - stretchDist * 0.042);
  ctx.strokeStyle = stretchDist > 90 ? '#5c2618' : '#301a11';
  ctx.lineWidth = bandWidth;
  ctx.beginPath();
  ctx.moveTo(BACK_FORK_X, BACK_FORK_Y);
  ctx.lineTo(pouchX, pouchY);
  ctx.stroke();

  ctx.strokeStyle = '#733824';
  ctx.lineWidth = Math.max(1.5, bandWidth * 0.38);
  ctx.beginPath();
  ctx.moveTo(BACK_FORK_X, BACK_FORK_Y - 1);
  ctx.lineTo(pouchX, pouchY - 1);
  ctx.stroke();

  ctx.restore();
}

function renderSlingshotFront(
  ctx: CanvasRenderingContext2D,
  pouchX: number,
  pouchY: number,
  stretchDist: number,
  birdInSling: boolean
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const angle = Math.atan2(SLING_ANCHOR_Y - pouchY, SLING_ANCHOR_X - pouchX);
  ctx.save();
  ctx.translate(pouchX, pouchY);
  ctx.rotate(angle);
  ctx.fillStyle = '#3c2113';
  ctx.strokeStyle = '#201009';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(birdInSling ? -12 : 0, 0, 10, 14, 0, Math.PI * 0.45, Math.PI * 1.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const bandWidth = Math.max(3.6, 9.6 - stretchDist * 0.042);
  ctx.strokeStyle = stretchDist > 90 ? '#662b1b' : '#381e13';
  ctx.lineWidth = bandWidth;
  ctx.beginPath();
  ctx.moveTo(FRONT_FORK_X, FRONT_FORK_Y);
  ctx.lineTo(pouchX, pouchY);
  ctx.stroke();

  ctx.strokeStyle = '#82402a';
  ctx.lineWidth = Math.max(1.6, bandWidth * 0.38);
  ctx.beginPath();
  ctx.moveTo(FRONT_FORK_X, FRONT_FORK_Y - 1);
  ctx.lineTo(pouchX, pouchY - 1);
  ctx.stroke();

  ctx.strokeStyle = '#57331a';
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(SLING_ANCHOR_X, SLING_ANCHOR_Y + 46);
  ctx.lineTo(FRONT_FORK_X, FRONT_FORK_Y);
  ctx.stroke();

  ctx.strokeStyle = '#7c4c29';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(SLING_ANCHOR_X, SLING_ANCHOR_Y + 46);
  ctx.lineTo(FRONT_FORK_X, FRONT_FORK_Y);
  ctx.stroke();

  ctx.fillStyle = '#29150c';
  ctx.beginPath();
  ctx.arc(BACK_FORK_X, BACK_FORK_Y, 6, 0, Math.PI * 2);
  ctx.arc(FRONT_FORK_X, FRONT_FORK_Y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

const BIRD_SPRITE_BASE_R = 26;
const BIRD_SPRITE_BOX = 128;
const birdSpriteCache = new Map<string, HTMLCanvasElement>();

function paintBirdVector(
  ctx: CanvasRenderingContext2D,
  r: number,
  birdType: BirdType,
  isHurt: boolean
) {
  // Tail feathers
  ctx.fillStyle = birdType === 'chuck' ? '#78350f' : '#18181b';
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, -2);
  ctx.lineTo(-r * 1.44, -7);
  ctx.lineTo(-r * 1.24, 0);
  ctx.lineTo(-r * 1.46, 5);
  ctx.lineTo(-r * 0.8, 4);
  ctx.closePath();
  ctx.fill();

  if (birdType === 'chuck') {
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -r * 0.95, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.14);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.9, r * 1.04, r * 0.76);
    ctx.quadraticCurveTo(0, r * 1.02, -r * 1.04, r * 0.76);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.9, 0, -r * 1.14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.ellipse(r * 0.08, r * 0.55, r * 0.52, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (birdType === 'bomb') {
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-2, -r * 0.95);
    ctx.quadraticCurveTo(-6, -r * 1.38, 4, -r * 1.44);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(r * 0.14, r * 0.5, r * 0.55, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(r * 0.36, -r * 0.36, r * 0.22, r * 0.14, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (birdType === 'blues') {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(-2, -r * 1.06, r * 0.35, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.32, r * 0.42, r * 0.24, -0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (birdType === 'terence') {
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(-3, -r * 1.04, r * 0.34, r * 0.16, -0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(252, 165, 165, 0.25)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.34, r * 0.44, r * 0.25, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e7d3be';
    ctx.beginPath();
    ctx.ellipse(r * 0.1, r * 0.52, r * 0.6, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(69, 10, 10, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(r * 0.24, -r * 0.04, r * 0.24, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(-2, -r * 1.08, r * 0.34, r * 0.16, -0.45, 0, Math.PI * 2);
    ctx.ellipse(-6, -r * 0.95, r * 0.25, r * 0.13, -0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#5f1111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(252, 165, 165, 0.32)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.34, r * 0.45, r * 0.26, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde8cf';
    ctx.beginPath();
    ctx.ellipse(r * 0.12, r * 0.52, r * 0.58, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r * 0.22, -r * 0.12, r * 0.23, 0, Math.PI * 2);
  ctx.arc(r * 0.56, -r * 0.1, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  const pupilScale = isHurt ? 0.55 : 1;
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.12, r * 0.095 * pupilScale, 0, Math.PI * 2);
  ctx.arc(r * 0.61, -r * 0.1, r * 0.085 * pupilScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = birdType === 'blues' ? '#075985' : '#18181b';
  ctx.lineWidth = birdType === 'terence' ? 4.2 : birdType === 'blues' ? 2.2 : 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.0, -r * 0.38);
  ctx.lineTo(r * 0.42, -r * 0.24);
  ctx.lineTo(r * 0.74, -r * 0.36);
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r * 0.44, r * 0.04);
  ctx.lineTo(r * 1.15, r * 0.18);
  ctx.lineTo(r * 0.44, r * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function getCachedBirdSprite(birdType: BirdType, isHurt: boolean): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${birdType}:${isHurt ? 1 : 0}`;
  const cached = birdSpriteCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = BIRD_SPRITE_BOX;
  canvas.height = BIRD_SPRITE_BOX;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.translate(BIRD_SPRITE_BOX * 0.5, BIRD_SPRITE_BOX * 0.5);
  paintBirdVector(c, BIRD_SPRITE_BASE_R, birdType, isHurt);
  birdSpriteCache.set(key, canvas);
  return canvas;
}

export function drawBirdSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  birdType: BirdType = 'red',
  alpha = 1,
  opts?: {
    showAbilityRing?: boolean;
    dashActive?: boolean;
    fuseTimer?: number;
    timeSec?: number;
    isHurt?: boolean;
  }
) {
  if (alpha <= 0.01) return;
  const timeSec = opts?.timeSec ?? 0;

  ctx.save();
  if (alpha < 0.995) ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  if (opts?.showAbilityRing) {
    const pulse = 1 + Math.sin(timeSec * 12) * 0.08;
    ctx.save();
    ctx.strokeStyle =
      birdType === 'chuck'
        ? 'rgba(250, 204, 21, 0.78)'
        : birdType === 'blues'
          ? 'rgba(56, 189, 248, 0.85)'
          : birdType === 'bomb'
            ? 'rgba(251, 146, 60, 0.85)'
            : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -timeSec * 28;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.48 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(angle);

  if (birdType === 'chuck' && opts?.dashActive) {
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-r * 2.3, 0);
    ctx.lineTo(r * 0.5, -r * 1.15);
    ctx.lineTo(r * 0.5, r * 1.15);
    ctx.closePath();
    ctx.fill();
  }

  const sprite = getCachedBirdSprite(birdType, Boolean(opts?.isHurt));
  if (sprite) {
    const scaleFactor = r / BIRD_SPRITE_BASE_R;
    const drawSize = BIRD_SPRITE_BOX * scaleFactor;
    ctx.drawImage(sprite, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
  } else {
    paintBirdVector(ctx, r, birdType, Boolean(opts?.isHurt));
  }

  if (birdType === 'bomb') {
    const emberPulse = opts?.fuseTimer !== undefined ? 1.5 : 1.0;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(4, -r * 1.44, 4.2 * emberPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(4, -r * 1.44, 2.2 * emberPulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function renderPig(ctx: CanvasRenderingContext2D, b: RigidBody, timeSec: number) {
  const r = b.radius;
  const damaged = b.hp < b.maxHp * 0.62;
  const variant = b.pigVariant ?? 'minion';
  const hasArmor = (b.armorHp ?? 0) > 0;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);

  // Ears
  ctx.fillStyle = '#65a30d';
  ctx.beginPath();
  ctx.arc(-r * 0.65, -r * 0.7, r * 0.25, 0, Math.PI * 2);
  ctx.arc(r * 0.65, -r * 0.7, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#84cc16';
  ctx.strokeStyle = '#365314';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Highlight
  ctx.fillStyle = 'rgba(217, 249, 157, 0.38)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.32, r * 0.4, r * 0.24, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-r * 0.42, -r * 0.1, r * 0.22, 0, Math.PI * 2);
  ctx.arc(r * 0.42, -r * 0.1, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-r * 0.4, -r * 0.1, damaged ? r * 0.06 : r * 0.095, 0, Math.PI * 2);
  ctx.arc(r * 0.4, -r * 0.1, damaged ? r * 0.06 : r * 0.095, 0, Math.PI * 2);
  ctx.fill();

  // Cheeky brow or panicked brow if damaged
  if (damaged) {
    ctx.strokeStyle = '#365314';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.36);
    ctx.lineTo(-r * 0.25, -r * 0.26);
    ctx.moveTo(r * 0.6, -r * 0.36);
    ctx.lineTo(r * 0.25, -r * 0.26);
    ctx.stroke();
  }

  // Snout
  ctx.fillStyle = '#bef264';
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 0.38, r * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1a2e05';
  ctx.beginPath();
  ctx.arc(-r * 0.13, r * 0.16, r * 0.075, 0, Math.PI * 2);
  ctx.arc(r * 0.13, r * 0.16, r * 0.075, 0, Math.PI * 2);
  ctx.fill();

  // Helmet Corporal Pig armor
  if (variant === 'helmet' && hasArmor) {
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 1.03, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Metallic rim highlight
    ctx.fillStyle = 'rgba(248, 250, 252, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.65, r * 0.36, r * 0.14, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // King Pig royal crown
  if (variant === 'king' && hasArmor) {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.78);
    ctx.lineTo(-r * 0.72, -r * 1.38);
    ctx.lineTo(-r * 0.28, -r * 1.05);
    ctx.lineTo(0, -r * 1.52);
    ctx.lineTo(r * 0.28, -r * 1.05);
    ctx.lineTo(r * 0.72, -r * 1.38);
    ctx.lineTo(r * 0.62, -r * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crown jewels
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -r * 0.96, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-r * 0.36, -r * 0.93, 2.5, 0, Math.PI * 2);
    ctx.arc(r * 0.36, -r * 0.93, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle sweat drop if injured
  if (damaged) {
    const dropY = -r * 0.55 + Math.sin(timeSec * 8) * 2;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(r * 0.75, dropY, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (b.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(b.hitFlash * 0.45).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function renderBlock(ctx: CanvasRenderingContext2D, b: RigidBody, timeSec: number) {
  if (!b.isActive) return;

  // Floating skyway platforms (static ground bodies elevated above the valley floor)
  if (b.kind === 'ground') {
    if (b.y >= GROUND_Y - 10 || b.x > WORLD_W + 40) return;
    const w = b.hw * 2;
    const h = b.hh * 2;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#5c4028';
    ctx.strokeStyle = '#332010';
    ctx.lineWidth = 2;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.strokeRect(-b.hw, -b.hh, w, h);
    ctx.fillStyle = '#59a643';
    ctx.fillRect(-b.hw, -b.hh, w, 6);
    ctx.restore();
    return;
  }

  if (b.kind === 'pig') {
    renderPig(ctx, b, timeSec);
    return;
  }

  if (b.kind === 'boulder') {
    const r = b.radius;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(-r * 0.26, -r * 0.28, r * 0.42, r * 0.26, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.12);
    ctx.lineTo(r * 0.1, r * 0.35);
    ctx.lineTo(r * 0.48, -r * 0.08);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const w = b.hw * 2;
  const h = b.hh * 2;
  const damaged = b.hp < b.maxHp * 0.62;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);

  if (b.kind === 'bouncer') {
    const squash = b.bounceFlash ? b.bounceFlash * 4.5 : 0;
    // Spring coils underneath
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-b.hw * 0.55, b.hh);
    ctx.lineTo(-b.hw * 0.3, -b.hh + squash);
    ctx.lineTo(0, b.hh);
    ctx.lineTo(b.hw * 0.3, -b.hh + squash);
    ctx.lineTo(b.hw * 0.55, b.hh);
    ctx.stroke();

    // Plush elastic top pad
    ctx.fillStyle = b.bounceFlash && b.bounceFlash > 0.2 ? '#fde047' : '#fb7185';
    ctx.strokeStyle = '#9f1239';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-b.hw, -b.hh + squash, w, h * 0.68, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(-b.hw + 8, -b.hh + 2 + squash, w - 16, 3);
    ctx.restore();
    return;
  }

  if (b.kind === 'tnt') {
    const pulse = 0.72 + 0.28 * Math.sin(timeSec * 6.5);
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 2.2;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.strokeRect(-b.hw, -b.hh, w, h);

    // Timber cross bands
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-b.hw + 2, -b.hh + 2, w - 4, 4);
    ctx.fillRect(-b.hw + 2, b.hh - 6, w - 4, 4);

    // Center white TNT label plate
    ctx.fillStyle = `rgba(254, 243, 199, ${pulse.toFixed(2)})`;
    ctx.fillRect(-b.hw + 4, -7, w - 8, 14);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, 0.5);
  } else if (b.kind === 'wood') {
    ctx.fillStyle = '#c88746';
    ctx.strokeStyle = '#6b3e17';
    ctx.lineWidth = 2;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.strokeRect(-b.hw, -b.hh, w, h);

    ctx.fillStyle = 'rgba(255, 224, 178, 0.25)';
    ctx.fillRect(-b.hw + 2, -b.hh + 2, w - 4, 3);
    ctx.strokeStyle = 'rgba(107, 62, 23, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (w >= h) {
      ctx.moveTo(-b.hw + 4, 0);
      ctx.lineTo(b.hw - 4, 0);
    } else {
      ctx.moveTo(0, -b.hh + 4);
      ctx.lineTo(0, b.hh - 4);
    }
    ctx.stroke();
  } else if (b.kind === 'stone') {
    ctx.fillStyle = '#7f8ea3';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.strokeRect(-b.hw, -b.hh, w, h);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.fillRect(-b.hw + 2, -b.hh + 2, w - 4, 3);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillRect(-b.hw + 2, b.hh - 5, w - 4, 3);
  } else {
    // Ice crystal block
    ctx.fillStyle = 'rgba(147, 224, 255, 0.7)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.strokeRect(-b.hw, -b.hh, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-b.hw + 4, -b.hh + 4);
    ctx.lineTo(b.hw - 4, Math.min(b.hh - 4, -b.hh + w * 0.45));
    ctx.stroke();
  }

  if (damaged && b.kind !== 'tnt') {
    ctx.strokeStyle =
      b.kind === 'ice' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(20, 20, 20, 0.68)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-b.hw * 0.45, -b.hh * 0.3);
    ctx.lineTo(0, 0);
    ctx.lineTo(b.hw * 0.35, b.hh * 0.4);
    ctx.moveTo(0, 0);
    ctx.lineTo(b.hw * 0.3, -b.hh * 0.45);
    ctx.stroke();
  }

  if (b.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(b.hitFlash * 0.48).toFixed(3)})`;
    ctx.fillRect(-b.hw, -b.hh, w, h);
  }

  ctx.restore();
}

export function computeSlingshotViewport(
  cssW: number,
  cssH: number,
  camera?: { focusX: number; focusY: number; zoom: number }
): CameraTransform {
  const safeW = Math.max(1, cssW);
  const safeH = Math.max(1, cssH);
  const baseScale = Math.min(safeW / WORLD_W, safeH / WORLD_H);
  const zoom = camera?.zoom ?? 1;
  const scale = baseScale * zoom;

  if (!camera || Math.abs(zoom - 1) < 0.005) {
    const offsetX = (safeW - WORLD_W * scale) * 0.5;
    const offsetY = (safeH - WORLD_H * scale) * 0.72;
    return { scale, offsetX, offsetY };
  }

  const desiredOffsetX = safeW * 0.5 - camera.focusX * scale;
  const desiredOffsetY = safeH * 0.56 - camera.focusY * scale;

  const minOffsetX = safeW - (WORLD_W + 120) * scale;
  const maxOffsetX = 120 * scale;
  const minOffsetY = safeH - (WORLD_H + 55) * scale;
  const maxOffsetY = 95 * scale;

  return {
    scale,
    offsetX: Math.min(maxOffsetX, Math.max(minOffsetX, desiredOffsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(minOffsetY, desiredOffsetY)),
  };
}

function renderPopups(ctx: CanvasRenderingContext2D, popups: FloatingPopup[]) {
  if (popups.length === 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < popups.length; i++) {
    const p = popups[i];
    const t = p.life / p.maxLife;
    const alpha = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
    if (alpha <= 0.02) continue;
    ctx.globalAlpha = alpha;
    const fontSize = Math.round(16 * p.scale);
    ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
}

export function renderSlingshotScene(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  state: SlingshotVisualState
) {
  const { scale, offsetX, offsetY } = computeSlingshotViewport(
    cssW,
    cssH,
    state.camera
  );

  const visLeft = (-offsetX) / scale;
  const visRight = (cssW - offsetX) / scale;
  const visTop = (-offsetY) / scale;
  const visBottom = (cssH - offsetY) / scale;

  if (
    visLeft < -CACHE_PAD_X ||
    visRight > WORLD_W + CACHE_PAD_X ||
    visBottom > WORLD_H + 255
  ) {
    ctx.fillStyle = state.atmosphereHint === 2 ? '#0d132b' : '#1e4e96';
    ctx.fillRect(0, 0, cssW, cssH);
  }

  ctx.save();
  const shakeX =
    state.shakeMagnitude > 0.1
      ? Math.sin(state.timeSec * 65) * state.shakeMagnitude
      : 0;
  const shakeY =
    state.shakeMagnitude > 0.1
      ? Math.cos(state.timeSec * 58) * state.shakeMagnitude * 0.7
      : 0;
  ctx.translate(offsetX + shakeX, offsetY + shakeY);
  ctx.scale(scale, scale);

  renderBackdrop(
    ctx,
    state.timeSec,
    state.atmosphereHint ?? 0,
    visLeft,
    visTop,
    visRight,
    Boolean(state.fastRender)
  );
  renderGroundImpacts(
    ctx,
    state.groundDivots,
    state.shockwaves,
    state.scorches,
    state.windFactor,
    state.timeSec
  );

  // Stacked bird quiver nestled on wooden perch behind slingshot
  const visibleWaiters = state.infiniteBirds
    ? Math.min(3, state.quiverTypes.length)
    : Math.max(0, state.quiverCount - (state.birdInSling ? 1 : 0));
  const quiverSlots = [
    { x: 162, y: GROUND_Y - 24 },
    { x: 120, y: GROUND_Y - 24 },
    { x: 141, y: GROUND_Y - 50 },
  ];
  for (let q = 0; q < Math.min(3, visibleWaiters); q++) {
    const slot = quiverSlots[q];
    const hop = Math.abs(Math.sin(state.timeSec * 2.8 + q * 1.3)) * 3.5;
    const waiterType = state.quiverTypes[q] ?? state.activeBirdType;
    const r = waiterType === 'terence' ? 17 : waiterType === 'blues' ? 11.5 : 14;
    drawBirdSprite(ctx, slot.x, slot.y - hop, r, 0, waiterType, 1, {
      timeSec: state.timeSec,
    });
  }

  // Parabolic flight trail (zero string allocation)
  for (let i = 0; i < state.trailDots.length; i++) {
    const td = state.trailDots[i];
    ctx.globalAlpha = td.alpha;
    ctx.fillStyle = td.color ?? '#ffffff';
    ctx.beginPath();
    ctx.arc(td.x, td.y, td.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dotted analytic parabolic aim preview
  if (state.isAiming && state.birdInSling) {
    renderTrajectoryPreview(
      ctx,
      state.bird.x,
      state.bird.y,
      state.launchVx,
      state.launchVy,
      state.trajectoryDotCount,
      state.gravityScale,
      state.windFactor
    );
  }

  const stretchDist = Math.hypot(
    SLING_ANCHOR_X - state.pouchX,
    SLING_ANCHOR_Y - state.pouchY
  );

  renderSlingshotBack(ctx, state.pouchX, state.pouchY, stretchDist);

  if (state.towerAlpha < 0.999) {
    ctx.save();
    ctx.globalAlpha = state.towerAlpha;
    for (let i = 0; i < state.bodies.length; i++) {
      const body = state.bodies[i];
      if (!body.isActive || body === state.bird) continue;
      if (body.kind === 'bird') {
        drawBirdSprite(
          ctx,
          body.x,
          body.y,
          body.radius,
          body.angle,
          body.birdType ?? 'red',
          body.fadeAlpha,
          {
            timeSec: state.timeSec,
            dashActive: (body.dashTimer ?? 0) > 0,
            fuseTimer: body.fuseTimer,
            isHurt: body.hasStruck,
          }
        );
      } else {
        renderBlock(ctx, body, state.timeSec);
      }
    }
    ctx.restore();
  } else {
    for (let i = 0; i < state.bodies.length; i++) {
      const body = state.bodies[i];
      if (!body.isActive || body === state.bird) continue;
      if (body.kind === 'bird') {
        drawBirdSprite(
          ctx,
          body.x,
          body.y,
          body.radius,
          body.angle,
          body.birdType ?? 'red',
          body.fadeAlpha,
          {
            timeSec: state.timeSec,
            dashActive: (body.dashTimer ?? 0) > 0,
            fuseTimer: body.fuseTimer,
            isHurt: body.hasStruck,
          }
        );
      } else {
        renderBlock(ctx, body, state.timeSec);
      }
    }
  }

  // Hero bird (either perched in sling or in flight)
  if (state.birdInSling || state.bird.isActive) {
    drawBirdSprite(
      ctx,
      state.bird.x,
      state.bird.y,
      state.bird.radius,
      state.bird.angle,
      state.bird.birdType ?? state.activeBirdType,
      state.birdAlpha,
      {
        showAbilityRing: !state.birdInSling && !state.bird.abilityUsed && !state.bird.hasStruck,
        dashActive: (state.bird.dashTimer ?? 0) > 0,
        fuseTimer: state.bird.fuseTimer,
        timeSec: state.timeSec,
        isHurt: state.bird.hasStruck,
      }
    );
  }

  renderSlingshotFront(
    ctx,
    state.pouchX,
    state.pouchY,
    stretchDist,
    state.birdInSling
  );

  renderExplosions(ctx, state.explosions);

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    if (p.shape === 'feather') {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.75, p.size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'rect') {
      ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderDustClouds(ctx, state.dustClouds);
  renderPopups(ctx, state.popups);

  if (state.rapidReticle) {
    const { x, y } = state.rapidReticle;
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.86)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x - 7, y);
    ctx.moveTo(x + 7, y);
    ctx.lineTo(x + 18, y);
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x, y - 7);
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x, y + 18);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export function clientToWorldCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera?: { focusX: number; focusY: number; zoom: number }
): { x: number; y: number } {
  const cssW = rect.width || window.innerWidth;
  const cssH = rect.height || window.innerHeight;
  const { scale, offsetX, offsetY } = computeSlingshotViewport(
    cssW,
    cssH,
    camera
  );
  return {
    x: (clientX - rect.left - offsetX) / scale,
    y: (clientY - rect.top - offsetY) / scale,
  };
}
