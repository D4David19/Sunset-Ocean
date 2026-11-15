import * as THREE from 'three';

const MAX_PARTICLES = 640;

export interface ParticlePool {
  points: THREE.Points;
  spawnDust: (x: number, y: number, z: number, count?: number, spread?: number) => void;
  spawnDoubleJumpRing: (x: number, y: number, z: number) => void;
  spawnEmber: (x: number, y: number, z: number) => void;
  spawnMist: (x: number, y: number, z: number) => void;
  spawnCoinBurst: (x: number, y: number, z: number) => void;
  spawnSpeedTrail: (x: number, y: number, z: number) => void;
  spawnMagnetPulse: (x: number, y: number, z: number, angle: number) => void;
  spawnFeverBurst: (x: number, y: number, z: number) => void;
  spawnShieldOrb: (x: number, y: number, z: number, angle: number) => void;
  spawnShieldShatter: (x: number, y: number, z: number) => void;
  spawnDamageBurst: (x: number, y: number, z: number) => void;
  spawnFirefly: (x: number, y: number, z: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createParticlePool(sprite: THREE.Texture): ParticlePool {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const ages = new Float32Array(MAX_PARTICLES);
  const lifetimes = new Float32Array(MAX_PARTICLES);
  const gravities = new Float32Array(MAX_PARTICLES);
  const baseColors = new Float32Array(MAX_PARTICLES * 3);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    positions[i * 3 + 1] = -9999;
    ages[i] = 10;
    lifetimes[i] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('color', colAttr);

  const material = new THREE.PointsMaterial({
    size: 0.44,
    map: sprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  let cursor = 0;

  const alloc = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    life: number,
    gravity: number
  ) => {
    const idx = cursor;
    cursor = (cursor + 1) % MAX_PARTICLES;
    const i3 = idx * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    velocities[i3] = vx;
    velocities[i3 + 1] = vy;
    velocities[i3 + 2] = vz;
    baseColors[i3] = r;
    baseColors[i3 + 1] = g;
    baseColors[i3 + 2] = b;
    colors[i3] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;
    ages[idx] = 0;
    lifetimes[idx] = life;
    gravities[idx] = gravity;
  };

  const spawnDust = (x: number, y: number, z: number, count = 4, spread = 0.35) => {
    for (let i = 0; i < count; i++) {
      alloc(
        x + (Math.random() - 0.5) * spread,
        y + Math.random() * 0.14,
        z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 1.4,
        0.5 + Math.random() * 1.1,
        1.2 + Math.random() * 1.8,
        0.74,
        0.65,
        0.48,
        0.42 + Math.random() * 0.25,
        -1.1
      );
    }
  };

  const spawnDoubleJumpRing = (x: number, y: number, z: number) => {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const spd = 2.6 + Math.random() * 0.7;
      alloc(
        x + Math.cos(ang) * 0.25,
        y + 0.08,
        z + Math.sin(ang) * 0.25,
        Math.cos(ang) * spd,
        -0.35 + Math.random() * 0.25,
        Math.sin(ang) * spd,
        0.58,
        0.96,
        0.9,
        0.36,
        -0.8
      );
    }
  };

  const spawnEmber = (x: number, y: number, z: number) => {
    const hot = Math.random();
    alloc(
      x + (Math.random() - 0.5) * 0.16,
      y + Math.random() * 0.12,
      z + (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.5,
      1.2 + Math.random() * 1.3,
      (Math.random() - 0.5) * 0.5,
      1.0,
      0.42 + hot * 0.45,
      0.08 + hot * 0.12,
      0.55 + Math.random() * 0.45,
      0.45
    );
  };

  const spawnMist = (x: number, y: number, z: number) => {
    alloc(
      x + (Math.random() - 0.5) * 1.8,
      y + Math.random() * 0.8,
      z + (Math.random() - 0.5) * 1.8,
      (Math.random() - 0.5) * 0.8,
      0.85 + Math.random() * 1.1,
      (Math.random() - 0.5) * 0.8,
      0.72,
      0.9,
      0.92,
      0.9 + Math.random() * 0.65,
      0.15
    );
  };

  const spawnCoinBurst = (x: number, y: number, z: number) => {
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 1.6 + Math.random() * 2.4;
      alloc(
        x,
        y,
        z,
        Math.cos(ang) * spd,
        1.2 + Math.random() * 2.2,
        Math.sin(ang) * spd,
        1.0,
        0.84,
        0.24,
        0.45 + Math.random() * 0.25,
        -4.5
      );
    }
  };

  const spawnSpeedTrail = (x: number, y: number, z: number) => {
    for (let i = 0; i < 3; i++) {
      const hot = Math.random();
      alloc(
        x + (Math.random() - 0.5) * 0.55,
        y + 0.3 + Math.random() * 1.15,
        z + 0.25 + Math.random() * 0.25,
        (Math.random() - 0.5) * 0.8,
        0.2 + Math.random() * 0.6,
        5.5 + Math.random() * 4.5,
        1.0,
        0.72 + hot * 0.25,
        0.18 + hot * 0.28,
        0.28 + Math.random() * 0.18,
        0.2
      );
    }
  };

  const spawnMagnetPulse = (x: number, y: number, z: number, angle: number) => {
    const r = 0.78;
    alloc(
      x + Math.cos(angle) * r,
      y + 0.92 + Math.cos(angle * 2) * 0.26,
      z + Math.sin(angle) * r,
      Math.cos(angle) * 0.65,
      0.55,
      Math.sin(angle) * 0.65,
      0.92,
      0.48,
      0.98,
      0.34,
      0.15
    );
  };

  const spawnFeverBurst = (x: number, y: number, z: number) => {
    for (let i = 0; i < 24; i++) {
      const phi = (i / 24) * Math.PI * 2;
      const spd = 2.8 + Math.random() * 3.4;
      alloc(
        x,
        y + 0.85,
        z,
        Math.cos(phi) * spd,
        1.8 + Math.random() * 2.8,
        Math.sin(phi) * spd,
        1.0,
        0.86,
        0.26,
        0.52 + Math.random() * 0.28,
        -4.2
      );
    }
  };

  const spawnShieldOrb = (x: number, y: number, z: number, angle: number) => {
    const r = 0.82;
    alloc(
      x + Math.cos(angle) * r,
      y + 0.85 + Math.sin(angle * 2) * 0.32,
      z + Math.sin(angle) * r,
      -Math.sin(angle) * 0.8,
      0.45,
      Math.cos(angle) * 0.8,
      0.24,
      0.95,
      0.84,
      0.34,
      0.1
    );
  };

  const spawnShieldShatter = (x: number, y: number, z: number) => {
    for (let i = 0; i < 28; i++) {
      const phi = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.35) * Math.PI;
      const spd = 3.2 + Math.random() * 3.8;
      alloc(
        x,
        y + 0.9,
        z,
        Math.cos(phi) * Math.cos(elev) * spd,
        Math.sin(elev) * spd + 1.5,
        Math.sin(phi) * Math.cos(elev) * spd,
        0.28,
        0.96,
        0.86,
        0.55 + Math.random() * 0.3,
        -6.5
      );
    }
  };

  const spawnDamageBurst = (x: number, y: number, z: number) => {
    for (let i = 0; i < 20; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 3.0;
      alloc(
        x,
        y + 0.85,
        z,
        Math.cos(ang) * spd,
        1.4 + Math.random() * 2.4,
        Math.sin(ang) * spd,
        1.0,
        0.32,
        0.22,
        0.5 + Math.random() * 0.25,
        -6.0
      );
    }
  };

  const spawnFirefly = (x: number, y: number, z: number) => {
    alloc(
      x,
      y,
      z,
      (Math.random() - 0.5) * 0.45,
      0.18 + Math.random() * 0.35,
      (Math.random() - 0.5) * 0.45,
      0.95,
      0.92,
      0.46,
      1.8 + Math.random() * 1.4,
      0.04
    );
  };

  const update = (dt: number) => {
    const clampedDt = Math.min(dt, 0.05);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life = lifetimes[i];
      if (ages[i] >= life) {
        positions[i * 3 + 1] = -9999;
        continue;
      }
      ages[i] += clampedDt;
      const t = ages[i] / life;
      if (t >= 1) {
        positions[i * 3 + 1] = -9999;
        continue;
      }

      const i3 = i * 3;
      velocities[i3 + 1] += gravities[i] * clampedDt;
      positions[i3] += velocities[i3] * clampedDt;
      positions[i3 + 1] += velocities[i3 + 1] * clampedDt;
      positions[i3 + 2] += velocities[i3 + 2] * clampedDt;

      const fade = 1 - t;
      colors[i3] = baseColors[i3] * fade;
      colors[i3 + 1] = baseColors[i3 + 1] * fade;
      colors[i3 + 2] = baseColors[i3 + 2] * fade;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  return {
    points,
    spawnDust,
    spawnDoubleJumpRing,
    spawnEmber,
    spawnMist,
    spawnCoinBurst,
    spawnSpeedTrail,
    spawnMagnetPulse,
    spawnFeverBurst,
    spawnShieldOrb,
    spawnShieldShatter,
    spawnDamageBurst,
    spawnFirefly,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
