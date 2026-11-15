import * as THREE from 'three';
import type { SunsetPaletteState } from './palette';
import {
  createSkyDomeMesh,
  createStudioEnvironment,
  createWeatherSystem,
  detectSoftwareWebGL,
  enhanceMaterialWithShaderMood,
  syncSharedShaderUniforms,
  createSharedShaderUniforms,
  type ShaderMood,
  type WeatherFx,
} from '../utils/threeShaders';
import { createSoftCloudTexture, createSunHaloTexture } from '../utils/threeTextures';
import type { SceneRenderBudget } from '../utils/hardwareProfile';

export interface Ocean3dRenderParams {
  state: SunsetPaletteState;
  budget: SceneRenderBudget;
  shaderMood: ShaderMood;
  weather: WeatherFx;
  waveChop: number;
  timeScale: number;
  freeOrbit: boolean;
  oceanOpacity: number;
  oceanScale: number;
}

export interface Ocean3dEngine {
  render: (params: Ocean3dRenderParams, dt: number) => void;
  resize: (width: number, height: number, dpr: number) => void;
  dispose: () => void;
}

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function ridgedFbm(x: number, z: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.52;
  let freq = 1.0;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2(x * freq, z * freq);
    let signal = 1.0 - Math.abs(n * 2.0 - 1.0);
    signal = signal * signal * weight;
    weight = Math.max(0.15, Math.min(1.0, signal * 1.65));
    sum += signal * amp;
    // Domain rotation reduces axial grid artifacts
    const nx = x * 0.8 - z * 0.6;
    const nz = x * 0.6 + z * 0.8;
    x = nx;
    z = nz;
    freq *= 2.08;
    amp *= 0.5;
  }
  return sum;
}

