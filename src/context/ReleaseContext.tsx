import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { safeReadJson, safeWriteJson } from '../utils/safeStorage';

const RELEASE_STORAGE_KEY = 'kas_release_v6_live';

export type ReleaseTimerStatus = 'unscheduled' | 'counting' | 'paused' | 'released';

interface PersistedReleaseState {
  released60: boolean;
  targetAtMs: number | null;
  pausedRemainingMs: number | null;
  releasedAtIso: string | null;
  isOwnerMode: boolean;
}

const DEFAULT_RELEASE_STATE: PersistedReleaseState = {
  released60: true,
  targetAtMs: null,
  pausedRemainingMs: null,
  releasedAtIso: '2026-11-15T18:00:00.000Z',
  isOwnerMode: true,
};

export interface Release6Highlight {
  area: string;
  summary: string;
}

export const RELEASE_6_HIGHLIGHTS: readonly Release6Highlight[] = [
  {
    area: 'Temple Run 6.0',
    summary: 'Triple-Jump Cloud Vault (3rd mid-air jump!) + boosted Fever Coin Magnet range.',
  },
  {
    area: 'Solar Horizon 6.0',
    summary: 'Richer deep-horizon twilight shimmer glow & extra shooting-star meteors.',
  },
  {
    area: 'Coastline Tour 6.0',
    summary: 'Overdrive pedal cap raised from 10x up to 12x hyper-speed in Manual mode.',
  },
  {
    area: 'Angry Birds 6.0',
    summary: 'Super-Slingshot +15% launch velocity boost & stronger Shockwave impacts.',
  },
  {
    area: 'All-Star Hoops 6.0',
    summary: 'Double Shot Points (2x) while riding a Moving Hoop 3+ Hot Streak.',
  },
  {
    area: 'Studio 6.0 Themes',
    summary: 'Unlocks 3 exclusive Update 6.0 color themes (Cyber Gold, Aurora Mint, Solar Flare).',
  },
];

