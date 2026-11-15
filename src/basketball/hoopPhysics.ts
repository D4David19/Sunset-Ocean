export const WORLD_W = 1280;
export const WORLD_H = 760;
export const FLOOR_Y = 668;
export const GRAVITY = 1080;

export const BALL_RADIUS = 22;
export const RIM_CENTER_X = 876;
export const RIM_Y = 306;
export const RIM_HALF_W = 48;
export const RIM_LEFT_X = RIM_CENTER_X - RIM_HALF_W;
export const RIM_RIGHT_X = RIM_CENTER_X + RIM_HALF_W;
export const RIM_TUBE_RADIUS = 5.5;
export const RIM_DEPTH_RY = 11.5;

export const BOARD_X = 944;
export const BOARD_THICKNESS = 14;
export const BOARD_TOP_Y = 160;
export const BOARD_BOTTOM_Y = 342;

export const STANCHION_POST_X = 1098;

export const DEFAULT_SHOOT_X = 245;
export const DEFAULT_SHOOT_Y = FLOOR_Y - BALL_RADIUS;

export const NET_ROWS = 7;
export const NET_COLS = 12;

export type ShotStyle = 'mixed' | 'swish' | 'rim-bounce' | 'bank';
export type ConcreteShotKind = 'swish' | 'rim-bounce' | 'bank';
export type CourtPlayMode = 'arcade' | 'tee';
export type ShooterMode = 'player' | 'free';
export type HoopMotionPhase = 'HOME' | 'ENTERING_PATROL' | 'PATROL_ORBIT' | 'RETURNING_HOME';

export interface HoopOffset {
  x: number;
  y: number;
}

export interface HoopControllerState {
  phase: HoopMotionPhase;
  clock: number;
  offset: HoopOffset;
  target: HoopOffset;
}

export interface NetNode {
  x: number;
  y: number;
  z: number;
  oldX: number;
  oldY: number;
  oldZ: number;
  restLocalX: number;
  restLocalY: number;
  restLocalZ: number;
  theta: number;
  pinned: boolean;
  row: number;
  col: number;
}

export interface NetConstraint {
  a: number;
  b: number;
  restLen: number;
  stiffness: number;
  kind: 'braid' | 'ring' | 'bend';
}

export interface BasketballState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  radius: number;
  active: boolean;
  alpha: number;
  fadeInRate: number;
}

export interface RimSpringState {
  offsetY: number;
  velY: number;
  tilt: number;
  tiltVel: number;
  ringVib: number;
  ringVibVel: number;
  boardFlex: number;
  boardFlexVel: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

export interface NetContactInfo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  overlapCount: number;
}

export interface BasketballSimEvents {
  onRimHit?: (intensity: number) => void;
  onBoardHit?: (intensity: number) => void;
  onFloorBounce?: (intensity: number) => void;
  onNetSwish?: (cleanSwish: boolean) => void;
  onNetContact?: (info: NetContactInfo) => void;
}

export interface ShotTracker {
  touchedRim: boolean;
  touchedBoard: boolean;
  scored: boolean;
  inFlightShot: boolean;
  prevBallY: number;
  postScoreBounces: number;
  postMissBounces: number;
}

export function createHoopController(): HoopControllerState {
  return {
    phase: 'HOME',
    clock: 0,
    offset: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
  };
}

export function getHoopPatrolSpeedScale(streak: number): number {
  if (streak < 3) return 1;
  return 1 + Math.min(1.05, (streak - 3) * 0.16);
}

function samplePatrolTarget(clock: number): HoopOffset {
  return {
    x: Math.sin(clock * 1.12) * 74 - 10,
    y: Math.sin(clock * 1.84) * 34 - 6,
  };
}

export function stepHoopController(
  ctrl: HoopControllerState,
  streak: number,
  dt: number
): void {
  const shouldMove = streak >= 3;
  const speedScale = getHoopPatrolSpeedScale(streak);

  if (shouldMove) {
    if (ctrl.phase === 'HOME' || ctrl.phase === 'RETURNING_HOME') {
      ctrl.phase = 'ENTERING_PATROL';
    }
    ctrl.clock += dt * speedScale;
    const desired = samplePatrolTarget(ctrl.clock);
    ctrl.target.x = desired.x;
    ctrl.target.y = desired.y;

    const blend = 1 - Math.exp(-dt * (ctrl.phase === 'ENTERING_PATROL' ? 4.2 : 6.4));
    ctrl.offset.x += (ctrl.target.x - ctrl.offset.x) * blend;
    ctrl.offset.y += (ctrl.target.y - ctrl.offset.y) * blend;

    if (
      ctrl.phase === 'ENTERING_PATROL' &&
      Math.hypot(ctrl.target.x - ctrl.offset.x, ctrl.target.y - ctrl.offset.y) < 3
    ) {
      ctrl.phase = 'PATROL_ORBIT';
    }
  } else {
    if (ctrl.phase === 'ENTERING_PATROL' || ctrl.phase === 'PATROL_ORBIT') {
      ctrl.phase = 'RETURNING_HOME';
    }
    ctrl.target.x = 0;
    ctrl.target.y = 0;

    if (ctrl.phase === 'RETURNING_HOME') {
      const blend = 1 - Math.exp(-dt * 5.2);
      ctrl.offset.x += (0 - ctrl.offset.x) * blend;
      ctrl.offset.y += (0 - ctrl.offset.y) * blend;
      if (Math.hypot(ctrl.offset.x, ctrl.offset.y) < 0.4) {
        ctrl.offset.x = 0;
        ctrl.offset.y = 0;
        ctrl.clock = 0;
        ctrl.phase = 'HOME';
      }
    }
  }
}

