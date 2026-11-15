import Matter from 'matter-js';

export type BirdType = 'red' | 'chuck' | 'blues' | 'bomb' | 'terence';
export type PigVariant = 'minion' | 'helmet' | 'king';
export type BlockKind =
  | 'bird'
  | 'wood'
  | 'ice'
  | 'stone'
  | 'tnt'
  | 'bouncer'
  | 'boulder'
  | 'pig'
  | 'ground';

export interface BirdSpec {
  id: BirdType;
  name: string;
  tagline: string;
  abilityName: string;
  radius: number;
  density: number;
  restitution: number;
  accentColor: string;
}

export const BIRD_SPECS: Record<BirdType, BirdSpec> = {
  red: {
    id: 'red',
    name: 'Red',
    tagline: 'Balanced · Sonic Cry',
    abilityName: 'Sonic Pulse',
    radius: 19,
    density: 2.35,
    restitution: 0.34,
    accentColor: '#ef4444',
  },
  chuck: {
    id: 'chuck',
    name: 'Chuck',
    tagline: 'Wood Piercer · Turbo Dash',
    abilityName: 'Turbo Dash',
    radius: 18,
    density: 2.1,
    restitution: 0.28,
    accentColor: '#facc15',
  },
  blues: {
    id: 'blues',
    name: 'Blues',
    tagline: 'Ice Breaker · Triple Split',
    abilityName: 'Triple Split',
    radius: 13.5,
    density: 1.85,
    restitution: 0.36,
    accentColor: '#38bdf8',
  },
  bomb: {
    id: 'bomb',
    name: 'Bomb',
    tagline: 'Heavy Blast · Shockwave',
    abilityName: 'Mega Blast',
    radius: 23,
    density: 3.15,
    restitution: 0.22,
    accentColor: '#334155',
  },
  terence: {
    id: 'terence',
    name: 'Terence',
    tagline: 'Stone Crusher · Meteor Slam',
    abilityName: 'Seismic Slam',
    radius: 27,
    density: 4.75,
    restitution: 0.18,
    accentColor: '#991b1b',
  },
};

export const BIRD_ROSTER_ORDER: BirdType[] = ['red', 'chuck', 'blues', 'bomb', 'terence'];

export interface RigidBody {
  id: number;
  shape: 'box' | 'circle';
  kind: BlockKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  hw: number;
  hh: number;
  radius: number;
  isStatic: boolean;
  isActive: boolean;
  hp: number;
  maxHp: number;
  hitFlash: number;
  hasStruck: boolean;
  flightAge: number;
  restAge: number;
  fadeAlpha: number;
  fadingOut: boolean;
  matterBody: Matter.Body;
  // Angry Birds 5.0 extensions
  birdType?: BirdType;
  abilityUsed?: boolean;
  dashTimer?: number;
  fuseTimer?: number;
  pigVariant?: PigVariant;
  armorHp?: number;
  maxArmorHp?: number;
  bounceFlash?: number;
}

export type SlingshotEnvPreset = 'standard' | 'low-g' | 'breeze';

export interface ImpactEvent {
  x: number;
  y: number;
  relVx: number;
  relVy: number;
  extentW: number;
  isFloor: boolean;
  impulse: number;
  kindA: BlockKind;
  kindB: BlockKind;
  destroyedKind?: BlockKind;
  isBouncer?: boolean;
  armorBroken?: boolean;
  armorBreakX?: number;
  armorBreakY?: number;
  armorVariant?: PigVariant;
}

export interface ExplosionEvent {
  x: number;
  y: number;
  radius: number;
  power: number;
  source: 'tnt' | 'bomb' | 'sonic';
  destroyedBodies: Array<{
    kind: BlockKind;
    x: number;
    y: number;
    pigVariant?: PigVariant;
  }>;
  chainTnts: RigidBody[];
}

export interface PhysicsWorld {
  engine: Matter.Engine;
  bodies: RigidBody[];
  bodyByMatterId: Map<number, RigidBody>;
  pendingImpacts: ImpactEvent[];
  pendingTntDetonations: RigidBody[];
}

export const WORLD_W = 1480;
export const WORLD_H = 720;
export const GROUND_Y = 606;
export const SLING_ANCHOR_X = 248;
export const SLING_ANCHOR_Y = 472;
export const GRAVITY = 880;

