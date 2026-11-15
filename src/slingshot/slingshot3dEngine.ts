import * as THREE from 'three';
import type { SceneRenderBudget } from '../utils/hardwareProfile';
import {
  createSharedShaderUniforms,
  createShockwavePool,
  createSkyDomeMesh,
  createStudioEnvironment,
  createWeatherSystem,
  detectSoftwareWebGL,
  enhanceMaterialWithShaderMood,
  syncSharedShaderUniforms,
  type ShaderMood,
  type WeatherFx,
} from '../utils/threeShaders';
import {
  createBouncerPadTexture,
  createIceCrystalTexture,
  createSoftCloudTexture,
  createStoneBlockTexture,
  createSunHaloTexture,
  createTntCrateTexture,
  createWoodPlankTexture,
  getFloatingPopupTexture,
} from '../utils/threeTextures';
import type { BirdType, BlockKind, PigVariant, RigidBody } from './physics2d';
import type {
  DebrisParticle,
  DustCloudPuff,
  FloatingPopup,
  GroundDivot,
  ScorchDecal,
  TrailDot,
} from './slingshotRenderer';

export type Slingshot3dCameraMode = 'classic' | 'tactical' | 'shoulder';

export interface Slingshot3dUpdateParams {
  dt: number;
  bodies: RigidBody[];
  activeBird: RigidBody;
  birdAlpha: number;
  phase: string;
  camFocusX: number;
  camFocusY: number;
  camZoom: number;
  budget: SceneRenderBudget;
  shaderMood: ShaderMood;
  weather: WeatherFx;
  cameraPreset: Slingshot3dCameraMode;
  freeOrbit: boolean;
  giantBirds: boolean;
  showTrajGuide: boolean;
  trajectoryPts: Array<{ x: number; y: number }>;
  slingAnchorX: number;
  slingAnchorY: number;
  floorY: number;
  pouchX: number;
  pouchY: number;
  activeBirdType: BirdType;
  explosionPulse: { x: number; y: number; colorHex: number; id: number } | null;
  // 2D parity additions
  quiverTypes?: BirdType[];
  quiverCount?: number;
  infiniteBirds?: boolean;
  birdInSling?: boolean;
  atmosphereHint?: 0 | 1 | 2;
  particles?: DebrisParticle[];
  dustClouds?: DustCloudPuff[];
  scorches?: ScorchDecal[];
  groundDivots?: GroundDivot[];
  popups?: FloatingPopup[];
  trailDots?: TrailDot[];
  rapidReticle?: { x: number; y: number } | null;
}

export interface Slingshot3dEngine {
  update: (params: Slingshot3dUpdateParams) => void;
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  resize: (width: number, height: number, dpr: number) => void;
  dispose: () => void;
}

// Convert 2D Matter.js world coordinates into centered Three.js 3D world meters
const SCALE = 0.05; // 1480px = 74m wide
function toWorldX(px: number): number {
  return (px - 620) * SCALE;
}
function toWorldY(py: number, floorY: number): number {
  return (floorY - py) * SCALE;
}

interface BirdRig {
  group: THREE.Group;
  flameMesh: THREE.Mesh;
  sparkMesh: THREE.Mesh;
  abilityRing: THREE.Mesh;
}

