import { BALL_RADIUS, FLOOR_Y } from './hoopPhysics';

export interface Point2D {
  x: number;
  y: number;
}

export type ShooterPose = 'dribble' | 'run' | 'aim' | 'jump_release' | 'celebrate';
export type CourtVenue = 'arena' | 'streetball' | 'retro_gym';

export interface ShooterState {
  x: number;
  targetX: number | null;
  vx: number;
  yJump: number;
  vyJump: number;
  facing: 1 | -1;
  pose: ShooterPose;
  dribblePhase: number;
  stridePhase: number;
  releaseTimer: number;
  celebrateTimer: number;
  aimAngle: number;
  crouchAmount: number;
}

export const SHOOTER_MIN_X = 95;
export const SHOOTER_MAX_X = 710;
export const SHOOTER_RUN_SPEED = 295;

export function createShooterState(x = 265): ShooterState {
  return {
    x,
    targetX: null,
    vx: 0,
    yJump: 0,
    vyJump: 0,
    facing: 1,
    pose: 'dribble',
    dribblePhase: 0.4,
    stridePhase: 0,
    releaseTimer: 0,
    celebrateTimer: 0,
    aimAngle: -0.95,
    crouchAmount: 0,
  };
}

/**
 * Exact 2-bone analytical Inverse Kinematics (Law of Cosines).
 * bendDir = +1 bends elbow/knee along (+uy, -ux) [forward/right for downward limb],
 * bendDir = -1 bends along (-uy, +ux).
 */
export function solveTwoBoneIK(
  root: Point2D,
  target: Point2D,
  L1: number,
  L2: number,
  bendDir: 1 | -1
): Point2D {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawDist = Math.hypot(dx, dy);

  const minD = Math.abs(L1 - L2) + 0.5;
  const maxD = L1 + L2 - 0.5;
  const d = Math.max(minD, Math.min(maxD, rawDist));

  const ux = dx / (rawDist || 1);
  const uy = dy / (rawDist || 1);

  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));

  return {
    x: root.x + a * ux + bendDir * h * uy,
    y: root.y + a * uy - bendDir * h * ux,
  };
}

export function triggerShooterJumpShot(
  shooter: ShooterState,
  vx: number,
  vy: number
) {
  shooter.facing = vx >= -40 ? 1 : -1;
  shooter.aimAngle = Math.atan2(vy, Math.max(60, Math.abs(vx)));
  shooter.pose = 'jump_release';
  shooter.vyJump = 360;
  shooter.yJump = Math.max(shooter.yJump, 2);
  shooter.releaseTimer = 0.64;
  shooter.targetX = null;
  shooter.vx = 0;
}

export function triggerShooterCelebrate(shooter: ShooterState) {
  shooter.celebrateTimer = 1.05;
  if (shooter.releaseTimer <= 0.1) {
    shooter.pose = 'celebrate';
    if (shooter.yJump <= 2) {
      shooter.vyJump = 210;
    }
  }
}

/**
 * Computes the live basketball world position & spin when held/dribbled by the shooter.
 */
export function getShooterBallTarget(shooter: ShooterState): {
  x: number;
  y: number;
  omega: number;
  isPalmTop: boolean;
} {
  const baseFloor = FLOOR_Y - BALL_RADIUS;
  const dir = shooter.facing;

  if (shooter.pose === 'aim') {
    const pocketX = shooter.x + dir * 24;
    const pocketY = FLOOR_Y - shooter.yJump - 118 + shooter.crouchAmount * 14;
    return { x: pocketX, y: pocketY, omega: -1.8, isPalmTop: false };
  }

  // Gravity-shaped dribble curve: 0 at ground impact, 1 at hand apex
  const wave = Math.abs(Math.sin(shooter.dribblePhase));
  const arc = 1 - (1 - wave) * (1 - wave);
  const handHeight = FLOOR_Y - shooter.yJump - 82 + shooter.crouchAmount * 8;
  const bx = shooter.x + dir * (28 + Math.sin(shooter.dribblePhase * 2) * 3) + shooter.vx * 0.04;
  const by = baseFloor - arc * (baseFloor - handHeight);

  return {
    x: bx,
    y: Math.min(baseFloor, by),
    omega: dir * 2.2 + shooter.vx * 0.025,
    isPalmTop: wave > 0.85,
  };
}