// Exact Matter.js gravity scale matching GRAVITY = 880 px/s^2 at fixed 60Hz (1000/60 ms)
const FIXED_STEP_MS = 1000 / 60;
const MATTER_GRAVITY_SCALE = GRAVITY / (60 * 60 * FIXED_STEP_MS * FIXED_STEP_MS);

export function getEnvironmentParams(preset: SlingshotEnvPreset): {
  gravityScale: number;
  windFactor: number;
} {
  if (preset === 'low-g') {
    return { gravityScale: 0.62, windFactor: 0 };
  }
  if (preset === 'breeze') {
    return { gravityScale: 1.0, windFactor: -0.1 };
  }
  return { gravityScale: 1.0, windFactor: 0 };
}

export function setWorldEnvironment(
  world: PhysicsWorld,
  preset: SlingshotEnvPreset
): { gravityScale: number; windFactor: number } {
  const { gravityScale, windFactor } = getEnvironmentParams(preset);
  world.engine.gravity.y = 1;
  world.engine.gravity.x = windFactor;
  world.engine.gravity.scale = MATTER_GRAVITY_SCALE * gravityScale;
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    if (b.isActive && !b.isStatic) {
      Matter.Sleeping.set(b.matterBody, false);
    }
  }
  return { gravityScale, windFactor };
}

let nextBodyId = 1;

function applyDamageWithMaterialMatchup(
  target: RigidBody,
  attacker: RigidBody,
  baseDamage: number,
  ev: ImpactEvent
) {
  if (target.isStatic || target.kind === 'bird' || target.kind === 'bouncer') return;

  let mult = 1.0;
  if (attacker.kind === 'bird') {
    if (attacker.birdType === 'blues' && target.kind === 'ice') mult = 2.85;
    else if (attacker.birdType === 'chuck' && target.kind === 'wood') mult = 2.35;
    else if (
      (attacker.birdType === 'terence' || attacker.birdType === 'bomb') &&
      target.kind === 'stone'
    ) {
      mult = 1.85;
    } else if (attacker.birdType === 'terence') {
      mult = 1.35;
    }
  } else if (attacker.kind === 'boulder') {
    mult = 1.65;
  }

  let dmg = baseDamage * mult;

  // Armor check for Helmet Pig and King Pig
  if (target.kind === 'pig' && target.armorHp !== undefined && target.armorHp > 0) {
    const absorbed = Math.min(target.armorHp, dmg);
    target.armorHp -= absorbed;
    dmg -= absorbed * 0.72;
    if (target.armorHp <= 0) {
      target.armorHp = 0;
      ev.armorBroken = true;
      ev.armorBreakX = target.x;
      ev.armorBreakY = target.y - target.radius * 0.65;
      ev.armorVariant = target.pigVariant;
    }
  }

  target.hp -= dmg;
  target.hitFlash = 1;
}

