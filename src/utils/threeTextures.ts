import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  maxAniso = 4,
  repeat = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createWoodPlankTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#dc9553');
  grad.addColorStop(0.5, '#c47b3d');
  grad.addColorStop(1, '#9c5a27');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Wood grain streaks
  ctx.strokeStyle = 'rgba(72, 34, 12, 0.25)';
  ctx.lineWidth = 3;
  for (let y = 12; y < 256; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y - 5, 170, y + 6, 256, y - 2);
    ctx.stroke();
  }

  // Plank seams + wood knot
  ctx.fillStyle = 'rgba(66, 30, 10, 0.45)';
  ctx.fillRect(0, 126, 256, 4);
  ctx.beginPath();
  ctx.ellipse(92, 68, 18, 9, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Outer bevel & corner iron nails
  ctx.strokeStyle = '#6c3915';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);
  ctx.strokeStyle = 'rgba(255, 224, 180, 0.32)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 232, 232);

  ctx.fillStyle = '#3c2415';
  for (const [nx, ny] of [
    [22, 22],
    [234, 22],
    [22, 234],
    [234, 234],
  ]) {
    ctx.beginPath();
    ctx.arc(nx, ny, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeColorTex(c);
}

export function createIceCrystalTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#dff6ff');
  grad.addColorStop(0.55, '#92dbf8');
  grad.addColorStop(1, '#50b0de');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal ice specular sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(138, 14);
  ctx.lineTo(54, 184);
  ctx.lineTo(14, 150);
  ctx.closePath();
  ctx.fill();

  // Internal crystal fracture lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 200);
  ctx.lineTo(118, 126);
  ctx.lineTo(192, 146);
  ctx.moveTo(118, 126);
  ctx.lineTo(156, 52);
  ctx.stroke();

  ctx.strokeStyle = '#3b92c4';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 248);
  return finalizeColorTex(c);
}

export function createStoneBlockTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#b5bfca');
  grad.addColorStop(0.55, '#8c97a6');
  grad.addColorStop(1, '#667182');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Mortar ashlar seams
  ctx.fillStyle = 'rgba(30, 41, 59, 0.42)';
  ctx.fillRect(0, 84, 256, 4);
  ctx.fillRect(0, 172, 256, 4);
  ctx.fillRect(128, 0, 4, 84);
  ctx.fillRect(68, 84, 4, 88);
  ctx.fillRect(184, 84, 4, 88);
  ctx.fillRect(120, 172, 4, 84);

  // Mineral speckles
  for (let i = 0; i < 80; i++) {
    const sx = ((i * 73) % 240) + 8;
    const sy = ((i * 137) % 240) + 8;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)';
    ctx.fillRect(sx, sy, 4, 4);
  }

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 9;
  ctx.strokeRect(4.5, 4.5, 247, 247);
  return finalizeColorTex(c);
}

export function createTntCrateTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ef4444');
  grad.addColorStop(0.5, '#dc2626');
  grad.addColorStop(1, '#991b1b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Hazard wood framing
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 238, 238);

  // Center cream/amber label banner
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(24, 84, 208, 88);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 84, 208, 88);

  ctx.fillStyle = '#b91c1c';
  ctx.font = '900 72px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TNT', 128, 131);
  return finalizeColorTex(c);
}

export function createBouncerPadTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f472b6');
  grad.addColorStop(0.6, '#db2777');
  grad.addColorStop(1, '#9d174d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 76, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fdf2f8';
  ctx.beginPath();
  ctx.moveTo(128, 72);
  ctx.lineTo(166, 128);
  ctx.lineTo(142, 128);
  ctx.lineTo(142, 174);
  ctx.lineTo(114, 174);
  ctx.lineTo(114, 128);
  ctx.lineTo(90, 128);
  ctx.closePath();
  ctx.fill();
  return finalizeColorTex(c);
}

export function createBasketballTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#fb923c');
  grad.addColorStop(0.5, '#ea580c');
  grad.addColorStop(1, '#9a3412');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle leather pebbles
  for (let i = 0; i < 650; i++) {
    const px = (i * 97) % 512;
    const py = (i * 53) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(67, 20, 7, 0.22)' : 'rgba(255, 237, 213, 0.14)';
    ctx.fillRect(px, py, 2, 2);
  }

  // Crisp black equator & meridian seams
  ctx.strokeStyle = '#180c06';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(384, 0);
  ctx.lineTo(384, 256);
  ctx.stroke();

  // Curved side panels
  ctx.lineWidth = 5.5;
  for (const cx of [128, 384]) {
    ctx.beginPath();
    ctx.arc(cx - 102, 128, 92, -0.45 * Math.PI, 0.45 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 102, 128, 92, 0.55 * Math.PI, 1.45 * Math.PI);
    ctx.stroke();
  }
  return finalizeColorTex(c);
}

