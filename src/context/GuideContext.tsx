import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { SceneId } from './AudioManagerContext';
import { dispatchSceneCommand, useStudio } from './StudioContext';
import {
  TUTORIAL_CHAPTERS,
  TUTORIAL_STEPS,
  type TutorialChapter,
  type TutorialStep,
} from '../data/helpCatalog';
import { safeReadJson, safeWriteJson } from '../utils/safeStorage';

const GUIDE_STORAGE_KEY = 'kas_guide_v1';

interface PersistedGuideState {
  helpHintsEnabled: boolean;
  completedChapters: string[];
  lastStepIndex: number;
  hasSeenWelcome: boolean;
}

const DEFAULT_PERSISTED_GUIDE: PersistedGuideState = {
  helpHintsEnabled: true,
  completedChapters: [],
  lastStepIndex: 0,
  hasSeenWelcome: false,
};

export interface PopoverAnchor {
  id: string;
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
}

interface GuideContextValue {
  helpHintsEnabled: boolean;
  setHelpHintsEnabled: (enabled: boolean) => void;
  toggleHelpHints: () => void;
  hubOpen: boolean;
  setHubOpen: Dispatch<SetStateAction<boolean>>;
  tourActive: boolean;
  tourAutoPlay: boolean;
  setTourAutoPlay: Dispatch<SetStateAction<boolean>>;
  toggleTourAutoPlay: () => void;
  tourAutoPlaySec: 4 | 6 | 9;
  setTourAutoPlaySec: (sec: 4 | 6 | 9) => void;
  autoPlayRemainingSec: number;
  autoPlayProgress: number;
  activeStepIndex: number;
  activeStep: TutorialStep | null;
  activeChapter: TutorialChapter | null;
  completedChapters: string[];
  hasProgress: boolean;
  startFullTour: () => void;
  startAutoTour: () => void;
  resumeTour: () => void;
  startChapter: (chapterId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipChapter: () => void;
  stopTour: () => void;
  activePopover: PopoverAnchor | null;
  openPopover: (id: string, rect: DOMRect) => void;
  closePopover: () => void;
  scheduleClosePopover: () => void;
  cancelClosePopover: () => void;
}

const GuideContext = createContext<GuideContextValue | null>(null);

interface GuideProviderProps {
  children: ReactNode;
  activeScene: SceneId;
  onSelectScene: (scene: SceneId) => void;
}

export function GuideProvider({
  children,
  activeScene,
  onSelectScene,
}: GuideProviderProps) {
  const {
    setDrawerOpen,
    setDrawerTab,
    setZenMode,
    setPaletteOpen,
    setShortcutsOpen,
    notify,
  } = useStudio();

  const [persisted, setPersisted] = useState<PersistedGuideState>(() =>
    safeReadJson<PersistedGuideState>(GUIDE_STORAGE_KEY, DEFAULT_PERSISTED_GUIDE)
  );
  const [hubOpen, setHubOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourAutoPlay, setTourAutoPlay] = useState(false);
  const [tourAutoPlaySec, setTourAutoPlaySec] = useState<4 | 6 | 9>(6);
  const [autoPlayProgress, setAutoPlayProgress] = useState(0);
  const [autoPlayRemainingSec, setAutoPlayRemainingSec] = useState(6);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(() =>
    Math.min(
      Math.max(0, persisted.lastStepIndex),
      Math.max(0, TUTORIAL_STEPS.length - 1)
    )
  );
  const [activePopover, setActivePopover] = useState<PopoverAnchor | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const stepElapsedMsRef = useRef<number>(0);

  useEffect(() => {
    safeWriteJson(GUIDE_STORAGE_KEY, persisted);
  }, [persisted]);

  const helpHintsEnabled = persisted.helpHintsEnabled;
  const completedChapters = persisted.completedChapters;

  const toggleHelpHints = useCallback(() => {
    setActivePopover(null);
    setPersisted((prev) => {
      const nextVal = !prev.helpHintsEnabled;
      notify(
        nextVal ? 'Info Hints ("i") On' : 'Info Hints ("i") Hidden',
        nextVal
          ? 'Tap or hover any tiny "i" badge to learn what a button does'
          : 'Clean view enabled — tap "i" in the top bar anytime'
      );
      return { ...prev, helpHintsEnabled: nextVal };
    });
  }, [notify]);

  const setHelpHintsEnabled = useCallback((enabled: boolean) => {
    setActivePopover(null);
    setPersisted((prev) => ({ ...prev, helpHintsEnabled: enabled }));
  }, []);

  const activeStep = tourActive ? TUTORIAL_STEPS[activeStepIndex] ?? null : null;
  const activeChapter = useMemo(() => {
    if (!activeStep) return null;
    return TUTORIAL_CHAPTERS.find((c) => c.id === activeStep.chapterId) ?? null;
  }, [activeStep]);

  const markChapterCompleted = useCallback((chapterId: string) => {
    setPersisted((prev) => {
      if (prev.completedChapters.includes(chapterId)) return prev;
      return {
        ...prev,
        completedChapters: [...prev.completedChapters, chapterId],
      };
    });
  }, []);

  // Automatically prepare scene, studio drawer, tab, and game sub-panels for the current step
  useEffect(() => {
    if (!tourActive || !activeStep) return;

    setZenMode(false);
    setPaletteOpen(false);
    setShortcutsOpen(false);
    setActivePopover(null);
    stepElapsedMsRef.current = 0;
    setAutoPlayProgress(0);
    setAutoPlayRemainingSec(tourAutoPlaySec);

    if (activeStep.scene && activeStep.scene !== activeScene) {
      onSelectScene(activeStep.scene);
    }

    if (typeof activeStep.drawerOpen === 'boolean') {
      setDrawerOpen(activeStep.drawerOpen);
    }
    if (activeStep.drawerTab) {
      setDrawerTab(activeStep.drawerTab);
    }

    let t1: number | null = null;
    let t2: number | null = null;
    const prep = activeStep.prepareCommand;
    if (prep) {
      const firePrep = () => {
        if (typeof prep.openControls === 'boolean') {
          dispatchSceneCommand({
            scene: prep.scene,
            type: 'set-controls-open',
            open: prep.openControls,
          });
        }
        if (prep.scene === 'ocean') {
          if (prep.spaceView === true) {
            dispatchSceneCommand({ scene: 'ocean', type: 'enter-space' });
          } else if (prep.spaceView === false) {
            dispatchSceneCommand({ scene: 'ocean', type: 'return-ocean' });
          }
        }
      };
      // Fire promptly and once after scene transition settles so mounted scene receives it
      t1 = window.setTimeout(firePrep, 60);
      t2 = window.setTimeout(firePrep, 320);
    }

    setPersisted((prev) => ({
      ...prev,
      lastStepIndex: activeStepIndex,
      hasSeenWelcome: true,
    }));

    return () => {
      if (t1 !== null) window.clearTimeout(t1);
      if (t2 !== null) window.clearTimeout(t2);
    };
  }, [
    activeScene,
    activeStep,
    activeStepIndex,
    onSelectScene,
    setDrawerOpen,
    setDrawerTab,
    setPaletteOpen,
    setShortcutsOpen,
    setZenMode,
    tourActive,
    tourAutoPlaySec,
  ]);

  const startFullTour = useCallback(() => {
    setHubOpen(false);
    setTourAutoPlay(false);
    setActiveStepIndex(0);
    setTourActive(true);
    setPersisted((prev) => ({ ...prev, lastStepIndex: 0, hasSeenWelcome: true }));
  }, []);

  const startAutoTour = useCallback(() => {
    setHubOpen(false);
    setActiveStepIndex(0);
    setTourAutoPlay(true);
    setTourActive(true);
    setPersisted((prev) => ({ ...prev, lastStepIndex: 0, hasSeenWelcome: true }));
    notify('Hands-Free Tutorial Started', `Advancing every ${tourAutoPlaySec}s automatically`);
  }, [notify, tourAutoPlaySec]);

  const resumeTour = useCallback(() => {
    setHubOpen(false);
    setTourActive(true);
  }, []);

  const startChapter = useCallback((chapterId: string) => {
    const idx = TUTORIAL_STEPS.findIndex((s) => s.chapterId === chapterId);
    if (idx === -1) return;
    setHubOpen(false);
    setActiveStepIndex(idx);
    setTourActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setTourActive(false);
    setTourAutoPlay(false);
    setActivePopover(null);
  }, []);

  const toggleTourAutoPlay = useCallback(() => {
    setTourAutoPlay((prev) => {
      const next = !prev;
      stepElapsedMsRef.current = 0;
      setAutoPlayProgress(0);
      setAutoPlayRemainingSec(tourAutoPlaySec);
      return next;
    });
  }, [tourAutoPlaySec]);

  const nextStep = useCallback(() => {
    const current = TUTORIAL_STEPS[activeStepIndex];
    const nextIdx = activeStepIndex + 1;
    if (nextIdx >= TUTORIAL_STEPS.length) {
      if (current) markChapterCompleted(current.chapterId);
      setTourActive(false);
      setTourAutoPlay(false);
      setPersisted((prev) => ({ ...prev, lastStepIndex: 0 }));
      notify('Tutorial Complete!', 'You explored every world and setting. Open Guide anytime!');
      return;
    }
    const next = TUTORIAL_STEPS[nextIdx];
    if (current && next && next.chapterId !== current.chapterId) {
      markChapterCompleted(current.chapterId);
    }
    setActiveStepIndex(nextIdx);
  }, [activeStepIndex, markChapterCompleted, notify]);

  // Hands-free Auto-Play timer: advances steps smoothly while paused if an "i" popover is open
  useEffect(() => {
    if (!tourActive || !tourAutoPlay) {
      stepElapsedMsRef.current = 0;
      setAutoPlayProgress(0);
      setAutoPlayRemainingSec(tourAutoPlaySec);
      return;
    }

    const totalMs = tourAutoPlaySec * 1000;
    let lastTick = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;
      // Pause countdown while user is inspecting an "i" popover
      if (activePopover) return;
      stepElapsedMsRef.current += dt;
      const pct = Math.min(1, stepElapsedMsRef.current / totalMs);
      setAutoPlayProgress(pct);
      setAutoPlayRemainingSec(Math.max(1, Math.ceil((totalMs - stepElapsedMsRef.current) / 1000)));
      if (stepElapsedMsRef.current >= totalMs) {
        stepElapsedMsRef.current = 0;
        nextStep();
      }
    }, 100);

    return () => window.clearInterval(id);
  }, [activePopover, activeStepIndex, nextStep, tourActive, tourAutoPlay, tourAutoPlaySec]);

  const prevStep = useCallback(() => {
    setActiveStepIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const skipChapter = useCallback(() => {
    const current = TUTORIAL_STEPS[activeStepIndex];
    if (!current) return;
    markChapterCompleted(current.chapterId);
    const nextIdx = TUTORIAL_STEPS.findIndex(
      (s, i) => i > activeStepIndex && s.chapterId !== current.chapterId
    );
    if (nextIdx === -1) {
      setTourActive(false);
      setTourAutoPlay(false);
      setPersisted((prev) => ({ ...prev, lastStepIndex: 0 }));
      notify('Tutorial Complete!', 'Open Guide anytime to revisit any chapter.');
    } else {
      setActiveStepIndex(nextIdx);
    }
  }, [activeStepIndex, markChapterCompleted, notify]);

  const cancelClosePopover = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPopover = useCallback(
    (id: string, rect: DOMRect) => {
      cancelClosePopover();
      setActivePopover({
        id,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    [cancelClosePopover]
  );

  const closePopover = useCallback(() => {
    cancelClosePopover();
    setActivePopover(null);
  }, [cancelClosePopover]);

  const scheduleClosePopover = useCallback(() => {
    cancelClosePopover();
    closeTimerRef.current = window.setTimeout(() => {
      setActivePopover(null);
    }, 180);
  }, [cancelClosePopover]);

  // Close popovers on Esc or scroll
  useEffect(() => {
    if (!activePopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopover(null);
    };
    const onScroll = () => setActivePopover(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [activePopover]);

  const value = useMemo<GuideContextValue>(
    () => ({
      helpHintsEnabled,
      setHelpHintsEnabled,
      toggleHelpHints,
      hubOpen,
      setHubOpen,
      tourActive,
      tourAutoPlay,
      setTourAutoPlay,
      toggleTourAutoPlay,
      tourAutoPlaySec,
      setTourAutoPlaySec,
      autoPlayRemainingSec,
      autoPlayProgress,
      activeStepIndex,
      activeStep,
      activeChapter,
      completedChapters,
      hasProgress: persisted.lastStepIndex > 0,
      startFullTour,
      startAutoTour,
      resumeTour,
      startChapter,
      nextStep,
      prevStep,
      skipChapter,
      stopTour,
      activePopover,
      openPopover,
      closePopover,
      scheduleClosePopover,
      cancelClosePopover,
    }),
    [
      activeChapter,
      activePopover,
      activeStep,
      activeStepIndex,
      autoPlayProgress,
      autoPlayRemainingSec,
      cancelClosePopover,
      closePopover,
      completedChapters,
      helpHintsEnabled,
      hubOpen,
      nextStep,
      openPopover,
      persisted.lastStepIndex,
      prevStep,
      resumeTour,
      scheduleClosePopover,
      setHelpHintsEnabled,
      skipChapter,
      startAutoTour,
      startChapter,
      startFullTour,
      stopTour,
      toggleHelpHints,
      toggleTourAutoPlay,
      tourActive,
      tourAutoPlay,
      tourAutoPlaySec,
    ]
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) {
    throw new Error('useGuide must be used inside GuideProvider');
  }
  return ctx;
}
