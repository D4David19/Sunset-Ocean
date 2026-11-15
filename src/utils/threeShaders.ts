import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type ShaderMood =
  | 'standard'
  | 'golden-rim'
  | 'neon-rim'
  | 'warm-film'
  | 'blueprint';

export type WeatherFx = 'clear' | 'mist' | 'rain' | 'embers';

export const SHADER_MOOD_META: Record<
  ShaderMood,
  {
    label: string;
    subtitle: string;
    rimHex: number;
    rimStrength: number;
    warmth: number;
    wireMix: number;
  }
> = {
  standard: {
    label: 'Studio PBR',
    subtitle: 'Natural physical highlights & balanced atmosphere',
    rimHex: 0xffe4b8,
    rimStrength: 0.16,
    warmth: 0.0,
    wireMix: 0.0,
  },
  'golden-rim': {
    label: 'Golden Rim',
    subtitle: 'Warm sunset edge lighting & amber atmosphere',
    rimHex: 0xffa94d,
    rimStrength: 0.55,
    warmth: 0.24,
    wireMix: 0.0,
  },
  'neon-rim': {
    label: 'Neon Rim',
    subtitle: 'Crisp electric cyan Fresnel edge shader',
    rimHex: 0x22d3ee,
    rimStrength: 0.68,
    warmth: -0.08,
    wireMix: 0.0,
  },
  'warm-film': {
    label: 'Warm Film',
    subtitle: 'Cinema dusk contrast with golden shadows',
    rimHex: 0xf472b6,
    rimStrength: 0.32,
    warmth: 0.18,
    wireMix: 0.0,
  },
  blueprint: {
    label: 'Holo Grid',
    subtitle: 'Technical 3D wireframe contour & rim shader',
    rimHex: 0x38bdf8,
    rimStrength: 0.8,
    warmth: -0.15,
    wireMix: 0.42,
  },
};

export interface SharedShaderUniforms {
  uTime: { value: number };
  uRimColor: { value: THREE.Color };
  uRimStrength: { value: number };
  uWarmth: { value: number };
  uWireMix: { value: number };
}

export function createSharedShaderUniforms(mood: ShaderMood = 'standard'): SharedShaderUniforms {
  const meta = SHADER_MOOD_META[mood];
  return {
    uTime: { value: 0 },
    uRimColor: { value: new THREE.Color(meta.rimHex) },
    uRimStrength: { value: meta.rimStrength },
    uWarmth: { value: meta.warmth },
    uWireMix: { value: meta.wireMix },
  };
}

export function syncSharedShaderUniforms(
  uniforms: SharedShaderUniforms,
  mood: ShaderMood,
  timeSec: number
): void {
  const meta = SHADER_MOOD_META[mood];
  uniforms.uTime.value = timeSec;
  uniforms.uRimColor.value.setHex(meta.rimHex);
  uniforms.uRimStrength.value = meta.rimStrength;
  uniforms.uWarmth.value = meta.warmth;
  uniforms.uWireMix.value = meta.wireMix;
}

/**
 * Extends MeshStandardMaterial / MeshPhysicalMaterial with custom GLSL Fresnel rim-glow,
 * filmic warmth grading, and optional holographic grid contours while preserving PBR shadows.
 */
export function enhanceMaterialWithShaderMood(
  material: THREE.MeshStandardMaterial,
  shared: SharedShaderUniforms,
  cacheKeySuffix = 'mood'
): void {
  material.customProgramCacheKey = () => `kas-${cacheKeySuffix}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uKasTime = shared.uTime;
    shader.uniforms.uKasRimColor = shared.uRimColor;
    shader.uniforms.uKasRimStrength = shared.uRimStrength;
    shader.uniforms.uKasWarmth = shared.uWarmth;
    shader.uniforms.uKasWireMix = shared.uWireMix;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vKasWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vKasWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
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
        varying vec3 vKasWorldPos;`
      )
      .replace(
        '#include <dithering_fragment>',
        `
        vec3 kasViewDir = normalize(vViewPosition);
        float kasRim = pow(1.0 - clamp(abs(dot(normalize(normal), kasViewDir)), 0.0, 1.0), 2.8);
        gl_FragColor.rgb += uKasRimColor * kasRim * uKasRimStrength;
        if (uKasWarmth > 0.01) {
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.12, 1.01, 0.86), uKasWarmth);
        } else if (uKasWarmth < -0.01) {
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.88, 1.04, 1.16), -uKasWarmth);
        }
        if (uKasWireMix > 0.01) {
          vec3 grid = abs(fract(vKasWorldPos * 0.85 - 0.5) - 0.5) / max(fwidth(vKasWorldPos * 0.85), vec3(0.002));
          float line = 1.0 - min(min(grid.x, grid.y), grid.z);
          gl_FragColor.rgb = mix(gl_FragColor.rgb * 0.58, vec3(0.16, 0.82, 1.0), clamp(line, 0.0, 1.0) * uKasWireMix);
        }
        #include <dithering_fragment>`
      );
  };
}

