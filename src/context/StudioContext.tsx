import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  COLOR_PRESETS,
  getPresetById,
  type ColorPreset,
  type PresetMood,
} from '../data/colorPresets';
import { safeReadJson, safeWriteJson } from '../utils/safeStorage';
import {
  buildBottleneckAdvisories,
  detectHardwareProfile,
  snapDisplayHz,
  type FramePacingMode,
  type HardwareProfile,
} from '../utils/hardwareProfile';
import type {
  AcousticProfile,
  SceneId,
  SfxStyle,
  SoundMoodPreset,
} from './AudioManagerContext';

import type { ShaderMood, WeatherFx } from '../utils/threeShaders';

export type HudSkin = 'neo-arcade' | 'obsidian' | 'scoreboard' | 'swiss';
export type StageSurround = 'ambient' | 'gradient' | 'obsidian' | 'grid';
export type PresetScope = 'global' | 'per-scene';
export type PresetTarget = 'hud+scene' | 'hud-only';
export type QualityTier = 'potato' | 'auto' | 'high' | 'balanced' | 'eco';
export type RenderMode = '3d' | '2d';
export type SandboxPresetId = 'default' | 'moon' | 'turbo' | 'photo' | 'chill';
export type { ShaderMood, WeatherFx };
export type HudDensity = 'standard' | 'compact';
export type TourOrderMode = 'sequential' | 'shuffle';
export type TourStatus = 'off' | 'waiting' | 'touring' | 'paused';
export type StageAspectMode = '16:9' | '21:9' | 'fill';
export type NetParticleMode = 'both' | 'confetti' | 'smoke';
export type SlingshotGroundFxMode = 'full' | 'dust' | 'craters';
export type SlingshotTrajLen = 'short' | 'classic' | 'extended';
export type SlingshotEnvPreset = 'standard' | 'low-g' | 'breeze';
export type AngryBirdsFlightMode = 'pass-through' | 'collide';
export type AngryBirdsFireMode = 'drag' | 'rapid';
export type AngryBirdsCleanupMode = 'fade-30' | 'keep-60' | 'fade-4s' | 'manual';
export type SnapshotSlotId = 'A' | 'B' | 'C';
export type DrawerTabId = 'themes' | 'tour' | 'pc' | 'audio' | 'records';
export type { FramePacingMode, HardwareProfile };

export interface SceneMetric {
  label: string;
  value: string;
  accent?: boolean;
}

export interface SceneTelemetry {
  scene: SceneId;
  title: string;
  status: string;
  metrics: SceneMetric[];
}

export interface SessionRecords {
  bestBasketballStreak: number;
  totalBasketballMakes: number;
  totalBasketballSwishes: number;
  bestSlingshotScore: number;
  totalBirdsUsed: number;
  bestTempleDistance: number;
  bestCyclistSpeed: number;
  totalScreenshots: number;
  sessionSeconds: number;
}

export interface StudioPreferences {
  skin: HudSkin;
  surround: StageSurround;
  presetScope: PresetScope;
  presetTarget: PresetTarget;
  globalPresetId: string;
  scenePresetIds: Record<SceneId, string>;
  favoritePresetIds: string[];
  recentPresetIds: string[];
  presetMoodFilter: PresetMood;
  hudOpacity: number;
  hudDensity: HudDensity;
  showTelemetryBar: boolean;
  showFps: boolean;
  showAimGuides: boolean;
  showTrails: boolean;
  reducedShake: boolean;
  qualityTier: QualityTier;
  stageAspectLock: StageAspectMode;
  cursorAutoHideSec: 0 | 2 | 4;
  fullscreenAutoZen: boolean;
  screenshotIncludeHud: boolean;
  // Audio mixer preferences (synced into AudioManager)
  muteOnTabBlur: boolean;
  masterMuted: boolean;
  ambienceMuted: boolean;
  padsMuted: boolean;
  rainMuted: boolean;
  sfxMuted: boolean;
  crowdMuted: boolean;
  masterVolume: number;
  ambienceVolume: number;
  padsVolume: number;
  rainVolume: number;
  sfxVolume: number;
  reverbMix: number;
  acousticProfile: AcousticProfile;
  sfxStyle: SfxStyle;
  soundMood: SoundMoodPreset;
  // Auto Tour
  tourEnabled: boolean;
  tourAutoEnableIdle45: boolean;
  tourIdleDelaySec: number;
  tourDwellSec: number;
  tourOrderMode: TourOrderMode;
  tourIncludedScenes: SceneId[];
  tourSyncPresets: boolean;
  tourRestoreMode: boolean;
  tourPauseOnMouseMove: boolean;
  tourPauseOnHover: boolean;
  // Scene-specific 4.1 QoL controls
  netParticleMode: NetParticleMode;
  basketballAimSensitivity: number;
  slingshotGroundFx: SlingshotGroundFxMode;
  slingshotTrajLen: SlingshotTrajLen;
  slingshotEnvPreset: SlingshotEnvPreset;
  cyclistUnit: 'mph' | 'kmh';
  spaceUnit: 'metric' | 'imperial';
  // Studio 4.2 Hardware Tuning & Angry Birds Rapid-Fire
  framePacingMode: FramePacingMode;
  angryBirdsFlightMode: AngryBirdsFlightMode;
  angryBirdsFireMode: AngryBirdsFireMode;
  angryBirdsCleanup: AngryBirdsCleanupMode;
  // Update 6.0 Shaders & Player Freedom Sandbox
  shaderMood: ShaderMood;
  sandboxGravityScale: number;
  sandboxTimeScale: number;
  sandboxFreeOrbit: boolean;
  sandboxWeather: WeatherFx;
  sandboxTempleInvincible: boolean;
  sandboxBirdsPower: number;
  sandboxGiantBirds: boolean;
  sandboxHoopsFireball: boolean;
  sandboxHoopsSpeed: number;
  sandboxCoastlineBoost: number;
  sandboxSolarElevation: number | null;
  sandboxWaveChop: number;
  // Render Engine & Preset Auto-Cycle
  renderMode: RenderMode;
  presetAutoCycle: boolean;
  presetAutoCycleSec: number;
}

