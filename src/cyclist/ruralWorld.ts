export type BiomeMode = 'usa-tour' | 'mountains' | 'desert' | 'homes';

export interface RuralSceneMetrics {
  roadTopY: number;
  roadBottomY: number;
  bikeScale: number;
  bbX: number;
  bbY: number;
  wheelRadius: number;
  wheelCycles: number;
  crankCycles: number;
}

export interface BiomeWeights {
  mountains: number;
  desert: number;
  homes: number;
  activeLabel: 'Rocky Mountains' | 'Southwest Desert' | 'American Homes';
}

export function computeSceneMetrics(w: number, h: number): RuralSceneMetrics {
  const bikeScale = Math.max(0.75, Math.min(1.52, Math.min(w / 820, h / 500)));
  const wheelRadius = 45;
  const roadBottomY = h * 0.875;
  const roadTopY = h * 0.725;
  const tireContactY = h * 0.815;
  const bbY = tireContactY - 41 * bikeScale;
  const bbX = w * 0.44;

  return {
    roadTopY,
    roadBottomY,
    bikeScale,
    bbX,
    bbY,
    wheelRadius,
    wheelCycles: 36,
    crankCycles: 18,
  };
}

function smoothstep01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

export function computeBiomeWeights(
  tourProgress: number,
  biomeMode: BiomeMode
): BiomeWeights {
  if (biomeMode === 'mountains') {
    return { mountains: 1, desert: 0, homes: 0, activeLabel: 'Rocky Mountains' };
  }
  if (biomeMode === 'desert') {
    return { mountains: 0, desert: 1, homes: 0, activeLabel: 'Southwest Desert' };
  }
  if (biomeMode === 'homes') {
    return { mountains: 0, desert: 0, homes: 1, activeLabel: 'American Homes' };
  }

  // Continuous 3-stage loop: 0..1 Mountains -> 1..2 Desert -> 2..3 US Homes
  const p = ((tourProgress % 3) + 3) % 3;
  const fade = 0.28;
  let m = 0;
  let d = 0;
  let h = 0;

  if (p < 1) {
    if (p > 1 - fade) {
      const t = smoothstep01((p - (1 - fade)) / fade);
      m = 1 - t;
      d = t;
    } else {
      m = 1;
    }
  } else if (p < 2) {
    if (p > 2 - fade) {
      const t = smoothstep01((p - (2 - fade)) / fade);
      d = 1 - t;
      h = t;
    } else {
      d = 1;
    }
  } else {
    if (p > 3 - fade) {
      const t = smoothstep01((p - (3 - fade)) / fade);
      h = 1 - t;
      m = t;
    } else {
      h = 1;
    }
  }

  const activeLabel =
    m >= d && m >= h
      ? 'Rocky Mountains'
      : d >= m && d >= h
        ? 'Southwest Desert'
        : 'American Homes';

  return { mountains: m, desert: d, homes: h, activeLabel };
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  w: BiomeWeights
): string {
  const r = Math.round(a[0] * w.mountains + b[0] * w.desert + c[0] * w.homes);
  const g = Math.round(a[1] * w.mountains + b[1] * w.desert + c[1] * w.homes);
  const bl = Math.round(a[2] * w.mountains + b[2] * w.desert + c[2] * w.homes);
  return `rgb(${r}, ${g}, ${bl})`;
}

let cachedSunHaloCanvas: HTMLCanvasElement | null = null;
let cachedCloudCanvas: HTMLCanvasElement | null = null;

function getSunHaloSprite(): HTMLCanvasElement {
  if (cachedSunHaloCanvas) return cachedSunHaloCanvas;
  const size = 384;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const cx = size * 0.5;
    const haloGrad = g.createRadialGradient(cx, cx, 4, cx, cx, cx);
    haloGrad.addColorStop(0, 'rgba(255, 250, 222, 0.98)');
    haloGrad.addColorStop(0.11, 'rgba(255, 214, 130, 0.66)');
    haloGrad.addColorStop(0.36, 'rgba(244, 118, 96, 0.28)');
    haloGrad.addColorStop(0.7, 'rgba(176, 62, 112, 0.09)');
    haloGrad.addColorStop(1, 'rgba(176, 62, 112, 0)');
    g.fillStyle = haloGrad;
    g.fillRect(0, 0, size, size);
  }
  cachedSunHaloCanvas = c;
  return c;
}

function getSunsetCloudSprite(): HTMLCanvasElement {
  if (cachedCloudCanvas) return cachedCloudCanvas;
  const size = 256;
  const r = size * 0.5;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(r, r * 1.12, r * 0.08, r, r, r);
    grad.addColorStop(0, 'rgba(255, 224, 152, 0.82)');
    grad.addColorStop(0.45, 'rgba(240, 126, 118, 0.52)');
    grad.addColorStop(0.78, 'rgba(118, 56, 116, 0.24)');
    grad.addColorStop(1, 'rgba(118, 56, 116, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
  }
  cachedCloudCanvas = c;
  return c;
}

