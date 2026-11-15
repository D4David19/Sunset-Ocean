export const BROKEN_ARROW_COORDS = {
  city: 'Broken Arrow, OK',
  lat: 36.0526,
  lon: -95.7908,
  timeZone: 'America/Chicago',
} as const;

export interface LunarPhaseInfo {
  /** Normalized synodic phase in [0, 1): 0=New, 0.25=First Qtr, 0.5=Full, 0.75=Last Qtr */
  phaseFraction: number;
  /** Illuminated disc fraction in [0, 1] */
  illumination: number;
  /** Rounded percentage 0..100 */
  illuminationPct: number;
  /** Days elapsed since last New Moon (0..29.53) */
  moonAgeDays: number;
  /** Standard 8-phase astronomical name */
  phaseName: string;
  /** True during waxing half (0..0.5), false during waning half (0.5..1) */
  isWaxing: boolean;
  /** Formatted local Broken Arrow date for next Full Moon, e.g. "Nov 24" */
  nextFullMoonLabel: string;
  /** Formatted local Broken Arrow date for next New Moon, e.g. "Dec 9" */
  nextNewMoonLabel: string;
}

export interface BrokenArrowSolarState {
  /** Live formatted wall time with seconds, e.g. "08:04:19" */
  timeClock: string;
  /** "AM" | "PM" */
  dayPeriod: string;
  /** "CST" | "CDT" */
  tzAbbr: string;
  /** Formatted local date, e.g. "Fri, Nov 13" */
  dateLabel: string;
  /** ISO-style local calendar date YYYY-MM-DD in America/Chicago */
  localDateIso: string;
  /** Solar altitude above/below horizon in degrees (-90 .. +90) */
  elevationDeg: number;
  /** Solar azimuth in degrees clockwise from North (0 .. 360) */
  azimuthDeg: number;
  /** True when sun is climbing toward solar noon */
  isRising: boolean;
  /** Normalized progress through daylight (0=sunrise..1=sunset) or night (<0 or >1) */
  daylightFraction: number;
  /** Normalized 24-hour solar arc progress from midnight to midnight (0..1) */
  clockDayFraction: number;
  /** Formatted Broken Arrow sunrise time, e.g. "6:58 AM" */
  sunriseLabel: string;
  /** Formatted Broken Arrow sunset time, e.g. "5:17 PM" */
  sunsetLabel: string;
  /** Formatted daylight duration, e.g. "10h 19m" */
  dayLengthLabel: string;
  /** Homeric sky phase title */
  homericTitle: string;
  /** Poetic Odyssey-inspired line matching the current solar moment */
  homericVerse: string;
  /** Live lunar phase metrics */
  lunar: LunarPhaseInfo;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SYNODIC_MONTH = 29.530588861;
const JD_UNIX_EPOCH = 2440587.5;
const JD_J2000_NEW_MOON = 2451550.09766;

const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BROKEN_ARROW_COORDS.timeZone,
  hour12: true,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BROKEN_ARROW_COORDS.timeZone,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const shortMonthDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BROKEN_ARROW_COORDS.timeZone,
  month: 'short',
  day: 'numeric',
});

const hmFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BROKEN_ARROW_COORDS.timeZone,
  hour12: true,
  hour: 'numeric',
  minute: '2-digit',
});

const parts24Formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BROKEN_ARROW_COORDS.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function getLocalParts(date: Date) {
  const parts = parts24Formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = parseInt(p.value, 10);
    }
  }
  return {
    year: map.year || 2026,
    month: map.month || 1,
    day: map.day || 1,
    hour: map.hour || 0,
    minute: map.minute || 0,
    second: map.second || 0,
  };
}

function getTimeZoneOffsetMinutes(date: Date): number {
  const lp = getLocalParts(date);
  const utcFromLocal = Date.UTC(lp.year, lp.month - 1, lp.day, lp.hour, lp.minute, lp.second);
  const utcActual = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((utcFromLocal - utcActual) / 60000);
}

function getDayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const cur = Date.UTC(year, month - 1, day);
  return Math.floor((cur - start) / 86400000);
}

function formatDayLength(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hrs}h ${mins}m`;
}

/**
 * Jean Meeus (Astronomical Algorithms Ch. 49) syzygy time calculation
 * for New Moon (k = integer) and Full Moon (k = integer + 0.5).
 */
function computeMeeusSyzygyJd(k: number, isFullMoon: boolean): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  let jde =
    2451550.09766 +
    SYNODIC_MONTH * k +
    0.00015437 * T2 -
    0.00000015 * T3 +
    0.00000000073 * T4;

  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T2) * DEG2RAD;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2) * DEG2RAD;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2) * DEG2RAD;
  const omega = (124.7746 - 1.56375588 * k + 0.0020672 * T2) * DEG2RAD;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;

  if (!isFullMoon) {
    jde +=
      -0.4072 * Math.sin(Mp) +
      0.17241 * E * Math.sin(M) +
      0.01608 * Math.sin(2 * Mp) +
      0.01039 * Math.sin(2 * F) +
      0.00739 * E * Math.sin(Mp - M) -
      0.00514 * E * Math.sin(Mp + M) +
      0.00208 * E * E * Math.sin(2 * M) -
      0.00111 * Math.sin(Mp - 2 * F) -
      0.00057 * Math.sin(Mp + 2 * F) +
      0.00056 * E * Math.sin(2 * Mp + M) -
      0.00042 * Math.sin(3 * Mp) +
      0.00042 * E * Math.sin(M + 2 * F) +
      0.00038 * E * Math.sin(M - 2 * F) -
      0.00024 * E * Math.sin(2 * Mp - M) -
      0.00017 * Math.sin(omega);
  } else {
    jde +=
      -0.40614 * Math.sin(Mp) +
      0.17302 * E * Math.sin(M) +
      0.01614 * Math.sin(2 * Mp) +
      0.01043 * Math.sin(2 * F) +
      0.00734 * E * Math.sin(Mp - M) -
      0.00515 * E * Math.sin(Mp + M) +
      0.00209 * E * E * Math.sin(2 * M) -
      0.00111 * Math.sin(Mp - 2 * F) -
      0.00057 * Math.sin(Mp + 2 * F) +
      0.00056 * E * Math.sin(2 * Mp + M) -
      0.00042 * Math.sin(3 * Mp) +
      0.00042 * E * Math.sin(M + 2 * F) +
      0.00038 * E * Math.sin(M - 2 * F) -
      0.00024 * E * Math.sin(2 * Mp - M) -
      0.00017 * Math.sin(omega);
  }

  return jde;
}

function jdToDate(jd: number): Date {
  return new Date((jd - JD_UNIX_EPOCH) * 86400000);
}

function resolveLunarPhaseName(phaseFraction: number): string {
  const idx = Math.floor(((phaseFraction + 1 / 16) % 1) * 8);
  const names = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  return names[idx] ?? 'Waxing Crescent';
}

export function computeLunarPhaseInfo(date: Date = new Date()): LunarPhaseInfo {
  const jd = date.getTime() / 86400000 + JD_UNIX_EPOCH;
  const approxK = Math.floor((jd - JD_J2000_NEW_MOON) / SYNODIC_MONTH);

  // Locate surrounding New Moon and Full Moon syzygies using Meeus Ch. 49
  let prevNewJd = computeMeeusSyzygyJd(approxK, false);
  if (prevNewJd > jd) {
    prevNewJd = computeMeeusSyzygyJd(approxK - 1, false);
  }
  const prevNewK = Math.round((prevNewJd - JD_J2000_NEW_MOON) / SYNODIC_MONTH);
  let nextNewJd = computeMeeusSyzygyJd(prevNewK + 1, false);
  if (nextNewJd <= jd) {
    prevNewJd = nextNewJd;
    nextNewJd = computeMeeusSyzygyJd(prevNewK + 2, false);
  }

  const activeCycleK = Math.round((prevNewJd - JD_J2000_NEW_MOON) / SYNODIC_MONTH);
  const cycleFullJd = computeMeeusSyzygyJd(activeCycleK + 0.5, true);
  const nextFullJd =
    cycleFullJd > jd ? cycleFullJd : computeMeeusSyzygyJd(activeCycleK + 1.5, true);

  const cycleSpan = Math.max(27, nextNewJd - prevNewJd);
  const moonAgeDays = Math.max(0, jd - prevNewJd);
  const phaseFraction = ((moonAgeDays / cycleSpan) % 1 + 1) % 1;
  const illumination = 0.5 * (1 - Math.cos(phaseFraction * Math.PI * 2));
  const illuminationPct = Math.round(illumination * 100);

  return {
    phaseFraction,
    illumination,
    illuminationPct,
    moonAgeDays,
    phaseName: resolveLunarPhaseName(phaseFraction),
    isWaxing: phaseFraction < 0.5,
    nextFullMoonLabel: shortMonthDayFormatter.format(jdToDate(nextFullJd)),
    nextNewMoonLabel: shortMonthDayFormatter.format(jdToDate(nextNewJd)),
  };
}

/**
 * NOAA / Spencer astronomical solar position equations evaluated for Broken Arrow, OK.
 */
function computeNoaaSolarPosition(date: Date, latDeg: number, lonDeg: number) {
  const lp = getLocalParts(date);
  const doy = getDayOfYear(lp.year, lp.month, lp.day);
  const secondsInDay = lp.hour * 3600 + lp.minute * 60 + lp.second + date.getMilliseconds() / 1000;
  const tzOffsetMin = getTimeZoneOffsetMinutes(date);

  const isLeap = (lp.year % 4 === 0 && lp.year % 100 !== 0) || lp.year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const hourDecimal = secondsInDay / 3600;

  // Fractional year gamma in radians
  const gamma = ((2 * Math.PI) / daysInYear) * (doy - 1 + (hourDecimal - 12) / 24);

  // Equation of time (minutes) & solar declination (radians)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timeOffset = eqTime + 4 * lonDeg - tzOffsetMin;
  const trueSolarTimeMin = (secondsInDay / 60 + timeOffset + 1440) % 1440;
  const hourAngleDeg = trueSolarTimeMin / 4 - 180;
  const haRad = hourAngleDeg * DEG2RAD;
  const latRad = latDeg * DEG2RAD;

  const cosZenith = Math.max(
    -1,
    Math.min(1, Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(haRad))
  );
  const zenithRad = Math.acos(cosZenith);
  const elevationDeg = 90 - zenithRad * RAD2DEG;

  const sinZenith = Math.sin(zenithRad);
  let azimuthDeg = 180;
  if (sinZenith > 1e-4) {
    const cosAz = Math.max(
      -1,
      Math.min(
        1,
        (Math.sin(latRad) * cosZenith - Math.sin(decl)) / (Math.cos(latRad) * sinZenith)
      )
    );
    const azBase = Math.acos(cosAz) * RAD2DEG;
    azimuthDeg = hourAngleDeg > 0 ? (azBase + 180) % 360 : (540 - azBase) % 360;
  }

  // Sunrise / Sunset hour angle (standard -0.833 deg atmospheric refraction + solar radius)
  const zenithSunriseRad = 90.833 * DEG2RAD;
  const cosHaSun =
    Math.cos(zenithSunriseRad) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);
  const clampedHaSun = Math.max(-1, Math.min(1, cosHaSun));
  const haSunriseDeg = Math.acos(clampedHaSun) * RAD2DEG;

  const solarNoonMin = 720 - 4 * lonDeg - eqTime + tzOffsetMin;
  const sunriseMin = solarNoonMin - haSunriseDeg * 4;
  const sunsetMin = solarNoonMin + haSunriseDeg * 4;

  const formatMinutesUtc = (localMin: number) => {
    const midnightLocalUtc = Date.UTC(lp.year, lp.month - 1, lp.day, 0, 0, 0) - tzOffsetMin * 60000;
    return hmFormatter.format(new Date(midnightLocalUtc + localMin * 60000));
  };

  const clockDayFraction = secondsInDay / 86400;
  const localMinutes = secondsInDay / 60;
  const daylightFraction = (localMinutes - sunriseMin) / Math.max(1, sunsetMin - sunriseMin);

  const localDateIso = `${String(lp.year).padStart(4, '0')}-${String(lp.month).padStart(2, '0')}-${String(lp.day).padStart(2, '0')}`;

  return {
    localDateIso,
    elevationDeg,
    azimuthDeg,
    isRising: hourAngleDeg < 0,
    daylightFraction,
    clockDayFraction,
    sunriseLabel: formatMinutesUtc(sunriseMin),
    sunsetLabel: formatMinutesUtc(sunsetMin),
    dayLengthLabel: formatDayLength(sunsetMin - sunriseMin),
  };
}

function resolveHomericMoment(elevationDeg: number, isRising: boolean): { title: string; verse: string } {
  if (elevationDeg >= 28) {
    return {
      title: 'Aegean High Sun',
      verse: 'Over the glittering salt sea the steady breeze bore our black ship onward.',
    };
  }
  if (elevationDeg >= 10) {
    return isRising
      ? {
          title: 'Ascent of Helios',
          verse: 'Helios climbed the bronze-paved vault, pouring gold across the restless swell.',
        }
      : {
          title: 'Westering Light',
          verse: 'Long shadows stretched across the wine-dark waters as afternoon softened.',
        };
  }
  if (elevationDeg >= -1.2) {
    return isRising
      ? {
          title: 'Rosy-Fingered Dawn',
          verse: 'When early-born Dawn shone forth with rose-red fingers over the white surf.',
        }
      : {
          title: 'The Wine-Dark Sea',
          verse: 'The sun sank low in molten copper, kindling fire along every breaking crest.',
        };
  }
  if (elevationDeg >= -10) {
    return isRising
      ? {
          title: 'First Saffron Gleam',
          verse: 'Before the morning star faded, saffron light touched the eastern horizon.',
        }
      : {
          title: 'Crimson Dusk of Helios',
          verse: 'Down plunged the sun, and violet twilight veiled all the seaways.',
        };
  }
  return {
    title: 'Watch of the Bear & Orion',
    verse: 'Under wheeling stars and pale Selene, silver bioluminescence lit the shore.',
  };
}

export function evaluateBrokenArrowSolar(date: Date = new Date()): BrokenArrowSolarState {
  const solar = computeNoaaSolarPosition(date, BROKEN_ARROW_COORDS.lat, BROKEN_ARROW_COORDS.lon);
  const lunar = computeLunarPhaseInfo(date);

  const formattedParts = clockFormatter.formatToParts(date);
  let h = '12';
  let m = '00';
  let s = '00';
  let dayPeriod = 'AM';
  let tzAbbr = 'CST';
  for (const part of formattedParts) {
    if (part.type === 'hour') h = part.value;
    else if (part.type === 'minute') m = part.value;
    else if (part.type === 'second') s = part.value;
    else if (part.type === 'dayPeriod') dayPeriod = part.value;
    else if (part.type === 'timeZoneName') tzAbbr = part.value;
  }

  const homeric = resolveHomericMoment(solar.elevationDeg, solar.isRising);

  return {
    timeClock: `${h}:${m}:${s}`,
    dayPeriod,
    tzAbbr,
    dateLabel: dateFormatter.format(date),
    localDateIso: solar.localDateIso,
    elevationDeg: solar.elevationDeg,
    azimuthDeg: solar.azimuthDeg,
    isRising: solar.isRising,
    daylightFraction: solar.daylightFraction,
    clockDayFraction: solar.clockDayFraction,
    sunriseLabel: solar.sunriseLabel,
    sunsetLabel: solar.sunsetLabel,
    dayLengthLabel: solar.dayLengthLabel,
    homericTitle: homeric.title,
    homericVerse: homeric.verse,
    lunar,
  };
}