let cachedSoftwareGl: boolean | null = null;
export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === 'undefined') {
    cachedSoftwareGl = false;
    return false;
  }
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = false;
    return false;
  }
}

export function createStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  return envTex;
}

export function createSkyDomeMesh(params?: {
  radius?: number;
  zenith?: number;
  mid?: number;
  horizon?: number;
  sunDir?: THREE.Vector3;
  sunColor?: number;
  showStars?: boolean;
}): {
  mesh: THREE.Mesh;
  uniforms: {
    uTime: { value: number };
    uZenith: { value: THREE.Color };
    uMid: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uStarAlpha: { value: number };
  };
} {
  const uniforms = {
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color(params?.zenith ?? 0x0b1633) },
    uMid: { value: new THREE.Color(params?.mid ?? 0x3a3264) },
    uHorizon: { value: new THREE.Color(params?.horizon ?? 0xf9985a) },
    uSunColor: { value: new THREE.Color(params?.sunColor ?? 0xffe4a0) },
    uSunDir: { value: (params?.sunDir ?? new THREE.Vector3(0, 0.22, -1)).clone().normalize() },
    uStarAlpha: { value: params?.showStars ? 0.65 : 0.2 },
  };

  const geo = new THREE.SphereGeometry(params?.radius ?? 460, 28, 18);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uStarAlpha;
      varying vec3 vWorldDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -0.1, 1.0);
        float t = clamp(h, 0.0, 1.0);

        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, t));
        col = mix(col, uZenith, smoothstep(0.28, 0.92, t));

        // Soft horizon scatter haze band
        float horizonGlow = exp(-abs(h) * 10.0);
        col += uHorizon * horizonGlow * 0.22;

        // Atmospheric solar halo & crisp disc
        float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
        float halo = pow(sunCos, 10.0) * 0.42 + pow(sunCos, 64.0) * 0.55;
        float disc = smoothstep(0.9986, 0.9994, sunCos);
        float sunVis = smoothstep(-0.08, 0.04, uSunDir.y);
        col += uSunColor * (halo + disc * 1.35) * sunVis;

        // Subtle animated drifting clouds & upper stars
        if (uStarAlpha > 0.02 && t > 0.15) {
          float s = hash(floor(dir * 260.0));
          float star = smoothstep(0.9968, 0.9995, s) * smoothstep(0.16, 0.55, t);
          float twinkle = 0.72 + 0.28 * sin(uTime * 2.2 + s * 80.0);
          col += vec3(0.92, 0.96, 1.0) * star * twinkle * uStarAlpha;
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

export interface WeatherParticleController {
  points: THREE.Points;
  update: (
    dt: number,
    mode: WeatherFx,
    center: THREE.Vector3,
    particleScale: number
  ) => void;
  dispose: () => void;
}

export function createWeatherSystem(maxCount = 420): WeatherParticleController {
  const positions = new Float32Array(maxCount * 3);
  const speeds = new Float32Array(maxCount);
  const phases = new Float32Array(maxCount);

  for (let i = 0; i < maxCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 70;
    positions[i * 3 + 1] = Math.random() * 28;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
    speeds[i] = 0.7 + Math.random() * 0.8;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.26,
    color: 0xbfe4ff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;

  let clockAcc = 0;

  return {
    points,
    update(dt, mode, center, particleScale) {
      if (mode === 'clear') {
        points.visible = false;
        return;
      }
      points.visible = true;
      clockAcc += dt;

      const activeCount = Math.max(
        30,
        Math.floor(maxCount * Math.min(1, particleScale))
      );
      geo.setDrawRange(0, activeCount);

      if (mode === 'rain') {
        mat.color.setHex(0xa8d8ff);
        mat.size = 0.22;
        mat.opacity = 0.62;
      } else if (mode === 'embers') {
        mat.color.setHex(0xff9b42);
        mat.size = 0.34;
        mat.opacity = 0.82;
      } else {
        // mist
        mat.color.setHex(0xe2f1ff);
        mat.size = 0.48;
        mat.opacity = 0.36;
      }

      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < activeCount; i++) {
        const idx = i * 3;
        if (mode === 'rain') {
          arr[idx + 1] -= dt * 26 * speeds[i];
          arr[idx] -= dt * 3.2;
          if (arr[idx + 1] < -2) arr[idx + 1] = 28;
        } else if (mode === 'embers') {
          arr[idx + 1] += dt * 3.6 * speeds[i];
          arr[idx] += Math.sin(clockAcc * 1.8 + phases[i]) * dt * 1.5;
          if (arr[idx + 1] > 26) arr[idx + 1] = 0;
        } else {
          arr[idx] += dt * 1.9 * speeds[i];
          arr[idx + 1] += Math.sin(clockAcc * 0.9 + phases[i]) * dt * 0.4;
          if (arr[idx + 1] < 0) arr[idx + 1] = 16;
          if (arr[idx + 1] > 18) arr[idx + 1] = 1;
        }
        // Keep wrapped inside [-35, 35] box relative to points container
        if (arr[idx] > 35) arr[idx] -= 70;
        if (arr[idx] < -35) arr[idx] += 70;
        if (arr[idx + 2] > 35) arr[idx + 2] -= 70;
        if (arr[idx + 2] < -35) arr[idx + 2] += 70;
      }
      attr.needsUpdate = true;
      points.position.set(center.x, Math.max(0, center.y - 4), center.z);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export interface ShockwaveRingHandle {
  spawn: (pos: THREE.Vector3, colorHex: number, maxRadius?: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createShockwavePool(
  scene: THREE.Scene,
  poolSize = 6
): ShockwaveRingHandle {
  const rings: Array<{
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    age: number;
    life: number;
    maxRadius: number;
    active: boolean;
  }> = [];

  const geo = new THREE.PlaneGeometry(2, 2);

  for (let i = 0; i < poolSize; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(0xffb74d) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float radius = mix(0.14, 0.94, uProgress);
          float ring = exp(-abs(d - radius) * 22.0);
          float alpha = ring * (1.0 - uProgress);
          gl_FragColor = vec4(uColor * 1.4, clamp(alpha, 0.0, 1.0));
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    rings.push({
      mesh,
      mat,
      age: 0,
      life: 0.55,
      maxRadius: 4.5,
      active: false,
    });
  }

  return {
    spawn(pos, colorHex, maxRadius = 4.5) {
      const slot = rings.find((r) => !r.active) ?? rings[0];
      slot.active = true;
      slot.age = 0;
      slot.maxRadius = maxRadius;
      slot.mat.uniforms.uColor.value.setHex(colorHex);
      slot.mat.uniforms.uProgress.value = 0;
      slot.mesh.position.copy(pos);
      slot.mesh.scale.setScalar(0.5);
      slot.mesh.visible = true;
    },
    update(dt) {
      for (const r of rings) {
        if (!r.active) continue;
        r.age += dt;
        const p = r.age / r.life;
        if (p >= 1) {
          r.active = false;
          r.mesh.visible = false;
        } else {
          r.mat.uniforms.uProgress.value = p;
          r.mesh.scale.setScalar(THREE.MathUtils.lerp(0.6, r.maxRadius, p));
        }
      }
    },
    dispose() {
      geo.dispose();
      for (const r of rings) {
        r.mat.dispose();
        scene.remove(r.mesh);
      }
    },
  };
}
