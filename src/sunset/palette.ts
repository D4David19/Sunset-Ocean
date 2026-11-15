import type { BrokenArrowSolarState } from './brokenArrowSolar';

export type RGB = [number, number, number];

export interface SunsetPaletteState {
  phase: number;
  theta: number;
  wavePhase: number;
  waveTheta: number;
  driftPhase: number;
  driftTheta: number;
  sunXNorm: number;
  sunElevation: number; // height above horizon in normalized viewport units
  sunVisible: number; // 0 = below horizon / dark night, 1 = full solar disc
  starStrength: number; // 0..1
  moonStrength: number; // 0..1
  moonPhaseFraction: number; // 0=New, 0.25=First Qtr, 0.5=Full, 0.75=Last Qtr
  bioStrength: number; // 0..1
  zenith: RGB;
  midSky: RGB;
  horizon: RGB;
  sunCore: RGB;
  sunHalo: RGB;
  cloudLit: RGB;
  cloudShadow: RGB;
  deepWater: RGB;
  midWater: RGB;
  shallowWater: RGB;
  crestRim: RGB;
  foamTint: RGB;
  wetSand: RGB;
}

interface PaletteKeyframe {
  zenith: RGB;
  midSky: RGB;
  horizon: RGB;
  sunCore: RGB;
  sunHalo: RGB;
  cloudLit: RGB;
  cloudShadow: RGB;
  deepWater: RGB;
  midWater: RGB;
  shallowWater: RGB;
  crestRim: RGB;
  foamTint: RGB;
  wetSand: RGB;
  sunElevation: number;
}