function buildBirdMesh(
  type: BirdType,
  shared: ReturnType<typeof createSharedShaderUniforms>
): BirdRig {
  const g = new THREE.Group();
  const colorMap: Record<BirdType, number> = {
    red: 0xdc2626,
    chuck: 0xfacc15,
    blues: 0x0ea5e9,
    bomb: 0x1f2937,
    terence: 0x881337,
  };
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorMap[type],
    roughness: type === 'bomb' ? 0.55 : 0.42,
    metalness: type === 'bomb' ? 0.18 : 0.06,
  });
  enhanceMaterialWithShaderMood(bodyMat, shared, `bird-${type}`);

  const darkFeatherMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: type === 'bomb' ? 0x64748b : type === 'terence' ? 0xe7d4c0 : 0xfef3c7,
    roughness: 0.65,
  });

  if (type === 'chuck') {
    // Aerodynamic horizontal 3-sided wedge prism pointing +X
    const wedgeGeo = new THREE.ConeGeometry(0.95, 1.9, 3);
    wedgeGeo.rotateZ(-Math.PI / 2);
    wedgeGeo.rotateX(Math.PI / 6);
    const body = new THREE.Mesh(wedgeGeo, bodyMat);
    body.scale.set(1.05, 1.05, 0.92);
    body.castShadow = true;
    g.add(body);
  } else {
    const rad = type === 'terence' ? 1.08 : type === 'blues' ? 0.86 : 0.94;
    const body = new THREE.Mesh(new THREE.SphereGeometry(rad, 18, 14), bodyMat);
    if (type === 'terence') {
      body.scale.set(1.06, 1.02, 1.02);
    }
    body.castShadow = true;
    g.add(body);
  }

  // Belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 10), bellyMat);
  belly.position.set(type === 'chuck' ? 0.15 : 0.24, -0.32, 0);
  belly.scale.set(1.05, 0.78, 0.88);
  g.add(belly);

  // Fanned tail feathers (-X)
  for (let t = -1; t <= 1; t++) {
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.14), darkFeatherMat);
    feather.position.set(-0.98, 0.08 + t * 0.16, t * 0.06);
    feather.rotation.z = t * 0.34 - 0.12;
    g.add(feather);
  }

  // Two-part curved beak (+X)
  const beakUpperMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.38 });
  const beakLowerMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 });
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.56, 6), beakUpperMat);
  upperBeak.rotation.z = -Math.PI / 2;
  upperBeak.position.set(type === 'chuck' ? 0.98 : 0.92, 0.06, 0);
  const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 6), beakLowerMat);
  lowerBeak.rotation.z = -Math.PI / 2 - 0.18;
  lowerBeak.position.set(type === 'chuck' ? 0.9 : 0.85, -0.1, 0);
  g.add(upperBeak, lowerBeak);

  // Expressive sclera, pupils, and angry V-eyebrows
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const browMat = new THREE.MeshStandardMaterial({
    color: type === 'red' || type === 'terence' ? 0x0f172a : 0x7f1d1d,
    roughness: 0.6,
  });

  for (const zSide of [-0.25, 0.25]) {
    const eyeX = type === 'chuck' ? 0.56 : 0.68;
    const eyeY = type === 'chuck' ? 0.16 : 0.24;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeWhite);
    eye.position.set(eyeX, eyeY, zSide);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), pupilMat);
    pupil.position.set(eyeX + 0.13, eyeY, zSide * 0.96);
    g.add(eye, pupil);

    // Angry slanted V-eyebrow
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, type === 'terence' ? 0.15 : 0.11, 0.34),
      browMat
    );
    brow.position.set(eyeX + 0.06, eyeY + 0.21, zSide * 0.92);
    brow.rotation.x = zSide > 0 ? -0.42 : 0.42;
    brow.rotation.z = -0.16;
    g.add(brow);
  }

  // Head crest / fuse detail
  const sparkMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  sparkMesh.visible = false;

  if (type === 'bomb') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.18, 8), darkFeatherMat);
    cap.position.set(-0.04, 0.94, 0);
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.48, 6),
      new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 })
    );
    fuse.position.set(-0.1, 1.2, 0);
    fuse.rotation.z = 0.28;
    sparkMesh.position.set(-0.18, 1.44, 0);
    sparkMesh.visible = true;
    g.add(cap, fuse, sparkMesh);
  } else {
    const crest1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.46, 6), bodyMat);
    crest1.position.set(-0.06, 1.0, 0);
    crest1.rotation.z = 0.35;
    const crest2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.36, 6), bodyMat);
    crest2.position.set(-0.22, 0.92, 0);
    crest2.rotation.z = 0.58;
    g.add(crest1, crest2);
  }

  // Chuck turbo flame cone (hidden unless dashing)
  const flameMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 1.9, 8),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flameMesh.rotation.z = Math.PI / 2;
  flameMesh.position.set(-1.75, 0, 0);
  flameMesh.visible = false;
  g.add(flameMesh);

  // Subtle airborne ability-ready halo ring
  const abilityRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.32, 0.055, 8, 28),
    new THREE.MeshBasicMaterial({
      color: type === 'bomb' ? 0xf97316 : type === 'chuck' ? 0xfef08a : 0x38bdf8,
      transparent: true,
      opacity: 0.62,
    })
  );
  abilityRing.visible = false;
  g.add(abilityRing);

  return { group: g, flameMesh, sparkMesh, abilityRing };
}

interface PigRig {
  group: THREE.Group;
  armorMesh?: THREE.Mesh;
  skinMat: THREE.MeshStandardMaterial;
  hurtOverlay: THREE.Group;
}

function buildPigMesh(
  variant: PigVariant,
  shared: ReturnType<typeof createSharedShaderUniforms>
): PigRig {
  const g = new THREE.Group();
  const pigMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.44 });
  enhanceMaterialWithShaderMood(pigMat, shared, 'pig-skin');
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xbef264, roughness: 0.42 });
  const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x1a2e05 });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), pigMat);
  sphere.castShadow = true;
  g.add(sphere);

  // Snout facing camera/left (-X) with two nostrils
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.34, 14), snoutMat);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(-0.9, -0.04, 0);
  g.add(snout);

  for (const zN of [-0.14, 0.14]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), nostrilMat);
    nostril.scale.set(0.5, 1.35, 0.9);
    nostril.position.set(-1.07, -0.02, zN);
    g.add(nostril);
  }

  // Expressive eyes facing forward/left (-X + slightly +Z toward camera)
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  for (const zSide of [-0.4, 0.4]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), eyeWhite);
    eye.position.set(-0.74, 0.28, zSide);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), pupilMat);
    pupil.position.set(-0.92, 0.28, zSide * 0.96);
    g.add(eye, pupil);
  }

  // Ears
  for (const zSide of [-0.52, 0.52]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), pigMat);
    ear.scale.set(0.75, 1.1, 0.75);
    ear.position.set(0.02, 0.88, zSide);
    g.add(ear);
  }

  // Hurt bruised brow / bandage overlay (shown when damaged)
  const hurtOverlay = new THREE.Group();
  const bruiseMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.75 });
  const bandageMat = new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.8 });
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.44), bandageMat);
  patch.position.set(-0.68, 0.58, 0.22);
  patch.rotation.y = 0.35;
  patch.rotation.x = 0.25;
  const bruise = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), bruiseMat);
  bruise.scale.set(0.4, 0.7, 0.7);
  bruise.position.set(-0.78, 0.14, -0.44);
  hurtOverlay.add(patch, bruise);
  hurtOverlay.visible = false;
  g.add(hurtOverlay);

  let armorMesh: THREE.Mesh | undefined;
  if (variant === 'king') {
    const crownGroup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.42, 0.52, 7),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.78, roughness: 0.22 })
    );
    crownGroup.position.y = 1.14;
    // Crown jewel ring
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.06, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.4, roughness: 0.25 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.14;
    crownGroup.add(band);
    armorMesh = crownGroup;
    g.add(armorMesh);
  } else if (variant === 'helmet') {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.26 })
    );
    helmet.position.y = 0.06;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.07, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 })
    );
    rim.rotation.x = Math.PI / 2;
    helmet.add(rim);
    armorMesh = helmet;
    g.add(armorMesh);
  }
  return { group: g, armorMesh, skinMat: pigMat, hurtOverlay };
}