export interface StudioSnapshot {
  slot: SnapshotSlotId;
  name: string;
  savedAt: string;
  activeScene: SceneId;
  prefs: StudioPreferences;
}

export interface StudioToast {
  id: number;
  title: string;
  detail?: string;
}

export type SceneCommandPayload =
  | { scene: 'slingshot'; type: 'load-level'; levelIndex: number }
  | { scene: 'slingshot'; type: 'reset-level' }
  | { scene: 'slingshot'; type: 'set-controls-open'; open: boolean }
  | { scene: 'basketball'; type: 'reset-session' }
  | { scene: 'basketball'; type: 'set-controls-open'; open: boolean }
  | { scene: 'ocean'; type: 'enter-space'; planetName?: string }
  | { scene: 'ocean'; type: 'return-ocean' }
  | { scene: 'ocean'; type: 'focus-planet'; planetName: string }
  | { scene: 'ocean'; type: 'jump-today' }
  | { scene: 'ocean'; type: 'set-controls-open'; open: boolean }
  | { scene: 'cyclist'; type: 'jump-biome'; biomeIndex: number }
  | { scene: 'cyclist'; type: 'set-controls-open'; open: boolean }
  | { scene: 'temple'; type: 'restart' }
  | { scene: 'temple'; type: 'set-controls-open'; open: boolean };

export function dispatchSceneCommand(cmd: SceneCommandPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SceneCommandPayload>('kas:scene-command', { detail: cmd }));
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export const SCENE_META: Record<
  SceneId,
  { label: string; shortLabel: string; subtitle: string; defaultPresetId: string }
> = {
  temple: {
    label: 'Temple Run',
    shortLabel: 'Temple Run',
    subtitle: 'Endless 3D Jungle Runner',
    defaultPresetId: 'temple-emerald',
  },
  ocean: {
    label: 'Solar Horizon',
    shortLabel: 'Solar Horizon',
    subtitle: 'Ocean Dusk & J2000 Solar System',
    defaultPresetId: 'broken-arrow-dusk',
  },
  cyclist: {
    label: 'Coastline Tour',
    shortLabel: 'Coastline',
    subtitle: 'Scenic Cross-Country Cycling',
    defaultPresetId: 'golden-pier',
  },
  slingshot: {
    label: 'Angry Birds',
    shortLabel: 'Angry Birds',
    subtitle: 'Rapid-Fire Physics Destruction',
    defaultPresetId: 'pine-ridge',
  },
  basketball: {
    label: 'All-Star Hoops',
    shortLabel: 'Hoops',
    subtitle: 'Arena Trick-Shot & Moving Hoop',
    defaultPresetId: 'arena-gold',
  },
};

export const ALL_SCENES: SceneId[] = [
  'temple',
  'ocean',
  'cyclist',
  'slingshot',
  'basketball',
];

const PREFS_KEY = 'kas_studio_prefs_v4';
const RECORDS_KEY = 'kas_studio_records_v4';
const SLOTS_KEY = 'kas_studio_slots_v41';