export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(clamped / 86400);
  const hrs = Math.floor((clamped % 86400) / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

interface ReleaseContextValue {
  released60: boolean;
  isOwnerMode: boolean;
  toggleOwnerMode: () => void;
  timerStatus: ReleaseTimerStatus;
  remainingMs: number;
  targetAtMs: number | null;
  releasedAtIso: string | null;
  releaseModalOpen: boolean;
  setReleaseModalOpen: Dispatch<SetStateAction<boolean>>;
  justReleasedCelebration: boolean;
  dismissCelebration: () => void;
  scheduleInSeconds: (seconds: number) => void;
  scheduleAtTimestamp: (epochMs: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  cancelTimer: () => void;
  releaseNowByOwner: () => void;
  rollbackPre6ByOwner: () => void;
}

const ReleaseContext = createContext<ReleaseContextValue | null>(null);

export function ReleaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedReleaseState>(() =>
    safeReadJson<PersistedReleaseState>(RELEASE_STORAGE_KEY, DEFAULT_RELEASE_STATE)
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [justReleasedCelebration, setJustReleasedCelebration] = useState(false);

  useEffect(() => {
    safeWriteJson(RELEASE_STORAGE_KEY, state);
  }, [state]);

  const emitReleaseEvent = useCallback((byOwner: boolean) => {
    setJustReleasedCelebration(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kas:v6-released', { detail: { byOwner } })
      );
    }
  }, []);

  // Tick live timer while a countdown is active & auto-release at 00:00
  useEffect(() => {
    if (state.released60 || state.targetAtMs === null) return;

    const checkNow = () => {
      const current = Date.now();
      setNowMs(current);
      if (state.targetAtMs !== null && current >= state.targetAtMs) {
        setState((prev) => {
          if (prev.released60) return prev;
          return {
            ...prev,
            released60: true,
            targetAtMs: null,
            pausedRemainingMs: null,
            releasedAtIso: new Date().toISOString(),
          };
        });
        emitReleaseEvent(false);
      }
    };

    checkNow();
    const id = window.setInterval(checkNow, 200);
    return () => window.clearInterval(id);
  }, [emitReleaseEvent, state.released60, state.targetAtMs]);

  const timerStatus: ReleaseTimerStatus = state.released60
    ? 'released'
    : state.targetAtMs !== null
      ? 'counting'
      : state.pausedRemainingMs !== null
        ? 'paused'
        : 'unscheduled';

  const remainingMs = state.released60
    ? 0
    : state.targetAtMs !== null
      ? Math.max(0, state.targetAtMs - nowMs)
      : state.pausedRemainingMs ?? 0;

  const scheduleInSeconds = useCallback((seconds: number) => {
    const safeSec = Math.max(1, Math.round(seconds));
    const target = Date.now() + safeSec * 1000;
    setNowMs(Date.now());
    setState((prev) => ({
      ...prev,
      released60: false,
      targetAtMs: target,
      pausedRemainingMs: null,
      releasedAtIso: null,
    }));
  }, []);

  const scheduleAtTimestamp = useCallback((epochMs: number) => {
    const now = Date.now();
    if (epochMs <= now) {
      setState((prev) => ({
        ...prev,
        released60: true,
        targetAtMs: null,
        pausedRemainingMs: null,
        releasedAtIso: new Date().toISOString(),
      }));
      emitReleaseEvent(true);
      return;
    }
    setNowMs(now);
    setState((prev) => ({
      ...prev,
      released60: false,
      targetAtMs: epochMs,
      pausedRemainingMs: null,
      releasedAtIso: null,
    }));
  }, [emitReleaseEvent]);

  const pauseTimer = useCallback(() => {
    setState((prev) => {
      if (prev.released60 || prev.targetAtMs === null) return prev;
      const rem = Math.max(1000, prev.targetAtMs - Date.now());
      return {
        ...prev,
        targetAtMs: null,
        pausedRemainingMs: rem,
      };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setNowMs(Date.now());
    setState((prev) => {
      if (prev.released60 || prev.pausedRemainingMs === null) return prev;
      return {
        ...prev,
        targetAtMs: Date.now() + prev.pausedRemainingMs,
        pausedRemainingMs: null,
      };
    });
  }, []);

  const cancelTimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      targetAtMs: null,
      pausedRemainingMs: null,
    }));
  }, []);

  const releaseNowByOwner = useCallback(() => {
    setState((prev) => ({
      ...prev,
      released60: true,
      targetAtMs: null,
      pausedRemainingMs: null,
      releasedAtIso: new Date().toISOString(),
    }));
    emitReleaseEvent(true);
  }, [emitReleaseEvent]);

  const rollbackPre6ByOwner = useCallback(() => {
    setJustReleasedCelebration(false);
    setState((prev) => ({
      ...prev,
      released60: false,
      targetAtMs: null,
      pausedRemainingMs: null,
      releasedAtIso: null,
    }));
  }, []);

  const toggleOwnerMode = useCallback(() => {
    setState((prev) => ({ ...prev, isOwnerMode: !prev.isOwnerMode }));
  }, []);

  const dismissCelebration = useCallback(() => {
    setJustReleasedCelebration(false);
  }, []);

  const value = useMemo<ReleaseContextValue>(
    () => ({
      released60: state.released60,
      isOwnerMode: state.isOwnerMode,
      toggleOwnerMode,
      timerStatus,
      remainingMs,
      targetAtMs: state.targetAtMs,
      releasedAtIso: state.releasedAtIso,
      releaseModalOpen,
      setReleaseModalOpen,
      justReleasedCelebration,
      dismissCelebration,
      scheduleInSeconds,
      scheduleAtTimestamp,
      pauseTimer,
      resumeTimer,
      cancelTimer,
      releaseNowByOwner,
      rollbackPre6ByOwner,
    }),
    [
      cancelTimer,
      dismissCelebration,
      justReleasedCelebration,
      pauseTimer,
      releaseModalOpen,
      releaseNowByOwner,
      remainingMs,
      resumeTimer,
      rollbackPre6ByOwner,
      scheduleAtTimestamp,
      scheduleInSeconds,
      state.isOwnerMode,
      state.released60,
      state.releasedAtIso,
      state.targetAtMs,
      timerStatus,
      toggleOwnerMode,
    ]
  );

  return <ReleaseContext.Provider value={value}>{children}</ReleaseContext.Provider>;
}

export function useRelease(): ReleaseContextValue {
  const ctx = useContext(ReleaseContext);
  if (!ctx) {
    throw new Error('useRelease must be used inside ReleaseProvider');
  }
  return ctx;
}
