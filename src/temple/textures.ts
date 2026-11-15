import * as THREE from 'three';

export interface TempleTextures {
  stoneAlbedo: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  bridgeAlbedo: THREE.CanvasTexture;
  cliffAlbedo: THREE.CanvasTexture;
  waterfallMap: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  particleSprite: THREE.CanvasTexture;
  coinMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function seededNoise(x: number, y: number, seed = 1337): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function createTempleTextures(maxAnisotropy: number): TempleTextures {
  // 1. Carved Mossy Temple Sandstone (Albedo + Bump)
  const [stoneCanvas, sCtx] = makeCanvas(512, 512);
  const [bumpCanvas, bCtx] = makeCanvas(512, 512);

  sCtx.fillStyle = '#5a5547';
  sCtx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, 512, 512);

  // Subtle sandstone grain
  for (let i = 0; i < 4800; i++) {
    const x = seededNoise(i, 1, 11) * 512;
    const y = seededNoise(i, 2, 17) * 512;
    const sz = 1 + seededNoise(i, 3, 23) * 3.2;
    const v = seededNoise(i, 4, 29);
    sCtx.fillStyle = v > 0.5 ? 'rgba(135, 126, 102, 0.14)' : 'rgba(40, 38, 30, 0.16)';
    sCtx.fillRect(x, y, sz, sz);
    bCtx.fillStyle = v > 0.5 ? 'rgba(210, 210, 210, 0.14)' : 'rgba(60, 60, 60, 0.14)';
    bCtx.fillRect(x, y, sz, sz);
  }

