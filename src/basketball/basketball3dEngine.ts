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
  createBasketballJerseyTexture,
  createBasketballTexture,
  createChainLinkTexture,
  createJumbotronTexture,
  createSunHaloTexture,
} from '../utils/threeTextures';
import type {
  BasketballState,
  HoopControllerState,
  NetNode,
  RimSpringState,
  ShooterMode,
  TrailPoint,
} from './hoopPhysics';
import type { CameraFlash, ConfettiPiece, SmokePuff } from './hoopRenderer';
import type { CourtVenue, ShooterState } from './shooterIK';

export type Hoops3dCameraMode = 'baseline' | 'sideline' | 'shooter' | 'overhead';

export interface Basketball3dUpdateParams {
  dt: number;
  ball: BasketballState;
  rimY: number;
  rimCenterX: number;
  floorY: number;
  rimSpring: RimSpringState;
  hoopCtrl: HoopControllerState;
  shooter: ShooterState;
  netNodes: NetNode[];
  trail: TrailPoint[];
  previewArc: Array<{ x: number; y: number }>;
  venue: CourtVenue;
  fireballActive: boolean;
  cameraMode: Hoops3dCameraMode;
  freeOrbit: boolean;
  shaderMood: ShaderMood;
  weather: WeatherFx;
  budget: SceneRenderBudget;
  swishPulseId: number;
  // 2D parity additions
  makes?: number;
  streak?: number;
  shotClockSec?: number;
  bannerAlert?: string;
  movingHoopActive?: boolean;
  boardFlash?: number;
  goalLightFlash?: number;
  crowdExcitement?: number;
  confetti?: ConfettiPiece[];
  smokePuffs?: SmokePuff[];
  flashes?: CameraFlash[];
  shooterMode?: ShooterMode;
}

export interface Basketball3dEngine {
  update: (params: Basketball3dUpdateParams) => void;
  clientToCourt: (clientX: number, clientY: number) => { x: number; y: number };
  resize: (width: number, height: number, dpr: number) => void;
  dispose: () => void;
}

const SCALE = 0.036; // Maps 1280x720 court pixels neatly into ~46m x 26m 3D space
function toX(px: number): number {
  return (px - 640) * SCALE;
}
function toY(py: number, floorY: number): number {
  return (floorY - py) * SCALE;
}

interface VenueKit3d {
  jersey: string;
  trim: string;
  shorts: number;
  headband: number;
  shoeAccent: number;
  skin: number;
}

const VENUE_KITS_3D: Record<CourtVenue, VenueKit3d> = {
  arena: {
    jersey: '#1d4ed8',
    trim: '#fbbf24',
    shorts: 0x1e3a8a,
    headband: 0xfbbf24,
    shoeAccent: 0x2563eb,
    skin: 0xd99b72,
  },
  streetball: {
    jersey: '#0f766e',
    trim: '#fb923c',
    shorts: 0x1e293b,
    headband: 0xfb923c,
    shoeAccent: 0xf97316,
    skin: 0xc9885b,
  },
  retro_gym: {
    jersey: '#b91c1c',
    trim: '#fde68a',
    shorts: 0x991b1b,
    headband: 0xfef3c7,
    shoeAccent: 0xdc2626,
    skin: 0xd99b72,
  },
};

function buildShooter3dGroup(shared: ReturnType<typeof createSharedShaderUniforms>) {
  const g = new THREE.Group();

  const jerseyTextures: Record<CourtVenue, THREE.CanvasTexture> = {
    arena: createBasketballJerseyTexture(VENUE_KITS_3D.arena.jersey, VENUE_KITS_3D.arena.trim, '23'),
    streetball: createBasketballJerseyTexture(
      VENUE_KITS_3D.streetball.jersey,
      VENUE_KITS_3D.streetball.trim,
      '23'
    ),
    retro_gym: createBasketballJerseyTexture(
      VENUE_KITS_3D.retro_gym.jersey,
      VENUE_KITS_3D.retro_gym.trim,
      '23'
    ),
  };

  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTextures.arena,
    roughness: 0.48,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: VENUE_KITS_3D.arena.trim, roughness: 0.45 });
  const skinMat = new THREE.MeshStandardMaterial({ color: VENUE_KITS_3D.arena.skin, roughness: 0.56 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: VENUE_KITS_3D.arena.shorts, roughness: 0.6 });
  const headbandMat = new THREE.MeshStandardMaterial({ color: VENUE_KITS_3D.arena.headband, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.36 });
  const shoeAccentMat = new THREE.MeshStandardMaterial({ color: VENUE_KITS_3D.arena.shoeAccent, roughness: 0.4 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 });
  enhanceMaterialWithShaderMood(jerseyMat, shared, 'hoops-jersey');

  // Upper body group (lowers smoothly when crouching in aim/dribble stance)
  const upperBody = new THREE.Group();

  // Sleeveless #23 Basketball Jersey Torso (scaled oval: broader in Z shoulders, athletic depth in X)
  const torsoGeo = new THREE.CylinderGeometry(0.30, 0.25, 0.96, 16);
  const body = new THREE.Mesh(torsoGeo, jerseyMat);
  body.position.y = 1.68;
  body.scale.set(0.76, 1.0, 1.24);
  body.castShadow = true;

  // Pelvis shorts waist
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.27, 0.32, 12), shortsMat);
  pelvis.position.y = 1.1;
  pelvis.scale.set(0.78, 1.0, 1.24);

  // Neck + Head + Hair Fade + Headband + Eyes facing +X toward hoop
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.24, 10), skinMat);
  neck.position.set(0.02, 2.24, 0);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.04, 2.51, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), skinMat);
  head.castShadow = true;
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.276, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hairMat
  );
  hairCap.position.set(-0.02, 0.02, 0);
  hairCap.rotation.z = 0.22; // tilted slightly backward (-X) to match 2D fade hairline
  const headbandTilt = new THREE.Group();
  headbandTilt.position.set(-0.01, 0.06, 0);
  headbandTilt.rotation.z = 0.22;
  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.266, 0.036, 6, 20), headbandMat);
  headband.rotation.x = Math.PI / 2;
  headbandTilt.add(headband);
  const eyeGeo = new THREE.SphereGeometry(0.032, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, hairMat);
  eyeL.position.set(0.245, 0.015, -0.095);
  const eyeR = new THREE.Mesh(eyeGeo, hairMat);
  eyeR.position.set(0.245, 0.015, 0.095);
  headGroup.add(head, hairCap, headbandTilt, eyeL, eyeR);

  // Legs with baggy basketball shorts thigh sleeves + side trim + bare calves + white crew socks + high-top sneakers
  const buildLeg = (zOffset: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(0, 1.02, zOffset);

    const shortsSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.36, 10), shortsMat);
    shortsSleeve.position.y = -0.17;
    shortsSleeve.castShadow = true;
    const shortsStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.33, 0.04), trimMat);
    shortsStripe.position.set(0, -0.17, Math.sign(zOffset) * 0.165);

    const lowerThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.105, 0.24, 10), skinMat);
    lowerThigh.position.y = -0.39;
    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.106, 8, 8), skinMat);
    kneeCap.position.y = -0.5;

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.5;

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.082, 0.28, 10), skinMat);
    calf.position.y = -0.14;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.082, 0.18, 10), sockMat);
    sock.position.y = -0.35;

    const anklePivot = new THREE.Group();
    anklePivot.position.y = -0.44;
    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.19), shoeMat);
    shoeUpper.position.set(0.07, 0.02, 0);
    const shoeCollar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.18), shoeMat);
    shoeCollar.position.set(-0.01, 0.08, 0);
    const shoeAccent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.205), shoeAccentMat);
    shoeAccent.position.set(0.06, 0.01, 0);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.205), soleMat);
    sole.position.set(0.07, -0.06, 0);
    anklePivot.add(shoeUpper, shoeCollar, shoeAccent, sole);

    kneePivot.add(calf, sock, anklePivot);
    hipPivot.add(shortsSleeve, shortsStripe, lowerThigh, kneeCap, kneePivot);
    return { hipPivot, kneePivot, anklePivot };
  };

  const leftLeg = buildLeg(-0.18);
  const rightLeg = buildLeg(0.18);

  // Articulated 2-Bone Arms hanging naturally downward (-Y) from bare shoulder caps
  const buildArm = (zOffset: number, withWristband: boolean) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(0, 2.08, zOffset);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), skinMat);
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.076, 0.44, 10), skinMat);
    upperArm.position.y = -0.22;
    upperArm.castShadow = true;

    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 8), skinMat);
    elbowCap.position.y = -0.44;

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.44;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.06, 0.4, 10), skinMat);
    forearm.position.y = -0.2;
    forearmPivot.add(forearm);

    if (withWristband) {
      const wristBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.07, 0.09, 10),
        headbandMat
      );
      wristBand.position.y = -0.34;
      forearmPivot.add(wristBand);
    }

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.076, 8, 8), skinMat);
    hand.scale.set(1.15, 1.2, 0.85);
    hand.position.y = -0.43;
    forearmPivot.add(hand);

    shoulderPivot.add(shoulderCap, upperArm, elbowCap, forearmPivot);
    return { shoulderPivot, forearmPivot };
  };

  const shootArm = buildArm(0.37, true); // +Z near camera (shooting arm)
  const offArm = buildArm(-0.37, false); // -Z far side (guide/balance arm)

  upperBody.add(
    body,
    pelvis,
    neck,
    headGroup,
    shootArm.shoulderPivot,
    offArm.shoulderPivot
  );
  g.add(upperBody, leftLeg.hipPivot, rightLeg.hipPivot);

  let currentVenue: CourtVenue = 'arena';
  const setVenue = (venue: CourtVenue) => {
    if (venue === currentVenue) return;
    currentVenue = venue;
    const kit = VENUE_KITS_3D[venue];
    jerseyMat.map = jerseyTextures[venue];
    jerseyMat.needsUpdate = true;
    trimMat.color.set(kit.trim);
    shortsMat.color.setHex(kit.shorts);
    headbandMat.color.setHex(kit.headband);
    shoeAccentMat.color.setHex(kit.shoeAccent);
    skinMat.color.setHex(kit.skin);
  };

  return {
    g,
    upperBody,
    headGroup,
    shootArmPivot: shootArm.shoulderPivot,
    forearmPivot: shootArm.forearmPivot,
    offArmPivot: offArm.shoulderPivot,
    offForearmPivot: offArm.forearmPivot,
    leftLeg,
    rightLeg,
    setVenue,
    dispose: () => {
      jerseyTextures.arena.dispose();
      jerseyTextures.streetball.dispose();
      jerseyTextures.retro_gym.dispose();
    },
  };
}