const DEFAULT_PREFS: StudioPreferences = {
  skin: 'neo-arcade',
  surround: 'ambient',
  presetScope: 'global',
  presetTarget: 'hud+scene',
  globalPresetId: 'arena-gold',
  scenePresetIds: {
    temple: 'temple-emerald',
    ocean: 'broken-arrow-dusk',
    cyclist: 'golden-pier',
    slingshot: 'pine-ridge',
    basketball: 'arena-gold',
  },
  favoritePresetIds: ['arena-gold', 'broken-arrow-dusk', 'temple-emerald', 'stellar-cyan'],
  recentPresetIds: ['arena-gold'],
  presetMoodFilter: 'all',
  hudOpacity: 0.9,
  hudDensity: 'standard',
  showTelemetryBar: true,
  showFps: true,
  showAimGuides: true,
  showTrails: true,
  reducedShake: false,
  qualityTier: 'auto',
  stageAspectLock: '16:9',
  cursorAutoHideSec: 0,
  fullscreenAutoZen: false,
  screenshotIncludeHud: true,
  muteOnTabBlur: true,
  masterMuted: false,
  ambienceMuted: false,
  padsMuted: false,
  rainMuted: false,
  sfxMuted: false,
  crowdMuted: false,
  masterVolume: 0.78,
  ambienceVolume: 0.8,
  padsVolume: 0.62,
  rainVolume: 0.28,
  sfxVolume: 0.85,
  reverbMix: 0.55,
  acousticProfile: 'calm',
  sfxStyle: 'peaceful',
  soundMood: 'deep-calm',
  tourEnabled: false,
  tourAutoEnableIdle45: true,
  tourIdleDelaySec: 10,
  tourDwellSec: 15,
  tourOrderMode: 'sequential',
  tourIncludedScenes: [...ALL_SCENES],
  tourSyncPresets: true,
  tourRestoreMode: true,
  tourPauseOnMouseMove: false,
  tourPauseOnHover: true,
  netParticleMode: 'both',
  basketballAimSensitivity: 1.0,
  slingshotGroundFx: 'full',
  slingshotTrajLen: 'classic',
  slingshotEnvPreset: 'standard',
  cyclistUnit: 'mph',
  spaceUnit: 'metric',
  framePacingMode: 'auto-pc',
  angryBirdsFlightMode: 'pass-through',
  angryBirdsFireMode: 'drag',
  angryBirdsCleanup: 'fade-30',
  shaderMood: 'standard',
  sandboxGravityScale: 1.0,
  sandboxTimeScale: 1.0,
  sandboxFreeOrbit: false,
  sandboxWeather: 'clear',
  sandboxTempleInvincible: false,
  sandboxBirdsPower: 1.0,
  sandboxGiantBirds: false,
  sandboxHoopsFireball: false,
  sandboxHoopsSpeed: 1.0,
  sandboxCoastlineBoost: 1.0,
  sandboxSolarElevation: null,
  sandboxWaveChop: 1.0,
  renderMode: '3d',
  presetAutoCycle: false,
  presetAutoCycleSec: 10,
};

export type ActiveSoundMoodId = Exclude<SoundMoodPreset, 'custom'>;

export const SOUND_MOOD_PRESETS: Record<
  ActiveSoundMoodId,
  {
    label: string;
    subtitle: string;
    patch: Partial<StudioPreferences>;
  }
> = {
  'deep-calm': {
    label: 'Deep Calm',
    subtitle: 'Warm pads, lush reverb & gentle nature',
    patch: {
      soundMood: 'deep-calm',
      acousticProfile: 'calm',
      sfxStyle: 'peaceful',
      ambienceVolume: 0.78,
      padsVolume: 0.74,
      rainVolume: 0.25,
      sfxVolume: 0.72,
      reverbMix: 0.68,
      ambienceMuted: false,
      padsMuted: false,
      rainMuted: false,
    },
  },
  'nature-walk': {
    label: 'Nature Walk',
    subtitle: 'Pure water, birds, breeze & light chimes',
    patch: {
      soundMood: 'nature-walk',
      acousticProfile: 'calm',
      sfxStyle: 'peaceful',
      ambienceVolume: 0.92,
      padsVolume: 0.28,
      rainVolume: 0.0,
      sfxVolume: 0.78,
      reverbMix: 0.45,
      ambienceMuted: false,
      padsMuted: false,
      rainMuted: true,
    },
  },
  'rainy-evening': {
    label: 'Rainy Evening',
    subtitle: 'Cozy rainfall, warm lowpass & soft chords',
    patch: {
      soundMood: 'rainy-evening',
      acousticProfile: 'warm',
      sfxStyle: 'peaceful',
      ambienceVolume: 0.58,
      padsVolume: 0.68,
      rainVolume: 0.86,
      sfxVolume: 0.68,
      reverbMix: 0.72,
      ambienceMuted: false,
      padsMuted: false,
      rainMuted: false,
    },
  },
  classic: {
    label: 'Classic',
    subtitle: 'Original crisp arcade punch & dry world bed',
    patch: {
      soundMood: 'classic',
      acousticProfile: 'arcade',
      sfxStyle: 'classic',
      ambienceVolume: 0.75,
      padsVolume: 0.0,
      rainVolume: 0.0,
      sfxVolume: 0.9,
      reverbMix: 0.15,
      ambienceMuted: false,
      padsMuted: true,
      rainMuted: true,
    },
  },
};

const DEFAULT_RECORDS: SessionRecords = {
  bestBasketballStreak: 0,
  totalBasketballMakes: 0,
  totalBasketballSwishes: 0,
  bestSlingshotScore: 0,
  totalBirdsUsed: 0,
  bestTempleDistance: 0,
  bestCyclistSpeed: 0,
  totalScreenshots: 0,
  sessionSeconds: 0,
};