export function createPhysicsWorld(envPreset: SlingshotEnvPreset = 'standard'): PhysicsWorld {
  const engine = Matter.Engine.create({
    enableSleeping: true,
    positionIterations: 7,
    velocityIterations: 5,
    constraintIterations: 2,
  });
  const { gravityScale, windFactor } = getEnvironmentParams(envPreset);
  engine.gravity.x = windFactor;
  engine.gravity.y = 1;
  engine.gravity.scale = MATTER_GRAVITY_SCALE * gravityScale;

  const world: PhysicsWorld = {
    engine,
    bodies: [],
    bodyByMatterId: new Map(),
    pendingImpacts: [],
    pendingTntDetonations: [],
  };

  Matter.Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = world.bodyByMatterId.get(pair.bodyA.id);
      const bodyB = world.bodyByMatterId.get(pair.bodyB.id);
      if (!bodyA || !bodyB || !bodyA.isActive || !bodyB.isActive) continue;

      if (bodyA.kind === 'bird' && bodyB.kind !== 'bird' && !bodyA.hasStruck) {
        bodyA.hasStruck = true;
        bodyA.matterBody.frictionAir = 0.011;
        if (bodyA.birdType === 'bomb' && !bodyA.abilityUsed && bodyA.fuseTimer === undefined) {
          bodyA.fuseTimer = 1.05;
        }
      }
      if (bodyB.kind === 'bird' && bodyA.kind !== 'bird' && !bodyB.hasStruck) {
        bodyB.hasStruck = true;
        bodyB.matterBody.frictionAir = 0.011;
        if (bodyB.birdType === 'bomb' && !bodyB.abilityUsed && bodyB.fuseTimer === undefined) {
          bodyB.fuseTimer = 1.05;
        }
      }

      const relVx = (pair.bodyB.velocity.x - pair.bodyA.velocity.x) * 60;
      const relVy = (pair.bodyB.velocity.y - pair.bodyA.velocity.y) * 60;
      const relSpeed = Math.hypot(relVx, relVy);

      // Elastic bouncer pad reaction (even at moderate contact speeds)
      const isBouncer = bodyA.kind === 'bouncer' || bodyB.kind === 'bouncer';
      if (isBouncer && relSpeed > 35) {
        const bouncer = bodyA.kind === 'bouncer' ? bodyA : bodyB;
        const jumper = bodyA.kind === 'bouncer' ? bodyB : bodyA;
        if (!jumper.isStatic) {
          bouncer.bounceFlash = 1;
          Matter.Sleeping.set(jumper.matterBody, false);
          const curVx = jumper.matterBody.velocity.x * 60;
          const curVy = jumper.matterBody.velocity.y * 60;
          const boostVy = -Math.max(480, Math.min(820, Math.abs(curVy) * 1.16 + 220));
          const boostVx = curVx * 1.06 + Math.sin(bouncer.angle) * 240;
          Matter.Body.setVelocity(jumper.matterBody, {
            x: boostVx / 60,
            y: boostVy / 60,
          });
          world.pendingImpacts.push({
            x: bouncer.x,
            y: bouncer.y - bouncer.hh,
            relVx,
            relVy,
            extentW: bouncer.hw * 2,
            isFloor: false,
            impulse: 380,
            kindA: bodyA.kind,
            kindB: bodyB.kind,
            isBouncer: true,
          });
        }
        continue;
      }

      if (relSpeed < 45) continue;

      const massA = bodyA.isStatic ? 12 : pair.bodyA.mass;
      const massB = bodyB.isStatic ? 12 : pair.bodyB.mass;
      const effMass = (massA * massB) / (massA + massB);
      const impulse = relSpeed * effMass * 0.45;

      const supportPt =
        pair.collision.supports && pair.collision.supports.length > 0
          ? pair.collision.supports[0]
          : {
              x: (pair.bodyA.position.x + pair.bodyB.position.x) * 0.5,
              y: (pair.bodyA.position.y + pair.bodyB.position.y) * 0.5,
            };

      const nonGroundBody = bodyA.kind === 'ground' ? bodyB : bodyA;
      const extentW =
        nonGroundBody.shape === 'circle'
          ? nonGroundBody.radius * 2
          : Math.max(18, nonGroundBody.hw * 2);
      const isFloor =
        (bodyA.kind === 'ground' || bodyB.kind === 'ground') &&
        supportPt.y >= GROUND_Y - 26 &&
        supportPt.x >= -260 &&
        supportPt.x <= WORLD_W + 180;

      if (impulse > 110) {
        if (!bodyA.isStatic) Matter.Sleeping.set(pair.bodyA, false);
        if (!bodyB.isStatic) Matter.Sleeping.set(pair.bodyB, false);
      }

      const ev: ImpactEvent = {
        x: supportPt.x,
        y: supportPt.y,
        relVx,
        relVy,
        extentW,
        isFloor,
        impulse,
        kindA: bodyA.kind,
        kindB: bodyB.kind,
      };

      if (impulse > 135) {
        const dmg = (impulse - 118) * 0.24;
        applyDamageWithMaterialMatchup(bodyA, bodyB, dmg, ev);
        applyDamageWithMaterialMatchup(bodyB, bodyA, dmg, ev);

        if (bodyA.kind === 'tnt' && (bodyA.hp <= 0 || impulse > 195)) {
          bodyA.hp = 0;
          world.pendingTntDetonations.push(bodyA);
        }
        if (bodyB.kind === 'tnt' && (bodyB.hp <= 0 || impulse > 195)) {
          bodyB.hp = 0;
          world.pendingTntDetonations.push(bodyB);
        }

        if (!bodyA.isStatic && bodyA.kind !== 'bird' && bodyA.hp <= 0) {
          ev.destroyedKind = bodyA.kind;
        } else if (!bodyB.isStatic && bodyB.kind !== 'bird' && bodyB.hp <= 0) {
          ev.destroyedKind = bodyB.kind;
        }
      }

      if (impulse > 95) {
        world.pendingImpacts.push(ev);
      }
    }
  });

  return world;
}