  // Flagstone grid courses
  const rows = 4;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const cols = 3;
    const offset = (r % 2) * (512 / (cols * 2));
    const colW = 512 / cols;

    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const shade = Math.floor(82 + seededNoise(r * 7 + c, 9, 41) * 28);
      const warm = Math.floor(shade * 0.92);
      const cool = Math.floor(shade * 0.74);
      sCtx.fillStyle = `rgb(${shade}, ${warm}, ${cool})`;
      sCtx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);

      // Inner carved temple border trim
      sCtx.strokeStyle = 'rgba(205, 188, 140, 0.16)';
      sCtx.lineWidth = 2;
      sCtx.strokeRect(x + 12, y + 12, colW - 24, rowH - 24);

      bCtx.fillStyle = '#c4c4c4';
      bCtx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);
      bCtx.strokeStyle = '#404040';
      bCtx.lineWidth = 5;
      bCtx.strokeRect(x + 2, y + 2, colW - 4, rowH - 4);
    }
  }

  // Moss creeping along mortar joints
  for (let i = 0; i < 160; i++) {
    const onRow = Math.floor(seededNoise(i, 12, 73) * rows) * rowH;
    const mx = seededNoise(i, 13, 79) * 512;
    const rad = 5 + seededNoise(i, 14, 83) * 14;
    const grad = sCtx.createRadialGradient(mx, onRow, 1, mx, onRow, rad);
    grad.addColorStop(0, 'rgba(54, 96, 48, 0.72)');
    grad.addColorStop(0.65, 'rgba(42, 76, 38, 0.38)');
    grad.addColorStop(1, 'rgba(42, 76, 38, 0)');
    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.arc(mx, onRow, rad, 0, Math.PI * 2);
    sCtx.fill();
  }

  const stoneAlbedo = new THREE.CanvasTexture(stoneCanvas);
  stoneAlbedo.colorSpace = THREE.SRGBColorSpace;
  stoneAlbedo.wrapS = THREE.RepeatWrapping;
  stoneAlbedo.wrapT = THREE.RepeatWrapping;
  stoneAlbedo.anisotropy = maxAnisotropy;

  const stoneBump = new THREE.CanvasTexture(bumpCanvas);
  stoneBump.wrapS = THREE.RepeatWrapping;
  stoneBump.wrapT = THREE.RepeatWrapping;
  stoneBump.anisotropy = maxAnisotropy;

  // 2. Dark Wet Stone Bridge Texture
  const [bridgeCanvas, brCtx] = makeCanvas(512, 512);
  brCtx.fillStyle = '#3b423c';
  brCtx.fillRect(0, 0, 512, 512);
  const plankCount = 8;
  const plankH = 512 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const py = p * plankH;
    const g = Math.floor(58 + seededNoise(p, 5, 91) * 20);
    brCtx.fillStyle = `rgb(${g}, ${g + 5}, ${g - 2})`;
    brCtx.fillRect(4, py + 3, 504, plankH - 6);
    brCtx.fillStyle = 'rgba(22, 26, 22, 0.75)';
    brCtx.fillRect(0, py, 512, 4);
    // Wet moss edge
    const moss = brCtx.createLinearGradient(0, py, 96, py);
    moss.addColorStop(0, 'rgba(48, 92, 52, 0.55)');
    moss.addColorStop(1, 'rgba(48, 92, 52, 0)');
    brCtx.fillStyle = moss;
    brCtx.fillRect(0, py + 4, 96, plankH - 8);
  }
  const bridgeAlbedo = new THREE.CanvasTexture(bridgeCanvas);
  bridgeAlbedo.colorSpace = THREE.SRGBColorSpace;
  bridgeAlbedo.wrapS = THREE.RepeatWrapping;
  bridgeAlbedo.wrapT = THREE.RepeatWrapping;
  bridgeAlbedo.anisotropy = maxAnisotropy;

  // 3. Stratified Cliff Rock & Jungle Lichen
  const [cliffCanvas, clCtx] = makeCanvas(512, 512);
  clCtx.fillStyle = '#333b35';
  clCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 16) {
    const shade = 44 + Math.floor(seededNoise(y, 3, 101) * 28);
    clCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade - 4})`;
    clCtx.fillRect(0, y, 512, 14);
    clCtx.fillStyle = 'rgba(18, 22, 19, 0.45)';
    clCtx.fillRect(0, y + 13, 512, 3);
  }
  for (let i = 0; i < 240; i++) {
    const cx = seededNoise(i, 7, 113) * 512;
    const cy = seededNoise(i, 8, 127) * 512;
    const rx = 12 + seededNoise(i, 9, 131) * 34;
    const ry = 6 + seededNoise(i, 10, 137) * 14;
    clCtx.fillStyle =
      seededNoise(i, 11, 139) > 0.42
        ? 'rgba(43, 84, 46, 0.34)'
        : 'rgba(84, 80, 68, 0.25)';
    clCtx.beginPath();
    clCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    clCtx.fill();
  }
  const cliffAlbedo = new THREE.CanvasTexture(cliffCanvas);
  cliffAlbedo.colorSpace = THREE.SRGBColorSpace;
  cliffAlbedo.wrapS = THREE.RepeatWrapping;
  cliffAlbedo.wrapT = THREE.RepeatWrapping;
  cliffAlbedo.anisotropy = maxAnisotropy;

  // 4. Scrolling Waterfall Streak Map
  const [wfCanvas, wfCtx] = makeCanvas(256, 512);
  const wfBase = wfCtx.createLinearGradient(0, 0, 256, 0);
  wfBase.addColorStop(0, 'rgba(120, 200, 215, 0.15)');
  wfBase.addColorStop(0.22, 'rgba(175, 232, 240, 0.78)');
  wfBase.addColorStop(0.5, 'rgba(225, 250, 255, 0.92)');
  wfBase.addColorStop(0.78, 'rgba(175, 232, 240, 0.78)');
  wfBase.addColorStop(1, 'rgba(120, 200, 215, 0.15)');
  wfCtx.fillStyle = wfBase;
  wfCtx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 180; i++) {
    const sx = 14 + seededNoise(i, 1, 211) * 228;
    const sy = seededNoise(i, 2, 223) * 512;
    const sw = 2 + seededNoise(i, 3, 227) * 8;
    const sh = 32 + seededNoise(i, 4, 229) * 110;
    wfCtx.fillStyle = `rgba(255, 255, 255, ${0.18 + seededNoise(i, 5, 233) * 0.42})`;
    wfCtx.fillRect(sx, sy, sw, sh);
    if (sy + sh > 512) {
      wfCtx.fillRect(sx, sy - 512, sw, sh);
    }
  }

  const waterfallMap = new THREE.CanvasTexture(wfCanvas);
  waterfallMap.colorSpace = THREE.SRGBColorSpace;
  waterfallMap.wrapS = THREE.ClampToEdgeWrapping;
  waterfallMap.wrapT = THREE.RepeatWrapping;

  // 5. Bark / Vine Texture
  const [barkCanvas, bkCtx] = makeCanvas(128, 256);
  bkCtx.fillStyle = '#3b4c2c';
  bkCtx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 90; i++) {
    const bx = seededNoise(i, 1, 307) * 128;
    const by = seededNoise(i, 2, 311) * 256;
    bkCtx.fillStyle =
      seededNoise(i, 3, 313) > 0.5 ? 'rgba(84, 114, 52, 0.35)' : 'rgba(30, 38, 22, 0.4)';
    bkCtx.fillRect(bx, by, 3, 26);
  }
  const barkAlbedo = new THREE.CanvasTexture(barkCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = THREE.RepeatWrapping;
  barkAlbedo.wrapT = THREE.RepeatWrapping;

  // 6. Soft Radial Particle Sprite
  const [pCanvas, pCtx] = makeCanvas(64, 64);
  const pGrad = pCtx.createRadialGradient(32, 32, 1, 32, 32, 31);
  pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  pGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.72)');
  pGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.18)');
  pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);
  const particleSprite = new THREE.CanvasTexture(pCanvas);
  particleSprite.colorSpace = THREE.SRGBColorSpace;

  // 7. Temple Gold Coin Sunburst Face
  const [cCanvas, cCtx] = makeCanvas(128, 128);
  cCtx.fillStyle = '#e4a928';
  cCtx.fillRect(0, 0, 128, 128);
  const cGrad = cCtx.createRadialGradient(64, 64, 6, 64, 64, 58);
  cGrad.addColorStop(0, '#fff0a8');
  cGrad.addColorStop(0.55, '#eab22f');
  cGrad.addColorStop(1, '#9d680e');
  cCtx.fillStyle = cGrad;
  cCtx.beginPath();
  cCtx.arc(64, 64, 60, 0, Math.PI * 2);
  cCtx.fill();
  cCtx.strokeStyle = '#7b4d06';
  cCtx.lineWidth = 6;
  cCtx.beginPath();
  cCtx.arc(64, 64, 48, 0, Math.PI * 2);
  cCtx.stroke();
  // Carved glyph square
  cCtx.strokeStyle = '#fff3b8';
  cCtx.lineWidth = 4;
  cCtx.strokeRect(46, 46, 36, 36);
  const coinMap = new THREE.CanvasTexture(cCanvas);
  coinMap.colorSpace = THREE.SRGBColorSpace;

  return {
    stoneAlbedo,
    stoneBump,
    bridgeAlbedo,
    cliffAlbedo,
    waterfallMap,
    barkAlbedo,
    particleSprite,
    coinMap,
    dispose: () => {
      stoneAlbedo.dispose();
      stoneBump.dispose();
      bridgeAlbedo.dispose();
      cliffAlbedo.dispose();
      waterfallMap.dispose();
      barkAlbedo.dispose();
      particleSprite.dispose();
      coinMap.dispose();
    },
  };
}