function sanitizePrefs(raw: Partial<StudioPreferences> | undefined): StudioPreferences {
  const saved = raw ?? {};
  const isFirstVisit = !raw || Object.keys(raw).length === 0;
  const isUltrawideScreen =
    typeof window !== 'undefined' &&
    window.screen &&
    window.screen.width / Math.max(1, window.screen.height) >= 2.05;
  const aspect: StageAspectMode =
    saved.stageAspectLock === '21:9' || saved.stageAspectLock === 'fill'
      ? saved.stageAspectLock
      : saved.stageAspectLock === '16:9'
        ? '16:9'
        : isFirstVisit && isUltrawideScreen
          ? '21:9'
          : '16:9';
  const framePacingMode: FramePacingMode =
    saved.framePacingMode === 'hybrid-179-60' ||
    saved.framePacingMode === 'max-179' ||
    saved.framePacingMode === 'std-60'
      ? saved.framePacingMode
      : 'auto-pc';
  const angryBirdsFlightMode: AngryBirdsFlightMode =
    saved.angryBirdsFlightMode === 'collide' ? 'collide' : 'pass-through';
  const angryBirdsFireMode: AngryBirdsFireMode =
    saved.angryBirdsFireMode === 'rapid' ? 'rapid' : 'drag';
  const angryBirdsCleanup: AngryBirdsCleanupMode =
    saved.angryBirdsCleanup === 'keep-60' ||
    saved.angryBirdsCleanup === 'fade-4s' ||
    saved.angryBirdsCleanup === 'manual'
      ? saved.angryBirdsCleanup
      : 'fade-30';
  const clamp01 = (val: unknown, fallback: number): number =>
    typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : fallback;
  const acousticProfile: AcousticProfile =
    saved.acousticProfile === 'calm' ||
    saved.acousticProfile === 'warm' ||
    saved.acousticProfile === 'arcade' ||
    saved.acousticProfile === 'broadcast'
      ? saved.acousticProfile
      : 'calm';
  const sfxStyle: SfxStyle = saved.sfxStyle === 'classic' ? 'classic' : 'peaceful';
  const soundMood: SoundMoodPreset =
    saved.soundMood === 'deep-calm' ||
    saved.soundMood === 'nature-walk' ||
    saved.soundMood === 'rainy-evening' ||
    saved.soundMood === 'classic' ||
    saved.soundMood === 'custom'
      ? saved.soundMood
      : 'deep-calm';

  const tourScenes =
    Array.isArray(saved.tourIncludedScenes) && saved.tourIncludedScenes.length > 0
      ? saved.tourIncludedScenes.filter((s): s is SceneId => ALL_SCENES.includes(s))
      : [...ALL_SCENES];
  return {
    ...DEFAULT_PREFS,
    ...saved,
    stageAspectLock: aspect,
    framePacingMode,
    angryBirdsFlightMode,
    angryBirdsFireMode,
    angryBirdsCleanup,
    acousticProfile,
    sfxStyle,
    soundMood,
    masterVolume: clamp01(saved.masterVolume, DEFAULT_PREFS.masterVolume),
    ambienceVolume: clamp01(saved.ambienceVolume, DEFAULT_PREFS.ambienceVolume),
    padsVolume: clamp01(saved.padsVolume, DEFAULT_PREFS.padsVolume),
    rainVolume: clamp01(saved.rainVolume, DEFAULT_PREFS.rainVolume),
    sfxVolume: clamp01(saved.sfxVolume, DEFAULT_PREFS.sfxVolume),
    reverbMix: clamp01(saved.reverbMix, DEFAULT_PREFS.reverbMix),
    scenePresetIds: {
      ...DEFAULT_PREFS.scenePresetIds,
      ...(saved.scenePresetIds ?? {}),
    },
    tourIncludedScenes: tourScenes.length > 0 ? tourScenes : [...ALL_SCENES],
    favoritePresetIds: Array.isArray(saved.favoritePresetIds)
      ? saved.favoritePresetIds
      : [...DEFAULT_PREFS.favoritePresetIds],
    recentPresetIds: Array.isArray(saved.recentPresetIds)
      ? saved.recentPresetIds.slice(0, 5)
      : [...DEFAULT_PREFS.recentPresetIds],
    shaderMood:
      saved.shaderMood === 'golden-rim' ||
      saved.shaderMood === 'neon-rim' ||
      saved.shaderMood === 'warm-film' ||
      saved.shaderMood === 'blueprint'
        ? saved.shaderMood
        : 'standard',
    sandboxWeather:
      saved.sandboxWeather === 'mist' ||
      saved.sandboxWeather === 'rain' ||
      saved.sandboxWeather === 'embers'
        ? saved.sandboxWeather
        : 'clear',
    sandboxGravityScale:
      typeof saved.sandboxGravityScale === 'number' && Number.isFinite(saved.sandboxGravityScale)
        ? Math.max(0.25, Math.min(2.0, saved.sandboxGravityScale))
        : 1.0,
    sandboxTimeScale:
      typeof saved.sandboxTimeScale === 'number' && Number.isFinite(saved.sandboxTimeScale)
        ? Math.max(0.25, Math.min(2.0, saved.sandboxTimeScale))
        : 1.0,
    sandboxBirdsPower:
      typeof saved.sandboxBirdsPower === 'number' && Number.isFinite(saved.sandboxBirdsPower)
        ? Math.max(0.75, Math.min(2.0, saved.sandboxBirdsPower))
        : 1.0,
    sandboxHoopsSpeed:
      typeof saved.sandboxHoopsSpeed === 'number' && Number.isFinite(saved.sandboxHoopsSpeed)
        ? Math.max(0.25, Math.min(2.0, saved.sandboxHoopsSpeed))
        : 1.0,
    sandboxCoastlineBoost:
      typeof saved.sandboxCoastlineBoost === 'number' && Number.isFinite(saved.sandboxCoastlineBoost)
        ? Math.max(0.5, Math.min(2.0, saved.sandboxCoastlineBoost))
        : 1.0,
    sandboxWaveChop:
      typeof saved.sandboxWaveChop === 'number' && Number.isFinite(saved.sandboxWaveChop)
        ? Math.max(0.25, Math.min(2.0, saved.sandboxWaveChop))
        : 1.0,
    sandboxSolarElevation:
      typeof saved.sandboxSolarElevation === 'number' && Number.isFinite(saved.sandboxSolarElevation)
        ? Math.max(-0.08, Math.min(0.45, saved.sandboxSolarElevation))
        : null,
    renderMode: saved.renderMode === '2d' ? '2d' : '3d',
    presetAutoCycle: Boolean(saved.presetAutoCycle),
    presetAutoCycleSec:
      typeof saved.presetAutoCycleSec === 'number' && Number.isFinite(saved.presetAutoCycleSec)
        ? Math.max(4, Math.min(60, Math.round(saved.presetAutoCycleSec)))
        : 10,
  };
}

