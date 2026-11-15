export type SolarBodyName =
  | 'Sun'
  | 'Mercury'
  | 'Venus'
  | 'Earth'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto';

export type SolarScaleMode = 'showcase' | 'true-au';

export interface MoonSpec {
  name: string;
  orbitRatio: number; // multiplier of host planet showcase visual radius
  radiusRatio: number;
  periodDays: number;
  inclinationDeg: number;
  color: string;
}

export interface SolarBodyMeta {
  name: SolarBodyName;
  classification: string;
  radiusKm: number;
  axialTiltDeg: number;
  orbitalPeriodDays: number;
  rotationPeriodHours: number; // negative = retrograde
  eccentricity: number;
  inclinationDeg: number;
  showcaseRadius: number;
  orbitColor: number;
  labelColor: string;
  palette: string[];
  hasRings?: 'saturn' | 'uranus';
  hasSpot?: boolean;
  moons: MoonSpec[];
}

interface KeplerianElements {
  a0: number;
  aDot: number;
  e0: number;
  eDot: number;
  i0: number;
  iDot: number;
  L0: number;
  LDot: number;
  varpi0: number;
  varpiDot: number;
  omega0: number;
  omegaDot: number;
  // Additional JPL Standish Table 2a terms for Jupiter..Pluto
  b?: number;
  c?: number;
  s?: number;
  f?: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const AU_KM = 149_597_870.7;
const KM_TO_MI = 0.621371192;
const SPEED_OF_LIGHT_KM_S = 299_792.458;
const GM_SUN_AU3_DAY2 = 0.0002959122082855911; // k^2 (Gaussian gravitational constant squared)

export const PLANET_ORDER: SolarBodyName[] = [
  'Mercury',
  'Venus',
  'Earth',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];

export const ALL_SOLAR_BODIES: SolarBodyName[] = ['Sun', ...PLANET_ORDER];

// NASA JPL Standish (1992 / Solar System Dynamics) J2000.0 Keplerian Elements valid 1800 AD - 2050 AD
const JPL_ELEMENTS: Record<Exclude<SolarBodyName, 'Sun'>, KeplerianElements> = {
  Mercury: {
    a0: 0.38709927,
    aDot: 0.00000037,
    e0: 0.20563593,
    eDot: 0.00001906,
    i0: 7.00497902,
    iDot: -0.00594749,
    L0: 252.2503235,
    LDot: 149472.67411175,
    varpi0: 77.45779628,
    varpiDot: 0.16047689,
    omega0: 48.33076593,
    omegaDot: -0.12534081,
  },
  Venus: {
    a0: 0.72333566,
    aDot: 0.0000039,
    e0: 0.00677672,
    eDot: -0.00004107,
    i0: 3.39467605,
    iDot: -0.0007889,
    L0: 181.9790995,
    LDot: 58517.81538729,
    varpi0: 131.60246718,
    varpiDot: 0.00268329,
    omega0: 76.67984255,
    omegaDot: -0.27769418,
  },
  Earth: {
    a0: 1.00000261,
    aDot: 0.00000562,
    e0: 0.01671123,
    eDot: -0.00004392,
    i0: -0.00001531,
    iDot: -0.01294668,
    L0: 100.46457166,
    LDot: 35999.37244981,
    varpi0: 102.93768193,
    varpiDot: 0.32327364,
    omega0: 0.0,
    omegaDot: 0.0,
  },
  Mars: {
    a0: 1.52371034,
    aDot: 0.00001847,
    e0: 0.0933941,
    eDot: 0.00007882,
    i0: 1.84969142,
    iDot: -0.00813131,
    L0: -4.55343205,
    LDot: 19140.30268499,
    varpi0: -23.94362959,
    varpiDot: 0.44441088,
    omega0: 49.55953891,
    omegaDot: -0.29257343,
  },
  Jupiter: {
    a0: 5.202887,
    aDot: -0.00011607,
    e0: 0.04838624,
    eDot: -0.00013253,
    i0: 1.30439695,
    iDot: -0.00183714,
    L0: 34.39644051,
    LDot: 3034.74612775,
    varpi0: 14.72847983,
    varpiDot: 0.21252668,
    omega0: 100.47390909,
    omegaDot: 0.20469106,
    b: -0.00012452,
    c: 0.0606406,
    s: -0.35635438,
    f: 38.35125,
  },
  Saturn: {
    a0: 9.53667594,
    aDot: -0.0012506,
    e0: 0.05386179,
    eDot: -0.00050991,
    i0: 2.48599187,
    iDot: 0.00193609,
    L0: 49.95424423,
    LDot: 1222.49362201,
    varpi0: 92.59887831,
    varpiDot: -0.41897216,
    omega0: 113.66242448,
    omegaDot: -0.28867794,
    b: 0.00025899,
    c: -0.13434469,
    s: 0.87320147,
    f: 38.35125,
  },
  Uranus: {
    a0: 19.18916464,
    aDot: -0.00196176,
    e0: 0.04725744,
    eDot: -0.00004397,
    i0: 0.77263783,
    iDot: -0.00242939,
    L0: 313.23810451,
    LDot: 428.48202785,
    varpi0: 170.9542763,
    varpiDot: 0.40805281,
    omega0: 74.01692503,
    omegaDot: 0.04240589,
    b: 0.00058331,
    c: -0.97731848,
    s: 0.17689245,
    f: 7.67025,
  },
  Neptune: {
    a0: 30.06992276,
    aDot: 0.00026291,
    e0: 0.00859048,
    eDot: 0.00005105,
    i0: 1.77004347,
    iDot: 0.00035372,
    L0: -55.12002969,
    LDot: 218.45945325,
    varpi0: 44.96476227,
    varpiDot: -0.32241464,
    omega0: 131.78422574,
    omegaDot: -0.00508664,
    b: -0.00041348,
    c: 0.68346318,
    s: -0.10162547,
    f: 7.67025,
  },
  Pluto: {
    a0: 39.48211675,
    aDot: -0.00031596,
    e0: 0.2488273,
    eDot: 0.0000517,
    i0: 17.14001206,
    iDot: 0.00004818,
    L0: 238.92903833,
    LDot: 145.20780515,
    varpi0: 224.06891629,
    varpiDot: -0.04062942,
    omega0: 110.30393684,
    omegaDot: -0.01183482,
    b: -0.01262724,
    c: 0,
    s: 0,
    f: 0,
  },
};

export const REAL_BODIES_META: Record<SolarBodyName, SolarBodyMeta> = {
  Sun: {
    name: 'Sun',
    classification: 'G2V Main-Sequence Star',
    radiusKm: 696_340,
    axialTiltDeg: 7.25,
    orbitalPeriodDays: 0,
    rotationPeriodHours: 609.12,
    eccentricity: 0,
    inclinationDeg: 0,
    showcaseRadius: 3.15,
    orbitColor: 0xffb84d,
    labelColor: '#fde68a',
    palette: ['#ffae38', '#ffd875', '#ff8024'],
    moons: [],
  },
  Mercury: {
    name: 'Mercury',
    classification: 'Terrestrial Planet',
    radiusKm: 2439.7,
    axialTiltDeg: 0.034,
    orbitalPeriodDays: 87.969,
    rotationPeriodHours: 1407.6,
    eccentricity: 0.2056,
    inclinationDeg: 7.0,
    showcaseRadius: 0.42,
    orbitColor: 0x9c9488,
    labelColor: '#d6d3d1',
    palette: ['#7b7670', '#a69f96', '#625c56'],
    moons: [],
  },
  Venus: {
    name: 'Venus',
    classification: 'Terrestrial Planet',
    radiusKm: 6051.8,
    axialTiltDeg: 177.36,
    orbitalPeriodDays: 224.701,
    rotationPeriodHours: -5832.5,
    eccentricity: 0.0068,
    inclinationDeg: 3.39,
    showcaseRadius: 0.78,
    orbitColor: 0xc9a36b,
    labelColor: '#fcd34d',
    palette: ['#c99c62', '#e8c488', '#b5834a'],
    moons: [],
  },
  Earth: {
    name: 'Earth',
    classification: 'Terrestrial Planet',
    radiusKm: 6371.0,
    axialTiltDeg: 23.439,
    orbitalPeriodDays: 365.256,
    rotationPeriodHours: 23.934,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    showcaseRadius: 1.15,
    orbitColor: 0x5c9ce6,
    labelColor: '#7dd3fc',
    palette: ['#0e447d', '#3d6b48'],
    moons: [
      {
        name: 'Moon',
        orbitRatio: 2.75,
        radiusRatio: 0.27,
        periodDays: 27.322,
        inclinationDeg: 5.145,
        color: '#d4dae4',
      },
    ],
  },
  Mars: {
    name: 'Mars',
    classification: 'Terrestrial Planet',
    radiusKm: 3389.5,
    axialTiltDeg: 25.19,
    orbitalPeriodDays: 686.98,
    rotationPeriodHours: 24.623,
    eccentricity: 0.0934,
    inclinationDeg: 1.85,
    showcaseRadius: 0.64,
    orbitColor: 0xc46846,
    labelColor: '#fca5a5',
    palette: ['#a64c2e', '#cf6e46', '#783420'],
    moons: [
      {
        name: 'Phobos',
        orbitRatio: 1.75,
        radiusRatio: 0.14,
        periodDays: 0.319,
        inclinationDeg: 1.09,
        color: '#a89f96',
      },
      {
        name: 'Deimos',
        orbitRatio: 2.35,
        radiusRatio: 0.11,
        periodDays: 1.263,
        inclinationDeg: 0.93,
        color: '#b8afa6',
      },
    ],
  },
  Jupiter: {
    name: 'Jupiter',
    classification: 'Gas Giant',
    radiusKm: 69_911,
    axialTiltDeg: 3.13,
    orbitalPeriodDays: 4332.59,
    rotationPeriodHours: 9.925,
    eccentricity: 0.0484,
    inclinationDeg: 1.3,
    showcaseRadius: 2.2,
    orbitColor: 0xc49c74,
    labelColor: '#fed7aa',
    palette: ['#c99e72', '#f0dec2', '#b06d48', '#e3c398', '#8a5d42'],
    hasSpot: true,
    moons: [
      { name: 'Io', orbitRatio: 1.55, radiusRatio: 0.13, periodDays: 1.769, inclinationDeg: 0.05, color: '#facc15' },
      { name: 'Europa', orbitRatio: 1.9, radiusRatio: 0.12, periodDays: 3.551, inclinationDeg: 0.47, color: '#e2e8f0' },
      { name: 'Ganymede', orbitRatio: 2.32, radiusRatio: 0.16, periodDays: 7.155, inclinationDeg: 0.2, color: '#cbd5e1' },
      { name: 'Callisto', orbitRatio: 2.82, radiusRatio: 0.14, periodDays: 16.689, inclinationDeg: 0.19, color: '#94a3b8' },
    ],
  },
  Saturn: {
    name: 'Saturn',
    classification: 'Gas Giant',
    radiusKm: 58_232,
    axialTiltDeg: 26.73,
    orbitalPeriodDays: 10_759.22,
    rotationPeriodHours: 10.656,
    eccentricity: 0.0539,
    inclinationDeg: 2.49,
    showcaseRadius: 1.85,
    orbitColor: 0xd4c292,
    labelColor: '#fef08a',
    palette: ['#d4be8e', '#efe0b8', '#b59c6b', '#dfd0a4'],
    hasRings: 'saturn',
    moons: [
      { name: 'Enceladus', orbitRatio: 2.75, radiusRatio: 0.11, periodDays: 1.37, inclinationDeg: 0.02, color: '#f8fafc' },
      { name: 'Titan', orbitRatio: 3.35, radiusRatio: 0.18, periodDays: 15.945, inclinationDeg: 0.35, color: '#fbbf24' },
    ],
  },
  Uranus: {
    name: 'Uranus',
    classification: 'Ice Giant',
    radiusKm: 25_362,
    axialTiltDeg: 97.77,
    orbitalPeriodDays: 30_688.5,
    rotationPeriodHours: -17.24,
    eccentricity: 0.0473,
    inclinationDeg: 0.77,
    showcaseRadius: 1.25,
    orbitColor: 0x76c8d8,
    labelColor: '#67e8f9',
    palette: ['#87d0de', '#a6e5ee', '#6bb7c7'],
    hasRings: 'uranus',
    moons: [
      { name: 'Miranda', orbitRatio: 1.8, radiusRatio: 0.11, periodDays: 1.413, inclinationDeg: 4.2, color: '#cbd5e1' },
      { name: 'Titania', orbitRatio: 2.38, radiusRatio: 0.14, periodDays: 8.706, inclinationDeg: 0.34, color: '#e2e8f0' },
    ],
  },
  Neptune: {
    name: 'Neptune',
    classification: 'Ice Giant',
    radiusKm: 24_622,
    axialTiltDeg: 28.32,
    orbitalPeriodDays: 60_195,
    rotationPeriodHours: 16.11,
    eccentricity: 0.0086,
    inclinationDeg: 1.77,
    showcaseRadius: 1.22,
    orbitColor: 0x4c79e0,
    labelColor: '#93c5fd',
    palette: ['#2e58b8', '#4476e0', '#234294'],
    moons: [
      { name: 'Triton', orbitRatio: 2.1, radiusRatio: 0.15, periodDays: -5.877, inclinationDeg: 23.0, color: '#fbcfe8' },
    ],
  },
  Pluto: {
    name: 'Pluto',
    classification: 'Dwarf Planet · Kuiper',
    radiusKm: 1188.3,
    axialTiltDeg: 122.53,
    orbitalPeriodDays: 90_560,
    rotationPeriodHours: -153.29,
    eccentricity: 0.2488,
    inclinationDeg: 17.14,
    showcaseRadius: 0.42,
    orbitColor: 0xb89ca8,
    labelColor: '#e9d5ff',
    palette: ['#b59c8c', '#d9c5b4', '#7d685c'],
    moons: [
      { name: 'Charon', orbitRatio: 2.15, radiusRatio: 0.48, periodDays: 6.387, inclinationDeg: 0.08, color: '#cbd5e1' },
    ],
  },
};

export function dateToJulianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

function solveEccentricAnomaly(Mrad: number, e: number): number {
  let E = Mrad + e * Math.sin(Mrad);
  for (let iter = 0; iter < 10; iter++) {
    const f = E - e * Math.sin(E) - Mrad;
    const fPrime = 1 - e * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }
  return E;
}

export interface HeliocentricBodyState {
  name: SolarBodyName;
  xEclAU: number;
  yEclAU: number;
  zEclAU: number;
  distSunAU: number;
  lambdaDeg: number;
  betaDeg: number;
  speedKmS: number;
  trueAnomalyDeg: number;
}

function evaluateKeplerianAtT(
  name: Exclude<SolarBodyName, 'Sun'>,
  T: number
): HeliocentricBodyState {
  const el = JPL_ELEMENTS[name];
  const a = el.a0 + el.aDot * T;
  const e = Math.max(0, Math.min(0.95, el.e0 + el.eDot * T));
  const I = (el.i0 + el.iDot * T) * DEG2RAD;
  const L = el.L0 + el.LDot * T;
  const varpi = el.varpi0 + el.varpiDot * T;
  const Omega = (el.omega0 + el.omegaDot * T) * DEG2RAD;
  const omega = (varpi - (el.omega0 + el.omegaDot * T)) * DEG2RAD;

  let Mdeg = L - varpi;
  if (el.b !== undefined && el.f !== undefined) {
    const fT = el.f * T * DEG2RAD;
    Mdeg +=
      el.b * T * T +
      (el.c ?? 0) * Math.cos(fT) +
      (el.s ?? 0) * Math.sin(fT);
  }
  Mdeg = normalizeDeg(Mdeg);
  if (Mdeg > 180) Mdeg -= 360;
  const Mrad = Mdeg * DEG2RAD;

  const E = solveEccentricAnomaly(Mrad, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);

  const xp = a * (cosE - e);
  const yp = a * Math.sqrt(Math.max(0, 1 - e * e)) * sinE;
  const r = Math.hypot(xp, yp);
  const nuRad = Math.atan2(yp, xp);

  const cosOm = Math.cos(Omega);
  const sinOm = Math.sin(Omega);
  const cosw = Math.cos(omega);
  const sinw = Math.sin(omega);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  const xEclAU =
    (cosw * cosOm - sinw * sinOm * cosI) * xp +
    (-sinw * cosOm - cosw * sinOm * cosI) * yp;
  const yEclAU =
    (cosw * sinOm + sinw * cosOm * cosI) * xp +
    (-sinw * sinOm + cosw * cosOm * cosI) * yp;
  const zEclAU = sinw * sinI * xp + cosw * sinI * yp;

  const lambdaDeg = normalizeDeg(Math.atan2(yEclAU, xEclAU) * RAD2DEG);
  const betaDeg = Math.asin(Math.max(-1, Math.min(1, zEclAU / Math.max(1e-6, r)))) * RAD2DEG;

  // Vis-viva equation: v = sqrt(GM * (2/r - 1/a)) converted AU/day -> km/s
  const vAuPerDay = Math.sqrt(Math.max(0, GM_SUN_AU3_DAY2 * (2 / Math.max(1e-5, r) - 1 / a)));
  const speedKmS = (vAuPerDay * AU_KM) / 86_400;

  return {
    name,
    xEclAU,
    yEclAU,
    zEclAU,
    distSunAU: r,
    lambdaDeg,
    betaDeg,
    speedKmS,
    trueAnomalyDeg: normalizeDeg(nuRad * RAD2DEG),
  };
}

export function evaluateBodyAtDate(
  name: SolarBodyName,
  date: Date
): HeliocentricBodyState {
  if (name === 'Sun') {
    return {
      name: 'Sun',
      xEclAU: 0,
      yEclAU: 0,
      zEclAU: 0,
      distSunAU: 0,
      lambdaDeg: 0,
      betaDeg: 0,
      speedKmS: 0,
      trueAnomalyDeg: 0,
    };
  }
  const jd = dateToJulianDay(date);
  const T = (jd - 2_451_545.0) / 36_525.0;
  return evaluateKeplerianAtT(name, T);
}

export const TRUE_AU_WORLD_SCALE = 12.0;

/**
 * Maps heliocentric distance (AU) to Three.js world distance.
 * In Showcase mode, logarithmic spacing keeps outer giants visible while preserving exact real angles & inclination.
 * In True AU mode, 1 AU = 12.0 world units linearly.
 */
export function auRadiusToScene(rAU: number, trueAuMix: number): number {
  if (rAU <= 1e-6) return 0;
  const showcaseR = 3.8 + 15.6 * Math.log(1 + rAU * 1.95);
  const trueR = rAU * TRUE_AU_WORLD_SCALE;
  return showcaseR + (trueR - showcaseR) * trueAuMix;
}

/**
 * Converts J2000 heliocentric ecliptic coordinates (AU) into Three.js world XYZ:
 * Three.js +X = vernal equinox (0 deg ecliptic longitude)
 * Three.js +Y = ecliptic north (+Z_ecl)
 * Three.js -Z = +Y_ecl (90 deg ecliptic longitude), so prograde orbits move counter-clockwise seen from +Y.
 */
export function eclipticAuToSceneXYZ(
  xEclAU: number,
  yEclAU: number,
  zEclAU: number,
  trueAuMix: number
): [number, number, number] {
  const rAU = Math.hypot(xEclAU, yEclAU, zEclAU);
  if (rAU <= 1e-7) return [0, 0, 0];
  const rScene = auRadiusToScene(rAU, trueAuMix);
  const k = rScene / rAU;
  return [xEclAU * k, zEclAU * k, -yEclAU * k];
}

export function computeOrbitCurveScenePoints(
  name: Exclude<SolarBodyName, 'Sun'>,
  date: Date,
  segments: number,
  trueAuMix: number,
  outBuffer?: Float32Array
): Float32Array {
  const jd = dateToJulianDay(date);
  const T = (jd - 2_451_545.0) / 36_525.0;
  const el = JPL_ELEMENTS[name];
  const a = el.a0 + el.aDot * T;
  const e = Math.max(0, Math.min(0.95, el.e0 + el.eDot * T));
  const I = (el.i0 + el.iDot * T) * DEG2RAD;
  const Omega = (el.omega0 + el.omegaDot * T) * DEG2RAD;
  const omega = (el.varpi0 + el.varpiDot * T - (el.omega0 + el.omegaDot * T)) * DEG2RAD;

  const cosOm = Math.cos(Omega);
  const sinOm = Math.sin(Omega);
  const cosw = Math.cos(omega);
  const sinw = Math.sin(omega);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  const ax1 = cosw * cosOm - sinw * sinOm * cosI;
  const bx1 = -sinw * cosOm - cosw * sinOm * cosI;
  const ax2 = cosw * sinOm + sinw * cosOm * cosI;
  const bx2 = -sinw * sinOm + cosw * cosOm * cosI;
  const ax3 = sinw * sinI;
  const bx3 = cosw * sinI;
  const bFactor = Math.sqrt(Math.max(0, 1 - e * e));

  const buf = outBuffer && outBuffer.length === segments * 3 ? outBuffer : new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const E = (i / segments) * Math.PI * 2;
    const xp = a * (Math.cos(E) - e);
    const yp = a * bFactor * Math.sin(E);
    const xEcl = ax1 * xp + bx1 * yp;
    const yEcl = ax2 * xp + bx2 * yp;
    const zEcl = ax3 * xp + bx3 * yp;
    const [sx, sy, sz] = eclipticAuToSceneXYZ(xEcl, yEcl, zEcl, trueAuMix);
    buf[i * 3] = sx;
    buf[i * 3 + 1] = sy;
    buf[i * 3 + 2] = sz;
  }
  return buf;
}

