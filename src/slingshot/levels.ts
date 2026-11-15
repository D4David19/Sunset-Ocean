import {
  addBodyToWorld,
  createBoxBody,
  createCircleBody,
  GROUND_Y,
  WORLD_H,
  WORLD_W,
  type BirdType,
  type PhysicsWorld,
  type PigVariant,
  type RigidBody,
} from './physics2d';

export type TowerPreset =
  | 'arch'
  | 'twin'
  | 'pyramid'
  | 'quarry'
  | 'citadel'
  | 'gauntlet';

export interface LevelDefinition {
  index: number;
  id: TowerPreset;
  name: string;
  shortName: string;
  subtitle: string;
  squad: BirdType[];
  starScores: [number, number, number];
  atmosphereIndex: 0 | 1 | 2;
  build: (world: PhysicsWorld) => RigidBody[];
}

function createLevelHelpers(world: PhysicsWorld, created: RigidBody[]) {
  const push = (b: RigidBody) => {
    addBodyToWorld(world, b);
    created.push(b);
    return b;
  };

  // Floor & right backstop (extended wide for 21:9 panoramic battles)
  push(
    createBoxBody({
      kind: 'ground',
      x: WORLD_W * 0.5,
      y: GROUND_Y + 60,
      w: WORLD_W * 3.2,
      h: 120,
      isStatic: true,
      friction: 0.85,
      restitution: 0.05,
    })
  );

  push(
    createBoxBody({
      kind: 'ground',
      x: WORLD_W + 140,
      y: WORLD_H * 0.5,
      w: 60,
      h: WORLD_H * 1.5,
      isStatic: true,
      friction: 0.4,
      restitution: 0.25,
    })
  );

  const wood = (x: number, y: number, w: number, h: number, angle = 0) =>
    push(
      createBoxBody({
        kind: 'wood',
        x,
        y,
        w,
        h,
        angle,
        density: 1.0,
        friction: 0.62,
        restitution: 0.06,
        hp: 82,
      })
    );

  const stone = (x: number, y: number, w: number, h: number, angle = 0) =>
    push(
      createBoxBody({
        kind: 'stone',
        x,
        y,
        w,
        h,
        angle,
        density: 1.75,
        friction: 0.72,
        restitution: 0.04,
        hp: 155,
      })
    );

  const ice = (x: number, y: number, w: number, h: number, angle = 0) =>
    push(
      createBoxBody({
        kind: 'ice',
        x,
        y,
        w,
        h,
        angle,
        density: 0.78,
        friction: 0.28,
        restitution: 0.08,
        hp: 40,
      })
    );

  const tnt = (x: number, y: number, size = 34) =>
    push(
      createBoxBody({
        kind: 'tnt',
        x,
        y,
        w: size,
        h: size,
        density: 0.95,
        friction: 0.68,
        restitution: 0.08,
        hp: 26,
      })
    );

  const platform = (x: number, y: number, w: number, h = 18, angle = 0) =>
    push(
      createBoxBody({
        kind: 'ground',
        x,
        y,
        w,
        h,
        angle,
        isStatic: true,
        friction: 0.75,
        restitution: 0.08,
      })
    );

  const bouncer = (x: number, y: number, w = 88, angle = -0.14) =>
    push(
      createBoxBody({
        kind: 'bouncer',
        x,
        y,
        w,
        h: 18,
        angle,
        isStatic: true,
        friction: 0.2,
        restitution: 1.18,
      })
    );

  const boulder = (x: number, y: number, r = 24) =>
    push(
      createCircleBody({
        kind: 'boulder',
        x,
        y,
        radius: r,
        density: 2.8,
        friction: 0.45,
        restitution: 0.18,
        hp: 280,
      })
    );

  const pig = (x: number, y: number, variant: PigVariant = 'minion', customR?: number) => {
    const r = customR ?? (variant === 'king' ? 25 : variant === 'helmet' ? 20 : 18);
    const hp = variant === 'king' ? 68 : variant === 'helmet' ? 46 : 32;
    const armorHp = variant === 'king' ? 54 : variant === 'helmet' ? 38 : 0;
    return push(
      createCircleBody({
        kind: 'pig',
        x,
        y,
        radius: r,
        density: 0.92,
        friction: 0.52,
        restitution: 0.22,
        hp,
        pigVariant: variant,
        armorHp,
      })
    );
  };

  return { wood, stone, ice, tnt, platform, bouncer, boulder, pig };
}