function drawSkyAndSun(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  horizonY: number,
  weights: BiomeWeights
) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(
    0,
    mixRgb([25, 20, 69], [46, 22, 54], [28, 36, 84], weights)
  );
  skyGrad.addColorStop(
    0.28,
    mixRgb([77, 37, 99], [122, 46, 68], [86, 56, 118], weights)
  );
  skyGrad.addColorStop(
    0.58,
    mixRgb([181, 69, 102], [216, 94, 62], [198, 96, 110], weights)
  );
  skyGrad.addColorStop(
    0.82,
    mixRgb([240, 139, 83], [247, 152, 74], [244, 156, 98], weights)
  );
  skyGrad.addColorStop(
    1,
    mixRgb([255, 217, 130], [255, 212, 134], [255, 226, 156], weights)
  );
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY + 14);

  const stars: Array<[number, number, number]> = [
    [0.09, 0.06, 1.2],
    [0.21, 0.09, 1.0],
    [0.34, 0.04, 1.3],
    [0.48, 0.08, 0.9],
    [0.62, 0.05, 1.2],
    [0.86, 0.07, 1.1],
    [0.93, 0.11, 0.9],
  ];
  for (let i = 0; i < stars.length; i++) {
    const [sx, sy, sr] = stars[i];
    const twinkle = 0.45 + 0.45 * Math.sin(phase * Math.PI * 6 + i * 2.1);
    ctx.fillStyle = `rgba(255, 240, 225, ${twinkle.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sx * w, sy * horizonY, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const sunX = w * 0.76;
  const sunY = horizonY * (0.64 + weights.desert * 0.05);
  const haloR = Math.max(w, h) * 0.48;

  // Blit cached sun halo clipped cleanly above horizon
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizonY + 14);
  ctx.clip();
  ctx.drawImage(
    getSunHaloSprite(),
    sunX - haloR,
    sunY - haloR,
    haloR * 2,
    haloR * 2
  );

  ctx.globalCompositeOperation = 'lighter';
  const rayAngles = [-0.62, -0.35, -0.1, 0.16, 0.42];
  for (let i = 0; i < rayAngles.length; i++) {
    const ang = rayAngles[i];
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255, 210, 140, 0.055)';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-w * 0.65, -72);
    ctx.lineTo(-w * 0.65, 72);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const discR = Math.min(w, h) * 0.048;
  ctx.fillStyle = '#fff9df';
  ctx.beginPath();
  ctx.arc(sunX, sunY, discR, 0, Math.PI * 2);
  ctx.fill();

  const cloudPeriod = w * 1.45;
  const scrollX = phase * cloudPeriod;
  const clouds = [
    { x: 0.12, y: 0.14, rx: 160, ry: 22, alpha: 0.56 },
    { x: 0.42, y: 0.1, rx: 195, ry: 24, alpha: 0.5 },
    { x: 0.72, y: 0.21, rx: 150, ry: 19, alpha: 0.6 },
    { x: 1.0, y: 0.15, rx: 175, ry: 21, alpha: 0.52 },
  ];
  const cloudSprite = getSunsetCloudSprite();

  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    for (let copy = 0; copy < 2; copy++) {
      const cx =
        (((c.x * cloudPeriod - scrollX) % cloudPeriod + cloudPeriod) %
          cloudPeriod) -
        w * 0.22 +
        copy * cloudPeriod;
      if (cx < -320 || cx > w + 320) continue;
      const cy = c.y * h;

      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(cloudSprite, cx - c.rx, cy - c.ry, c.rx * 2, c.ry * 2);
      ctx.restore();
    }
  }
}

function drawRockyMountainsLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  roadTopY: number,
  phase: number,
  roadTravel: number,
  alpha: number
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const waterTopY = horizonY - 2;
  const waterBottomY = roadTopY - 24;

  const alpinePeriod = Math.max(w * 1.15, 0.09 * roadTravel);
  const alpineShift = (phase * alpinePeriod) % alpinePeriod;

  const peaks = [
    { u: 0.08, wFrac: 0.22, height: 86 },
    { u: 0.24, wFrac: 0.25, height: 112 },
    { u: 0.43, wFrac: 0.21, height: 78 },
    { u: 0.6, wFrac: 0.26, height: 120 },
    { u: 0.8, wFrac: 0.23, height: 96 },
    { u: 0.94, wFrac: 0.2, height: 74 },
  ];

  for (let i = 0; i < peaks.length; i++) {
    const pk = peaks[i];
    for (let copy = -1; copy <= 1; copy++) {
      const cx =
        (((pk.u * alpinePeriod - alpineShift) % alpinePeriod + alpinePeriod) %
          alpinePeriod) +
        copy * alpinePeriod;
      const halfW = pk.wFrac * alpinePeriod * 0.52;
      if (cx + halfW < -40 || cx - halfW > w + 40) continue;

      const peakY = waterTopY - pk.height;
      const baseY = waterTopY + 10;

      ctx.fillStyle = '#3a2d5e';
      ctx.beginPath();
      ctx.moveTo(cx - halfW, baseY);
      ctx.lineTo(cx, peakY);
      ctx.lineTo(cx + halfW * 0.14, baseY);
      ctx.closePath();
      ctx.fill();

      const litGrad = ctx.createLinearGradient(cx, peakY, cx + halfW, baseY);
      litGrad.addColorStop(0, '#ffa984');
      litGrad.addColorStop(0.45, '#a85a7c');
      litGrad.addColorStop(1, '#583f6c');
      ctx.fillStyle = litGrad;
      ctx.beginPath();
      ctx.moveTo(cx, peakY);
      ctx.lineTo(cx + halfW, baseY);
      ctx.lineTo(cx + halfW * 0.12, baseY);
      ctx.closePath();
      ctx.fill();

      const snowDepth = pk.height * 0.36;
      ctx.fillStyle = 'rgba(255, 224, 210, 0.85)';
      ctx.beginPath();
      ctx.moveTo(cx, peakY);
      ctx.lineTo(cx + halfW * 0.36, peakY + snowDepth);
      ctx.lineTo(cx + halfW * 0.16, peakY + snowDepth * 0.85);
      ctx.lineTo(cx + halfW * 0.04, peakY + snowDepth * 1.05);
      ctx.lineTo(cx - halfW * 0.18, peakY + snowDepth * 0.82);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Valley lake
  const waterGrad = ctx.createLinearGradient(0, waterTopY, 0, waterBottomY);
  waterGrad.addColorStop(0, '#4f467a');
  waterGrad.addColorStop(0.35, '#2b6a82');
  waterGrad.addColorStop(1, '#1d5366');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, waterTopY, w, waterBottomY - waterTopY + 14);

  // Alpine timber lakeside lodges along the far shore
  const lodgePeriod = Math.max(w * 1.15, 0.14 * roadTravel);
  const lodgeShift = (phase * lodgePeriod) % lodgePeriod;
  for (let i = 0; i < 3; i++) {
    const u = (i * 0.33 + 0.16) % 1;
    for (let copy = -1; copy <= 1; copy++) {
      const lx =
        (((u * lodgePeriod - lodgeShift) % lodgePeriod + lodgePeriod) %
          lodgePeriod) +
        copy * lodgePeriod;
      if (lx < -40 || lx > w + 40) continue;
      const ly = waterTopY + 2;
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(lx - 13, ly - 11, 26, 11);
      ctx.fillStyle = '#281815';
      ctx.beginPath();
      ctx.moveTo(lx - 17, ly - 11);
      ctx.lineTo(lx, ly - 22);
      ctx.lineTo(lx + 17, ly - 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(lx - 7, ly - 8, 5, 5);
      ctx.fillRect(lx + 2, ly - 8, 5, 5);
    }
  }

  const sunX = w * 0.76;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let r = 0; r < 10; r++) {
    const t = r / 9;
    const ry = waterTopY + 3 + t * Math.max(8, waterBottomY - waterTopY - 4);
    const shimmer = Math.sin(phase * Math.PI * 16 + r * 1.9);
    const rw = (22 + t * 55) * (0.7 + 0.3 * shimmer);
    const rx =
      sunX + Math.sin(phase * Math.PI * 8 + r * 2.4) * (10 + t * 22) - rw * 0.5;
    ctx.fillStyle = `rgba(255, 206, 118, ${(0.22 + (1 - t) * 0.25).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(rx + rw * 0.5, ry, rw * 0.5, 1.3 + t * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Mid-ground emerald-pine ridge
  const midCycles = 2;
  const midPeriod = (0.26 * roadTravel) / midCycles;
  const midShift = (phase * midCycles * midPeriod) % midPeriod;
  const step = 12;

  const sampleMidY = (screenX: number) => {
    const wx = screenX + midShift;
    const norm = (wx / midPeriod) * Math.PI * 2;
    const hill =
      Math.sin(norm + 0.5) * 16 +
      Math.cos(norm * 2 - 0.4) * 9 +
      Math.sin(norm * 3 + 1.8) * 4;
    return waterBottomY + 6 - hill;
  };

  ctx.beginPath();
  ctx.moveTo(0, roadTopY);
  for (let x = 0; x <= w + step; x += step) {
    ctx.lineTo(x, sampleMidY(x));
  }
  ctx.lineTo(w + step, roadTopY);
  ctx.closePath();
  const midGrad = ctx.createLinearGradient(0, waterBottomY - 18, 0, roadTopY);
  midGrad.addColorStop(0, '#2c5a4a');
  midGrad.addColorStop(0.55, '#224739');
  midGrad.addColorStop(1, '#19352a');
  ctx.fillStyle = midGrad;
  ctx.fill();

  const pineSpacing = midPeriod / 7;
  const firstPine = Math.floor(midShift / pineSpacing) - 1;
  const pineCount = Math.ceil(w / pineSpacing) + 3;
  for (let i = 0; i <= pineCount; i++) {
    const idx = firstPine + i;
    const px = idx * pineSpacing - midShift;
    if (px < -30 || px > w + 30) continue;
    const py = sampleMidY(px) + 3;
    const hScale = 0.85 + ((Math.abs(idx) * 13) % 5) * 0.14;
    const treeH = 22 * hScale;

    ctx.fillStyle = '#18362a';
    ctx.beginPath();
    ctx.moveTo(px, py - treeH);
    ctx.lineTo(px + 6.5 * hScale, py - treeH * 0.35);
    ctx.lineTo(px - 6.5 * hScale, py - treeH * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(px, py - treeH * 0.72);
    ctx.lineTo(px + 9.2 * hScale, py + 2);
    ctx.lineTo(px - 9.2 * hScale, py + 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawSaguaroCactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  variant: number
) {
  const trunkW = Math.max(4.5, h * 0.14);
  ctx.save();
  ctx.fillStyle = '#2d4f32';
  ctx.strokeStyle = '#1e3822';
  ctx.lineWidth = 1.2;

  // Main rounded vertical trunk
  ctx.beginPath();
  ctx.roundRect(x - trunkW * 0.5, baseY - h, trunkW, h + 3, trunkW * 0.5);
  ctx.fill();

  // Left curved arm
  const leftY = baseY - h * (0.48 + (variant % 2) * 0.1);
  const armW = trunkW * 0.78;
  ctx.lineWidth = armW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2d4f32';
  ctx.beginPath();
  ctx.moveTo(x - trunkW * 0.25, leftY);
  ctx.quadraticCurveTo(x - h * 0.24, leftY + 2, x - h * 0.24, leftY - h * 0.26);
  ctx.stroke();

  // Right curved arm
  if (variant % 3 !== 0) {
    const rightY = baseY - h * (0.62 - (variant % 2) * 0.08);
    ctx.beginPath();
    ctx.moveTo(x + trunkW * 0.25, rightY);
    ctx.quadraticCurveTo(x + h * 0.22, rightY + 2, x + h * 0.22, rightY - h * 0.22);
    ctx.stroke();
  }

  // Warm sunset rim highlight on sunward right side
  ctx.strokeStyle = 'rgba(244, 198, 128, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + trunkW * 0.35, baseY - h + 4);
  ctx.lineTo(x + trunkW * 0.35, baseY - 2);
  ctx.stroke();

  ctx.restore();
}

function drawSouthwestDesertLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  roadTopY: number,
  phase: number,
  roadTravel: number,
  alpha: number
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const baseHorizonY = horizonY + 8;

  // 1. Distant Monument Valley Red-Rock Mesas & Stepped Buttes (0.09x parallax)
  const mesaPeriod = Math.max(w * 1.15, 0.09 * roadTravel);
  const mesaShift = (phase * mesaPeriod) % mesaPeriod;
  const mesas = [
    { u: 0.11, topW: 54, botW: 112, h: 78 },
    { u: 0.29, topW: 96, botW: 168, h: 96 },
    { u: 0.51, topW: 38, botW: 84, h: 108 },
    { u: 0.72, topW: 118, botW: 196, h: 86 },
    { u: 0.9, topW: 48, botW: 102, h: 72 },
  ];

  for (let i = 0; i < mesas.length; i++) {
    const m = mesas[i];
    for (let copy = -1; copy <= 1; copy++) {
      const cx =
        (((m.u * mesaPeriod - mesaShift) % mesaPeriod + mesaPeriod) % mesaPeriod) +
        copy * mesaPeriod;
      if (cx + m.botW < -40 || cx - m.botW > w + 40) continue;

      const topY = baseHorizonY - m.h;
      // Shadowed left cliff face
      ctx.fillStyle = '#6f2928';
      ctx.beginPath();
      ctx.moveTo(cx - m.botW * 0.5, baseHorizonY + 12);
      ctx.lineTo(cx - m.topW * 0.56, topY + m.h * 0.38);
      ctx.lineTo(cx - m.topW * 0.42, topY);
      ctx.lineTo(cx + m.topW * 0.06, topY);
      ctx.lineTo(cx + m.botW * 0.08, baseHorizonY + 12);
      ctx.closePath();
      ctx.fill();

      // Sun-drenched terracotta right cliff face
      const cliffGrad = ctx.createLinearGradient(cx, topY, cx + m.botW * 0.5, baseHorizonY);
      cliffGrad.addColorStop(0, '#ec8e58');
      cliffGrad.addColorStop(0.45, '#bd4e37');
      cliffGrad.addColorStop(1, '#7c3028');
      ctx.fillStyle = cliffGrad;
      ctx.beginPath();
      ctx.moveTo(cx + m.topW * 0.04, topY);
      ctx.lineTo(cx + m.topW * 0.48, topY);
      ctx.lineTo(cx + m.topW * 0.62, topY + m.h * 0.42);
      ctx.lineTo(cx + m.botW * 0.5, baseHorizonY + 12);
      ctx.lineTo(cx + m.botW * 0.06, baseHorizonY + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Sculpted Southwest Red-Rock Sandstone Arch on horizon
  const archX =
    (((0.62 * mesaPeriod - mesaShift) % mesaPeriod + mesaPeriod) % mesaPeriod);
  if (archX > -120 && archX < w + 120) {
    const ay = baseHorizonY + 10;
    ctx.fillStyle = '#8b372c';
    ctx.beginPath();
    ctx.moveTo(archX - 58, ay);
    ctx.quadraticCurveTo(archX - 42, ay - 74, archX, ay - 78);
    ctx.quadraticCurveTo(archX + 42, ay - 74, archX + 58, ay);
    ctx.lineTo(archX + 32, ay);
    ctx.quadraticCurveTo(archX + 20, ay - 46, archX, ay - 48);
    ctx.quadraticCurveTo(archX - 20, ay - 46, archX - 32, ay);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(244, 168, 108, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(archX, ay - 78);
    ctx.quadraticCurveTo(archX + 42, ay - 74, archX + 58, ay);
    ctx.stroke();
  }

  // 2. Warm Sandstone Desert Basin & Rolling Terracotta Dunes (0.26x parallax)
  const basinGrad = ctx.createLinearGradient(0, baseHorizonY, 0, roadTopY);
  basinGrad.addColorStop(0, '#a34a36');
  basinGrad.addColorStop(0.5, '#c46a3e');
  basinGrad.addColorStop(1, '#8c4b2c');
  ctx.fillStyle = basinGrad;
  ctx.fillRect(0, baseHorizonY, w, roadTopY - baseHorizonY + 4);

  const duneCycles = 2;
  const dunePeriod = (0.26 * roadTravel) / duneCycles;
  const duneShift = (phase * duneCycles * dunePeriod) % dunePeriod;
  const step = 14;
  const sampleDuneY = (sx: number) => {
    const wx = sx + duneShift;
    const norm = (wx / dunePeriod) * Math.PI * 2;
    return (
      roadTopY -
      22 -
      (Math.sin(norm + 0.9) * 11 + Math.cos(norm * 2 - 0.3) * 6)
    );
  };

  ctx.beginPath();
  ctx.moveTo(0, roadTopY + 4);
  for (let x = 0; x <= w + step; x += step) {
    ctx.lineTo(x, sampleDuneY(x));
  }
  ctx.lineTo(w + step, roadTopY + 4);
  ctx.closePath();
  const duneGrad = ctx.createLinearGradient(0, roadTopY - 38, 0, roadTopY + 4);
  duneGrad.addColorStop(0, '#c67342');
  duneGrad.addColorStop(0.6, '#9d532f');
  duneGrad.addColorStop(1, '#6f3922');
  ctx.fillStyle = duneGrad;
  ctx.fill();

  // 3. Roadside Saguaro Cacti & Desert Sagebrush (0.52x parallax)
  const cactusCycles = 8;
  const cactusPeriod = (0.52 * roadTravel) / cactusCycles;
  const cactusShift = (phase * cactusCycles * cactusPeriod) % cactusPeriod;
  const firstIdx = Math.floor(cactusShift / cactusPeriod) - 1;
  const count = Math.ceil(w / cactusPeriod) + 3;

  for (let i = 0; i <= count; i++) {
    const idx = firstIdx + i;
    const cx = idx * cactusPeriod - cactusShift;
    if (cx < -50 || cx > w + 50) continue;
    const baseY = roadTopY - 6;
    const h = 38 + ((Math.abs(idx) * 17) % 4) * 11;
    drawSaguaroCactus(ctx, cx, baseY, h, Math.abs(idx));

    // Rounded desert sage clump beside cactus
    ctx.fillStyle = '#5c6b3a';
    ctx.beginPath();
    ctx.ellipse(cx + cactusPeriod * 0.42, roadTopY - 4, 11, 5.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawAmericanHome(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  styleIdx: number
) {
  const palettes = [
    { wall: '#e2dcd1', roof: '#475569', trim: '#f8fafc', door: '#b45309' }, // Craftsman cream
    { wall: '#89a3b2', roof: '#334155', trim: '#f8fafc', door: '#991b1b' }, // Colonial slate-blue
    { wall: '#a84737', roof: '#3f2e26', trim: '#f5ebe0', door: '#78350f' }, // Heartland barnhouse
    { wall: '#8fa387', roof: '#374151', trim: '#fafaf9', door: '#b45309' }, // Sage suburban
  ];
  const pal = palettes[styleIdx % palettes.length];
  const houseW = 84 + (styleIdx % 3) * 10;
  const wallH = 38 + (styleIdx % 2) * 5;
  const roofH = 26 + (styleIdx % 2) * 4;
  const left = cx - houseW * 0.5;
  const wallTop = groundY - wallH;

  ctx.save();

  // Brick chimney rising past pitched roof
  ctx.fillStyle = '#7c3329';
  ctx.fillRect(cx + houseW * 0.22, wallTop - roofH * 0.92, 10, 22);

  // Leafy backyard shade tree tucked cleanly behind/beside house
  const treeX = left - 18;
  ctx.fillStyle = '#3b281c';
  ctx.fillRect(treeX - 3, groundY - 30, 6, 30);
  ctx.fillStyle = '#385e31';
  ctx.beginPath();
  ctx.arc(treeX, groundY - 40, 19, 0, Math.PI * 2);
  ctx.arc(treeX - 11, groundY - 32, 13, 0, Math.PI * 2);
  ctx.arc(treeX + 11, groundY - 33, 12, 0, Math.PI * 2);
  ctx.fill();

  // Main house siding wall
  ctx.fillStyle = pal.wall;
  ctx.fillRect(left, wallTop, houseW, wallH);

  // Shaded side porch overhang + slender white porch columns
  ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.fillRect(left + 4, wallTop + 14, houseW * 0.42, wallH - 14);
  ctx.fillStyle = pal.roof;
  ctx.beginPath();
  ctx.moveTo(left - 4, wallTop + 15);
  ctx.lineTo(left + houseW * 0.48, wallTop + 15);
  ctx.lineTo(left + houseW * 0.44, wallTop + 8);
  ctx.lineTo(left + 2, wallTop + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.trim;
  ctx.fillRect(left + 6, wallTop + 15, 2.5, wallH - 15);
  ctx.fillRect(left + houseW * 0.41, wallTop + 15, 2.5, wallH - 15);

  // Steep pitched gable roof + crisp fascia trim
  ctx.fillStyle = pal.roof;
  ctx.beginPath();
  ctx.moveTo(left - 7, wallTop + 2);
  ctx.lineTo(cx, wallTop - roofH);
  ctx.lineTo(left + houseW + 7, wallTop + 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left - 7, wallTop + 2);
  ctx.lineTo(cx, wallTop - roofH);
  ctx.lineTo(left + houseW + 7, wallTop + 2);
  ctx.stroke();

  // Front door + warm sunlit twilight windows with window panes
  const doorX = left + houseW * 0.2;
  ctx.fillStyle = pal.door;
  ctx.beginPath();
  ctx.roundRect(doorX, groundY - 20, 10, 20, [2, 2, 0, 0]);
  ctx.fill();

  const winPositions = [
    { x: left + houseW * 0.56, y: wallTop + 11, w: 13, h: 14 },
    { x: left + houseW * 0.77, y: wallTop + 11, w: 13, h: 14 },
  ];
  for (const win of winPositions) {
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(win.x, win.y, win.w, win.h);
    ctx.beginPath();
    ctx.moveTo(win.x + win.w * 0.5, win.y);
    ctx.lineTo(win.x + win.w * 0.5, win.y + win.h);
    ctx.moveTo(win.x, win.y + win.h * 0.5);
    ctx.lineTo(win.x + win.w, win.y + win.h * 0.5);
    ctx.stroke();
  }

  // Attic gable circular window
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx, wallTop - roofH * 0.42, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Roadside American curved mailbox beside driveway
  const mailX = left + houseW + 16;
  ctx.fillStyle = '#475569';
  ctx.fillRect(mailX - 1.2, groundY - 14, 2.4, 14);
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(mailX - 4.5, groundY - 18, 9, 5.5, [3, 3, 0, 0]);
  ctx.fill();

  ctx.restore();
}

function drawAmericanHomesLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  roadTopY: number,
  phase: number,
  roadTravel: number,
  alpha: number
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Distant rolling golden-green heartland hills (0.14x parallax)
  const hillPeriod = Math.max(w * 1.1, 0.14 * roadTravel);
  const hillShift = (phase * hillPeriod) % hillPeriod;
  const step = 14;
  ctx.beginPath();
  ctx.moveTo(0, roadTopY);
  for (let x = 0; x <= w + step; x += step) {
    const norm = ((x + hillShift) / hillPeriod) * Math.PI * 2;
    const hy = horizonY + 12 - (Math.sin(norm) * 18 + Math.cos(norm * 2) * 9);
    ctx.lineTo(x, hy);
  }
  ctx.lineTo(w + step, roadTopY);
  ctx.closePath();
  const hillGrad = ctx.createLinearGradient(0, horizonY - 10, 0, roadTopY);
  hillGrad.addColorStop(0, '#446841');
  hillGrad.addColorStop(0.55, '#355732');
  hillGrad.addColorStop(1, '#264223');
  ctx.fillStyle = hillGrad;
  ctx.fill();

  // Midground American suburban/heartland homes along the tree-lined road (0.52x parallax)
  const homeCycles = 4;
  const homePeriod = (0.52 * roadTravel) / homeCycles;
  const homeShift = (phase * homeCycles * homePeriod) % homePeriod;
  const firstIdx = Math.floor(homeShift / homePeriod) - 1;
  const count = Math.ceil(w / homePeriod) + 3;

  // Front yard grassy berm
  ctx.fillStyle = '#476e33';
  ctx.fillRect(0, roadTopY - 16, w, 16);

  for (let i = 0; i <= count; i++) {
    const idx = firstIdx + i;
    const hx = idx * homePeriod - homeShift;
    if (hx < -160 || hx > w + 160) continue;
    drawAmericanHome(ctx, hx, roadTopY - 7, Math.abs(idx));

    // Warm neighborhood twilight streetlamp beside every yard
    const lampX = hx - homePeriod * 0.44;
    const lampBaseY = roadTopY - 6;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(lampX, lampBaseY);
    ctx.lineTo(lampX, lampBaseY - 46);
    ctx.lineTo(lampX + 7, lampBaseY - 48);
    ctx.stroke();

    ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
    ctx.beginPath();
    ctx.arc(lampX + 7, lampBaseY - 46, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(lampX + 7, lampBaseY - 46, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSharedNearVergeAndFence(
  ctx: CanvasRenderingContext2D,
  w: number,
  roadTopY: number,
  phase: number,
  roadTravel: number,
  weights: BiomeWeights
) {
  // Subtle foreground hill verge blending lush grass (Mountains/Homes) and warm sand (Desert)
  const nearCycles = 16;
  const nearPeriod = (0.52 * roadTravel) / nearCycles;
  const nearShift = (phase * nearCycles * nearPeriod) % nearPeriod;
  const ridgePeriod = (0.52 * roadTravel) / 2;
  const ridgeShift = (phase * 2 * ridgePeriod) % ridgePeriod;
  const step = 12;

  const sampleNearY = (screenX: number) => {
    const wx = screenX + ridgeShift;
    const norm = (wx / ridgePeriod) * Math.PI * 2;
    const slope = Math.sin(norm + 1.4) * 6 + Math.cos(norm * 2) * 3;
    return roadTopY - 11 - slope * (1 - weights.homes * 0.65);
  };

  ctx.beginPath();
  ctx.moveTo(0, roadTopY + 4);
  for (let x = 0; x <= w + step; x += step) {
    ctx.lineTo(x, sampleNearY(x));
  }
  ctx.lineTo(w + step, roadTopY + 4);
  ctx.closePath();

  const nearGrad = ctx.createLinearGradient(0, roadTopY - 22, 0, roadTopY + 4);
  nearGrad.addColorStop(
    0,
    mixRgb([90, 131, 59], [186, 114, 62], [88, 134, 62], weights)
  );
  nearGrad.addColorStop(
    1,
    mixRgb([49, 79, 32], [116, 68, 38], [52, 86, 36], weights)
  );
  ctx.fillStyle = nearGrad;
  ctx.fill();

  // Split-rail fence in Mountains & Homes; low rustic wooden guard posts in Desert
  const fenceAlpha = Math.max(0.25, weights.mountains + weights.homes * 0.85);
  const fenceY = roadTopY - 7;
  ctx.save();
  ctx.globalAlpha = fenceAlpha;
  ctx.strokeStyle = weights.homes > 0.5 ? '#cbd5e1' : '#5a4132';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(0, fenceY - 5);
  ctx.lineTo(w, fenceY - 5);
  ctx.moveTo(0, fenceY - 1);
  ctx.lineTo(w, fenceY - 1);
  ctx.stroke();

  const postCount = Math.ceil(w / nearPeriod) + 2;
  const firstPostIdx = Math.floor(nearShift / nearPeriod);
  for (let i = -1; i <= postCount; i++) {
    const idx = firstPostIdx + i;
    const px = idx * nearPeriod - nearShift;
    ctx.strokeStyle = weights.homes > 0.5 ? '#e2e8f0' : '#4e3729';
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, fenceY - 9);
    ctx.lineTo(px, fenceY + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawUtilityPoles(
  ctx: CanvasRenderingContext2D,
  w: number,
  roadTopY: number,
  phase: number,
  roadTravel: number,
  bikeScale: number
) {
  const poleCycles = 24;
  const poleSpacing = (0.8 * roadTravel) / poleCycles;
  const poleShift = (phase * poleCycles * poleSpacing) % poleSpacing;

  const poleBaseY = roadTopY + 2;
  const poleHeight = 124 * Math.max(0.85, Math.min(1.22, bikeScale));
  const poleTopY = poleBaseY - poleHeight;
  const crossArmY = poleTopY + 14;

  const firstIdx = Math.floor(poleShift / poleSpacing) - 1;
  const visibleCount = Math.ceil(w / poleSpacing) + 3;

  const wireOffsets = [
    { dx: -13, dy: crossArmY },
    { dx: 13, dy: crossArmY },
    { dx: 0, dy: poleTopY + 4 },
  ];

  for (let wIdx = 0; wIdx < wireOffsets.length; wIdx++) {
    const off = wireOffsets[wIdx];
    ctx.strokeStyle =
      wIdx === 2 ? 'rgba(32, 26, 48, 0.45)' : 'rgba(28, 22, 42, 0.56)';
    ctx.lineWidth = wIdx === 2 ? 1.1 : 1.3;
    ctx.beginPath();
    for (let i = 0; i < visibleCount; i++) {
      const x1 = (firstIdx + i) * poleSpacing - poleShift + off.dx;
      const x2 = (firstIdx + i + 1) * poleSpacing - poleShift + off.dx;
      const midX = (x1 + x2) * 0.5;
      const sagY = off.dy + 17;
      if (i === 0) ctx.moveTo(x1, off.dy);
      ctx.quadraticCurveTo(midX, sagY, x2, off.dy);
    }
    ctx.stroke();
  }

  for (let i = 0; i <= visibleCount; i++) {
    const px = (firstIdx + i) * poleSpacing - poleShift;
    if (px < -40 || px > w + 40) continue;

    ctx.fillStyle = '#3b2b27';
    ctx.beginPath();
    ctx.moveTo(px - 4.0, poleBaseY);
    ctx.lineTo(px + 4.0, poleBaseY);
    ctx.lineTo(px + 2.4, poleTopY);
    ctx.lineTo(px - 2.4, poleTopY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 198, 126, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px + 3.4, poleBaseY);
    ctx.lineTo(px + 2.0, poleTopY);
    ctx.stroke();

    ctx.strokeStyle = '#31231f';
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 15, crossArmY);
    ctx.lineTo(px + 15, crossArmY);
    ctx.stroke();

    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(px - 8, crossArmY);
    ctx.lineTo(px, crossArmY + 9);
    ctx.lineTo(px + 8, crossArmY);
    ctx.stroke();

    ctx.fillStyle = '#89c4d4';
    ctx.beginPath();
    ctx.arc(px - 13, crossArmY - 1.5, 1.8, 0, Math.PI * 2);
    ctx.arc(px + 13, crossArmY - 1.5, 1.8, 0, Math.PI * 2);
    ctx.arc(px, poleTopY + 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStraightRuralRoad(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  metrics: RuralSceneMetrics,
  phase: number,
  roadTravel: number,
  weights: BiomeWeights,
  speedMultiplier: number
) {
  const { roadTopY, roadBottomY } = metrics;

  ctx.fillStyle = mixRgb([92, 77, 59], [164, 102, 62], [96, 86, 66], weights);
  ctx.fillRect(0, roadTopY - 5, w, 9);

  const roadGrad = ctx.createLinearGradient(0, roadTopY, 0, roadBottomY);
  roadGrad.addColorStop(0, '#3e3a4d');
  roadGrad.addColorStop(0.45, '#2e2d3d');
  roadGrad.addColorStop(1, '#222230');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, roadTopY, w, roadBottomY - roadTopY);

  ctx.fillStyle = 'rgba(255, 244, 234, 0.78)';
  ctx.fillRect(0, roadTopY + 5, w, 2.5);
  ctx.fillRect(0, roadBottomY - 9, w, 3.2);

  const dashCycles = metrics.wheelCycles * 2;
  const dashPeriod = roadTravel / dashCycles;
  const dashShift = (phase * dashCycles * dashPeriod) % dashPeriod;

  const centerLineY = roadTopY + (roadBottomY - roadTopY) * 0.44;
  const firstDash = Math.floor(dashShift / dashPeriod) - 1;
  const dashCount = Math.ceil(w / dashPeriod) + 3;

  // Stretch road centerline glow subtly at high overdrive speeds (> 4x)
  const blurLen = Math.max(0, (speedMultiplier - 3.5) * 3.5);
  for (let i = 0; i <= dashCount; i++) {
    const x = (firstDash + i) * dashPeriod - dashShift;

    ctx.fillStyle = '#f2be4c';
    ctx.beginPath();
    ctx.roundRect(x, centerLineY - 2.2, dashPeriod * 0.46 + blurLen, 4.4, 2.0);
    ctx.fill();
  }

  const nearVergeGrad = ctx.createLinearGradient(0, roadBottomY, 0, h);
  nearVergeGrad.addColorStop(
    0,
    mixRgb([79, 109, 49], [164, 96, 54], [76, 114, 52], weights)
  );
  nearVergeGrad.addColorStop(
    0.38,
    mixRgb([50, 74, 33], [116, 62, 36], [48, 76, 33], weights)
  );
  nearVergeGrad.addColorStop(
    1,
    mixRgb([26, 40, 18], [62, 34, 20], [26, 42, 18], weights)
  );
  ctx.fillStyle = nearVergeGrad;
  ctx.fillRect(0, roadBottomY, w, h - roadBottomY);

  for (let i = 0; i <= dashCount; i++) {
    const idx = firstDash + i;
    const x = idx * dashPeriod - dashShift;
    ctx.strokeStyle = weights.desert > 0.6 ? '#8b7339' : '#6b8e3e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 8, roadBottomY + 4);
    ctx.lineTo(x + 4, roadBottomY - 5);
    ctx.moveTo(x + 11, roadBottomY + 4);
    ctx.lineTo(x + 14, roadBottomY - 4);
    ctx.stroke();

    if (idx % 2 === 0 && weights.desert < 0.7) {
      ctx.fillStyle = idx % 4 === 0 ? '#ffd052' : '#f47b8c';
      ctx.beginPath();
      ctx.arc(x + 4, roadBottomY - 5, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawForegroundParallaxMist(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  roadTravel: number
) {
  const fgCycles = 36;
  const fgSpacing = (1.26 * roadTravel) / fgCycles;
  const fgShift = (phase * fgCycles * fgSpacing) % fgSpacing;

  const firstIdx = Math.floor(fgShift / fgSpacing) - 1;
  const count = Math.ceil(w / fgSpacing) + 3;

  ctx.save();
  for (let i = 0; i <= count; i++) {
    const x = (firstIdx + i) * fgSpacing - fgShift;
    const hScale = 1 + ((Math.abs(firstIdx + i) * 7) % 3) * 0.25;

    ctx.fillStyle = 'rgba(18, 24, 14, 0.65)';
    ctx.beginPath();
    ctx.moveTo(x - 4, h);
    ctx.quadraticCurveTo(x - 10, h - 22 * hScale, x - 16, h - 38 * hScale);
    ctx.quadraticCurveTo(x - 4, h - 20 * hScale, x + 2, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 6, h);
    ctx.quadraticCurveTo(x + 3, h - 18 * hScale, x - 2, h - 29 * hScale);
    ctx.quadraticCurveTo(x + 9, h - 16 * hScale, x + 12, h);
    ctx.closePath();
    ctx.fill();
  }

  const fgFade = ctx.createLinearGradient(0, h * 0.9, 0, h);
  fgFade.addColorStop(0, 'rgba(16, 14, 20, 0)');
  fgFade.addColorStop(1, 'rgba(12, 10, 16, 0.34)');
  ctx.fillStyle = fgFade;
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
  ctx.restore();
}

export function drawRuralEnvironment(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  metrics: RuralSceneMetrics,
  phase: number,
  tourProgress = 0,
  biomeMode: BiomeMode = 'usa-tour',
  speedMultiplier = 1.0
): { roadTravel: number; activeBiomeLabel: BiomeWeights['activeLabel'] } {
  const horizonY = metrics.roadTopY * 0.8;
  const roadTravel =
    metrics.wheelCycles * Math.PI * 2 * metrics.wheelRadius * metrics.bikeScale;
  const weights = computeBiomeWeights(tourProgress, biomeMode);

  drawSkyAndSun(ctx, w, h, phase, horizonY, weights);
  drawRockyMountainsLayer(
    ctx,
    w,
    horizonY,
    metrics.roadTopY,
    phase,
    roadTravel,
    weights.mountains
  );
  drawSouthwestDesertLayer(
    ctx,
    w,
    horizonY,
    metrics.roadTopY,
    phase,
    roadTravel,
    weights.desert
  );
  drawAmericanHomesLayer(
    ctx,
    w,
    horizonY,
    metrics.roadTopY,
    phase,
    roadTravel,
    weights.homes
  );
  drawSharedNearVergeAndFence(
    ctx,
    w,
    metrics.roadTopY,
    phase,
    roadTravel,
    weights
  );
  drawUtilityPoles(
    ctx,
    w,
    metrics.roadTopY,
    phase,
    roadTravel,
    metrics.bikeScale
  );
  drawStraightRuralRoad(
    ctx,
    w,
    h,
    metrics,
    phase,
    roadTravel,
    weights,
    speedMultiplier
  );

  return { roadTravel, activeBiomeLabel: weights.activeLabel };
}