export function stepShooterState(
  shooter: ShooterState,
  dt: number,
  inputDir: number,
  isAiming: boolean,
  ballInFlight: boolean,
  onDribbleBounce?: () => void
) {
  // Jump elevation physics (always active)
  if (shooter.yJump > 0 || shooter.vyJump !== 0) {
    shooter.vyJump -= 1320 * dt;
    shooter.yJump += shooter.vyJump * dt;
    if (shooter.yJump <= 0) {
      shooter.yJump = 0;
      shooter.vyJump = 0;
    }
  }

  if (shooter.releaseTimer > 0) {
    shooter.releaseTimer = Math.max(0, shooter.releaseTimer - dt);
  }
  if (shooter.celebrateTimer > 0) {
    shooter.celebrateTimer = Math.max(0, shooter.celebrateTimer - dt);
  }

  // Horizontal steering (keyboard overrides click-to-move target)
  let moveDir = inputDir;
  if (moveDir !== 0) {
    shooter.targetX = null;
  } else if (shooter.targetX !== null && !isAiming && shooter.releaseTimer <= 0.05) {
    const diff = shooter.targetX - shooter.x;
    if (Math.abs(diff) <= 6) {
      shooter.x = shooter.targetX;
      shooter.targetX = null;
      moveDir = 0;
    } else {
      moveDir = Math.sign(diff);
    }
  }

  const targetVx =
    isAiming || shooter.releaseTimer > 0.12 ? 0 : moveDir * SHOOTER_RUN_SPEED;
  const accel = 1 - Math.exp(-dt * 15);
  shooter.vx += (targetVx - shooter.vx) * accel;
  if (Math.abs(shooter.vx) < 2 && moveDir === 0) shooter.vx = 0;

  shooter.x = Math.max(
    SHOOTER_MIN_X,
    Math.min(SHOOTER_MAX_X, shooter.x + shooter.vx * dt)
  );
  if (shooter.x <= SHOOTER_MIN_X + 1 || shooter.x >= SHOOTER_MAX_X - 1) {
    shooter.vx = 0;
    if (shooter.targetX !== null) shooter.targetX = null;
  }

  // Always face the basket when shooting/idle; face travel direction when sprinting fast
  if (isAiming || shooter.releaseTimer > 0) {
    shooter.facing = 1;
  } else if (Math.abs(shooter.vx) > 45) {
    shooter.facing = shooter.vx > 0 ? 1 : -1;
  } else {
    shooter.facing = 1;
  }

  // Determine current pose
  if (shooter.releaseTimer > 0) {
    shooter.pose = 'jump_release';
  } else if (isAiming) {
    shooter.pose = 'aim';
  } else if (Math.abs(shooter.vx) > 25) {
    shooter.pose = 'run';
  } else if (shooter.celebrateTimer > 0 && ballInFlight) {
    shooter.pose = 'celebrate';
  } else {
    shooter.pose = 'dribble';
  }

  const targetCrouch =
    shooter.pose === 'aim'
      ? 1
      : shooter.pose === 'dribble'
        ? 0.48 + Math.max(0, -Math.sin(shooter.dribblePhase)) * 0.2
        : shooter.pose === 'run'
          ? 0.35
          : 0;
  shooter.crouchAmount += (targetCrouch - shooter.crouchAmount) * (1 - Math.exp(-dt * 12));

  // Advance stride & dribble cycle
  if (Math.abs(shooter.vx) > 20) {
    shooter.stridePhase += (Math.abs(shooter.vx) / 62) * dt * Math.PI;
  } else {
    // Gently relax stride back toward athletic stance
    shooter.stridePhase += (0 - Math.sin(shooter.stridePhase)) * dt * 4;
  }

  if (!ballInFlight && !isAiming && shooter.releaseTimer <= 0) {
    const prevCycle = Math.floor(shooter.dribblePhase / Math.PI);
    const speedBoost = Math.abs(shooter.vx) > 35 ? 1.24 : 1.0;
    shooter.dribblePhase += dt * 5.2 * speedBoost;
    const currCycle = Math.floor(shooter.dribblePhase / Math.PI);
    if (currCycle > prevCycle) {
      onDribbleBounce?.();
    }
  }
}