export function createBoxBody(opts: {
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  density?: number;
  restitution?: number;
  friction?: number;
  hp?: number;
  isStatic?: boolean;
  angle?: number;
}): RigidBody {
  const hw = opts.w * 0.5;
  const hh = opts.h * 0.5;
  const maxHp = opts.hp ?? 100;
  const isStatic = Boolean(opts.isStatic);

  const matterBody = Matter.Bodies.rectangle(opts.x, opts.y, opts.w, opts.h, {
    isStatic,
    angle: opts.angle ?? 0,
    density: (opts.density ?? 1.0) * 0.0018,
    restitution: opts.restitution ?? 0.06,
    friction: opts.friction ?? 0.62,
    frictionStatic: 0.85,
    frictionAir: 0.004,
    slop: 0.02,
    sleepThreshold: 38,
    collisionFilter: {
      group: 0,
      category: 0x0001,
      mask: 0xffffffff,
    },
  });

  return {
    id: nextBodyId++,
    shape: 'box',
    kind: opts.kind,
    x: opts.x,
    y: opts.y,
    vx: 0,
    vy: 0,
    angle: opts.angle ?? 0,
    omega: 0,
    hw,
    hh,
    radius: Math.hypot(hw, hh),
    isStatic,
    isActive: true,
    hp: maxHp,
    maxHp,
    hitFlash: 0,
    hasStruck: false,
    flightAge: 0,
    restAge: 0,
    fadeAlpha: 1,
    fadingOut: false,
    bounceFlash: 0,
    matterBody,
  };
}

export function createCircleBody(opts: {
  kind: BlockKind;
  x: number;
  y: number;
  radius: number;
  density?: number;
  restitution?: number;
  friction?: number;
  hp?: number;
  isActive?: boolean;
  passThroughGroup?: boolean;
  birdType?: BirdType;
  pigVariant?: PigVariant;
  armorHp?: number;
}): RigidBody {
  const maxHp = opts.hp ?? 100;
  const isBird = opts.kind === 'bird';
  const groupVal = isBird && opts.passThroughGroup ? -1 : 0;

  // CRITICAL: Always pass an explicit collisionFilter object (never undefined) so Matter.Detector.canCollide never throws
  const matterBody = Matter.Bodies.circle(opts.x, opts.y, opts.radius, {
    isStatic: false,
    density: (opts.density ?? 1.6) * 0.0022,
    restitution: opts.restitution ?? (isBird ? 0.34 : 0.25),
    friction: opts.friction ?? (isBird ? 0.65 : 0.5),
    frictionStatic: isBird ? 0.85 : 0.65,
    frictionAir: isBird ? 0 : 0.004,
    slop: 0.02,
    sleepThreshold: isBird ? 50 : 42,
    collisionFilter: {
      group: groupVal,
      category: 0x0001,
      mask: 0xffffffff,
    },
  });

  return {
    id: nextBodyId++,
    shape: 'circle',
    kind: opts.kind,
    x: opts.x,
    y: opts.y,
    vx: 0,
    vy: 0,
    angle: 0,
    omega: 0,
    hw: opts.radius,
    hh: opts.radius,
    radius: opts.radius,
    isStatic: false,
    isActive: opts.isActive ?? true,
    hp: maxHp,
    maxHp,
    hitFlash: 0,
    hasStruck: false,
    flightAge: 0,
    restAge: 0,
    fadeAlpha: 1,
    fadingOut: false,
    matterBody,
    birdType: opts.birdType,
    abilityUsed: false,
    pigVariant: opts.pigVariant,
    armorHp: opts.armorHp,
    maxArmorHp: opts.armorHp,
  };
}

