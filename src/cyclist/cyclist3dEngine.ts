import * as THREE from 'three';
import type { SceneRenderBudget } from '../utils/hardwareProfile';
import {
  createSharedShaderUniforms,
  createSkyDomeMesh,
  createStudioEnvironment,
  createWeatherSystem,
  detectSoftwareWebGL,
  enhanceMaterialWithShaderMood,
  syncSharedShaderUniforms,
  type ShaderMood,
  type WeatherFx,
} from '../utils/threeShaders';
import { createSoftCloudTexture, createSunHaloTexture } from '../utils/threeTextures';
import { computeBiomeWeights, type BiomeMode } from './ruralWorld';

export type CyclistCameraView = 'chase' | 'side' | 'pov' | 'drone';

export interface Cyclist3dUpdateParams {
  dt: number;
  speedMult: number;
  phase: number;
  biomeMode: BiomeMode;
  tourProgress: number;
  wheelieFactor: number;
  cameraView: CyclistCameraView;
  freeOrbit: boolean;
  gravityScale: number;
  shaderMood: ShaderMood;
  weather: WeatherFx;
  showWindStreaks: boolean;
  budget: SceneRenderBudget;
}

export interface Cyclist3dEngine {
  update: (params: Cyclist3dUpdateParams) => { activeBiomeLabel: string };
  resize: (width: number, height: number, dpr: number) => void;
  dispose: () => void;
}

interface BiomeVisuals {
  label: string;
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  road: THREE.Color;
}

const BIOME_COLORS: Record<Exclude<BiomeMode, 'usa-tour'>, BiomeVisuals> = {
  mountains: {
    label: 'Rocky Mountains',
    zenith: new THREE.Color(0x0c2142),
    mid: new THREE.Color(0x2f6a99),
    horizon: new THREE.Color(0xf4aa68),
    ground: new THREE.Color(0x366039),
    road: new THREE.Color(0x292d38),
  },
  desert: {
    label: 'Southwest Canyon',
    zenith: new THREE.Color(0x25144a),
    mid: new THREE.Color(0x8c3c5a),
    horizon: new THREE.Color(0xf9904c),
    ground: new THREE.Color(0xb6673d),
    road: new THREE.Color(0x332b29),
  },
  homes: {
    label: 'American Homes',
    zenith: new THREE.Color(0x0a132c),
    mid: new THREE.Color(0x283e6e),
    horizon: new THREE.Color(0xe6846a),
    ground: new THREE.Color(0x2f533a),
    road: new THREE.Color(0x232734),
  },
};

function roadHeightAt(zWorld: number): number {
  return Math.sin(zWorld * 0.032) * 1.9 + Math.cos(zWorld * 0.013) * 1.1;
}

function roadSlopeAt(zWorld: number): number {
  return (
    Math.cos(zWorld * 0.032) * 1.9 * 0.032 -
    Math.sin(zWorld * 0.013) * 1.1 * 0.013
  );
}

// 2D IK Solver in local bike (Z, Y) plane: bike rides toward -Z, UP is +Y.
// Knee bends forward (-Z) and upward (+Y).
function solveLegIK3D(
  hipY: number,
  hipZ: number,
  ankleY: number,
  ankleZ: number,
  L1: number,
  L2: number
): { kneeY: number; kneeZ: number } {
  const dz = ankleZ - hipZ;
  const dy = ankleY - hipY;
  const rawD = Math.hypot(dz, dy) || 0.001;
  const d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.01, rawD));
  const uz = dz / rawD;
  const uy = dy / rawD;
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // For downward leg vector (uz, uy) ≈ (0, -1), (uy, -uz) ≈ (-1, 0) bends the knee forward (-Z).
  return {
    kneeZ: hipZ + a * uz + h * uy,
    kneeY: hipY + a * uy - h * uz,
  };
}

