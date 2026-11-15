import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BROKEN_ARROW_COORDS,
  evaluateBrokenArrowSolar,
  type BrokenArrowSolarState,
  type LunarPhaseInfo,
} from './brokenArrowSolar';

export interface BrokenArrowAstronomyData {
  solar: BrokenArrowSolarState;
  lunar: LunarPhaseInfo;
  sunriseLabel: string;
  sunsetLabel: string;
  dayLengthLabel: string;
  source: 'live-api' | 'astronomical';
  isFetching: boolean;
  lastUpdatedLabel: string;
  refresh: () => void;
}

interface LiveSolarSchedule {
  dateIso: string;
  sunriseLabel: string;
  sunsetLabel: string;
  dayLengthLabel: string;
  fetchedAtLabel: string;
}

function parseIsoWallTime(iso: string): { label: string; totalMinutes: number } | null {
  const timePart = iso.split('T')[1];
  if (!timePart) return null;
  const [hStr, mStr] = timePart.split(':');
  const hour24 = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return null;

  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const label = `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  return { label, totalMinutes: hour24 * 60 + minute };
}

function formatDayLength(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

export function useBrokenArrowAstronomy(): BrokenArrowAstronomyData {
  const [solar, setSolar] = useState<BrokenArrowSolarState>(() =>
    evaluateBrokenArrowSolar(new Date())
  );
  const [liveSchedule, setLiveSchedule] = useState<LiveSolarSchedule | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLiveSchedule = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsFetching(true);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${BROKEN_ARROW_COORDS.lat}&longitude=${BROKEN_ARROW_COORDS.lon}&daily=sunrise,sunset&timezone=${encodeURIComponent(BROKEN_ARROW_COORDS.timeZone)}&forecast_days=1`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }
      const payload = (await response.json()) as {
        daily?: {
          time?: string[];
          sunrise?: string[];
          sunset?: string[];
        };
      };

      const dateIso = payload?.daily?.time?.[0];
      const sunriseIso = payload?.daily?.sunrise?.[0];
      const sunsetIso = payload?.daily?.sunset?.[0];

      if (dateIso && sunriseIso && sunsetIso) {
        const sr = parseIsoWallTime(sunriseIso);
        const ss = parseIsoWallTime(sunsetIso);
        if (sr && ss) {
          const nowSolar = evaluateBrokenArrowSolar(new Date());
          setLiveSchedule({
            dateIso,
            sunriseLabel: sr.label,
            sunsetLabel: ss.label,
            dayLengthLabel: formatDayLength(ss.totalMinutes - sr.totalMinutes),
            fetchedAtLabel: `${nowSolar.timeClock} ${nowSolar.dayPeriod}`,
          });
        }
      }
    } catch {
      // Keep local NOAA/Meeus astronomical ephemeris smoothly on network/abort errors
    } finally {
      if (abortRef.current === controller) {
        setIsFetching(false);
      }
    }
  }, []);

  // Fetch live Open-Meteo sunrise/sunset once on load
  useEffect(() => {
    void fetchLiveSchedule();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchLiveSchedule]);

  // Live 1-second Broken Arrow chronometer & lunar ephemeris tick
  useEffect(() => {
    const updateClock = () => {
      const next = evaluateBrokenArrowSolar(new Date());
      setSolar((prev) =>
        prev.timeClock === next.timeClock && prev.dateLabel === next.dateLabel
          ? prev
          : next
      );
    };
    updateClock();
    const timer = window.setInterval(updateClock, 250);
    return () => window.clearInterval(timer);
  }, []);

  const liveMatchesToday =
    liveSchedule !== null && liveSchedule.dateIso === solar.localDateIso;

  return {
    solar,
    lunar: solar.lunar,
    sunriseLabel: liveMatchesToday ? liveSchedule.sunriseLabel : solar.sunriseLabel,
    sunsetLabel: liveMatchesToday ? liveSchedule.sunsetLabel : solar.sunsetLabel,
    dayLengthLabel: liveMatchesToday ? liveSchedule.dayLengthLabel : solar.dayLengthLabel,
    source: liveMatchesToday ? 'live-api' : 'astronomical',
    isFetching,
    lastUpdatedLabel: liveMatchesToday
      ? liveSchedule.fetchedAtLabel
      : `${solar.timeClock} ${solar.dayPeriod}`,
    refresh: () => {
      void fetchLiveSchedule();
    },
  };
}
