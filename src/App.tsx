/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bike,
  Bot,
  Hand,
  Landmark,
  Sunset,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import BasketballScene from './components/BasketballScene';
import JungleTempleScene from './components/JungleTempleScene';
import RuralCyclistScene from './components/RuralCyclistScene';
import SlingshotScene from './components/SlingshotScene';
import SunsetOceanScene from './components/SunsetOceanScene';
import CommandPalette from './components/studio/CommandPalette';
import { InfoBadge, InfoPopoverPortal } from './components/studio/InfoBadge';
import ReleaseModal from './components/studio/ReleaseModal';
import SandboxDrawer from './components/studio/SandboxDrawer';
import ShortcutsModal from './components/studio/ShortcutsModal';
import StudioDrawer from './components/studio/StudioDrawer';
import TutorialHubModal from './components/studio/TutorialHubModal';
import TutorialSpotlightOverlay from './components/studio/TutorialSpotlightOverlay';
import UnifiedHudOverlay from './components/studio/UnifiedHudOverlay';
import { GuideProvider, useGuide } from './context/GuideContext';
import { ReleaseProvider, useRelease } from './context/ReleaseContext';
import {
  AudioManagerProvider,
  useAudioManager,
  type SceneId,
} from './context/AudioManagerContext';
import {
  ALL_SCENES,
  SCENE_META,
  StudioProvider,
  isTypingTarget,
  useStudio,
  type TourStatus,
} from './context/StudioContext';
import { captureStageCanvasPng } from './utils/safeStorage';

function BasketballIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="M5.6 5.6a12 12 0 0 1 0 12.8" />
      <path d="M18.4 5.6a12 12 0 0 0 0 12.8" />
    </svg>
  );
}

const SCENE_FADE_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as const,
};

const SCENE_AMBIENT_BACKDROP: Record<SceneId, string> = {
  temple:
    'radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.28), transparent 52%), radial-gradient(circle at 80% 78%, rgba(245, 158, 11, 0.22), transparent 55%), #05110e',
  ocean:
    'radial-gradient(circle at 50% 25%, rgba(249, 115, 22, 0.32), transparent 55%), radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.22), transparent 55%), #050816',
  cyclist:
    'radial-gradient(circle at 30% 28%, rgba(251, 191, 36, 0.28), transparent 52%), radial-gradient(circle at 80% 75%, rgba(168, 85, 247, 0.26), transparent 55%), #0f0b29',
  slingshot:
    'radial-gradient(circle at 30% 20%, rgba(56, 189, 248, 0.30), transparent 54%), radial-gradient(circle at 75% 80%, rgba(132, 204, 22, 0.24), transparent 55%), #091d36',
  basketball:
    'radial-gradient(circle at 50% 22%, rgba(245, 158, 11, 0.28), transparent 50%), radial-gradient(circle at 20% 82%, rgba(244, 63, 94, 0.22), transparent 55%), #060914',
};

interface SceneWorkspaceProps {
  activeScene: SceneId;
  onSelectScene: (scene: SceneId) => void;
}