function buildCyclistAndBikeGroup(
  shared: ReturnType<typeof createSharedShaderUniforms>,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
) {
  const root = new THREE.Group();

  // Materials matched 1:1 to 2D Coastline Tour cyclistIK palette
  const matFrame = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd6473a, metalness: 0.42, roughness: 0.28 })
  ); // Crimson main triangle (#d6473a)
  const matRearFrame = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2c3446, metalness: 0.45, roughness: 0.36 })
  ); // Slate rear triangle (#2c3446)
  const matFork = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x252b3b, metalness: 0.45, roughness: 0.34 })
  ); // Carbon fork (#252b3b)
  const matCarbon = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1b1f29, metalness: 0.48, roughness: 0.38 })
  );
  const matAlloy = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcfd6e6, metalness: 0.82, roughness: 0.22 })
  );
  const matTire = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: 0.05, roughness: 0.84 })
  );
  const matTanWall = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd99a5b, roughness: 0.72 })
  );
  const matSkin = trackMat(new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 0.56 }));
  const matJersey = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x243554, roughness: 0.48 })
  ); // Deep pro navy jersey (#243554)
  const matJerseySleeve = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2f456e, roughness: 0.46 })
  ); // Navy sleeve (#2f456e)
  const matJerseyStripe = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe86a4a, roughness: 0.42 })
  ); // Coral/crimson spine stripe (#e86a4a)
  const matBib = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e2433, roughness: 0.68 }));
  const matCrimsonAccent = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe05b47, roughness: 0.42 })
  ); // Gripper band, helmet vent, BOA dial, bidon stripe (#e05b47)
  const matHelmet = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf3f5fa, metalness: 0.22, roughness: 0.24 })
  );
  const matSock = trackMat(new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 0.65 }));
  const matShoe = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xeef1f7, metalness: 0.14, roughness: 0.36 })
  );
  const matVisor = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x182236,
      metalness: 0.86,
      roughness: 0.14,
    })
  );
  const matVisorRim = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf6c87e,
      metalness: 0.65,
      roughness: 0.25,
    })
  );
  const matBottle = trackMat(new THREE.MeshStandardMaterial({ color: 0xe8ecf5, roughness: 0.38 }));

  enhanceMaterialWithShaderMood(matFrame, shared, 'cyc-frame');
  enhanceMaterialWithShaderMood(matJersey, shared, 'cyc-jersey');

  const tireGeo = trackGeo(new THREE.TorusGeometry(0.37, 0.044, 10, 28));
  const rimGeo = trackGeo(new THREE.TorusGeometry(0.325, 0.022, 8, 28));
  const tanWallGeo = trackGeo(new THREE.TorusGeometry(0.348, 0.012, 6, 24));
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 10));
  const rotorGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 16));
  const spokeGeo = trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.65, 4));
  const valveGeo = trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6));

  const makeWheel = () => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, matTire);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, matCarbon);
    rim.rotation.y = Math.PI / 2;
    const tan = new THREE.Mesh(tanWallGeo, matTanWall);
    tan.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(hubGeo, matAlloy);
    hub.rotation.z = Math.PI / 2;
    const rotor = new THREE.Mesh(rotorGeo, matAlloy);
    rotor.rotation.z = Math.PI / 2;
    rotor.position.x = -0.045;
    const valve = new THREE.Mesh(valveGeo, matFrame);
    valve.position.set(0, 0.29, 0);
    wg.add(tire, rim, tan, hub, rotor, valve);
    for (let s = 0; s < 6; s++) {
      const spoke = new THREE.Mesh(spokeGeo, matAlloy);
      spoke.rotation.x = (s / 6) * Math.PI;
      spoke.position.x = s % 2 === 0 ? 0.014 : -0.014;
      wg.add(spoke);
    }
    return wg;
  };

  const rearWheel = makeWheel();
  rearWheel.position.set(0, 0.37, 0.58);
  root.add(rearWheel);

  // Bike pivot at rear hub for wheelies
  const wheeliePivot = new THREE.Group();
  wheeliePivot.position.set(0, 0.37, 0.58);
  root.add(wheeliePivot);

  const frontWheel = makeWheel();
  frontWheel.position.set(0, 0, -1.16);
  wheeliePivot.add(frontWheel);

  const _upAxis = new THREE.Vector3(0, 1, 0);
  const addSegmentBetween = (
    parent: THREE.Object3D,
    p1: [number, number, number],
    p2: [number, number, number],
    r1: number,
    r2: number,
    mat: THREE.Material,
    radialSegments = 8
  ) => {
    const a = new THREE.Vector3(...p1);
    const b = new THREE.Vector3(...p2);
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(r1, r2, len, radialSegments)),
      mat
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(_upAxis, b.clone().sub(a).normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Diamond Road Frame (rear hub = (0,0,0), BB = (0,-0.03,-0.44), front hub = (0,0,-1.16))
  addSegmentBetween(wheeliePivot, [-0.04, 0, 0], [-0.02, -0.03, -0.44], 0.015, 0.018, matRearFrame);
  addSegmentBetween(wheeliePivot, [0.04, 0, 0], [0.02, -0.03, -0.44], 0.015, 0.018, matRearFrame);
  addSegmentBetween(wheeliePivot, [-0.035, 0, 0], [-0.015, 0.47, -0.28], 0.013, 0.015, matRearFrame);
  addSegmentBetween(wheeliePivot, [0.035, 0, 0], [0.015, 0.47, -0.28], 0.013, 0.015, matRearFrame);
  addSegmentBetween(wheeliePivot, [0, -0.03, -0.44], [0, 0.48, -0.28], 0.024, 0.024, matFrame); // seat tube
  addSegmentBetween(wheeliePivot, [0, -0.03, -0.44], [0, 0.45, -0.89], 0.03, 0.034, matFrame); // down tube
  addSegmentBetween(wheeliePivot, [0, 0.48, -0.28], [0, 0.54, -0.92], 0.023, 0.026, matFrame); // top tube
  addSegmentBetween(wheeliePivot, [0, 0.42, -0.88], [0, 0.61, -0.95], 0.027, 0.027, matFrame); // head tube
  addSegmentBetween(wheeliePivot, [-0.042, 0, -1.16], [0, 0.43, -0.89], 0.018, 0.023, matFork); // fork L
  addSegmentBetween(wheeliePivot, [0.042, 0, -1.16], [0, 0.43, -0.89], 0.018, 0.023, matFork); // fork R
  addSegmentBetween(wheeliePivot, [0, 0.48, -0.28], [0, 0.59, -0.25], 0.017, 0.017, matCarbon); // seatpost

  // Drivetrain chain lines (top & bottom chain runs from chainring to cassette)
  addSegmentBetween(wheeliePivot, [0.055, 0.03, 0], [0.065, 0.08, -0.44], 0.005, 0.005, matAlloy, 5);
  addSegmentBetween(wheeliePivot, [0.055, -0.03, 0], [0.065, -0.14, -0.44], 0.005, 0.005, matAlloy, 5);

  // White bidon water bottle with crimson stripe in frame triangle
  const bottleGroup = new THREE.Group();
  bottleGroup.position.set(0, 0.22, -0.62);
  bottleGroup.rotation.x = 0.72;
  const bottle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 10)),
    matBottle
  );
  const bottleBand = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 10)),
    matCrimsonAccent
  );
  bottleBand.position.y = 0.015;
  bottleGroup.add(bottle, bottleBand);
  wheeliePivot.add(bottleGroup);

  // Saddle & Drop Handlebars + Brake Hoods (hood grips at [±0.21, 0.66, -1.06])
  const saddle = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.14, 0.048, 0.26)),
    matCarbon
  );
  saddle.position.set(0, 0.60, -0.24);
  addSegmentBetween(wheeliePivot, [0, 0.60, -0.945], [0, 0.64, -1.03], 0.018, 0.018, matCarbon); // stem
  const barTop = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8)),
    matCarbon
  );
  barTop.rotation.z = Math.PI / 2;
  barTop.position.set(0, 0.64, -1.03);
  wheeliePivot.add(saddle, barTop);

  for (const xSide of [-0.21, 0.21]) {
    const hood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.065, 0.1)), matCarbon);
    hood.position.set(xSide, 0.665, -1.07);
    const drop = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.068, 0.015, 6, 12, Math.PI * 1.15)),
      matCarbon
    );
    drop.rotation.y = Math.PI / 2;
    drop.position.set(xSide, 0.575, -1.04);
    wheeliePivot.add(hood, drop);
  }

  // Headlight + Volumetric Ground Beam + Rear Blinking Taillight
  const lamp = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.05, 10, 8)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }))
  );
  lamp.position.set(0, 0.61, -1.07);
  const beamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const beamCone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.15, 6.5, 14, 1, true)), beamMat);
  beamCone.position.set(0, 0.12, -4.2);
  beamCone.rotation.x = -Math.PI / 2 + 0.15;
  const tailMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xff2a4b }));
  const tailLight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 8, 6)), tailMat);
  tailLight.position.set(0, 0.58, -0.11);
  wheeliePivot.add(lamp, beamCone, tailLight);

  // Rotating Chainring, Cranks & Level Pedals (centered at BB = [0, -0.03, -0.44])
  const crankR = 0.165;
  const crankGroup = new THREE.Group();
  crankGroup.position.set(0, -0.03, -0.44);
  const chainring = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.11, 0.012, 6, 20)),
    matCarbon
  );
  chainring.rotation.y = Math.PI / 2;
  chainring.position.x = 0.065;
  crankGroup.add(chainring);
  for (let arm = 0; arm < 5; arm++) {
    const spider = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.105, 0.018)), matAlloy);
    spider.position.set(
      0.065,
      Math.cos((arm / 5) * Math.PI * 2) * 0.052,
      Math.sin((arm / 5) * Math.PI * 2) * 0.052
    );
    spider.rotation.x = (arm / 5) * Math.PI * 2;
    crankGroup.add(spider);
  }
  const crankArmL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, crankR, 0.032)), matAlloy);
  crankArmL.position.set(-0.085, crankR * 0.5, 0);
  const crankArmR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, crankR, 0.032)), matAlloy);
  crankArmR.position.set(0.085, -crankR * 0.5, 0);

  const pedalGeo = trackGeo(new THREE.BoxGeometry(0.085, 0.024, 0.11));
  const leftPedal = new THREE.Mesh(pedalGeo, matCarbon);
  leftPedal.position.set(-0.115, crankR, 0);
  const rightPedal = new THREE.Mesh(pedalGeo, matCarbon);
  rightPedal.position.set(0.115, -crankR, 0);
  crankGroup.add(crankArmL, crankArmR, leftPedal, rightPedal);
  wheeliePivot.add(crankGroup);

  // -------------------------------------------------------------------------
  // Anatomically Locked 3D Cyclist Rig (every joint connected A -> B!)
  // Pelvis sits on saddle at (0, 0.64, -0.24), leans forward (-Z) to shoulders
  // -------------------------------------------------------------------------
  const torsoGroup = new THREE.Group();
  // Anchor torsoGroup at hip/saddle pivot so leaning rock rotates smoothly around saddle
  torsoGroup.position.set(0, 0.64, -0.24);
  wheeliePivot.add(torsoGroup);

  // Local coordinates relative to torsoGroup (hip = [0, 0, 0]):
  const hipL: [number, number, number] = [-0.075, 0.0, 0];
  const hipR: [number, number, number] = [0.075, 0.0, 0];
  const waistPt: [number, number, number] = [0, 0.09, -0.09];
  const chestPt: [number, number, number] = [0, 0.25, -0.27];
  const shoulderCenter: [number, number, number] = [0, 0.37, -0.43];
  const neckTop: [number, number, number] = [0, 0.45, -0.48];

  // Pelvis shorts seat
  const pelvis = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.115, 12, 10)), matBib);
  pelvis.scale.set(1.18, 0.85, 1.05);
  torsoGroup.add(pelvis);

  // Sculpted tapered abdomen -> pro navy aero jersey -> coral racing stripe across spine/chest
  addSegmentBetween(torsoGroup, [0, 0.02, -0.01], waistPt, 0.105, 0.115, matBib, 10);
  addSegmentBetween(torsoGroup, waistPt, chestPt, 0.12, 0.142, matJersey, 10);
  addSegmentBetween(torsoGroup, chestPt, shoulderCenter, 0.142, 0.132, matJersey, 10);
  // Coral chest/spine stripe matching 2D pro jersey accent
  addSegmentBetween(torsoGroup, [0, 0.11, -0.09], [0, 0.38, -0.40], 0.058, 0.052, matJerseyStripe, 8);
  // Shoulder bar bridging left and right shoulder sockets
  addSegmentBetween(torsoGroup, [-0.155, 0.37, -0.43], [0.155, 0.37, -0.43], 0.065, 0.065, matJersey, 8);

  // Neck + Head looking forward (-Z) + White/Crimson Vented Aero Helmet + Dark/Gold Sunglasses
  addSegmentBetween(torsoGroup, shoulderCenter, neckTop, 0.048, 0.044, matSkin, 8);
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.52, -0.52);
  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.112, 14, 12)), matSkin);
  head.castShadow = true;

  const helmet = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54)),
    matHelmet
  );
  helmet.position.set(0, 0.024, 0.016);
  helmet.rotation.x = 0.14;
  helmet.scale.set(1.0, 0.92, 1.24); // elongated front-to-back aero profile matching 2D helmet
  const helmetVent = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, 0.028, 0.17)),
    matCrimsonAccent
  );
  helmetVent.position.set(0, 0.115, 0.015);
  helmetVent.rotation.x = 0.18;

  const sunglasses = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.048, 0.078)), matVisor);
  sunglasses.position.set(0, 0.015, -0.095);
  const glassRim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.184, 0.014, 0.082)), matVisorRim);
  glassRim.position.set(0, 0.036, -0.095);
  headGroup.add(head, helmet, helmetVent, sunglasses, glassRim);
  torsoGroup.add(headGroup);

  // Joint-to-joint Arms: navy jersey short sleeve -> bare skin forearm -> dark fingerless glove on brake hood
  for (const side of [-1, 1] as const) {
    const shPt: [number, number, number] = [side * 0.16, 0.37, -0.43];
    const sleeveEndPt: [number, number, number] = [side * 0.185, 0.25, -0.54];
    const elPt: [number, number, number] = [side * 0.20, 0.17, -0.62];
    const handPt: [number, number, number] = [side * 0.21, 0.025, -0.83];

    const shCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.056, 8, 8)), matJerseySleeve);
    shCap.position.set(...shPt);
    const elCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.039, 8, 8)), matSkin);
    elCap.position.set(...elPt);
    const glove = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.044, 8, 8)), matCarbon);
    glove.position.set(...handPt);

    addSegmentBetween(torsoGroup, shPt, sleeveEndPt, 0.049, 0.044, matJerseySleeve, 8);
    addSegmentBetween(torsoGroup, sleeveEndPt, elPt, 0.042, 0.038, matSkin, 8);
    addSegmentBetween(torsoGroup, elPt, handPt, 0.037, 0.031, matSkin, 8);
    torsoGroup.add(shCap, elCap, glove);
  }
  void hipL;
  void hipR;

  // Articulated 2-Bone IK Legs matched to 2D: bib shorts + crimson gripper band -> bare thigh/knee/calf -> white aero sock -> white BOA cycling shoe
  const makeLeg = (xOffset: number) => {
    const thighLen = 0.45;
    const shinLen = 0.44;
    const bibLen = thighLen * 0.56;
    const bareThighLen = thighLen - bibLen;

    const thighPivot = new THREE.Group();
    thighPivot.position.set(xOffset, 0.64, -0.24);

    const bibGeo = trackGeo(new THREE.CylinderGeometry(0.066, 0.055, bibLen, 10));
    bibGeo.translate(0, -bibLen * 0.5, 0);
    const bibMesh = new THREE.Mesh(bibGeo, matBib);
    bibMesh.castShadow = true;

    const gripperGeo = trackGeo(new THREE.CylinderGeometry(0.056, 0.056, 0.026, 10));
    const gripperBand = new THREE.Mesh(gripperGeo, matCrimsonAccent);
    gripperBand.position.y = -bibLen;

    const bareThighGeo = trackGeo(new THREE.CylinderGeometry(0.053, 0.046, bareThighLen, 10));
    bareThighGeo.translate(0, -bibLen - bareThighLen * 0.5, 0);
    const bareThighMesh = new THREE.Mesh(bareThighGeo, matSkin);
    bareThighMesh.castShadow = true;

    const kneeMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.047, 8, 8)), matSkin);
    kneeMesh.position.y = -thighLen;

    const shinPivot = new THREE.Group();
    shinPivot.position.y = -thighLen;
    const calfLen = shinLen * 0.66;
    const sockLen = shinLen - calfLen;
    const shinGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.034, calfLen, 10));
    shinGeo.translate(0, -calfLen * 0.5, 0);
    const shinMesh = new THREE.Mesh(shinGeo, matSkin);
    const sockGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.033, sockLen, 8));
    sockGeo.translate(0, -calfLen - sockLen * 0.5, 0);
    const sock = new THREE.Mesh(sockGeo, matSock);

    // Aerodynamic cycling shoe with dark carbon sole + crimson BOA dial
    const anklePivot = new THREE.Group();
    anklePivot.position.y = -shinLen;
    const shoeUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.084, 0.052, 0.21)), matShoe);
    shoeUpper.position.set(0, -0.015, -0.055);
    const shoeSole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.088, 0.018, 0.215)), matCarbon);
    shoeSole.position.set(0, -0.045, -0.055);
    const boaDial = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.018, 8)), matCrimsonAccent);
    boaDial.rotation.z = Math.PI / 2;
    boaDial.position.set(Math.sign(xOffset) * 0.044, -0.008, -0.035);
    anklePivot.add(shoeUpper, shoeSole, boaDial);

    shinPivot.add(shinMesh, sock, anklePivot);
    thighPivot.add(bibMesh, gripperBand, bareThighMesh, kneeMesh, shinPivot);
    wheeliePivot.add(thighPivot);
    return { thighPivot, shinPivot, anklePivot, thighLen, shinLen };
  };

  const leftLeg = makeLeg(-0.115);
  const rightLeg = makeLeg(0.115);

  return {
    root,
    wheeliePivot,
    frontWheel,
    rearWheel,
    crankGroup,
    leftPedal,
    rightPedal,
    torsoGroup,
    tailMat,
    beamCone,
    leftLeg,
    rightLeg,
  };
}