interface CrowdMemberSpec {
  x: number;
  baseY: number;
  z: number;
  scale: number;
  phase: number;
  shirtHex: number;
  skinHex: number;
  hairHex: number;
  hasTowel: boolean;
}

function createInstancedCrowd(
  parent: THREE.Group,
  specs: CrowdMemberSpec[]
) {
  const count = specs.length;
  const legsGeo = new THREE.BoxGeometry(0.56, 0.56, 0.36);
  const torsoGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.72, 9);
  const shoulderGeo = new THREE.CapsuleGeometry(0.11, 0.44, 4, 8);
  shoulderGeo.rotateX(Math.PI / 2);
  const headGeo = new THREE.SphereGeometry(0.21, 10, 8);
  const hairGeo = new THREE.SphereGeometry(0.224, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  // Arm geometry pivoted at top shoulder socket extending downward along -Y
  const armGeo = new THREE.CapsuleGeometry(0.072, 0.44, 4, 7);
  armGeo.translate(0, -0.26, 0);
  const towelGeo = new THREE.BoxGeometry(0.18, 0.36, 0.04);
  towelGeo.translate(0, 0.22, 0);

  const legsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
  const towelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });

  const legsMesh = new THREE.InstancedMesh(legsGeo, legsMat, count);
  const torsoMesh = new THREE.InstancedMesh(torsoGeo, shirtMat, count);
  const shoulderMesh = new THREE.InstancedMesh(shoulderGeo, shirtMat, count);
  const headMesh = new THREE.InstancedMesh(headGeo, skinMat, count);
  const hairMesh = new THREE.InstancedMesh(hairGeo, hairMat, count);
  const armLMesh = new THREE.InstancedMesh(armGeo, shirtMat, count);
  const armRMesh = new THREE.InstancedMesh(armGeo, shirtMat, count);
  const towelMesh = new THREE.InstancedMesh(towelGeo, towelMat, count);

  const allInst = [legsMesh, torsoMesh, shoulderMesh, headMesh, hairMesh, armLMesh, armRMesh, towelMesh];
  for (const m of allInst) {
    m.frustumCulled = false;
  }

  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const s = specs[i];
    col.setHex(s.shirtHex);
    torsoMesh.setColorAt(i, col);
    shoulderMesh.setColorAt(i, col);
    armLMesh.setColorAt(i, col);
    armRMesh.setColorAt(i, col);
    col.setHex(s.skinHex);
    headMesh.setColorAt(i, col);
    col.setHex(s.hairHex);
    hairMesh.setColorAt(i, col);
  }
  if (torsoMesh.instanceColor) torsoMesh.instanceColor.needsUpdate = true;
  if (shoulderMesh.instanceColor) shoulderMesh.instanceColor.needsUpdate = true;
  if (armLMesh.instanceColor) armLMesh.instanceColor.needsUpdate = true;
  if (armRMesh.instanceColor) armRMesh.instanceColor.needsUpdate = true;
  if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
  if (hairMesh.instanceColor) hairMesh.instanceColor.needsUpdate = true;

  parent.add(...allInst);

  const dummy = new THREE.Object3D();
  const update = (elapsed: number, cheer: number, lookBias: number) => {
    for (let i = 0; i < count; i++) {
      const s = specs[i];
      const wave = Math.sin(elapsed * 12.5 - s.phase);
      const waveUp = Math.max(0, wave * 0.5 + 0.5);
      // Enthusiastic jumping off bleachers on scores/streaks + gentle lively idle sway
      const jump =
        cheer > 0.04
          ? waveUp * (0.65 + 0.65 * cheer)
          : Math.max(0, Math.sin(elapsed * 2.4 + s.phase)) * 0.08;
      const armRaise =
        cheer > 0.04
          ? Math.min(1, cheer * (0.65 + 0.35 * waveUp))
          : (i % 6 === 0 ? 0.22 + 0.14 * Math.sin(elapsed * 3.1 + s.phase) : 0.04);

      const px = s.x;
      const py = s.baseY + jump;
      const pz = s.z;
      const sc = s.scale;
      const bodyTilt = Math.sin(elapsed * 4.2 + s.phase) * 0.05 * (0.4 + cheer);

      // Legs
      dummy.position.set(px, py - 0.52 * sc, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      legsMesh.setMatrixAt(i, dummy.matrix);

      // Torso
      dummy.position.set(px, py + 0.12 * sc, pz);
      dummy.rotation.set(0, lookBias * 0.18, bodyTilt);
      dummy.scale.set(sc * 1.15, sc, sc * 0.85);
      dummy.updateMatrix();
      torsoMesh.setMatrixAt(i, dummy.matrix);

      // Shoulders
      dummy.position.set(px, py + 0.42 * sc, pz);
      dummy.rotation.set(0, lookBias * 0.18, bodyTilt);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      shoulderMesh.setMatrixAt(i, dummy.matrix);

      // Head + Hair looking slightly toward live ball X
      dummy.position.set(px + lookBias * 0.06 * sc, py + 0.72 * sc, pz);
      dummy.rotation.set(0, lookBias * 0.32, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(px + lookBias * 0.05 * sc, py + 0.75 * sc, pz - 0.02 * sc);
      dummy.rotation.set(-0.18, lookBias * 0.32, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      hairMesh.setMatrixAt(i, dummy.matrix);

      // Left & Right Cheering Arms (rotate up to +2.7 rad overhead when cheering!)
      const armZ = 0.22 + armRaise * 2.45 + Math.sin(elapsed * 14 + s.phase) * armRaise * 0.22;
      const armX = -0.18 - armRaise * 0.35;
      dummy.position.set(px - 0.36 * sc, py + 0.44 * sc, pz);
      dummy.rotation.set(armX, 0, -armZ);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      armLMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(px + 0.36 * sc, py + 0.44 * sc, pz);
      dummy.rotation.set(armX, 0, armZ);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      armRMesh.setMatrixAt(i, dummy.matrix);

      // Rally towel waving above right hand during cheers
      if (s.hasTowel && armRaise > 0.3) {
        dummy.position.set(px + (0.42 + armRaise * 0.2) * sc, py + (0.38 + armRaise * 0.78) * sc, pz + 0.12 * sc);
        dummy.rotation.set(0, 0, Math.sin(elapsed * 16 + s.phase) * 0.55);
        dummy.scale.setScalar(sc);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      towelMesh.setMatrixAt(i, dummy.matrix);
    }
    for (const m of allInst) {
      m.instanceMatrix.needsUpdate = true;
    }
  };

  update(0, 0, 0);
  return { update };
}

export function createBasketball3dEngine(container: HTMLElement): Basketball3dEngine {
  const isSoftwareGl = detectSoftwareWebGL();
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x0b1020, 0.0082);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    45,
    (container.clientWidth || 1280) / Math.max(1, container.clientHeight || 720),
    0.4,
    380
  );
  camera.position.set(-1.5, 9.5, 36);

  const envTex = createStudioEnvironment(renderer, scene);
  const sharedUniforms = createSharedShaderUniforms('standard');

  const hemi = new THREE.HemisphereLight(0xfde68a, 0x1e293b, 0.92);
  scene.add(hemi);
  const spotKey = new THREE.DirectionalLight(0xfff4d9, 2.55);
  spotKey.position.set(-10, 32, 24);
  spotKey.castShadow = !isSoftwareGl;
  spotKey.shadow.mapSize.set(1024, 1024);
  spotKey.shadow.camera.left = -28;
  spotKey.shadow.camera.right = 28;
  spotKey.shadow.camera.top = 24;
  spotKey.shadow.camera.bottom = -10;
  scene.add(spotKey);

  const skyDome = createSkyDomeMesh({
    radius: 280,
    zenith: 0x070d1f,
    mid: 0x1e2948,
    horizon: 0x5c374c,
    showStars: true,
  });
  scene.add(skyDome.mesh);

  // Custom GLSL Hardwood Specular Court Shader
  const floorUniforms = {
    uIsStreet: { value: 0.0 },
    uTime: { value: 0.0 },
    uWireMix: sharedUniforms.uWireMix,
  };
  const courtMat = new THREE.ShaderMaterial({
    uniforms: floorUniforms,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uIsStreet;
      uniform float uTime;
      uniform float uWireMix;
      varying vec3 vWorldPos;

      void main() {
        float plank = floor(vWorldPos.z * 2.2) + floor(vWorldPos.x * 0.45);
        float grain = fract(sin(plank * 12.9898) * 43758.5453);
        vec3 woodCol = mix(vec3(0.56, 0.34, 0.16), vec3(0.68, 0.43, 0.21), grain * 0.7);
        vec3 asphaltCol = vec3(0.16, 0.19, 0.24) + (grain - 0.5) * 0.04;
        vec3 col = mix(woodCol, asphaltCol, uIsStreet);

        float courtBorder = step(22.5, abs(vWorldPos.x)) + step(12.0, abs(vWorldPos.z));
        float keyLine = exp(-abs(vWorldPos.x - 10.5) * 28.0) * step(abs(vWorldPos.z), 4.5);
        float threeArc = exp(-abs(length(vec2(vWorldPos.x - 13.8, vWorldPos.z)) - 11.2) * 24.0);
        float paintMask = clamp(keyLine + threeArc + exp(-abs(abs(vWorldPos.z) - 11.5) * 24.0), 0.0, 1.0);
        col = mix(col, vec3(0.98, 0.85, 0.42), paintMask * 0.85);
        if (courtBorder > 0.5) col *= 0.45;

        float spot = exp(-dot(vWorldPos.xz - vec2(4.0, 0.0), vWorldPos.xz - vec2(4.0, 0.0)) * 0.0055);
        col += vec3(0.28, 0.22, 0.14) * spot * (1.0 - uIsStreet * 0.55);

        if (uWireMix > 0.01) {
          vec2 g = abs(fract(vWorldPos.xz * 0.5 - 0.5) - 0.5) / max(fwidth(vWorldPos.xz * 0.5), vec2(0.002));
          col = mix(col * 0.5, vec3(0.18, 0.85, 1.0), (1.0 - min(g.x, g.y)) * uWireMix);
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  });
  const courtFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 48), courtMat);
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.receiveShadow = true;
  scene.add(courtFloor);

  // Free-ball Tee Ring Marker on Court
  const teeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.96, 24),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  teeRing.rotation.x = -Math.PI / 2;
  teeRing.position.set(toX(220), 0.03, 0);
  teeRing.visible = false;
  scene.add(teeRing);

  // -------------------------------------------------------------------------
  // Venue Groups: Arena (Bleachers + Cheering Fans + Spotlights + Flashes),
  // Streetball (Brick Wall + Chain-Link Fence + Sunset Glow + Trees),
  // Retro Gym (Wood Wainscoting + Championship Banners + Bench Teammates)
  // -------------------------------------------------------------------------
  const arenaGroup = new THREE.Group();
  const streetGroup = new THREE.Group();
  const retroGroup = new THREE.Group();
  scene.add(arenaGroup, streetGroup, retroGroup);

  // 1) PRO ARENA: Roof trusses, volumetric light cones, bleachers + cheering spectators + flash sprites
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.35 });
  const roofBeam = new THREE.Mesh(new THREE.BoxGeometry(58, 0.65, 1.2), trussMat);
  roofBeam.position.set(0, 21.5, -10);
  arenaGroup.add(roofBeam);

  const spotConeGeo = new THREE.ConeGeometry(5.5, 22, 14, 1, true);
  const spotConeMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sx of [-12, 2, 14]) {
    const cone = new THREE.Mesh(spotConeGeo, spotConeMat);
    cone.position.set(sx, 11.2, -2);
    arenaGroup.add(cone);
  }

  // Tiered Bleachers
  const bleacherMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  for (let row = 0; row < 3; row++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(54, 1.4, 2.2), bleacherMat);
    tier.position.set(0, 0.7 + row * 1.65, -14.2 - row * 2.1);
    arenaGroup.add(tier);
  }

  const skinPalette = [0xd99b72, 0xa8714e, 0xe7b992, 0x8c5838, 0xc9885b];
  const hairPalette = [0x18181b, 0x3b2314, 0x78350f, 0xd97706, 0x334155];
  const arenaShirts = [0x1d4ed8, 0xf59e0b, 0xe2e8f0, 0xdc2626, 0x334155, 0x0284c7];
  const arenaSpecs: CrowdMemberSpec[] = [];
  for (let i = 0; i < 72; i++) {
    const row = Math.floor(i / 24);
    const colIdx = i % 24;
    arenaSpecs.push({
      x: -22 + colIdx * 1.9 + (row % 2) * 0.75,
      baseY: 2.15 + row * 1.65,
      z: -14.2 - row * 2.1,
      scale: 0.92 + ((i * 7) % 5) * 0.04,
      phase: i * 0.45 + row * 0.7,
      shirtHex: arenaShirts[(i + row) % arenaShirts.length],
      skinHex: skinPalette[(i + row * 2) % skinPalette.length],
      hairHex: hairPalette[(i * 3 + row) % hairPalette.length],
      hasTowel: i % 5 === 0,
    });
  }
  const arenaCrowd = createInstancedCrowd(arenaGroup, arenaSpecs);

  // Arena Camera Flash Sprites
  const flashTex = createSunHaloTexture();
  const flashPool: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sp.visible = false;
    arenaGroup.add(sp);
    flashPool.push(sp);
  }

  // 2) STREETBALL PARK: Brick Court Wall + Chain-Link Perimeter Fence + Park Trees + Park Crowd
  const brickWall = new THREE.Mesh(
    new THREE.BoxGeometry(56, 3.2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.92 })
  );
  brickWall.position.set(0, 1.6, -14.5);
  streetGroup.add(brickWall);

  const chainTex = createChainLinkTexture();
  chainTex.repeat.set(22, 4);
  const fenceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 5.5),
    new THREE.MeshBasicMaterial({ map: chainTex, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
  );
  fenceMesh.position.set(0, 5.8, -14.2);
  streetGroup.add(fenceMesh);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
  for (let px = -24; px <= 24; px += 8) {
    const fPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.6, 8), poleMat);
    fPole.position.set(px, 4.3, -14.2);
    streetGroup.add(fPole);
  }
  const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 54, 8), poleMat);
  topRail.rotation.z = Math.PI / 2;
  topRail.position.set(0, 8.55, -14.2);
  streetGroup.add(topRail);

  const parkTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const parkLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
  for (const tx of [-20, -9, 10, 21]) {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 5.2, 7), parkTrunkMat);
    tr.position.set(tx, 2.6, -18.5);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), parkLeafMat);
    lf.position.set(tx, 6.2, -18.5);
    streetGroup.add(tr, lf);
  }

  const streetShirts = [0xf97316, 0x0f766e, 0xeab308, 0xef4444, 0xf8fafc, 0x3b82f6];
  const streetSpecs: CrowdMemberSpec[] = [];
  for (let i = 0; i < 20; i++) {
    streetSpecs.push({
      x: -19 + i * 2.0,
      baseY: 0.95,
      z: -13.1,
      scale: 0.98 + (i % 4) * 0.04,
      phase: i * 0.55,
      shirtHex: streetShirts[i % streetShirts.length],
      skinHex: skinPalette[(i * 3) % skinPalette.length],
      hairHex: hairPalette[(i * 2) % hairPalette.length],
      hasTowel: false,
    });
  }
  const streetCrowd = createInstancedCrowd(streetGroup, streetSpecs);
  streetGroup.visible = false;

  // 3) RETRO GYM: Wood Wall + Banners + Bleacher Crowd + Jumping Bench Teammates
  const gymWall = new THREE.Mesh(
    new THREE.BoxGeometry(58, 14, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x452a18, roughness: 0.82 })
  );
  gymWall.position.set(0, 7.0, -15.5);
  retroGroup.add(gymWall);

  for (let row = 0; row < 2; row++) {
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(46, 1.3, 2.1),
      new THREE.MeshStandardMaterial({ color: row === 0 ? 0x92400e : 0xb45309, roughness: 0.8 })
    );
    tier.position.set(-2, 0.65 + row * 1.45, -13.8 - row * 1.6);
    retroGroup.add(tier);
  }

  const retroShirts = [0x991b1b, 0xfde68a, 0x1e3a8a, 0xf8fafc];
  const retroSpecs: CrowdMemberSpec[] = [];
  for (let i = 0; i < 32; i++) {
    const row = Math.floor(i / 16);
    const colIdx = i % 16;
    retroSpecs.push({
      x: -18 + colIdx * 2.1 + (row % 2) * 0.6,
      baseY: 1.9 + row * 1.45,
      z: -13.8 - row * 1.6,
      scale: 0.92 + (i % 3) * 0.04,
      phase: i * 0.5 + row * 0.6,
      shirtHex: retroShirts[(i + row) % retroShirts.length],
      skinHex: skinPalette[(i + row) % skinPalette.length],
      hairHex: hairPalette[i % hairPalette.length],
      hasTowel: false,
    });
  }
  const retroCrowd = createInstancedCrowd(retroGroup, retroSpecs);

  const bannerColors = [0xdc2626, 0x2563eb, 0xf59e0b, 0x16a34a];
  for (let b = 0; b < 4; b++) {
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 4.6, 0.12),
      new THREE.MeshStandardMaterial({ color: bannerColors[b], roughness: 0.7 })
    );
    banner.position.set(-15 + b * 10, 12.2, -14.9);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.28, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 })
    );
    trim.position.set(-15 + b * 10, 14.5, -14.9);
    retroGroup.add(banner, trim);
  }

  const benchSeat = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.55, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 })
  );
  benchSeat.position.set(-10, 0.72, -11.4);
  retroGroup.add(benchSeat);

  interface BenchMateRig {
    g: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    towel?: THREE.Mesh;
  }
  const benchTeammates: BenchMateRig[] = [];
  const armGeomBench = new THREE.CapsuleGeometry(0.08, 0.52, 4, 7);
  armGeomBench.translate(0, -0.28, 0);
  for (let t = 0; t < 6; t++) {
    const mate = new THREE.Group();
    const isCoach = t === 0;
    const mateShirtMat = new THREE.MeshStandardMaterial({
      color: isCoach ? 0x1e293b : 0xb91c1c,
      roughness: 0.55,
    });
    const mateSkinMat = new THREE.MeshStandardMaterial({
      color: skinPalette[t % skinPalette.length],
      roughness: 0.6,
    });
    const shortsM = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.44, 0.34),
      new THREE.MeshStandardMaterial({ color: isCoach ? 0x0f172a : 0x991b1b, roughness: 0.65 })
    );
    shortsM.position.y = 0.92;
    const legsM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.68, 0.26), mateSkinMat);
    legsM.position.y = 0.42;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.78, 10), mateShirtMat);
    torso.position.y = 1.52;
    torso.scale.set(1.15, 1, 0.85);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), mateSkinMat);
    head.position.y = 2.15;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.242, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.54),
      new THREE.MeshStandardMaterial({ color: hairPalette[t % hairPalette.length], roughness: 0.8 })
    );
    hair.position.set(0, 2.18, -0.02);
    hair.rotation.x = -0.18;

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.36, 1.85, 0);
    leftArm.add(new THREE.Mesh(armGeomBench, mateSkinMat));

    const rightArm = new THREE.Group();
    rightArm.position.set(0.36, 1.85, 0);
    rightArm.add(new THREE.Mesh(armGeomBench, mateSkinMat));

    let towel: THREE.Mesh | undefined;
    if (t % 2 === 1) {
      towel = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.4, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
      );
      towel.position.set(0, -0.62, 0.08);
      rightArm.add(towel);
    }

    mate.add(legsM, shortsM, torso, head, hair, leftArm, rightArm);
    mate.position.set(-16 + t * 2.4, 0, -11.4);
    retroGroup.add(mate);
    benchTeammates.push({ g: mate, leftArm, rightArm, towel });
  }
  retroGroup.visible = false;

  // -------------------------------------------------------------------------
  // Overhead Jumbotron Scoreboard (Live CanvasTexture)
  // -------------------------------------------------------------------------
  const jumboHandle = createJumbotronTexture();
  const jumboHousing = new THREE.Group();
  jumboHousing.position.set(0, 18.2, -7.2);
  const jumboBox = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 5.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.35 })
  );
  const jumboScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(10.6, 4.6),
    new THREE.MeshBasicMaterial({ map: jumboHandle.texture })
  );
  jumboScreen.position.z = 0.72;
  jumboHousing.add(jumboBox, jumboScreen);
  scene.add(jumboHousing);

  // -------------------------------------------------------------------------
  // Motorized Overhead Steel I-Beam Track + Rolling Trolley + Festoon Cable + Hoop
  // -------------------------------------------------------------------------
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.28 });
  const trackBeam = new THREE.Mesh(new THREE.BoxGeometry(36, 0.45, 0.75), steelMat);
  trackBeam.position.set(6.5, 16.4, 0);
  scene.add(trackBeam);

  // Trolley Rolling Carriage + 4 Steel Wheels + Amber Warning Strobe
  const trolleyGroup = new THREE.Group();
  const carriageBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.65, 1.05), steelMat);
  carriageBody.position.set(0, 16.0, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.15, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
  for (const wx of [-0.95, 0.95]) {
    const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
    wMesh.position.set(wx, 16.45, 0);
    trolleyGroup.add(wMesh);
  }
  const warningBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  const warningBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), warningBeaconMat);
  warningBeacon.position.set(0, 16.82, 0);
  trolleyGroup.add(carriageBody, warningBeacon);
  scene.add(trolleyGroup);

  // Flexing Festoon Power Cable connecting left truss -> trolley
  const cablePoints = new Float32Array(12 * 3);
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePoints, 3));
  const cableLine = new THREE.Line(
    cableGeo,
    new THREE.LineBasicMaterial({ color: 0x475569 })
  );
  cableLine.frustumCulled = false;
  scene.add(cableLine);

  // Hoop Assembly (Dual Hydraulic Struts + Glass Backboard + LED Frame + Rim + Hooks)
  const hoopGroup = new THREE.Group();
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.22 });
  const leftStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1, 8), strutMat);
  const rightStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1, 8), strutMat);
  hoopGroup.add(leftStrut, rightStrut);

  const backboardGroup = new THREE.Group();
  const glassPane = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 3.9, 5.6),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.34,
      roughness: 0.1,
      metalness: 0.12,
    })
  );
  // Crisp White Perimeter Frame & Shooter's Square + Orange Bottom Pad
  const borderMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const ledEdgeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.0 });
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 5.7), borderMat);
  topBar.position.y = 1.95;
  const botPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 5.75),
    new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 })
  );
  botPad.position.y = -1.95;
  const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.9, 0.14), borderMat);
  frontPost.position.z = 2.8;
  const backPost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.9, 0.14), borderMat);
  backPost.position.z = -2.8;

  // Shooter's Square on face of glass (-X)
  const sqTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.0), borderMat);
  sqTop.position.set(-0.08, 0.15, 0);
  const sqBot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.0), borderMat);
  sqBot.position.set(-0.08, -1.15, 0);
  const sqL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.38, 0.08), borderMat);
  sqL.position.set(-0.08, -0.5, -0.96);
  const sqR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.38, 0.08), borderMat);
  sqR.position.set(-0.08, -0.5, 0.96);

  // LED Goal-light rim around backboard
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.05, 5.85), ledEdgeMat);
  backboardGroup.add(glassPane, topBar, botPad, frontPost, backPost, sqTop, sqBot, sqL, sqR, ledStrip);
  hoopGroup.add(backboardGroup);

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    metalness: 0.58,
    roughness: 0.22,
  });
  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.1, 10, 26), rimMat);
  rimTorus.rotation.x = Math.PI / 2;
  // 12 metallic net hooks around rim
  const hookGeo = new THREE.SphereGeometry(0.075, 6, 6);
  const hookMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.4 });
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(Math.cos(a) * 1.56, Math.sin(a) * 1.56, 0.08);
    rimTorus.add(hook);
  }
  hoopGroup.add(rimTorus);
  scene.add(hoopGroup);

  // Dynamic 3D Rope Net Lines (full 7x12 Verlet diamond braid + rings)
  const netMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.92 });
  const netSegmentsCount = 240;
  const netPositions = new Float32Array(netSegmentsCount * 2 * 3);
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute('position', new THREE.BufferAttribute(netPositions, 3));
  const netLines = new THREE.LineSegments(netGeo, netMat);
  netLines.frustumCulled = false;
  scene.add(netLines);

  // Pebbled 3D Basketball + Custom Fireball Shader Glow
  const ballTex = createBasketballTexture();
  const ballMat = new THREE.MeshStandardMaterial({
    map: ballTex,
    roughness: 0.52,
    metalness: 0.06,
  });
  enhanceMaterialWithShaderMood(ballMat, sharedUniforms, 'hoops-ball');
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.79, 22, 18), ballMat);
  ballMesh.castShadow = !isSoftwareGl;
  scene.add(ballMesh);

  const fireballGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 14, 12),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(fireballGlow);

  // Trajectory Arc Dots & Flight Trail Dots
  const arcDots: THREE.Mesh[] = [];
  const arcGeo = new THREE.SphereGeometry(0.14, 6, 6);
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.78 });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(arcGeo, arcMat);
    m.visible = false;
    scene.add(m);
    arcDots.push(m);
  }

  const ballTrailDots: THREE.Mesh[] = [];
  const trailDotMat = new THREE.MeshBasicMaterial({ color: 0xfdba74, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(arcGeo, trailDotMat);
    m.visible = false;
    scene.add(m);
    ballTrailDots.push(m);
  }

  // Pooled 3D Confetti Strips & Chalk Smoke Puffs
  const confettiGeo = new THREE.PlaneGeometry(0.28, 0.16);
  const confettiPool: THREE.Mesh[] = [];
  for (let i = 0; i < 96; i++) {
    const m = new THREE.Mesh(
      confettiGeo,
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true })
    );
    m.visible = false;
    scene.add(m);
    confettiPool.push(m);
  }

  const smokeGeo = new THREE.SphereGeometry(1, 8, 6);
  const smokePool: THREE.Mesh[] = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(
      smokeGeo,
      new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.3, depthWrite: false })
    );
    m.visible = false;
    scene.add(m);
    smokePool.push(m);
  }

  const shooterRig = buildShooter3dGroup(sharedUniforms);
  scene.add(shooterRig.g);

  const shockwaves = createShockwavePool(scene, 5);
  const weatherSys = createWeatherSystem(300);
  scene.add(weatherSys.points);

  // Raycast Court Plane for Shooting + Free Orbit
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const playPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPt = new THREE.Vector3();

  let freeOrbitActive = false;
  let orbitYaw = 0.08;
  let orbitPitch = 0.24;
  let orbitDist = 36;
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
    orbitYaw = THREE.MathUtils.clamp(orbitYaw - (e.clientX - lastX) * 0.006, -1.4, 1.4);
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + (e.clientY - lastY) * 0.005, 0.05, 1.1);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = () => {
    rightDragging = false;
  };
  const onWheel = (e: WheelEvent) => {
    if (!freeOrbitActive) return;
    e.preventDefault();
    orbitDist = THREE.MathUtils.clamp(orbitDist * (1 + Math.sign(e.deltaY) * 0.1), 16, 62);
  };
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });

  let elapsed = 0;
  let lastDpr = -1;
  let lastShadow: boolean | null = null;
  let lastSwishId = -1;
  let lastFloorY = 636;
  let crowdCheerBoost = 0;
  const _camTarget = new THREE.Vector3();
  const _lookVec = new THREE.Vector3();

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

    clientToCourt(clientX, clientY) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(playPlane, hitPt);
      if (!hit) return { x: 400, y: 400 };
      return {
        x: hit.x / SCALE + 640,
        y: lastFloorY - hit.y / SCALE,
      };
    },

    update(params) {
      const {
        dt,
        ball,
        rimY,
        rimCenterX,
        floorY,
        rimSpring,
        shooter,
        netNodes,
        trail,
        previewArc,
        venue,
        fireballActive,
        cameraMode,
        freeOrbit,
        shaderMood,
        weather,
        budget,
        swishPulseId,
        makes = 0,
        streak = 0,
        shotClockSec = 24,
        bannerAlert = '',
        movingHoopActive = false,
        boardFlash = 0,
        goalLightFlash = 0,
        crowdExcitement = 0,
        confetti = [],
        smokePuffs = [],
        flashes = [],
        shooterMode = 'player',
      } = params;

      lastFloorY = floorY;
      freeOrbitActive = freeOrbit;
      elapsed += dt;
      if (lastShadow !== budget.shadows && !isSoftwareGl) {
        lastShadow = budget.shadows;
        renderer.shadowMap.enabled = budget.shadows;
      }

      syncSharedShaderUniforms(sharedUniforms, shaderMood, elapsed);
      floorUniforms.uIsStreet.value = venue === 'streetball' ? 1.0 : 0.0;
      floorUniforms.uTime.value = elapsed;

      // Toggle Venue Scenery Groups + Atmosphere Sky
      arenaGroup.visible = venue === 'arena';
      streetGroup.visible = venue === 'streetball';
      retroGroup.visible = venue === 'retro_gym';

      skyDome.uniforms.uTime.value = elapsed;
      if (venue === 'streetball') {
        skyDome.uniforms.uZenith.value.setHex(0x140d2a);
        skyDome.uniforms.uMid.value.setHex(0x693458);
        skyDome.uniforms.uHorizon.value.setHex(0xf59e0b);
        skyDome.uniforms.uStarAlpha.value = 0.2;
        fog.color.setHex(0x3a2038);
      } else if (venue === 'retro_gym') {
        skyDome.uniforms.uZenith.value.setHex(0x281b12);
        skyDome.uniforms.uMid.value.setHex(0x523420);
        skyDome.uniforms.uHorizon.value.setHex(0xd99b52);
        skyDome.uniforms.uStarAlpha.value = 0;
        fog.color.setHex(0x24170f);
      } else {
        skyDome.uniforms.uZenith.value.setHex(0x070d1f);
        skyDome.uniforms.uMid.value.setHex(0x162242);
        skyDome.uniforms.uHorizon.value.setHex(0x3a2e52);
        skyDome.uniforms.uStarAlpha.value = 0.4;
        fog.color.setHex(0x0b1020);
      }

      // Live Jumbotron CanvasTexture Update
      jumboHandle.update(makes, shotClockSec, streak, bannerAlert, movingHoopActive);

      // Motorized Overhead Gantry Trolley + Flexing Festoon Cable + Hoop Stanchion
      const rCx = toX(rimCenterX);
      const rCy = toY(rimY, floorY);
      const hoopAnchorX = rCx + 0.95;

      trolleyGroup.position.set(hoopAnchorX + 0.35, 0, 0);
      const strobePulse = movingHoopActive ? 0.5 + 0.5 * Math.sin(elapsed * 12) : 0.08;
      warningBeaconMat.emissiveIntensity = strobePulse * 2.2;

      // Update Festoon Power Cable curve between left anchor (-10.5, 16.2) -> trolley
      const cArr = (cableGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const startX = -10.5;
      const endX = hoopAnchorX - 0.9;
      for (let i = 0; i < 12; i++) {
        const u = i / 11;
        const cx = THREE.MathUtils.lerp(startX, endX, u);
        const sag = Math.sin(u * Math.PI) * (0.9 + Math.max(0, (12 - (endX - startX)) * 0.06));
        cArr[i * 3] = cx;
        cArr[i * 3 + 1] = 16.0 - sag;
        cArr[i * 3 + 2] = 0.35;
      }
      cableGeo.getAttribute('position').needsUpdate = true;

      hoopGroup.position.set(hoopAnchorX, 0, 0);
      rimTorus.position.set(-0.95, rCy, 0);
      rimTorus.rotation.z = rimSpring.tilt * 0.25;
      backboardGroup.position.set(0.35, rCy + 1.2, 0);

      // Dual telescopic hydraulic struts from trolley (y=15.8) down to backboard top (rCy + 3.1)
      const strutTop = 15.8;
      const strutBot = rCy + 3.1;
      const strutH = Math.max(0.5, strutTop - strutBot);
      const strutMidY = (strutTop + strutBot) * 0.5;
      leftStrut.position.set(0.35, strutMidY, -1.35);
      leftStrut.scale.set(1, strutH, 1);
      rightStrut.position.set(0.35, strutMidY, 1.35);
      rightStrut.scale.set(1, strutH, 1);

      // Glass backboard LED goal/board hit flash
      const ledIntensity = Math.max(boardFlash, goalLightFlash);
      ledEdgeMat.opacity = ledIntensity * 0.72;
      ledEdgeMat.color.setHex(goalLightFlash > 0.15 ? 0xfbbf24 : 0xef4444);

      // Update 3D Rope Net Vertices synced to 7x12 Verlet Net Nodes
      if (netNodes.length >= 84) {
        const arr = (netGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
        let ptr = 0;
        const rows = 7;
        const cols = 12;
        const idx = (r: number, c: number) => r * cols + (((c % cols) + cols) % cols);

        const pushSeg = (nA: NetNode, nB: NetNode) => {
          if (ptr + 5 >= arr.length) return;
          arr[ptr++] = toX(nA.x);
          arr[ptr++] = toY(nA.y, floorY);
          arr[ptr++] = nA.z * SCALE;
          arr[ptr++] = toX(nB.x);
          arr[ptr++] = toY(nB.y, floorY);
          arr[ptr++] = nB.z * SCALE;
        };

        for (let r = 0; r < rows - 1; r++) {
          const evenRow = r % 2 === 0;
          for (let c = 0; c < cols; c++) {
            const top = netNodes[idx(r, c)];
            const botA = netNodes[idx(r + 1, evenRow ? c : c + 1)];
            const botB = netNodes[idx(r + 1, evenRow ? c - 1 : c)];
            if (top && botA) pushSeg(top, botA);
            if (top && botB) pushSeg(top, botB);
          }
        }
        for (let r = 1; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const a = netNodes[idx(r, c)];
            const b = netNodes[idx(r, c + 1)];
            if (a && b) pushSeg(a, b);
          }
        }
        netGeo.setDrawRange(0, ptr / 3);
        netGeo.getAttribute('position').needsUpdate = true;
      }

      // Sync Shooter (Venue Kit + Articulated Jump, Knee Bend, Dribble & Release Follow-Through)
      shooterRig.setVenue(venue);
      const isPlayerVisible = shooterMode === 'player';
      shooterRig.g.visible = isPlayerVisible;
      teeRing.visible = !isPlayerVisible;

      if (isPlayerVisible) {
        shooterRig.g.position.set(toX(shooter.x), Math.max(0, shooter.yJump * SCALE), 0);
        shooterRig.g.rotation.y = shooter.facing === 1 ? 0 : Math.PI;

        const crouchDrop = shooter.crouchAmount * 0.22;
        const dribbleBounce =
          shooter.pose === 'dribble' ? Math.sin(shooter.dribblePhase * 2) * 0.04 : 0;
        shooterRig.upperBody.position.y = -crouchDrop + dribbleBounce;
        shooterRig.leftLeg.hipPivot.position.y = 1.02 - crouchDrop + dribbleBounce;
        shooterRig.rightLeg.hipPivot.position.y = 1.02 - crouchDrop + dribbleBounce;

        // Upper-arm default hangs DOWN (-Y), so positive rotation.z rotates toward +X (forward)!
        if (shooter.pose === 'jump_release') {
          const aimUp = THREE.MathUtils.clamp(-shooter.aimAngle, 0.55, 1.35);
          shooterRig.upperBody.rotation.z = 0.06;
          shooterRig.headGroup.rotation.z = 0.22;
          shooterRig.shootArmPivot.rotation.z = Math.PI * 0.5 + aimUp;
          shooterRig.forearmPivot.rotation.z = 0.14;
          shooterRig.offArmPivot.rotation.z = Math.PI * 0.5 + aimUp - 0.18;
          shooterRig.offForearmPivot.rotation.z = 0.35;
        } else if (shooter.pose === 'aim') {
          shooterRig.upperBody.rotation.z = -0.18;
          shooterRig.headGroup.rotation.z = 0.22;
          shooterRig.shootArmPivot.rotation.z = 1.05;
          shooterRig.forearmPivot.rotation.z = 1.15;
          shooterRig.offArmPivot.rotation.z = 0.92;
          shooterRig.offForearmPivot.rotation.z = 1.05;
        } else if (shooter.pose === 'celebrate') {
          const pump = Math.sin(elapsed * 14) * 0.25;
          shooterRig.upperBody.rotation.z = 0;
          shooterRig.headGroup.rotation.z = 0.08;
          shooterRig.shootArmPivot.rotation.z = 2.75 + pump;
          shooterRig.forearmPivot.rotation.z = 0.25;
          shooterRig.offArmPivot.rotation.z = 2.6 - pump;
          shooterRig.offForearmPivot.rotation.z = 0.2;
        } else {
          // Live rhythmic dribbling & running balance
          const wave = Math.abs(Math.sin(shooter.dribblePhase));
          const pushDown = 1 - wave;
          const isRun = shooter.pose === 'run';
          shooterRig.upperBody.rotation.z = isRun ? -0.22 : -0.12;
          shooterRig.headGroup.rotation.z = 0.08;
          shooterRig.shootArmPivot.rotation.z = 0.85 - pushDown * 0.32;
          shooterRig.forearmPivot.rotation.z = 0.95 - pushDown * 0.65;
          const balSwing = isRun ? Math.sin(shooter.stridePhase) * 0.45 : Math.sin(shooter.dribblePhase) * 0.12;
          shooterRig.offArmPivot.rotation.z = -0.25 - balSwing;
          shooterRig.offForearmPivot.rotation.z = 0.55;
        }

        // Leg kinematics (forward thigh lift = +rotation.z, knee bends back = -rotation.z)
        if (shooter.pose === 'jump_release' && shooter.yJump > 4) {
          const lift = Math.min(1, shooter.yJump / 48);
          shooterRig.rightLeg.hipPivot.rotation.z = 0.38 * lift;
          shooterRig.leftLeg.hipPivot.rotation.z = -0.26 * lift;
          shooterRig.rightLeg.kneePivot.rotation.z = -0.45 * lift;
          shooterRig.leftLeg.kneePivot.rotation.z = -0.35 * lift;
          shooterRig.rightLeg.anklePivot.rotation.z = -0.25 * lift;
          shooterRig.leftLeg.anklePivot.rotation.z = -0.25 * lift;
        } else if (shooter.pose === 'run') {
          const s = shooter.stridePhase;
          const lHip = Math.sin(s) * 0.58;
          const rHip = -Math.sin(s) * 0.58;
          shooterRig.leftLeg.hipPivot.rotation.z = lHip;
          shooterRig.rightLeg.hipPivot.rotation.z = rHip;
          shooterRig.leftLeg.kneePivot.rotation.z = -0.35 - Math.max(0, Math.cos(s)) * 0.55;
          shooterRig.rightLeg.kneePivot.rotation.z = -0.35 - Math.max(0, -Math.cos(s)) * 0.55;
          shooterRig.leftLeg.anklePivot.rotation.z = 0;
          shooterRig.rightLeg.anklePivot.rotation.z = 0;
        } else {
          // Athletic triple-threat stance matching crouch
          const bend = 0.25 + shooter.crouchAmount * 0.72;
          shooterRig.rightLeg.hipPivot.rotation.z = bend * 0.65 + 0.18;
          shooterRig.leftLeg.hipPivot.rotation.z = bend * 0.55 - 0.16;
          shooterRig.rightLeg.kneePivot.rotation.z = -bend * 1.15;
          shooterRig.leftLeg.kneePivot.rotation.z = -bend * 1.05;
          shooterRig.rightLeg.anklePivot.rotation.z = bend * 0.45;
          shooterRig.leftLeg.anklePivot.rotation.z = bend * 0.45;
        }
      }

      // Sync Basketball + Fireball Glow + Flight Trail
      const bx = toX(ball.x);
      const by = Math.max(0.79, toY(ball.y, floorY));
      ballMesh.visible = ball.alpha > 0.05;
      ballMesh.position.set(bx, by, 0);
      ballMesh.rotation.z = -ball.angle;

      const glowMat = fireballGlow.material as THREE.MeshBasicMaterial;
      if (fireballActive && ballMesh.visible && !budget.fastShader) {
        fireballGlow.visible = true;
        fireballGlow.position.copy(ballMesh.position);
        fireballGlow.scale.setScalar(1.0 + Math.sin(elapsed * 20) * 0.14);
        glowMat.opacity = 0.58;
        ballMat.emissive.setHex(0xea580c);
        ballMat.emissiveIntensity = 0.72;
      } else {
        fireballGlow.visible = false;
        ballMat.emissive.setHex(0x000000);
        ballMat.emissiveIntensity = 0;
      }

      for (let i = 0; i < ballTrailDots.length; i++) {
        const dot = ballTrailDots[i];
        const tp = trail[i];
        if (tp && tp.alpha > 0.05) {
          dot.visible = true;
          dot.position.set(toX(tp.x), toY(tp.y, floorY), 0);
          dot.scale.setScalar(0.55 + tp.alpha * 0.65);
        } else {
          dot.visible = false;
        }
      }

      // Swish Shockwave + Cheering Jumping Crowds (All 3 Venues!) + Retro Bench Teammates
      if (swishPulseId !== lastSwishId) {
        lastSwishId = swishPulseId;
        crowdCheerBoost = 1.0;
        shockwaves.spawn(new THREE.Vector3(rCx, rCy, 0), 0xfbbf24, 5.2);
      }
      shockwaves.update(dt);
      crowdCheerBoost = Math.max(crowdExcitement, Math.max(0, crowdCheerBoost - dt * 1.1));
      const lookBias = THREE.MathUtils.clamp((ball.x - 640) / 500, -1, 1);

      if (venue === 'arena') {
        arenaCrowd.update(elapsed, crowdCheerBoost, lookBias);
      } else if (venue === 'streetball') {
        streetCrowd.update(elapsed, crowdCheerBoost, lookBias);
      } else {
        retroCrowd.update(elapsed, crowdCheerBoost, lookBias);
        for (let t = 0; t < benchTeammates.length; t++) {
          const mate = benchTeammates[t];
          const wave = Math.sin(elapsed * 13.5 - t * 0.55);
          const waveUp = Math.max(0, wave * 0.5 + 0.5);
          const jump =
            crowdCheerBoost > 0.05
              ? 0.45 + waveUp * 1.05 * crowdCheerBoost
              : 0;
          const armZ =
            crowdCheerBoost > 0.05
              ? 2.55 + Math.sin(elapsed * 15 + t) * 0.28
              : 0.12;
          mate.g.position.y = jump;
          mate.leftArm.rotation.z = -armZ;
          mate.rightArm.rotation.z = armZ;
          if (mate.towel) {
            mate.towel.visible = crowdCheerBoost > 0.18;
          }
        }
      }

      for (let i = 0; i < flashPool.length; i++) {
        const sp = flashPool[i];
        const fl = flashes[i];
        if (venue === 'arena' && fl && fl.life > 0) {
          sp.visible = true;
          sp.position.set(toX(fl.x), Math.max(1.2, toY(fl.y, floorY)), -13.5);
          const sc = (fl.radius * SCALE * 3.8) * (fl.life / Math.max(0.01, fl.maxLife));
          sp.scale.set(sc, sc, 1);
          (sp.material as THREE.SpriteMaterial).opacity = Math.min(1, (fl.life / Math.max(0.01, fl.maxLife)) * 1.2);
        } else {
          sp.visible = false;
        }
      }

      // 3D Tumbling Confetti Strips & Chalk Smoke Puffs
      const confCap = budget.fastShader ? 22 : confettiPool.length;
      for (let i = 0; i < confettiPool.length; i++) {
        const m = confettiPool[i];
        const c = confetti[i];
        if (c && i < confCap && c.life > 0) {
          m.visible = true;
          m.position.set(toX(c.x), Math.max(0.08, toY(c.y, floorY)), ((i % 7) - 3) * 0.25);
          m.rotation.set(c.flipPhase, c.rot * 0.7, -c.rot);
          m.scale.set(c.w * 0.14, c.h * 0.16, 1);
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.set(c.color);
          mat.opacity = Math.min(1, c.life / Math.max(0.01, c.maxLife) * 1.4);
        } else {
          m.visible = false;
        }
      }

      const smokeCap = budget.fastShader ? 14 : smokePool.length;
      for (let i = 0; i < smokePool.length; i++) {
        const m = smokePool[i];
        const s = smokePuffs[i];
        if (s && i < smokeCap && s.life > 0) {
          m.visible = true;
          m.position.set(toX(s.x), Math.max(0.2, toY(s.y, floorY)), ((i % 3) - 1) * 0.35);
          m.scale.setScalar(s.radius * SCALE * 1.35);
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.set(s.tint);
          mat.opacity = s.alpha * (s.life / Math.max(0.01, s.maxLife));
        } else {
          m.visible = false;
        }
      }

      // Preview Arc Dots
      for (let i = 0; i < arcDots.length; i++) {
        const dot = arcDots[i];
        const pt = previewArc[i];
        if (pt) {
          dot.visible = true;
          dot.position.set(toX(pt.x), toY(pt.y, floorY), 0);
        } else {
          dot.visible = false;
        }
      }

      // 3D Camera Modes + Free Orbit
      const sX = toX(shooter.x);
      if (freeOrbit) {
        _camTarget.set(
          Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitDist,
          Math.max(2, Math.sin(orbitPitch) * orbitDist + 4),
          Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitDist
        );
        _lookVec.set(1.5, 5.8, 0);
      } else if (cameraMode === 'sideline') {
        _camTarget.set(-2.0, 7.6, 35);
        _lookVec.set(2.5, 6.0, 0);
      } else if (cameraMode === 'shooter') {
        _camTarget.set(sX - 7.5, 6.2, 10.5);
        _lookVec.set(rCx, rCy - 1.0, 0);
      } else if (cameraMode === 'overhead') {
        _camTarget.set(rCx - 6, 22, 22);
        _lookVec.set(rCx - 4, 5.5, 0);
      } else {
        // baseline broadcast
        _camTarget.set(-14.5, 9.2, 26.5);
        _lookVec.set(rCx - 3.5, 6.4, 0);
      }

      const damp = 1 - Math.exp(-5.5 * dt);
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
      courtFloor.geometry.dispose();
      courtMat.dispose();
      ballTex.dispose();
      chainTex.dispose();
      flashTex.dispose();
      jumboHandle.dispose();
      shooterRig.dispose();
      confettiGeo.dispose();
      smokeGeo.dispose();
      envTex.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    },
  };
}
