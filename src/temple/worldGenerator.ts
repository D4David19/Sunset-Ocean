import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TempleTextures } from './textures';

export const CHUNK_LENGTH = 20;
export const LANE_X: readonly [number, number, number] = [-2.4, 0, 2.4];

export type ChunkArchetype = 'pathway' | 'bridge' | 'gap_bridge' | 'sanctuary';
export type TempleBiomeId = 'emerald' | 'ember' | 'jade';

export interface ObstacleData {
  id: number;
  kind: 'low_block' | 'high_barrier';
  /** Lanes occupied by this obstacle (0 = left, 1 = center, 2 = right) */
  lanes: number[];
  /** World Z coordinate of obstacle center (negative forward) */
  z: number;
  /** Half-depth along Z */
  halfDepth: number;
  /** Bottom clearance Y (0 for ground obstacle, ~1.08 for slide-under lintel) */
  minY: number;
  /** Top height Y */
  maxY: number;
  passed: boolean;
}

export interface CoinData {
  id: number;
  lane: number;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  mesh: THREE.Object3D;
}

export interface TorchEmitter {
  worldX: number;
  worldY: number;
  worldZ: number;
  flameMesh: THREE.Mesh;
  phase: number;
}

export interface WaterfallInstance {
  x: number;
  y: number;
  z: number;
  mesh: THREE.Mesh;
}

export interface VineInstance {
  pivot: THREE.Group;
  phase: number;
  amp: number;
}

export interface GapSpan {
  /** Closer to player (larger Z, e.g. -47) */
  zStart: number;
  /** Further ahead (smaller Z, e.g. -52) */
  zEnd: number;
}

export type PowerUpKind = 'speed' | 'shield' | 'magnet';

export interface PowerUpData {
  id: number;
  kind: PowerUpKind;
  lane: number;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  mesh: THREE.Group;
}

export interface BoostPadData {
  id: number;
  lane: number;
  x: number;
  z: number;
  triggered: boolean;
  mesh: THREE.Group;
}

export interface TempleChunk {
  index: number;
  archetype: ChunkArchetype;
  zStart: number;
  zEnd: number;
  group: THREE.Group;
  gap: GapSpan | null;
  obstacles: ObstacleData[];
  coins: CoinData[];
  powerUps: PowerUpData[];
  boostPads: BoostPadData[];
  torches: TorchEmitter[];
  waterfalls: WaterfallInstance[];
  vines: VineInstance[];
  dispose: () => void;
}