export const LEVEL_CATALOG: LevelDefinition[] = [
  {
    index: 0,
    id: 'arch',
    name: '01. Timber Watch',
    shortName: 'Watch',
    subtitle: 'Timber arch with cellar TNT barrel',
    squad: ['red', 'chuck', 'bomb', 'blues', 'terence'],
    starScores: [1200, 2600, 4200],
    atmosphereIndex: 0,
    build: (world) => {
      const created: RigidBody[] = [];
      const { wood, stone, ice, tnt, pig } = createLevelHelpers(world, created);
      const cx = 960;

      // Ground level bay
      stone(cx - 92, GROUND_Y - 46, 24, 92);
      stone(cx + 92, GROUND_Y - 46, 24, 92);
      ice(cx - 42, GROUND_Y - 36, 18, 72);
      ice(cx + 42, GROUND_Y - 36, 18, 72);
      tnt(cx, GROUND_Y - 17, 34);

      // Floor 1 deck
      wood(cx, GROUND_Y - 103, 224, 22);
      wood(cx - 60, GROUND_Y - 156, 20, 84);
      wood(cx + 60, GROUND_Y - 156, 20, 84);
      pig(cx - 16, GROUND_Y - 132, 'minion', 17);
      pig(cx + 22, GROUND_Y - 132, 'minion', 17);

      // Floor 2 belfry
      wood(cx, GROUND_Y - 208, 158, 20);
      ice(cx - 28, GROUND_Y - 243, 18, 50);
      ice(cx + 28, GROUND_Y - 243, 18, 50);
      wood(cx, GROUND_Y - 277, 94, 18);
      pig(cx + 126, GROUND_Y - 19, 'helmet', 19);
      wood(cx, GROUND_Y - 301, 28, 30);

      return created;
    },
  },
  {
    index: 1,
    id: 'twin',
    name: '02. Frostbite Spires',
    shortName: 'Frost',
    subtitle: 'Crystal ice spires & suspended boulder trap',
    squad: ['blues', 'chuck', 'red', 'bomb', 'terence'],
    starScores: [1600, 3200, 5000],
    atmosphereIndex: 0,
    build: (world) => {
      const created: RigidBody[] = [];
      const { wood, stone, ice, boulder, pig } = createLevelHelpers(world, created);
      const leftX = 850;
      const rightX = 1090;
      const midX = (leftX + rightX) * 0.5;

      for (const tx of [leftX, rightX]) {
        stone(tx - 40, GROUND_Y - 42, 22, 84);
        stone(tx + 40, GROUND_Y - 42, 22, 84);
        pig(tx, GROUND_Y - 18, 'minion', 18);
        wood(tx, GROUND_Y - 94, 114, 20);
        ice(tx - 32, GROUND_Y - 142, 18, 76);
        ice(tx + 32, GROUND_Y - 142, 18, 76);
        ice(tx, GROUND_Y - 189, 96, 18);
        ice(tx, GROUND_Y - 220, 34, 44);
      }

      // Bridge & perched crushing boulder
      wood(midX, GROUND_Y - 104, 128, 16);
      pig(midX, GROUND_Y - 19, 'helmet', 19);
      ice(midX - 24, GROUND_Y - 129, 16, 34);
      ice(midX + 24, GROUND_Y - 129, 16, 34);
      wood(midX, GROUND_Y - 154, 72, 14);
      boulder(midX, GROUND_Y - 183, 22);

      return created;
    },
  },
  {
    index: 2,
    id: 'pyramid',
    name: '03. Stone Pyramid',
    shortName: 'Pyramid',
    subtitle: 'Armored stone bastion with Helmet Guards',
    squad: ['terence', 'bomb', 'chuck', 'red', 'blues'],
    starScores: [1800, 3600, 5400],
    atmosphereIndex: 1,
    build: (world) => {
      const created: RigidBody[] = [];
      const { wood, stone, ice, tnt, pig } = createLevelHelpers(world, created);
      const cx = 995;

      const cols = [-108, -36, 36, 108];
      for (const dx of cols) {
        stone(cx + dx, GROUND_Y - 34, 26, 68);
      }
      wood(cx - 72, GROUND_Y - 78, 106, 20);
      wood(cx + 72, GROUND_Y - 78, 106, 20);
      pig(cx, GROUND_Y - 19, 'helmet', 19);
      tnt(cx - 72, GROUND_Y - 17, 32);

      stone(cx - 60, GROUND_Y - 122, 22, 68);
      ice(cx, GROUND_Y - 122, 20, 68);
      stone(cx + 60, GROUND_Y - 122, 22, 68);
      wood(cx, GROUND_Y - 166, 156, 20);
      pig(cx - 28, GROUND_Y - 104, 'minion', 16);
      pig(cx + 28, GROUND_Y - 104, 'minion', 16);

      wood(cx - 28, GROUND_Y - 206, 18, 60);
      wood(cx + 28, GROUND_Y - 206, 18, 60);
      wood(cx, GROUND_Y - 245, 92, 18);
      pig(cx, GROUND_Y - 194, 'minion', 17);
      ice(cx, GROUND_Y - 272, 30, 36);

      return created;
    },
  },
  {
    index: 3,
    id: 'quarry',
    name: '04. TNT Quarry',
    shortName: 'Quarry',
    subtitle: 'Chain-reaction powder depot',
    squad: ['chuck', 'red', 'blues', 'bomb', 'terence'],
    starScores: [2200, 4400, 6800],
    atmosphereIndex: 1,
    build: (world) => {
      const created: RigidBody[] = [];
      const { wood, stone, ice, tnt, pig } = createLevelHelpers(world, created);
      const basePositions = [820, 1015, 1210];

      for (let idx = 0; idx < basePositions.length; idx++) {
        const bx = basePositions[idx];
        wood(bx - 42, GROUND_Y - 40, 20, 80);
        wood(bx + 42, GROUND_Y - 40, 20, 80);
        tnt(bx, GROUND_Y - 17, 34);
        wood(bx, GROUND_Y - 90, 114, 20);
        pig(bx, GROUND_Y - 118, idx === 1 ? 'helmet' : 'minion', idx === 1 ? 19 : 17);
        ice(bx - 34, GROUND_Y - 134, 16, 68);
        ice(bx + 34, GROUND_Y - 134, 16, 68);
        wood(bx, GROUND_Y - 177, 98, 18);
        if (idx === 1) {
          tnt(bx, GROUND_Y - 203, 32);
        }
      }

      // Outer stone buttress
      stone(1305, GROUND_Y - 46, 26, 92);
      pig(1265, GROUND_Y - 18, 'minion', 17);

      return created;
    },
  },
  {
    index: 4,
    id: 'citadel',
    name: "05. King's Citadel",
    shortName: 'Citadel',
    subtitle: 'Armored fortress guarding King Pig',
    squad: ['bomb', 'terence', 'chuck', 'blues', 'red'],
    starScores: [2800, 5600, 8500],
    atmosphereIndex: 2,
    build: (world) => {
      const created: RigidBody[] = [];
      const { wood, stone, ice, tnt, pig } = createLevelHelpers(world, created);
      const cx = 1045;

      // Wide stone moat pillars + cellar TNT
      stone(cx - 135, GROUND_Y - 50, 26, 100);
      stone(cx - 52, GROUND_Y - 50, 24, 100);
      stone(cx + 52, GROUND_Y - 50, 24, 100);
      stone(cx + 135, GROUND_Y - 50, 26, 100);

      pig(cx - 94, GROUND_Y - 19, 'helmet', 19);
      tnt(cx, GROUND_Y - 17, 34);
      pig(cx + 94, GROUND_Y - 19, 'helmet', 19);

      // Main keep deck
      stone(cx - 92, GROUND_Y - 111, 120, 22);
      stone(cx + 92, GROUND_Y - 111, 120, 22);
      wood(cx, GROUND_Y - 111, 90, 22);

      // Second story throne hall
      stone(cx - 72, GROUND_Y - 166, 22, 88);
      wood(cx + 72, GROUND_Y - 166, 22, 88);
      ice(cx - 115, GROUND_Y - 156, 16, 68);
      ice(cx + 115, GROUND_Y - 156, 16, 68);
      pig(cx, GROUND_Y - 147, 'king', 25);

      // Royal roof & spire
      wood(cx, GROUND_Y - 220, 196, 20);
      wood(cx - 40, GROUND_Y - 262, 18, 64);
      wood(cx + 40, GROUND_Y - 262, 18, 64);
      stone(cx, GROUND_Y - 303, 110, 18);
      ice(cx, GROUND_Y - 332, 32, 38);

      // Vanguard shield tower
      wood(770, GROUND_Y - 40, 22, 80);
      ice(815, GROUND_Y - 40, 18, 80);
      pig(792, GROUND_Y - 96, 'minion', 16);
      wood(792, GROUND_Y - 88, 76, 16);

      return created;
    },
  },
  {
    index: 5,
    id: 'gauntlet',
    name: '06. Skyway Bouncer',
    shortName: 'Skyway',
    subtitle: 'Bouncer pad trick-shots & elevated island',
    squad: ['chuck', 'blues', 'bomb', 'red', 'terence'],
    starScores: [2400, 4800, 7600],
    atmosphereIndex: 2,
    build: (world) => {
      const created: RigidBody[] = [];
      const { wood, stone, ice, tnt, platform, bouncer, boulder, pig } =
        createLevelHelpers(world, created);

      // Front rubber bouncer pad to ricochet low shots onto the upper island!
      bouncer(640, GROUND_Y - 9, 102, -0.1);

      // Elevated sky island platform (mid-height)
      const platX = 925;
      const platY = 392;
      platform(platX, platY, 240, 18);
      wood(platX - 75, platY - 44, 18, 70);
      ice(platX + 75, platY - 44, 18, 70);
      tnt(platX - 24, platY - 25, 32);
      pig(platX + 26, platY - 28, 'helmet', 19);
      wood(platX, platY - 88, 178, 18);
      boulder(platX + 54, platY - 118, 21);
      pig(platX - 30, platY - 114, 'minion', 16);

      // Ground fortress behind the skyway
      const gx = 1235;
      stone(gx - 68, GROUND_Y - 44, 24, 88);
      stone(gx + 68, GROUND_Y - 44, 24, 88);
      pig(gx, GROUND_Y - 19, 'king', 24);
      wood(gx, GROUND_Y - 98, 166, 20);
      ice(gx - 42, GROUND_Y - 140, 18, 64);
      ice(gx + 42, GROUND_Y - 140, 18, 64);
      tnt(gx, GROUND_Y - 125, 32);
      wood(gx, GROUND_Y - 181, 118, 18);
      pig(gx, GROUND_Y - 208, 'minion', 16);

      return created;
    },
  },
];

export const TOWER_PRESETS: TowerPreset[] = LEVEL_CATALOG.map((l) => l.id);

export function getLevelDef(preset: TowerPreset): LevelDefinition {
  return LEVEL_CATALOG.find((l) => l.id === preset) ?? LEVEL_CATALOG[0];
}

export function buildTowerPreset(
  preset: TowerPreset,
  world: PhysicsWorld
): RigidBody[] {
  return getLevelDef(preset).build(world);
}