export function spawnBirdByType(
  birdType: BirdType,
  x: number,
  y: number,
  passThroughGroup: boolean,
  isActive = false
): RigidBody {
  const spec = BIRD_SPECS[birdType];
  return createCircleBody({
    kind: 'bird',
    x,
    y,
    radius: spec.radius,
    density: spec.density,
    restitution: spec.restitution,
    friction: 0.65,
    hp: 9999,
    isActive,
    passThroughGroup,
    birdType,
  });
}

export function setWorldBirdPassThrough(world: PhysicsWorld, passThrough: boolean) {
  const groupVal = passThrough ? -1 : 0;
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    if (b.kind === 'bird') {
      if (!b.matterBody.collisionFilter) {
        b.matterBody.collisionFilter = { group: groupVal, category: 0x0001, mask: 0xffffffff };
      } else {
        b.matterBody.collisionFilter.group = groupVal;
      }
    }
  }
}

export function addBodyToWorld(world: PhysicsWorld, body: RigidBody) {
  world.bodies.push(body);
  world.bodyByMatterId.set(body.matterBody.id, body);
  if (body.isActive) {
    Matter.Composite.add(world.engine.world, body.matterBody);
  }
}

export function launchBodyInWorld(
  world: PhysicsWorld,
  body: RigidBody,
  x: number,
  y: number,
  vxSec: number,
  vySec: number
) {
  body.x = x;
  body.y = y;
  body.vx = vxSec;
  body.vy = vySec;
  body.angle = Math.atan2(vySec, vxSec);
  body.hasStruck = false;
  body.abilityUsed = false;
  body.dashTimer = 0;
  body.fuseTimer = undefined;
  body.flightAge = 0;
  body.restAge = 0;
  body.fadeAlpha = 1;
  body.fadingOut = false;
  body.isActive = true;

  Matter.Body.setPosition(body.matterBody, { x, y });
  Matter.Body.setAngle(body.matterBody, body.angle);
  Matter.Body.setAngularVelocity(body.matterBody, 0);
  body.matterBody.frictionAir = 0;
  Matter.Sleeping.set(body.matterBody, false);
  Matter.Body.setVelocity(body.matterBody, {
    x: vxSec / 60,
    y: vySec / 60,
  });

  if (!world.bodyByMatterId.has(body.matterBody.id)) {
    world.bodies.push(body);
    world.bodyByMatterId.set(body.matterBody.id, body);
  }
  const existing = Matter.Composite.get(world.engine.world, body.matterBody.id, 'body');
  if (!existing) {
    Matter.Composite.add(world.engine.world, body.matterBody);
  }
}

export function removeBodyFromWorld(world: PhysicsWorld, body: RigidBody) {
  body.isActive = false;
  Matter.Composite.remove(world.engine.world, body.matterBody);
}

export function wakeBodiesNear(
  bodies: RigidBody[],
  x: number,
  y: number,
  radius: number
) {
  const rSq = radius * radius;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.isActive || b.isStatic) continue;
    if (b.kind === 'bird' && b.hasStruck && b.restAge > 0.35) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    if (dx * dx + dy * dy <= rSq) {
      Matter.Sleeping.set(b.matterBody, false);
    }
  }
}