function createRng(seed: number) {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class StaticBatchBuilder {
  private readonly buckets = new Map<
    string,
    {
      material: THREE.Material;
      castShadow: boolean;
      receiveShadow: boolean;
      geometries: THREE.BufferGeometry[];
    }
  >();

  private readonly scratchMat = new THREE.Matrix4();
  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchEuler = new THREE.Euler();
  private readonly scratchScale = new THREE.Vector3();
  private readonly matIds = new WeakMap<THREE.Material, number>();
  private nextMatId = 1;

  private getMatId(mat: THREE.Material): number {
    let id = this.matIds.get(mat);
    if (!id) {
      id = this.nextMatId++;
      this.matIds.set(mat, id);
    }
    return id;
  }

  public add(
    baseGeo: THREE.BufferGeometry,
    material: THREE.Material,
    opts: {
      x?: number;
      y?: number;
      z?: number;
      rx?: number;
      ry?: number;
      rz?: number;
      sx?: number;
      sy?: number;
      sz?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  ) {
    const castShadow = Boolean(opts.castShadow);
    const receiveShadow = Boolean(opts.receiveShadow);
    const key = `${this.getMatId(material)}_${castShadow ? 1 : 0}_${receiveShadow ? 1 : 0}`;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { material, castShadow, receiveShadow, geometries: [] };
      this.buckets.set(key, bucket);
    }

    const g = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo.clone();
    this.scratchPos.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
    this.scratchEuler.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0);
    this.scratchQuat.setFromEuler(this.scratchEuler);
    this.scratchScale.set(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
    this.scratchMat.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
    g.applyMatrix4(this.scratchMat);

    // Normalize attributes so mergeGeometries never fails across primitives
    for (const attrName of Object.keys(g.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        g.deleteAttribute(attrName);
      }
    }
    if (!g.getAttribute('normal')) {
      g.computeVertexNormals();
    }

    bucket.geometries.push(g);
  }

  public flushInto(group: THREE.Group, chunkDisposables: THREE.BufferGeometry[]) {
    for (const bucket of this.buckets.values()) {
      if (bucket.geometries.length === 0) continue;
      const merged =
        bucket.geometries.length === 1
          ? bucket.geometries[0].clone()
          : mergeGeometries(bucket.geometries, false);

      for (const tempGeo of bucket.geometries) {
        tempGeo.dispose();
      }
      bucket.geometries.length = 0;

      if (!merged) continue;
      chunkDisposables.push(merged);
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = bucket.castShadow;
      mesh.receiveShadow = bucket.receiveShadow;
      group.add(mesh);
    }
    this.buckets.clear();
  }
}

export class TempleWorldGenerator {
  private readonly textures: TempleTextures;
  private readonly castShadow: boolean;
  private readonly fastMode: boolean;
  private nextId = 1;

  // Shared Geometries & Materials (reused across all chunks, disposed on cleanup)
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private readonly stoneMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly darkStoneMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly bridgeMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly cliffMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly mossMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly foliageMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly foliageLightMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly trunkMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly vineMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly ironMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly emberMat: THREE.MeshBasicMaterial;
  private readonly flameMat: THREE.MeshBasicMaterial;
  private readonly coinGoldMat: THREE.MeshStandardMaterial;
  private readonly barrierAccentMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly waterfallMat: THREE.MeshBasicMaterial;
  private readonly abyssWaterMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  private readonly speedCoreMat: THREE.MeshStandardMaterial;
  private readonly speedRingMat: THREE.MeshBasicMaterial;
  private readonly shieldCoreMat: THREE.MeshStandardMaterial;
  private readonly shieldRingMat: THREE.MeshBasicMaterial;
  private readonly magnetCoreMat: THREE.MeshStandardMaterial;
  private readonly magnetRingMat: THREE.MeshBasicMaterial;
  private readonly boostPadBaseMat: THREE.MeshBasicMaterial;
  private readonly boostPadChevronMat: THREE.MeshBasicMaterial;

  // Shared Geometries
  private readonly roadDeckGeo: THREE.BoxGeometry;
  private readonly curbGeo: THREE.BoxGeometry;
  private readonly bridgeHalfDeckGeo: THREE.BoxGeometry;
  private readonly bridgeArchGeo: THREE.BoxGeometry;
  private readonly balustradePostGeo: THREE.BoxGeometry;
  private readonly balustradeRailGeo: THREE.BoxGeometry;
  private readonly pillarShaftGeo: THREE.CylinderGeometry;
  private readonly pillarCapGeo: THREE.BoxGeometry;
  private readonly gateLintelGeo: THREE.BoxGeometry;
  private readonly cliffGeo: THREE.BoxGeometry;
  private readonly trunkGeo: THREE.CylinderGeometry;
  private readonly canopyGeo: THREE.DodecahedronGeometry;
  private readonly vineGeo: THREE.CylinderGeometry;
  private readonly vineLeafGeo: THREE.ConeGeometry;
  private readonly torchBracketGeo: THREE.BoxGeometry;
  private readonly torchCupGeo: THREE.CylinderGeometry;
  private readonly torchFlameGeo: THREE.ConeGeometry;
  private readonly lowBlockGeo: THREE.BoxGeometry;
  private readonly lowSpikeGeo: THREE.ConeGeometry;
  private readonly highLintelSingleGeo: THREE.BoxGeometry;
  private readonly highLintelWideGeo: THREE.BoxGeometry;
  private readonly highPostGeo: THREE.CylinderGeometry;
  private readonly coinDiscGeo: THREE.CylinderGeometry;
  private readonly powerUpCoreGeo: THREE.OctahedronGeometry;
  private readonly powerUpRingGeo: THREE.TorusGeometry;
  private readonly boostPadGeo: THREE.BoxGeometry;
  private readonly boostChevronGeo: THREE.ConeGeometry;
  private readonly waterfallGeo: THREE.PlaneGeometry;
  private readonly abyssWaterGeo: THREE.PlaneGeometry;

  constructor(textures: TempleTextures, castShadow: boolean, fastMode = false) {
    this.textures = textures;
    this.castShadow = castShadow && !fastMode;
    this.fastMode = fastMode;

    const tg = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const tm = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };

    const stoneMap = textures.stoneAlbedo.clone();
    stoneMap.repeat.set(2, 4);
    stoneMap.needsUpdate = true;

    const stoneBump = textures.stoneBump.clone();
    stoneBump.repeat.set(2, 4);
    stoneBump.needsUpdate = true;

    const bridgeMap = textures.bridgeAlbedo.clone();
    bridgeMap.repeat.set(1.5, 4);
    bridgeMap.needsUpdate = true;

    const cliffMap = textures.cliffAlbedo.clone();
    cliffMap.repeat.set(2, 3);
    cliffMap.needsUpdate = true;

    if (this.fastMode) {
      // Lightweight Lambert shading cuts GPU fragment cost significantly on Intel UHD 770 at 3440x1440
      this.stoneMat = tm(new THREE.MeshLambertMaterial({ map: stoneMap }));
      this.darkStoneMat = tm(new THREE.MeshLambertMaterial({ map: stoneMap, color: 0x7b786d }));
      this.bridgeMat = tm(new THREE.MeshLambertMaterial({ map: bridgeMap }));
      this.cliffMat = tm(new THREE.MeshLambertMaterial({ map: cliffMap }));
      this.mossMat = tm(new THREE.MeshLambertMaterial({ color: 0x386634 }));
      this.foliageMat = tm(new THREE.MeshLambertMaterial({ color: 0x224e2b }));
      this.foliageLightMat = tm(new THREE.MeshLambertMaterial({ color: 0x356d37 }));
      this.trunkMat = tm(new THREE.MeshLambertMaterial({ map: textures.barkAlbedo }));
      this.vineMat = tm(new THREE.MeshLambertMaterial({ color: 0x3f6f31 }));
      this.ironMat = tm(new THREE.MeshLambertMaterial({ color: 0x302d2a }));
      this.barrierAccentMat = tm(
        new THREE.MeshLambertMaterial({
          color: 0xc2552b,
          emissive: 0x521d08,
          emissiveIntensity: 0.35,
        })
      );
      this.abyssWaterMat = tm(
        new THREE.MeshLambertMaterial({
          color: 0x175257,
          emissive: 0x0a2528,
          emissiveIntensity: 0.4,
        })
      );
    } else {
      this.stoneMat = tm(
        new THREE.MeshStandardMaterial({
          map: stoneMap,
          bumpMap: stoneBump,
          bumpScale: 0.08,
          roughness: 0.86,
          metalness: 0.04,
        })
      );
      this.darkStoneMat = tm(
        new THREE.MeshStandardMaterial({
          map: stoneMap,
          color: 0x7b786d,
          roughness: 0.9,
          metalness: 0.06,
        })
      );
      this.bridgeMat = tm(
        new THREE.MeshStandardMaterial({
          map: bridgeMap,
          roughness: 0.72,
          metalness: 0.08,
        })
      );
      this.cliffMat = tm(
        new THREE.MeshStandardMaterial({
          map: cliffMap,
          roughness: 0.94,
          metalness: 0.02,
        })
      );
      this.mossMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0x386634,
          roughness: 0.92,
          metalness: 0.0,
        })
      );
      this.foliageMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0x224e2b,
          roughness: 0.88,
          metalness: 0.02,
        })
      );
      this.foliageLightMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0x356d37,
          roughness: 0.84,
          metalness: 0.02,
        })
      );
      this.trunkMat = tm(
        new THREE.MeshStandardMaterial({
          map: textures.barkAlbedo,
          roughness: 0.92,
          metalness: 0.0,
        })
      );
      this.vineMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0x3f6f31,
          roughness: 0.82,
          metalness: 0.0,
        })
      );
      this.ironMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0x2c2926,
          roughness: 0.45,
          metalness: 0.82,
        })
      );
      this.barrierAccentMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0xc2552b,
          emissive: 0x521d08,
          emissiveIntensity: 0.35,
          roughness: 0.55,
          metalness: 0.25,
        })
      );
      this.abyssWaterMat = tm(
        new THREE.MeshStandardMaterial({
          color: 0x164a4f,
          roughness: 0.28,
          metalness: 0.35,
        })
      );
    }

    this.emberMat = tm(new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
    this.flameMat = tm(new THREE.MeshBasicMaterial({ color: 0xffbe42 }));
    this.coinGoldMat = tm(
      new THREE.MeshStandardMaterial({
        map: textures.coinMap,
        color: 0xffd456,
        emissive: 0x7b4f08,
        emissiveIntensity: this.fastMode ? 0.62 : 0.45,
        roughness: 0.22,
        metalness: 0.88,
      })
    );
    this.waterfallMat = tm(
      new THREE.MeshBasicMaterial({
        map: textures.waterfallMap,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.speedCoreMat = tm(
      new THREE.MeshStandardMaterial({
        color: 0xffd24a,
        emissive: 0xff8a14,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.85,
      })
    );
    this.speedRingMat = tm(new THREE.MeshBasicMaterial({ color: 0xffe485 }));
    this.shieldCoreMat = tm(
      new THREE.MeshStandardMaterial({
        color: 0x3ef2cf,
        emissive: 0x0ea68a,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.8,
      })
    );
    this.shieldRingMat = tm(new THREE.MeshBasicMaterial({ color: 0x8effeb }));
    this.magnetCoreMat = tm(
      new THREE.MeshStandardMaterial({
        color: 0xe879f9,
        emissive: 0xa21caf,
        emissiveIntensity: 0.9,
        roughness: 0.18,
        metalness: 0.82,
      })
    );
    this.magnetRingMat = tm(new THREE.MeshBasicMaterial({ color: 0xf5d0fe }));
    this.boostPadBaseMat = tm(
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.78,
      })
    );
    this.boostPadChevronMat = tm(
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
      })
    );

    // Geometries
    this.roadDeckGeo = tg(new THREE.BoxGeometry(8.2, 1.4, CHUNK_LENGTH));
    this.curbGeo = tg(new THREE.BoxGeometry(0.65, 0.42, CHUNK_LENGTH));
    this.bridgeHalfDeckGeo = tg(new THREE.BoxGeometry(7.6, 1.1, 7.6));
    this.bridgeArchGeo = tg(new THREE.BoxGeometry(7.2, 2.2, 2.4));
    this.balustradePostGeo = tg(new THREE.BoxGeometry(0.45, 1.05, 0.45));
    this.balustradeRailGeo = tg(new THREE.BoxGeometry(0.28, 0.22, CHUNK_LENGTH));
    this.pillarShaftGeo = tg(new THREE.CylinderGeometry(0.42, 0.5, 5.2, 10));
    this.pillarCapGeo = tg(new THREE.BoxGeometry(1.25, 0.45, 1.25));
    this.gateLintelGeo = tg(new THREE.BoxGeometry(10.8, 0.95, 1.3));
    this.cliffGeo = tg(new THREE.BoxGeometry(12, 34, CHUNK_LENGTH + 1.5));
    this.trunkGeo = tg(new THREE.CylinderGeometry(0.25, 0.42, 6.2, 7));
    this.canopyGeo = tg(new THREE.DodecahedronGeometry(2.6, 1));
    this.vineGeo = tg(new THREE.CylinderGeometry(0.035, 0.02, 3.4, 5));
    this.vineLeafGeo = tg(new THREE.ConeGeometry(0.18, 0.45, 4));
    this.torchBracketGeo = tg(new THREE.BoxGeometry(0.14, 0.45, 0.14));
    this.torchCupGeo = tg(new THREE.CylinderGeometry(0.16, 0.09, 0.22, 8));
    this.torchFlameGeo = tg(new THREE.ConeGeometry(0.15, 0.42, 7));
    this.lowBlockGeo = tg(new THREE.BoxGeometry(1.85, 0.92, 0.95));
    this.lowSpikeGeo = tg(new THREE.ConeGeometry(0.22, 0.42, 5));
    this.highLintelSingleGeo = tg(new THREE.BoxGeometry(2.05, 1.08, 0.72));
    this.highLintelWideGeo = tg(new THREE.BoxGeometry(7.6, 1.05, 0.72));
    this.highPostGeo = tg(new THREE.CylinderGeometry(0.16, 0.2, 2.3, 8));
    this.coinDiscGeo = tg(new THREE.CylinderGeometry(0.38, 0.38, 0.09, 12));
    this.coinDiscGeo.rotateX(Math.PI * 0.5);
    this.powerUpCoreGeo = tg(new THREE.OctahedronGeometry(0.36, 0));
    this.powerUpRingGeo = tg(new THREE.TorusGeometry(0.56, 0.05, 8, 20));
    this.boostPadGeo = tg(new THREE.BoxGeometry(1.72, 0.06, 2.1));
    this.boostChevronGeo = tg(new THREE.ConeGeometry(0.42, 0.55, 3));
    this.boostChevronGeo.rotateX(-Math.PI * 0.5);
    this.waterfallGeo = tg(new THREE.PlaneGeometry(4.4, 34));
    this.abyssWaterGeo = tg(new THREE.PlaneGeometry(58, CHUNK_LENGTH + 2));
    this.abyssWaterGeo.rotateX(-Math.PI * 0.5);
  }

  public applyBiomeColors(palette: {
    stoneTint: THREE.Color;
    moss: THREE.Color;
    foliage: THREE.Color;
    foliageLight: THREE.Color;
    water: THREE.Color;
    barrier: THREE.Color;
  }) {
    this.stoneMat.color.copy(palette.stoneTint);
    this.mossMat.color.copy(palette.moss);
    this.foliageMat.color.copy(palette.foliage);
    this.foliageLightMat.color.copy(palette.foliageLight);
    this.abyssWaterMat.color.copy(palette.water);
    this.barrierAccentMat.color.copy(palette.barrier);
  }

  private pickArchetype(index: number, rng: () => number): ChunkArchetype {
    if (index <= 1) return 'pathway';
    const r = rng();
    if (index % 4 === 2) return r < 0.55 ? 'gap_bridge' : 'bridge';
    if (r < 0.36) return 'pathway';
    if (r < 0.62) return 'bridge';
    if (r < 0.84) return 'gap_bridge';
    return 'sanctuary';
  }

  private addTorch(
    batch: StaticBatchBuilder,
    group: THREE.Group,
    chunkZStart: number,
    localX: number,
    localY: number,
    localZ: number,
    torches: TorchEmitter[],
    phase: number
  ) {
    batch.add(this.torchBracketGeo, this.ironMat, {
      x: localX,
      y: localY - 0.15,
      z: localZ,
    });
    batch.add(this.torchCupGeo, this.ironMat, {
      x: localX,
      y: localY + 0.08,
      z: localZ,
    });
    batch.add(this.torchCupGeo, this.emberMat, {
      x: localX,
      y: localY + 0.19,
      z: localZ,
      sx: 0.7,
      sy: 0.35,
      sz: 0.7,
    });

    const flame = new THREE.Mesh(this.torchFlameGeo, this.flameMat);
    flame.position.set(localX, localY + 0.42, localZ);
    group.add(flame);

    torches.push({
      worldX: localX,
      worldY: localY + 0.48,
      worldZ: chunkZStart + localZ,
      flameMesh: flame,
      phase,
    });
  }

  private addVine(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    lengthScale: number,
    phase: number,
    vines: VineInstance[]
  ) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);

    const stem = new THREE.Mesh(this.vineGeo, this.vineMat);
    stem.scale.set(1, lengthScale, 1);
    stem.position.y = -1.7 * lengthScale;
    pivot.add(stem);

    for (let k = 0; k < 2; k++) {
      const leaf = new THREE.Mesh(this.vineLeafGeo, this.foliageLightMat);
      leaf.position.set(
        (k % 2 === 0 ? 1 : -1) * 0.14,
        -(0.85 + k * 1.1) * lengthScale,
        0
      );
      leaf.rotation.z = k % 2 === 0 ? -0.7 : 0.7;
      pivot.add(leaf);
    }

    group.add(pivot);
    vines.push({ pivot, phase, amp: 0.07 + lengthScale * 0.03 });
  }

  private addCliffSide(
    batch: StaticBatchBuilder,
    group: THREE.Group,
    chunkZStart: number,
    side: -1 | 1,
    rng: () => number,
    hasWaterfall: boolean,
    waterfalls: WaterfallInstance[]
  ) {
    const cliffX = side * (16.5 + rng() * 3.5);
    const cliffY = -2 + rng() * 4.5;
    batch.add(this.cliffGeo, this.cliffMat, {
      x: cliffX,
      y: cliffY,
      z: -CHUNK_LENGTH * 0.5,
    });

    // Secondary staggered cliff ledge closer in
    batch.add(this.cliffGeo, this.cliffMat, {
      x: side * (11.5 + rng() * 2.2),
      y: -7 + rng() * 3,
      z: -CHUNK_LENGTH * (0.25 + rng() * 0.5),
      sx: 0.55,
      sy: 0.68,
      sz: 0.56,
    });

    // Jungle trees perched on cliff top
    const treeCount = 2;
    for (let t = 0; t < treeCount; t++) {
      const tx = side * (11.2 + rng() * 4.2);
      const tz = -3 - t * 9.5 - rng() * 3;
      batch.add(this.trunkGeo, this.trunkMat, {
        x: tx,
        y: 10 + rng() * 2,
        z: tz,
        rz: -side * (0.08 + rng() * 0.14),
      });

      batch.add(this.canopyGeo, t % 2 === 0 ? this.foliageMat : this.foliageLightMat, {
        x: tx - side * 0.5,
        y: 13.4 + rng() * 1.4,
        z: tz,
        sx: 1.2 + rng() * 0.5,
        sy: 0.72 + rng() * 0.3,
        sz: 1.2 + rng() * 0.5,
      });
    }

    if (hasWaterfall) {
      const wfX = side * 10.1;
      const wfZ = -CHUNK_LENGTH * 0.5;
      const wfMesh = new THREE.Mesh(this.waterfallGeo, this.waterfallMat);
      wfMesh.position.set(wfX, -1.5, wfZ);
      wfMesh.rotation.y = -side * Math.PI * 0.42;
      group.add(wfMesh);

      waterfalls.push({
        x: wfX,
        y: -14.5,
        z: chunkZStart + wfZ,
        mesh: wfMesh,
      });
    }
  }

  private addCoin(
    group: THREE.Group,
    chunkZStart: number,
    lane: number,
    y: number,
    localZ: number,
    coins: CoinData[]
  ) {
    const x = LANE_X[lane];
    const disc = new THREE.Mesh(this.coinDiscGeo, this.coinGoldMat);
    disc.position.set(x, y, localZ);
    group.add(disc);

    coins.push({
      id: this.nextId++,
      lane,
      x,
      y,
      z: chunkZStart + localZ,
      collected: false,
      mesh: disc,
    });
  }

  private addPowerUp(
    group: THREE.Group,
    chunkZStart: number,
    kind: PowerUpKind,
    lane: number,
    y: number,
    localZ: number,
    powerUps: PowerUpData[]
  ) {
    const relicGroup = new THREE.Group();
    const x = LANE_X[lane];
    relicGroup.position.set(x, y, localZ);

    const coreMat =
      kind === 'speed'
        ? this.speedCoreMat
        : kind === 'magnet'
          ? this.magnetCoreMat
          : this.shieldCoreMat;
    const ringMat =
      kind === 'speed'
        ? this.speedRingMat
        : kind === 'magnet'
          ? this.magnetRingMat
          : this.shieldRingMat;

    const core = new THREE.Mesh(this.powerUpCoreGeo, coreMat);
    const ringA = new THREE.Mesh(this.powerUpRingGeo, ringMat);
    const ringB = new THREE.Mesh(this.powerUpRingGeo, ringMat);
    ringB.rotation.x = Math.PI * 0.5;
    ringB.scale.setScalar(0.84);

    relicGroup.add(core);
    relicGroup.add(ringA);
    relicGroup.add(ringB);
    group.add(relicGroup);

    powerUps.push({
      id: this.nextId++,
      kind,
      lane,
      x,
      y,
      z: chunkZStart + localZ,
      collected: false,
      mesh: relicGroup,
    });
  }

  private addBoostPad(
    group: THREE.Group,
    chunkZStart: number,
    lane: number,
    localZ: number,
    boostPads: BoostPadData[]
  ) {
    const padGroup = new THREE.Group();
    const x = LANE_X[lane];
    padGroup.position.set(x, 0.03, localZ);

    const base = new THREE.Mesh(this.boostPadGeo, this.boostPadBaseMat);
    padGroup.add(base);

    for (const cz of [0.42, -0.32]) {
      const chevron = new THREE.Mesh(this.boostChevronGeo, this.boostPadChevronMat);
      chevron.position.set(0, 0.04, cz);
      chevron.scale.set(1.25, 0.25, 1.0);
      padGroup.add(chevron);
    }

    group.add(padGroup);
    boostPads.push({
      id: this.nextId++,
      lane,
      x,
      z: chunkZStart + localZ,
      triggered: false,
      mesh: padGroup,
    });
  }

  private addLowObstacle(
    batch: StaticBatchBuilder,
    chunkZStart: number,
    lanes: number[],
    localZ: number,
    obstacles: ObstacleData[]
  ) {
    for (const lane of lanes) {
      const x = LANE_X[lane];
      batch.add(this.lowBlockGeo, this.darkStoneMat, {
        x,
        y: 0.46,
        z: localZ,
        castShadow: this.castShadow,
        receiveShadow: this.castShadow,
      });

      for (let s = -1; s <= 1; s++) {
        batch.add(this.lowSpikeGeo, this.barrierAccentMat, {
          x: x + s * 0.52,
          y: 1.1,
          z: localZ,
        });
      }
    }

    obstacles.push({
      id: this.nextId++,
      kind: 'low_block',
      lanes,
      z: chunkZStart + localZ,
      halfDepth: 0.5,
      minY: 0,
      maxY: 1.24,
      passed: false,
    });
  }

  private addHighBarrier(
    batch: StaticBatchBuilder,
    chunkZStart: number,
    lanes: number[],
    localZ: number,
    obstacles: ObstacleData[]
  ) {
    const fullWidth = lanes.length === 3;
    if (fullWidth) {
      batch.add(this.highLintelWideGeo, this.darkStoneMat, {
        x: 0,
        y: 1.66,
        z: localZ,
        castShadow: this.castShadow,
      });
      batch.add(this.highLintelWideGeo, this.barrierAccentMat, {
        x: 0,
        y: 1.14,
        z: localZ,
        sx: 1.01,
        sy: 0.16,
        sz: 1.06,
      });

      for (const px of [-3.85, 3.85]) {
        batch.add(this.highPostGeo, this.stoneMat, {
          x: px,
          y: 1.15,
          z: localZ,
        });
      }
    } else {
      for (const lane of lanes) {
        const x = LANE_X[lane];
        batch.add(this.highLintelSingleGeo, this.darkStoneMat, {
          x,
          y: 1.66,
          z: localZ,
          castShadow: this.castShadow,
        });
        batch.add(this.highLintelSingleGeo, this.barrierAccentMat, {
          x,
          y: 1.14,
          z: localZ,
          sx: 1.02,
          sy: 0.16,
          sz: 1.08,
        });

        for (const ox of [-0.92, 0.92]) {
          batch.add(this.highPostGeo, this.stoneMat, {
            x: x + ox,
            y: 1.15,
            z: localZ,
          });
        }
      }
    }

    obstacles.push({
      id: this.nextId++,
      kind: 'high_barrier',
      lanes,
      z: chunkZStart + localZ,
      halfDepth: 0.42,
      minY: 1.06,
      maxY: 2.35,
      passed: false,
    });
  }

  public createChunk(index: number): TempleChunk {
    const rng = createRng(index + 7);
    const archetype = this.pickArchetype(index, rng);
    const zStart = -index * CHUNK_LENGTH;
    const zEnd = zStart - CHUNK_LENGTH;

    const group = new THREE.Group();
    group.position.set(0, 0, zStart);

    const batch = new StaticBatchBuilder();
    const chunkDisposables: THREE.BufferGeometry[] = [];

    const obstacles: ObstacleData[] = [];
    const coins: CoinData[] = [];
    const powerUps: PowerUpData[] = [];
    const boostPads: BoostPadData[] = [];
    const torches: TorchEmitter[] = [];
    const waterfalls: WaterfallInstance[] = [];
    const vines: VineInstance[] = [];
    let gap: GapSpan | null = null;

    // Abyss shimmer river below every chunk
    batch.add(this.abyssWaterGeo, this.abyssWaterMat, {
      x: 0,
      y: -16.5,
      z: -CHUNK_LENGTH * 0.5,
    });

    if (archetype === 'pathway' || archetype === 'sanctuary') {
      batch.add(this.roadDeckGeo, this.stoneMat, {
        x: 0,
        y: -0.7,
        z: -CHUNK_LENGTH * 0.5,
        receiveShadow: this.castShadow,
      });

      for (const sx of [-4.2, 4.2]) {
        batch.add(this.curbGeo, this.darkStoneMat, {
          x: sx,
          y: 0.16,
          z: -CHUNK_LENGTH * 0.5,
        });
      }

      // Pillars & Torches
      const pillarPositions = [-4, -14];
      for (let p = 0; p < pillarPositions.length; p++) {
        const pz = pillarPositions[p];
        for (const side of [-1, 1] as const) {
          const px = side * 4.55;
          batch.add(this.pillarShaftGeo, this.stoneMat, {
            x: px,
            y: 2.55,
            z: pz,
          });
          batch.add(this.pillarCapGeo, this.darkStoneMat, {
            x: px,
            y: 5.25,
            z: pz,
          });
          batch.add(this.pillarCapGeo, this.mossMat, {
            x: px,
            y: 0.12,
            z: pz,
            sx: 0.95,
            sy: 0.35,
            sz: 0.95,
          });

          if (p === 0 || archetype === 'sanctuary') {
            this.addTorch(
              batch,
              group,
              zStart,
              px - side * 0.56,
              2.65,
              pz,
              torches,
              rng() * Math.PI * 2
            );
          }
        }

        // Temple overhead arch lintel + hanging vines
        if (archetype === 'sanctuary' || p === 1) {
          batch.add(this.gateLintelGeo, this.stoneMat, {
            x: 0,
            y: 5.75,
            z: pz,
          });

          const vineCount = archetype === 'sanctuary' ? 2 : 1;
          for (let v = 0; v < vineCount; v++) {
            const vx = vineCount === 1 ? (rng() - 0.5) * 4.0 : -2.6 + v * 5.2;
            this.addVine(
              group,
              vx,
              5.3,
              pz + (rng() - 0.5) * 0.5,
              0.65 + rng() * 0.45,
              rng() * 6,
              vines
            );
          }
        }
      }
    } else if (archetype === 'bridge') {
      batch.add(this.roadDeckGeo, this.bridgeMat, {
        x: 0,
        y: -0.56,
        z: -CHUNK_LENGTH * 0.5,
        sx: 0.92,
        sy: 0.8,
        sz: 1,
        receiveShadow: this.castShadow,
      });

      for (const az of [-4, -10, -16]) {
        batch.add(this.bridgeArchGeo, this.darkStoneMat, {
          x: 0,
          y: -1.9,
          z: az,
        });
      }

      for (const side of [-1, 1] as const) {
        const rx = side * 3.68;
        batch.add(this.balustradeRailGeo, this.stoneMat, {
          x: rx,
          y: 0.78,
          z: -CHUNK_LENGTH * 0.5,
        });

        for (let bz = -2; bz >= -18; bz -= 4) {
          batch.add(this.balustradePostGeo, this.darkStoneMat, {
            x: rx,
            y: 0.45,
            z: bz,
          });
        }
        this.addTorch(batch, group, zStart, rx, 1.32, -10, torches, rng() * 6);
      }
    } else {
      // gap_bridge: two stone spans separated by a 4.6m chasm around z = -7.7 to -12.3
      batch.add(this.bridgeHalfDeckGeo, this.bridgeMat, {
        x: 0,
        y: -0.55,
        z: -3.8,
        receiveShadow: this.castShadow,
      });
      batch.add(this.bridgeHalfDeckGeo, this.bridgeMat, {
        x: 0,
        y: -0.55,
        z: -16.2,
        receiveShadow: this.castShadow,
      });

      gap = {
        zStart: zStart - 7.7,
        zEnd: zStart - 12.3,
      };

      for (const side of [-1, 1] as const) {
        const rx = side * 3.68;
        for (const bz of [-2.2, -6.9, -13.1, -17.8]) {
          batch.add(this.balustradePostGeo, this.darkStoneMat, {
            x: rx,
            y: 0.45,
            z: bz,
          });
        }
        this.addTorch(batch, group, zStart, rx, 1.32, -6.9, torches, rng() * 6);
        this.addTorch(batch, group, zStart, rx, 1.32, -13.1, torches, rng() * 6);
      }

      // Coin arc across the gap guiding the jump!
      const coinLane = Math.floor(rng() * 3);
      for (let c = 0; c < 5; c++) {
        const t = c / 4;
        const cz = -7.2 - t * 5.6;
        const cy = 0.8 + Math.sin(t * Math.PI) * 1.45;
        this.addCoin(group, zStart, coinLane, cy, cz, coins);
      }
    }

    // Cliffs & Waterfalls
    const wfLeft = archetype === 'bridge' || archetype === 'gap_bridge' || rng() < 0.35;
    const wfRight = (archetype === 'bridge' || archetype === 'gap_bridge') && rng() < 0.72;
    this.addCliffSide(batch, group, zStart, -1, rng, wfLeft, waterfalls);
    this.addCliffSide(batch, group, zStart, 1, rng, wfRight, waterfalls);

    // Populate Solvable Obstacles, Coins & v5.5 Boost Pads (chunk 0 is serene clear runway)
    let boostLaneHint = Math.floor(rng() * 3);
    if (index >= 1 && archetype !== 'gap_bridge') {
      const pattern = rng();
      if (pattern < 0.34) {
        const safeA = Math.floor(rng() * 3);
        const blockedA = [0, 1, 2].filter((l) => l !== safeA);
        if (rng() < 0.55) {
          this.addLowObstacle(batch, zStart, [blockedA[0]], -6.5, obstacles);
        } else {
          this.addLowObstacle(batch, zStart, blockedA, -6.5, obstacles);
        }

        const safeB = (safeA + (rng() < 0.5 ? 1 : 2)) % 3;
        const blockedB = [0, 1, 2].filter((l) => l !== safeB);
        if (rng() < 0.5) {
          this.addHighBarrier(batch, zStart, [blockedB[0]], -14.2, obstacles);
        } else {
          this.addLowObstacle(batch, zStart, [blockedB[0]], -14.2, obstacles);
        }

        for (let k = 0; k < 3; k++) {
          this.addCoin(group, zStart, safeA, 0.75, -4.5 - k * 1.8, coins);
        }
        for (let k = 0; k < 3; k++) {
          this.addCoin(group, zStart, safeB, 0.75, -12.5 - k * 1.8, coins);
        }
        boostLaneHint = safeA;
      } else if (pattern < 0.68) {
        const fullGate = rng() < 0.62;
        const lanes = fullGate ? [0, 1, 2] : [Math.floor(rng() * 3)];
        this.addHighBarrier(batch, zStart, lanes, -9.5, obstacles);

        const coinLane = fullGate ? Math.floor(rng() * 3) : lanes[0];
        for (let k = 0; k < 4; k++) {
          this.addCoin(group, zStart, coinLane, 0.52, -6.8 - k * 1.8, coins);
        }
        boostLaneHint = fullGate ? coinLane : (lanes[0] + 1) % 3;
      } else {
        const targetLane = Math.floor(rng() * 3);
        const secondLane = (targetLane + 1) % 3;
        this.addLowObstacle(batch, zStart, [targetLane, secondLane], -10.0, obstacles);
        const safeLane = 3 - targetLane - secondLane;
        for (let k = 0; k < 4; k++) {
          this.addCoin(group, zStart, safeLane, 0.75, -7.2 - k * 1.8, coins);
        }
        boostLaneHint = safeLane;
      }

      // v5.5 Golden Track Boost Pad on clear run sections
      if (index >= 2 && index % 2 === 0) {
        this.addBoostPad(group, zStart, boostLaneHint, -3.2, boostPads);
      }
    } else if (index >= 1 && archetype === 'gap_bridge') {
      const leadLane = Math.floor(rng() * 3);
      this.addCoin(group, zStart, leadLane, 0.75, -2.5, coins);
      this.addCoin(group, zStart, leadLane, 0.75, -4.5, coins);
    }

    // Spawn Speed, Shield, and Magnet Relics evenly across chunks
    if (index >= 1 && (index === 1 || index % 2 === 1)) {
      const cycle: readonly PowerUpKind[] = ['speed', 'shield', 'magnet'];
      const kind = cycle[Math.floor((index - 1) / 2) % cycle.length];
      const puLane = Math.floor(rng() * 3);
      const puZ = archetype === 'gap_bridge' ? -15.8 : -2.6;
      this.addPowerUp(group, zStart, kind, puLane, 1.0, puZ, powerUps);
    }

    // Flush batched static meshes into 1 draw call per unique material + shadow combo!
    batch.flushInto(group, chunkDisposables);

    return {
      index,
      archetype,
      zStart,
      zEnd,
      group,
      gap,
      obstacles,
      coins,
      powerUps,
      boostPads,
      torches,
      waterfalls,
      vines,
      dispose: () => {
        for (const geo of chunkDisposables) {
          geo.dispose();
        }
      },
    };
  }

  public dispose() {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
