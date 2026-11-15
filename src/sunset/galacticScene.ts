import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ALL_SOLAR_BODIES,
  auRadiusToScene,
  computeOrbitCurveScenePoints,
  eclipticAuToSceneXYZ,
  evaluateBodyAtDate,
  PLANET_ORDER,
  REAL_BODIES_META,
  type SolarBodyName,
  type SolarScaleMode,
} from './solarSystemEphemeris';

export type GalacticPhase = 'ocean' | 'touring' | 'orbiting' | 'returning';
export type OrbitPreset = 'earth' | 'solar';

export interface SolarBodyScreenLabel {
  name: SolarBodyName;
  x: number;
  y: number;
  visible: boolean;
  color: string;
  selected: boolean;
}

export interface GalacticStatus {
  phase: GalacticPhase;
  stageLabel: string;
  tourProgress: number; // 0..1
  oceanBlend: number; // 0 = full ocean, 1 = full 3D space
  selectedBody: SolarBodyName;
  scaleMode: SolarScaleMode;
  timeRate: number;
  simDateMs: number;
}

export interface GalacticSyncParams {
  moonPhaseFraction: number;
  sunPhaseDayFraction: number; // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=sunset
}

export interface GalacticController {
  startTour: () => void;
  pauseInOrbit: () => void;
  resumeTour: () => void;
  returnToOcean: () => void;
  setOrbitPreset: (preset: OrbitPreset) => void;
  setScaleMode: (mode: SolarScaleMode) => void;
  setTimeRate: (rateSecPerSec: number) => void;
  jumpToToday: () => void;
  focusBody: (name: SolarBodyName) => void;
  setEcoMode: (eco: boolean) => void;
  setShowBeltsAndGrid: (show: boolean) => void;
  setRenderProfile: (profile: { dpr: number; minFrameMs: number }) => void;
  syncParameters: (params: GalacticSyncParams) => void;
  dispose: () => void;
}

const TOUR_DURATION_SEC = 10.0;
const RETURN_DURATION_SEC = 2.0;
const EARTH_RADIUS = REAL_BODIES_META.Earth.showcaseRadius;
const BA_LAT_DEG = 36.0526;
const BA_LON_DEG = -95.7908;
const ORBIT_SEGMENTS = 144;

// Pre-allocated scratch vectors to ensure zero GC pressure in animation loop
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _earthPos = new THREE.Vector3();
const _focusPos = new THREE.Vector3();
const _baLocal = new THREE.Vector3();
const _baWorld = new THREE.Vector3();
const _baNormal = new THREE.Vector3();
const _toSun = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _colorTmp = new THREE.Color();

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Converts latitude/longitude (degrees) to exact Three.js SphereGeometry local XYZ.
 */