function buildAlpineBayTerrain(
  segX: number,
  segZ: number,
  sharedUniforms: ReturnType<typeof createSharedShaderUniforms>,
  isPotato: boolean
): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; uniforms: { uHorizonCol: { value: THREE.Color }; uSunDir: { value: THREE.Vector3 } } } {
  const width = 460;
  const depth = 300;
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const elevAttr = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - 92; // Extend mostly in -Z toward horizon
    pos.setZ(i, z);

    // Distance from central open bay channel so mountains wrap dramatically on left/right flanks and far horizon arc
    const bayChannel = Math.abs(x) / 108;
    const farDist = Math.max(0, -z - 65) / 140;
    const ridgeMask = Math.max(
      Math.pow(Math.min(1.4, bayChannel), 1.45) * Math.max(0, Math.min(1, (-z + 25) / 70)),
      Math.pow(farDist, 1.15) * (0.45 + 0.55 * Math.min(1, Math.abs(x) / 55 + 0.35))
    );

    // Foreground sandy cove beach on +Z > 6
    if (z > 8) {
      const beachH = (z - 8) * 0.14 + valueNoise2(x * 0.08, z * 0.08) * 0.4;
      pos.setY(i, beachH);
      elevAttr[i] = beachH;
      continue;
    }

    const baseNoise = ridgedFbm(x * 0.017 + 4.3, z * 0.018 - 2.1, isPotato ? 3 : 5);
    const detail = isPotato ? 0 : valueNoise2(x * 0.065, z * 0.065) * 1.45;
    let h = ridgeMask * (18.0 + baseNoise * 44.0) + detail * ridgeMask - 2.8;

    // Gentle submerged shelf inside center bay so water always reads clear in center-front
    const centerOpen = Math.exp(-((x * x) / (58 * 58)) - Math.max(0, z + 75) / 90);
    h -= centerOpen * 8.0;

    pos.setY(i, h);
    elevAttr[i] = h;
  }

  geo.setAttribute('aElev', new THREE.BufferAttribute(elevAttr, 1));
  geo.computeVertexNormals();

  const uHorizonCol = { value: new THREE.Color(0xf5a254) };
  const uSunDir = { value: new THREE.Vector3(0, 0.18, -1).normalize() };

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.04,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uKasTime = sharedUniforms.uTime;
    shader.uniforms.uKasRimColor = sharedUniforms.uRimColor;
    shader.uniforms.uKasRimStrength = sharedUniforms.uRimStrength;
    shader.uniforms.uKasWarmth = sharedUniforms.uWarmth;
    shader.uniforms.uKasWireMix = sharedUniforms.uWireMix;
    shader.uniforms.uHorizonCol = uHorizonCol;
    shader.uniforms.uSunDir = uSunDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aElev;
        varying float vElev;
        varying vec3 vWorldNormal;
        varying vec3 vTerrainWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vElev = aElev;
        vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uKasTime;
        uniform vec3 uKasRimColor;
        uniform float uKasRimStrength;
        uniform float uKasWarmth;
        uniform float uKasWireMix;
        uniform vec3 uHorizonCol;
        uniform vec3 uSunDir;
        varying float vElev;
        varying vec3 vWorldNormal;
        varying vec3 vTerrainWorldPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float slope = 1.0 - clamp(vWorldNormal.y, 0.0, 1.0);
        vec3 sandCol = vec3(0.72, 0.56, 0.41);
        vec3 basaltCol = vec3(0.14, 0.15, 0.19);
        vec3 pineCol = vec3(0.11, 0.22, 0.15);
        vec3 graniteCol = vec3(0.32, 0.29, 0.31);
        vec3 snowCol = vec3(0.95, 0.93, 0.96);

        vec3 albedo = mix(basaltCol, sandCol, smoothstep(-0.4, 1.8, vElev) * step(-5.0, vTerrainWorldPos.z));
        // Forested foothills where slope is moderate
        float forestMask = smoothstep(0.6, 4.5, vElev) * (1.0 - smoothstep(14.0, 22.0, vElev)) * (1.0 - smoothstep(0.28, 0.58, slope));
        albedo = mix(albedo, pineCol, forestMask * 0.92);
        // Exposed rocky crags on steeper faces & mid-high ridges
        float rockMask = smoothstep(0.32, 0.62, slope) + smoothstep(10.0, 19.0, vElev) * 0.65;
        albedo = mix(albedo, graniteCol, clamp(rockMask, 0.0, 1.0));
        // Alpine snowline above elevation 19 on upper shelves
        float snowMask = smoothstep(17.5, 25.0, vElev) * (1.0 - smoothstep(0.45, 0.78, slope));
        albedo = mix(albedo, snowCol, clamp(snowMask, 0.0, 1.0));

        // Sunset atmospheric rim & aerial perspective haze
        float dist = length(vTerrainWorldPos.xz);
        float aerial = smoothstep(75.0, 275.0, dist);
        float sunFacing = clamp(dot(normalize(vWorldNormal), normalize(uSunDir)), 0.0, 1.0);
        albedo += uHorizonCol * sunFacing * 0.24;
        albedo = mix(albedo, uHorizonCol * 0.86, aerial * 0.72);
        diffuseColor.rgb *= albedo;`
      )
      .replace(
        '#include <dithering_fragment>',
        `
        vec3 kasV = normalize(vViewPosition);
        float kasRim = pow(1.0 - clamp(abs(dot(normalize(normal), kasV)), 0.0, 1.0), 2.8);
        gl_FragColor.rgb += uKasRimColor * kasRim * uKasRimStrength;
        if (uKasWireMix > 0.01) {
          vec3 grid = abs(fract(vTerrainWorldPos * 0.3 - 0.5) - 0.5) / max(fwidth(vTerrainWorldPos * 0.3), vec3(0.002));
          float line = 1.0 - min(min(grid.x, grid.y), grid.z);
          gl_FragColor.rgb = mix(gl_FragColor.rgb * 0.6, vec3(0.18, 0.85, 1.0), clamp(line, 0.0, 1.0) * uKasWireMix);
        }
        #include <dithering_fragment>`
      );
  };
  mat.customProgramCacheKey = () => 'kas-alpine-terrain-v1';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return { mesh, mat, uniforms: { uHorizonCol, uSunDir } };
}

