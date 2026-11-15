import type { SunsetPaletteState } from './palette';

export interface OceanShaderRenderer {
  render: (width: number, height: number, state: SunsetPaletteState, fastMode?: boolean) => void;
  dispose: () => void;
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_theta;
  uniform float u_waveTheta;
  uniform float u_sunX;
  uniform float u_sunElev;
  uniform float u_sunVisible;
  uniform float u_fastMode;

  uniform vec3 u_zenith;
  uniform vec3 u_midSky;
  uniform vec3 u_horizon;
  uniform vec3 u_sunCore;
  uniform vec3 u_sunHalo;
  uniform vec3 u_cloudLit;
  uniform vec3 u_cloudShadow;
  uniform vec3 u_deepWater;
  uniform vec3 u_midWater;
  uniform vec3 u_shallowWater;
  uniform vec3 u_wetSand;

  const float HORIZON_Y = 0.56;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Periodic seamless cloud noise using circular phase loop
  float fbmClouds(vec2 p, float theta) {
    vec2 loopOffset = vec2(cos(theta), sin(theta)) * 0.65;
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.84, 0.54, -0.54, 0.84);
    for (int i = 0; i < 4; i++) {
      if (u_fastMode > 0.5 && i >= 2) break;
      v += amp * noise2(p + loopOffset * (0.4 + 0.25 * float(i)));
      p = rot * p * 2.05;
      amp *= 0.5;
    }
    return u_fastMode > 0.5 ? v * 1.25 : v;
  }

  vec3 evaluateSky(vec2 uv, float aspect, vec2 sunPos) {
    float skyT = clamp((uv.y - HORIZON_Y) / (1.0 - HORIZON_Y), 0.0, 1.0);

    // Rich 3-stop atmospheric sky gradient
    vec3 skyCol = mix(u_horizon, u_midSky, smoothstep(0.0, 0.44, skyT));
    skyCol = mix(skyCol, u_zenith, smoothstep(0.32, 0.96, skyT));

    // Aspect-corrected vector to sun
    vec2 delta = vec2((uv.x - sunPos.x) * aspect, uv.y - sunPos.y);
    float sunDist = length(delta);

    // Wide atmospheric scattering bloom around the sun
    float broadGlow = exp(-sunDist * 2.7) * u_sunVisible;
    float tightGlow = exp(-sunDist * 9.5) * u_sunVisible;
    float horizonBandGlow = exp(-abs(uv.y - HORIZON_Y) * 14.0) * exp(-abs(uv.x - sunPos.x) * 2.2) * (0.25 + 0.75 * u_sunVisible);

    skyCol += u_sunHalo * (0.48 * broadGlow + 0.42 * horizonBandGlow);
    skyCol = mix(skyCol, u_sunCore, clamp(0.75 * tightGlow, 0.0, 0.88));

    // Crisp solar disc with subtle limb softening (hidden when below horizon)
    float discRadius = 0.044;
    float sunDisc = (1.0 - smoothstep(discRadius - 0.005, discRadius + 0.004, sunDist)) * u_sunVisible;
    skyCol = mix(skyCol, u_sunCore * 1.12, sunDisc * 0.96);

    // Seamless periodic sunset clouds drifting across mid-sky
    float cloudMask = smoothstep(0.05, 0.35, skyT) * (1.0 - smoothstep(0.68, 0.98, skyT));
    if (cloudMask > 0.001) {
      vec2 cloudUv = vec2(
        (uv.x - 0.5) * aspect * 1.45 + 0.22 * cos(u_theta) * 0.35,
        (skyT + 0.12) * 3.6 + 0.10 * sin(u_theta)
      );
      float c1 = fbmClouds(cloudUv, u_theta);
      float c2 = u_fastMode > 0.5 ? c1 : fbmClouds(cloudUv * 1.85 + vec2(3.2, 1.7), u_theta);
      float density = smoothstep(0.49, 0.78, c1 * 0.7 + c2 * 0.3) * cloudMask;

      float sunAlign = exp(-sunDist * 2.3);
      vec3 cColor = mix(u_cloudShadow, u_cloudLit, clamp(0.28 + 0.78 * sunAlign + 0.35 * (1.0 - skyT), 0.0, 1.0));
      // Rim-light underside of clouds near sun
      float underside = smoothstep(0.45, 0.75, c1) * sunAlign;
      cColor += u_sunHalo * underside * 0.35;
      skyCol = mix(skyCol, cColor, density * 0.56);
    }

    return skyCol;
  }

  // Computes wave height and analytical derivatives (dh/dx, dh/dz) using integer-locked harmonics
  void sampleWaveField(vec2 worldPos, float dist, float theta, out float dhdx, out float dhdz) {
    dhdx = 0.0;
    dhdz = 0.0;

    // 1. Primary shoreward swells (2 cycles per loop)
    float p1 = worldPos.x * 0.42 + worldPos.y * 2.65 - 2.0 * theta;
    float a1 = 0.16;
    dhdx += cos(p1) * a1 * 0.42;
    dhdz += cos(p1) * a1 * 2.65;

    // 2. Cross-swell diagonal rollers (3 cycles per loop)
    float p2 = -worldPos.x * 0.78 + worldPos.y * 3.90 - 3.0 * theta + 1.1;
    float a2 = 0.115;
    dhdx += cos(p2) * a2 * (-0.78);
    dhdz += cos(p2) * a2 * 3.90;

    // 3. Mid-frequency chop (5 cycles per loop)
    float p3 = worldPos.x * 1.65 + worldPos.y * 6.80 - 5.0 * theta + 2.4;
    float a3 = 0.072;
    dhdx += cos(p3) * a3 * 1.65;
    dhdz += cos(p3) * a3 * 6.80;

    if (u_fastMode > 0.5) return;

    // 4. Opposing cross-ripples that break specular bars into shifting shards (7 cycles per loop)
    float p4 = -worldPos.x * 2.45 + worldPos.y * 9.50 - 7.0 * theta + 0.7;
    float a4 = 0.048;
    dhdx += cos(p4) * a4 * (-2.45);
    dhdz += cos(p4) * a4 * 9.50;

    // 5. Fine capillary shimmer (11 & 13 cycles per loop, attenuated gracefully with distance to avoid aliasing)
    float distFade = 1.0 / (1.0 + dist * 0.085);
    float p5 = worldPos.x * 4.90 + worldPos.y * 16.5 - 11.0 * theta + sin(worldPos.x * 1.4) * 0.9;
    float a5 = 0.025 * distFade;
    dhdx += cos(p5) * a5 * 4.90;
    dhdz += cos(p5) * a5 * 16.5;

    float p6 = -worldPos.x * 6.10 + worldPos.y * 23.0 - 13.0 * theta + 1.9;
    float a6 = 0.017 * distFade;
    dhdx += cos(p6) * a6 * (-6.10);
    dhdz += cos(p6) * a6 * 23.0;
  }

  // Computes subtle refractive heat-haze UV offset tightly localized around HORIZON_Y
  vec2 applyHorizonHeatHaze(vec2 uv, float aspect, vec2 sunPos, out float hazeBand, out float sunHeatFactor) {
    float distToHorizon = abs(uv.y - HORIZON_Y);
    hazeBand = exp(-distToHorizon * 54.0);
    float azFocus = exp(-abs(uv.x - sunPos.x) * aspect * 1.85);
    float lowSunBoost = 0.42 + 0.58 * exp(-abs(u_sunElev) * 12.0);
    sunHeatFactor = (0.32 + 0.68 * azFocus) * (0.35 + 0.65 * u_sunVisible) * lowSunBoost;

    if (hazeBand < 0.01) {
      return uv;
    }

    float w1 = sin(uv.y * 255.0 - u_waveTheta * 5.0 + uv.x * 18.0 * aspect);
    float w2 = u_fastMode > 0.5
      ? 0.0
      : 0.55 * cos(uv.y * 410.0 - u_waveTheta * 8.0 - uv.x * 29.0 * aspect);
    float rippleX = (w1 + w2) * 0.00145 * hazeBand * sunHeatFactor;
    float rippleY = sin(uv.x * 36.0 * aspect + u_waveTheta * 4.0) * 0.00075 * hazeBand * sunHeatFactor;

    return vec2(
      clamp(uv.x + rippleX, 0.0, 1.0),
      clamp(uv.y + rippleY, 0.0, 1.0)
    );
  }

  void main() {
    vec2 uv = v_uv;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 sunPos = vec2(u_sunX, HORIZON_Y + u_sunElev);

    float hazeBand = 0.0;
    float sunHeatFactor = 0.0;
    vec2 shimmerUv = applyHorizonHeatHaze(uv, aspect, sunPos, hazeBand, sunHeatFactor);

    if (uv.y >= HORIZON_Y) {
      vec2 skySampleUv = vec2(shimmerUv.x, max(shimmerUv.y, HORIZON_Y));
      vec3 skyCol = evaluateSky(skySampleUv, aspect, sunPos);

      // Delicate warm mirage shimmer veil right on top of the horizon line
      float shimmerCrest = 0.5 + 0.5 * sin(uv.x * 42.0 * aspect + u_waveTheta * 3.0 + sin(uv.y * 190.0 - u_waveTheta * 6.0));
      skyCol += mix(u_horizon, u_sunHalo, 0.55) * (0.085 * hazeBand * sunHeatFactor * (0.55 + 0.45 * shimmerCrest));

      gl_FragColor = vec4(clamp(skyCol, 0.0, 1.0), 1.0);
      return;
    }

    // Water perspective mapping (with subtle convective horizon refraction)
    float below = max(HORIZON_Y - shimmerUv.y, HORIZON_Y - uv.y * 0.0 - HORIZON_Y + (HORIZON_Y - uv.y) * 0.35);
    below = max(HORIZON_Y - mix(uv.y, shimmerUv.y, 0.65), 0.0015);
    float dist = 0.25 / max(below, 0.0022);
    float wx = (shimmerUv.x - 0.5) * aspect * dist * 1.25;
    float wz = dist;

    float dhdx = 0.0;
    float dhdz = 0.0;
    sampleWaveField(vec2(wx, wz), dist, u_waveTheta, dhdx, dhdz);

    // Anisotropic wave normal: slight X attenuation keeps horizontal glint ribbons crisp
    vec3 N = normalize(vec3(-dhdx * 0.58, 1.0, -dhdz * 0.72));

    // View vector from surface to camera
    vec3 V = normalize(vec3(-(shimmerUv.x - 0.5) * aspect * 0.9, max(below * 1.65, 0.06), 1.0));

    // Sun direction vector
    vec3 L = normalize(vec3((sunPos.x - 0.5) * aspect * 0.9, u_sunElev * 1.75 + 0.06, 1.0));

    // Reflected view ray for sky & broken solar specular
    vec3 R = reflect(-V, N);
    vec2 reflUv = vec2(
      clamp(shimmerUv.x + R.x * 0.16, 0.0, 1.0),
      clamp(HORIZON_Y + abs(R.y) * 0.45, HORIZON_Y + 0.002, 0.98)
    );
    vec3 skyRefl = evaluateSky(reflUv, aspect, sunPos);

    // Schlick Fresnel
    float ndotv = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = 0.05 + 0.95 * pow(1.0 - ndotv, 4.2);

    // Base water body color transitioning from deep swells to translucent shore water
    float shoreFactor = smoothstep(0.56, 0.06, uv.y);
    vec3 bodyCol = mix(u_deepWater, u_midWater, smoothstep(0.02, 0.30, below));
    bodyCol = mix(bodyCol, u_shallowWater, shoreFactor * 0.65);

    // Subtle subsurface golden-amber transmission when wave faces tilt toward viewer
    float faceTilt = smoothstep(-0.18, 0.32, dhdz);
    bodyCol += u_sunHalo * (0.09 * (1.0 - shoreFactor) * (1.0 - faceTilt));

    vec3 waterCol = mix(bodyCol, skyRefl, fresnel * 0.78);

    // Broken Sun Reflection Glitter Path:
    // Combine specular alignment with explicit wave-slope gating so shadowed wave troughs
    // cleanly slice through the golden path instead of forming a solid bar.
    float specAlign = max(dot(R, L), 0.0);
    float facetMask = smoothstep(-0.08, 0.18, dhdz);
    float crossBreak = smoothstep(-0.32, 0.28, sin(wx * 2.1 + wz * 1.3 - 3.0 * u_waveTheta) + 0.45 * cos(wx * 4.3 - 5.0 * u_waveTheta));

    float sharpGlint = pow(specAlign, 220.0) * (0.35 + 0.65 * facetMask);
    float warmShard = pow(specAlign, 34.0) * facetMask * (0.35 + 0.65 * crossBreak);
    float broadShimmer = pow(specAlign, 9.0) * (0.14 + 0.35 * facetMask);

    // Narrow horizon scatter widening organically closer to shore
    float azDist = abs(shimmerUv.x - sunPos.x) * aspect;
    float corridor = exp(-azDist * mix(8.5, 2.8, shoreFactor));

    vec3 glitter =
      u_sunCore * sharpGlint * 1.45 +
      u_sunHalo * (warmShard * 0.92 + broadShimmer * 0.28 * corridor);

    waterCol += glitter * u_sunVisible * (0.65 + 0.35 * (1.0 - shoreFactor));

    // Distant horizon atmospheric haze & convective heat shimmer blend
    float horizonMist = exp(-below * 52.0);
    float horizonShimmer = 0.5 + 0.5 * sin(uv.x * 38.0 * aspect - u_waveTheta * 4.0 + uv.y * 220.0);
    vec3 mistCol = mix(u_horizon, u_sunHalo, 0.30 * exp(-azDist * 3.0));
    waterCol = mix(waterCol, mistCol, horizonMist * (0.72 + 0.12 * sunHeatFactor * horizonShimmer));

    // Smooth blend into damp reflective wet-sand zone near very bottom
    float sandZone = smoothstep(0.14, 0.01, uv.y);
    vec3 sandBase = mix(u_wetSand, skyRefl * 0.55 + u_wetSand * 0.45, 0.42);
    sandBase += u_sunHalo * pow(specAlign, 18.0) * 0.22 * corridor;
    waterCol = mix(waterCol, sandBase, sandZone * 0.85);

    gl_FragColor = vec4(clamp(waterCol, 0.0, 1.0), 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createOceanShaderRenderer(canvas: HTMLCanvasElement): OceanShaderRenderer | null {
  const gl =
    canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    }) ||
    canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });

  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    theta: gl.getUniformLocation(program, 'u_theta'),
    waveTheta: gl.getUniformLocation(program, 'u_waveTheta'),
    sunX: gl.getUniformLocation(program, 'u_sunX'),
    sunElev: gl.getUniformLocation(program, 'u_sunElev'),
    sunVisible: gl.getUniformLocation(program, 'u_sunVisible'),
    fastMode: gl.getUniformLocation(program, 'u_fastMode'),
    zenith: gl.getUniformLocation(program, 'u_zenith'),
    midSky: gl.getUniformLocation(program, 'u_midSky'),
    horizon: gl.getUniformLocation(program, 'u_horizon'),
    sunCore: gl.getUniformLocation(program, 'u_sunCore'),
    sunHalo: gl.getUniformLocation(program, 'u_sunHalo'),
    cloudLit: gl.getUniformLocation(program, 'u_cloudLit'),
    cloudShadow: gl.getUniformLocation(program, 'u_cloudShadow'),
    deepWater: gl.getUniformLocation(program, 'u_deepWater'),
    midWater: gl.getUniformLocation(program, 'u_midWater'),
    shallowWater: gl.getUniformLocation(program, 'u_shallowWater'),
    wetSand: gl.getUniformLocation(program, 'u_wetSand'),
  };

  return {
    render(width: number, height: number, state: SunsetPaletteState, fastMode = false) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);

      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform1f(uniforms.theta, state.driftTheta);
      gl.uniform1f(uniforms.waveTheta, state.waveTheta);
      gl.uniform1f(uniforms.sunX, state.sunXNorm);
      gl.uniform1f(uniforms.sunElev, state.sunElevation);
      gl.uniform1f(uniforms.sunVisible, state.sunVisible);
      gl.uniform1f(uniforms.fastMode, fastMode ? 1.0 : 0.0);
      gl.uniform3fv(uniforms.zenith, state.zenith);
      gl.uniform3fv(uniforms.midSky, state.midSky);
      gl.uniform3fv(uniforms.horizon, state.horizon);
      gl.uniform3fv(uniforms.sunCore, state.sunCore);
      gl.uniform3fv(uniforms.sunHalo, state.sunHalo);
      gl.uniform3fv(uniforms.cloudLit, state.cloudLit);
      gl.uniform3fv(uniforms.cloudShadow, state.cloudShadow);
      gl.uniform3fv(uniforms.deepWater, state.deepWater);
      gl.uniform3fv(uniforms.midWater, state.midWater);
      gl.uniform3fv(uniforms.shallowWater, state.shallowWater);
      gl.uniform3fv(uniforms.wetSand, state.wetSand);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
