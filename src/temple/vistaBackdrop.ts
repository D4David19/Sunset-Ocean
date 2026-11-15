import * as THREE from 'three';

export interface VistaBackdrop {
  group: THREE.Group;
  setBiomeColors: (palette: {
    zenith: THREE.Color;
    mid: THREE.Color;
    horizon: THREE.Color;
    sunGlow: THREE.Color;
    peakNear: THREE.Color;
    peakFar: THREE.Color;
    beam: THREE.Color;
  }) => void;
  update: (playerZ: number, elapsed: number) => void;
  dispose: () => void;
}

function createSunbeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const gradH = ctx.createLinearGradient(0, 0, 128, 0);
  gradH.addColorStop(0, 'rgba(255, 224, 145, 0)');
  gradH.addColorStop(0.5, 'rgba(255, 224, 145, 0.48)');
  gradH.addColorStop(1, 'rgba(255, 224, 145, 0)');
  ctx.fillStyle = gradH;
  ctx.fillRect(0, 0, 128, 256);

  ctx.globalCompositeOperation = 'destination-in';
  const gradV = ctx.createLinearGradient(0, 0, 0, 256);
  gradV.addColorStop(0, 'rgba(255,255,255,0)');
  gradV.addColorStop(0.25, 'rgba(255,255,255,0.95)');
  gradV.addColorStop(0.8, 'rgba(255,255,255,0.45)');
  gradV.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradV;
  ctx.fillRect(0, 0, 128, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCloudNoiseTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const hash2 = (ix: number, iy: number, seed: number) => {
    const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };

  const smoothTileNoise = (u: number, v: number, freqX: number, freqY: number, seed: number) => {
    const gx = u * freqX;
    const gy = v * freqY;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const wx0 = ((x0 % freqX) + freqX) % freqX;
    const wx1 = (wx0 + 1) % freqX;
    const wy0 = ((y0 % freqY) + freqY) % freqY;
    const wy1 = (wy0 + 1) % freqY;

    const a = hash2(wx0, wy0, seed);
    const b = hash2(wx1, wy0, seed);
    const c = hash2(wx0, wy1, seed);
    const d = hash2(wx1, wy1, seed);
    const top = a + (b - a) * sx;
    const bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  };

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const n =
        smoothTileNoise(u, v, 4, 2, 1) * 0.52 +
        smoothTileNoise(u, v, 8, 4, 2) * 0.26 +
        smoothTileNoise(u, v, 16, 8, 3) * 0.14 +
        smoothTileNoise(u, v, 32, 16, 4) * 0.08;
      const val = Math.max(0, Math.min(255, Math.round(n * 255)));
      const idx = (y * w + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function createVistaBackdrop(): VistaBackdrop {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const tg = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const tm = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Sunset-to-Emerald Jungle Sky Dome with Pre-Baked Seamless Drifting Lit Clouds
  const cloudTex = createCloudNoiseTexture();
  textures.push(cloudTex);

  const skyGeo = tg(new THREE.SphereGeometry(245, 24, 16));
  const skyMat = tm(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCloudTex: { value: cloudTex },
        uZenith: { value: new THREE.Color(0x0c2124) },
        uMid: { value: new THREE.Color(0x275148) },
        uHorizon: { value: new THREE.Color(0xd67e46) },
        uSunGlow: { value: new THREE.Color(0xffca7a) },
        uSunDir: { value: new THREE.Vector3(0.26, 0.19, -0.94).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uCloudTex;
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunGlow;
        uniform vec3 uSunDir;
        varying vec3 vDir;

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, -0.05, 1.0);

          vec3 sky = mix(uHorizon, uMid, smoothstep(-0.02, 0.24, h));
          sky = mix(sky, uZenith, smoothstep(0.2, 0.78, h));

          float sunAlign = max(dot(dir, uSunDir), 0.0);
          sky += uSunGlow * pow(sunAlign, 6.0) * 0.42;
          sky += vec3(1.0, 0.93, 0.76) * smoothstep(0.9965, 0.9993, sunAlign) * 1.1;

          // Fast pre-baked tiled cloud lookup above horizon
          if (dir.y > 0.02) {
            vec2 cloudUv = dir.xz / (dir.y + 0.28) * 0.22 + vec2(uTime * 0.004, -uTime * 0.0025);
            float n1 = texture2D(uCloudTex, cloudUv).r;
            float n2 = texture2D(uCloudTex, cloudUv * 1.85 + vec2(uTime * 0.003, 0.31)).r;
            float n = n1 * 0.65 + n2 * 0.35;
            float cloudMask = smoothstep(0.47, 0.76, n) * smoothstep(0.02, 0.16, dir.y) * smoothstep(0.72, 0.2, dir.y);
            vec3 cloudDark = vec3(0.18, 0.29, 0.30);
            vec3 cloudLit = mix(vec3(0.95, 0.58, 0.36), vec3(1.0, 0.87, 0.62), pow(sunAlign, 2.5));
            float rim = smoothstep(0.45, 0.72, n) * (0.35 + 0.65 * pow(sunAlign, 1.8));
            vec3 cloudCol = mix(cloudDark, cloudLit, rim);
            sky = mix(sky, cloudCol, cloudMask * 0.72);
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  group.add(skyMesh);

  // 2. Layered Sculpted Mountain Ridges (craggy multi-facet silhouette instead of bare cones)
  const ridgeNearMat = tm(
    new THREE.MeshStandardMaterial({
      color: 0x1d3b34,
      roughness: 0.95,
      flatShading: true,
      fog: false,
    })
  );
  const ridgeFarMat = tm(
    new THREE.MeshStandardMaterial({
      color: 0x385249,
      roughness: 0.95,
      flatShading: true,
      fog: false,
    })
  );

  const buildCraggyPeakGeo = (radius: number, height: number, seed: number) => {
    const geo = new THREE.ConeGeometry(radius, height, 11, 5);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const hNorm = (vy + height * 0.5) / height;
      const radial = Math.hypot(vx, vz);
      if (radial > 0.1 && hNorm < 0.95) {
        const jag =
          Math.sin(vx * 0.25 + seed) * 3.8 +
          Math.cos(vz * 0.28 + seed * 1.7) * 3.2;
        const factor = 1 + (jag / Math.max(8, radius)) * (1 - hNorm * 0.6);
        pos.setX(i, vx * factor);
        pos.setZ(i, vz * factor);
        pos.setY(i, vy + Math.sin(vx * 0.15 + seed) * 2.2 * (1 - hNorm));
      }
    }
    geo.computeVertexNormals();
    return tg(geo);
  };

  const farPeakGeoA = buildCraggyPeakGeo(32, 54, 1.3);
  const farPeakGeoB = buildCraggyPeakGeo(28, 46, 4.7);
  const farPeaks: Array<[number, number, number, number, number]> = [
    [-115, -6, -188, 1.45, 1.25],
    [-68, -4, -196, 1.25, 1.08],
    [-20, -8, -205, 1.55, 0.98],
    [32, -5, -200, 1.38, 1.18],
    [88, -3, -192, 1.48, 1.32],
    [132, -7, -184, 1.28, 1.04],
  ];
  farPeaks.forEach(([px, py, pz, sx, sy], idx) => {
    const peak = new THREE.Mesh(idx % 2 === 0 ? farPeakGeoA : farPeakGeoB, ridgeFarMat);
    peak.position.set(px, py, pz);
    peak.scale.set(sx, sy, 1);
    peak.rotation.y = px * 0.05;
    group.add(peak);
  });

  const nearPeaks: Array<[number, number, number, number, number]> = [
    [-92, -10, -152, 1.15, 1.04],
    [-46, -12, -162, 0.98, 0.88],
    [52, -11, -160, 1.04, 0.94],
    [98, -9, -148, 1.24, 1.08],
  ];
  nearPeaks.forEach(([px, py, pz, sx, sy], idx) => {
    const peak = new THREE.Mesh(idx % 2 === 0 ? farPeakGeoB : farPeakGeoA, ridgeNearMat);
    peak.position.set(px, py, pz);
    peak.scale.set(sx, sy, 1);
    peak.rotation.y = px * 0.08;
    group.add(peak);
  });

  // 3. Distant Ancient Stepped Temple Pyramids
  const pyramidMat = tm(
    new THREE.MeshStandardMaterial({
      color: 0x48584a,
      emissive: 0x2a2419,
      emissiveIntensity: 0.35,
      roughness: 0.9,
      fog: false,
    })
  );
  const pyramidGlowMat = tm(
    new THREE.MeshBasicMaterial({
      color: 0xffb85c,
      fog: false,
    })
  );

  const tierGeo = tg(new THREE.BoxGeometry(1, 1, 1));
  const addPyramid = (x: number, y: number, z: number, scale: number) => {
    const pyr = new THREE.Group();
    pyr.position.set(x, y, z);
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const w = (steps - s) * 6.5 * scale;
      const h = 3.2 * scale;
      const tier = new THREE.Mesh(tierGeo, pyramidMat);
      tier.scale.set(w, h, w);
      tier.position.y = s * h + h * 0.5;
      pyr.add(tier);
    }
    // Summit altar & warm brazier glow
    const shrine = new THREE.Mesh(tierGeo, pyramidMat);
    shrine.scale.set(4.5 * scale, 3.6 * scale, 4.5 * scale);
    shrine.position.y = steps * 3.2 * scale + 1.8 * scale;
    pyr.add(shrine);

    const glow = new THREE.Mesh(tierGeo, pyramidGlowMat);
    glow.scale.set(1.4 * scale, 1.1 * scale, 1.4 * scale);
    glow.position.y = steps * 3.2 * scale + 4.1 * scale;
    pyr.add(glow);

    group.add(pyr);
  };

  addPyramid(-52, -4, -142, 0.95);
  addPyramid(58, -2, -162, 1.15);
  addPyramid(-14, -7, -182, 0.85);

  // 4. Diagonal Golden Sunbeams (God-Rays)
  const beamTex = createSunbeamTexture();
  textures.push(beamTex);
  const beamGeo = tg(new THREE.PlaneGeometry(18, 86));
  const beamMat = tm(
    new THREE.MeshBasicMaterial({
      map: beamTex,
      color: 0xffd788,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
  );

  const beams: THREE.Mesh[] = [];
  const beamConfigs: Array<[number, number, number, number]> = [
    [-26, 22, -110, -0.38],
    [-6, 26, -128, -0.35],
    [16, 24, -118, -0.36],
    [34, 21, -135, -0.4],
  ];
  for (const [bx, by, bz, rz] of beamConfigs) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, by, bz);
    beam.rotation.z = rz;
    group.add(beam);
    beams.push(beam);
  }

  return {
    group,
    setBiomeColors: (palette) => {
      skyMat.uniforms.uZenith.value.copy(palette.zenith);
      skyMat.uniforms.uMid.value.copy(palette.mid);
      skyMat.uniforms.uHorizon.value.copy(palette.horizon);
      skyMat.uniforms.uSunGlow.value.copy(palette.sunGlow);
      ridgeNearMat.color.copy(palette.peakNear);
      ridgeFarMat.color.copy(palette.peakFar);
      beamMat.color.copy(palette.beam);
    },
    update: (playerZ: number, elapsed: number) => {
      group.position.set(0, 0, playerZ);
      skyMat.uniforms.uTime.value = elapsed;
      beamMat.opacity = 0.13 + Math.sin(elapsed * 0.55) * 0.035;
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