interface VenueKit {
  jersey: string;
  jerseyTrim: string;
  shorts: string;
  headband: string;
  shoe: string;
  shoeAccent: string;
  skin: string;
  skinFar: string;
  skinLight: string;
}

function getVenueKit(venue: CourtVenue): VenueKit {
  if (venue === 'streetball') {
    return {
      jersey: '#0f766e',
      jerseyTrim: '#fb923c',
      shorts: '#1e293b',
      headband: '#fb923c',
      shoe: '#f8fafc',
      shoeAccent: '#f97316',
      skin: '#c9885b',
      skinFar: '#9c633e',
      skinLight: '#e3a57a',
    };
  }
  if (venue === 'retro_gym') {
    return {
      jersey: '#b91c1c',
      jerseyTrim: '#fde68a',
      shorts: '#991b1b',
      headband: '#fef3c7',
      shoe: '#f8fafc',
      shoeAccent: '#dc2626',
      skin: '#d99b72',
      skinFar: '#a8714e',
      skinLight: '#f0b88f',
    };
  }
  return {
    jersey: '#1d4ed8',
    jerseyTrim: '#fbbf24',
    shorts: '#1e3a8a',
    headband: '#fbbf24',
    shoe: '#f8fafc',
    shoeAccent: '#2563eb',
    skin: '#d99b72',
    skinFar: '#a8714e',
    skinLight: '#f2ba8c',
  };
}

function drawPlayerLeg(
  ctx: CanvasRenderingContext2D,
  hip: Point2D,
  knee: Point2D,
  ankle: Point2D,
  toeTilt: number,
  isNear: boolean,
  kit: VenueKit
) {
  const skin = isNear ? kit.skin : kit.skinFar;
  const shortsCol = isNear ? kit.shorts : '#111827';
  const sockCol = isNear ? '#f8fafc' : '#cbd5e1';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Upper thigh covered by basketball shorts down to ~62% of thigh
  const tDx = knee.x - hip.x;
  const tDy = knee.y - hip.y;
  const tLen = Math.hypot(tDx, tDy) || 1;
  const tNx = -tDy / tLen;
  const tNy = tDx / tLen;
  const hemX = hip.x + tDx * 0.68;
  const hemY = hip.y + tDy * 0.68;

  // Bare lower thigh
  ctx.strokeStyle = skin;
  ctx.lineWidth = 11.5;
  ctx.beginPath();
  ctx.moveTo(hemX, hemY);
  ctx.lineTo(knee.x, knee.y);
  ctx.stroke();

  // Baggy athletic basketball shorts leg
  ctx.fillStyle = shortsCol;
  ctx.beginPath();
  ctx.moveTo(hip.x + tNx * 11, hip.y + tNy * 11);
  ctx.lineTo(hemX + tNx * 9.8, hemY + tNy * 9.8);
  ctx.lineTo(hemX - tNx * 9.5, hemY - tNy * 9.5);
  ctx.lineTo(hip.x - tNx * 10.5, hip.y - tNy * 10.5);
  ctx.closePath();
  ctx.fill();

  if (isNear) {
    ctx.strokeStyle = kit.jerseyTrim;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(hip.x + tNx * 9.6, hip.y + tNy * 9.6);
    ctx.lineTo(hemX + tNx * 8.6, hemY + tNy * 8.6);
    ctx.stroke();
  }

  // Sculpted calf + athletic crew sock
  const sDx = ankle.x - knee.x;
  const sDy = ankle.y - knee.y;
  const sockStartX = knee.x + sDx * 0.62;
  const sockStartY = knee.y + sDy * 0.62;

  ctx.strokeStyle = skin;
  ctx.lineWidth = 10.2;
  ctx.beginPath();
  ctx.moveTo(knee.x, knee.y);
  ctx.lineTo(sockStartX, sockStartY);
  ctx.stroke();

  ctx.strokeStyle = sockCol;
  ctx.lineWidth = 8.4;
  ctx.beginPath();
  ctx.moveTo(sockStartX, sockStartY);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.stroke();

  // High-top basketball sneaker anchored at ankle
  ctx.save();
  ctx.translate(ankle.x, ankle.y + 4);
  ctx.rotate(toeTilt);

  // Rubber outsole
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-8, 3.5, 25, 3.6, 1.5);
  ctx.fill();

  // Sneaker body
  ctx.fillStyle = isNear ? kit.shoe : '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(-7.5, 4);
  ctx.lineTo(-7, -5.5);
  ctx.lineTo(1, -5.5);
  ctx.quadraticCurveTo(10, -3.5, 16.5, 1.5);
  ctx.lineTo(16.5, 4);
  ctx.closePath();
  ctx.fill();

  // Accent swoosh / trim
  ctx.fillStyle = kit.shoeAccent;
  ctx.fillRect(-3, -0.5, 11, 2.6);
  ctx.restore();
}

