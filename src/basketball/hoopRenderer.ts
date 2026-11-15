import {
  BALL_RADIUS,
  BOARD_BOTTOM_Y,
  BOARD_THICKNESS,
  BOARD_TOP_Y,
  BOARD_X,
  DEFAULT_SHOOT_X,
  FLOOR_Y,
  GRAVITY,
  NET_COLS,
  NET_ROWS,
  RIM_CENTER_X,
  RIM_DEPTH_RY,
  RIM_HALF_W,
  RIM_TUBE_RADIUS,
  RIM_Y,
  WORLD_H,
  WORLD_W,
  type BasketballState,
  type HoopOffset,
  type NetNode,
  type RimSpringState,
  type ShooterMode,
  type TrailPoint,
} from './hoopPhysics';
import {
  drawBasketballPlayer,
  type CourtVenue,
  type ShooterState,
} from './shooterIK';

export interface SwishRing {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface CameraFlash {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  flipPhase: number;
  flipSpeed: number;
  flutterFreq: number;
  w: number;
  h: number;
  color: string;
  life: number;
  maxLife: number;
  settled?: boolean;
}

export interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  growth: number;
  alpha: number;
  life: number;
  maxLife: number;
  tint: string;
}

export interface HoopRenderState {
  venue: CourtVenue;
  shooterMode: ShooterMode;
  shooter: ShooterState;
  ball: BasketballState;
  rim: RimSpringState;
  nodes: NetNode[];
  trail: TrailPoint[];
  rings: SwishRing[];
  confetti: ConfettiPiece[];
  smokePuffs: SmokePuff[];
  flashes: CameraFlash[];
  hoopOffset: HoopOffset;
  movingHoopActive: boolean;
  crowdExcitement: number;
  goalLightFlash: number;
  boardFlash?: number;
  shotClockSec: number;
  makes: number;
  streak: number;
  bannerAlert: string;
  isDraggingAim: boolean;
  aimOriginX?: number;
  aimOriginY?: number;
  aimTargetX?: number | null;
  aimTargetY?: number | null;
  aimVx: number;
  aimVy: number;
  shake: number;
  timeSec: number;
}

const PAD_X = 640;
const PAD_TOP = 360;
const PAD_BOTTOM = 240;
const BACKDROP_W = WORLD_W + PAD_X * 2;
const BACKDROP_H = WORLD_H + PAD_TOP + PAD_BOTTOM;

const cachedVenues: Partial<Record<CourtVenue, HTMLCanvasElement>> = {};
let cachedBallSprite: HTMLCanvasElement | null = null;

export function computeCourtViewport(
  cssW: number,
  cssH: number
): { scale: number; offsetX: number; offsetY: number } {
  const safeW = Math.max(1, cssW);
  const safeH = Math.max(1, cssH);
  const scale = Math.min(safeW / WORLD_W, safeH / WORLD_H);
  const offsetX = (safeW - WORLD_W * scale) * 0.5;
  const offsetY = (safeH - WORLD_H * scale) * 0.5;
  return { scale, offsetX, offsetY };
}

function makeVenueCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = BACKDROP_W;
  canvas.height = BACKDROP_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(PAD_X, PAD_TOP);
  }
  return [canvas, ctx];
}