export interface StudioContextValue {
  prefs: StudioPreferences;
  activePreset: ColorPreset;
  records: SessionRecords;
  telemetry: SceneTelemetry;
  fps: number;
  frameMs: number;
  zenMode: boolean;
  setZenMode: (fn: boolean | ((p: boolean) => boolean)) => void;
  altPeekZen: boolean;
  setAltPeekZen: (val: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (fn: boolean | ((p: boolean) => boolean)) => void;
  drawerTab: DrawerTabId;
  setDrawerTab: (tab: DrawerTabId) => void;
  sandboxOpen: boolean;
  setSandboxOpen: (fn: boolean | ((p: boolean) => boolean)) => void;
  applySandboxPreset: (preset: SandboxPresetId) => void;
  paletteOpen: boolean;
  setPaletteOpen: (fn: boolean | ((p: boolean) => boolean)) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (fn: boolean | ((p: boolean) => boolean)) => void;
  hardwareProfile: HardwareProfile;
  applyPcMatchPreset: (mode?: FramePacingMode) => void;
  applySoundMood: (mood: ActiveSoundMoodId) => void;
  updatePrefs: (patch: Partial<StudioPreferences>) => void;
  selectPreset: (presetId: string, scene?: SceneId) => void;
  stepPreset: (dir: 1 | -1, scene?: SceneId) => void;
  toggleFavoritePreset: (presetId: string) => void;
  randomizePreset: (scene?: SceneId) => void;
  reportTelemetry: (next: SceneTelemetry) => void;
  bumpRecords: (patch: Partial<SessionRecords>, maxPatch?: Partial<SessionRecords>) => void;
  resetRecords: () => void;
  undoResetAvailable: boolean;
  restoreLastReset: () => void;
  snapshotSlots: Record<SnapshotSlotId, StudioSnapshot | null>;
  saveSnapshotSlot: (slot: SnapshotSlotId, activeSceneOverride?: SceneId) => void;
  loadSnapshotSlot: (slot: SnapshotSlotId) => SceneId | null;
  deleteSnapshotSlot: (slot: SnapshotSlotId) => void;
  exportSettingsJson: () => string;
  importSettingsJson: (raw: string) => boolean;
  toasts: StudioToast[];
  notify: (title: string, detail?: string) => void;
  activeScene: SceneId;
  setTourPresetOverrideId: (presetId: string | null) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({
  children,
  activeScene,
}: {
  children: ReactNode;
  activeScene: SceneId;
}) {
  const [prefs, setPrefs] = useState<StudioPreferences>(() =>
    sanitizePrefs(safeReadJson<Partial<StudioPreferences>>(PREFS_KEY, {}))
  );

  const [records, setRecords] = useState<SessionRecords>(() => ({
    ...DEFAULT_RECORDS,
    ...safeReadJson<Partial<SessionRecords>>(RECORDS_KEY, {}),
  }));

  const [snapshotSlots, setSnapshotSlots] = useState<Record<SnapshotSlotId, StudioSnapshot | null>>(
    () => {
      const saved = safeReadJson<Partial<Record<SnapshotSlotId, StudioSnapshot | null>>>(
        SLOTS_KEY,
        {}
      );
      return {
        A: saved.A ?? null,
        B: saved.B ?? null,
        C: saved.C ?? null,
      };
    }
  );

  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    scene: activeScene,
    title: SCENE_META[activeScene].label,
    status: 'Ready',
    metrics: [],
  });