export function triggerExplosionInWorld(
  world: PhysicsWorld,
  x: number,
  y: number,
  radius: number,
  power: number,
  source: 'tnt' | 'bomb' | 'sonic'
): ExplosionEvent {
  const destroyedBodies: ExplosionEvent['destroyedBodies'] = [];
  const chainTnts: RigidBody[] = [];

  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    if (!b.isActive || b.isStatic) continue;

    const dx = b.x - x;
    const dy = b.y - y;
    if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) continue;

    const falloff = Math.max(0.12, 1 - dist / radius);
    Matter.Sleeping.set(b.matterBody, false);

    // Apply radial blast impulse (stronger upward bias so debris showers organically)
    const nx = dist > 2 ? dx / dist : (Math.random() - 0.5) * 0.4;
    const ny = dist > 2 ? dy / dist - 0.25 : -1;
    const normLen = Math.hypot(nx, ny) || 1;
    const speedAdd = (power * falloff * (b.kind === 'bird' ? 380 : 640)) / Math.max(0.75, Math.sqrt(b.matterBody.mass));
    Matter.Body.setVelocity(b.matterBody, {
      x: b.matterBody.velocity.x + (nx / normLen) * (speedAdd / 60),
      y: b.matterBody.velocity.y + (ny / normLen) * (speedAdd / 60),
    });

    if (source === 'sonic' && b.kind !== 'ice' && b.kind !== 'tnt') {
      // Red sonic pulse mostly knocks things over and shatters nearby brittle ice/TNT
      if (b.kind === 'pig') {
        b.hp -= 14 * falloff;
        b.hitFlash = 1;
      }
      continue;
    }

    if (b.kind === 'bird') continue;

    const blastDmg = power * 235 * falloff;
    if (b.kind === 'pig' && b.armorHp !== undefined && b.armorHp > 0) {
      const absorbed = Math.min(b.armorHp, blastDmg);
      b.armorHp -= absorbed;
      b.hp -= (blastDmg - absorbed * 0.5);
    } else {
      b.hp -= blastDmg;
    }
    b.hitFlash = 1;

    if (b.kind === 'tnt' && (b.hp <= 0 || falloff > 0.35)) {
      b.hp = 0;
      chainTnts.push(b);
    } else if (b.hp <= 0) {
      removeBodyFromWorld(world, b);
      destroyedBodies.push({
        kind: b.kind,
        x: b.x,
        y: b.y,
        pigVariant: b.pigVariant,
      });
    }
  }

  return {
    x,
    y,
    radius,
    power,
    source,
    destroyedBodies,
    chainTnts,
  };
}

export interface AbilityOutcome {
  triggered: boolean;
  birdType: BirdType;
  x: number;
  y: number;
  spawnedSiblings?: RigidBody[];
  explosion?: ExplosionEvent;
}

export function activateBirdAbilityInWorld(
  world: PhysicsWorld,
  bird: RigidBody,
  passThroughGroup: boolean
): AbilityOutcome {
  const bType: BirdType = bird.birdType ?? 'red';
  if (!bird.isActive || bird.abilityUsed) {
    return { triggered: false, birdType: bType, x: bird.x, y: bird.y };
  }
  bird.abilityUsed = true;

  if (bType === 'chuck') {
    const speed = Math.hypot(bird.vx, bird.vy);
    const dirX = speed > 10 ? Math.max(0.45, bird.vx / speed) : 1;
    const dirY = speed > 10 ? (bird.vy / speed) * 0.22 : -0.05;
    const norm = Math.hypot(dirX, dirY) || 1;
    const boost = Math.max(1060, speed * 1.85);
    const nvx = (dirX / norm) * boost;
    const nvy = (dirY / norm) * boost;
    bird.vx = nvx;
    bird.vy = nvy;
    bird.angle = Math.atan2(nvy, nvx);
    bird.dashTimer = 0.45;
    Matter.Sleeping.set(bird.matterBody, false);
    Matter.Body.setVelocity(bird.matterBody, { x: nvx / 60, y: nvy / 60 });
    Matter.Body.setAngle(bird.matterBody, bird.angle);
    return { triggered: true, birdType: bType, x: bird.x, y: bird.y };
  }

  if (bType === 'blues') {
    const baseAngle = Math.atan2(bird.vy, bird.vx);
    const speed = Math.max(420, Math.hypot(bird.vx, bird.vy) * 1.08);
    const offsets = [-0.24, 0.24];
    const spawnedSiblings: RigidBody[] = [];

    for (let i = 0; i < offsets.length; i++) {
      const a = baseAngle + offsets[i];
      const sibling = spawnBirdByType(
        'blues',
        bird.x + Math.cos(a) * 12,
        bird.y + Math.sin(a) * 18,
        passThroughGroup,
        true
      );
      sibling.abilityUsed = true;
      launchBodyInWorld(world, sibling, sibling.x, sibling.y, Math.cos(a) * speed, Math.sin(a) * speed);
      spawnedSiblings.push(sibling);
    }

    // Also give center bird a small speed crispness
    Matter.Body.setVelocity(bird.matterBody, {
      x: (Math.cos(baseAngle) * speed) / 60,
      y: (Math.sin(baseAngle) * speed) / 60,
    });
    return {
      triggered: true,
      birdType: bType,
      x: bird.x,
      y: bird.y,
      spawnedSiblings,
    };
  }

  if (bType === 'bomb') {
    const bx = bird.x;
    const by = bird.y;
    bird.fuseTimer = undefined;
    removeBodyFromWorld(world, bird);
    const explosion = triggerExplosionInWorld(world, bx, by, 230, 1.35, 'bomb');
    return {
      triggered: true,
      birdType: bType,
      x: bx,
      y: by,
      explosion,
    };
  }

  if (bType === 'terence') {
    const nvx = Math.max(260, bird.vx * 1.15);
    const nvy = Math.max(660, bird.vy + 620);
    bird.vx = nvx;
    bird.vy = nvy;
    bird.dashTimer = 0.35;
    Matter.Sleeping.set(bird.matterBody, false);
    Matter.Body.setVelocity(bird.matterBody, { x: nvx / 60, y: nvy / 60 });
    return { triggered: true, birdType: bType, x: bird.x, y: bird.y };
  }

  // Red: Battle-Cry Sonic Pulse
  const explosion = triggerExplosionInWorld(world, bird.x, bird.y, 175, 0.92, 'sonic');
  return {
    triggered: true,
    birdType: 'red',
    x: bird.x,
    y: bird.y,
    explosion,
  };
}