function drawFullCourtMarkings(
  ctx: CanvasRenderingContext2D,
  lineColor: string,
  paintColor: string,
  centerFill: string
) {
  // Painted key / lane on perspective floor trapezoid
  ctx.fillStyle = paintColor;
  ctx.beginPath();
  ctx.moveTo(742, FLOOR_Y);
  ctx.lineTo(1002, FLOOR_Y);
  ctx.lineTo(1042, WORLD_H);
  ctx.lineTo(705, WORLD_H);
  ctx.closePath();
  ctx.fill();

  // Center-court circle on far left half-court edge
  ctx.fillStyle = centerFill;
  ctx.beginPath();
  ctx.ellipse(115, FLOOR_Y + 42, 92, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;

  // Half-court division line
  ctx.beginPath();
  ctx.moveTo(118, FLOOR_Y);
  ctx.lineTo(92, WORLD_H);
  ctx.stroke();

  // Center circle outline
  ctx.beginPath();
  ctx.ellipse(115, FLOOR_Y + 42, 92, 22, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Baseline, sideline & paint lane outline
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 1);
  ctx.lineTo(WORLD_W, FLOOR_Y + 1);
  ctx.moveTo(742, FLOOR_Y + 1);
  ctx.lineTo(705, WORLD_H);
  ctx.moveTo(1002, FLOOR_Y + 1);
  ctx.lineTo(1042, WORLD_H);
  ctx.stroke();

  // Free-throw arc & 3-point arc in perspective projection
  ctx.beginPath();
  ctx.ellipse(732, FLOOR_Y + 38, 62, 16, 0, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(418, FLOOR_Y + 1);
  ctx.quadraticCurveTo(382, FLOOR_Y + 52, 468, WORLD_H);
  ctx.stroke();

  // Court tick hash marks along lane
  for (let i = 0; i < 4; i++) {
    const hx = 788 + i * 44;
    ctx.beginPath();
    ctx.moveTo(hx, FLOOR_Y + 1);
    ctx.lineTo(hx - 6, FLOOR_Y + 12);
    ctx.stroke();
  }
}

function buildArenaBackdrop(): HTMLCanvasElement {
  const [canvas, ctx] = makeVenueCanvas();
  if (!ctx) return canvas;

  const leftX = -PAD_X;
  const rightX = WORLD_W + PAD_X;
  const spanW = BACKDROP_W;

  const skyGrad = ctx.createLinearGradient(0, -PAD_TOP, 0, FLOOR_Y);
  skyGrad.addColorStop(0, '#050812');
  skyGrad.addColorStop(0.35, '#070c1a');
  skyGrad.addColorStop(0.62, '#0d162c');
  skyGrad.addColorStop(0.86, '#162340');
  skyGrad.addColorStop(1, '#232e4d');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(leftX, -PAD_TOP, spanW, FLOOR_Y + PAD_TOP + 4);

  // Arena ceiling trusses across full extended width
  ctx.fillStyle = '#080d1a';
  ctx.fillRect(leftX, -PAD_TOP, spanW, 52 + PAD_TOP);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 2.0;
  for (let x = leftX; x < rightX; x += 105) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 52.5, 52);
    ctx.lineTo(x + 105, 0);
    ctx.stroke();
  }

  // Warm overhead floodlight cones
  const lights = [-210, 210, 620, 1020, 1440];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < lights.length; i++) {
    const lx = lights[i];
    const cone = ctx.createRadialGradient(lx, 52, 10, lx, 265, 490);
    cone.addColorStop(0, 'rgba(255, 234, 188, 0.16)');
    cone.addColorStop(0.45, 'rgba(255, 200, 130, 0.065)');
    cone.addColorStop(1, 'rgba(255, 200, 130, 0)');
    ctx.fillStyle = cone;
    ctx.fillRect(lx - 490, 26, 980, FLOOR_Y - 26);
  }
  ctx.restore();

  for (let i = 0; i < lights.length; i++) {
    const lx = lights[i];
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(lx - 34, 38, 68, 14);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(lx - 26, 48, 52, 5);
  }

  // Multi-tiered bleacher structure extending into fullscreen margins
  const tierColors = ['#0c1326', '#101931', '#14203c', '#182647'];
  const tierTops = [345, 420, 495, 565];
  for (let t = 0; t < tierTops.length; t++) {
    const ty = tierTops[t];
    ctx.fillStyle = tierColors[t];
    ctx.fillRect(leftX, ty, spanW, FLOOR_Y - ty);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.fillRect(leftX, ty, spanW, 2);
  }

  // Far-tier static silhouette spectators for dense arena depth
  ctx.fillStyle = 'rgba(7, 11, 24, 0.78)';
  for (let sx = leftX + 10; sx < rightX; sx += 19) {
    const hash = (Math.abs(sx * 37) % 11) / 11;
    if (hash < 0.15) continue;
    const headY = 340 - hash * 6;
    ctx.beginPath();
    ctx.arc(sx, headY, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx - 5, headY + 3.5, 10, 12, 2);
    ctx.fill();
  }

  // Illuminated arena fascia ribbon
  ctx.fillStyle = '#090d1a';
  ctx.fillRect(leftX, 470, spanW, 24);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  ctx.fillRect(leftX, 472, spanW, 20);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.62)';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'middle';
  const bannerLabels = [
    'METRO ARENA',
    'FULL COURT',
    '3-STREAK = MOVING HOOP',
    'BREAKAWAY RIM',
  ];
  for (let i = -2; i < 8; i++) {
    ctx.fillText(
      bannerLabels[((i % bannerLabels.length) + bannerLabels.length) % bannerLabels.length],
      36 + i * 245,
      482
    );
  }

  // Courtside padded apron wall
  ctx.fillStyle = '#0b1222';
  ctx.fillRect(leftX, FLOOR_Y - 30, spanW, 30);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(leftX, FLOOR_Y - 30, spanW, 4);

  // Maple hardwood floor extending cleanly into bottom/side margins
  const floorBottom = WORLD_H + PAD_BOTTOM;
  const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, floorBottom);
  floorGrad.addColorStop(0, '#ce8646');
  floorGrad.addColorStop(0.14, '#a8622d');
  floorGrad.addColorStop(0.55, '#6c3b19');
  floorGrad.addColorStop(1, '#3b1f0c');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(leftX, FLOOR_Y, spanW, floorBottom - FLOOR_Y);

  for (let r = 0; r < 18; r++) {
    const py = FLOOR_Y + r * 15;
    if (r % 2 === 1) {
      ctx.fillStyle = 'rgba(255, 224, 178, 0.05)';
      ctx.fillRect(leftX, py, spanW, 15);
    }
    ctx.strokeStyle = 'rgba(65, 32, 10, 0.25)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(leftX, py);
    ctx.lineTo(rightX, py);
    ctx.stroke();
  }

  drawFullCourtMarkings(
    ctx,
    'rgba(248, 250, 252, 0.88)',
    'rgba(30, 58, 138, 0.72)',
    'rgba(29, 78, 216, 0.48)'
  );

  // Overhead floor sheen
  const sheen = ctx.createRadialGradient(780, FLOOR_Y + 26, 20, 780, FLOOR_Y + 26, 410);
  sheen.addColorStop(0, 'rgba(255, 232, 185, 0.24)');
  sheen.addColorStop(0.5, 'rgba(255, 198, 126, 0.09)');
  sheen.addColorStop(1, 'rgba(255, 198, 126, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(320, FLOOR_Y, 960, WORLD_H - FLOOR_Y);

  return canvas;
}