export function predictHoopOffsetAt(
  ctrl: HoopControllerState,
  streak: number,
  leadSec: number
): HoopOffset {
  if (streak < 3 && ctrl.phase === 'HOME') {
    return { x: ctrl.offset.x, y: ctrl.offset.y };
  }
  const simCtrl: HoopControllerState = {
    phase: ctrl.phase,
    clock: ctrl.clock,
    offset: { x: ctrl.offset.x, y: ctrl.offset.y },
    target: { x: ctrl.target.x, y: ctrl.target.y },
  };
  const steps = Math.max(1, Math.round(leadSec * 120));
  const stepDt = leadSec / steps;
  for (let i = 0; i < steps; i++) {
    stepHoopController(simCtrl, streak, stepDt);
  }
  return simCtrl.offset;
}

export function createNetMesh(): {
  nodes: NetNode[];
  constraints: NetConstraint[];
} {
  const nodes: NetNode[] = [];
  const constraints: NetConstraint[] = [];

  // Realistic NBA 7-tier tapered cylinder (18-inch length proportional to 18-inch rim diameter)
  const rowTaper = [1.0, 0.87, 0.75, 0.65, 0.58, 0.54, 0.56];
  const rowDrop = [0, 15, 31, 47, 63, 79, 94];
  const rimRadius = RIM_HALF_W - 4.5;

  for (let r = 0; r < NET_ROWS; r++) {
    const rad = rimRadius * rowTaper[r];
    const ly = 3 + rowDrop[r];
    // Stagger alternate rows by half a loop for true diamond braiding
    const phaseShift = (r % 2) * (Math.PI / NET_COLS);
    for (let c = 0; c < NET_COLS; c++) {
      const theta = (c / NET_COLS) * Math.PI * 2 + phaseShift;
      const lx = Math.cos(theta) * rad;
      const lz = Math.sin(theta) * rad;
      const wx = RIM_CENTER_X + lx;
      const wy = RIM_Y + ly;
      nodes.push({
        x: wx,
        y: wy,
        z: lz,
        oldX: wx,
        oldY: wy,
        oldZ: lz,
        restLocalX: lx,
        restLocalY: ly,
        restLocalZ: lz,
        theta,
        pinned: r === 0,
        row: r,
        col: c,
      });
    }
  }

  const idx = (r: number, c: number) =>
    r * NET_COLS + (((c % NET_COLS) + NET_COLS) % NET_COLS);

  const dist3 = (a: number, b: number) =>
    Math.hypot(
      nodes[a].restLocalX - nodes[b].restLocalX,
      nodes[a].restLocalY - nodes[b].restLocalY,
      nodes[a].restLocalZ - nodes[b].restLocalZ
    );

  // Diagonal braided cords forming staggered diamonds around the full 3D cylinder
  for (let r = 0; r < NET_ROWS - 1; r++) {
    const evenRow = r % 2 === 0;
    for (let c = 0; c < NET_COLS; c++) {
      const top = idx(r, c);
      const botA = idx(r + 1, evenRow ? c : c + 1);
      const botB = idx(r + 1, evenRow ? c - 1 : c);
      constraints.push({
        a: top,
        b: botA,
        restLen: dist3(top, botA),
        stiffness: 0.94,
        kind: 'braid',
      });
      constraints.push({
        a: top,
        b: botB,
        restLen: dist3(top, botB),
        stiffness: 0.94,
        kind: 'braid',
      });
    }
  }

  // Horizontal circumferential ring constraints (gives realistic hoop expansion & choker spring-back)
  for (let r = 1; r < NET_ROWS; r++) {
    for (let c = 0; c < NET_COLS; c++) {
      const a = idx(r, c);
      const b = idx(r, c + 1);
      constraints.push({
        a,
        b,
        restLen: dist3(a, b),
        stiffness: r === NET_ROWS - 1 ? 0.62 : 0.42,
        kind: 'ring',
      });
    }
  }

  // Light 2-tier vertical bend springs so braided nylon hangs with natural body instead of collapsing flat
  for (let r = 0; r < NET_ROWS - 2; r++) {
    for (let c = 0; c < NET_COLS; c++) {
      const a = idx(r, c);
      const b = idx(r + 2, c);
      constraints.push({
        a,
        b,
        restLen: dist3(a, b),
        stiffness: 0.16,
        kind: 'bend',
      });
    }
  }

  return { nodes, constraints };
}