function build3dPalm(scale: number, matTrunk: THREE.MeshStandardMaterial, matLeaf: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const segments = 5;
  let y = 0;
  let lean = 0;
  for (let i = 0; i < segments; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.016, 0.2 - i * 0.016, 1.15, 7), matTrunk);
    seg.position.set(lean, y + 0.55, 0);
    seg.rotation.z = -0.06 * (i + 1);
    y += 1.05;
    lean += 0.14 * (i + 1) * 0.32;
    g.add(seg);
  }
  const crown = new THREE.Group();
  crown.position.set(lean + 0.1, y, 0);
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 1.85), matLeaf);
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.sin(angle) * 0.8, 0, Math.cos(angle) * 0.8);
    frond.rotation.y = angle;
    frond.rotation.x = 0.28;
    crown.add(frond);
  }
  g.add(crown);
  g.scale.setScalar(scale);
  return g;
}

function build3dSchooner(
  matWood: THREE.MeshStandardMaterial,
  matSail: THREE.MeshStandardMaterial
): THREE.Group {
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.95, 1.5), matWood);
  hull.position.y = 0.35;
  ship.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 1.15), matWood);
  cabin.position.set(-1.35, 0.95, 0);
  ship.add(cabin);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.76, 1.9, 6), matWood);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(3.4, 0.45, 0);
  ship.add(bow);
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 2.2, 6), matWood);
  bowsprit.rotation.z = -Math.PI / 2 + 0.16;
  bowsprit.position.set(4.5, 0.92, 0);
  ship.add(bowsprit);

  const sternLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd275 })
  );
  sternLantern.position.set(-2.55, 1.3, 0);
  ship.add(sternLantern);

  for (const xOff of [-1.2, 0.25, 1.65]) {
    const h = xOff === 0.25 ? 4.3 : 3.4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, h, 6), matWood);
    mast.position.set(xOff, 0.65 + h / 2, 0);
    ship.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.25, h * 0.64), matSail);
    sail.position.set(xOff + 0.1, 0.98 + h * 0.48, 0);
    sail.rotation.y = Math.PI / 2 - 0.22;
    ship.add(sail);
  }
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 0.7),
    new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(-4.6, -0.05, 0);
  ship.add(wake);
  return ship;
}