function buildStreetballBackdrop(): HTMLCanvasElement {
  const [canvas, ctx] = makeVenueCanvas();
  if (!ctx) return canvas;

  const leftX = -PAD_X;
  const rightX = WORLD_W + PAD_X;
  const spanW = BACKDROP_W;

  // Sunlit late-afternoon golden-hour sky
  const skyGrad = ctx.createLinearGradient(0, -PAD_TOP, 0, FLOOR_Y);
  skyGrad.addColorStop(0, '#0369a1');
  skyGrad.addColorStop(0.28, '#0284c7');
  skyGrad.addColorStop(0.58, '#38bdf8');
  skyGrad.addColorStop(0.84, '#bae6fd');
  skyGrad.addColorStop(1, '#fed7aa');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(leftX, -PAD_TOP, spanW, FLOOR_Y + PAD_TOP + 4);

  // Warm afternoon sun halo
  const sunGrad = ctx.createRadialGradient(240, 145, 14, 240, 145, 220);
  sunGrad.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
  sunGrad.addColorStop(0.22, 'rgba(253, 224, 71, 0.42)');
  sunGrad.addColorStop(1, 'rgba(253, 186, 116, 0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(-100, -100, 620, 500);

  // Soft sunlit clouds
  ctx.fillStyle = 'rgba(255, 250, 240, 0.65)';
  const clouds = [
    [-220, 112, 84, 20],
    [180, 95, 76, 18],
    [490, 128, 92, 22],
    [880, 82, 108, 24],
    [1140, 140, 74, 17],
    [1520, 108, 90, 20],
  ];
  for (const [cx, cy, rx, ry] of clouds) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - rx * 0.4, cy + 4, rx * 0.55, ry * 0.75, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + rx * 0.42, cy + 5, rx * 0.5, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant sunlit city skyline silhouettes extending across padded width
  ctx.fillStyle = '#475569';
  const buildings = [
    [-540, 410, 86, 170],
    [-420, 386, 78, 194],
    [-310, 425, 92, 155],
    [-190, 378, 84, 202],
    [-85, 420, 74, 160],
    [20, 415, 78, 165],
    [110, 382, 66, 198],
    [186, 435, 92, 145],
    [340, 365, 84, 215],
    [435, 420, 72, 160],
    [590, 395, 90, 185],
    [710, 430, 82, 150],
    [860, 372, 95, 208],
    [972, 412, 76, 168],
    [1088, 388, 92, 192],
    [1192, 430, 88, 150],
    [1310, 390, 84, 190],
    [1420, 418, 96, 162],
    [1545, 376, 82, 204],
    [1655, 415, 95, 165],
  ];
  for (const [bx, by, bw, bh] of buildings) {
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
    for (let wy = by + 14; wy < FLOOR_Y - 120; wy += 20) {
      for (let wx = bx + 10; wx < bx + bw - 12; wx += 16) {
        if ((Math.abs(wx) + wy) % 3 !== 0) {
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
    ctx.fillStyle = '#475569';
  }

  // Lush park treeline silhouette along back fence
  for (let tx = leftX + 28; tx < rightX; tx += 74) {
    const r = 42 + (Math.abs(tx * 17) % 24);
    ctx.fillStyle = Math.abs(tx) % 148 < 74 ? '#15803d' : '#166534';
    ctx.beginPath();
    ctx.arc(tx, FLOOR_Y - 115, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(tx - r * 0.22, FLOOR_Y - 128, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Park concrete apron behind fence
  ctx.fillStyle = '#334155';
  ctx.fillRect(leftX, FLOOR_Y - 118, spanW, 118);

  // Chain-link perimeter fence
  const fenceTop = FLOOR_Y - 165;
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let x = leftX - 140; x < rightX + 140; x += 22) {
    ctx.moveTo(x, fenceTop);
    ctx.lineTo(x + 115, FLOOR_Y);
    ctx.moveTo(x + 115, fenceTop);
    ctx.lineTo(x, FLOOR_Y);
  }
  ctx.stroke();

  // Fence posts & top steel rail
  ctx.fillStyle = '#64748b';
  ctx.fillRect(leftX, fenceTop - 3, spanW, 5);
  for (let px = leftX + 40; px < rightX; px += 180) {
    ctx.fillRect(px - 3, fenceTop - 6, 6, 171);
  }

  // Painted streetball outdoor blacktop
  const floorBottom = WORLD_H + PAD_BOTTOM;
  const courtGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, floorBottom);
  courtGrad.addColorStop(0, '#1e293b');
  courtGrad.addColorStop(0.25, '#0f172a');
  courtGrad.addColorStop(1, '#05080f');
  ctx.fillStyle = courtGrad;
  ctx.fillRect(leftX, FLOOR_Y, spanW, floorBottom - FLOOR_Y);

  // Subtle weathered asphalt speckle
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  for (let i = 0; i < 420; i++) {
    const ax = leftX + ((i * 157) % spanW);
    const ay = FLOOR_Y + 4 + ((i * 53) % (floorBottom - FLOOR_Y - 8));
    ctx.fillRect(ax, ay, 2, 1.5);
  }

  drawFullCourtMarkings(
    ctx,
    'rgba(248, 250, 252, 0.92)',
    'rgba(15, 118, 110, 0.85)',
    'rgba(234, 88, 12, 0.65)'
  );

  // Overhead outdoor steel gantry poles anchoring the streetball track
  ctx.fillStyle = '#334155';
  ctx.fillRect(740, 56, 16, FLOOR_Y - 56);
  ctx.fillRect(1176, 56, 16, FLOOR_Y - 56);

  return canvas;
}

function buildRetroGymBackdrop(): HTMLCanvasElement {
  const [canvas, ctx] = makeVenueCanvas();
  if (!ctx) return canvas;

  const leftX = -PAD_X;
  const rightX = WORLD_W + PAD_X;
  const spanW = BACKDROP_W;

  // Classic warm varsity gymnasium plaster + brick upper wall
  const wallGrad = ctx.createLinearGradient(0, -PAD_TOP, 0, FLOOR_Y);
  wallGrad.addColorStop(0, '#1c110b');
  wallGrad.addColorStop(0.32, '#271912');
  wallGrad.addColorStop(0.62, '#432818');
  wallGrad.addColorStop(0.84, '#6b3e26');
  wallGrad.addColorStop(1, '#854d27');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(leftX, -PAD_TOP, spanW, FLOOR_Y + PAD_TOP);

  // Gymnasium wood rafters
  ctx.fillStyle = '#1c110b';
  ctx.fillRect(leftX, -PAD_TOP, spanW, 50 + PAD_TOP);
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
  ctx.lineWidth = 3;
  for (let x = leftX; x < rightX; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 80, 50);
    ctx.lineTo(x + 160, 0);
    ctx.stroke();
  }

  // Sunlit high gymnasium clerestory windows + warm sun shafts
  for (let wx = -260; wx < 720; wx += 165) {
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(wx, 120, 112, 62);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 4;
    ctx.strokeRect(wx, 120, 112, 62);
    ctx.beginPath();
    ctx.moveTo(wx + 56, 120);
    ctx.lineTo(wx + 56, 182);
    ctx.moveTo(wx, 151);
    ctx.lineTo(wx + 112, 151);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = 'rgba(254, 243, 199, 0.06)';
    ctx.beginPath();
    ctx.moveTo(wx, 182);
    ctx.lineTo(wx + 112, 182);
    ctx.lineTo(wx + 230, FLOOR_Y);
    ctx.lineTo(wx + 60, FLOOR_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Championship & varsity banners hanging from rafters
  const banners = [
    { x: -120, color: '#1e3a8a', label: '1982' },
    { x: 145, color: '#991b1b', label: '1988' },
    { x: 255, color: '#1e3a8a', label: '1994' },
    { x: 365, color: '#991b1b', label: 'STATE' },
    { x: 760, color: '#1e3a8a', label: 'CHAMPS' },
    { x: 1320, color: '#991b1b', label: 'VARSITY' },
  ];
  for (const b of banners) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.x, 54);
    ctx.lineTo(b.x + 58, 54);
    ctx.lineTo(b.x + 58, 126);
    ctx.lineTo(b.x + 29, 140);
    ctx.lineTo(b.x, 126);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + 29, 98);
  }

  // Oak wainscoting & padded gym baseline wall
  ctx.fillStyle = '#5c331c';
  ctx.fillRect(leftX, FLOOR_Y - 190, spanW, 190);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(leftX, FLOOR_Y - 194, spanW, 6);

  // Pull-out wooden varsity bleachers extending left for fullscreen
  for (let row = 0; row < 4; row++) {
    const ry = FLOOR_Y - 150 + row * 30;
    ctx.fillStyle = row % 2 === 0 ? '#92400e' : '#b45309';
    ctx.fillRect(leftX + 20, ry, 730 - leftX, 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(leftX + 20, ry + 18, 730 - leftX, 12);
  }

  // Crimson varsity wall pads behind baseline
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(740, FLOOR_Y - 96, rightX - 740, 96);
  ctx.fillStyle = '#b91c1c';
  for (let px = 748; px < rightX - 10; px += 48) {
    ctx.fillRect(px, FLOOR_Y - 92, 42, 92);
  }

  // Varnished honey-oak retro floor extending cleanly into bottom/side margins
  const floorBottom = WORLD_H + PAD_BOTTOM;
  const oakGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, floorBottom);
  oakGrad.addColorStop(0, '#eab364');
  oakGrad.addColorStop(0.16, '#c88232');
  oakGrad.addColorStop(0.58, '#854d17');
  oakGrad.addColorStop(1, '#4a290a');
  ctx.fillStyle = oakGrad;
  ctx.fillRect(leftX, FLOOR_Y, spanW, floorBottom - FLOOR_Y);

  for (let r = 0; r < 19; r++) {
    const py = FLOOR_Y + r * 14;
    if (r % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 245, 220, 0.08)';
      ctx.fillRect(leftX, py, spanW, 14);
    }
    ctx.strokeStyle = 'rgba(92, 45, 10, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, py);
    ctx.lineTo(rightX, py);
    ctx.stroke();
  }

  drawFullCourtMarkings(
    ctx,
    'rgba(254, 243, 199, 0.92)',
    'rgba(153, 27, 27, 0.82)',
    'rgba(185, 28, 28, 0.65)'
  );

  return canvas;
}

function getVenueBackdrop(venue: CourtVenue): HTMLCanvasElement {
  const existing = cachedVenues[venue];
  if (existing) return existing;
  const built =
    venue === 'streetball'
      ? buildStreetballBackdrop()
      : venue === 'retro_gym'
        ? buildRetroGymBackdrop()
        : buildArenaBackdrop();
  cachedVenues[venue] = built;
  return built;
}

function getBallSprite(): HTMLCanvasElement {
  if (cachedBallSprite) return cachedBallSprite;

  const size = 96;
  const r = 44;
  const cx = size * 0.5;
  const cy = size * 0.5;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.translate(cx, cy);

  const grad = ctx.createRadialGradient(-r * 0.34, -r * 0.36, r * 0.14, 0, 0, r * 1.08);
  grad.addColorStop(0, '#ffa145');
  grad.addColorStop(0.55, '#ea580c');
  grad.addColorStop(1, '#7c2d12');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.fillStyle = 'rgba(67, 20, 7, 0.22)';
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const px = i * 10 + (j % 2) * 5;
      const py = j * 10;
      if (px * px + py * py < (r - 6) * (r - 6)) {
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = 'rgba(28, 12, 4, 0.88)';
  ctx.lineWidth = 4.0;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-r * 0.85, 0, r * 0.92, -0.82, 0.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.85, 0, r * 0.92, Math.PI - 0.82, Math.PI + 0.82);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(67, 20, 7, 0.72)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  cachedBallSprite = canvas;
  return canvas;
}

export function clientToCourtCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { x: number; y: number } {
  const cssW = rect.width || window.innerWidth;
  const cssH = rect.height || window.innerHeight;
  const { scale, offsetX, offsetY } = computeCourtViewport(cssW, cssH);
  return {
    x: (clientX - rect.left - offsetX) / scale,
    y: (clientY - rect.top - offsetY) / scale,
  };
}

function drawSpectatorFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  shirtColor: string,
  skinColor: string,
  scale: number,
  jumpPx: number,
  armRaise: number,
  lookBias: number,
  hasTowel = false
) {
  const y = baseY - jumpPx;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Torso / shirt
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.roundRect(-8, -14, 16, 20, 4);
  ctx.fill();

  // Animated cheering arms
  const shoulderY = -11;
  const handY = shoulderY + 7 - armRaise * 21;
  ctx.strokeStyle = shirtColor;
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, shoulderY);
  ctx.lineTo(-12 - armRaise * 2, handY);
  ctx.moveTo(7, shoulderY);
  ctx.lineTo(12 + armRaise * 2, handY);
  ctx.stroke();

  if (hasTowel && armRaise > 0.35) {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(9, handY - 12, 8, 13, 2);
    ctx.fill();
  }

  // Head subtly tracking the ball
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(lookBias * 1.6, -21, 5.8, 0, Math.PI * 2);
  ctx.fill();

  // Hair cap
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(lookBias * 1.2, -22.2, 5.7, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAnimatedCrowdAndFlashes(
  ctx: CanvasRenderingContext2D,
  state: HoopRenderState,
  minWorldX: number,
  maxWorldX: number
) {
  const { venue, crowdExcitement, timeSec, ball, flashes } = state;
  const lookBias = Math.max(-1, Math.min(1, (ball.x - 640) / 500));
  const skins = ['#d99b72', '#a8714e', '#e7b992', '#8c5838'];
  const clampedMinX = Math.max(-PAD_X + 20, minWorldX - 30);
  const clampedMaxX = Math.min(WORLD_W + PAD_X - 20, maxWorldX + 30);

  if (venue === 'arena') {
    const shirts = ['#1d4ed8', '#f59e0b', '#e2e8f0', '#dc2626', '#334155', '#0284c7'];
    const rowBases = [414, 488, 558, 634];
    for (let r = 0; r < rowBases.length; r++) {
      const step = r < 2 ? 42 : 48;
      const scale = 0.72 + r * 0.11;
      const firstI = Math.floor((clampedMinX - 24) / step);
      const lastI = Math.ceil((clampedMaxX - 24) / step);
      for (let i = firstI; i <= lastI; i++) {
        const sx = 24 + i * step + (r % 2) * 18;
        if (sx < clampedMinX || sx > clampedMaxX) continue;
        const hash = Math.abs(i * 17 + r * 31) % 13;
        if (hash === 0) continue;
        const wave = Math.sin(timeSec * 12.5 - i * 0.45 - r * 0.7);
        const jumpPx =
          crowdExcitement > 0.04
            ? Math.max(0, wave * 0.5 + 0.5) * 18 * crowdExcitement
            : Math.sin(timeSec * 2.1 + i) * 1.1;
        const armRaise =
          crowdExcitement > 0.05
            ? Math.min(1, crowdExcitement * (0.6 + 0.4 * Math.abs(wave)))
            : (hash % 5 === 0 ? 0.18 : 0.04);
        drawSpectatorFigure(
          ctx,
          sx,
          rowBases[r],
          shirts[(((i + r) % shirts.length) + shirts.length) % shirts.length],
          skins[(((i + r * 2) % skins.length) + skins.length) % skins.length],
          scale,
          jumpPx,
          armRaise,
          lookBias
        );
      }
    }

    // Arena camera flash pops in the bleachers
    if (flashes.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        const alpha = Math.max(0, f.life / f.maxLife);
        const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.radius);
        g.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(3)})`);
        g.addColorStop(0.35, `rgba(219, 234, 254, ${(alpha * 0.55).toFixed(3)})`);
        g.addColorStop(1, 'rgba(219, 234, 254, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (venue === 'streetball') {
    const shirts = ['#f97316', '#0f766e', '#eab308', '#ef4444', '#f8fafc', '#3b82f6'];
    const firstI = Math.floor((clampedMinX - 46) / 52);
    const lastI = Math.ceil((clampedMaxX - 46) / 52);
    for (let i = firstI; i <= lastI; i++) {
      const sx = 46 + i * 52;
      if (sx < clampedMinX || sx > clampedMaxX) continue;
      const wave = Math.sin(timeSec * 11.5 - i * 0.55);
      const jumpPx =
        crowdExcitement > 0.04
          ? Math.max(0, wave * 0.5 + 0.5) * 20 * crowdExcitement
          : Math.abs(Math.sin(timeSec * 2.5 + i)) * 1.6;
      const armRaise =
        crowdExcitement > 0.05
          ? Math.min(1, crowdExcitement * (0.65 + 0.35 * Math.abs(wave)))
          : 0.1;
      drawSpectatorFigure(
        ctx,
        sx,
        FLOOR_Y - 12,
        shirts[((i % shirts.length) + shirts.length) % shirts.length],
        skins[(((i * 3) % skins.length) + skins.length) % skins.length],
        1.02,
        jumpPx,
        armRaise,
        lookBias
      );
    }
  } else {
    // Retro Gym: cheering bleachers + uniformed bench players leaping off the bench
    const bleacherShirts = ['#991b1b', '#fde68a', '#1e3a8a', '#f8fafc'];
    const firstBleacherI = Math.floor((clampedMinX - 54) / 44);
    const lastBleacherI = Math.min(15, Math.ceil((725 - 54) / 44));
    for (let r = 0; r < 3; r++) {
      const by = FLOOR_Y - 134 + r * 30;
      for (let i = firstBleacherI; i <= lastBleacherI; i++) {
        const sx = 54 + i * 44;
        if (sx < clampedMinX || sx > 725) continue;
        const wave = Math.sin(timeSec * 12.0 - i * 0.5 - r * 0.6);
        const jumpPx =
          crowdExcitement > 0.04
            ? Math.max(0, wave * 0.5 + 0.5) * 16 * crowdExcitement
            : 0;
        const armRaise = crowdExcitement > 0.05 ? crowdExcitement : 0.05;
        drawSpectatorFigure(
          ctx,
          sx,
          by,
          bleacherShirts[(((i + r) % bleacherShirts.length) + bleacherShirts.length) % bleacherShirts.length],
          skins[(((i + r) % skins.length) + skins.length) % skins.length],
          0.76,
          jumpPx,
          armRaise,
          lookBias
        );
      }
    }

    // Wooden team bench on courtside + 6 bench teammates jumping up on makes!
    ctx.fillStyle = '#451a03';
    ctx.fillRect(110, FLOOR_Y - 22, 415, 7);
    ctx.fillRect(130, FLOOR_Y - 15, 8, 15);
    ctx.fillRect(495, FLOOR_Y - 15, 8, 15);

    for (let i = 0; i < 6; i++) {
      const bx = 148 + i * 62;
      const wave = Math.sin(timeSec * 13.5 - i * 0.55);
      const jumpPx =
        crowdExcitement > 0.05
          ? 14 + Math.max(0, wave * 0.5 + 0.5) * 24 * crowdExcitement
          : 0;
      const armRaise =
        crowdExcitement > 0.05
          ? Math.min(1, crowdExcitement * 1.1)
          : 0.06;
      drawSpectatorFigure(
        ctx,
        bx,
        FLOOR_Y - 24,
        i === 0 ? '#1e293b' : '#b91c1c',
        skins[i % skins.length],
        1.12,
        jumpPx,
        armRaise,
        lookBias,
        i % 2 === 1
      );
    }
  }
}

function drawJumbotronAndShotClock(
  ctx: CanvasRenderingContext2D,
  state: HoopRenderState
) {
  const { venue, makes, streak, shotClockSec, movingHoopActive, bannerAlert, goalLightFlash, timeSec } = state;
  const cx = 560;
  const topY = venue === 'streetball' ? 30 : 38;

  // Suspension cables / outdoor post
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  if (venue === 'streetball') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 5, topY + 66, 10, FLOOR_Y - (topY + 66) - 165);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 72, 0);
    ctx.lineTo(cx - 72, topY);
    ctx.moveTo(cx + 72, 0);
    ctx.lineTo(cx + 72, topY);
    ctx.stroke();
  }

  // Main Jumbotron chassis
  const w = 236;
  const h = 68;
  const x = cx - w * 0.5;
  ctx.save();
  ctx.fillStyle = '#090d1a';
  ctx.strokeStyle =
    goalLightFlash > 0.1
      ? `rgba(251, 191, 36, ${(0.55 + goalLightFlash * 0.45).toFixed(2)})`
      : movingHoopActive
        ? '#f59e0b'
        : '#334155';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(x, topY, w, h, 8);
  ctx.fill();
  ctx.stroke();

  // Scoreboard labels & tabular numbers
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HOME', x + 42, topY + 15);
  ctx.fillText('CLOCK', cx, topY + 15);
  ctx.fillText('STREAK', x + w - 42, topY + 15);

  ctx.fillStyle = '#fef3c7';
  ctx.font = '800 20px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(String(makes).padStart(2, '0'), x + 42, topY + 37);

  ctx.fillStyle = shotClockSec <= 5 ? '#f87171' : '#fbbf24';
  ctx.fillText(shotClockSec.toFixed(1), cx, topY + 37);

  ctx.fillStyle = streak >= 3 ? '#fb923c' : '#e2e8f0';
  ctx.fillText(String(streak), x + w - 42, topY + 37);

  // Lower alert strip on Jumbotron
  ctx.fillStyle =
    goalLightFlash > 0.15
      ? 'rgba(245, 158, 11, 0.25)'
      : 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(x + 8, topY + 46, w - 16, 16);

  const pulse = Math.sin(timeSec * 9) > 0;
  ctx.fillStyle =
    goalLightFlash > 0.15
      ? '#fde68a'
      : movingHoopActive
        ? pulse
          ? '#fbbf24'
          : '#fb923c'
        : '#94a3b8';
  ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  const msg =
    goalLightFlash > 0.15 && bannerAlert
      ? bannerAlert
      : movingHoopActive
        ? 'MOTORIZED TRACK ACTIVE'
        : 'ARCADE HOOPS LIVE';
  ctx.fillText(msg, cx, topY + 57);
  ctx.restore();
}

function drawMotorizedTrackAndBackboard(
  ctx: CanvasRenderingContext2D,
  rim: RimSpringState,
  hoopOffset: HoopOffset,
  movingHoopActive: boolean,
  goalLightFlash: number,
  timeSec: number
) {
  const flex = rim.boardFlex;
  const bx = BOARD_X + hoopOffset.x + flex;
  const boardTop = BOARD_TOP_Y + hoopOffset.y;
  const boardBottom = BOARD_BOTTOM_Y + hoopOffset.y;
  const rimCx = RIM_CENTER_X + hoopOffset.x;
  const rimRightX = rimCx + RIM_HALF_W;
  const rimCy = RIM_Y + hoopOffset.y;
  const hingePivotX = rimRightX + 6;
  const flangeRimY =
    rimCy + rim.offsetY - (rimRightX - hingePivotX) * Math.sin(rim.tilt);

  // -------------------------------------------------------------------------
  // 1. Motorized Overhead Steel I-Beam Rail Track & Rolling Trolley Carriage
  // -------------------------------------------------------------------------
  const trackLeft = 740;
  const trackRight = 1190;
  const trackY = 64;

  // Ceiling / gantry support hangers
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(trackLeft + 24, 0, 12, trackY);
  ctx.fillRect(trackRight - 36, 0, 12, trackY);

  // Steel I-beam rail
  ctx.fillStyle = '#334155';
  ctx.fillRect(trackLeft, trackY, trackRight - trackLeft, 16);
  ctx.fillStyle = '#475569';
  ctx.fillRect(trackLeft, trackY, trackRight - trackLeft, 4);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(trackLeft, trackY + 13, trackRight - trackLeft, 3);

  // Track end-stop bumpers
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(trackLeft, trackY - 2, 10, 20);
  ctx.fillRect(trackRight - 10, trackY - 2, 10, 20);

  // Rolling trolley carriage synced directly to backboard horizontal offset
  const carriageCx = bx + BOARD_THICKNESS + 32;
  const carriageW = 84;
  const carriageX = carriageCx - carriageW * 0.5;

  // Flexing power festoon cable from left gantry end to carriage
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(trackLeft + 26, trackY + 16);
  const loops = 4;
  const span = Math.max(40, carriageX - (trackLeft + 26));
  for (let l = 0; l < loops; l++) {
    const lx0 = trackLeft + 26 + (span * l) / loops;
    const lx1 = trackLeft + 26 + (span * (l + 1)) / loops;
    const sag = 18 + (1 - span / 320) * 14;
    ctx.quadraticCurveTo((lx0 + lx1) * 0.5, trackY + 16 + sag, lx1, trackY + 16);
  }
  ctx.stroke();

  // Motorized carriage housing & wheels
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = movingHoopActive ? '#f59e0b' : '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(carriageX, trackY - 6, carriageW, 28, 5);
  ctx.fill();
  ctx.stroke();

  const wheelAngle = hoopOffset.x * 0.12;
  for (const wx of [carriageX + 16, carriageX + carriageW - 16]) {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(wx, trackY + 8, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(wheelAngle) * 5, trackY + 8 + Math.sin(wheelAngle) * 5);
    ctx.lineTo(wx - Math.cos(wheelAngle) * 5, trackY + 8 - Math.sin(wheelAngle) * 5);
    ctx.stroke();
  }

  // Amber warning strobe beacon on motorized trolley
  const strobeOn = movingHoopActive && Math.sin(timeSec * 12) > 0;
  ctx.fillStyle = strobeOn ? '#fbbf24' : movingHoopActive ? '#92400e' : '#475569';
  ctx.beginPath();
  ctx.arc(carriageCx, trackY - 10, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (strobeOn) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.beginPath();
    ctx.arc(carriageCx, trackY - 10, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dual telescoping hydraulic suspension struts connecting carriage to backboard
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(carriageCx - 16, trackY + 22);
  ctx.lineTo(bx + BOARD_THICKNESS + 14, boardTop + 56);
  ctx.moveTo(carriageCx + 18, trackY + 22);
  ctx.lineTo(bx + BOARD_THICKNESS + 16, boardBottom - 44);
  ctx.stroke();

  ctx.strokeStyle = movingHoopActive ? '#f59e0b' : '#94a3b8';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(carriageCx - 16, trackY + 24);
  ctx.lineTo(bx + BOARD_THICKNESS + 14, boardTop + 56);
  ctx.stroke();

  // Horizontal backboard mounting yoke
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(bx + BOARD_THICKNESS, boardTop + 56);
  ctx.lineTo(bx + BOARD_THICKNESS + 16, boardTop + 56);
  ctx.moveTo(bx + BOARD_THICKNESS, boardBottom - 44);
  ctx.lineTo(bx + BOARD_THICKNESS + 18, boardBottom - 44);
  ctx.stroke();

  // -------------------------------------------------------------------------
  // 2. Tempered-Glass Backboard, LED Goal Light Strip & Breakaway Box
  // -------------------------------------------------------------------------
  const boardH = boardBottom - boardTop;
  ctx.save();
  ctx.fillStyle = 'rgba(219, 234, 254, 0.18)';
  ctx.strokeStyle =
    goalLightFlash > 0.08
      ? `rgba(248, 113, 113, ${(0.6 + goalLightFlash * 0.4).toFixed(2)})`
      : '#e2e8f0';
  ctx.lineWidth = goalLightFlash > 0.08 ? 5.2 : 3.5;
  ctx.beginPath();
  ctx.roundRect(bx, boardTop, BOARD_THICKNESS, boardH, 4);
  ctx.fill();
  ctx.stroke();

  if (goalLightFlash > 0.08) {
    ctx.strokeStyle = `rgba(251, 191, 36, ${(goalLightFlash * 0.85).toFixed(2)})`;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(bx - 2, boardTop - 2, BOARD_THICKNESS + 4, boardH + 4);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(bx + 2, boardTop + 12, 3, boardH - 28);

  // Shooter's square & bottom safety padding
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(bx - 1, boardTop + 72, 4, 62);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(bx, boardBottom - 26, BOARD_THICKNESS, 26);

  // Breakaway rim spring-box housing
  ctx.fillStyle = '#9a3412';
  ctx.strokeStyle = '#fb923c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(bx - 11, rimCy + rim.offsetY - 11, 14, 26, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(bx - 8, rimCy + rim.offsetY - 7, 2.5, 2.5);
  ctx.fillRect(bx - 8, rimCy + rim.offsetY + 9, 2.5, 2.5);

  // Articulated L-bracket neck flexing with hinge tilt
  ctx.strokeStyle = '#c2410c';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(rimRightX, flangeRimY);
  ctx.lineTo(bx - 8, rimCy + rim.offsetY - 1);
  ctx.stroke();

  ctx.strokeStyle = '#fb923c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(rimRightX, flangeRimY - 1.5);
  ctx.lineTo(bx - 8, rimCy + rim.offsetY - 2.5);
  ctx.stroke();
  ctx.restore();
}

function drawPredictedAimArc(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  vx: number,
  vy: number
) {
  const speed = Math.hypot(vx, vy);
  if (speed < 60) return;

  ctx.save();
  const dirX = vx / speed;
  const dirY = vy / speed;
  const stemLen = Math.min(92, speed * 0.075);
  const tipX = x0 + dirX * stemLen;
  const tipY = y0 + dirY * stemLen;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  for (let i = 1; i <= 24; i++) {
    const t = i * 0.044;
    const px = x0 + vx * t;
    const py = y0 + vy * t + 0.5 * GRAVITY * t * t;
    if (py > FLOOR_Y) break;
    const alpha = Math.max(0.08, 0.86 - i * 0.03);
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.0, 4.9 - i * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBasketball(ctx: CanvasRenderingContext2D, ball: BasketballState) {
  if (ball.alpha <= 0.01) return;

  const heightAboveFloor = Math.max(0, FLOOR_Y - (ball.y + ball.radius));
  const shadowScale = Math.max(0.22, 1 - heightAboveFloor / 520);
  const shadowAlpha = Math.min(0.45, 0.45 * shadowScale * ball.alpha);
  ctx.save();
  ctx.fillStyle = `rgba(10, 6, 4, ${shadowAlpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(
    ball.x,
    FLOOR_Y + 2,
    ball.radius * (0.95 + (1 - shadowScale) * 0.55),
    6 * shadowScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  const sprite = getBallSprite();
  const drawSize = ball.radius * 2 * (48 / 44);
  const half = drawSize * 0.5;

  ctx.save();
  ctx.globalAlpha = ball.alpha;
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);
  ctx.drawImage(sprite, -half, -half, drawSize, drawSize);
  ctx.restore();
}

function projectNetPoint(n: NetNode, rimCx: number): { x: number; y: number } {
  const persp = 1 + n.z * 0.0014;
  return {
    x: rimCx + (n.x - rimCx) * persp,
    y: n.y + n.z * 0.24,
  };
}

function drawNetMesh(
  ctx: CanvasRenderingContext2D,
  nodes: NetNode[],
  hoopOffset: HoopOffset,
  pass: 'back' | 'front'
) {
  const rimCx = RIM_CENTER_X + hoopOffset.x;
  const idx = (r: number, c: number) =>
    r * NET_COLS + (((c % NET_COLS) + NET_COLS) % NET_COLS);
  const isBack = pass === 'back';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = isBack
    ? 'rgba(186, 198, 214, 0.52)'
    : 'rgba(255, 255, 255, 0.94)';
  ctx.lineWidth = isBack ? 1.85 : 2.5;

  for (let r = 0; r < NET_ROWS - 1; r++) {
    const evenRow = r % 2 === 0;
    for (let c = 0; c < NET_COLS; c++) {
      const top = nodes[idx(r, c)];
      const botA = nodes[idx(r + 1, evenRow ? c : c + 1)];
      const botB = nodes[idx(r + 1, evenRow ? c - 1 : c)];

      const pTop = projectNetPoint(top, rimCx);

      const zMidA = (top.z + botA.z) * 0.5;
      if ((isBack && zMidA < 0) || (!isBack && zMidA >= 0)) {
        const pA = projectNetPoint(botA, rimCx);
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pA.x, pA.y);
        ctx.stroke();
      }

      const zMidB = (top.z + botB.z) * 0.5;
      if ((isBack && zMidB < 0) || (!isBack && zMidB >= 0)) {
        const pB = projectNetPoint(botB, rimCx);
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    }
  }

  ctx.strokeStyle = isBack
    ? 'rgba(203, 213, 225, 0.45)'
    : 'rgba(248, 250, 252, 0.96)';
  ctx.lineWidth = isBack ? 1.9 : 2.7;
  const lastR = NET_ROWS - 1;
  for (let c = 0; c < NET_COLS; c++) {
    const na = nodes[idx(lastR, c)];
    const nb = nodes[idx(lastR, c + 1)];
    const zMid = (na.z + nb.z) * 0.5;
    if ((isBack && zMid < 0) || (!isBack && zMid >= 0)) {
      const pa = projectNetPoint(na, rimCx);
      const pb = projectNetPoint(nb, rimCx);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }

  ctx.fillStyle = isBack
    ? 'rgba(203, 213, 225, 0.5)'
    : 'rgba(255, 255, 255, 0.96)';
  for (let r = 1; r < NET_ROWS; r++) {
    for (let c = 0; c < NET_COLS; c++) {
      const n = nodes[idx(r, c)];
      if ((isBack && n.z >= 0) || (!isBack && n.z < 0)) continue;
      const p = projectNetPoint(n, rimCx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isBack ? 1.6 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawRimBar(
  ctx: CanvasRenderingContext2D,
  rim: RimSpringState,
  hoopOffset: HoopOffset,
  half: 'back' | 'front'
) {
  const rimCx = RIM_CENTER_X + hoopOffset.x;
  const rimCy = RIM_Y + hoopOffset.y;
  const rimLeftX = rimCx - RIM_HALF_W;
  const rimRightX = rimCx + RIM_HALF_W;
  const hingePivotX = rimRightX + 6;

  const leftY =
    rimCy +
    rim.offsetY -
    (rimLeftX - hingePivotX) * Math.sin(rim.tilt) +
    rim.ringVib * 0.55;
  const rightY =
    rimCy +
    rim.offsetY -
    (rimRightX - hingePivotX) * Math.sin(rim.tilt) +
    rim.ringVib * 0.55;
  const midY = (leftY + rightY) * 0.5;
  const rx = (rimRightX - rimLeftX) * 0.5;
  const ry = RIM_DEPTH_RY;

  ctx.save();
  ctx.lineCap = 'round';

  if (half === 'back') {
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 8.0;
    ctx.beginPath();
    ctx.ellipse(rimCx, midY, rx, ry, rim.tilt, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.ellipse(rimCx, midY - 1, rx, ry - 0.5, rim.tilt, Math.PI + 0.1, Math.PI * 2 - 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 1.6;
    for (let c = 0; c < NET_COLS; c++) {
      const theta = (c / NET_COLS) * Math.PI * 2;
      const sinT = Math.sin(theta);
      if (sinT >= 0) continue;
      const hx = rimCx + Math.cos(theta) * (RIM_HALF_W - 4.5);
      const hy = midY - (hx - rimCx) * Math.sin(rim.tilt) + sinT * (ry * 0.42) + 3;
      ctx.beginPath();
      ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 10.5;
    ctx.beginPath();
    ctx.ellipse(rimCx, midY + 1.5, rx, ry, rim.tilt, 0, Math.PI);
    ctx.stroke();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 9.0;
    ctx.beginPath();
    ctx.ellipse(rimCx, midY, rx, ry, rim.tilt, 0, Math.PI);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 237, 213, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(rimCx, midY - 2.2, rx - 1, ry - 1, rim.tilt, 0.15, Math.PI - 0.15);
    ctx.stroke();

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(rimLeftX, leftY, RIM_TUBE_RADIUS, 0, Math.PI * 2);
    ctx.arc(rimRightX, rightY, RIM_TUBE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fed7aa';
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.1;
    for (let c = 0; c < NET_COLS; c++) {
      const theta = (c / NET_COLS) * Math.PI * 2;
      const sinT = Math.sin(theta);
      if (sinT < 0) continue;
      const hx = rimCx + Math.cos(theta) * (RIM_HALF_W - 4.5);
      const hy = midY - (hx - rimCx) * Math.sin(rim.tilt) + sinT * (ry * 0.42) + 4;
      ctx.beginPath();
      ctx.arc(hx, hy, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function renderBasketballScene(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  state: HoopRenderState
) {
  ctx.fillStyle =
    state.venue === 'streetball'
      ? '#0369a1'
      : state.venue === 'retro_gym'
        ? '#1c110b'
        : '#050812';
  ctx.fillRect(0, 0, cssW, cssH);

  const { scale, offsetX, offsetY } = computeCourtViewport(cssW, cssH);
  const minWorldX = -offsetX / scale;
  const maxWorldX = (cssW - offsetX) / scale;

  const sx = state.shake > 0.1 ? (Math.random() - 0.5) * state.shake : 0;
  const sy = state.shake > 0.1 ? (Math.random() - 0.5) * state.shake : 0;

  ctx.save();
  ctx.translate(offsetX + sx, offsetY + sy);
  ctx.scale(scale, scale);

  // 1. Padded cached venue backdrop + edge-to-edge animated spectators/bench & camera flashes
  ctx.drawImage(getVenueBackdrop(state.venue), -PAD_X, -PAD_TOP);
  drawAnimatedCrowdAndFlashes(ctx, state, minWorldX, maxWorldX);

  // 2. Arena dust motes & overhead Jumbotron + 24s Shot Clock
  if (state.venue !== 'streetball') {
    ctx.fillStyle = 'rgba(254, 243, 199, 0.24)';
    for (let i = 0; i < 14; i++) {
      const dx = 140 + ((i * 73 + Math.sin(state.timeSec * 0.6 + i) * 18) % 1020);
      const dy = 110 + ((i * 41 + state.timeSec * 11) % 310);
      ctx.fillRect(dx, dy, 2, 2);
    }
  }
  drawJumbotronAndShotClock(ctx, state);

  // 3. Motorized Overhead Track, Trolley Carriage & Backboard
  drawMotorizedTrackAndBackboard(
    ctx,
    state.rim,
    state.hoopOffset,
    state.movingHoopActive,
    state.goalLightFlash,
    state.timeSec
  );

  // 4. Court tee marker in Free Ball / Fixed Spot mode
  if (state.shooterMode === 'free') {
    ctx.save();
    ctx.strokeStyle =
      state.ball.alpha < 0.99
        ? `rgba(251, 191, 36, ${(0.55 * (1 - state.ball.alpha * 0.5)).toFixed(3)})`
        : 'rgba(248, 250, 252, 0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(DEFAULT_SHOOT_X, FLOOR_Y + 2, 28, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Shot Trail, Aim Trajectory Arc & Swish Rings
  for (let i = 0; i < state.trail.length; i++) {
    const dot = state.trail[i];
    ctx.fillStyle = `rgba(253, 186, 116, ${(dot.alpha * 0.35).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.isDraggingAim) {
    drawPredictedAimArc(
      ctx,
      state.aimOriginX ?? state.ball.x,
      state.aimOriginY ?? state.ball.y,
      state.aimVx,
      state.aimVy
    );
    if (
      state.aimTargetX !== null &&
      state.aimTargetX !== undefined &&
      state.aimTargetY !== null &&
      state.aimTargetY !== undefined
    ) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.aimTargetX, state.aimTargetY, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(state.aimTargetX, state.aimTargetY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < state.rings.length; i++) {
    const r = state.rings[i];
    ctx.strokeStyle = r.color.replace('ALPHA', r.alpha.toFixed(3));
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle Backboard Hit Glow
  if ((state.boardFlash ?? 0) > 0.02) {
    const bf = Math.min(1, state.boardFlash ?? 0);
    const bx = BOARD_X + state.hoopOffset.x + state.rim.boardFlex;
    const by = RIM_Y + state.hoopOffset.y - 42;
    ctx.save();
    ctx.strokeStyle = `rgba(253, 224, 71, ${(bf * 0.65).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx - 1, by, BOARD_THICKNESS + 2, 74);
    ctx.restore();
  }

  // 6. Buoyant Net-Contact Chalk Smoke Plumes
  for (let i = 0; i < state.smokePuffs.length; i++) {
    const s = state.smokePuffs[i];
    const lifeRatio = Math.max(0, Math.min(1, s.life / Math.max(0.01, s.maxLife)));
    const a = s.alpha * lifeRatio;
    if (a <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = s.tint;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 6b. Aerodynamic Confetti Ribbons (3D pitch-flip tumble & floor settle)
  for (let i = 0; i < state.confetti.length; i++) {
    const c = state.confetti[i];
    const lifeRatio = Math.max(0, Math.min(1, c.life / Math.max(0.01, c.maxLife)));
    const pitchScale = c.settled ? 0.85 : Math.max(0.2, Math.abs(Math.cos(c.flipPhase)));
    ctx.save();
    ctx.globalAlpha = Math.min(1, lifeRatio * 1.65);
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w * 0.5, -c.h * pitchScale * 0.5, c.w, Math.max(1.2, c.h * pitchScale));
    ctx.restore();
  }

  // 7. Articulated IK Human Basketball Shooter on court
  if (state.shooterMode === 'player') {
    drawBasketballPlayer(ctx, state.shooter, state.timeSec, state.venue);
  }

  // 8. True 3D layered basket pass order: Back Rim -> Back Net -> Basketball -> Front Net -> Front Rim
  drawRimBar(ctx, state.rim, state.hoopOffset, 'back');
  drawNetMesh(ctx, state.nodes, state.hoopOffset, 'back');
  drawBasketball(ctx, state.ball);
  drawNetMesh(ctx, state.nodes, state.hoopOffset, 'front');
  drawRimBar(ctx, state.rim, state.hoopOffset, 'front');

  ctx.restore();
}