  const [zenMode, setZenMode] = useState(false);
  const [altPeekZen, setAltPeekZen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTabId>('themes');
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fps, setFps] = useState(60);
  const [frameMs, setFrameMs] = useState(16.7);
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile>(() =>
    detectHardwareProfile(60)
  );
  const [tourPresetOverrideId, setTourPresetOverrideId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<StudioToast[]>([]);
  const [undoBackup, setUndoBackup] = useState<SessionRecords | null>(null);
  const toastIdRef = useRef(1);

  useEffect(() => {
    const id = window.setTimeout(() => safeWriteJson(PREFS_KEY, prefs), 250);
    return () => window.clearTimeout(id);
  }, [prefs]);

  useEffect(() => {
    const id = window.setTimeout(() => safeWriteJson(RECORDS_KEY, records), 800);
    return () => window.clearTimeout(id);
  }, [records]);

  useEffect(() => {
    safeWriteJson(SLOTS_KEY, snapshotSlots);
  }, [snapshotSlots]);

  // Real rAF FPS, frame-time, and display Hz estimator
  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let lastSample = performance.now();
    let hzDone = false;
    let hzFrames = 0;
    let hzStart = performance.now();

    const sample = (now: number) => {
      frames += 1;
      if (!hzDone) {
        hzFrames += 1;
        const hzElapsed = now - hzStart;
        if (hzElapsed >= 450 && hzFrames >= 12) {
          hzDone = true;
          const rawHz = (hzFrames * 1000) / hzElapsed;
          const snapped = snapDisplayHz(rawHz);
          setHardwareProfile((prev) => ({
            ...prev,
            measuredHz: snapped,
            bottlenecks: buildBottleneckAdvisories({
              cpuThreads: prev.cpuThreads,
              deviceMemoryGb: prev.deviceMemoryGb,
              gpuClass: prev.gpuClass,
              gpuShortName: prev.gpuShortName,
              screenWidth: prev.screenWidth,
              screenHeight: prev.screenHeight,
              isUltrawide: prev.isUltrawide,
              measuredHz: snapped,
            }),
          }));
        }
      }

      const elapsed = now - lastSample;
      if (elapsed >= 600) {
        const measuredFps = Math.min(240, Math.round((frames * 1000) / elapsed));
        const avgMs = elapsed / frames;
        setFps(measuredFps);
        setFrameMs(Number(avgMs.toFixed(1)));
        frames = 0;
        lastSample = now;
      }
      rafId = requestAnimationFrame(sample);
    };
    rafId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Session runtime clock
  useEffect(() => {
    const id = window.setInterval(() => {
      setRecords((prev) => ({ ...prev, sessionSeconds: prev.sessionSeconds + 5 }));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const notify = useCallback((title: string, detail?: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-2), { id, title, detail }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const updatePrefs = useCallback((patch: Partial<StudioPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyPcMatchPreset = useCallback(
    (mode?: FramePacingMode) => {
      const targetMode = mode ?? 'auto-pc';
      const targetAspect: StageAspectMode =
        targetMode === 'std-60'
          ? '16:9'
          : hardwareProfile.isUltrawide
            ? '21:9'
            : prefs.stageAspectLock;
      setPrefs((prev) => ({
        ...prev,
        framePacingMode: targetMode,
        qualityTier: targetMode === 'std-60' ? 'balanced' : 'auto',
        stageAspectLock: targetAspect,
      }));
      const label =
        targetMode === 'hybrid-179-60'
          ? '2D Unlocked · 3D 60fps'
          : targetMode === 'max-179'
            ? 'Max Hz · 1.0x Scale'
            : targetMode === 'std-60'
              ? '16:9 Standard'
              : `${hardwareProfile.gpuShortName} · ${targetAspect}`;
      notify('PC Profile Matched', label);
    },
    [hardwareProfile.gpuShortName, hardwareProfile.isUltrawide, notify, prefs.stageAspectLock]
  );

  const applySoundMood = useCallback(
    (mood: ActiveSoundMoodId) => {
      const preset = SOUND_MOOD_PRESETS[mood];
      if (!preset) return;
      setPrefs((prev) => ({
        ...prev,
        ...preset.patch,
      }));
      notify('Soundscape Mood', `${preset.label} · ${preset.subtitle}`);
    },
    [notify]
  );

  const applySandboxPreset = useCallback(
    (preset: SandboxPresetId) => {
      if (preset === 'default') {
        updatePrefs({
          shaderMood: 'standard',
          sandboxGravityScale: 1.0,
          sandboxTimeScale: 1.0,
          sandboxFreeOrbit: false,
          sandboxWeather: 'clear',
          sandboxTempleInvincible: false,
          sandboxBirdsPower: 1.0,
          sandboxGiantBirds: false,
          sandboxHoopsFireball: false,
          sandboxHoopsSpeed: 1.0,
          sandboxCoastlineBoost: 1.0,
          sandboxSolarElevation: null,
          sandboxWaveChop: 1.0,
        });
        notify('Sandbox Reset', 'Standard physics & camera restored');
      } else if (preset === 'moon') {
        updatePrefs({
          sandboxGravityScale: 0.38,
          sandboxTimeScale: 0.85,
          sandboxFreeOrbit: true,
          shaderMood: 'neon-rim',
          sandboxWeather: 'mist',
          sandboxBirdsPower: 1.15,
        });
        notify('Moon Arcade', 'Low 0.38x gravity + Free 3D Orbit unlocked');
      } else if (preset === 'turbo') {
        updatePrefs({
          sandboxGravityScale: 1.25,
          sandboxTimeScale: 1.6,
          sandboxBirdsPower: 1.65,
          sandboxHoopsFireball: true,
          sandboxHoopsSpeed: 1.5,
          sandboxCoastlineBoost: 1.65,
          shaderMood: 'golden-rim',
        });
        notify('Hyper Turbo', '1.6x speed, fireball hoops & super launches');
      } else if (preset === 'photo') {
        updatePrefs({
          sandboxTimeScale: 0.4,
          sandboxFreeOrbit: true,
          shaderMood: 'warm-film',
          sandboxWeather: 'embers',
        });
        notify('Cinematic Photo', 'Slow-mo 0.4x, Free Orbit & Warm Film shader');
      } else {
        // chill
        updatePrefs({
          sandboxGravityScale: 0.82,
          sandboxTimeScale: 0.85,
          sandboxTempleInvincible: true,
          sandboxFreeOrbit: false,
          sandboxWeather: 'mist',
          shaderMood: 'golden-rim',
          sandboxBirdsPower: 1.35,
          sandboxGiantBirds: true,
        });
        notify('Kid-Friendly Chill', 'Invincible Temple Explore + Giant Birds');
      }
    },
    [notify, updatePrefs]
  );

  const selectPreset = useCallback(
    (presetId: string, sceneOverride?: SceneId) => {
      const targetScene = sceneOverride ?? activeScene;
      const preset = getPresetById(presetId);
      setPrefs((prev) => ({
        ...prev,
        globalPresetId: prev.presetScope === 'global' ? preset.id : prev.globalPresetId,
        scenePresetIds:
          prev.presetScope === 'per-scene'
            ? { ...prev.scenePresetIds, [targetScene]: preset.id }
            : prev.scenePresetIds,
        recentPresetIds: [
          preset.id,
          ...prev.recentPresetIds.filter((id) => id !== preset.id),
        ].slice(0, 5),
      }));
      notify('Theme Applied', preset.name);
    },
    [activeScene, notify]
  );

  const toggleFavoritePreset = useCallback((presetId: string) => {
    setPrefs((prev) => {
      const exists = prev.favoritePresetIds.includes(presetId);
      return {
        ...prev,
        favoritePresetIds: exists
          ? prev.favoritePresetIds.filter((id) => id !== presetId)
          : [...prev.favoritePresetIds, presetId],
      };
    });
  }, []);

  const randomizePreset = useCallback(
    (sceneOverride?: SceneId) => {
      const pick = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
      selectPreset(pick.id, sceneOverride);
    },
    [selectPreset]
  );

  const activePreset = useMemo(() => {
    const id =
      tourPresetOverrideId ??
      (prefs.presetScope === 'per-scene'
        ? prefs.scenePresetIds[activeScene] ?? prefs.globalPresetId
        : prefs.globalPresetId);
    return getPresetById(id);
  }, [
    activeScene,
    prefs.globalPresetId,
    prefs.presetScope,
    prefs.scenePresetIds,
    tourPresetOverrideId,
  ]);

  const stepPreset = useCallback(
    (dir: 1 | -1, sceneOverride?: SceneId) => {
      const idx = COLOR_PRESETS.findIndex((p) => p.id === activePreset.id);
      const nextIdx =
        idx < 0
          ? 0
          : (idx + dir + COLOR_PRESETS.length) % COLOR_PRESETS.length;
      selectPreset(COLOR_PRESETS[nextIdx].id, sceneOverride);
    },
    [activePreset.id, selectPreset]
  );

  const reportTelemetry = useCallback((next: SceneTelemetry) => {
    setTelemetry(next);
  }, []);

  const bumpRecords = useCallback(
    (addPatch: Partial<SessionRecords>, maxPatch?: Partial<SessionRecords>) => {
      setRecords((prev) => {
        let changed = false;
        const next = { ...prev };
        if (addPatch.totalBasketballMakes) {
          next.totalBasketballMakes += addPatch.totalBasketballMakes;
          changed = true;
        }
        if (addPatch.totalBasketballSwishes) {
          next.totalBasketballSwishes += addPatch.totalBasketballSwishes;
          changed = true;
        }
        if (addPatch.totalBirdsUsed) {
          next.totalBirdsUsed += addPatch.totalBirdsUsed;
          changed = true;
        }
        if (addPatch.totalScreenshots) {
          next.totalScreenshots += addPatch.totalScreenshots;
          changed = true;
        }
        if (
          maxPatch?.bestBasketballStreak !== undefined &&
          maxPatch.bestBasketballStreak > prev.bestBasketballStreak
        ) {
          next.bestBasketballStreak = maxPatch.bestBasketballStreak;
          changed = true;
        }
        if (
          maxPatch?.bestSlingshotScore !== undefined &&
          maxPatch.bestSlingshotScore > prev.bestSlingshotScore
        ) {
          next.bestSlingshotScore = maxPatch.bestSlingshotScore;
          changed = true;
        }
        if (
          maxPatch?.bestTempleDistance !== undefined &&
          maxPatch.bestTempleDistance > prev.bestTempleDistance
        ) {
          next.bestTempleDistance = maxPatch.bestTempleDistance;
          changed = true;
        }
        if (
          maxPatch?.bestCyclistSpeed !== undefined &&
          maxPatch.bestCyclistSpeed > prev.bestCyclistSpeed
        ) {
          next.bestCyclistSpeed = maxPatch.bestCyclistSpeed;
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    []
  );

  const resetRecords = useCallback(() => {
    setUndoBackup({ ...records });
    setRecords({ ...DEFAULT_RECORDS });
    notify('Records Cleared', 'Undo available in Records tab');
  }, [notify, records]);

  const restoreLastReset = useCallback(() => {
    if (!undoBackup) return;
    setRecords(undoBackup);
    setUndoBackup(null);
    notify('Records Restored', 'Previous personal bests recovered');
  }, [notify, undoBackup]);

  const saveSnapshotSlot = useCallback(
    (slot: SnapshotSlotId, activeSceneOverride?: SceneId) => {
      const targetScene = activeSceneOverride ?? activeScene;
      const snap: StudioSnapshot = {
        slot,
        name: `${SCENE_META[targetScene].shortLabel} · ${activePreset.name}`,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        activeScene: targetScene,
        prefs: sanitizePrefs(prefs),
      };
      setSnapshotSlots((prev) => ({ ...prev, [slot]: snap }));
      notify(`Snapshot ${slot} Saved`, snap.name);
    },
    [activePreset.name, activeScene, notify, prefs]
  );

  const loadSnapshotSlot = useCallback(
    (slot: SnapshotSlotId): SceneId | null => {
      const snap = snapshotSlots[slot];
      if (!snap) return null;
      setPrefs(sanitizePrefs(snap.prefs));
      notify(`Snapshot ${slot} Loaded`, snap.name);
      return snap.activeScene;
    },
    [notify, snapshotSlots]
  );

  const deleteSnapshotSlot = useCallback(
    (slot: SnapshotSlotId) => {
      setSnapshotSlots((prev) => ({ ...prev, [slot]: null }));
      notify(`Snapshot ${slot} Cleared`, 'Slot ready for new setup');
    },
    [notify]
  );

  const exportSettingsJson = useCallback(() => {
    return JSON.stringify(
      {
        version: '4.1',
        prefs,
        records,
        snapshotSlots,
      },
      null,
      2
    );
  }, [prefs, records, snapshotSlots]);

  const importSettingsJson = useCallback(
    (raw: string): boolean => {
      try {
        const parsed = JSON.parse(raw) as {
          version?: string;
          prefs?: Partial<StudioPreferences>;
          records?: Partial<SessionRecords>;
          snapshotSlots?: Partial<Record<SnapshotSlotId, StudioSnapshot | null>>;
        };
        if (parsed.prefs && typeof parsed.prefs === 'object') {
          setPrefs((prev) => sanitizePrefs({ ...prev, ...parsed.prefs }));
        }
        if (parsed.records && typeof parsed.records === 'object') {
          setRecords((prev) => ({ ...prev, ...parsed.records }));
        }
        if (parsed.snapshotSlots && typeof parsed.snapshotSlots === 'object') {
          setSnapshotSlots((prev) => ({
            A: parsed.snapshotSlots?.A ?? prev.A,
            B: parsed.snapshotSlots?.B ?? prev.B,
            C: parsed.snapshotSlots?.C ?? prev.C,
          }));
        }
        notify('Settings Imported', 'Preferences and records restored');
        return true;
      } catch {
        notify('Import Failed', 'Invalid JSON settings payload');
        return false;
      }
    },
    [notify]
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      prefs,
      activePreset,
      records,
      telemetry,
      fps,
      frameMs,
      zenMode,
      setZenMode,
      altPeekZen,
      setAltPeekZen,
      drawerOpen,
      setDrawerOpen,
      drawerTab,
      setDrawerTab,
      sandboxOpen,
      setSandboxOpen,
      applySandboxPreset,
      paletteOpen,
      setPaletteOpen,
      shortcutsOpen,
      setShortcutsOpen,
      hardwareProfile,
      applyPcMatchPreset,
      applySoundMood,
      updatePrefs,
      selectPreset,
      stepPreset,
      toggleFavoritePreset,
      randomizePreset,
      reportTelemetry,
      bumpRecords,
      resetRecords,
      undoResetAvailable: undoBackup !== null,
      restoreLastReset,
      snapshotSlots,
      saveSnapshotSlot,
      loadSnapshotSlot,
      deleteSnapshotSlot,
      exportSettingsJson,
      importSettingsJson,
      toasts,
      notify,
      activeScene,
      setTourPresetOverrideId,
    }),
    [
      prefs,
      activePreset,
      records,
      telemetry,
      fps,
      frameMs,
      zenMode,
      altPeekZen,
      drawerOpen,
      drawerTab,
      sandboxOpen,
      applySandboxPreset,
      paletteOpen,
      shortcutsOpen,
      hardwareProfile,
      applyPcMatchPreset,
      applySoundMood,
      updatePrefs,
      selectPreset,
      stepPreset,
      toggleFavoritePreset,
      randomizePreset,
      reportTelemetry,
      bumpRecords,
      resetRecords,
      undoBackup,
      restoreLastReset,
      snapshotSlots,
      saveSnapshotSlot,
      loadSnapshotSlot,
      deleteSnapshotSlot,
      exportSettingsJson,
      importSettingsJson,
      toasts,
      notify,
      activeScene,
    ]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return ctx;
}