export function stepPhysicsWorld(
  world: PhysicsWorld,
  dtSec: number,
  onImpact?: (ev: ImpactEvent) => void
): void {
  const substeps = 2;
  const subMs = FIXED_STEP_MS / substeps;
  const subDt = dtSec / substeps;

  for (let s = 0; s < substeps; s++) {
    Matter.Engine.update(world.engine, subMs);
    for (let i = 0; i < world.bodies.length; i++) {
      const b = world.bodies[i];
      if (!b.isActive || b.isStatic) {
        if (b.bounceFlash && b.bounceFlash > 0) {
          b.bounceFlash = Math.max(0, b.bounceFlash - subDt * 5.2);
        }
        continue;
      }
      if (b.hitFlash > 0) {
        b.hitFlash = Math.max(0, b.hitFlash - subDt * 4.8);
      }
      if (b.dashTimer && b.dashTimer > 0) {
        b.dashTimer = Math.max(0, b.dashTimer - subDt);
      }
    }
  }

  let anyInactive = false;
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    if (!b.isActive) {
      anyInactive = true;
      continue;
    }
    if (b.isStatic) continue;
    const mb = b.matterBody;
    b.x = mb.position.x;
    b.y = mb.position.y;
    b.vx = mb.velocity.x * 60;
    b.vy = mb.velocity.y * 60;
    b.angle = mb.angle;
    b.omega = mb.angularVelocity * 60;
    if (b.kind === 'bird') {
      b.flightAge += dtSec;
      const spd = Math.hypot(b.vx, b.vy);
      if (
        (b.hasStruck || b.y >= GROUND_Y - b.radius - 14 || mb.isSleeping) &&
        spd < 26 &&
        Math.abs(b.omega) < 0.85
      ) {
        b.restAge += dtSec;
      } else {
        b.restAge = 0;
      }
      if (b.fadingOut) {
        b.fadeAlpha = Math.max(0, b.fadeAlpha - dtSec * 3.0);
        if (b.fadeAlpha <= 0.01) {
          removeBodyFromWorld(world, b);
          anyInactive = true;
        }
      }
    }
  }

  if (anyInactive && world.bodies.length > 48) {
    let writeIdx = 0;
    for (let i = 0; i < world.bodies.length; i++) {
      const b = world.bodies[i];
      if (b.isActive) {
        world.bodies[writeIdx++] = b;
      } else {
        world.bodyByMatterId.delete(b.matterBody.id);
      }
    }
    world.bodies.length = writeIdx;
  }

  if (world.pendingImpacts.length > 0) {
    if (onImpact) {
      for (let i = 0; i < world.pendingImpacts.length; i++) {
        onImpact(world.pendingImpacts[i]);
      }
    }
    world.pendingImpacts.length = 0;
  }
}