export interface SelectedBodyTelemetry {
  meta: SolarBodyMeta;
  state: HeliocentricBodyState;
  distSunDisplay: string;
  distEarthDisplay: string;
  speedDisplay: string;
  lightTimeEarthMin: number;
  julianDay: number;
  simIsoDate: string;
}

export function buildSelectedBodyTelemetry(
  name: SolarBodyName,
  date: Date,
  unit: 'metric' | 'imperial'
): SelectedBodyTelemetry {
  const jd = dateToJulianDay(date);
  const T = (jd - 2_451_545.0) / 36_525.0;
  const earth = evaluateKeplerianAtT('Earth', T);
  const state = name === 'Sun' ? evaluateBodyAtDate('Sun', date) : evaluateKeplerianAtT(name, T);
  const meta = REAL_BODIES_META[name];

  const distEarthAU =
    name === 'Earth'
      ? 0
      : Math.hypot(
          state.xEclAU - earth.xEclAU,
          state.yEclAU - earth.yEclAU,
          state.zEclAU - earth.zEclAU
        );
  const distSunKm = state.distSunAU * AU_KM;
  const distEarthKm = distEarthAU * AU_KM;
  const lightTimeEarthMin = distEarthKm / SPEED_OF_LIGHT_KM_S / 60;

  const fmtDist = (au: number, km: number): string => {
    if (au <= 1e-6) return '0.000 AU';
    if (unit === 'imperial') {
      const mi = km * KM_TO_MI;
      const mStr = mi >= 1_000_000 ? `${(mi / 1_000_000).toFixed(1)}M mi` : `${Math.round(mi).toLocaleString()} mi`;
      return `${au.toFixed(3)} AU (${mStr})`;
    }
    const kStr = km >= 1_000_000 ? `${(km / 1_000_000).toFixed(1)}M km` : `${Math.round(km).toLocaleString()} km`;
    return `${au.toFixed(3)} AU (${kStr})`;
  };

  const speedDisplay =
    unit === 'imperial'
      ? `${(state.speedKmS * KM_TO_MI).toFixed(2)} mi/s`
      : `${state.speedKmS.toFixed(2)} km/s`;

  return {
    meta,
    state,
    distSunDisplay: name === 'Sun' ? '0.000 AU (Barycenter)' : fmtDist(state.distSunAU, distSunKm),
    distEarthDisplay: name === 'Earth' ? 'Reference Origin' : fmtDist(distEarthAU, distEarthKm),
    speedDisplay,
    lightTimeEarthMin,
    julianDay: jd,
    simIsoDate: date.toISOString().slice(0, 10),
  };
}