function drawPlayerArm(
  ctx: CanvasRenderingContext2D,
  shoulder: Point2D,
  elbow: Point2D,
  wrist: Point2D,
  handAngle: number,
  isNear: boolean,
  kit: VenueKit
) {
  const skin = isNear ? kit.skin : kit.skinFar;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Upper arm + forearm
  ctx.strokeStyle = skin;
  ctx.lineWidth = 8.2;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(elbow.x, elbow.y);
  ctx.lineTo(wrist.x, wrist.y);
  ctx.stroke();

  // Shooter sleeve / wristband accent on near arm
  if (isNear) {
    const fx = wrist.x - elbow.x;
    const fy = wrist.y - elbow.y;
    ctx.strokeStyle = kit.headband;
    ctx.lineWidth = 8.6;
    ctx.beginPath();
    ctx.moveTo(elbow.x + fx * 0.72, elbow.y + fy * 0.72);
    ctx.lineTo(elbow.x + fx * 0.88, elbow.y + fy * 0.88);
    ctx.stroke();
  }

  // Articulated hand + fingers (spread slightly for dribble or goose-neck flick)
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(handAngle);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(3.5, 0, 5.2, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(10.5, -2.5);
  ctx.moveTo(6.5, 0.5);
  ctx.lineTo(11, 1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws the articulated 2-bone IK human basketball shooter standing/jumping on FLOOR_Y.
 */
export function drawBasketballPlayer(
  ctx: CanvasRenderingContext2D,
  shooter: ShooterState,
  timeSec: number,
  venue: CourtVenue
) {
  const kit = getVenueKit(venue);
  const dir = shooter.facing;
  const baseFloorY = FLOOR_Y;
  const rootY = baseFloorY - shooter.yJump;

  // Dynamic floor shadow underneath player (scales down with jump height)
  const jumpScale = Math.max(0.45, 1 - shooter.yJump / 170);
  ctx.save();
  ctx.fillStyle = `rgba(10, 12, 22, ${(0.38 * jumpScale).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(shooter.x, baseFloorY + 2.5, 30 * jumpScale, 6.2 * jumpScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(shooter.x, rootY);
  ctx.scale(dir, 1);

  // Local player coordinates: feet touch local y = 0, facing right (+X)
  const thighLen = 40;
  const shinLen = 39;
  const upperArmLen = 30;
  const forearmLen = 28;

  const isRunning = shooter.pose === 'run';
  const isJumping = shooter.pose === 'jump_release' || shooter.yJump > 6;
  const crouchPx = shooter.crouchAmount * 13;

  // Hip center
  const dribbleBounce =
    shooter.pose === 'dribble' ? Math.sin(shooter.dribblePhase * 2) * 2.2 : 0;
  const hip: Point2D = {
    x: isRunning ? 3 : -2,
    y: -76 + crouchPx + dribbleBounce,
  };

  // Compute ankle positions per pose
  let nearAnkle: Point2D;
  let farAnkle: Point2D;
  let nearToeTilt = 0;
  let farToeTilt = 0;

  if (isJumping && shooter.releaseTimer > 0) {
    // Graceful athletic jump-shot leg sweep
    const lift = Math.min(1, shooter.yJump / 48);
    nearAnkle = { x: 11 * lift + 8, y: -9 + 8 * lift };
    farAnkle = { x: -12 * lift - 6, y: -7 + 6 * lift };
    nearToeTilt = 0.28 * lift;
    farToeTilt = 0.32 * lift;
  } else if (isRunning) {
    const s = shooter.stridePhase;
    const swing = 28;
    const liftNear = Math.max(0, -Math.sin(s)) * 18;
    const liftFar = Math.max(0, Math.sin(s)) * 18;
    nearAnkle = { x: Math.cos(s) * swing, y: -8 - liftNear };
    farAnkle = { x: -Math.cos(s) * swing, y: -8 - liftFar };
    nearToeTilt = Math.sin(s) * 0.24;
    farToeTilt = -Math.sin(s) * 0.24;
  } else {
    // Wide athletic triple-threat / dribble stance
    nearAnkle = { x: 14, y: -8 };
    farAnkle = { x: -15, y: -8 };
  }

  const nearKnee = solveTwoBoneIK(hip, nearAnkle, thighLen, shinLen, 1);
  const farKnee = solveTwoBoneIK(hip, farAnkle, thighLen, shinLen, 1);

  // Torso lean & shoulder joint
  const leanAngle =
    shooter.pose === 'jump_release'
      ? -0.06
      : shooter.pose === 'aim'
        ? 0.2
        : isRunning
          ? 0.24
          : 0.14;
  const torsoLen = 51;
  const shoulder: Point2D = {
    x: hip.x + Math.sin(leanAngle) * torsoLen,
    y: hip.y - Math.cos(leanAngle) * torsoLen,
  };

  // Compute arm IK targets (near = shooting/dribbling arm, far = guide/balance arm)
  let nearWrist: Point2D;
  let farWrist: Point2D;
  let nearHandAngle = 0.35;
  let farHandAngle = 0.2;

  if (shooter.pose === 'jump_release') {
    // Full extension follow-through toward aimAngle + wrist gooseneck snap
    const releaseProgress = Math.min(1, (0.64 - shooter.releaseTimer) / 0.16);
    const localAim = shooter.aimAngle; // negative angle up-right
    const ext = 49 + releaseProgress * 5;
    nearWrist = {
      x: shoulder.x + Math.cos(localAim) * ext,
      y: shoulder.y + Math.sin(localAim) * ext,
    };
    nearHandAngle = localAim + 0.95 * releaseProgress;
    farWrist = {
      x: shoulder.x + Math.cos(localAim + 0.25) * 34,
      y: shoulder.y + Math.sin(localAim + 0.25) * 34 + 6,
    };
    farHandAngle = localAim + 0.2;
  } else if (shooter.pose === 'aim') {
    // Ball cradled in shooting pocket ready to elevate
    nearWrist = { x: shoulder.x + 22, y: shoulder.y + 4 };
    nearHandAngle = -1.2;
    farWrist = { x: shoulder.x + 27, y: shoulder.y + 9 };
    farHandAngle = -0.6;
  } else if (shooter.pose === 'celebrate') {
    const pump = Math.sin(timeSec * 14) * 6;
    nearWrist = { x: shoulder.x + 12, y: shoulder.y - 36 + pump };
    farWrist = { x: shoulder.x - 6, y: shoulder.y - 32 - pump * 0.7 };
    nearHandAngle = -1.4;
    farHandAngle = -1.6;
  } else {
    // Live rhythmic dribbling hand pumping up & down
    const wave = Math.abs(Math.sin(shooter.dribblePhase));
    const pushDown = (1 - wave) * 18;
    nearWrist = {
      x: shoulder.x + 23,
      y: shoulder.y + 34 + pushDown,
    };
    nearHandAngle = 0.25 + (1 - wave) * 0.45;
    // Guide arm balances smoothly opposite stride or tucked near waist
    const balanceSwing = isRunning ? Math.sin(shooter.stridePhase) * 14 : Math.sin(shooter.dribblePhase) * 3;
    farWrist = {
      x: shoulder.x - 10 - balanceSwing,
      y: shoulder.y + 28,
    };
    farHandAngle = 0.6;
  }

  const nearElbow = solveTwoBoneIK(shoulder, nearWrist, upperArmLen, forearmLen, -1);
  const farElbow = solveTwoBoneIK(shoulder, farWrist, upperArmLen, forearmLen, -1);

  // 1. Far Arm & Far Leg (behind torso)
  drawPlayerArm(ctx, shoulder, farElbow, farWrist, farHandAngle, false, kit);
  drawPlayerLeg(ctx, hip, farKnee, farAnkle, farToeTilt, false, kit);

  // 2. Sculpted Athletic Torso + Basketball Jersey + Number 23
  ctx.fillStyle = kit.jersey;
  ctx.beginPath();
  ctx.moveTo(hip.x - 11, hip.y + 4);
  ctx.quadraticCurveTo(hip.x - 13, hip.y - 26, shoulder.x - 12, shoulder.y - 5);
  ctx.quadraticCurveTo(shoulder.x + 2, shoulder.y - 11, shoulder.x + 13, shoulder.y - 3);
  ctx.quadraticCurveTo(hip.x + 15, hip.y - 16, hip.x + 11, hip.y + 5);
  ctx.closePath();
  ctx.fill();

  // Jersey side trim & collar
  ctx.strokeStyle = kit.jerseyTrim;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(hip.x + 2, hip.y - 2);
  ctx.lineTo(shoulder.x + 1, shoulder.y - 2);
  ctx.stroke();

  // Jersey number
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('23', (hip.x + shoulder.x) * 0.5 + 3, (hip.y + shoulder.y) * 0.5 + 2);

  // 3. Neck, Head, Athletic Headband & Hair looking toward hoop
  const headPitch =
    shooter.pose === 'aim' || shooter.pose === 'jump_release' ? -0.22 : -0.05;
  const headCenter: Point2D = {
    x: shoulder.x + 4,
    y: shoulder.y - 21,
  };

  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 1, shoulder.y - 7);
  ctx.lineTo(headCenter.x, headCenter.y + 6);
  ctx.stroke();

  ctx.save();
  ctx.translate(headCenter.x, headCenter.y);
  ctx.rotate(headPitch);

  // Head
  ctx.fillStyle = kit.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 11.2, 0, Math.PI * 2);
  ctx.fill();

  // Hair / fade cap
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(-1.5, -2.5, 11.2, Math.PI * 0.92, Math.PI * 2.02);
  ctx.closePath();
  ctx.fill();

  // Athletic headband
  ctx.strokeStyle = kit.headband;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(-10.5, -4);
  ctx.quadraticCurveTo(0, -5.5, 10.2, -3.5);
  ctx.stroke();

  // Subtle focused eye / brow
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(6.8, -0.5, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 4. Near Leg & Near Shooting/Dribbling Arm (in foreground)
  drawPlayerLeg(ctx, hip, nearKnee, nearAnkle, nearToeTilt, true, kit);
  drawPlayerArm(ctx, shoulder, nearElbow, nearWrist, nearHandAngle, true, kit);

  ctx.restore();
}