export function createOcean3dEngine(container: HTMLElement): Ocean3dEngine {
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
  scene.fog = new THREE.FogExp2(0xdd8d58, 0.0042);

  const camera = new THREE.PerspectiveCamera(
    52,
    (container.clientWidth || 1280) / Math.max(1, container.clientHeight || 720),
    0.4,
    950
  );
  camera.position.set(0, 6.2, 24);
  camera.lookAt(0, 3.2, -70);

  const envTex = createStudioEnvironment(renderer, scene);
  const sharedUniforms = createSharedShaderUniforms('standard');

  // 3-Point Warm Sunset Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xffcfb0, 0x162436, 0.95);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffb56b, 2.8);
  sunLight.position.set(20, 28, -95);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.camera.left = -95;
  sunLight.shadow.camera.right = 95;
  sunLight.shadow.camera.top = 75;
  sunLight.shadow.camera.bottom = -45;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const skyDome = createSkyDomeMesh({ radius: 460, showStars: true });
  scene.add(skyDome.mesh);

  // Realistic 3D Multi-Octave Ridged Alpine Mountains + Cove
  const terrain = buildAlpineBayTerrain(132, 88, sharedUniforms, isSoftwareGl);
  scene.add(terrain.mesh);

  // 3D Ocean Surface with Gerstner Swells, Fresnel Sky Reflection & Heat Shimmer
  const waterGeo = new THREE.PlaneGeometry(420, 260, 128, 96);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, 0, -108);

  const waterUniforms = {
    uTime: { value: 0 },
    uChop: { value: 1.0 },
    uFastMode: { value: 0.0 },
    uSunDir: { value: new THREE.Vector3(0, 0.16, -1).normalize() },
    uSunCore: { value: new THREE.Color(0xfff1c9) },
    uSunHalo: { value: new THREE.Color(0xff9a44) },
    uHorizon: { value: new THREE.Color(0xf5a254) },
    uZenith: { value: new THREE.Color(0x162447) },
    uDeepWater: { value: new THREE.Color(0x0b2038) },
    uShallowWater: { value: new THREE.Color(0x1e5c70) },
    uWireMix: sharedUniforms.uWireMix,
  };

  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: false,
    vertexShader: `
      uniform float uTime;
      uniform float uChop;
      uniform float uFastMode;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec3 pos = position;
        float t = uTime;
        float amp = uChop * (1.0 - smoothstep(10.0, 230.0, length(pos.xz)) * 0.35);

        float w1 = sin(pos.x * 0.11 + pos.z * 0.24 + t * 1.45) * 0.42 * amp;
        float w2 = sin(-pos.x * 0.17 + pos.z * 0.35 + t * 1.95) * 0.26 * amp;
        float w3 = uFastMode > 0.5 ? 0.0 : sin(pos.x * 0.42 - pos.z * 0.52 + t * 2.75) * 0.12 * amp;
        pos.y += w1 + w2 + w3;

        float dhdx = cos(pos.x * 0.11 + pos.z * 0.24 + t * 1.45) * 0.42 * 0.11 * amp
                   + cos(-pos.x * 0.17 + pos.z * 0.35 + t * 1.95) * 0.26 * (-0.17) * amp
                   + (uFastMode > 0.5 ? 0.0 : cos(pos.x * 0.42 - pos.z * 0.52 + t * 2.75) * 0.12 * 0.42 * amp);
        float dhdz = cos(pos.x * 0.11 + pos.z * 0.24 + t * 1.45) * 0.42 * 0.24 * amp
                   + cos(-pos.x * 0.17 + pos.z * 0.35 + t * 1.95) * 0.26 * 0.35 * amp
                   + (uFastMode > 0.5 ? 0.0 : cos(pos.x * 0.42 - pos.z * 0.52 + t * 2.75) * 0.12 * (-0.52) * amp);

        vNormal = normalize(vec3(-dhdx, 1.0, -dhdz));
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uChop;
      uniform float uFastMode;
      uniform vec3 uSunDir;
      uniform vec3 uSunCore;
      uniform vec3 uSunHalo;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uDeepWater;
      uniform vec3 uShallowWater;
      uniform float uWireMix;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // High-frequency normal shimmer on top of Gerstner swell normals
        vec3 N = normalize(vNormal);
        if (uFastMode < 0.5) {
          float capX = sin(vWorldPos.x * 1.8 + vWorldPos.z * 2.4 + uTime * 3.1) * 0.055 * uChop;
          float capZ = cos(vWorldPos.z * 3.2 - vWorldPos.x * 1.4 + uTime * 3.8) * 0.075 * uChop;
          N = normalize(N + vec3(capX, 0.0, capZ));
        }

        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - ndotv, 4.4);

        vec3 R = reflect(-V, N);
        float skyT = clamp(R.y, 0.0, 1.0);
        vec3 reflCol = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, skyT));

        float shoreBlend = smoothstep(-28.0, 6.0, vWorldPos.z);
        vec3 bodyCol = mix(uDeepWater, uShallowWater, shoreBlend * 0.72);
        vec3 col = mix(bodyCol, reflCol, fresnel * 0.85);

        // Broken solar glitter ribbon across wave crests
        vec3 H = normalize(L + V);
        float sunVis = smoothstep(-0.08, 0.04, L.y);
        float specTight = pow(max(dot(N, H), 0.0), 140.0) * 1.85;
        float specBroad = pow(max(dot(N, H), 0.0), 22.0) * 0.36;
        col += (uSunCore * specTight + uSunHalo * specBroad) * sunVis;

        // Subtle shoreline surf foam near foreground cove
        float surfWave = sin(vWorldPos.z * 0.85 - uTime * 2.3 + sin(vWorldPos.x * 0.25) * 1.4);
        float foam = smoothstep(0.55, 0.92, surfWave) * smoothstep(-4.0, 7.0, vWorldPos.z) * 0.65;
        col = mix(col, vec3(0.95, 0.96, 0.98), foam);

        // Horizon atmospheric haze + convective mirage tint
        float dist = length(vWorldPos.xz);
        float haze = smoothstep(85.0, 235.0, dist);
        col = mix(col, uHorizon, haze * 0.85);

        if (uWireMix > 0.01) {
          vec2 g = abs(fract(vWorldPos.xz * 0.35 - 0.5) - 0.5) / max(fwidth(vWorldPos.xz * 0.35), vec2(0.002));
          float wire = 1.0 - min(g.x, g.y);
          col = mix(col * 0.6, vec3(0.18, 0.85, 1.0), clamp(wire, 0.0, 1.0) * uWireMix);
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  scene.add(waterMesh);

  // Foreground Palms & Headland Lighthouse & Three-Masted Schooner
  const matTrunk = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.9 });
  const matLeaf = new THREE.MeshStandardMaterial({ color: 0x1a3822, roughness: 0.72 });
  enhanceMaterialWithShaderMood(matTrunk, sharedUniforms, 'ocean-trunk');
  enhanceMaterialWithShaderMood(matLeaf, sharedUniforms, 'ocean-leaf');

  const palmLeft = build3dPalm(1.15, matTrunk, matLeaf);
  palmLeft.position.set(-16, 1.1, 14.5);
  palmLeft.rotation.y = 0.35;
  scene.add(palmLeft);

  const palmRight = build3dPalm(0.95, matTrunk, matLeaf);
  palmRight.position.set(17.5, 1.3, 15.2);
  palmRight.rotation.y = -0.45;
  scene.add(palmRight);

  // Distant 3D Schooner gently cruising the bay
  const matShipWood = new THREE.MeshStandardMaterial({ color: 0x332018, roughness: 0.8 });
  const matSail = new THREE.MeshStandardMaterial({
    color: 0xfbe5c8,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const schooner = build3dSchooner(matShipWood, matSail);
  schooner.position.set(-28, 0.15, -56);
  scene.add(schooner);

  // Coastal Headland Lighthouse on Right Cliff + Sweeping Searchlight Beam
  const lhGroup = new THREE.Group();
  lhGroup.position.set(54, 7.2, -52);
  const lhTower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 1.05, 6.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 })
  );
  lhTower.position.y = 3.2;
  const lhLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe082 })
  );
  lhLantern.position.y = 6.7;
  const sweepPivot = new THREE.Group();
  sweepPivot.position.y = 6.7;
  const sweepConeMat = new THREE.MeshBasicMaterial({
    color: 0xfff3b0,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sweepCone = new THREE.Mesh(
    new THREE.ConeGeometry(4.2, 42, 14, 1, true),
    sweepConeMat
  );
  sweepCone.rotation.z = Math.PI / 2;
  sweepCone.position.x = -21;
  sweepPivot.add(sweepCone);
  lhGroup.add(lhTower, lhLantern, sweepPivot);
  scene.add(lhGroup);

  // 3D Glowing Sun Corona & Drifting Sunset Cloud Sprites
  const oceanHaloTex = createSunHaloTexture();
  const oceanCloudTex = createSoftCloudTexture();
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: oceanHaloTex,
      color: 0xffcf7a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  sunSprite.scale.set(110, 110, 1);
  scene.add(sunSprite);

  const cloudSpriteMat = new THREE.SpriteMaterial({
    map: oceanCloudTex,
    color: 0xffd2b8,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    fog: false,
  });
  const skyClouds: Array<{ sprite: THREE.Sprite; baseX: number; speed: number }> = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(cloudSpriteMat);
    const bx = -170 + i * 31;
    sp.position.set(bx, 28 + (i % 4) * 9, -180 - (i % 3) * 26);
    sp.scale.set(54 + (i % 3) * 16, 22 + (i % 2) * 8, 1);
    scene.add(sp);
    skyClouds.push({ sprite: sp, baseX: bx, speed: 0.9 + (i % 3) * 0.45 });
  }

  // 3D Flapping Horizon Seabirds
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1524, side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(0.75, 0.24);
  const birds: Array<{
    group: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    speed: number;
    phase: number;
    baseY: number;
  }> = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, birdMat);
    l.position.x = -0.36;
    const r = new THREE.Mesh(wingGeo, birdMat);
    r.position.x = 0.36;
    g.add(l, r);
    g.position.set(-75 + i * 18, 7 + (i % 4) * 2.8, -42 - (i % 3) * 18);
    scene.add(g);
    birds.push({
      group: g,
      leftWing: l,
      rightWing: r,
      speed: 3.2 + (i % 4) * 0.9,
      phase: i * 1.1,
      baseY: g.position.y,
    });
  }

  const weatherSys = createWeatherSystem(360);
  scene.add(weatherSys.points);

  // Free 3D Orbit camera state (active when sandboxFreeOrbit === true)
  let orbitYaw = 0;
  let orbitPitch = 0.14;
  let orbitDist = 34;
  let freeOrbitActive = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const activePts = new Map<number, { x: number; y: number }>();
  let prevPinch: number | null = null;

  const dom = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    if (!freeOrbitActive) return;
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    activePts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dom.setPointerCapture?.(e.pointerId);
    if (activePts.size >= 2) {
      dragging = false;
      const pts = Array.from(activePts.values());
      prevPinch = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      return;
    }
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (!freeOrbitActive) return;
    if (activePts.has(e.pointerId)) {
      activePts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activePts.size >= 2) {
      const pts = Array.from(activePts.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (prevPinch && dist > 8) {
        orbitDist = THREE.MathUtils.clamp(orbitDist * (prevPinch / dist), 12, 110);
      }
      prevPinch = dist;
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    orbitYaw -= dx * 0.006;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.0045, -0.05, 0.85);
  };
  const onUp = (e: PointerEvent) => {
    activePts.delete(e.pointerId);
    if (activePts.size < 2) prevPinch = null;
    if (activePts.size === 0) dragging = false;
    dom.releasePointerCapture?.(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    if (!freeOrbitActive) return;
    e.preventDefault();
    orbitDist = THREE.MathUtils.clamp(orbitDist * (1 + Math.sign(e.deltaY) * 0.1), 12, 110);
  };

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });

  let elapsedSec = 0;
  let lastBudgetShadow: boolean | null = null;
  let lastDpr = -1;
  const _targetPos = new THREE.Vector3();
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

    render(params, dt) {
      const { state, budget, shaderMood, weather, waveChop, timeScale, freeOrbit, oceanOpacity } =
        params;
      if (oceanOpacity <= 0.02) return;

      freeOrbitActive = freeOrbit;
      const simDt = dt * Math.max(0.15, timeScale);
      elapsedSec += simDt;

      if (lastBudgetShadow !== budget.shadows && !isSoftwareGl) {
        lastBudgetShadow = budget.shadows;
        renderer.shadowMap.enabled = budget.shadows;
      }

      syncSharedShaderUniforms(sharedUniforms, shaderMood, elapsedSec);

      const sunAz = ((state.sunXNorm ?? 0.5) - 0.5) * 1.15;
      const sunEl = state.sunElevation * 1.45;
      const sunDir = new THREE.Vector3(
        Math.sin(sunAz),
        Math.max(-0.22, sunEl),
        -Math.cos(sunAz)
      ).normalize();

      // Update Sky Dome & Ocean Shader Uniforms from live Broken Arrow / Sunset Palette
      skyDome.uniforms.uTime.value = elapsedSec;
      skyDome.uniforms.uZenith.value.setRGB(state.zenith[0], state.zenith[1], state.zenith[2]);
      skyDome.uniforms.uMid.value.setRGB(state.midSky[0], state.midSky[1], state.midSky[2]);
      skyDome.uniforms.uHorizon.value.setRGB(state.horizon[0], state.horizon[1], state.horizon[2]);
      skyDome.uniforms.uSunColor.value.setRGB(state.sunHalo[0], state.sunHalo[1], state.sunHalo[2]);
      skyDome.uniforms.uSunDir.value.copy(sunDir);
      skyDome.uniforms.uStarAlpha.value = Math.max(0.05, 1.0 - state.sunVisible);

      terrain.uniforms.uHorizonCol.value.setRGB(state.horizon[0], state.horizon[1], state.horizon[2]);
      terrain.uniforms.uSunDir.value.copy(sunDir);

      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setRGB(state.horizon[0], state.horizon[1], state.horizon[2]);
        scene.fog.density = budget.fastShader ? 0.0046 : 0.0038;
      }

      sunLight.position.copy(sunDir).multiplyScalar(140);
      sunLight.color.setRGB(
        Math.min(1, state.sunCore[0] * 1.1),
        Math.min(1, state.sunCore[1] * 0.96),
        Math.min(1, state.sunCore[2] * 0.88)
      );
      sunLight.intensity = 1.1 + state.sunVisible * 2.1;
      hemiLight.color.setRGB(state.midSky[0], state.midSky[1], state.midSky[2]);

      waterUniforms.uTime.value = elapsedSec;
      waterUniforms.uChop.value = waveChop;
      waterUniforms.uFastMode.value = budget.fastShader ? 1.0 : 0.0;
      waterUniforms.uSunDir.value.copy(sunDir);
      waterUniforms.uSunCore.value.setRGB(state.sunCore[0], state.sunCore[1], state.sunCore[2]);
      waterUniforms.uSunHalo.value.setRGB(state.sunHalo[0], state.sunHalo[1], state.sunHalo[2]);
      waterUniforms.uHorizon.value.setRGB(state.horizon[0], state.horizon[1], state.horizon[2]);
      waterUniforms.uZenith.value.setRGB(state.zenith[0], state.zenith[1], state.zenith[2]);
      waterUniforms.uDeepWater.value.setRGB(state.deepWater[0], state.deepWater[1], state.deepWater[2]);
      waterUniforms.uShallowWater.value.setRGB(
        state.shallowWater[0],
        state.shallowWater[1],
        state.shallowWater[2]
      );

      // Animate 3D Schooner gently riding wave swells
      schooner.position.x = ((elapsedSec * 1.35 + 45) % 130) - 65;
      schooner.position.y = Math.sin(elapsedSec * 1.4) * 0.25 * waveChop + 0.15;
      schooner.rotation.z = Math.sin(elapsedSec * 1.9) * 0.045 * waveChop;
      schooner.rotation.x = Math.cos(elapsedSec * 1.3) * 0.03 * waveChop;

      // Animate Sun Corona, Drifting Sunset Clouds & Lighthouse Sweeping Searchlight
      sunSprite.position.copy(sunDir).multiplyScalar(250);
      sunSprite.material.opacity = Math.max(0, state.sunVisible * 0.9);
      sunSprite.material.rotation = elapsedSec * 0.03;
      cloudSpriteMat.color.setRGB(state.cloudLit[0], state.cloudLit[1], state.cloudLit[2]);
      cloudSpriteMat.opacity = budget.fastShader ? 0.3 : 0.56;
      for (const cl of skyClouds) {
        cl.sprite.position.x = ((cl.baseX + elapsedSec * cl.speed + 190) % 380) - 190;
      }

      const beaconPulse = 0.72 + 0.28 * Math.sin(elapsedSec * 2.4);
      lhLantern.scale.setScalar(beaconPulse);
      sweepPivot.rotation.y = elapsedSec * 0.72;
      sweepCone.visible = !budget.fastShader;
      sweepConeMat.opacity = 0.1 + (1 - state.sunVisible) * 0.22;

      // Animate 3D Soaring Seabirds across bay
      for (const b of birds) {
        b.group.position.x += b.speed * simDt;
        if (b.group.position.x > 85) b.group.position.x = -85;
        const flap = Math.sin(elapsedSec * 6.5 + b.phase) * 0.55;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
        b.group.position.y = b.baseY + Math.sin(elapsedSec * 0.9 + b.phase) * 0.65;
      }

      // Smooth Camera Choreography vs Free Orbit Mode
      if (freeOrbit) {
        const cx = Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitDist;
        const cy = Math.max(2.2, Math.sin(orbitPitch) * orbitDist + 6);
        const cz = Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitDist - 22;
        _targetPos.set(cx, cy, cz);
        _lookVec.set(0, 4.5, -52);
      } else {
        const swayX = Math.sin(elapsedSec * 0.22) * 1.8;
        const swayY = 6.2 + Math.sin(elapsedSec * 0.35) * 0.35;
        _targetPos.set(swayX, swayY, 24);
        _lookVec.set(sunDir.x * 16, 4.2, -74);
      }

      const dampAlpha = 1 - Math.exp(-5.2 * dt);
      camera.position.lerp(_targetPos, dampAlpha);
      camera.lookAt(_lookVec);

      weatherSys.update(dt, weather, camera.position, budget.particleScale);
      renderer.render(scene, camera);
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
      terrain.mesh.geometry.dispose();
      terrain.mat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      oceanHaloTex.dispose();
      oceanCloudTex.dispose();
      cloudSpriteMat.dispose();
      sweepConeMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    },
  };
}