export function createSoftCloudTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.clearRect(0, 0, 256, 128);
  const puffs = [
    [76, 72, 46, 0.72],
    [126, 56, 54, 0.85],
    [176, 72, 44, 0.7],
    [104, 82, 40, 0.65],
    [152, 82, 38, 0.62],
  ];
  for (const [px, py, pr, pa] of puffs) {
    const g = ctx.createRadialGradient(px, py - pr * 0.18, pr * 0.1, px, py, pr);
    g.addColorStop(0, `rgba(255, 252, 246, ${pa})`);
    g.addColorStop(0.65, `rgba(255, 240, 224, ${pa * 0.48})`);
    g.addColorStop(1, 'rgba(255, 232, 210, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeColorTex(c);
}

export function createSunHaloTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
  g.addColorStop(0, 'rgba(255, 252, 228, 1.0)');
  g.addColorStop(0.22, 'rgba(255, 226, 150, 0.78)');
  g.addColorStop(0.52, 'rgba(251, 146, 60, 0.28)');
  g.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle soft radial light spokes
  ctx.save();
  ctx.translate(128, 128);
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    const rg = ctx.createLinearGradient(10, 0, 124, 0);
    rg.addColorStop(0, 'rgba(255, 244, 195, 0.24)');
    rg.addColorStop(1, 'rgba(255, 244, 195, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.lineTo(124, -18);
    ctx.lineTo(124, 18);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  return finalizeColorTex(c);
}

export function createChainLinkTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(32, 0);
  ctx.lineTo(64, 32);
  ctx.lineTo(32, 64);
  ctx.closePath();
  ctx.stroke();
  return finalizeColorTex(c, 4, true);
}

export interface JumbotronHandle {
  texture: THREE.CanvasTexture;
  update: (makes: number, clockSec: number, streak: number, alert: string, moving: boolean) => void;
  dispose: () => void;
}

export function createJumbotronTexture(): JumbotronHandle {
  const [c, ctx] = makeCanvas(512, 224);
  const texture = finalizeColorTex(c, 4, false);
  let lastKey = '';

  const update = (
    makes: number,
    clockSec: number,
    streak: number,
    alert: string,
    moving: boolean
  ) => {
    const secCeil = Math.max(0, Math.ceil(clockSec));
    const key = `${makes}|${secCeil}|${streak}|${alert}|${moving ? 1 : 0}`;
    if (key === lastKey) return;
    lastKey = key;

    // Frame & dark LED matrix background
    ctx.fillStyle = '#070c18';
    ctx.fillRect(0, 0, 512, 224);
    ctx.strokeStyle = moving ? '#f59e0b' : '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 216);

    // Subtle LED scanlines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = 8; y < 216; y += 8) {
      ctx.fillRect(10, y, 492, 2);
    }

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', 96, 40);
    ctx.fillText('SHOT CLOCK', 256, 40);
    ctx.fillText('STREAK', 416, 40);

    // Digital LED numerals
    ctx.font = '800 56px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(String(makes).padStart(2, '0'), 96, 102);

    ctx.fillStyle = secCeil <= 5 ? '#fb7185' : '#f8fafc';
    ctx.fillText(String(secCeil).padStart(2, '0'), 256, 102);

    ctx.fillStyle = streak >= 3 ? '#fb923c' : '#38bdf8';
    ctx.fillText(`${streak}x`, 416, 102);

    // Divider & ticker banner
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillRect(24, 134, 464, 2);

    ctx.fillStyle = streak >= 3 ? '#fef08a' : '#e2e8f0';
    ctx.font = '800 24px system-ui, sans-serif';
    const banner = alert || (moving ? 'TRACK MODE ACTIVE!' : 'ALL-STAR ARENA 3D');
    ctx.fillText(banner.slice(0, 26), 256, 178);

    texture.needsUpdate = true;
  };

  update(0, 24, 0, 'ALL-STAR ARENA 3D', false);
  return {
    texture,
    update,
    dispose: () => texture.dispose(),
  };
}

const popupTexCache = new Map<string, THREE.CanvasTexture>();

export function getFloatingPopupTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}|${color}`;
  const existing = popupTexCache.get(key);
  if (existing) return existing;

  if (popupTexCache.size >= 48) {
    const oldestKey = popupTexCache.keys().next().value;
    if (oldestKey) {
      popupTexCache.get(oldestKey)?.dispose();
      popupTexCache.delete(oldestKey);
    }
  }

  const [c, ctx] = makeCanvas(256, 80);
  ctx.clearRect(0, 0, 256, 80);
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeText(text, 128, 42);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 42);

  const tex = finalizeColorTex(c, 2, false);
  popupTexCache.set(key, tex);
  return tex;
}

export function createBasketballJerseyTexture(
  jerseyHex: string,
  trimHex: string,
  numberText = '23'
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = jerseyHex;
  ctx.fillRect(0, 0, 512, 256);

  // Side trim panels (CylinderGeometry UV: u=0/1 is +Z, u=0.25 is +X front, u=0.5 is -Z, u=0.75 is -X back)
  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 0, 26, 256);
  ctx.fillRect(486, 0, 26, 256);
  ctx.fillRect(230, 0, 52, 256);

  // Neckline & bottom hem trim
  ctx.fillRect(0, 0, 512, 22);
  ctx.fillRect(0, 236, 512, 20);

  // Crisp #23 on front (u=0.25 -> x=128) and back (u=0.75 -> x=384)
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = trimHex;
  ctx.lineWidth = 6;
  ctx.font = '900 108px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const cx of [128, 384]) {
    ctx.strokeText(numberText, cx, 134);
    ctx.fillText(numberText, cx, 134);
  }

  return finalizeColorTex(c, 4, false);
}