function buildCraggyMountainPeak(
  radius: number,
  height: number,
  baseMat: THREE.Material,
  snowMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const coneGeo = new THREE.ConeGeometry(radius, height, 7, 3);
  const pos = coneGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    if (vy < height * 0.45) {
      const n = Math.sin(vx * 0.43 + vz * 0.37) * 0.14;
      pos.setX(i, vx * (1 + n));
      pos.setZ(i, vz * (1 - n * 0.8));
    }
  }
  coneGeo.computeVertexNormals();
  const body = new THREE.Mesh(coneGeo, baseMat);
  body.position.y = height * 0.5 - 1.5;
  g.add(body);

  const snow = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.36, height * 0.36, 7), snowMat);
  snow.position.y = height * 0.82 - 1.5;
  g.add(snow);
  return g;
}

export function createSlingshot3dEngine(container: HTMLElement): Slingshot3dEngine {
  const isSoftwareGl = detectSoftwareWebGL();
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x9bd2f5, 0.0048);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    44,
    (container.clientWidth || 1280) / Math.max(1, container.clientHeight || 720),
    0.5,
    560
  );
  camera.position.set(0, 14, 58);

  const envTex = createStudioEnvironment(renderer, scene);
  const sharedUniforms = createSharedShaderUniforms('standard');

  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x3b6324, 0.95);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.55);
  keyLight.position.set(-25, 48, 38);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -45;
  keyLight.shadow.camera.right = 45;
  keyLight.shadow.camera.top = 35;
  keyLight.shadow.camera.bottom = -15;
  scene.add(keyLight);

  const skyDome = createSkyDomeMesh({
    radius: 400,
    zenith: 0x1e5799,
    mid: 0x62a8db,
    horizon: 0xdbeeff,
    sunDir: new THREE.Vector3(-0.35, 0.42, -0.82),
    sunColor: 0xfff5d6,
    showStars: true,
  });
  skyDome.uniforms.uStarAlpha.value = 0;
  scene.add(skyDome.mesh);

  // Sun halo billboard + drifting cloud sprites
  const sunTex = createSunHaloTexture();
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunSprite.position.set(-65, 58, -145);
  sunSprite.scale.set(44, 44, 1);
  scene.add(sunSprite);

  const cloudTex = createSoftCloudTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const clouds: Array<{ sprite: THREE.Sprite; baseX: number; speed: number }> = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(cloudMat);
    const baseX = -85 + i * 26;
    sp.position.set(baseX, 24 + (i % 3) * 6.5, -55 - (i % 2) * 18);
    sp.scale.set(22 + (i % 3) * 6, 10 + (i % 2) * 3, 1);
    scene.add(sp);
    clouds.push({ sprite: sp, baseX, speed: 0.65 + (i % 3) * 0.25 });
  }

  // 3D Green Valley Ground + Foreground Earth Cutout + Stone Steps
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d8b31, roughness: 0.9 });
  enhanceMaterialWithShaderMood(groundMat, sharedUniforms, 'sling-ground');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(380, 260), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -25);
  ground.receiveShadow = true;
  scene.add(ground);

  const turfStrip = new THREE.Mesh(
    new THREE.BoxGeometry(380, 0.55, 16),
    new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.85 })
  );
  turfStrip.position.set(0, -0.25, 0);
  turfStrip.receiveShadow = true;
  scene.add(turfStrip);

  const earthSlab = new THREE.Mesh(
    new THREE.BoxGeometry(380, 12, 42),
    new THREE.MeshStandardMaterial({ color: 0x5c3c24, roughness: 0.95 })
  );
  earthSlab.position.set(0, -6.3, 0);
  scene.add(earthSlab);

  // Multi-tier Valley Backdrop: Distant Craggy Mountains + Rolling Hills + Layered Pine Trees
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x4b688a,
    roughness: 0.92,
    flatShading: true,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.72,
    flatShading: true,
  });
  for (let i = 0; i < 6; i++) {
    const pk = buildCraggyMountainPeak(20 + (i % 3) * 6, 28 + (i % 2) * 10, mountainMat, snowMat);
    pk.position.set(-72 + i * 32, 0, -68 - (i % 2) * 12);
    scene.add(pk);
  }

  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3b762e, roughness: 0.88 });
  enhanceMaterialWithShaderMood(hillMat, sharedUniforms, 'sling-hills');
  for (let i = 0; i < 8; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + (i % 3) * 7, 18, 10), hillMat);
    hill.scale.set(1.9, 0.58, 0.85);
    hill.position.set(-76 + i * 24, -2.0, -34 - (i % 2) * 14);
    scene.add(hill);
  }

  // Layered Orchard Pine Trees (Trunks + Foliage Cones)
  const treeCount = 24;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.24, 0.34, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 }),
    treeCount
  );
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x265928, roughness: 0.82 });
  const foliageInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.5, 4.8, 7),
    foliageMat,
    treeCount
  );
  const _dummy = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const tx = -58 + i * 5.2;
    const tz = -13 - (i % 4) * 5.2;
    const sc = 0.8 + (i % 3) * 0.25;
    _dummy.position.set(tx, 1.1 * sc, tz);
    _dummy.scale.setScalar(sc);
    _dummy.updateMatrix();
    trunkInst.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(tx, 3.6 * sc, tz);
    _dummy.scale.setScalar(sc);
    _dummy.updateMatrix();
    foliageInst.setMatrixAt(i, _dummy.matrix);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  scene.add(trunkInst, foliageInst);

  // Wooden Quiver Perch behind Slingshot
  const perchGroup = new THREE.Group();
  const perchWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const perchPlank = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 2.0), perchWoodMat);
  perchPlank.position.set(-22.8, 0.5, 0);
  const perchPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.8, 7), perchWoodMat);
  perchPost.position.set(-22.8, 0.25, 0);
  perchGroup.add(perchPlank, perchPost);
  scene.add(perchGroup);

  // 3D Y-Slingshot Stand + Leather Pouch + Dynamic Rubber Bands
  const slingGroup = new THREE.Group();
  const woodPostMat = new THREE.MeshStandardMaterial({ color: 0x6b3f1d, roughness: 0.78 });
  enhanceMaterialWithShaderMood(woodPostMat, sharedUniforms, 'sling-wood');
  const postBase = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 4.4, 10), woodPostMat);
  postBase.position.y = 2.2;
  postBase.castShadow = true;
  const forkBack = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 3.2, 8), woodPostMat);
  forkBack.position.set(0, 5.4, -0.85);
  forkBack.rotation.x = -0.35;
  const forkFront = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 3.2, 8), woodPostMat);
  forkFront.position.set(0, 5.4, 0.85);
  forkFront.rotation.x = 0.35;
  slingGroup.add(postBase, forkBack, forkFront);
  scene.add(slingGroup);

  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3b180e, roughness: 0.65 });
  const bandGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 6);
  const backBand = new THREE.Mesh(bandGeo, bandMat);
  const frontBand = new THREE.Mesh(bandGeo, bandMat);
  const pouchMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x29150b, roughness: 0.8 })
  );
  pouchMesh.scale.set(0.65, 1.15, 0.9);
  scene.add(backBand, frontBand, pouchMesh);

  // Trajectory Preview Dots & Flight Trail Breadcrumb Dots
  const trajDots: THREE.Mesh[] = [];
  const dotGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(dotGeo, dotMat);
    m.visible = false;
    scene.add(m);
    trajDots.push(m);
  }

  const trailDotPool: THREE.Mesh[] = [];
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.72 });
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(dotGeo, trailMat);
    m.visible = false;
    scene.add(m);
    trailDotPool.push(m);
  }

  // Rapid-fire Reticle Ring
  const rapidReticleGroup = new THREE.Group();
  const retRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.06, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.88 })
  );
  rapidReticleGroup.add(retRing);
  rapidReticleGroup.visible = false;
  scene.add(rapidReticleGroup);

  // Active Hero Bird & Quiver Waiter Birds
  const birdGroups: Record<BirdType, BirdRig> = {
    red: buildBirdMesh('red', sharedUniforms),
    chuck: buildBirdMesh('chuck', sharedUniforms),
    blues: buildBirdMesh('blues', sharedUniforms),
    bomb: buildBirdMesh('bomb', sharedUniforms),
    terence: buildBirdMesh('terence', sharedUniforms),
  };
  for (const rig of Object.values(birdGroups)) {
    rig.group.visible = false;
    scene.add(rig.group);
  }

  // Waiting quiver slots (each slot can hold one of the 5 bird models)
  const waiterSlots: Array<Record<BirdType, BirdRig>> = [0, 1, 2].map(() => {
    const rec: Record<BirdType, BirdRig> = {
      red: buildBirdMesh('red', sharedUniforms),
      chuck: buildBirdMesh('chuck', sharedUniforms),
      blues: buildBirdMesh('blues', sharedUniforms),
      bomb: buildBirdMesh('bomb', sharedUniforms),
      terence: buildBirdMesh('terence', sharedUniforms),
    };
    for (const r of Object.values(rec)) {
      r.group.visible = false;
      scene.add(r.group);
    }
    return rec;
  });

  const extraBirdMeshes = new Map<number, BirdRig>();

  // Procedural CanvasTextures for Blocks
  const woodTex = createWoodPlankTexture();
  const iceTex = createIceCrystalTexture();
  const stoneTex = createStoneBlockTexture();
  const tntTex = createTntCrateTexture();
  const bouncerTex = createBouncerPadTexture();

  type StructureKind = Extract<BlockKind, 'wood' | 'ice' | 'stone' | 'tnt' | 'bouncer' | 'boulder'>;
  const blockMaterials: Record<StructureKind, THREE.MeshStandardMaterial> = {
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72 }),
    ice: new THREE.MeshStandardMaterial({
      map: iceTex,
      roughness: 0.14,
      metalness: 0.12,
      transparent: true,
      opacity: 0.86,
    }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.86 }),
    tnt: new THREE.MeshStandardMaterial({
      map: tntTex,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    }),
    bouncer: new THREE.MeshStandardMaterial({ map: bouncerTex, roughness: 0.32 }),
    boulder: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, flatShading: true }),
  };
  for (const [k, mat] of Object.entries(blockMaterials)) {
    enhanceMaterialWithShaderMood(mat, sharedUniforms, `blk-${k}`);
  }

  const blockUnitGeo = new THREE.BoxGeometry(1, 1, 2.2);
  const boulderUnitGeo = new THREE.IcosahedronGeometry(1, 1);
  const springCoilGeo = new THREE.TorusGeometry(0.32, 0.06, 6, 14);
  const springCoilMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.22,
  });

  const blockMeshes = new Map<number, THREE.Mesh>();
  const pigMeshes = new Map<number, PigRig>();
  const shockwaves = createShockwavePool(scene, 6);
  const weatherSys = createWeatherSystem(320);
  scene.add(weatherSys.points);

  // Pooled 3D Debris Particles, Dust Puffs, Scorches & Floating Score Sprites
  const debrisGeo = new THREE.BoxGeometry(0.34, 0.18, 0.28);
  const debrisPool: THREE.Mesh[] = [];
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(
      debrisGeo,
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75, transparent: true })
    );
    m.visible = false;
    scene.add(m);
    debrisPool.push(m);
  }

  const dustGeo = new THREE.SphereGeometry(1, 8, 6);
  const dustPool: THREE.Mesh[] = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(
      dustGeo,
      new THREE.MeshBasicMaterial({ color: 0xe7dcc8, transparent: true, opacity: 0.5, depthWrite: false })
    );
    m.visible = false;
    scene.add(m);
    dustPool.push(m);
  }

  const scorchGeo = new THREE.CircleGeometry(1, 16);
  scorchGeo.rotateX(-Math.PI / 2);
  const scorchPool: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      scorchGeo,
      new THREE.MeshBasicMaterial({ color: 0x1c1917, transparent: true, opacity: 0.55, depthWrite: false })
    );
    m.visible = false;
    scene.add(m);
    scorchPool.push(m);
  }

  const popupPool: THREE.Sprite[] = [];
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, depthTest: false })
    );
    sp.visible = false;
    scene.add(sp);
    popupPool.push(sp);
  }

  // Orbit + Raycasting onto Z=0 Slingshot Plane
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const playPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPt = new THREE.Vector3();

  let freeOrbitActive = false;
  let orbitYaw = 0;
  let orbitPitch = 0.2;
  let orbitDist = 56;
  let rightDragging = false;
  let lastX = 0;
  let lastY = 0;
  const dom = renderer.domElement;

  const onDown = (e: PointerEvent) => {
    if (!freeOrbitActive) return;
    if (e.button === 2 || e.shiftKey) {
      rightDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!rightDragging || !freeOrbitActive) return;
    orbitYaw = THREE.MathUtils.clamp(orbitYaw - (e.clientX - lastX) * 0.006, -1.2, 1.2);
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + (e.clientY - lastY) * 0.005, 0.05, 0.95);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = () => {
    rightDragging = false;
  };
  const onWheel = (e: WheelEvent) => {
    if (!freeOrbitActive) return;
    e.preventDefault();
    orbitDist = THREE.MathUtils.clamp(orbitDist * (1 + Math.sign(e.deltaY) * 0.1), 22, 88);
  };
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });

  let elapsed = 0;
  let lastDpr = -1;
  let lastShadow: boolean | null = null;
  let lastExplosionId = -1;
  let lastFloorY = 606;
  let lastAtmo: number = -1;
  const _camTarget = new THREE.Vector3();
  const _lookVec = new THREE.Vector3();
  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _pouchPos = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  const orientCylinderBetween = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
    const dist = a.distanceTo(b);
    if (dist < 0.001) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, dist, 1);
    const dir = _vB.copy(b).sub(a).normalize();
    mesh.quaternion.setFromUnitVectors(_up, dir);
  };

  return {
    resize(width, height, dpr) {
      if (width <= 0 || height <= 0) return;
      if (Math.abs(dpr - lastDpr) > 0.01) {
        lastDpr = dpr;
        renderer.setPixelRatio(isSoftwareGl ? 1 : dpr);
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },

    clientToWorld(clientX, clientY) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(playPlane, hitPt);
      if (!hit) return { x: 248, y: 472 };
      return {
        x: hit.x / SCALE + 620,
        y: lastFloorY - hit.y / SCALE,
      };
    },

    update(params) {
      const {
        dt,
        bodies,
        activeBird,
        birdAlpha,
        phase,
        camFocusX,
        camFocusY,
        camZoom,
        budget,
        shaderMood,
        weather,
        cameraPreset,
        freeOrbit,
        giantBirds,
        showTrajGuide,
        trajectoryPts,
        slingAnchorX,
        slingAnchorY,
        floorY,
        pouchX,
        pouchY,
        activeBirdType,
        explosionPulse,
        quiverTypes = [],
        quiverCount = 3,
        infiniteBirds = false,
        birdInSling = false,
        atmosphereHint = 0,
        particles = [],
        dustClouds = [],
        scorches = [],
        groundDivots = [],
        popups = [],
        trailDots = [],
        rapidReticle = null,
      } = params;

      lastFloorY = floorY;
      freeOrbitActive = freeOrbit;
      elapsed += dt;
      if (lastShadow !== budget.shadows && !isSoftwareGl) {
        lastShadow = budget.shadows;
        renderer.shadowMap.enabled = budget.shadows;
      }

      syncSharedShaderUniforms(sharedUniforms, shaderMood, elapsed);
      skyDome.uniforms.uTime.value = elapsed;

      // Sync Valley Atmosphere (Morning Orchard / Golden Canyon / Starlit Citadel)
      if (lastAtmo !== atmosphereHint) {
        lastAtmo = atmosphereHint;
        if (atmosphereHint === 1) {
          skyDome.uniforms.uZenith.value.setHex(0x432359);
          skyDome.uniforms.uMid.value.setHex(0xd9643a);
          skyDome.uniforms.uHorizon.value.setHex(0xfde68a);
          skyDome.uniforms.uStarAlpha.value = 0.05;
          fog.color.setHex(0xebb58e);
          groundMat.color.setHex(0x847832);
          hillMat.color.setHex(0x6e4e2e);
          mountainMat.color.setHex(0x7c4a48);
          keyLight.color.setHex(0xffd2a1);
          sunSprite.visible = true;
        } else if (atmosphereHint === 2) {
          skyDome.uniforms.uZenith.value.setHex(0x090f24);
          skyDome.uniforms.uMid.value.setHex(0x1b2b52);
          skyDome.uniforms.uHorizon.value.setHex(0x4c3f78);
          skyDome.uniforms.uStarAlpha.value = 0.92;
          fog.color.setHex(0x28294c);
          groundMat.color.setHex(0x285430);
          hillMat.color.setHex(0x1d3f35);
          mountainMat.color.setHex(0x2d3a58);
          keyLight.color.setHex(0xc7d2fe);
          sunSprite.visible = false;
        } else {
          skyDome.uniforms.uZenith.value.setHex(0x1e5799);
          skyDome.uniforms.uMid.value.setHex(0x62a8db);
          skyDome.uniforms.uHorizon.value.setHex(0xdbeeff);
          skyDome.uniforms.uStarAlpha.value = 0;
          fog.color.setHex(0x9bd2f5);
          groundMat.color.setHex(0x4d8b31);
          hillMat.color.setHex(0x3b762e);
          mountainMat.color.setHex(0x4b688a);
          keyLight.color.setHex(0xfff1d6);
          sunSprite.visible = true;
        }
      }

      // Drift clouds gently across valley sky
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.sprite.position.x = (((c.baseX + elapsed * c.speed + 95) % 190) - 95);
      }

      if (explosionPulse && explosionPulse.id !== lastExplosionId) {
        lastExplosionId = explosionPulse.id;
        shockwaves.spawn(
          new THREE.Vector3(
            toWorldX(explosionPulse.x),
            toWorldY(explosionPulse.y, floorY),
            0.2
          ),
          explosionPulse.colorHex,
          8.5
        );
      }
      shockwaves.update(dt);

      // Slingshot Stand, Pouch & Bands
      const anchorWx = toWorldX(slingAnchorX);
      const anchorWy = toWorldY(slingAnchorY, floorY);
      slingGroup.position.set(anchorWx, 0, 0);
      perchGroup.position.set(anchorWx - 18.6, 0, 0); // anchored right behind slingshot

      const pouchWx = toWorldX(pouchX);
      const pouchWy = toWorldY(pouchY, floorY);
      _pouchPos.set(pouchWx, pouchWy, 0);
      pouchMesh.position.copy(_pouchPos);
      _vA.set(anchorWx, anchorWy + 0.55, -0.85);
      orientCylinderBetween(backBand, _vA, _pouchPos);
      _vA.set(anchorWx, anchorWy + 0.55, 0.85);
      orientCylinderBetween(frontBand, _vA, _pouchPos);

      // Waiting Bird Quiver on Perch
      const visibleWaiters = infiniteBirds
        ? Math.min(3, quiverTypes.length)
        : Math.max(0, quiverCount - (birdInSling ? 1 : 0));
      const waiterOffsets = [
        { x: anchorWx - 4.3, y: 1.35 },
        { x: anchorWx - 6.3, y: 1.35 },
        { x: anchorWx - 5.3, y: 2.65 },
      ];
      for (let slotIdx = 0; slotIdx < waiterSlots.length; slotIdx++) {
        const slotMap = waiterSlots[slotIdx];
        const show = slotIdx < visibleWaiters;
        const wType = quiverTypes[slotIdx] ?? activeBirdType;
        const hop = Math.abs(Math.sin(elapsed * 2.8 + slotIdx * 1.3)) * 0.22;
        for (const [bKey, rig] of Object.entries(slotMap)) {
          const match = show && bKey === wType;
          rig.group.visible = match;
          if (match) {
            const sc = (wType === 'terence' ? 1.05 : wType === 'blues' ? 0.65 : 0.82) * (giantBirds ? 1.25 : 1);
            rig.group.position.set(waiterOffsets[slotIdx].x, waiterOffsets[slotIdx].y + hop, 0);
            rig.group.rotation.set(0, 0, 0);
            rig.group.scale.setScalar(sc);
            rig.abilityRing.visible = false;
            rig.flameMesh.visible = false;
          }
        }
      }

      // Sync Active Hero Bird
      const baseScale = giantBirds ? 1.48 : 1.0;
      const abilityAvailable =
        phase === 'flying' && activeBird.isActive && !activeBird.abilityUsed && !activeBird.hasStruck;
      for (const [bId, rig] of Object.entries(birdGroups)) {
        const isCurrent = bId === activeBirdType && activeBird.isActive && birdAlpha > 0.05;
        rig.group.visible = isCurrent;
        if (isCurrent) {
          rig.group.position.set(toWorldX(activeBird.x), toWorldY(activeBird.y, floorY), 0);
          rig.group.rotation.z = -activeBird.angle;
          rig.group.scale.setScalar((activeBird.radius / 19) * baseScale);
          rig.flameMesh.visible = (activeBird.dashTimer ?? 0) > 0;
          if (rig.flameMesh.visible) {
            rig.flameMesh.scale.set(1, 0.9 + Math.sin(elapsed * 32) * 0.2, 1);
          }
          if (bId === 'bomb') {
            const fuseLit = (activeBird.fuseTimer ?? 0) > 0;
            rig.sparkMesh.scale.setScalar(fuseLit ? 1.2 + Math.sin(elapsed * 28) * 0.4 : 0.75);
          }
          rig.abilityRing.visible = abilityAvailable;
          if (abilityAvailable) {
            rig.abilityRing.scale.setScalar(1.0 + Math.sin(elapsed * 8) * 0.08);
          }
        }
      }

      // Sync Extra Airborne / Split / Settled Birds
      const seenExtraBirds = new Set<number>();
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b.isActive || b.kind !== 'bird' || b.id === activeBird.id || b.fadeAlpha <= 0.05) {
          continue;
        }
        seenExtraBirds.add(b.id);
        let rig = extraBirdMeshes.get(b.id);
        if (!rig) {
          rig = buildBirdMesh(b.birdType ?? 'blues', sharedUniforms);
          scene.add(rig.group);
          extraBirdMeshes.set(b.id, rig);
        }
        rig.group.position.set(toWorldX(b.x), toWorldY(b.y, floorY), 0);
        rig.group.rotation.z = -b.angle;
        rig.group.scale.setScalar((b.radius / 19) * baseScale);
        rig.flameMesh.visible = (b.dashTimer ?? 0) > 0;
        rig.abilityRing.visible = false;
      }
      for (const [id, rig] of extraBirdMeshes.entries()) {
        if (!seenExtraBirds.has(id)) {
          scene.remove(rig.group);
          extraBirdMeshes.delete(id);
        }
      }

      // Trajectory Aim Dots & Flight Breadcrumbs
      const isAimPhase = phase === 'dragging' || phase === 'auto_pulling';
      for (let i = 0; i < trajDots.length; i++) {
        const dot = trajDots[i];
        const pt = trajectoryPts[i];
        if (showTrajGuide && pt && isAimPhase) {
          dot.visible = true;
          dot.position.set(toWorldX(pt.x), toWorldY(pt.y, floorY), 0);
        } else {
          dot.visible = false;
        }
      }

      for (let i = 0; i < trailDotPool.length; i++) {
        const m = trailDotPool[i];
        const td = trailDots[i];
        if (td && td.alpha > 0.05) {
          m.visible = true;
          m.position.set(toWorldX(td.x), toWorldY(td.y, floorY), 0);
          m.scale.setScalar(Math.max(0.45, td.r * 0.25));
        } else {
          m.visible = false;
        }
      }

      if (rapidReticle) {
        rapidReticleGroup.visible = true;
        rapidReticleGroup.position.set(toWorldX(rapidReticle.x), toWorldY(rapidReticle.y, floorY), 0.15);
        rapidReticleGroup.rotation.z = elapsed * 2.2;
      } else {
        rapidReticleGroup.visible = false;
      }

      // Sync Destructible Blocks, Boulders & Pigs
      const seenBlockIds = new Set<number>();
      const seenPigIds = new Set<number>();
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b.isActive || b.kind === 'ground' || b.kind === 'bird') continue;

        if (b.kind === 'pig') {
          seenPigIds.add(b.id);
          let entry = pigMeshes.get(b.id);
          if (!entry) {
            entry = buildPigMesh(b.pigVariant ?? 'minion', sharedUniforms);
            scene.add(entry.group);
            pigMeshes.set(b.id, entry);
          }
          entry.group.position.set(toWorldX(b.x), toWorldY(b.y, floorY), 0);
          entry.group.rotation.z = -b.angle;
          entry.group.scale.setScalar(b.radius * SCALE);
          const isHurt = b.hp < b.maxHp * 0.72;
          entry.hurtOverlay.visible = isHurt;
          entry.skinMat.color.setHex(isHurt ? 0x65a30d : 0x84cc16);
          if (entry.armorMesh) {
            entry.armorMesh.visible = (b.armorHp ?? 0) > 0;
          }
          continue;
        }

        seenBlockIds.add(b.id);
        let mesh = blockMeshes.get(b.id);
        if (!mesh) {
          const mat = blockMaterials[b.kind as StructureKind] ?? blockMaterials.wood;
          const geo = b.shape === 'circle' ? boulderUnitGeo : blockUnitGeo;
          mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = !isSoftwareGl;
          mesh.receiveShadow = true;
          if (b.kind === 'bouncer') {
            for (let s = 0; s < 3; s++) {
              const coil = new THREE.Mesh(springCoilGeo, springCoilMat);
              coil.rotation.x = Math.PI / 2;
              coil.position.y = -0.62 - s * 0.14;
              mesh.add(coil);
            }
          }
          scene.add(mesh);
          blockMeshes.set(b.id, mesh);
        }
        mesh.position.set(toWorldX(b.x), toWorldY(b.y, floorY), 0);
        mesh.rotation.z = -b.angle;
        if (b.shape === 'circle') {
          mesh.scale.setScalar(b.radius * SCALE);
        } else {
          mesh.scale.set(b.hw * 2 * SCALE, b.hh * 2 * SCALE, 1.0);
        }
      }

      for (const [id, mesh] of blockMeshes.entries()) {
        if (!seenBlockIds.has(id)) {
          scene.remove(mesh);
          blockMeshes.delete(id);
        }
      }
      for (const [id, entry] of pigMeshes.entries()) {
        if (!seenPigIds.has(id)) {
          scene.remove(entry.group);
          pigMeshes.delete(id);
        }
      }

      // Sync 3D Debris Particles
      const debrisCap = budget.fastShader ? 24 : debrisPool.length;
      for (let i = 0; i < debrisPool.length; i++) {
        const m = debrisPool[i];
        const p = particles[i];
        if (p && i < debrisCap && p.alpha > 0.04) {
          m.visible = true;
          m.position.set(toWorldX(p.x), toWorldY(p.y, floorY), ((i % 5) - 2) * 0.28);
          m.rotation.set(p.angle * 0.6, p.angle * 0.4, -p.angle);
          m.scale.setScalar(Math.max(0.35, p.size * 0.12));
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.color.set(p.color);
          mat.opacity = p.alpha;
        } else {
          m.visible = false;
        }
      }

      // Sync 3D Dust Clouds
      const dustCap = budget.fastShader ? 14 : dustPool.length;
      for (let i = 0; i < dustPool.length; i++) {
        const m = dustPool[i];
        const dc = dustClouds[i];
        if (dc && i < dustCap && dc.alpha > 0.03) {
          m.visible = true;
          m.position.set(toWorldX(dc.x), Math.max(0.2, toWorldY(dc.y, floorY)), ((i % 3) - 1) * 0.35);
          m.scale.setScalar(dc.radius * SCALE);
          (m.material as THREE.MeshBasicMaterial).opacity = dc.alpha * 0.58;
        } else {
          m.visible = false;
        }
      }

      // Sync Ground Scorch Rings & Divots
      for (let i = 0; i < scorchPool.length; i++) {
        const m = scorchPool[i];
        const sc = scorches[i];
        const dv = !sc ? groundDivots[i - scorches.length] : undefined;
        if (sc && sc.alpha > 0.03) {
          m.visible = true;
          m.position.set(toWorldX(sc.x), 0.04, 0);
          m.scale.set(sc.radius * SCALE, 1, sc.radius * SCALE * 0.55);
          (m.material as THREE.MeshBasicMaterial).opacity = sc.alpha * 0.65;
        } else if (dv) {
          m.visible = true;
          m.position.set(toWorldX(dv.x), 0.03, 0);
          m.scale.set(dv.halfWidth * SCALE, 1, dv.halfWidth * SCALE * 0.42);
          (m.material as THREE.MeshBasicMaterial).opacity = 0.38;
        } else {
          m.visible = false;
        }
      }

      // Sync Floating Score & Callout Sprites
      for (let i = 0; i < popupPool.length; i++) {
        const sp = popupPool[i];
        const pop = popups[i];
        if (pop) {
          const t = pop.life / Math.max(0.01, pop.maxLife);
          const alpha = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
          if (alpha > 0.03) {
            sp.visible = true;
            sp.position.set(toWorldX(pop.x), toWorldY(pop.y, floorY), 1.8);
            sp.scale.set(5.4 * pop.scale, 1.7 * pop.scale, 1);
            const spMat = sp.material as THREE.SpriteMaterial;
            const nextTex = getFloatingPopupTexture(pop.text, pop.color);
            if (spMat.map !== nextTex) {
              spMat.map = nextTex;
              spMat.needsUpdate = true;
            }
            spMat.opacity = alpha;
            continue;
          }
        }
        sp.visible = false;
      }

      // Smooth Dynamic 3D Camera
      const focusX = toWorldX(camFocusX);
      const focusY = Math.max(4.5, toWorldY(camFocusY, floorY));

      if (freeOrbit) {
        _camTarget.set(
          focusX + Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitDist,
          focusY + Math.sin(orbitPitch) * orbitDist,
          Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitDist
        );
        _lookVec.set(focusX, focusY - 1.5, 0);
      } else if (cameraPreset === 'shoulder') {
        _camTarget.set(anchorWx - 11.5, anchorWy + 4.8, 12.5);
        _lookVec.set(focusX + 8, focusY, 0);
      } else if (cameraPreset === 'tactical') {
        _camTarget.set(focusX + 6, focusY + 11.5, 48);
        _lookVec.set(focusX, focusY - 1.2, 0);
      } else {
        const dist = 54 / Math.max(0.75, camZoom);
        _camTarget.set(focusX + 1.5, focusY + 4.2, dist);
        _lookVec.set(focusX, focusY - 1.4, 0);
      }

      const damp = 1 - Math.exp(-5.8 * dt);
      camera.position.lerp(_camTarget, damp);
      camera.lookAt(_lookVec);

      weatherSys.update(dt, weather, _lookVec, budget.particleScale);
      renderer.render(scene, camera);
    },

    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      shockwaves.dispose();
      weatherSys.dispose();
      skyDome.mesh.geometry.dispose();
      (skyDome.mesh.material as THREE.Material).dispose();
      woodTex.dispose();
      iceTex.dispose();
      stoneTex.dispose();
      tntTex.dispose();
      bouncerTex.dispose();
      sunTex.dispose();
      cloudTex.dispose();
      blockUnitGeo.dispose();
      boulderUnitGeo.dispose();
      springCoilGeo.dispose();
      springCoilMat.dispose();
      debrisGeo.dispose();
      dustGeo.dispose();
      scorchGeo.dispose();
      for (const m of Object.values(blockMaterials)) m.dispose();
      envTex.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    },
  };
}