function latLonToSphereVec(latDeg: number, lonDeg: number, radius: number, out: THREE.Vector3): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(latDeg);
  const lonRad = THREE.MathUtils.degToRad(lonDeg);
  const phi = lonRad + Math.PI;
  const theta = Math.PI * 0.5 - latRad;
  const sinTheta = Math.sin(theta);
  out.set(
    -radius * Math.cos(phi) * sinTheta,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinTheta
  );
  return out;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createEarthTextures(maxAniso: number): {
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
} {
  const w = 1024;
  const h = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d')!;

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#102b52');
  oceanGrad.addColorStop(0.25, '#0b3569');
  oceanGrad.addColorStop(0.5, '#0e447d');
  oceanGrad.addColorStop(0.75, '#0b3569');
  oceanGrad.addColorStop(1, '#102b52');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#383838';
  rCtx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = 'rgba(26, 98, 148, 0.22)';
  for (let i = 0; i < 42; i++) {
    const cx = (i * 197) % w;
    const cy = 60 + ((i * 131) % (h - 120));
    ctx.beginPath();
    ctx.ellipse(cx, cy, 45 + (i % 5) * 18, 12 + (i % 3) * 6, (i % 6) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const px = (lon: number, cw = w) => ((lon + 180) / 360) * cw;
  const py = (lat: number, ch = h) => ((90 - lat) / 180) * ch;

  const drawContinent = (
    poly: Array<[number, number]>,
    fillColor: string,
    aridPatch?: [number, number, number]
  ) => {
    const drawOn = (c: CanvasRenderingContext2D, cw: number, ch: number, style: string) => {
      c.fillStyle = style;
      c.beginPath();
      poly.forEach(([lon, lat], idx) => {
        if (idx === 0) c.moveTo(px(lon, cw), py(lat, ch));
        else c.lineTo(px(lon, cw), py(lat, ch));
      });
      c.closePath();
      c.fill();
    };

    ctx.save();
    ctx.strokeStyle = 'rgba(42, 145, 178, 0.42)';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    poly.forEach(([lon, lat], idx) => {
      if (idx === 0) ctx.moveTo(px(lon), py(lat));
      else ctx.lineTo(px(lon), py(lat));
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    drawOn(ctx, w, h, fillColor);
    drawOn(rCtx, 512, 256, '#d2d2d2');

    if (aridPatch) {
      const [alon, alat, rad] = aridPatch;
      const g = ctx.createRadialGradient(px(alon), py(alat), 4, px(alon), py(alat), rad);
      g.addColorStop(0, 'rgba(182, 148, 92, 0.72)');
      g.addColorStop(1, 'rgba(182, 148, 92, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px(alon), py(alat), rad, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawContinent(
    [
      [-166, 65], [-152, 71], [-130, 70], [-108, 72], [-86, 68], [-64, 58],
      [-56, 48], [-70, 42], [-77, 35], [-81, 26], [-84, 30], [-90, 29],
      [-97, 26], [-96, 19], [-88, 21], [-84, 10], [-93, 15], [-106, 21],
      [-115, 31], [-123, 39], [-125, 49], [-138, 58], [-156, 58],
    ],
    '#3d6b48',
    [-106, 36, 52]
  );

  drawContinent([[-56, 60], [-42, 60], [-20, 72], [-25, 83], [-52, 82], [-66, 76]], '#dce7f2');

  drawContinent(
    [
      [-80, 10], [-68, 12], [-50, 1], [-35, -6], [-39, -16], [-48, -28],
      [-60, -40], [-68, -54], [-74, -50], [-72, -32], [-71, -18], [-81, -5],
    ],
    '#376e42',
    [-68, -22, 34]
  );

  drawContinent(
    [
      [-9, 37], [-9, 43], [-2, 44], [-5, 50], [2, 51], [8, 54], [6, 61],
      [16, 69], [29, 71], [44, 67], [46, 52], [35, 46], [28, 41], [19, 40],
      [13, 44], [6, 43], [0, 38],
    ],
    '#4d734b'
  );

  drawContinent(
    [
      [-17, 15], [-14, 28], [-5, 36], [11, 37], [25, 32], [33, 31], [43, 12],
      [51, 11], [41, -3], [40, -16], [33, -27], [20, -35], [14, -22], [11, -6],
      [8, 4], [-8, 5],
    ],
    '#677a47',
    [14, 22, 74]
  );

  drawContinent(
    [
      [35, 41], [46, 52], [58, 68], [88, 74], [128, 72], [168, 66], [160, 56],
      [140, 48], [130, 38], [122, 31], [114, 22], [105, 11], [100, 14], [95, 20],
      [85, 16], [78, 8], [72, 20], [64, 25], [56, 26], [49, 30], [36, 33],
    ],
    '#4f7349',
    [68, 40, 68]
  );

  drawContinent(
    [
      [114, -22], [128, -14], [142, -11], [153, -26], [150, -37], [138, -36],
      [124, -34], [115, -34],
    ],
    '#8c6b42',
    [133, -25, 42]
  );

  ctx.fillStyle = '#e8f1fa';
  ctx.fillRect(0, 0, w, 28);
  ctx.fillRect(0, h - 32, w, 32);
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, 512, 16);
  rCtx.fillRect(0, 240, 512, 16);

  ctx.fillStyle = 'rgba(255, 210, 130, 0.35)';
  const hubs: Array<[number, number]> = [
    [-95.8, 36.1], [-74, 40.7], [-87.6, 41.8], [-118.2, 34.0], [-0.1, 51.5],
    [2.3, 48.8], [37.6, 55.7], [139.7, 35.7], [121.5, 31.2], [77.2, 28.6],
    [-46.6, -23.5], [151.2, -33.8],
  ];
  for (const [hlon, hlat] of hubs) {
    ctx.beginPath();
    ctx.arc(px(hlon), py(hlat), 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 512;
  cloudCanvas.height = 256;
  const cCtx = cloudCanvas.getContext('2d')!;
  cCtx.clearRect(0, 0, 512, 256);

  for (let i = 0; i < 160; i++) {
    const x = (((i * 97 + Math.sin(i * 1.7) * 40) % 512) + 512) % 512;
    const y = 26 + ((i * 53) % 204);
    const rx = 18 + (i % 6) * 9;
    const ry = 4 + (i % 4) * 2.5;
    const g = cCtx.createRadialGradient(x, y, 1, x, y, rx);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    g.addColorStop(0.6, 'rgba(240, 247, 255, 0.16)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    cCtx.fillStyle = g;
    cCtx.save();
    cCtx.translate(x, y);
    cCtx.scale(1, ry / rx);
    cCtx.beginPath();
    cCtx.arc(0, 0, rx, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAniso;

  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.anisotropy = maxAniso;

  return { colorMap, roughnessMap, cloudMap };
}

function createMoonTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c8ced8';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = 'rgba(110, 120, 140, 0.45)';
  const maria = [
    [180, 95, 48, 32],
    [240, 110, 38, 28],
    [130, 130, 55, 34],
    [320, 90, 42, 25],
    [285, 148, 36, 22],
  ];
  for (const [x, y, rx, ry] of maria) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 90; i++) {
    const cx = (i * 137) % 512;
    const cy = 20 + ((i * 89) % 216);
    const r = 2 + (i % 7) * 1.8;
    ctx.fillStyle = 'rgba(92, 98, 114, 0.38)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(235, 240, 248, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createBandedPlanetTexture(
  palette: string[],
  maxAniso: number,
  hasSpot = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  palette.forEach((col, i) => {
    grad.addColorStop(i / Math.max(1, palette.length - 1), col);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  for (let b = 0; b < 24; b++) {
    const y = (b / 24) * 256;
    ctx.fillStyle = b % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(40,20,10,0.09)';
    ctx.fillRect(0, y, 512, 5 + (b % 3) * 3);
  }

  if (hasSpot) {
    ctx.fillStyle = 'rgba(196, 86, 54, 0.85)';
    ctx.beginPath();
    ctx.ellipse(290, 152, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createSaturnRingTexture(maxAniso: number, isUranus = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  if (isUranus) {
    grad.addColorStop(0.0, 'rgba(135, 208, 222, 0.0)');
    grad.addColorStop(0.35, 'rgba(155, 225, 238, 0.25)');
    grad.addColorStop(0.55, 'rgba(165, 232, 245, 0.36)');
    grad.addColorStop(0.85, 'rgba(120, 195, 212, 0.14)');
    grad.addColorStop(1.0, 'rgba(120, 195, 212, 0.0)');
  } else {
    grad.addColorStop(0.0, 'rgba(210, 185, 140, 0.0)');
    grad.addColorStop(0.18, 'rgba(195, 170, 130, 0.45)');
    grad.addColorStop(0.45, 'rgba(232, 212, 172, 0.88)');
    grad.addColorStop(0.58, 'rgba(110, 95, 76, 0.16)');
    grad.addColorStop(0.64, 'rgba(222, 198, 156, 0.78)');
    grad.addColorStop(0.92, 'rgba(190, 168, 132, 0.32)');
    grad.addColorStop(1.0, 'rgba(180, 160, 125, 0.0)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createSunTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffae38';
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 180; i++) {
    const x = (i * 113) % 512;
    const y = (i * 71) % 256;
    const r = 6 + (i % 5) * 5;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, i % 3 === 0 ? 'rgba(255, 250, 210, 0.7)' : 'rgba(255, 130, 32, 0.55)');
    g.addColorStop(1, 'rgba(255, 170, 50, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createRadialGlowTexture(innerColor: string, midColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.28, midColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createOrbitLineFromBuffer(
  positions: Float32Array,
  colorHex: number,
  opacity: number
): THREE.LineLoop {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineLoop(geo, mat);
}

function createCircleRingLine(radius: number, colorHex: number, opacity: number): THREE.LineLoop {
  const segs = 128;
  const pos = new Float32Array(segs * 3);
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * radius;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = Math.sin(a) * radius;
  }
  return createOrbitLineFromBuffer(pos, colorHex, opacity);
}

export function createGalacticZoomController(
  container: HTMLElement,
  onStatusChange: (status: GalacticStatus) => void,
  onLabelsChange?: (labels: SolarBodyScreenLabel[]) => void,
  onBodyPicked?: (name: SolarBodyName) => void
): GalacticController {
  const isSoftwareGl = detectSoftwareWebGL();
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  let targetDpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
  let targetMinFrameMs = 0;

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(targetDpr);
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.setClearColor(0x030612, 1);

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030612);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(
    46,
    (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight),
    0.05,
    2400
  );

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const sunLight = new THREE.PointLight(0xfff1d6, 3.8, 900, 0.14);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const spaceFill = new THREE.HemisphereLight(0x5277b8, 0x10182c, 0.38);
  scene.add(spaceFill);

  // Deep Space Starfield (radius outside Neptune/Pluto True AU span!)
  const starCount = isSoftwareGl ? 700 : 1600;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = (i * 0.6180339887) % 1;
    const v = (i * 0.3819660113) % 1;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = 820 + (i % 7) * 65;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const tint = (i % 5) / 4;
    _colorTmp.setRGB(0.78 + 0.22 * tint, 0.84 + 0.12 * tint, 1.0 - 0.15 * tint);
    starCol[i * 3] = _colorTmp.r;
    starCol[i * 3 + 1] = _colorTmp.g;
    starCol[i * 3 + 2] = _colorTmp.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starSprite = createRadialGlowTexture('rgba(255,255,255,1)', 'rgba(215,230,255,0.45)');
  const starMat = new THREE.PointsMaterial({
    size: 4.0,
    map: starSprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);
  geometries.push(starGeo);
  materials.push(starMat);
  textures.push(starSprite);

  // Pickable hitbox targets for easy clicking of any body even when small
  const pickTargets: Array<{ mesh: THREE.Object3D; name: SolarBodyName }> = [];
  const bodyRootAnchors = new Map<SolarBodyName, THREE.Group>();

  const registerPickSphere = (parent: THREE.Object3D, name: SolarBodyName, radius: number) => {
    const pickGeo = new THREE.SphereGeometry(Math.max(radius * 1.55, 0.95), 10, 8);
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    const pickMesh = new THREE.Mesh(pickGeo, pickMat);
    pickMesh.userData.bodyName = name;
    parent.add(pickMesh);
    pickTargets.push({ mesh: pickMesh, name });
    geometries.push(pickGeo);
    materials.push(pickMat);
  };

  // Sun Core & Corona
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);
  bodyRootAnchors.set('Sun', sunGroup);

  const sunTex = createSunTexture(maxAniso);
  const sunGeo = new THREE.SphereGeometry(REAL_BODIES_META.Sun.showcaseRadius, 48, 32);
  const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunGroup.add(sunMesh);

  const coronaTex = createRadialGlowTexture('rgba(255, 246, 200, 0.92)', 'rgba(255, 160, 56, 0.36)');
  const coronaMat = new THREE.SpriteMaterial({
    map: coronaTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coronaSprite = new THREE.Sprite(coronaMat);
  coronaSprite.scale.set(20, 20, 1);
  sunGroup.add(coronaSprite);
  registerPickSphere(sunGroup, 'Sun', REAL_BODIES_META.Sun.showcaseRadius);
  geometries.push(sunGeo);
  materials.push(sunMat, coronaMat);
  textures.push(sunTex, coronaTex);

  // Ecliptic Reference Rings (AU markers + Habitable Zone)
  const eclipticGridGroup = new THREE.Group();
  scene.add(eclipticGridGroup);
  const gridAuSpecs: Array<{ au: number; color: number; opacity: number }> = [
    { au: 0.95, color: 0x38bdf8, opacity: 0.14 },
    { au: 1.37, color: 0x38bdf8, opacity: 0.14 },
    { au: 5.2, color: 0x94a3b8, opacity: 0.08 },
    { au: 10, color: 0x94a3b8, opacity: 0.08 },
    { au: 20, color: 0x94a3b8, opacity: 0.08 },
    { au: 30, color: 0x94a3b8, opacity: 0.08 },
  ];
  const gridRings: Array<{ line: THREE.LineLoop; au: number }> = [];
  for (const spec of gridAuSpecs) {
    const r0 = auRadiusToScene(spec.au, 0);
    const ring = createCircleRingLine(r0, spec.color, spec.opacity);
    eclipticGridGroup.add(ring);
    gridRings.push({ line: ring, au: spec.au });
    geometries.push(ring.geometry);
    materials.push(ring.material as THREE.Material);
  }

  // Initial epoch Date
  const epochInitDate = new Date();

  // Earth + Broken Arrow Pin + Exact 23.44° Axial Tilt + Cloud Layer + Atmosphere + Synced Moon
  const earthOrbitBuf = computeOrbitCurveScenePoints('Earth', epochInitDate, ORBIT_SEGMENTS, 0);
  const earthOrbitLine = createOrbitLineFromBuffer(
    earthOrbitBuf,
    REAL_BODIES_META.Earth.orbitColor,
    0.34
  );
  scene.add(earthOrbitLine);
  geometries.push(earthOrbitLine.geometry);
  materials.push(earthOrbitLine.material as THREE.Material);

  const earthAnchor = new THREE.Group();
  scene.add(earthAnchor);
  bodyRootAnchors.set('Earth', earthAnchor);

  const earthTiltGroup = new THREE.Group();
  earthTiltGroup.rotation.z = THREE.MathUtils.degToRad(REAL_BODIES_META.Earth.axialTiltDeg);
  earthAnchor.add(earthTiltGroup);

  const earthSpinGroup = new THREE.Group();
  earthTiltGroup.add(earthSpinGroup);

  const { colorMap: earthColor, roughnessMap: earthRough, cloudMap } = createEarthTextures(maxAniso);
  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
  const earthMat = new THREE.MeshStandardMaterial({
    map: earthColor,
    roughnessMap: earthRough,
    roughness: 0.85,
    metalness: 0.08,
  });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthSpinGroup.add(earthMesh);

  const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 48, 36);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudMap,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0.0,
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  earthTiltGroup.add(cloudMesh);

  const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.075, 48, 36);
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x52a8ff) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      uniform vec3 uColor;
      void main() {
        float rim = pow(0.68 - dot(vNormal, normalize(vViewPos)), 3.2);
        gl_FragColor = vec4(uColor, clamp(rim, 0.0, 0.85));
      }
    `,
  });
  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  earthTiltGroup.add(atmoMesh);

  // Broken Arrow Astrolabe Marker Pin at 36.0526° N, 95.7908° W
  latLonToSphereVec(BA_LAT_DEG, BA_LON_DEG, EARTH_RADIUS * 1.006, _baLocal);
  const baMarkerGroup = new THREE.Group();
  baMarkerGroup.position.copy(_baLocal);
  _vecA.copy(_baLocal).normalize();
  baMarkerGroup.quaternion.setFromUnitVectors(_vecB.set(0, 1, 0), _vecA);

  const pinBaseGeo = new THREE.TorusGeometry(0.055, 0.009, 10, 28);
  const pinBaseMat = new THREE.MeshStandardMaterial({
    color: 0xffc864,
    emissive: 0xffa62b,
    emissiveIntensity: 0.75,
    metalness: 0.8,
    roughness: 0.25,
  });
  const pinBase = new THREE.Mesh(pinBaseGeo, pinBaseMat);
  pinBase.rotation.x = Math.PI * 0.5;

  const pinStemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10);
  const pinStem = new THREE.Mesh(pinStemGeo, pinBaseMat);
  pinStem.position.y = 0.045;

  const pinOrbGeo = new THREE.SphereGeometry(0.022, 16, 12);
  const pinOrbMat = new THREE.MeshBasicMaterial({ color: 0xffe49e });
  const pinOrb = new THREE.Mesh(pinOrbGeo, pinOrbMat);
  pinOrb.position.y = 0.095;

  baMarkerGroup.add(pinBase, pinStem, pinOrb);
  earthSpinGroup.add(baMarkerGroup);
  registerPickSphere(earthAnchor, 'Earth', EARTH_RADIUS);
  geometries.push(earthGeo, cloudGeo, atmoGeo, pinBaseGeo, pinStemGeo, pinOrbGeo);
  materials.push(earthMat, cloudMat, atmoMat, pinBaseMat, pinOrbMat);
  textures.push(earthColor, earthRough, cloudMap);

  // Earth's Moon orbiting on inclined lunar plane
  const moonPivot = new THREE.Group();
  moonPivot.rotation.x = THREE.MathUtils.degToRad(5.145);
  earthAnchor.add(moonPivot);

  const moonOrbitRadius = 3.05;
  const moonOrbitLine = createCircleRingLine(moonOrbitRadius, 0x9ab4e8, 0.24);
  moonOrbitLine.rotation.x = THREE.MathUtils.degToRad(5.145);
  earthAnchor.add(moonOrbitLine);
  geometries.push(moonOrbitLine.geometry);
  materials.push(moonOrbitLine.material as THREE.Material);

  const moonTex = createMoonTexture(maxAniso);
  const moonGeo = new THREE.SphereGeometry(0.32, 32, 24);
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(moonOrbitRadius, 0, 0);
  moonPivot.add(moonMesh);
  geometries.push(moonGeo);
  materials.push(moonMat);
  textures.push(moonTex);

  // All Non-Earth Planets + Dwarf Planet Pluto with J2000 Elliptical Orbits, Axial Tilts & Major Moons
  interface PlanetEntry {
    name: Exclude<SolarBodyName, 'Sun' | 'Earth'>;
    anchor: THREE.Group;
    tiltGroup: THREE.Group;
    mesh: THREE.Mesh;
    orbitLine: THREE.LineLoop;
    orbitBuf: Float32Array;
    rotationHours: number;
    moons: Array<{ pivot: THREE.Group; periodDays: number }>;
  }
  const planets: PlanetEntry[] = [];

  for (const bodyName of PLANET_ORDER) {
    if (bodyName === 'Earth' || bodyName === 'Sun') continue;
    const meta = REAL_BODIES_META[bodyName];
    const orbitBuf = computeOrbitCurveScenePoints(bodyName, epochInitDate, ORBIT_SEGMENTS, 0);
    const orbitLine = createOrbitLineFromBuffer(orbitBuf, meta.orbitColor, 0.26);
    scene.add(orbitLine);
    geometries.push(orbitLine.geometry);
    materials.push(orbitLine.material as THREE.Material);

    const anchor = new THREE.Group();
    scene.add(anchor);
    bodyRootAnchors.set(bodyName, anchor);

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(meta.axialTiltDeg);
    anchor.add(tiltGroup);

    const tex = createBandedPlanetTexture(meta.palette, maxAniso, meta.hasSpot);
    const geo = new THREE.SphereGeometry(meta.showcaseRadius, 36, 26);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.76,
      metalness: 0.04,
    });
    const mesh = new THREE.Mesh(geo, mat);
    tiltGroup.add(mesh);
    registerPickSphere(anchor, bodyName, meta.showcaseRadius);

    geometries.push(geo);
    materials.push(mat);
    textures.push(tex);

    if (meta.hasRings) {
      const isUranus = meta.hasRings === 'uranus';
      const innerR = meta.showcaseRadius * (isUranus ? 1.42 : 1.35);
      const outerR = meta.showcaseRadius * (isUranus ? 1.92 : 2.48);
      const ringTex = createSaturnRingTexture(maxAniso, isUranus);
      const ringGeo = new THREE.RingGeometry(innerR, outerR, 72);
      const posAttr = ringGeo.attributes.position;
      const uvAttr = ringGeo.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        _vecA.fromBufferAttribute(posAttr, i);
        const r = _vecA.length();
        const u = (r - innerR) / Math.max(0.001, outerR - innerR);
        uvAttr.setXY(i, u, 0.5);
      }
      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.85,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      // Equatorial plane of tilted planet! (XY RingGeometry -> XZ equatorial plane)
      ringMesh.rotation.x = Math.PI * 0.5;
      tiltGroup.add(ringMesh);
      geometries.push(ringGeo);
      materials.push(ringMat);
      textures.push(ringTex);
    }

    const moonEntries: Array<{ pivot: THREE.Group; periodDays: number }> = [];
    for (const ms of meta.moons) {
      const mPivot = new THREE.Group();
      mPivot.rotation.x = THREE.MathUtils.degToRad(ms.inclinationDeg);
      tiltGroup.add(mPivot);

      const mGeo = new THREE.SphereGeometry(
        Math.max(0.055, meta.showcaseRadius * ms.radiusRatio),
        14,
        10
      );
      const mMat = new THREE.MeshStandardMaterial({
        color: ms.color,
        roughness: 0.9,
        metalness: 0.04,
      });
      const mMesh = new THREE.Mesh(mGeo, mMat);
      mMesh.position.set(meta.showcaseRadius * ms.orbitRatio, 0, 0);
      mPivot.add(mMesh);

      geometries.push(mGeo);
      materials.push(mMat);
      moonEntries.push({ pivot: mPivot, periodDays: ms.periodDays });
    }

    planets.push({
      name: bodyName,
      anchor,
      tiltGroup,
      mesh,
      orbitLine,
      orbitBuf,
      rotationHours: meta.rotationPeriodHours,
      moons: moonEntries,
    });
  }

  // Main Asteroid Belt (2.18..3.25 AU) + Kuiper Belt (30.2..47.5 AU) - skipped on software WebGL & hidden in Eco!
  interface BeltParticleSpec {
    rAU: number;
    angle: number;
    yAU: number;
    scale: number;
    rx: number;
    ry: number;
    rz: number;
  }
  const createBeltMesh = (
    count: number,
    rMinAU: number,
    rMaxAU: number,
    thicknessAU: number,
    baseColorHex: number,
    baseSize: number
  ): { mesh: THREE.InstancedMesh; specs: BeltParticleSpec[] } | null => {
    if (isSoftwareGl) return null;
    const geo = new THREE.IcosahedronGeometry(baseSize, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: baseColorHex,
      roughness: 0.92,
      metalness: 0.08,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const specs: BeltParticleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = ((i * 0.6180339887) % 1);
      const rAU = rMinAU + t * (rMaxAU - rMinAU);
      const angle = (i / count) * Math.PI * 2 + (i % 13) * 0.17;
      const yAU = (((i * 29) % 100) / 100 - 0.5) * thicknessAU;
      const scale = 0.55 + ((i * 19) % 10) * 0.12;
      specs.push({
        rAU,
        angle,
        yAU,
        scale,
        rx: i * 0.7,
        ry: i * 1.1,
        rz: i * 0.3,
      });
      _colorTmp.setHex(baseColorHex).offsetHSL(0, 0, ((i % 5) - 2) * 0.04);
      inst.setColorAt(i, _colorTmp);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    geometries.push(geo);
    materials.push(mat);
    return { mesh: inst, specs };
  };

  const asteroidBeltObj = createBeltMesh(260, 2.15, 3.25, 0.22, 0x9a8f82, 0.13);
  const kuiperBeltObj = createBeltMesh(300, 30.2, 47.5, 2.8, 0x8ea9c9, 0.17);

  const updateBeltTransforms = (
    beltObj: { mesh: THREE.InstancedMesh; specs: BeltParticleSpec[] } | null,
    mix: number,
    rotOffset: number
  ) => {
    if (!beltObj || !beltObj.mesh.visible) return;
    const { mesh, specs } = beltObj;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const rad = auRadiusToScene(s.rAU, mix);
      const a = s.angle + rotOffset;
      const yScene = (s.yAU / s.rAU) * rad;
      _dummy.position.set(Math.cos(a) * rad, yScene, -Math.sin(a) * rad);
      _dummy.rotation.set(s.rx, s.ry, s.rz);
      _dummy.scale.setScalar(s.scale * (1 - mix * 0.22));
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Animation & interaction state
  let phase: GalacticPhase = 'ocean';
  let tourTime = 0;
  let returnTime = 0;
  let syncMoonPhaseFraction = 0.25;
  let syncDayFraction = 0.74;

  let selectedBody: SolarBodyName = 'Earth';
  let scaleMode: SolarScaleMode = 'showcase';
  let trueAuMixCur = 0;
  let trueAuMixTarget = 0;
  let lastBuiltOrbitMix = -1;
  let lastBeltMix = -1;
  let beltSpinAngle = 0;

  let timeRate = 1; // seconds per real second: 0 = paused, 1 = live, 86400 = 1d/s, 2592000 = 1mo/s, 31557600 = 1yr/s
  let simDateMs = Date.now();
  let ecoMode = false;
  let showBeltsAndGrid = true;

  // Interactive orbit camera
  let orbitYaw = 0.6;
  let orbitPitch = 0.35;
  let orbitDistanceTarget = 4.6;
  let orbitDistanceCur = 4.6;
  let orbitFocusMixTarget = 0; // 0 = selectedBody, 1 = Sun overview
  let orbitFocusMixCur = 0;
  let dragging = false;
  let downX = 0;
  let downY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const returnStartCamPos = new THREE.Vector3();
  const returnStartLook = new THREE.Vector3();
  const currentLookAt = new THREE.Vector3();
  let lastEmittedStage = '';
  let lastEmittedPhase: GalacticPhase = 'ocean';
  let lastEmittedBody: SolarBodyName = 'Earth';
  let lastEmittedScale: SolarScaleMode = 'showcase';
  let lastEmittedRate = 1;
  let lastLabelEmitMs = 0;
  let lastTelemetryEmitMs = 0;

  let frameId = 0;
  let lastNow = performance.now();
  let loopRunning = false;
  let disposed = false;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  const syncVisibility = () => {
    const beltsActive = showBeltsAndGrid && !ecoMode;
    if (asteroidBeltObj) asteroidBeltObj.mesh.visible = beltsActive;
    if (kuiperBeltObj) kuiperBeltObj.mesh.visible = beltsActive;
    eclipticGridGroup.visible = showBeltsAndGrid;
  };

  const emitStatus = (stageLabel: string, tourProgress: number, oceanBlend: number) => {
    onStatusChange({
      phase,
      stageLabel,
      tourProgress,
      oceanBlend,
      selectedBody,
      scaleMode,
      timeRate,
      simDateMs,
    });
  };

  const emitProjectedLabels = (oceanBlend: number) => {
    if (!onLabelsChange || oceanBlend < 0.35) {
      if (onLabelsChange) onLabelsChange([]);
      return;
    }
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const labels: SolarBodyScreenLabel[] = [];
    for (const bodyName of ALL_SOLAR_BODIES) {
      const anchor = bodyRootAnchors.get(bodyName);
      if (!anchor) continue;
      anchor.getWorldPosition(_projVec);
      _projVec.project(camera);
      const visible =
        _projVec.z > -1 &&
        _projVec.z < 1 &&
        _projVec.x >= -1.05 &&
        _projVec.x <= 1.05 &&
        _projVec.y >= -1.05 &&
        _projVec.y <= 1.05;
      labels.push({
        name: bodyName,
        x: (_projVec.x * 0.5 + 0.5) * w,
        y: (-_projVec.y * 0.5 + 0.5) * h,
        visible,
        color: REAL_BODIES_META[bodyName].labelColor,
        selected: bodyName === selectedBody,
      });
    }
    onLabelsChange(labels);
  };

  const domEl = renderer.domElement;
  const activePointers = new Map<number, { x: number; y: number }>();
  let lastPinchDist: number | null = null;
  let wasPinching = false;

  const updateZoomDistance = (factor: number) => {
    const maxZoom = scaleMode === 'true-au' ? 620.0 : 120.0;
    orbitDistanceTarget = THREE.MathUtils.clamp(orbitDistanceTarget * factor, 1.8, maxZoom);
    if (selectedBody !== 'Sun') {
      const blendStart = scaleMode === 'true-au' ? 32 : 14;
      const blendEnd = scaleMode === 'true-au' ? 110 : 40;
      orbitFocusMixTarget = smoothstep(blendStart, blendEnd, orbitDistanceTarget);
    } else {
      orbitFocusMixTarget = 1;
    }
  };

  const getPinchDistance = (): number | null => {
    if (activePointers.size < 2) return null;
    const pts = Array.from(activePointers.values());
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (phase !== 'orbiting') return;
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    domEl.setPointerCapture?.(e.pointerId);

    if (activePointers.size >= 2) {
      dragging = false;
      wasPinching = true;
      lastPinchDist = getPinchDistance();
      return;
    }

    wasPinching = false;
    dragging = true;
    downX = e.clientX;
    downY = e.clientY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (phase !== 'orbiting') return;

    if (activePointers.size >= 2) {
      const dist = getPinchDistance();
      if (dist && lastPinchDist && dist > 8 && lastPinchDist > 8) {
        updateZoomDistance(lastPinchDist / dist);
      }
      lastPinchDist = dist;
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    orbitYaw -= dx * 0.0065;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.0055, -1.25, 1.35);
  };

  const onPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = null;
    }

    if (phase === 'orbiting' && dragging && !wasPinching && activePointers.size === 0) {
      const travel = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (travel < 8) {
        const rect = domEl.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(
          pickTargets.map((pt) => pt.mesh),
          false
        );
        if (hits.length > 0) {
          const hitName = hits[0].object.userData.bodyName as SolarBodyName | undefined;
          if (hitName) {
            onBodyPicked?.(hitName);
          }
        }
      }
    }

    if (activePointers.size === 1) {
      const remaining = Array.from(activePointers.values())[0];
      lastPointerX = remaining.x;
      lastPointerY = remaining.y;
      dragging = false;
    } else if (activePointers.size === 0) {
      dragging = false;
      wasPinching = false;
    }
    domEl.releasePointerCapture?.(e.pointerId);
  };

  const onWheel = (e: WheelEvent) => {
    if (phase !== 'orbiting') return;
    e.preventDefault();
    const factor = 1 + Math.sign(e.deltaY) * 0.12;
    updateZoomDistance(factor);
  };

  domEl.addEventListener('pointerdown', onPointerDown);
  domEl.addEventListener('pointermove', onPointerMove);
  domEl.addEventListener('pointerup', onPointerUp);
  domEl.addEventListener('pointercancel', onPointerUp);
  domEl.addEventListener('wheel', onWheel, { passive: false });

  const onResize = () => {
    if (disposed) return;
    const w = container.clientWidth || window.innerWidth;
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(isSoftwareGl ? 1 : targetDpr);
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  resizeObserver?.observe(container);

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed || !loopRunning) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function updateCelestialState(dt: number, spaceActivity: number) {
    // Advance simulation clock cleanly
    if (timeRate === 1) {
      simDateMs = Date.now();
    } else if (timeRate > 1) {
      simDateMs += dt * timeRate * 1000;
    }
    const simDate = new Date(simDateMs);

    // Smooth-damp Showcase <-> True AU scale transition
    trueAuMixCur = THREE.MathUtils.damp(trueAuMixCur, trueAuMixTarget, 4.5, dt);

    // Scale Sun gently in True AU mode so inner Mercury (0.39 AU * 12 = 4.68 units) orbits outside solar photosphere
    const sunScale = 1 - trueAuMixCur * 0.56;
    sunGroup.scale.setScalar(sunScale);
    sunMesh.rotation.y += dt * 0.06;

    // Rebuild elliptical orbit lines & ecliptic reference rings smoothly when scale mix changes
    if (Math.abs(trueAuMixCur - lastBuiltOrbitMix) > 0.0015) {
      lastBuiltOrbitMix = trueAuMixCur;

      computeOrbitCurveScenePoints('Earth', simDate, ORBIT_SEGMENTS, trueAuMixCur, earthOrbitBuf);
      (earthOrbitLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      earthOrbitLine.geometry.computeBoundingSphere();

      for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        computeOrbitCurveScenePoints(p.name, simDate, ORBIT_SEGMENTS, trueAuMixCur, p.orbitBuf);
        (p.orbitLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        p.orbitLine.geometry.computeBoundingSphere();
      }

      for (const ring of gridRings) {
        const targetR = auRadiusToScene(ring.au, trueAuMixCur);
        const baseR = auRadiusToScene(ring.au, 0);
        ring.line.scale.setScalar(targetR / Math.max(0.01, baseR));
      }
    }

    // Update Belt positions when scale mix changes or asteroids gently drift
    const beltDriftSpeed = timeRate === 0 ? 0.002 : timeRate === 1 ? 0.012 : 0.045;
    beltSpinAngle += dt * beltDriftSpeed;
    if (
      Math.abs(trueAuMixCur - lastBeltMix) > 0.0015 ||
      (showBeltsAndGrid && !ecoMode && !isSoftwareGl)
    ) {
      lastBeltMix = trueAuMixCur;
      updateBeltTransforms(asteroidBeltObj, trueAuMixCur, beltSpinAngle);
      updateBeltTransforms(kuiperBeltObj, trueAuMixCur, beltSpinAngle * 0.35);
    }

    // Place Earth at exact J2000 heliocentric ecliptic position today
    const earthJ2000 = evaluateBodyAtDate('Earth', simDate);
    const [ex, ey, ez] = eclipticAuToSceneXYZ(
      earthJ2000.xEclAU,
      earthJ2000.yEclAU,
      earthJ2000.zEclAU,
      trueAuMixCur
    );
    earthAnchor.position.set(ex, ey, ez);

    cloudMesh.rotation.y += dt * 0.045;

    // Update every other planet + dwarf planet Pluto from live J2000 elements
    const simDaysFromEpoch = (simDateMs - 946_728_000_000) / 86_400_000;
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      const st = evaluateBodyAtDate(p.name, simDate);
      const [px, py, pz] = eclipticAuToSceneXYZ(
        st.xEclAU,
        st.yEclAU,
        st.zEclAU,
        trueAuMixCur
      );
      p.anchor.position.set(px, py, pz);
      const spinDir = p.rotationHours < 0 ? -1 : 1;
      p.mesh.rotation.y += spinDir * dt * (Math.abs(p.rotationHours) < 20 ? 0.9 : 0.32);

      for (const m of p.moons) {
        m.pivot.rotation.y = (simDaysFromEpoch / m.periodDays) * Math.PI * 2;
      }
    }

    earthAnchor.updateMatrixWorld(true);
    earthAnchor.getWorldPosition(_earthPos);

    // Synchronize Earth rotation so Broken Arrow's sun angle matches ocean solar clock
    _toSun.copy(_earthPos).negate().normalize();
    const sunAngle = Math.atan2(_toSun.x, _toSun.z);
    const baAngle = Math.atan2(_baLocal.x, _baLocal.z);
    const clockAngle = (syncDayFraction - 0.5) * Math.PI * 2;
    const freeSpinDrift =
      spaceActivity > 0.5 && timeRate > 1
        ? (simDaysFromEpoch * Math.PI * 2) % (Math.PI * 2)
        : 0;
    earthSpinGroup.rotation.y = sunAngle - baAngle + clockAngle + freeSpinDrift;
    earthSpinGroup.updateMatrixWorld(true);

    // Real synodic Moon elongation relative to true Earth->Sun vector
    const newMoonAngle = Math.atan2(_earthPos.z, -_earthPos.x);
    moonPivot.rotation.y = newMoonAngle + syncMoonPhaseFraction * Math.PI * 2;

    baMarkerGroup.getWorldPosition(_baWorld);
    _baNormal.copy(_baWorld).sub(_earthPos).normalize();
  }

  function getSelectedAnchorWorldPos(out: THREE.Vector3): THREE.Vector3 {
    const anchor = bodyRootAnchors.get(selectedBody);
    if (anchor) {
      anchor.getWorldPosition(out);
    } else {
      out.copy(_earthPos);
    }
    return out;
  }

  function computeTourCamera(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3): {
    stageLabel: string;
    oceanBlend: number;
  } {
    const enterSpace = smoothstep(0.0, 0.12, t);
    const exitSpace = 1 - smoothstep(0.88, 1.0, t);
    const oceanBlend = Math.min(enterSpace, exitSpace);

    let distFromEarth = 0.25;
    let focusSolarMix = 0;
    let stageLabel = 'Ascending from Broken Arrow';

    if (t < 0.18) {
      const u = smoothstep(0.0, 0.18, t);
      distFromEarth = THREE.MathUtils.lerp(0.24, 3.6, u);
      focusSolarMix = 0;
      stageLabel = 'Ascending from Broken Arrow';
    } else if (t < 0.34) {
      const u = smoothstep(0.18, 0.34, t);
      distFromEarth = THREE.MathUtils.lerp(3.6, 5.2, u);
      focusSolarMix = smoothstep(0.24, 0.34, t) * 0.25;
      stageLabel = 'Earth & Lunar Orbit';
    } else if (t < 0.68) {
      const pullOut = smoothstep(0.34, 0.48, t);
      const diveIn = 1 - smoothstep(0.54, 0.68, t);
      const vistaWeight = Math.min(pullOut, diveIn);
      distFromEarth = THREE.MathUtils.lerp(5.2, 66.0, vistaWeight);
      focusSolarMix = THREE.MathUtils.lerp(0.25, 1.0, vistaWeight);
      stageLabel = 'J2000 Solar System Vista';
    } else if (t < 0.85) {
      const u = smoothstep(0.68, 0.85, t);
      distFromEarth = THREE.MathUtils.lerp(5.2, 3.2, u);
      focusSolarMix = (1 - u) * 0.25;
      stageLabel = 'Approaching Earth Terminator';
    } else {
      const u = smoothstep(0.85, 1.0, t);
      distFromEarth = THREE.MathUtils.lerp(3.2, 0.24, u);
      focusSolarMix = 0;
      stageLabel = 'Descending to Horizon';
    }

    const sweepAngle = t * Math.PI * 1.45;
    const upVec = _vecA.set(0, 1, 0);
    const tangent = _vecB.crossVectors(upVec, _baNormal).normalize();
    if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);

    const nearOffset = _vecC
      .copy(_baNormal)
      .multiplyScalar(distFromEarth * Math.cos(Math.sin(t * Math.PI) * 0.45))
      .addScaledVector(tangent, Math.sin(sweepAngle) * distFromEarth * 0.48 * smoothstep(0.05, 0.25, t))
      .addScaledVector(upVec, distFromEarth * 0.34 * smoothstep(0.05, 0.35, t));

    const wideR = scaleMode === 'true-au' ? 140 : 62;
    const solarCamPos = _vecA.set(
      Math.cos(sweepAngle * 0.55 - 0.6) * wideR,
      wideR * 0.44 + Math.sin(t * Math.PI) * 8,
      Math.sin(sweepAngle * 0.55 - 0.6) * wideR
    );

    const earthCamPos = nearOffset.add(_baWorld);
    outPos.copy(earthCamPos).lerp(solarCamPos, focusSolarMix);
    outLook.copy(_earthPos).lerp(_vecB.set(0, 0, 0), focusSolarMix);

    return { stageLabel, oceanBlend };
  }

  function tick() {
    if (disposed || !loopRunning) return;

    const now = performance.now();
    const rawMs = now - lastNow;
    if (!isSoftwareGl && targetMinFrameMs > 0 && rawMs < targetMinFrameMs - 0.6) {
      frameId = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.08, Math.max(0.001, rawMs / 1000));
    lastNow = now;

    if (phase === 'ocean') {
      loopRunning = false;
      return;
    }

    let stageLabel = 'J2000 Solar Orbit';
    let oceanBlend = 1;
    let progress = 0;

    if (phase === 'touring') {
      tourTime = Math.min(TOUR_DURATION_SEC, tourTime + dt);
      progress = tourTime / TOUR_DURATION_SEC;

      updateCelestialState(dt, smoothstep(0.08, 0.3, progress));
      const res = computeTourCamera(progress, _targetPos, _targetLook);
      stageLabel = res.stageLabel;
      oceanBlend = res.oceanBlend;

      camera.position.lerp(_targetPos, 1 - Math.exp(-8.0 * dt));
      currentLookAt.lerp(_targetLook, 1 - Math.exp(-8.0 * dt));
      camera.lookAt(currentLookAt);

      if (tourTime >= TOUR_DURATION_SEC) {
        phase = 'ocean';
        oceanBlend = 0;
        stageLabel = 'Horizon Ocean';
        emitStatus(stageLabel, 1, 0);
        emitProjectedLabels(0);
        loopRunning = false;
        return;
      }
    } else if (phase === 'orbiting') {
      progress = tourTime / TOUR_DURATION_SEC;
      updateCelestialState(dt, 1.0);
      oceanBlend = 1;
      stageLabel =
        orbitFocusMixTarget > 0.65 || selectedBody === 'Sun'
          ? 'J2000 Solar System · Click Planet to Inspect'
          : `Inspecting ${selectedBody} · Drag to Orbit`;

      orbitDistanceCur = THREE.MathUtils.damp(orbitDistanceCur, orbitDistanceTarget, 5.0, dt);
      orbitFocusMixCur = THREE.MathUtils.damp(orbitFocusMixCur, orbitFocusMixTarget, 4.5, dt);

      if (!dragging) {
        orbitYaw += dt * 0.065;
      }

      getSelectedAnchorWorldPos(_focusPos);
      const cosP = Math.cos(orbitPitch);
      _targetPos.set(
        Math.cos(orbitYaw) * cosP * orbitDistanceCur,
        Math.sin(orbitPitch) * orbitDistanceCur,
        Math.sin(orbitYaw) * cosP * orbitDistanceCur
      );
      _targetLook.copy(_focusPos).lerp(_vecB.set(0, 0, 0), orbitFocusMixCur);
      _targetPos.add(_targetLook);

      camera.position.lerp(_targetPos, 1 - Math.exp(-7.5 * dt));
      currentLookAt.lerp(_targetLook, 1 - Math.exp(-7.5 * dt));
      camera.lookAt(currentLookAt);
    } else if (phase === 'returning') {
      returnTime = Math.min(RETURN_DURATION_SEC, returnTime + dt);
      const u = smoothstep(0, 1, returnTime / RETURN_DURATION_SEC);
      updateCelestialState(dt, 1 - u);

      _targetPos.copy(_baWorld).addScaledVector(_baNormal, 0.24);
      _targetLook.copy(_earthPos);

      camera.position.lerpVectors(returnStartCamPos, _targetPos, u);
      currentLookAt.lerpVectors(returnStartLook, _targetLook, u);
      camera.lookAt(currentLookAt);

      oceanBlend = 1 - smoothstep(0.35, 1.0, u);
      stageLabel = 'Descending to Horizon';
      progress = 0.85 + u * 0.15;

      if (returnTime >= RETURN_DURATION_SEC) {
        phase = 'ocean';
        oceanBlend = 0;
        stageLabel = 'Horizon Ocean';
        emitStatus(stageLabel, 1, 0);
        emitProjectedLabels(0);
        loopRunning = false;
        return;
      }
    }

    renderer.render(scene, camera);

    if (now - lastLabelEmitMs >= 33) {
      lastLabelEmitMs = now;
      emitProjectedLabels(oceanBlend);
    }

    const telemetryTick = phase === 'orbiting' && timeRate > 1 && now - lastTelemetryEmitMs >= 250;
    if (
      stageLabel !== lastEmittedStage ||
      phase !== lastEmittedPhase ||
      selectedBody !== lastEmittedBody ||
      scaleMode !== lastEmittedScale ||
      timeRate !== lastEmittedRate ||
      phase === 'touring' ||
      phase === 'returning' ||
      telemetryTick
    ) {
      lastEmittedStage = stageLabel;
      lastEmittedPhase = phase;
      lastEmittedBody = selectedBody;
      lastEmittedScale = scaleMode;
      lastEmittedRate = timeRate;
      if (telemetryTick) lastTelemetryEmitMs = now;
      emitStatus(stageLabel, progress, oceanBlend);
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  function startLoop() {
    if (disposed || loopRunning) return;
    loopRunning = true;
    lastNow = performance.now();
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  return {
    startTour() {
      if (disposed) return;
      phase = 'touring';
      tourTime = 0;
      selectedBody = 'Earth';
      updateCelestialState(0, 0);
      computeTourCamera(0, _targetPos, _targetLook);
      camera.position.copy(_targetPos);
      currentLookAt.copy(_targetLook);
      camera.lookAt(currentLookAt);
      emitStatus('Ascending from Broken Arrow', 0, 0);
      startLoop();
    },

    pauseInOrbit() {
      if (disposed || phase === 'ocean') return;
      phase = 'orbiting';
      const distToEarth = camera.position.distanceTo(_earthPos);
      const isWide = distToEarth > 18;
      if (isWide) selectedBody = 'Sun';
      orbitFocusMixTarget = isWide ? 1 : 0;
      orbitFocusMixCur = orbitFocusMixTarget;
      getSelectedAnchorWorldPos(_focusPos);
      _targetLook.copy(_focusPos).lerp(_vecB.set(0, 0, 0), orbitFocusMixCur);
      _vecA.copy(camera.position).sub(_targetLook);
      orbitDistanceTarget = THREE.MathUtils.clamp(_vecA.length(), 2.8, scaleMode === 'true-au' ? 320 : 95);
      orbitDistanceCur = orbitDistanceTarget;
      orbitYaw = Math.atan2(_vecA.z, _vecA.x);
      orbitPitch = Math.asin(THREE.MathUtils.clamp(_vecA.y / Math.max(0.01, orbitDistanceCur), -0.92, 0.92));

      emitStatus(
        isWide ? 'J2000 Solar System · Click Planet to Inspect' : `Inspecting ${selectedBody} · Drag to Orbit`,
        tourTime / TOUR_DURATION_SEC,
        1
      );
      startLoop();
    },

    resumeTour() {
      if (disposed) return;
      if (phase === 'ocean') {
        this.startTour();
        return;
      }
      phase = 'touring';
      if (tourTime >= TOUR_DURATION_SEC * 0.9) {
        tourTime = TOUR_DURATION_SEC * 0.35;
      }
      emitStatus('Resuming Solar System Tour', tourTime / TOUR_DURATION_SEC, 1);
      startLoop();
    },

    returnToOcean() {
      if (disposed || phase === 'ocean') return;
      phase = 'returning';
      returnTime = 0;
      returnStartCamPos.copy(camera.position);
      returnStartLook.copy(currentLookAt);
      emitStatus('Descending to Horizon', 0.88, 1);
      startLoop();
    },

    setOrbitPreset(preset: OrbitPreset) {
      if (disposed) return;
      if (phase === 'ocean') {
        this.startTour();
        tourTime = preset === 'solar' ? TOUR_DURATION_SEC * 0.48 : TOUR_DURATION_SEC * 0.22;
        this.pauseInOrbit();
      } else {
        phase = 'orbiting';
      }
      if (preset === 'earth') {
        selectedBody = 'Earth';
        orbitDistanceTarget = 4.2;
        orbitFocusMixTarget = 0;
        orbitPitch = 0.28;
      } else {
        selectedBody = 'Sun';
        orbitDistanceTarget = scaleMode === 'true-au' ? 175.0 : 62.0;
        orbitFocusMixTarget = 1;
        orbitPitch = 0.44;
      }
      emitStatus(
        preset === 'solar'
          ? 'J2000 Solar System · Click Planet to Inspect'
          : 'Inspecting Earth · Drag to Orbit',
        tourTime / TOUR_DURATION_SEC,
        1
      );
      startLoop();
    },

    setScaleMode(mode: SolarScaleMode) {
      scaleMode = mode;
      trueAuMixTarget = mode === 'true-au' ? 1 : 0;
      if (phase === 'orbiting' && selectedBody === 'Sun') {
        orbitDistanceTarget = mode === 'true-au' ? 185.0 : 62.0;
      }
      emitStatus(lastEmittedStage || 'J2000 Solar System', tourTime / TOUR_DURATION_SEC, 1);
    },

    setTimeRate(rateSecPerSec: number) {
      timeRate = rateSecPerSec;
      if (rateSecPerSec === 1) {
        simDateMs = Date.now();
      }
      emitStatus(lastEmittedStage || 'J2000 Solar System', tourTime / TOUR_DURATION_SEC, phase === 'ocean' ? 0 : 1);
    },

    jumpToToday() {
      simDateMs = Date.now();
      timeRate = 1;
      if (phase !== 'ocean') {
        updateCelestialState(0, 1);
      }
      emitStatus(lastEmittedStage || 'Live J2000 Today', tourTime / TOUR_DURATION_SEC, phase === 'ocean' ? 0 : 1);
    },

    focusBody(name: SolarBodyName) {
      if (disposed) return;
      selectedBody = name;
      if (phase === 'ocean') {
        updateCelestialState(0, 1);
        getSelectedAnchorWorldPos(_focusPos);
        phase = 'orbiting';
        tourTime = TOUR_DURATION_SEC * 0.48;
        currentLookAt.copy(_focusPos);
        const initDist =
          name === 'Sun'
            ? scaleMode === 'true-au'
              ? 185.0
              : 62.0
            : THREE.MathUtils.clamp(REAL_BODIES_META[name].showcaseRadius * 4.2, 2.2, 13.5);
        camera.position.set(
          _focusPos.x + Math.cos(orbitYaw) * initDist * 1.4,
          _focusPos.y + initDist * 0.45,
          _focusPos.z + Math.sin(orbitYaw) * initDist * 1.4
        );
      } else {
        phase = 'orbiting';
      }

      const meta = REAL_BODIES_META[name];
      if (name === 'Sun') {
        orbitDistanceTarget = scaleMode === 'true-au' ? 185.0 : 62.0;
        orbitFocusMixTarget = 1;
        orbitPitch = 0.44;
      } else {
        orbitFocusMixTarget = 0;
        orbitDistanceTarget = THREE.MathUtils.clamp(meta.showcaseRadius * 4.2, 2.2, 13.5);
        orbitPitch = 0.24;
      }
      emitStatus(
        name === 'Sun'
          ? 'J2000 Solar System · Click Planet to Inspect'
          : `Inspecting ${name} · Drag to Orbit`,
        tourTime / TOUR_DURATION_SEC,
        1
      );
      startLoop();
    },

    setEcoMode(eco: boolean) {
      ecoMode = eco;
      syncVisibility();
    },

    setShowBeltsAndGrid(show: boolean) {
      showBeltsAndGrid = show;
      syncVisibility();
    },

    setRenderProfile(profile: { dpr: number; minFrameMs: number }) {
      targetDpr = isSoftwareGl ? 1 : Math.max(0.7, Math.min(1.75, profile.dpr));
      targetMinFrameMs = Math.max(0, profile.minFrameMs);
      renderer.setPixelRatio(targetDpr);
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      renderer.setSize(w, h);
    },

    syncParameters(params: GalacticSyncParams) {
      syncMoonPhaseFraction = params.moonPhaseFraction;
      syncDayFraction = params.sunPhaseDayFraction;
    },

    dispose() {
      disposed = true;
      loopRunning = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      resizeObserver?.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointercancel', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);

      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (domEl.parentNode === container) {
        container.removeChild(domEl);
      }
    },
  };
}