function hex(value: string): RGB {
  const clean = value.replace('#', '');
  const n = parseInt(clean, 16);
  return [
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Six seamless keyframes cycling through:
// 1. Bright amber afternoon -> 2. Warm copper sunset -> 3. Molten gold & coral rose ->
// 4. Crimson dusk & deep plum -> 5. Twilight indigo & violet -> 6. Soft apricot & rose dawn
const KEYFRAMES: PaletteKeyframe[] = [
  {
    // 0.00 - Bright amber afternoon
    zenith: hex('#375888'),
    midSky: hex('#C97B59'),
    horizon: hex('#F7C578'),
    sunCore: hex('#FFF9DE'),
    sunHalo: hex('#FFD57E'),
    cloudLit: hex('#FFE4AD'),
    cloudShadow: hex('#82586D'),
    deepWater: hex('#0E2340'),
    midWater: hex('#1C3D5E'),
    shallowWater: hex('#4D5D73'),
    crestRim: hex('#FFE2A8'),
    foamTint: hex('#FFF0D4'),
    wetSand: hex('#3B3136'),
    sunElevation: 0.095,
  },
  {
    // 0.167 - Warm copper sunset
    zenith: hex('#2C3B6E'),
    midSky: hex('#CE5F47'),
    horizon: hex('#F5A254'),
    sunCore: hex('#FFF3C4'),
    sunHalo: hex('#FFAE52'),
    cloudLit: hex('#FFC885'),
    cloudShadow: hex('#6A3D58'),
    deepWater: hex('#0B1B36'),
    midWater: hex('#1A2E50'),
    shallowWater: hex('#4F455C'),
    crestRim: hex('#FFC778'),
    foamTint: hex('#FFE1BA'),
    wetSand: hex('#34252E'),
    sunElevation: 0.078,
  },
  {
    // 0.333 - Molten gold & coral rose
    zenith: hex('#24224F'),
    midSky: hex('#C24861'),
    horizon: hex('#FF965E'),
    sunCore: hex('#FFEAB3'),
    sunHalo: hex('#FF8652'),
    cloudLit: hex('#FFA87D'),
    cloudShadow: hex('#56284A'),
    deepWater: hex('#09142B'),
    midWater: hex('#182344'),
    shallowWater: hex('#52354D'),
    crestRim: hex('#FFB06E'),
    foamTint: hex('#FFD2B8'),
    wetSand: hex('#2D1F29'),
    sunElevation: 0.062,
  },
  {
    // 0.500 - Crimson dusk & deep plum
    zenith: hex('#151333'),
    midSky: hex('#7E2753'),
    horizon: hex('#DE525A'),
    sunCore: hex('#FFD08F'),
    sunHalo: hex('#E65B50'),
    cloudLit: hex('#EF7D6D'),
    cloudShadow: hex('#36173B'),
    deepWater: hex('#070D21'),
    midWater: hex('#151836'),
    shallowWater: hex('#41223E'),
    crestRim: hex('#F48E6A'),
    foamTint: hex('#F4B8A8'),
    wetSand: hex('#221723'),
    sunElevation: 0.048,
  },
  {
    // 0.667 - Twilight indigo & violet
    zenith: hex('#0D112B'),
    midSky: hex('#3C2452'),
    horizon: hex('#9C476B'),
    sunCore: hex('#FFC484'),
    sunHalo: hex('#C95C6E'),
    cloudLit: hex('#C96E7E'),
    cloudShadow: hex('#201434'),
    deepWater: hex('#050A1C'),
    midWater: hex('#101531'),
    shallowWater: hex('#30203E'),
    crestRim: hex('#DE867A'),
    foamTint: hex('#DFACAF'),
    wetSand: hex('#1B1522'),
    sunElevation: 0.044,
  },
  {
    // 0.833 - Soft apricot & rose dawn
    zenith: hex('#273A6B'),
    midSky: hex('#B55A6C'),
    horizon: hex('#F4A982'),
    sunCore: hex('#FFF2C8'),
    sunHalo: hex('#FFBA84'),
    cloudLit: hex('#FFD3B0'),
    cloudShadow: hex('#643B5C'),
    deepWater: hex('#0B1A34'),
    midWater: hex('#182E4E'),
    shallowWater: hex('#4B435D'),
    crestRim: hex('#FFD2A3'),
    foamTint: hex('#FFE4D0'),
    wetSand: hex('#30252F'),
    sunElevation: 0.072,
  },
];

// Additional solar-altitude keyframes for Broken Arrow, OK 24-hour live sync
const NIGHT_DEEP_FRAME: PaletteKeyframe = {
  zenith: hex('#050817'),
  midSky: hex('#0E1330'),
  horizon: hex('#1D2144'),
  sunCore: hex('#A7B6D9'),
  sunHalo: hex('#3B4978'),
  cloudLit: hex('#3D4B73'),
  cloudShadow: hex('#0B0F24'),
  deepWater: hex('#030714'),
  midWater: hex('#09112A'),
  shallowWater: hex('#192442'),
  crestRim: hex('#8CA6D9'),
  foamTint: hex('#AEF4FF'),
  wetSand: hex('#10131F'),
  sunElevation: -0.04,
};

const DAY_AEGEAN_FRAME: PaletteKeyframe = {
  zenith: hex('#1B4D8C'),
  midSky: hex('#4B8ECA'),
  horizon: hex('#BCE0F0'),
  sunCore: hex('#FFFDF2'),
  sunHalo: hex('#FFE9B0'),
  cloudLit: hex('#FFFBF2'),
  cloudShadow: hex('#8EA8C4'),
  deepWater: hex('#093259'),
  midWater: hex('#145A85'),
  shallowWater: hex('#3386A6'),
  crestRim: hex('#F2FAFF'),
  foamTint: hex('#FFFFFF'),
  wetSand: hex('#61564A'),
  sunElevation: 0.28,
};

const MORNING_SAFFRON_FRAME: PaletteKeyframe = {
  zenith: hex('#2C4F85'),
  midSky: hex('#D18168'),
  horizon: hex('#F9D092'),
  sunCore: hex('#FFFBE0'),
  sunHalo: hex('#FFCF86'),
  cloudLit: hex('#FFE6BF'),
  cloudShadow: hex('#7E5B74'),
  deepWater: hex('#0B2748'),
  midWater: hex('#1A486C'),
  shallowWater: hex('#4D6E82'),
  crestRim: hex('#FFE7BA'),
  foamTint: hex('#FFF5E0'),
  wetSand: hex('#46393A'),
  sunElevation: 0.105,
};

// Smooth periodic Catmull-Rom interpolation across closed keyframe ring
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleColor(key: Exclude<keyof PaletteKeyframe, 'sunElevation'>, pos: number): RGB {
  const n = KEYFRAMES.length;
  const scaled = (((pos % 1) + 1) % 1) * n;
  const i1 = Math.floor(scaled);
  const t = scaled - i1;
  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;

  const k0 = KEYFRAMES[i0][key];
  const k1 = KEYFRAMES[i1][key];
  const k2 = KEYFRAMES[i2][key];
  const k3 = KEYFRAMES[i3][key];

  return [
    clamp01(catmullRom(k0[0], k1[0], k2[0], k3[0], t)),
    clamp01(catmullRom(k0[1], k1[1], k2[1], k3[1], t)),
    clamp01(catmullRom(k0[2], k1[2], k2[2], k3[2], t)),
  ];
}

function sampleScalar(pos: number): number {
  const n = KEYFRAMES.length;
  const scaled = (((pos % 1) + 1) % 1) * n;
  const i1 = Math.floor(scaled);
  const t = scaled - i1;
  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;
  return catmullRom(
    KEYFRAMES[i0].sunElevation,
    KEYFRAMES[i1].sunElevation,
    KEYFRAMES[i2].sunElevation,
    KEYFRAMES[i3].sunElevation,
    t
  );
}

function mixKeyframe(a: PaletteKeyframe, b: PaletteKeyframe, t: number): PaletteKeyframe {
  const u = smoothstep(0, 1, t);
  return {
    zenith: mixRgb(a.zenith, b.zenith, u),
    midSky: mixRgb(a.midSky, b.midSky, u),
    horizon: mixRgb(a.horizon, b.horizon, u),
    sunCore: mixRgb(a.sunCore, b.sunCore, u),
    sunHalo: mixRgb(a.sunHalo, b.sunHalo, u),
    cloudLit: mixRgb(a.cloudLit, b.cloudLit, u),
    cloudShadow: mixRgb(a.cloudShadow, b.cloudShadow, u),
    deepWater: mixRgb(a.deepWater, b.deepWater, u),
    midWater: mixRgb(a.midWater, b.midWater, u),
    shallowWater: mixRgb(a.shallowWater, b.shallowWater, u),
    crestRim: mixRgb(a.crestRim, b.crestRim, u),
    foamTint: mixRgb(a.foamTint, b.foamTint, u),
    wetSand: mixRgb(a.wetSand, b.wetSand, u),
    sunElevation: a.sunElevation + (b.sunElevation - a.sunElevation) * u,
  };
}

export function evaluateSunsetState(
  skyPhase: number,
  wavePhaseInput: number = skyPhase,
  driftPhaseInput: number = skyPhase,
  liveMoonPhaseFraction?: number
): SunsetPaletteState {
  const p = ((skyPhase % 1) + 1) % 1;
  const theta = p * Math.PI * 2;
  const wp = ((wavePhaseInput % 1) + 1) % 1;
  const waveTheta = wp * Math.PI * 2;
  const dp = ((driftPhaseInput % 1) + 1) % 1;
  const driftTheta = dp * Math.PI * 2;

  const starStrength = smoothstep(0.28, 0.56, p) * (1 - smoothstep(0.68, 0.88, p));
  const moonStrength = smoothstep(0.28, 0.52, p) * (1 - smoothstep(0.72, 0.92, p));
  const bioStrength = smoothstep(0.30, 0.55, p) * (1 - smoothstep(0.72, 0.90, p));
  const moonPhaseFraction =
    typeof liveMoonPhaseFraction === 'number'
      ? ((liveMoonPhaseFraction % 1) + 1) % 1
      : ((0.18 + p * 0.28) % 1);

  return {
    phase: p,
    theta,
    wavePhase: wp,
    waveTheta,
    driftPhase: dp,
    driftTheta,
    sunXNorm: 0.5 + 0.022 * Math.sin(theta),
    sunElevation: sampleScalar(p),
    sunVisible: 1.0,
    starStrength,
    moonStrength,
    moonPhaseFraction,
    bioStrength,
    zenith: sampleColor('zenith', p),
    midSky: sampleColor('midSky', p),
    horizon: sampleColor('horizon', p),
    sunCore: sampleColor('sunCore', p),
    sunHalo: sampleColor('sunHalo', p),
    cloudLit: sampleColor('cloudLit', p),
    cloudShadow: sampleColor('cloudShadow', p),
    deepWater: sampleColor('deepWater', p),
    midWater: sampleColor('midWater', p),
    shallowWater: sampleColor('shallowWater', p),
    crestRim: sampleColor('crestRim', p),
    foamTint: sampleColor('foamTint', p),
    wetSand: sampleColor('wetSand', p),
  };
}

export function evaluateBrokenArrowSunsetState(
  solar: BrokenArrowSolarState,
  wavePhaseInput: number,
  driftPhaseInput: number
): SunsetPaletteState {
  const wp = ((wavePhaseInput % 1) + 1) % 1;
  const waveTheta = wp * Math.PI * 2;
  const dp = ((driftPhaseInput % 1) + 1) % 1;
  const driftTheta = dp * Math.PI * 2;
  const p = ((solar.clockDayFraction % 1) + 1) % 1;
  const theta = p * Math.PI * 2;

  const alt = solar.elevationDeg;
  let kf: PaletteKeyframe;

  if (solar.isRising) {
    // Morning branch: Deep Night -> Indigo Twilight -> Rosy-Fingered Dawn -> Saffron Morning -> Aegean High Sun
    if (alt < -12) {
      kf = NIGHT_DEEP_FRAME;
    } else if (alt < -4) {
      kf = mixKeyframe(NIGHT_DEEP_FRAME, KEYFRAMES[4], (alt + 12) / 8);
    } else if (alt < 2) {
      kf = mixKeyframe(KEYFRAMES[4], KEYFRAMES[5], (alt + 4) / 6);
    } else if (alt < 12) {
      kf = mixKeyframe(KEYFRAMES[5], MORNING_SAFFRON_FRAME, (alt - 2) / 10);
    } else if (alt < 32) {
      kf = mixKeyframe(MORNING_SAFFRON_FRAME, DAY_AEGEAN_FRAME, (alt - 12) / 20);
    } else {
      kf = DAY_AEGEAN_FRAME;
    }
  } else {
    // Afternoon / Evening branch: Aegean High Sun -> Amber Afternoon -> Copper Sunset -> Molten Wine-Dark Sea -> Crimson Dusk -> Violet Twilight -> Night
    if (alt >= 30) {
      kf = DAY_AEGEAN_FRAME;
    } else if (alt >= 14) {
      kf = mixKeyframe(KEYFRAMES[0], DAY_AEGEAN_FRAME, (alt - 14) / 16);
    } else if (alt >= 6) {
      kf = mixKeyframe(KEYFRAMES[1], KEYFRAMES[0], (alt - 6) / 8);
    } else if (alt >= 0) {
      kf = mixKeyframe(KEYFRAMES[2], KEYFRAMES[1], alt / 6);
    } else if (alt >= -5) {
      kf = mixKeyframe(KEYFRAMES[3], KEYFRAMES[2], (alt + 5) / 5);
    } else if (alt >= -10) {
      kf = mixKeyframe(KEYFRAMES[4], KEYFRAMES[3], (alt + 10) / 5);
    } else if (alt >= -16) {
      kf = mixKeyframe(NIGHT_DEEP_FRAME, KEYFRAMES[4], (alt + 16) / 6);
    } else {
      kf = NIGHT_DEEP_FRAME;
    }
  }

  // Sun horizontal placement smoothly sweeps across the horizon from east/left toward west/right
  const azOffset = ((solar.azimuthDeg - 180) / 180) * 0.22;
  const sunXNorm = Math.max(0.28, Math.min(0.72, 0.5 + azOffset));

  // Sun elevation maps realistically above horizon during day and dips gently at night
  const sunElevation =
    alt >= 0
      ? 0.036 + Math.sin((Math.min(62, alt) * Math.PI) / 180) * 0.34
      : Math.max(-0.045, 0.036 + (alt / 12) * 0.08);

  const sunVisible = smoothstep(-5.5, 1.5, alt);
  const starStrength = smoothstep(1.5, -10.0, alt);
  const moonStrength = smoothstep(3.5, -6.5, alt);
  const bioStrength = smoothstep(-1.0, -10.5, alt);

  return {
    phase: p,
    theta,
    wavePhase: wp,
    waveTheta,
    driftPhase: dp,
    driftTheta,
    sunXNorm,
    sunElevation,
    sunVisible,
    starStrength,
    moonStrength,
    moonPhaseFraction: solar.lunar.phaseFraction,
    bioStrength,
    zenith: kf.zenith,
    midSky: kf.midSky,
    horizon: kf.horizon,
    sunCore: kf.sunCore,
    sunHalo: kf.sunHalo,
    cloudLit: kf.cloudLit,
    cloudShadow: kf.cloudShadow,
    deepWater: kf.deepWater,
    midWater: kf.midWater,
    shallowWater: kf.shallowWater,
    crestRim: kf.crestRim,
    foamTint: kf.foamTint,
    wetSand: kf.wetSand,
  };
}

export function blendSunsetStates(
  from: SunsetPaletteState,
  to: SunsetPaletteState,
  t: number
): SunsetPaletteState {
  const u = smoothstep(0, 1, t);
  if (u <= 0.001) return from;
  if (u >= 0.999) return to;
  return {
    phase: to.phase,
    theta: to.theta,
    wavePhase: to.wavePhase,
    waveTheta: to.waveTheta,
    driftPhase: to.driftPhase,
    driftTheta: to.driftTheta,
    sunXNorm: from.sunXNorm + (to.sunXNorm - from.sunXNorm) * u,
    sunElevation: from.sunElevation + (to.sunElevation - from.sunElevation) * u,
    sunVisible: from.sunVisible + (to.sunVisible - from.sunVisible) * u,
    starStrength: from.starStrength + (to.starStrength - from.starStrength) * u,
    moonStrength: from.moonStrength + (to.moonStrength - from.moonStrength) * u,
    moonPhaseFraction: to.moonPhaseFraction,
    bioStrength: from.bioStrength + (to.bioStrength - from.bioStrength) * u,
    zenith: mixRgb(from.zenith, to.zenith, u),
    midSky: mixRgb(from.midSky, to.midSky, u),
    horizon: mixRgb(from.horizon, to.horizon, u),
    sunCore: mixRgb(from.sunCore, to.sunCore, u),
    sunHalo: mixRgb(from.sunHalo, to.sunHalo, u),
    cloudLit: mixRgb(from.cloudLit, to.cloudLit, u),
    cloudShadow: mixRgb(from.cloudShadow, to.cloudShadow, u),
    deepWater: mixRgb(from.deepWater, to.deepWater, u),
    midWater: mixRgb(from.midWater, to.midWater, u),
    shallowWater: mixRgb(from.shallowWater, to.shallowWater, u),
    crestRim: mixRgb(from.crestRim, to.crestRim, u),
    foamTint: mixRgb(from.foamTint, to.foamTint, u),
    wetSand: mixRgb(from.wetSand, to.wetSand, u),
  };
}

export function rgbCss(c: RGB, alpha = 1): string {
  const r = Math.round(c[0] * 255);
  const g = Math.round(c[1] * 255);
  const b = Math.round(c[2] * 255);
  if (alpha >= 0.999) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  const u = clamp01(t);
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
}