function SceneWorkspace({ activeScene, onSelectScene }: SceneWorkspaceProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [globalAutoMode, setGlobalAutoMode] = useState(true);
  const [syncVersion, setSyncVersion] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);

  // Idle Auto Tour runtime state
  const [tourStatus, setTourStatus] = useState<TourStatus>('off');
  const [tourPaused, setTourPaused] = useState(false);
  const [tourRemainingSec, setTourRemainingSec] = useState(10);
  const [tourProgress, setTourProgress] = useState(0);
  const [tourBannerTitle, setTourBannerTitle] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const tourSceneStartedAtRef = useRef<number>(Date.now());
  const tourPausedRef = useRef<boolean>(false);
  const tourStatusRef = useRef<TourStatus>('off');
  const hudHoveredRef = useRef<boolean>(false);
  const savedAutoBeforeTourRef = useRef<boolean>(true);
  const shuffleBagRef = useRef<SceneId[]>([]);
  const bannerTimeoutRef = useRef<number | null>(null);
  const activeSceneRef = useRef<SceneId>(activeScene);
  const globalAutoRef = useRef<boolean>(globalAutoMode);
  const autoZenEnteredFsRef = useRef<boolean>(false);
  const justAutoTriggeredRef = useRef<boolean>(false);

  const {
    soundEnabled,
    toggleSound,
    setActiveSceneAudio,
    setMasterVolume,
    setAmbienceVolume,
    setPadsVolume,
    setRainVolume,
    setSfxVolume,
    setReverbMix,
    setMasterMuted,
    setAmbienceMuted,
    setPadsMuted,
    setRainMuted,
    setSfxMuted,
    setCrowdMuted,
    setMuteOnTabBlur,
    setAcousticProfile,
    setSfxStyle,
  } = useAudioManager();

  const {
    prefs,
    activePreset,
    telemetry,
    zenMode,
    altPeekZen,
    setAltPeekZen,
    setZenMode,
    drawerOpen,
    setDrawerOpen,
    setDrawerTab,
    setSandboxOpen,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    updatePrefs,
    stepPreset,
    randomizePreset,
    bumpRecords,
    notify,
    setTourPresetOverrideId,
  } = useStudio();
  const { tourActive, hubOpen, setHubOpen } = useGuide();
  const { releaseModalOpen, setReleaseModalOpen } = useRelease();
  const guideBlockingRef = useRef<boolean>(false);
  useEffect(() => {
    guideBlockingRef.current = tourActive || hubOpen || releaseModalOpen;
  }, [hubOpen, releaseModalOpen, tourActive]);

  // Celebratory chime & toast whenever Update 6.0 releases (timer 00:00 or Owner trigger)
  useEffect(() => {
    const onReleased = (e: Event) => {
      const byOwner = Boolean((e as CustomEvent<{ byOwner?: boolean }>).detail?.byOwner);
      notify(
        'Update 6.0 Released!',
        byOwner
          ? 'Owner instant push — all 6.0 upgrades are now live!'
          : 'Countdown hit 00:00 — all 6.0 upgrades are now live!'
      );
    };
    window.addEventListener('kas:v6-released', onReleased);
    return () => window.removeEventListener('kas:v6-released', onReleased);
  }, [notify]);

  // Sync Audio preferences into AudioManager
  useEffect(() => {
    setMasterVolume(prefs.masterVolume);
    setAmbienceVolume(prefs.ambienceVolume);
    setPadsVolume(prefs.padsVolume);
    setRainVolume(prefs.rainVolume);
    setSfxVolume(prefs.sfxVolume);
    setReverbMix(prefs.reverbMix);
    setMasterMuted(prefs.masterMuted);
    setAmbienceMuted(prefs.ambienceMuted);
    setPadsMuted(prefs.padsMuted);
    setRainMuted(prefs.rainMuted);
    setSfxMuted(prefs.sfxMuted);
    setCrowdMuted(prefs.crowdMuted);
    setMuteOnTabBlur(prefs.muteOnTabBlur);
    setAcousticProfile(prefs.acousticProfile);
    setSfxStyle(prefs.sfxStyle);
  }, [
    prefs.acousticProfile,
    prefs.ambienceMuted,
    prefs.ambienceVolume,
    prefs.crowdMuted,
    prefs.masterMuted,
    prefs.masterVolume,
    prefs.muteOnTabBlur,
    prefs.padsMuted,
    prefs.padsVolume,
    prefs.rainMuted,
    prefs.rainVolume,
    prefs.reverbMix,
    prefs.sfxMuted,
    prefs.sfxStyle,
    prefs.sfxVolume,
    setAcousticProfile,
    setAmbienceMuted,
    setAmbienceVolume,
    setCrowdMuted,
    setMasterMuted,
    setMasterVolume,
    setMuteOnTabBlur,
    setPadsMuted,
    setPadsVolume,
    setRainMuted,
    setRainVolume,
    setReverbMix,
    setSfxMuted,
    setSfxStyle,
    setSfxVolume,
  ]);

  useEffect(() => {
    activeSceneRef.current = activeScene;
    setActiveSceneAudio(activeScene);
  }, [activeScene, setActiveSceneAudio]);

  useEffect(() => {
    globalAutoRef.current = globalAutoMode;
  }, [globalAutoMode]);

  useEffect(() => {
    tourPausedRef.current = tourPaused;
  }, [tourPaused]);

  const showTourBanner = useCallback((sceneId: SceneId) => {
    setTourBannerTitle(SCENE_META[sceneId].label);
    if (bannerTimeoutRef.current !== null) {
      window.clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = window.setTimeout(() => {
      setTourBannerTitle(null);
    }, 2200);
  }, []);

  const pickNextTourScene = useCallback(
    (current: SceneId, direction: 1 | -1 = 1): SceneId => {
      const pool =
        prefs.tourIncludedScenes.length > 0 ? prefs.tourIncludedScenes : ALL_SCENES;
      if (pool.length === 1) return pool[0];

      if (prefs.tourOrderMode === 'shuffle' && direction === 1) {
        shuffleBagRef.current = shuffleBagRef.current.filter(
          (id) => id !== current && pool.includes(id)
        );
        if (shuffleBagRef.current.length === 0) {
          const candidates = pool.filter((id) => id !== current);
          for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
          }
          shuffleBagRef.current = candidates;
        }
        return shuffleBagRef.current.shift() ?? pool[0];
      }

      const idx = pool.indexOf(current);
      if (idx === -1) return pool[0];
      const nextIdx = (idx + direction + pool.length) % pool.length;
      return pool[nextIdx];
    },
    [prefs.tourIncludedScenes, prefs.tourOrderMode]
  );

  const advanceTourScene = useCallback(
    (direction: 1 | -1 = 1) => {
      const next = pickNextTourScene(activeSceneRef.current, direction);
      tourSceneStartedAtRef.current = Date.now();
      onSelectScene(next);
      setGlobalAutoMode(true);
      setSyncVersion((v) => v + 1);
      showTourBanner(next);
      if (prefs.tourSyncPresets) {
        setTourPresetOverrideId(
          prefs.scenePresetIds[next] ?? SCENE_META[next].defaultPresetId
        );
      } else {
        setTourPresetOverrideId(null);
      }
    },
    [
      onSelectScene,
      pickNextTourScene,
      prefs.scenePresetIds,
      prefs.tourSyncPresets,
      setTourPresetOverrideId,
      showTourBanner,
    ]
  );

  useEffect(() => {
    if (!prefs.tourEnabled || !prefs.tourSyncPresets || tourStatus !== 'touring') {
      setTourPresetOverrideId(null);
    }
  }, [prefs.tourEnabled, prefs.tourSyncPresets, setTourPresetOverrideId, tourStatus]);

  // 45-Second Idle Watcher: Automatically turn on & start Auto Tour when idle for 45s
  useEffect(() => {
    if (prefs.tourEnabled || !prefs.tourAutoEnableIdle45) return;

    lastActivityRef.current = Date.now();
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('pointermove', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('wheel', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });

    const checkId = window.setInterval(() => {
      if (
        guideBlockingRef.current ||
        paletteOpen ||
        shortcutsOpen ||
        drawerOpen
      ) {
        lastActivityRef.current = Date.now();
        return;
      }
      if (Date.now() - lastActivityRef.current >= 45_000) {
        savedAutoBeforeTourRef.current = globalAutoRef.current;
        justAutoTriggeredRef.current = true;
        updatePrefs({ tourEnabled: true });
        notify('45s Idle · Auto Tour On', 'Rotating through all worlds automatically');
      }
    }, 500);

    return () => {
      window.clearInterval(checkId);
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('pointermove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('wheel', markActive);
      window.removeEventListener('touchstart', markActive);
    };
  }, [
    drawerOpen,
    notify,
    paletteOpen,
    prefs.tourAutoEnableIdle45,
    prefs.tourEnabled,
    shortcutsOpen,
    updatePrefs,
  ]);

  // Idle Auto Tour Engine with HUD Hover Protection
  useEffect(() => {
    if (!prefs.tourEnabled) {
      tourStatusRef.current = 'off';
      setTourStatus('off');
      setTourPaused(false);
      setTourProgress(0);
      setTourBannerTitle(null);
      return;
    }

    lastActivityRef.current = Date.now();
    if (justAutoTriggeredRef.current) {
      justAutoTriggeredRef.current = false;
      tourStatusRef.current = 'touring';
      setTourStatus('touring');
      advanceTourScene(1);
    } else {
      tourStatusRef.current = 'waiting';
      setTourStatus('waiting');
    }

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      if (tourStatusRef.current === 'touring') {
        tourStatusRef.current = 'waiting';
        setTourStatus('waiting');
        setTourProgress(0);
        if (prefs.tourRestoreMode) {
          setGlobalAutoMode(savedAutoBeforeTourRef.current);
          setSyncVersion((v) => v + 1);
        }
      }
    };

    window.addEventListener('pointerdown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('wheel', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    if (prefs.tourPauseOnMouseMove) {
      window.addEventListener('pointermove', handleUserActivity, { passive: true });
    }

    const tickId = window.setInterval(() => {
      if (
        guideBlockingRef.current ||
        tourPausedRef.current ||
        (prefs.tourPauseOnHover && hudHoveredRef.current)
      ) {
        tourStatusRef.current = 'paused';
        setTourStatus('paused');
        return;
      }

      const now = Date.now();
      const idleMs = Math.max(2000, prefs.tourIdleDelaySec * 1000);
      const dwellMs = Math.max(4000, prefs.tourDwellSec * 1000);

      if (tourStatusRef.current !== 'touring') {
        const elapsedIdle = now - lastActivityRef.current;
        if (elapsedIdle >= idleMs) {
          savedAutoBeforeTourRef.current = globalAutoRef.current;
          tourStatusRef.current = 'touring';
          setTourStatus('touring');
          advanceTourScene(1);
        } else {
          tourStatusRef.current = 'waiting';
          setTourStatus('waiting');
          const remMs = Math.max(0, idleMs - elapsedIdle);
          setTourRemainingSec(Math.ceil(remMs / 1000));
          setTourProgress(elapsedIdle / idleMs);
        }
      } else {
        const elapsedDwell = now - tourSceneStartedAtRef.current;
        if (elapsedDwell >= dwellMs) {
          advanceTourScene(1);
        } else {
          const remMs = Math.max(0, dwellMs - elapsedDwell);
          setTourRemainingSec(Math.ceil(remMs / 1000));
          setTourProgress(elapsedDwell / dwellMs);
        }
      }
    }, 250);

    return () => {
      window.clearInterval(tickId);
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('wheel', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      if (prefs.tourPauseOnMouseMove) {
        window.removeEventListener('pointermove', handleUserActivity);
      }
    };
  }, [
    advanceTourScene,
    prefs.tourDwellSec,
    prefs.tourEnabled,
    prefs.tourIdleDelaySec,
    prefs.tourPauseOnHover,
    prefs.tourPauseOnMouseMove,
    prefs.tourRestoreMode,
  ]);

  // Idle Cursor Auto-Hide
  useEffect(() => {
    if (
      prefs.cursorAutoHideSec <= 0 ||
      drawerOpen ||
      paletteOpen ||
      shortcutsOpen ||
      tourActive ||
      hubOpen ||
      releaseModalOpen
    ) {
      setCursorHidden(false);
      return;
    }

    let timerId: number | null = null;
    const armHideTimer = () => {
      setCursorHidden(false);
      if (timerId !== null) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        setCursorHidden(true);
      }, prefs.cursorAutoHideSec * 1000);
    };

    armHideTimer();
    window.addEventListener('pointermove', armHideTimer, { passive: true });
    window.addEventListener('pointerdown', armHideTimer, { passive: true });
    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener('pointermove', armHideTimer);
      window.removeEventListener('pointerdown', armHideTimer);
      setCursorHidden(false);
    };
  }, [drawerOpen, hubOpen, paletteOpen, prefs.cursorAutoHideSec, releaseModalOpen, shortcutsOpen, tourActive]);

  // Fullscreen listener + Fullscreen Auto-Zen
  useEffect(() => {
    const syncFs = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (fs && prefs.fullscreenAutoZen) {
        autoZenEnteredFsRef.current = true;
        setZenMode(true);
      } else if (!fs && autoZenEnteredFsRef.current) {
        autoZenEnteredFsRef.current = false;
        setZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', syncFs);
    return () => document.removeEventListener('fullscreenchange', syncFs);
  }, [prefs.fullscreenAutoZen, setZenMode]);

  // Auto-Switch Color Presets on interval when enabled
  useEffect(() => {
    if (!prefs.presetAutoCycle) return;
    const ms = Math.max(4, prefs.presetAutoCycleSec) * 1000;
    const id = window.setInterval(() => {
      if (paletteOpen || shortcutsOpen) return;
      stepPreset(1, activeScene);
    }, ms);
    return () => window.clearInterval(id);
  }, [
    activeScene,
    paletteOpen,
    prefs.presetAutoCycle,
    prefs.presetAutoCycleSec,
    shortcutsOpen,
    stepPreset,
  ]);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      const target = outerRef.current ?? document.documentElement;
      void target.requestFullscreen?.().catch(() => {
        notify('Fullscreen Blocked', 'Browser declined fullscreen request');
      });
    }
  }, [notify]);

  const handleCaptureScreenshot = useCallback(() => {
    const subtitle = telemetry.metrics
      .slice(0, 3)
      .map((m) => `${m.label}: ${m.value}`)
      .join(' · ');
    const caption = prefs.screenshotIncludeHud
      ? {
          title: SCENE_META[activeScene].label,
          subtitle,
          accent: activePreset.accent,
        }
      : undefined;

    const ok = captureStageCanvasPng(stageRef.current, `studio-${activeScene}`, caption);
    if (ok) {
      bumpRecords({ totalScreenshots: 1 });
      notify('Snapshot Saved', `${SCENE_META[activeScene].label} PNG exported`);
    } else {
      notify('Snapshot Unavailable', 'Canvas buffer busy; try again in a moment');
    }
  }, [
    activePreset.accent,
    activeScene,
    bumpRecords,
    notify,
    prefs.screenshotIncludeHud,
    telemetry.metrics,
  ]);

  const handleToggleGlobalMode = useCallback(() => {
    setGlobalAutoMode((prev) => {
      const next = !prev;
      if (!next && prefs.tourEnabled) {
        updatePrefs({ tourEnabled: false });
      }
      return next;
    });
    setSyncVersion((v) => v + 1);
  }, [prefs.tourEnabled, updatePrefs]);

  const handleToggleTourArm = useCallback(() => {
    const next = !prefs.tourEnabled;
    updatePrefs({ tourEnabled: next });
    if (next) {
      lastActivityRef.current = Date.now();
      setTourPaused(false);
      setGlobalAutoMode(true);
      setSyncVersion((v) => v + 1);
      notify('Auto Tour Armed', `Starts after ${prefs.tourIdleDelaySec}s idle`);
    } else {
      notify('Auto Tour Off', 'Staying on current scene');
    }
  }, [notify, prefs.tourEnabled, prefs.tourIdleDelaySec, updatePrefs]);

  const handleTourTogglePause = useCallback(() => {
    setTourPaused((prev) => {
      const next = !prev;
      if (!next) {
        lastActivityRef.current = Date.now();
        tourSceneStartedAtRef.current = Date.now();
      }
      return next;
    });
  }, []);

  const handleTourStep = useCallback(
    (direction: 1 | -1) => {
      if (!prefs.tourEnabled) {
        updatePrefs({ tourEnabled: true });
      }
      savedAutoBeforeTourRef.current = globalAutoRef.current;
      tourStatusRef.current = 'touring';
      setTourStatus('touring');
      setTourPaused(false);
      advanceTourScene(direction);
    },
    [advanceTourScene, prefs.tourEnabled, updatePrefs]
  );

  // Studio 4.1 Global Keyboard Shortcuts + Strict Input/Modal Guard + Alt Peek
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleCaptureScreenshot();
        return;
      }

      // Hold Alt to temporarily peek HUD in Zen Mode
      if (e.key === 'Alt' && zenMode && !paletteOpen && !shortcutsOpen) {
        setAltPeekZen(true);
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setShortcutsOpen(false);
        setDrawerOpen(false);
        setSandboxOpen(false);
        setHubOpen(false);
        setReleaseModalOpen(false);
        setAltPeekZen(false);
        return;
      }

      // Block all single-key & modifier shortcuts when modal or tutorial overlays are active
      if (paletteOpen || shortcutsOpen || hubOpen || tourActive || releaseModalOpen) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen((p) => !p);
        return;
      }

      if (e.altKey && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        stepPreset(e.key === '[' ? -1 : 1, activeScene);
        return;
      }

      if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        randomizePreset(activeScene);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const k = e.key.toLowerCase();
      if (k === '1') onSelectScene('temple');
      else if (k === '2') onSelectScene('ocean');
      else if (k === '3') onSelectScene('cyclist');
      else if (k === '4') onSelectScene('slingshot');
      else if (k === '5') onSelectScene('basketball');
      else if (k === 'b') {
        setDrawerOpen(false);
        setSandboxOpen((p) => !p);
      } else if (k === 'c') {
        setSandboxOpen(false);
        setDrawerTab('themes');
        setDrawerOpen((p) => !p);
      } else if (k === 'h') {
        setZenMode((p) => !p);
      } else if (k === 'f') {
        handleToggleFullscreen();
      } else if (k === 'p') {
        handleCaptureScreenshot();
      } else if (k === 'm') {
        toggleSound();
      } else if (k === 't') {
        handleToggleTourArm();
      } else if (k === '[') {
        handleTourStep(-1);
      } else if (k === ']') {
        handleTourStep(1);
      } else if (k === 'g') {
        setHubOpen((p) => !p);
      } else if (k === 'u') {
        setReleaseModalOpen((p) => !p);
      } else if (k === 'v') {
        const nextMode = prefs.renderMode === '3d' ? '2d' : '3d';
        updatePrefs({ renderMode: nextMode });
        notify(
          nextMode === '2d' ? 'Classic 2D View' : 'Enhanced 3D View',
          activeScene === 'temple'
            ? 'Temple Run stays native 3D'
            : 'Press V anytime to toggle 3D ↔ 2D'
        );
      } else if (k === 'a' && activeScene !== 'temple' && activeScene !== 'basketball') {
        handleToggleGlobalMode();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltPeekZen(false);
      }
    };
    const onBlur = () => setAltPeekZen(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    activeScene,
    handleCaptureScreenshot,
    handleToggleFullscreen,
    handleToggleGlobalMode,
    handleToggleTourArm,
    handleTourStep,
    hubOpen,
    notify,
    onSelectScene,
    paletteOpen,
    prefs.renderMode,
    randomizePreset,
    releaseModalOpen,
    setAltPeekZen,
    setDrawerOpen,
    setDrawerTab,
    setHubOpen,
    setPaletteOpen,
    setReleaseModalOpen,
    setSandboxOpen,
    setShortcutsOpen,
    setZenMode,
    shortcutsOpen,
    stepPreset,
    toggleSound,
    tourActive,
    updatePrefs,
    zenMode,
  ]);

  const outerBackground =
    prefs.surround === 'ambient'
      ? SCENE_AMBIENT_BACKDROP[activeScene]
      : prefs.surround === 'gradient'
        ? `radial-gradient(circle at 30% 25%, ${activePreset.surroundA}, transparent 60%), radial-gradient(circle at 75% 75%, ${activePreset.surroundB}, #050812 82%)`
        : prefs.surround === 'grid'
          ? `linear-gradient(145deg, ${activePreset.surroundA} 0%, #050814 100%)`
          : 'radial-gradient(circle at 50% 50%, #101522 0%, #04060c 85%)';

  const stageCssVars = {
    '--hud-bg': activePreset.hudBg,
    '--hud-surface': activePreset.hudSurface,
    '--hud-border': activePreset.hudBorder,
    '--hud-text': activePreset.hudText,
    '--hud-muted': activePreset.hudMuted,
    '--accent': activePreset.accent,
    '--accent-fg': activePreset.accentFg,
    '--stage-glow': activePreset.stageGlow,
    '--surround-a': activePreset.surroundA,
    '--surround-b': activePreset.surroundB,
  } as React.CSSProperties;

  const isSwiss = prefs.skin === 'swiss';
  const dockStyle = isSwiss
    ? {
        backgroundColor: `rgba(248, 250, 252, ${Math.max(0.93, prefs.hudOpacity)})`,
        borderColor: 'rgba(15, 23, 42, 0.16)',
        color: '#0f172a',
      }
    : {
        backgroundColor: 'rgba(9, 13, 25, 0.90)',
        borderColor: activePreset.hudBorder,
        color: activePreset.hudText,
        opacity: Math.max(0.55, Math.min(1, prefs.hudOpacity + 0.08)),
      };
  const dockAccent =
    isSwiss && !activePreset.isLight ? '#0284c7' : activePreset.accent;
  const dockAccentFg = isSwiss && !activePreset.isLight ? '#ffffff' : activePreset.accentFg;

  const stageClass =
    prefs.stageAspectLock === '21:9'
      ? 'stage-frame-21-9 rounded-none sm:rounded-xl'
      : prefs.stageAspectLock === '16:9'
        ? 'stage-frame-16-9 rounded-none sm:rounded-xl'
        : 'stage-frame-fill';

  const isFramed = prefs.stageAspectLock !== 'fill';
  const effectiveZen = zenMode && !altPeekZen;

  const handleHudHover = useCallback((hovered: boolean) => {
    hudHoveredRef.current = hovered;
  }, []);

  return (
    <div
      ref={outerRef}
      style={{ background: outerBackground }}
      className={`fixed inset-0 flex items-center justify-center overflow-hidden ${
        prefs.surround === 'grid' ? 'surround-grid-pattern' : ''
      } ${cursorHidden ? 'cursor-idle-hidden' : ''}`}
    >
      {/* Viewport-Relative Stage with 16:9 / 21:9 Containment */}
      <div
        ref={stageRef}
        style={{
          ...stageCssVars,
          boxShadow: isFramed
            ? `0 24px 80px rgba(0, 0, 0, 0.72), 0 0 0 1px ${activePreset.hudBorder}, 0 0 42px ${activePreset.stageGlow}`
            : undefined,
        }}
        className={`${stageClass} bg-[#070b18]`}
      >
        {/* Active Scene Layer */}
        <div
          className="relative h-full w-full"
          style={
            prefs.presetTarget === 'hud+scene' && activePreset.canvasFilter
              ? { filter: activePreset.canvasFilter }
              : undefined
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            {activeScene === 'temple' ? (
              <motion.div
                key="temple"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={SCENE_FADE_TRANSITION}
                className="absolute inset-0 h-full w-full"
              >
                <JungleTempleScene
                  globalAiMode={globalAutoMode}
                  aiSyncVersion={syncVersion}
                />
              </motion.div>
            ) : activeScene === 'ocean' ? (
              <motion.div
                key="ocean"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={SCENE_FADE_TRANSITION}
                className="absolute inset-0 h-full w-full"
              >
                <SunsetOceanScene
                  globalAiMode={globalAutoMode}
                  aiSyncVersion={syncVersion}
                />
              </motion.div>
            ) : activeScene === 'cyclist' ? (
              <motion.div
                key="cyclist"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={SCENE_FADE_TRANSITION}
                className="absolute inset-0 h-full w-full"
              >
                <RuralCyclistScene
                  globalAiMode={globalAutoMode}
                  aiSyncVersion={syncVersion}
                />
              </motion.div>
            ) : activeScene === 'slingshot' ? (
              <motion.div
                key="slingshot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={SCENE_FADE_TRANSITION}
                className="absolute inset-0 h-full w-full"
              >
                <SlingshotScene
                  globalAiMode={globalAutoMode}
                  aiSyncVersion={syncVersion}
                />
              </motion.div>
            ) : (
              <motion.div
                key="basketball"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={SCENE_FADE_TRANSITION}
                className="absolute inset-0 h-full w-full"
              >
                <BasketballScene
                  globalAiMode={globalAutoMode}
                  aiSyncVersion={syncVersion}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Update 6.0 Minimal Uncluttered HUD */}
        <UnifiedHudOverlay
          tourStatus={tourStatus}
          tourRemainingSec={tourRemainingSec}
          tourProgress={tourProgress}
          tourBannerTitle={tourBannerTitle}
          onTourPrev={() => handleTourStep(-1)}
          onTourNext={() => handleTourStep(1)}
          onTourTogglePause={handleTourTogglePause}
          onHudHoverChange={handleHudHover}
        />

        {/* Minimal Centered Bottom Floating Dock (Hidden in Zen Mode unless Alt-peeking) */}
        {!effectiveZen && (
          <nav
            aria-label="Scene, mode, and audio controls"
            style={dockStyle}
            onMouseEnter={() => handleHudHover(true)}
            onMouseLeave={() => handleHudHover(false)}
            className={`no-scrollbar pointer-events-auto absolute right-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 z-30 flex flex-nowrap items-center justify-between gap-1 overflow-x-auto border p-1 shadow-xl md:right-auto md:bottom-3 md:left-1/2 md:inline-flex md:max-w-[calc(100%-1.5rem)] md:-translate-x-1/2 md:justify-center md:overflow-visible ${
              prefs.skin === 'scoreboard'
                ? 'rounded-md border-2'
                : prefs.skin === 'obsidian'
                  ? 'rounded-lg'
                  : 'rounded-2xl'
            }`}
          >
            <div data-tour-id="dock-worlds" className="flex shrink-0 flex-nowrap items-center gap-1">
            {(
              [
                { id: 'temple', label: SCENE_META.temple.shortLabel, icon: Landmark },
                { id: 'ocean', label: SCENE_META.ocean.shortLabel, icon: Sunset },
                { id: 'cyclist', label: SCENE_META.cyclist.shortLabel, icon: Bike },
                { id: 'slingshot', label: SCENE_META.slingshot.shortLabel, icon: Target },
                { id: 'basketball', label: SCENE_META.basketball.shortLabel, icon: BasketballIcon },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeScene === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tour-id={`dock-${tab.id}`}
                  type="button"
                  onClick={() => onSelectScene(tab.id)}
                  aria-pressed={isSelected}
                  className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none md:h-8"
                  style={
                    isSelected
                      ? { backgroundColor: dockAccent, color: dockAccentFg }
                      : undefined
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                  <InfoBadge id={`dock-${tab.id}`} />
                </button>
              );
            })}
            </div>

            <span
              aria-hidden="true"
              className="mx-0.5 hidden h-4 w-px sm:inline-block"
              style={{ backgroundColor: dockStyle.borderColor }}
            />

            <div className="flex shrink-0 flex-nowrap items-center gap-1">
              <button
                data-tour-id="dock-auto-mode"
                type="button"
                onClick={handleToggleGlobalMode}
                aria-pressed={globalAutoMode}
                aria-label={
                  globalAutoMode
                    ? 'Switch all scenes to Manual mode'
                    : 'Switch all scenes to Auto mode'
                }
                className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none md:h-8"
                style={
                  globalAutoMode
                    ? { color: dockAccent, backgroundColor: 'rgba(148,163,184,0.14)' }
                    : undefined
                }
              >
                {globalAutoMode ? (
                  <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{globalAutoMode ? 'All: Auto' : 'All: Manual'}</span>
                <InfoBadge id="dock-auto-mode" />
              </button>

              <button
                data-tour-id="dock-sound"
                type="button"
                onClick={toggleSound}
                aria-pressed={soundEnabled}
                aria-label={soundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'}
                className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none md:h-8"
                style={
                  soundEnabled
                    ? { color: dockAccent, backgroundColor: 'rgba(148,163,184,0.14)' }
                    : undefined
                }
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">
                  {soundEnabled ? 'Sound' : 'Muted'}
                </span>
                <InfoBadge id="dock-sound" />
              </button>
            </div>
          </nav>
        )}

        {/* Freedom Sandbox & Shaders Slide-Over Drawer */}
        <SandboxDrawer />

        {/* Studio 6.0 Slide-Over Drawer */}
        <StudioDrawer
          tourStatus={tourStatus}
          tourRemainingSec={tourRemainingSec}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onTourNext={() => handleTourStep(1)}
          onTourTogglePause={handleTourTogglePause}
          onCaptureScreenshot={handleCaptureScreenshot}
          onSwitchScene={onSelectScene}
          onHudHoverChange={handleHudHover}
        />

        {/* Cmd/Ctrl+K Command Palette */}
        <CommandPalette
          onSelectScene={onSelectScene}
          onToggleGlobalAuto={handleToggleGlobalMode}
          onToggleFullscreen={handleToggleFullscreen}
          onCaptureScreenshot={handleCaptureScreenshot}
        />

        {/* Keyboard & Game Controls Modal */}
        <ShortcutsModal />

        {/* Futuristic Guided Tutorial Spotlight, Hub, Update 6.0 Release Center & Info Popover Portal */}
        <TutorialSpotlightOverlay />
        <TutorialHubModal />
        <ReleaseModal />
        <InfoPopoverPortal />
      </div>
    </div>
  );
}

export default function App() {
  const [activeScene, setActiveScene] = useState<SceneId>('temple');

  return (
    <AudioManagerProvider initialScene="temple">
      <ReleaseProvider>
        <StudioProvider activeScene={activeScene}>
          <GuideProvider
            activeScene={activeScene}
            onSelectScene={setActiveScene}
          >
            <SceneWorkspace
              activeScene={activeScene}
              onSelectScene={setActiveScene}
            />
          </GuideProvider>
        </StudioProvider>
      </ReleaseProvider>
    </AudioManagerProvider>
  );
}