export function computeShotPlan(
  kind: ConcreteShotKind,
  variation = 0,
  hoopOffset: HoopOffset = { x: 0, y: 0 },
  fromPos?: { x: number; y: number }
): {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  omega: number;
  flightTime: number;
} {
  const rimCx = RIM_CENTER_X + hoopOffset.x;
  const rimCy = RIM_Y + hoopOffset.y;
  const rimLeft = rimCx - RIM_HALF_W;
  const rimRight = rimCx + RIM_HALF_W;
  const boardX = BOARD_X + hoopOffset.x;

  const baseStartX =
    fromPos?.x ?? DEFAULT_SHOOT_X + (variation % 3) * 26 - 26;
  const baseStartY = fromPos?.y ?? DEFAULT_SHOOT_Y;
  const startX = Math.min(540, Math.max(120, baseStartX));
  const startY = Math.min(FLOOR_Y - BALL_RADIUS, Math.max(240, baseStartY));

  const distFactor = Math.sqrt(Math.max(0.45, (rimCx - startX) / 630));

  if (kind === 'swish') {
    const flightTime = (1.46 + (variation % 3) * 0.03) * distFactor;
    const targetX = rimCx + ((variation % 3) - 1) * 1.6;
    const targetY = rimCy - 4;
    const vx = (targetX - startX) / flightTime;
    const vy =
      (targetY - startY - 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    return { startX, startY, vx, vy, omega: -7.8, flightTime };
  }

  if (kind === 'rim-bounce') {
    const hitBack = variation % 2 === 0;
    const flightTime = (hitBack ? 1.48 : 1.50) * distFactor;
    const targetX = hitBack ? rimRight - 22.5 : rimLeft + 23.0;
    const targetY = hitBack ? rimCy - 18.5 : rimCy - 19.0;
    const vx = (targetX - startX) / flightTime;
    const vy =
      (targetY - startY - 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    return {
      startX,
      startY,
      vx,
      vy,
      omega: hitBack ? -8.0 : -6.4,
      flightTime,
    };
  }

  const hitX = boardX - BALL_RADIUS;
  const hitY = rimCy - 56;
  const desiredVyAtHit = 360;
  const dy = hitY - startY;
  const disc = desiredVyAtHit * desiredVyAtHit - 2 * GRAVITY * dy;
  const tHit = (desiredVyAtHit + Math.sqrt(Math.max(1, disc))) / GRAVITY;
  const vx = (hitX - startX) / tHit;
  const vy = desiredVyAtHit - GRAVITY * tHit;
  return { startX, startY, vx, vy, omega: -6.5, flightTime: tHit + 0.11 };
}

function testCandidateTrajectory(
  startX: number,
  startY: number,
  vx: number,
  vy: number,
  omega: number,
  ctrl: HoopControllerState,
  streak: number
): { scored: boolean; touchedRim: boolean; touchedBoard: boolean; clearance: number } {
  const simCtrl: HoopControllerState = {
    phase: ctrl.phase,
    clock: ctrl.clock,
    offset: { x: ctrl.offset.x, y: ctrl.offset.y },
    target: { x: ctrl.target.x, y: ctrl.target.y },
  };
  const ball: BasketballState = {
    x: startX,
    y: startY,
    vx,
    vy,
    angle: 0,
    omega,
    radius: BALL_RADIUS,
    active: true,
    alpha: 1,
    fadeInRate: 5,
  };
  const rim: RimSpringState = {
    offsetY: 0,
    velY: 0,
    tilt: 0,
    tiltVel: 0,
    ringVib: 0,
    ringVibVel: 0,
    boardFlex: 0,
    boardFlexVel: 0,
  };
  let prevY = startY;
  let touchedRim = false;
  let touchedBoard = false;
  let scored = false;
  let clearance = 0;
  const dt = 1 / 240;

  for (let s = 0; s < 560; s++) {
    stepHoopController(simCtrl, streak, dt);
    stepRimSpring(rim, dt);
    const rimCx = RIM_CENTER_X + simCtrl.offset.x;
    const rimCy = RIM_Y + simCtrl.offset.y;
    const rimLeftX = rimCx - RIM_HALF_W;
    const rimRightX = rimCx + RIM_HALF_W;
    const boardLeft = BOARD_X + simCtrl.offset.x + rim.boardFlex;
    const boardTopY = BOARD_TOP_Y + simCtrl.offset.y;
    const boardBottomY = BOARD_BOTTOM_Y + simCtrl.offset.y;
    const hingePivotX = rimRightX + 6;

    prevY = ball.y;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (
      ball.x + ball.radius > boardLeft &&
      ball.x - ball.radius < boardLeft + BOARD_THICKNESS &&
      ball.y + ball.radius > boardTopY &&
      ball.y - ball.radius < boardBottomY
    ) {
      if (ball.vx > 0 && ball.x < boardLeft + BOARD_THICKNESS * 0.65) {
        ball.x = boardLeft - ball.radius;
        const speed = Math.abs(ball.vx);
        ball.vx = -ball.vx * 0.78;
        ball.vy *= 0.96;
        ball.omega = (ball.vy / ball.radius) * 0.3;
        touchedBoard = true;
        rim.boardFlexVel += Math.min(260, speed * 0.32);
        rim.velY += Math.min(85, speed * 0.1);
        rim.ringVibVel += Math.min(420, speed * 0.55);
      }
    }

    const leftRimY =
      rimCy +
      rim.offsetY -
      (rimLeftX - hingePivotX) * Math.sin(rim.tilt) +
      rim.ringVib * 0.55;
    const rightRimY =
      rimCy +
      rim.offsetY -
      (rimRightX - hingePivotX) * Math.sin(rim.tilt) +
      rim.ringVib * 0.55;

    const leftHit = collideCircleCollider(ball, rimLeftX, leftRimY, RIM_TUBE_RADIUS, 0.68);
    if (leftHit.hit) {
      touchedRim = true;
      rim.velY += Math.min(260, leftHit.impulse * 0.34);
      rim.tiltVel -= Math.min(5.2, leftHit.impulse * 0.0095);
      rim.ringVibVel += Math.min(820, leftHit.impulse * 1.45);
      rim.boardFlexVel += Math.min(140, leftHit.impulse * 0.16);
    }

    const rightHit = collideCircleCollider(ball, rimRightX, rightRimY, RIM_TUBE_RADIUS, 0.68);
    if (rightHit.hit) {
      touchedRim = true;
      rim.velY += Math.min(210, rightHit.impulse * 0.28);
      rim.tiltVel += Math.min(3.4, rightHit.impulse * 0.006);
      rim.ringVibVel += Math.min(780, rightHit.impulse * 1.35);
      rim.boardFlexVel += Math.min(190, rightHit.impulse * 0.24);
    }

    if (
      !scored &&
      prevY <= rimCy + 8 &&
      ball.y > rimCy + 8 &&
      ball.vy > 0 &&
      Math.abs(ball.x - rimCx) < RIM_HALF_W - 9
    ) {
      scored = true;
      clearance = RIM_HALF_W - 9 - Math.abs(ball.x - rimCx);
      break;
    }

    if (ball.y > FLOOR_Y - BALL_RADIUS || ball.x > WORLD_W - 24) {
      break;
    }
  }

  return { scored, touchedRim, touchedBoard, clearance };
}

export function solveMovingShotPlan(
  kind: ConcreteShotKind,
  variation: number,
  ctrl: HoopControllerState,
  streak: number,
  fromPos?: { x: number; y: number }
) {
  const startX = Math.min(
    735,
    Math.max(95, fromPos?.x ?? DEFAULT_SHOOT_X + (variation % 3) * 26 - 26)
  );
  const startY = Math.min(
    FLOOR_Y - BALL_RADIUS,
    Math.max(240, fromPos?.y ?? DEFAULT_SHOOT_Y)
  );
  const baseDistFactor = Math.max(
    0.72,
    Math.sqrt(Math.max(0.42, (RIM_CENTER_X - startX) / 630))
  );

  const solveTarget = (
    targetXForOffset: (off: HoopOffset) => number,
    targetYForOffset: (off: HoopOffset) => number,
    flightTime: number,
    omega: number
  ) => {
    const off = predictHoopOffsetAt(ctrl, streak, flightTime);
    const tx = targetXForOffset(off);
    const ty = targetYForOffset(off);
    const vx = (tx - startX) / flightTime;
    const vy = (ty - startY - 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    return { startX, startY, vx, vy, omega, flightTime };
  };

  if (kind === 'swish') {
    const flightTimes = [1.44, 1.34, 1.52, 1.24];
    const xTweaks = [0, -3, 3, -6, 6];
    for (const ftBase of flightTimes) {
      const ft = ftBase * baseDistFactor;
      for (const xt of xTweaks) {
        const cand = solveTarget(
          (o) => RIM_CENTER_X + o.x + xt,
          (o) => RIM_Y + o.y - 4,
          ft,
          -7.8
        );
        const res = testCandidateTrajectory(
          cand.startX,
          cand.startY,
          cand.vx,
          cand.vy,
          cand.omega,
          ctrl,
          streak
        );
        if (res.scored && !res.touchedRim && !res.touchedBoard && res.clearance >= 8) {
          return cand;
        }
      }
    }
  } else if (kind === 'rim-bounce') {
    const offsets =
      variation % 2 === 0
        ? [24, 26, 22, -24, -22, 28, -26]
        : [-24, -26, -22, 24, 22, -28, 26];
    const flightTimes = [1.44, 1.34, 1.52, 1.24];
    for (const ftBase of flightTimes) {
      const ft = ftBase * baseDistFactor;
      for (const dxFromCenter of offsets) {
        const cand = solveTarget(
          (o) => RIM_CENTER_X + o.x + dxFromCenter,
          (o) => RIM_Y + o.y - 18.5,
          ft,
          dxFromCenter > 0 ? -8.0 : -6.4
        );
        const res = testCandidateTrajectory(
          cand.startX,
          cand.startY,
          cand.vx,
          cand.vy,
          cand.omega,
          ctrl,
          streak
        );
        if (res.scored && res.touchedRim) {
          return cand;
        }
      }
    }
  } else {
    const bankOffsets = [-56, -64, -48, -72, -42, -34, -80];
    const desiredVys = [340, 260, 410, 190, 460];
    for (const desiredVy of desiredVys) {
      for (const yOff of bankOffsets) {
        let off = predictHoopOffsetAt(ctrl, streak, 1.32 * baseDistFactor);
        let tHit = 1.32 * baseDistFactor;
        for (let i = 0; i < 4; i++) {
          const hitY = RIM_Y + off.y + yOff;
          const dy = hitY - startY;
          const disc = desiredVy * desiredVy - 2 * GRAVITY * dy;
          tHit = (desiredVy + Math.sqrt(Math.max(1, disc))) / GRAVITY;
          off = predictHoopOffsetAt(ctrl, streak, tHit);
        }
        const hitX = BOARD_X + off.x - BALL_RADIUS;
        const hitY = RIM_Y + off.y + yOff;
        const vx = (hitX - startX) / tHit;
        const vy = (hitY - startY - 0.5 * GRAVITY * tHit * tHit) / tHit;
        const res = testCandidateTrajectory(
          startX,
          startY,
          vx,
          vy,
          -6.5,
          ctrl,
          streak
        );
        if (res.scored && res.touchedBoard) {
          return { startX, startY, vx, vy, omega: -6.5, flightTime: tHit + 0.11 };
        }
      }
    }
  }

  // Verified clean-swish fallback across varied arc times
  for (const ftBase of [1.44, 1.32, 1.56, 1.18, 1.04]) {
    const ft = ftBase * baseDistFactor;
    const cand = solveTarget(
      (o) => RIM_CENTER_X + o.x,
      (o) => RIM_Y + o.y - 4,
      ft,
      -7.8
    );
    const res = testCandidateTrajectory(
      cand.startX,
      cand.startY,
      cand.vx,
      cand.vy,
      cand.omega,
      ctrl,
      streak
    );
    if (res.scored) {
      return cand;
    }
  }

  return solveTarget(
    (o) => RIM_CENTER_X + o.x,
    (o) => RIM_Y + o.y - 4,
    1.44 * baseDistFactor,
    -7.8
  );
}

export function stepRimSpring(spring: RimSpringState, dt: number) {
  // Breakaway hinge spring + damper (pivots cleanly at the backboard bracket)
  const rimK = 480;
  const rimDamp = 9.2;
  const ay = -rimK * spring.offsetY - rimDamp * spring.velY;
  spring.velY += ay * dt;
  spring.offsetY += spring.velY * dt;

  // Breakaway tilt hinge: snaps back briskly without excessive wobble
  const tiltK = 540;
  const tiltDamp = 10.4;
  const aTilt = -tiltK * spring.tilt - tiltDamp * spring.tiltVel;
  spring.tiltVel += aTilt * dt;
  spring.tilt += spring.tiltVel * dt;

  // High-frequency metallic rim ring resonance (~42 Hz)
  const vibK = 68000;
  const vibDamp = 14.5;
  const aVib = -vibK * spring.ringVib - vibDamp * spring.ringVibVel;
  spring.ringVibVel += aVib * dt;
  spring.ringVib += spring.ringVibVel * dt;

  // Tempered-glass backboard flex & shudder
  const boardK = 520;
  const boardDamp = 11.5;
  const aBoard = -boardK * spring.boardFlex - boardDamp * spring.boardFlexVel;
  spring.boardFlexVel += aBoard * dt;
  spring.boardFlex += spring.boardFlexVel * dt;
}

function collideCircleCollider(
  ball: BasketballState,
  cx: number,
  cy: number,
  cr: number,
  restitution: number
): { hit: boolean; impulse: number; nx: number; ny: number } {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const minDist = ball.radius + cr;
  const distSq = dx * dx + dy * dy;
  if (distSq >= minDist * minDist) {
    return { hit: false, impulse: 0, nx: 0, ny: 0 };
  }

  const dist = Math.sqrt(distSq) || 0.0001;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= 0) {
    return { hit: false, impulse: 0, nx, ny };
  }

  const impulse = -(1 + restitution) * vn;
  ball.vx += impulse * nx;
  ball.vy += impulse * ny;

  // Tangential spin coupling (hollow-sphere inertia I = 2/3 m r^2)
  const tx = -ny;
  const ty = nx;
  const vt = ball.vx * tx + ball.vy * ty - ball.omega * ball.radius;
  const spinDelta = Math.max(-impulse * 0.45, Math.min(impulse * 0.45, -vt * 0.28));
  ball.vx += spinDelta * tx;
  ball.vy += spinDelta * ty;
  ball.omega -= (spinDelta / ball.radius) * 1.45;

  return { hit: true, impulse, nx, ny };
}

let netSubCounter = 0;

export function stepBasketballPhysics(
  ball: BasketballState,
  rim: RimSpringState,
  nodes: NetNode[],
  constraints: NetConstraint[],
  dt: number,
  tracker: ShotTracker,
  events: BasketballSimEvents,
  hoopOffset: HoopOffset = { x: 0, y: 0 }
) {
  const rimCx = RIM_CENTER_X + hoopOffset.x;
  const rimCy = RIM_Y + hoopOffset.y;
  const rimLeftX = rimCx - RIM_HALF_W;
  const rimRightX = rimCx + RIM_HALF_W;
  const boardX = BOARD_X + hoopOffset.x;
  const boardTopY = BOARD_TOP_Y + hoopOffset.y;
  const boardBottomY = BOARD_BOTTOM_Y + hoopOffset.y;

  if (ball.alpha < 1) {
    ball.alpha = Math.min(1, ball.alpha + ball.fadeInRate * dt);
  }

  // 1. Update breakaway rim, metallic vibration & backboard spring
  stepRimSpring(rim, dt);

  // 2. Pin top 12-loop net row to live 3D tilted & vibrating rim hooks
  const rimRadius = RIM_HALF_W - 4.5;
  const hingePivotX = rimRightX + 6;
  for (let c = 0; c < NET_COLS; c++) {
    const node = nodes[c];
    const cosT = Math.cos(node.theta);
    const sinT = Math.sin(node.theta);
    const hookX = rimCx + cosT * rimRadius;
    const leverFromHinge = hookX - hingePivotX;
    const hingeDrop = -leverFromHinge * Math.sin(rim.tilt);
    const hookY =
      rimCy +
      3 +
      sinT * (RIM_DEPTH_RY * 0.42) +
      rim.offsetY +
      hingeDrop +
      rim.ringVib * 0.55;
    node.x = hookX;
    node.y = hookY;
    node.z = sinT * rimRadius;
    node.oldX = node.x;
    node.oldY = node.y;
    node.oldZ = node.z;
  }

  // 3. Step ball rigid body at full substep rate
  if (ball.active) {
    tracker.prevBallY = ball.y;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.angle += ball.omega * dt;

    // Backboard collision (front face + top/bottom caps)
    const boardShift = rim.boardFlex;
    const boardLeft = boardX + boardShift;
    if (
      ball.x + ball.radius > boardLeft &&
      ball.x - ball.radius < boardLeft + BOARD_THICKNESS &&
      ball.y + ball.radius > boardTopY &&
      ball.y - ball.radius < boardBottomY
    ) {
      if (ball.vx > 0 && ball.x < boardLeft + BOARD_THICKNESS * 0.65) {
        ball.x = boardLeft - ball.radius;
        const speed = Math.abs(ball.vx);
        ball.vx = -ball.vx * 0.78;
        ball.vy *= 0.96;
        ball.omega = (ball.vy / ball.radius) * 0.3;
        tracker.touchedBoard = true;
        rim.boardFlexVel += Math.min(260, speed * 0.32);
        rim.velY += Math.min(85, speed * 0.1);
        rim.ringVibVel += Math.min(420, speed * 0.55);
        if (speed > 65) {
          events.onBoardHit?.(Math.min(1, speed / 700));
        }
      } else if (ball.vx < 0 && ball.x > boardLeft + BOARD_THICKNESS * 0.5) {
        ball.x = boardLeft + BOARD_THICKNESS + ball.radius;
        ball.vx = -ball.vx * 0.7;
      } else if (ball.y < boardTopY + 14 && ball.vy > 0) {
        ball.y = boardTopY - ball.radius;
        ball.vy = -ball.vy * 0.65;
      } else if (ball.y > boardBottomY - 14 && ball.vy < 0) {
        ball.y = boardBottomY + ball.radius;
        ball.vy = -ball.vy * 0.65;
      }
    }

    // Rim mounting flange neck between back rim and backboard
    const flangeMidX = (rimRightX + boardLeft) * 0.5;
    const flangeY = rimCy + rim.offsetY;
    const flangeHit = collideCircleCollider(ball, flangeMidX, flangeY, 4.5, 0.58);
    if (flangeHit.hit) {
      tracker.touchedRim = true;
      rim.velY += Math.min(180, flangeHit.impulse * 0.25);
      rim.ringVibVel += Math.min(540, flangeHit.impulse * 0.9);
      if (flangeHit.impulse > 55) {
        events.onRimHit?.(Math.min(1, flangeHit.impulse / 550));
      }
    }

    // Overhead-mounted track clears the baseline apron cleanly (no floor stanchion obstacle)

    // Front & Back Rim collider circles (breakaway hinge torque proportional to lever arm)
    const leftRimY =
      rimCy +
      rim.offsetY -
      (rimLeftX - hingePivotX) * Math.sin(rim.tilt) +
      rim.ringVib * 0.55;
    const rightRimY =
      rimCy +
      rim.offsetY -
      (rimRightX - hingePivotX) * Math.sin(rim.tilt) +
      rim.ringVib * 0.55;

    const leftHit = collideCircleCollider(
      ball,
      rimLeftX,
      leftRimY,
      RIM_TUBE_RADIUS,
      0.68
    );
    if (leftHit.hit) {
      tracker.touchedRim = true;
      const mag = Math.min(1, leftHit.impulse / 550);
      // Front rim has long lever arm -> strong breakaway hinge dip & metallic ring buzz
      rim.velY += Math.min(260, leftHit.impulse * 0.34);
      rim.tiltVel -= Math.min(5.2, leftHit.impulse * 0.0095);
      rim.ringVibVel += Math.min(820, leftHit.impulse * 1.45);
      rim.boardFlexVel += Math.min(140, leftHit.impulse * 0.16);
      if (leftHit.impulse > 55) events.onRimHit?.(mag);
    }

    const rightHit = collideCircleCollider(
      ball,
      rimRightX,
      rightRimY,
      RIM_TUBE_RADIUS,
      0.68
    );
    if (rightHit.hit) {
      tracker.touchedRim = true;
      const mag = Math.min(1, rightHit.impulse / 550);
      // Back rim near flange -> strong backboard shudder + sharp ring vibration
      rim.velY += Math.min(210, rightHit.impulse * 0.28);
      rim.tiltVel += Math.min(3.4, rightHit.impulse * 0.006);
      rim.ringVibVel += Math.min(780, rightHit.impulse * 1.35);
      rim.boardFlexVel += Math.min(190, rightHit.impulse * 0.24);
      if (rightHit.impulse > 55) events.onRimHit?.(mag);
    }

    // Score detection when ball crosses down through rim plane inside cylinder
    if (
      !tracker.scored &&
      tracker.prevBallY <= rimCy + 8 &&
      ball.y > rimCy + 8 &&
      ball.vy > 0 &&
      Math.abs(ball.x - rimCx) < RIM_HALF_W - 6
    ) {
      tracker.scored = true;
      const isCleanSwish = !tracker.touchedRim && !tracker.touchedBoard;
      rim.velY += 42;
      rim.ringVibVel += 180;
      events.onNetSwish?.(isCleanSwish);
    }

    // Hardwood floor & side wall bounce (NBA ~0.78 inflation restitution)
    if (ball.y + ball.radius > FLOOR_Y) {
      ball.y = FLOOR_Y - ball.radius;
      const impact = Math.abs(ball.vy);
      if (impact > 34) {
        ball.vy = -ball.vy * 0.78;
        ball.vx *= 0.93;
        ball.omega = ball.vx / ball.radius;
        events.onFloorBounce?.(Math.min(1, impact / 850));
      } else {
        ball.vy = 0;
        ball.vx *= 1 - 1.9 * dt;
        ball.omega = ball.vx / ball.radius;
        if (tracker.inFlightShot) {
          events.onFloorBounce?.(0.15);
        }
      }
    }

    if (ball.x - ball.radius < 24) {
      ball.x = 24 + ball.radius;
      ball.vx = Math.abs(ball.vx) * 0.74;
    } else if (ball.x + ball.radius > WORLD_W - 24) {
      ball.x = WORLD_W - 24 - ball.radius;
      ball.vx = -Math.abs(ball.vx) * 0.74;
    }

    if (ball.y - ball.radius < -120) {
      ball.y = -120 + ball.radius;
      ball.vy = Math.abs(ball.vy) * 0.55;
    }
  }

  // Run 3D braided nylon net Verlet at 120Hz (every 2nd 240Hz ball substep)
  netSubCounter = (netSubCounter + 1) & 1;
  if (netSubCounter !== 0) return;

  const netDt = dt * 2;
  const netGravity = 1040;
  const damping = 0.976;

  // 4. 3D Verlet integration for braided nylon cords
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.pinned) continue;
    const vx = (n.x - n.oldX) * damping;
    const vy = (n.y - n.oldY) * damping;
    const vz = (n.z - n.oldZ) * damping;
    n.oldX = n.x;
    n.oldY = n.y;
    n.oldZ = n.z;

    const restX = rimCx + n.restLocalX;
    const restZ = n.restLocalZ;
    const swayRestoreX = (restX - n.x) * 4.2;
    const swayRestoreZ = (restZ - n.z) * 4.2;
    n.x += vx + swayRestoreX * netDt * netDt;
    n.y += vy + netGravity * netDt * netDt;
    n.z += vz + swayRestoreZ * netDt * netDt;
  }

  // 5. Realistic 3D sphere-vs-net coupling (ball centered at z = 0 expands the 3D net in x, y, AND z!)
  let netOverlapCount = 0;
  let avgStretchY = 0;
  let sumContactX = 0;
  let sumContactY = 0;
  let sumCordVx = 0;
  let sumCordVy = 0;
  if (ball.active && ball.y > rimCy - 16 && ball.y < rimCy + 148) {
    const netClearance = ball.radius + 4.0;
    const clearSq = netClearance * netClearance;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.pinned) continue;
      const dx = n.x - ball.x;
      const dy = n.y - ball.y;
      const dz = n.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < clearSq && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        const push = netClearance - dist;

        n.x += nx * push * 0.88;
        n.y += ny * push * 0.88;
        n.z += nz * push * 0.88;

        // Nylon cord imparts upward-and-outward whip momentum as ball slides past
        n.oldX -= ball.vx * netDt * 0.22;
        n.oldY -= ball.vy * netDt * 0.26;
        netOverlapCount += 1;
        avgStretchY += Math.max(0, n.y - (rimCy + n.restLocalY));
        sumContactX += n.x;
        sumContactY += n.y;
        sumCordVx += (n.x - n.oldX) / netDt;
        sumCordVy += (n.y - n.oldY) / netDt;
      }
    }

    // Continuous midpoint push along braided cords so the ball never slices cleanly through diamonds
    for (let k = 0; k < constraints.length; k++) {
      const c = constraints[k];
      if (c.kind !== 'braid') continue;
      const na = nodes[c.a];
      const nb = nodes[c.b];
      const mx = (na.x + nb.x) * 0.5;
      const my = (na.y + nb.y) * 0.5;
      const mz = (na.z + nb.z) * 0.5;
      const dx = mx - ball.x;
      const dy = my - ball.y;
      const dz = mz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < clearSq && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = (netClearance - dist) * 0.52;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        if (!na.pinned) {
          na.x += nx * push;
          na.y += ny * push;
          na.z += nz * push;
        }
        if (!nb.pinned) {
          nb.x += nx * push;
          nb.y += ny * push;
          nb.z += nz * push;
        }
      }
    }

    // Two-way nylon braking & funnel centering (produces signature crisp swish deceleration)
    if (netOverlapCount > 0 && ball.y > rimCy + 6 && ball.y < rimCy + 104) {
      const normalizedHit = Math.min(1.5, netOverlapCount / 14);
      ball.vx *= 1 - normalizedHit * 3.2 * netDt;
      ball.vy *= 1 - normalizedHit * 2.1 * netDt;
      ball.vx += (rimCx - ball.x) * 4.5 * netDt;
      if (ball.vy > 110) {
        ball.vy -= Math.min(240, (avgStretchY / netOverlapCount) * 16 + 110) * netDt;
      }
      // Ball spin brushes the nylon cords slightly as it exits
      for (let i = NET_COLS * 3; i < nodes.length; i++) {
        const n = nodes[i];
        if (Math.abs(n.y - ball.y) < ball.radius + 14) {
          n.oldX -= ball.omega * ball.radius * 0.012 * netDt;
        }
      }
    }

    if (netOverlapCount >= 2) {
      const invCount = 1 / netOverlapCount;
      const ballSpeed = Math.hypot(ball.vx, ball.vy);
      const energy = Math.min(1.4, (ballSpeed / 460) * 0.65 + (netOverlapCount / 16) * 0.55);
      events.onNetContact?.({
        x: sumContactX * invCount,
        y: sumContactY * invCount,
        vx: sumCordVx * invCount * 0.45 + ball.vx * 0.25,
        vy: sumCordVy * invCount * 0.45 + ball.vy * 0.25,
        energy,
        overlapCount: netOverlapCount,
      });
    }
  }

  // 6. Iterative 3D distance constraint solver
  for (let iter = 0; iter < 6; iter++) {
    for (let k = 0; k < constraints.length; k++) {
      const c = constraints[k];
      const na = nodes[c.a];
      const nb = nodes[c.b];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const dz = nb.z - na.z;
      const d = Math.hypot(dx, dy, dz) || 0.0001;

      // Slack braided ropes fold inward gently instead of acting like rigid steel rods under compression
      if (c.kind === 'braid' && d < c.restLen * 0.72) continue;
      if (c.kind === 'ring' && d < c.restLen * 0.84) continue;
      if (c.kind === 'bend' && d < c.restLen * 0.90) continue;

      const diff = ((d - c.restLen) / d) * c.stiffness;
      if (na.pinned && !nb.pinned) {
        nb.x -= dx * diff;
        nb.y -= dy * diff;
        nb.z -= dz * diff;
      } else if (!na.pinned && nb.pinned) {
        na.x += dx * diff;
        na.y += dy * diff;
        na.z += dz * diff;
      } else if (!na.pinned && !nb.pinned) {
        const half = diff * 0.5;
        na.x += dx * half;
        na.y += dy * half;
        na.z += dz * half;
        nb.x -= dx * half;
        nb.y -= dy * half;
        nb.z -= dz * half;
      }
    }
  }
}