export function createCyclist3dEngine(container: HTMLElement): Cyclist3dEngine {
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

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x88b0c4, 0.0085);

  const camera = new THREE.PerspectiveCamera(
    56,
    (container.clientWidth || 1280) / Math.max(1, container.clientHeight || 720),
    0.2,
    540
  );

  const envTex = createStudioEnvironment(renderer, scene);
  const sharedUniforms = createSharedShaderUniforms('standard');

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x28362a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdfb0, 2.35);
  sun.position.set(28, 42, -55);
  sun.castShadow = !isSoftwareGl;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  const skyDome = createSkyDomeMesh({ radius: 380, showStars: true });
  scene.add(skyDome.mesh);

  // Glowing 3D Sunset Sun + Rotating Halo & Drifting Sunset Cloud Sprites
  const haloTex = createSunHaloTexture();
  const cloudTex = createSoftCloudTexture();
  textures.push(haloTex, cloudTex);

  const sunDisc = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(14, 18, 14)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfff5d4, fog: false }))
  );
  sunDisc.position.set(42, 34, -220);
  scene.add(sunDisc);

  const sunHalo = new THREE.Sprite(
    trackMat(
      new THREE.SpriteMaterial({
        map: haloTex,
        color: 0xffc66e,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    )
  );
  sunHalo.position.copy(sunDisc.position);
  sunHalo.scale.set(95, 95, 1);
  scene.add(sunHalo);

  const clouds: Array<{ sprite: THREE.Sprite; baseX: number; speed: number; z: number; y: number }> = [];
  const cloudMat = trackMat(
    new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0xffd7c2,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      fog: false,
    })
  );
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(cloudMat);
    const bx = -140 + i * 32;
    const by = 32 + (i % 3) * 11;
    const bz = -150 - (i % 4) * 24;
    sp.position.set(bx, by, bz);
    sp.scale.set(42 + (i % 3) * 14, 18 + (i % 2) * 6, 1);
    scene.add(sp);
    clouds.push({ sprite: sp, baseX: bx, speed: 0.75 + (i % 3) * 0.4, z: bz, y: by });
  }

  // Dynamic scrolling 3D road & undulating hillside ribbon
  const segX = 28;
  const segZ = 76;
  const terrainGeo = trackGeo(new THREE.PlaneGeometry(160, 230, segX, segZ));
  terrainGeo.rotateX(-Math.PI / 2);

  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.06,
    })
  );
  enhanceMaterialWithShaderMood(terrainMat, sharedUniforms, 'cyc-terrain');
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // Valley Alpine Lake strip (visible when Mountains biome active)
  const lakeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x255b78,
      roughness: 0.14,
      metalness: 0.72,
      transparent: true,
      opacity: 0.88,
    })
  );
  const lakeMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(34, 210)), lakeMat);
  lakeMesh.rotation.x = -Math.PI / 2;
  lakeMesh.position.set(-28, -0.4, -72);
  scene.add(lakeMesh);

  // Road centerline dashes (InstancedMesh)
  const dashGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.03, 2.4));
  const dashMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const dashCount = 26;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  dashes.frustumCulled = false;
  scene.add(dashes);

  // Distant Snow-Capped Mountain Peaks & Desert Terracotta Mesas / Arch
  const mountainHorizonGroup = new THREE.Group();
  const rockPeakMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b4d66, roughness: 0.92 }));
  const snowCapMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xeef6ff, roughness: 0.7 }));
  for (let i = 0; i < 12; i++) {
    const pk = new THREE.Group();
    const h = 34 + (i % 4) * 13;
    const r = 20 + (i % 3) * 8;
    const base = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(r, h, 7)), rockPeakMat);
    base.position.y = h * 0.5;
    const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(r * 0.36, h * 0.36, 7)), snowCapMat);
    cap.position.y = h * 0.83;
    pk.add(base, cap);
    pk.position.set(-140 + i * 26, -2, -165 - (i % 2) * 25);
    mountainHorizonGroup.add(pk);
  }
  scene.add(mountainHorizonGroup);

  const desertHorizonGroup = new THREE.Group();
  const mesaMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xa1482c, roughness: 0.9 }));
  for (let i = 0; i < 8; i++) {
    const wTop = 14 + (i % 3) * 7;
    const h = 18 + (i % 3) * 8;
    const mesa = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(wTop, wTop * 1.45, h, 8)),
      mesaMat
    );
    mesa.position.set(-115 + i * 34, h * 0.42, -145 - (i % 2) * 20);
    desertHorizonGroup.add(mesa);
  }
  // Natural Sandstone Arch on right canyon ridge
  const arch = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(13, 3.4, 8, 16, Math.PI)),
    mesaMat
  );
  arch.position.set(58, 2, -125);
  arch.rotation.y = -0.35;
  desertHorizonGroup.add(arch);
  scene.add(desertHorizonGroup);

  // ── Multi-Part Biome Scenery Pools ──
  // 1) Multi-tier Alpine Pine Trees (18 rich layered pines)
  const pineGroup = new THREE.Group();
  const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b281d, roughness: 0.9 }));
  const pineDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1b472b, roughness: 0.85 }));
  const pineSnowMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x26613b, roughness: 0.82 }));
  enhanceMaterialWithShaderMood(pineDarkMat, sharedUniforms, 'cyc-pine');
  const pines: Array<{ g: THREE.Group; x: number; z: number; scale: number }> = [];
  for (let i = 0; i < 18; i++) {
    const pg = new THREE.Group();
    const tr = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 7)), trunkMat);
    tr.position.y = 0.9;
    const c1 = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.5, 2.6, 8)), pineDarkMat);
    c1.position.y = 2.4;
    const c2 = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.18, 2.3, 8)), pineSnowMat);
    c2.position.y = 3.6;
    const c3 = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.82, 1.9, 8)), pineSnowMat);
    c3.position.y = 4.7;
    pg.add(tr, c1, c2, c3);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (6.2 + ((i * 7) % 19));
    const z = -i * 11 + 18;
    const scale = 0.85 + (i % 4) * 0.22;
    pineGroup.add(pg);
    pines.push({ g: pg, x, z, scale });
  }
  scene.add(pineGroup);

  // 2) Multi-Armed Saguaro Cacti + Sagebrush (16 detailed saguaros)
  const cactusGroup = new THREE.Group();
  const saguaroMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3f6b32, roughness: 0.76 }));
  const sageMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x62733e, roughness: 0.9 }));
  enhanceMaterialWithShaderMood(saguaroMat, sharedUniforms, 'cyc-cactus');
  const cacti: Array<{ g: THREE.Group; x: number; z: number; scale: number }> = [];
  for (let i = 0; i < 16; i++) {
    const cg = new THREE.Group();
    const main = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.32, 3.2, 6, 10)), saguaroMat);
    main.position.y = 1.9;
    cg.add(main);
    // Left arm
    const armL = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.22, 1.25, 5, 8)), saguaroMat);
    armL.position.set(-0.62, 2.15, 0);
    armL.rotation.z = 0.25;
    const elbowL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.22, 0.72, 7)), saguaroMat);
    elbowL.rotation.z = Math.PI / 2;
    elbowL.position.set(-0.34, 1.65, 0);
    cg.add(armL, elbowL);
    // Right arm
    if (i % 3 !== 0) {
      const armR = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.2, 1.05, 5, 8)), saguaroMat);
      armR.position.set(0.58, 2.6, 0);
      armR.rotation.z = -0.22;
      const elbowR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.2, 0.65, 7)), saguaroMat);
      elbowR.rotation.z = Math.PI / 2;
      elbowR.position.set(0.32, 2.15, 0);
      cg.add(armR, elbowR);
    }
    const sage = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.65, 8, 6)), sageMat);
    sage.scale.set(1.2, 0.55, 1.0);
    sage.position.set(1.3, 0.22, 0.6);
    cg.add(sage);

    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (6.4 + ((i * 11) % 20));
    const z = -i * 12 + 18;
    const scale = 0.85 + (i % 3) * 0.22;
    cactusGroup.add(cg);
    cacti.push({ g: cg, x, z, scale });
  }
  scene.add(cactusGroup);

  // 3) Multi-Part Craftsman Suburban Homes & Streetlamps
  const homesGroup = new THREE.Group();
  const housePalettes = [
    { wall: 0xe2dcd1, roof: 0x475569, door: 0xb45309 },
    { wall: 0x89a3b2, roof: 0x334155, door: 0x991b1b },
    { wall: 0xa84737, roof: 0x3f2e26, door: 0x78350f },
    { wall: 0x8fa387, roof: 0x374151, door: 0xb45309 },
  ];
  const roofMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82 }));
  const chimneyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c3329, roughness: 0.9 }));
  const windowGlowMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfde68a }));
  const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 }));
  const homes: Array<{ g: THREE.Group; x: number; z: number; facing: number }> = [];

  for (let i = 0; i < 10; i++) {
    const pal = housePalettes[i % housePalettes.length];
    const hg = new THREE.Group();
    const wallMat = trackMat(new THREE.MeshStandardMaterial({ color: pal.wall, roughness: 0.82 }));
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.8, 3.1, 4.6)), wallMat);
    body.position.y = 1.55;
    body.castShadow = !isSoftwareGl;
    // Pitched roof (4-sided pyramid stretched)
    const roof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(4.3, 2.3, 4)), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.2;
    // Brick chimney
    const chimney = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 1.8, 0.6)), chimneyMat);
    chimney.position.set(1.5, 4.3, -1.0);
    // Front porch overhang + pillars
    const porchRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 0.22, 1.5)), roofMat);
    porchRoof.position.set(-1.1, 2.2, 2.65);
    for (const px of [-2.4, 0.2]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 6)), trimMat);
      col.position.set(px, 1.05, 3.25);
      hg.add(col);
    }
    // Glowing twilight front windows + door
    for (const wx of [0.9, 2.1]) {
      const win = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.85, 0.95)), windowGlowMat);
      win.position.set(wx, 1.75, 2.32);
      hg.add(win);
    }
    const door = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.75, 1.55, 0.12)),
      trackMat(new THREE.MeshStandardMaterial({ color: pal.door, roughness: 0.65 }))
    );
    door.position.set(-1.1, 0.8, 2.32);
    // Leafy backyard shade tree
    const shadeTrunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.24, 2.2, 6)), trunkMat);
    shadeTrunk.position.set(-3.9, 1.1, -0.5);
    const shadeCrown = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1.45, 9, 8)), pineSnowMat);
    shadeCrown.position.set(-3.9, 2.9, -0.5);
    hg.add(body, roof, chimney, porchRoof, door, shadeTrunk, shadeCrown);

    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (9.5 + (i % 2) * 3.2);
    const z = -i * 19 + 15;
    const facing = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    hg.rotation.y = facing;
    homesGroup.add(hg);
    homes.push({ g: hg, x, z, facing });
  }
  scene.add(homesGroup);

  // Roadside Utility Poles & Glowing Streetlamps
  const poleGroup = new THREE.Group();
  const poleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b2b27, roughness: 0.9 }));
  const lampArmMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 }));
  const lampBulbMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  const poles: Array<{ g: THREE.Group; x: number; z: number }> = [];
  for (let i = 0; i < 12; i++) {
    const pg = new THREE.Group();
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 6.2, 6)), poleMat);
    post.position.y = 3.1;
    const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 0.12, 0.12)), poleMat);
    arm.position.set(0, 5.8, 0);
    const lampArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.8, 0.08, 0.08)), lampArmMat);
    lampArm.position.set(-0.4, 5.1, 0);
    const bulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 8, 6)), lampBulbMat);
    bulb.position.set(-0.75, 4.98, 0);
    pg.add(post, arm, lampArm, bulb);
    const x = 5.4;
    const z = -i * 16 + 18;
    poleGroup.add(pg);
    poles.push({ g: pg, x, z });
  }
  scene.add(poleGroup);

  // Overhead Power Wires connecting consecutive utility poles
  const wireMat = trackMat(new THREE.LineBasicMaterial({ color: 0x1e1b2e, transparent: true, opacity: 0.65 }));
  const wireGeo = trackGeo(new THREE.BufferGeometry());
  const wireVerts = new Float32Array(12 * 3 * 2 * 3);
  wireGeo.setAttribute('position', new THREE.BufferAttribute(wireVerts, 3));
  const wireLines = new THREE.LineSegments(wireGeo, wireMat);
  wireLines.frustumCulled = false;
  scene.add(wireLines);

  // Rear-Tire Dust Burst Pool
  const dustCount = 14;
  const dustMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xe2cba8, transparent: true, opacity: 0.45, depthWrite: false })
  );
  const dustGeo = trackGeo(new THREE.SphereGeometry(0.2, 7, 6));
  const dustPool = Array.from({ length: dustCount }, (_, i) => {
    const m = new THREE.Mesh(dustGeo, dustMat.clone());
    m.visible = false;
    scene.add(m);
    return { mesh: m, age: 99, maxAge: 0.55, vx: 0, vy: 0, vz: 0, seed: i };
  });
  let dustSpawnIdx = 0;
  let dustTimer = 0;

  // Speed / Wind Particle Streaks
  const streakCount = 90;
  const streakPos = new Float32Array(streakCount * 3);
  for (let i = 0; i < streakCount; i++) {
    streakPos[i * 3] = (Math.random() - 0.5) * 14;
    streakPos[i * 3 + 1] = 0.25 + Math.random() * 3.4;
    streakPos[i * 3 + 2] = -Math.random() * 45;
  }
  const streakGeo = trackGeo(new THREE.BufferGeometry());
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMat = trackMat(
    new THREE.PointsMaterial({ color: 0xfef3c7, size: 0.16, transparent: true, opacity: 0.58 })
  );
  const streaks = new THREE.Points(streakGeo, streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  const cyclist = buildCyclistAndBikeGroup(sharedUniforms, trackGeo, trackMat);
  scene.add(cyclist.root);

  const weatherSys = createWeatherSystem(320);
  scene.add(weatherSys.points);

  // Free Orbit Interaction
  let freeOrbitActive = false;
  let orbitYaw = 0.42;
  let orbitPitch = 0.24;
  let orbitDist = 8.8;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const dom = renderer.domElement;

  const onDown = (e: PointerEvent) => {
    if (!freeOrbitActive) return;
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dom.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!freeOrbitActive || !dragging) return;
    orbitYaw -= (e.clientX - lastX) * 0.007;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + (e.clientY - lastY) * 0.005, 0.04, 1.15);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    dom.releasePointerCapture?.(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    if (!freeOrbitActive) return;
    e.preventDefault();
    orbitDist = THREE.MathUtils.clamp(orbitDist * (1 + Math.sign(e.deltaY) * 0.1), 3.5, 28);
  };
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });

  let worldTravelZ = 0;
  let elapsed = 0;
  let lastDpr = -1;
  let lastShadow: boolean | null = null;
  const _dummy = new THREE.Object3D();
  const _camTarget = new THREE.Vector3();
  const _lookAt = new THREE.Vector3();
  const _groundCol = new THREE.Color();
  const _roadCol = new THREE.Color();
  const _zenithCol = new THREE.Color();
  const _midCol = new THREE.Color();
  const _horCol = new THREE.Color();

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colorArray = new Float32Array(posAttr.count * 3);
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  const colAttr = terrainGeo.attributes.color as THREE.BufferAttribute;

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

    update(params) {
      const {
        dt,
        speedMult,
        phase,
        biomeMode,
        tourProgress,
        wheelieFactor,
        cameraView,
        freeOrbit,
        shaderMood,
        weather,
        showWindStreaks,
        budget,
      } = params;

      freeOrbitActive = freeOrbit;
      elapsed += dt;
      if (lastShadow !== budget.shadows && !isSoftwareGl) {
        lastShadow = budget.shadows;
        renderer.shadowMap.enabled = budget.shadows;
      }

      syncSharedShaderUniforms(sharedUniforms, shaderMood, elapsed);

      const weights = computeBiomeWeights(tourProgress, biomeMode);
      const mW = weights.mountains;
      const dW = weights.desert;
      const hW = weights.homes;

      _zenithCol.setRGB(
        BIOME_COLORS.mountains.zenith.r * mW + BIOME_COLORS.desert.zenith.r * dW + BIOME_COLORS.homes.zenith.r * hW,
        BIOME_COLORS.mountains.zenith.g * mW + BIOME_COLORS.desert.zenith.g * dW + BIOME_COLORS.homes.zenith.g * hW,
        BIOME_COLORS.mountains.zenith.b * mW + BIOME_COLORS.desert.zenith.b * dW + BIOME_COLORS.homes.zenith.b * hW
      );
      _midCol.setRGB(
        BIOME_COLORS.mountains.mid.r * mW + BIOME_COLORS.desert.mid.r * dW + BIOME_COLORS.homes.mid.r * hW,
        BIOME_COLORS.mountains.mid.g * mW + BIOME_COLORS.desert.mid.g * dW + BIOME_COLORS.homes.mid.g * hW,
        BIOME_COLORS.mountains.mid.b * mW + BIOME_COLORS.desert.mid.b * dW + BIOME_COLORS.homes.mid.b * hW
      );
      _horCol.setRGB(
        BIOME_COLORS.mountains.horizon.r * mW + BIOME_COLORS.desert.horizon.r * dW + BIOME_COLORS.homes.horizon.r * hW,
        BIOME_COLORS.mountains.horizon.g * mW + BIOME_COLORS.desert.horizon.g * dW + BIOME_COLORS.homes.horizon.g * hW,
        BIOME_COLORS.mountains.horizon.b * mW + BIOME_COLORS.desert.horizon.b * dW + BIOME_COLORS.homes.horizon.b * hW
      );
      _groundCol.setRGB(
        BIOME_COLORS.mountains.ground.r * mW + BIOME_COLORS.desert.ground.r * dW + BIOME_COLORS.homes.ground.r * hW,
        BIOME_COLORS.mountains.ground.g * mW + BIOME_COLORS.desert.ground.g * dW + BIOME_COLORS.homes.ground.g * hW,
        BIOME_COLORS.mountains.ground.b * mW + BIOME_COLORS.desert.ground.b * dW + BIOME_COLORS.homes.ground.b * hW
      );
      _roadCol.setRGB(
        BIOME_COLORS.mountains.road.r * mW + BIOME_COLORS.desert.road.r * dW + BIOME_COLORS.homes.road.r * hW,
        BIOME_COLORS.mountains.road.g * mW + BIOME_COLORS.desert.road.g * dW + BIOME_COLORS.homes.road.g * hW,
        BIOME_COLORS.mountains.road.b * mW + BIOME_COLORS.desert.road.b * dW + BIOME_COLORS.homes.road.b * hW
      );

      skyDome.uniforms.uTime.value = elapsed;
      skyDome.uniforms.uZenith.value.copy(_zenithCol);
      skyDome.uniforms.uMid.value.copy(_midCol);
      skyDome.uniforms.uHorizon.value.copy(_horCol);
      skyDome.uniforms.uStarAlpha.value = 0.15 + hW * 0.72;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_horCol);
      }

      // Sun Halo gentle rotation & cloud drift
      sunHalo.material.rotation = elapsed * 0.04;
      sunHalo.position.y = 32 + dW * 6 - hW * 10;
      sunDisc.position.y = sunHalo.position.y;
      for (const c of clouds) {
        c.sprite.position.x = ((c.baseX + elapsed * c.speed + 160) % 320) - 160;
      }

      // Toggle & Scale Biome Horizon / Props smoothly
      mountainHorizonGroup.visible = mW > 0.04;
      mountainHorizonGroup.position.y = -4 - (1 - mW) * 28;
      lakeMesh.visible = mW > 0.12;
      lakeMesh.position.y = roadHeightAt(-worldTravelZ - 40) - 1.3;
      desertHorizonGroup.visible = dW > 0.04;
      desertHorizonGroup.position.y = -3 - (1 - dW) * 26;

      pineGroup.visible = mW > 0.05;
      cactusGroup.visible = dW > 0.05;
      homesGroup.visible = hW > 0.05;

      const moveDist = speedMult * 15.5 * dt;
      worldTravelZ += moveDist;

      // Update undulating 3D highway + flanking hills
      const hillAmp = dW * 6.2 + (1 - dW) * 4.0;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vzLocal = posAttr.getZ(i);
        const wz = vzLocal - worldTravelZ;
        const baseY = roadHeightAt(wz);
        const absX = Math.abs(vx);
        const roadWidth = 3.6;

        if (absX <= roadWidth) {
          posAttr.setY(i, baseY);
          colAttr.setXYZ(i, _roadCol.r, _roadCol.g, _roadCol.b);
        } else {
          const shoulder = Math.min(1, (absX - roadWidth) / 14);
          const hill =
            Math.sin(vx * 0.14 + wz * 0.04) * 2.2 * shoulder +
            Math.pow((absX - roadWidth) / 18, 1.35) * hillAmp;
          posAttr.setY(i, baseY + hill - 0.15);
          const tint = 0.86 + 0.14 * Math.sin(wz * 0.05);
          colAttr.setXYZ(i, _groundCol.r * tint, _groundCol.g * tint, _groundCol.b * tint);
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      terrainGeo.computeVertexNormals();

      // Update Centerline Dashes
      const dashSpacing = 8.5;
      const dashOffset = worldTravelZ % dashSpacing;
      for (let i = 0; i < dashCount; i++) {
        const z = 18 - i * dashSpacing + dashOffset;
        const wz = z - worldTravelZ;
        _dummy.position.set(0, roadHeightAt(wz) + 0.025, z);
        _dummy.rotation.set(-roadSlopeAt(wz), 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        dashes.setMatrixAt(i, _dummy.matrix);
      }
      dashes.instanceMatrix.needsUpdate = true;

      const sampleHillY = (px: number, pz: number) => {
        const wz = pz - worldTravelZ;
        const absX = Math.abs(px);
        const shoulder = Math.min(1, Math.max(0, (absX - 3.6) / 14));
        const hill =
          Math.sin(px * 0.14 + wz * 0.04) * 2.2 * shoulder +
          Math.pow(Math.max(0, absX - 3.6) / 18, 1.35) * hillAmp;
        return roadHeightAt(wz) + hill - 0.15;
      };

      // Scroll Multi-Part Biome Props
      if (pineGroup.visible) {
        for (const p of pines) {
          p.z += moveDist;
          if (p.z > 22) p.z -= 198;
          p.g.position.set(p.x, sampleHillY(p.x, p.z), p.z);
          p.g.scale.setScalar(p.scale * (0.35 + 0.65 * mW));
        }
      }
      if (cactusGroup.visible) {
        for (const c of cacti) {
          c.z += moveDist;
          if (c.z > 22) c.z -= 192;
          c.g.position.set(c.x, sampleHillY(c.x, c.z), c.z);
          c.g.scale.setScalar(c.scale * (0.35 + 0.65 * dW));
        }
      }
      if (homesGroup.visible) {
        for (const h of homes) {
          h.z += moveDist;
          if (h.z > 24) h.z -= 190;
          h.g.position.set(h.x, sampleHillY(h.x, h.z), h.z);
          h.g.scale.setScalar(0.35 + 0.65 * hW);
        }
      }

      // Utility Poles & Overhead Wires
      for (const pl of poles) {
        pl.z += moveDist;
        if (pl.z > 22) pl.z -= 192;
        pl.g.position.set(pl.x, sampleHillY(pl.x, pl.z), pl.z);
      }
      // Sort poles by Z to string continuous power lines
      const sortedPoles = [...poles].sort((a, b) => a.z - b.z);
      let wPtr = 0;
      const wArr = (wireGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < sortedPoles.length - 1; i++) {
        const p1 = sortedPoles[i].g.position;
        const p2 = sortedPoles[i + 1].g.position;
        for (const xOff of [-0.75, 0.75]) {
          wArr[wPtr++] = p1.x + xOff;
          wArr[wPtr++] = p1.y + 5.75;
          wArr[wPtr++] = p1.z;
          wArr[wPtr++] = p2.x + xOff;
          wArr[wPtr++] = p2.y + 5.75;
          wArr[wPtr++] = p2.z;
        }
      }
      wireGeo.setDrawRange(0, wPtr / 3);
      wireGeo.getAttribute('position').needsUpdate = true;

      // Speed Streaks
      streaks.visible = showWindStreaks && speedMult > 0.2 && !budget.fastShader;
      if (streaks.visible) {
        const sArr = (streakGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
        for (let i = 0; i < streakCount; i++) {
          sArr[i * 3 + 2] += moveDist * 1.45;
          if (sArr[i * 3 + 2] > 8) sArr[i * 3 + 2] = -42 - Math.random() * 15;
        }
        streakGeo.getAttribute('position').needsUpdate = true;
      }

      // Cyclist & Bike Kinematics on undulating 3D road
      const bikeY = roadHeightAt(-worldTravelZ);
      const bikePitch = -roadSlopeAt(-worldTravelZ);
      cyclist.root.position.set(0, bikeY, 0);
      cyclist.root.rotation.x = bikePitch;
      cyclist.wheeliePivot.rotation.x = THREE.MathUtils.lerp(
        cyclist.wheeliePivot.rotation.x,
        wheelieFactor * 0.48,
        1 - Math.exp(-9 * dt)
      );

      // Wheels, Crank, Horizontal Pedals & Blinking Taillight
      const spin = phase * Math.PI * 2 * 36;
      cyclist.frontWheel.rotation.x = -spin;
      cyclist.rearWheel.rotation.x = -spin;
      const crankAngle = phase * Math.PI * 2 * 18;
      cyclist.crankGroup.rotation.x = -crankAngle;
      cyclist.leftPedal.rotation.x = crankAngle;
      cyclist.rightPedal.rotation.x = crankAngle;
      cyclist.tailMat.color.setHex(Math.sin(elapsed * 12) > 0 ? 0xff2a4b : 0x5c0c1b);
      cyclist.beamCone.visible = !budget.fastShader;

      // Exact Lockstep 2-Bone Analytical Knee IK around orbiting crank pedals!
      // At crankAngle=0, left arm (0,+crankR,0) is at top, right arm (0,-crankR,0) is at bottom.
      // Under crankGroup.rotation.x = -a: y' = r*cos(a), z' = -r*sin(a).
      const crankR = 0.165;
      const bbY = -0.03;
      const bbZ = -0.44;
      const hipY = 0.64 + Math.sin(crankAngle * 2) * 0.008;
      const hipZ = -0.24;

      const updateLegIK = (
        leg: typeof cyclist.leftLeg,
        angle: number
      ) => {
        const pedY = bbY + Math.cos(angle) * crankR;
        const pedZ = bbZ - Math.sin(angle) * crankR;
        const ankleTargetY = pedY + 0.048;
        const ankleTargetZ = pedZ + 0.02;
        const { kneeY, kneeZ } = solveLegIK3D(
          hipY,
          hipZ,
          ankleTargetY,
          ankleTargetZ,
          leg.thighLen,
          leg.shinLen
        );
        const rxThigh = Math.atan2(-(kneeZ - hipZ), -(kneeY - hipY));
        const rxShinWorld = Math.atan2(-(ankleTargetZ - kneeZ), -(ankleTargetY - kneeY));
        leg.thighPivot.position.y = hipY;
        leg.thighPivot.rotation.x = rxThigh;
        leg.shinPivot.rotation.x = rxShinWorld - rxThigh;
        leg.anklePivot.rotation.x = -rxShinWorld + Math.sin(angle) * 0.12;
      };
      updateLegIK(cyclist.leftLeg, crankAngle);
      updateLegIK(cyclist.rightLeg, crankAngle + Math.PI);

      // Subtle hip bob & torso rock
      cyclist.torsoGroup.position.y = hipY;
      cyclist.torsoGroup.rotation.z = Math.sin(crankAngle) * 0.032 * Math.min(1, speedMult * 0.25);

      // Rear-Tire Dust Burst Pool
      if (speedMult > 1.8 && !budget.fastShader) {
        dustTimer += dt;
        if (dustTimer > Math.max(0.035, 0.14 / speedMult)) {
          dustTimer = 0;
          const d = dustPool[dustSpawnIdx % dustPool.length];
          dustSpawnIdx++;
          d.age = 0;
          d.mesh.visible = true;
          d.mesh.position.set(
            (Math.random() - 0.5) * 0.24,
            bikeY + 0.08,
            0.78
          );
          d.mesh.scale.setScalar(0.5);
          d.vx = (Math.random() - 0.5) * 0.6;
          d.vy = 0.45 + Math.random() * 0.55;
          d.vz = 1.6 + speedMult * 0.8;
        }
      }
      for (const d of dustPool) {
        if (d.age >= d.maxAge) {
          d.mesh.visible = false;
          continue;
        }
        d.age += dt;
        const t = d.age / d.maxAge;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.mesh.scale.setScalar(0.55 + t * 1.45);
        (d.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.42;
      }

      // Camera FOV Speed Kick + 4 Selectable 3D Angles + Free Orbit
      const targetFov = THREE.MathUtils.clamp(54 + speedMult * 2.1, 54, 74);
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-5 * dt));
        camera.updateProjectionMatrix();
      }

      if (freeOrbit) {
        _camTarget.set(
          Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitDist,
          bikeY + 0.8 + Math.sin(orbitPitch) * orbitDist,
          Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitDist
        );
        _lookAt.set(0, bikeY + 0.9, -0.4);
      } else if (cameraView === 'side') {
        _camTarget.set(6.4, bikeY + 1.9, 0.7);
        _lookAt.set(0, bikeY + 0.85, -1.5);
      } else if (cameraView === 'pov') {
        _camTarget.set(0, bikeY + 1.48, -0.88);
        _lookAt.set(0, bikeY + 1.15, -16);
      } else if (cameraView === 'drone') {
        _camTarget.set(-5.5, bikeY + 6.4, 7.2);
        _lookAt.set(0, bikeY + 0.8, -6.5);
      } else {
        _camTarget.set(1.55, bikeY + 2.45, 5.2);
        _lookAt.set(0, bikeY + 0.95, -8.5);
      }

      const camLerp = 1 - Math.exp(-7 * dt);
      camera.position.lerp(_camTarget, camLerp);
      camera.lookAt(_lookAt);

      weatherSys.update(dt, weather, cyclist.root.position, budget.particleScale);
      renderer.render(scene, camera);

      return { activeBiomeLabel: weights.activeLabel };
    },

    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      weatherSys.dispose();
      skyDome.mesh.geometry.dispose();
      (skyDome.mesh.material as THREE.Material).dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      envTex.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    },
  };
}
