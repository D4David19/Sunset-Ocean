import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Command,
  Compass,
  Cpu,
  Download,
  Flame,
  HelpCircle,
  Maximize2,
  Minimize2,
  Palette,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Shuffle,
  Sliders,
  Star,
  Trash2,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  useAudioManager,
  type AcousticProfile,
  type SceneId,
  type SfxStyle,
} from '../../context/AudioManagerContext';
import { useGuide } from '../../context/GuideContext';
import { useRelease } from '../../context/ReleaseContext';
import {
  ALL_SCENES,
  SCENE_META,
  SOUND_MOOD_PRESETS,
  useStudio,
  type ActiveSoundMoodId,
  type FramePacingMode,
  type HudSkin,
  type QualityTier,
  type SnapshotSlotId,
  type StageAspectMode,
  type StageSurround,
  type TourStatus,
} from '../../context/StudioContext';
import {
  COLOR_PRESETS,
  PRESET_CATEGORIES,
  getPresetById,
  getPresetMood,
  type PresetCategory,
  type PresetMood,
} from '../../data/colorPresets';
import { STUDIO_MOTTO } from '../../data/updateLogs';
import { SHADER_MOOD_META, type ShaderMood } from '../../utils/threeShaders';
import { InfoBadge } from './InfoBadge';

interface StudioDrawerProps {
  tourStatus: TourStatus;
  tourRemainingSec: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onTourNext: () => void;
  onTourTogglePause: () => void;
  onCaptureScreenshot: () => void;
  onSwitchScene?: (scene: SceneId) => void;
  onHudHoverChange?: (hovered: boolean) => void;
}

const SKIN_OPTIONS: Array<{ id: HudSkin; label: string }> = [
  { id: 'neo-arcade', label: 'Neo-Arcade' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'scoreboard', label: 'Scoreboard' },
  { id: 'swiss', label: 'Swiss Day' },
];

const SURROUND_OPTIONS: Array<{ id: StageSurround; label: string }> = [
  { id: 'ambient', label: 'Scene Glow' },
  { id: 'gradient', label: 'Preset Grad' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'grid', label: 'Studio Grid' },
];

const MOOD_OPTIONS: Array<{ id: PresetMood; label: string }> = [
  { id: 'all', label: 'All Moods' },
  { id: 'dark', label: 'Dark' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'daylight', label: 'Daylight' },
  { id: 'minimal', label: 'Minimal' },
];

export default function StudioDrawer({
  tourStatus,
  tourRemainingSec,
  isFullscreen,
  onToggleFullscreen,
  onTourNext,
  onTourTogglePause,
  onCaptureScreenshot,
  onSwitchScene,
  onHudHoverChange,
}: StudioDrawerProps) {
  const {
    prefs,
    activePreset,
    records,
    fps,
    frameMs,
    hardwareProfile,
    applyPcMatchPreset,
    applySoundMood,
    drawerOpen,
    setDrawerOpen,
    drawerTab,
    setDrawerTab,
    setSandboxOpen,
    setPaletteOpen,
    setShortcutsOpen,
    updatePrefs,
    selectPreset,
    stepPreset,
    toggleFavoritePreset,
    randomizePreset,
    resetRecords,
    undoResetAvailable,
    restoreLastReset,
    snapshotSlots,
    saveSnapshotSlot,
    loadSnapshotSlot,
    deleteSnapshotSlot,
    exportSettingsJson,
    importSettingsJson,
    notify,
    activeScene,
  } = useStudio();

  const { soundEnabled, setSoundEnabledState, toggleSound, playTestChimeCue } = useAudioManager();
  const { helpHintsEnabled, toggleHelpHints, setHubOpen } = useGuide();
  const { released60 } = useRelease();
  const zenCalmOn =
    soundEnabled &&
    !prefs.masterMuted &&
    prefs.sfxStyle === 'peaceful' &&
    prefs.soundMood !== 'classic';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'favorites' | PresetCategory>('all');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availablePresets = useMemo(
    () => COLOR_PRESETS.filter((p) => released60 || !p.release6Only),
    [released60]
  );

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availablePresets.filter((p) => {
      if (categoryFilter === 'favorites' && !prefs.favoritePresetIds.includes(p.id)) {
        return false;
      }
      if (
        categoryFilter !== 'all' &&
        categoryFilter !== 'favorites' &&
        p.category !== categoryFilter
      ) {
        return false;
      }
      if (prefs.presetMoodFilter !== 'all' && getPresetMood(p) !== prefs.presetMoodFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [availablePresets, categoryFilter, prefs.favoritePresetIds, prefs.presetMoodFilter, searchQuery]);

  if (!drawerOpen) return null;

  const isLightSkin = prefs.skin === 'swiss';
  const panelStyle = isLightSkin
    ? {
        backgroundColor: 'rgba(248, 250, 252, 0.97)',
        borderColor: 'rgba(15, 23, 42, 0.16)',
        color: '#0f172a',
      }
    : {
        backgroundColor: 'rgba(9, 13, 25, 0.96)',
        borderColor: activePreset.hudBorder,
        color: '#f8fafc',
      };
  const mutedColor = isLightSkin ? '#475569' : '#94a3b8';

  const handleToggleSceneInTour = (sceneId: SceneId) => {
    const exists = prefs.tourIncludedScenes.includes(sceneId);
    if (exists && prefs.tourIncludedScenes.length <= 1) {
      notify('Keep at Least One', 'Auto Tour needs at least one enabled scene');
      return;
    }
    const next = exists
      ? prefs.tourIncludedScenes.filter((s) => s !== sceneId)
      : [...prefs.tourIncludedScenes, sceneId];
    updatePrefs({ tourIncludedScenes: next });
  };

  const handleExportSettings = () => {
    const json = exportSettingsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kinetic-arcade-studio-6.0-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify('Exported Settings', 'Studio 6.0 JSON configuration downloaded');
  };

  return (
    <aside
      aria-label="Kinetic Studio 6.0 control drawer"
      style={panelStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => onHudHoverChange?.(true)}
      onMouseLeave={() => onHudHoverChange?.(false)}
      className="pointer-events-auto absolute top-14 right-2 bottom-16 left-2 z-40 flex flex-col overflow-hidden rounded-xl border shadow-2xl sm:top-13 sm:right-3 sm:bottom-16 sm:left-auto sm:w-[400px] sm:max-w-[calc(100%-1.5rem)]"
    >
      {/* Drawer Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: panelStyle.borderColor }}
      >
        <div>
          <h2 className="font-display text-sm font-semibold">Studio Control</h2>
          <p className="text-[11px]" style={{ color: mutedColor }}>
            {activePreset.name} · {COLOR_PRESETS.length} Presets
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close studio drawer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-none"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* 5 Tabs */}
      <div
        role="tablist"
        aria-label="Studio sections"
        className="grid grid-cols-5 gap-1 border-b p-1.5"
        style={{ borderColor: panelStyle.borderColor }}
      >
        {(
          [
            { id: 'themes', label: 'Themes', icon: Palette },
            { id: 'tour', label: 'Tour', icon: Repeat },
            { id: 'pc', label: 'PC Tune', icon: Cpu },
            { id: 'audio', label: 'Audio', icon: Sliders },
            { id: 'records', label: 'Stats', icon: Trophy },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = drawerTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tour-id={`studio-tab-${tab.id}`}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setDrawerTab(tab.id)}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none"
              style={
                active
                  ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                  : { color: mutedColor }
              }
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              <InfoBadge id={`studio-tab-${tab.id}`} />
            </button>
          );
        })}
      </div>

      {/* Relocated Quick Tools Strip (keeps Top Bar clean & calm) */}
      <div
        data-tour-id="studio-quick-tools"
        className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b px-2.5 py-1.5"
        style={{ borderColor: panelStyle.borderColor }}
      >
        <button
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            setHubOpen(true);
          }}
          title="Interactive Chaptered Guide (G)"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-sky-400/35 bg-sky-500/15 px-2 text-[10.5px] font-semibold text-sky-300 hover:bg-sky-500/25"
        >
          <Compass className="h-3 w-3" aria-hidden="true" />
          <span>Guide</span>
        </button>

        <button
          type="button"
          onClick={toggleHelpHints}
          aria-pressed={helpHintsEnabled}
          title='Toggle little "i" info badges everywhere'
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10.5px] font-bold transition-colors ${
            helpHintsEnabled
              ? 'border-sky-300/70 bg-sky-400 text-slate-950'
              : 'border-white/15 bg-white/5 hover:bg-white/10'
          }`}
        >
          <span className="font-mono-num">i</span>
          <span>Hints</span>
        </button>

        <button
          type="button"
          onClick={() => updatePrefs({ tourEnabled: !prefs.tourEnabled })}
          aria-pressed={prefs.tourEnabled}
          title="Toggle Idle Auto Tour (T)"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10.5px] font-medium hover:bg-white/10"
          style={
            prefs.tourEnabled
              ? { borderColor: activePreset.accent, color: activePreset.accent }
              : { borderColor: panelStyle.borderColor }
          }
        >
          <Repeat className="h-3 w-3" aria-hidden="true" />
          <span>{prefs.tourEnabled ? 'Tour On' : 'Auto Tour'}</span>
        </button>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Command Palette (Cmd/Ctrl+K)"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10.5px] font-medium hover:bg-white/10"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <Command className="h-3 w-3" aria-hidden="true" />
          <span>⌘K</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!zenCalmOn) {
              setSoundEnabledState(true);
              applySoundMood('deep-calm');
            } else {
              applySoundMood('classic');
            }
          }}
          aria-pressed={zenCalmOn}
          title="Toggle Zen Calm Soundscape"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10.5px] font-medium hover:bg-white/10"
          style={
            zenCalmOn
              ? { borderColor: '#34d399', color: isLightSkin ? '#047857' : '#6ee7b7' }
              : { borderColor: panelStyle.borderColor }
          }
        >
          <Wind className="h-3 w-3" aria-hidden="true" />
          <span>Calm</span>
        </button>

        <button
          type="button"
          onClick={onCaptureScreenshot}
          title="Save PNG Snapshot (P)"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10.5px] font-medium hover:bg-white/10"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <Camera className="h-3 w-3" aria-hidden="true" />
          <span>Photo</span>
        </button>

        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard Shortcuts (?)"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border hover:bg-white/10"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <HelpCircle className="h-3 w-3" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen (F)"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border hover:bg-white/10"
          style={{ borderColor: panelStyle.borderColor }}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {drawerTab === 'themes' && (
          <div className="flex flex-col gap-3.5">
            {/* 4 Skins */}
            <div data-tour-id="studio-skin" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Studio Visual Skin
                </span>
                <InfoBadge id="studio-skin" />
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/15 p-1">
                {SKIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePrefs({ skin: opt.id })}
                    className="h-7 rounded-md px-1 text-[11px] font-medium whitespace-nowrap transition-colors"
                    style={
                      prefs.skin === opt.id
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : undefined
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Outer Stage Surrounds */}
            <div data-tour-id="studio-surround" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Outer Stage Frame
                </span>
                <InfoBadge id="studio-surround" />
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/15 p-1">
                {SURROUND_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePrefs({ surround: opt.id })}
                    className="h-7 rounded-md px-1 text-[11px] font-medium whitespace-nowrap transition-colors"
                    style={
                      prefs.surround === opt.id
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : undefined
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope + Target + Stepper + Surprise Me */}
            <div data-tour-id="studio-scope-mix" className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]" style={{ color: mutedColor }}>
                <span className="inline-flex items-center gap-1">
                  Scope &amp; Target <InfoBadge id="studio-scope" /> <InfoBadge id="studio-target" />
                </span>
                <span className="inline-flex items-center gap-1">
                  Step / Mix <InfoBadge id="studio-mix" />
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updatePrefs({
                      presetScope: prefs.presetScope === 'global' ? 'per-scene' : 'global',
                    })
                  }
                  className="h-8 rounded-lg border px-1.5 text-[10px] font-medium whitespace-nowrap transition-colors hover:bg-white/10"
                  style={{ borderColor: panelStyle.borderColor }}
                  title="Toggle Global or Per-Scene theme lock"
                >
                  {prefs.presetScope === 'global' ? 'Global' : 'Per-Scene'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePrefs({
                      presetTarget:
                        prefs.presetTarget === 'hud+scene' ? 'hud-only' : 'hud+scene',
                    })
                  }
                  className="h-8 rounded-lg border px-1.5 text-[10px] font-medium whitespace-nowrap transition-colors hover:bg-white/10"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  {prefs.presetTarget === 'hud+scene' ? 'HUD+Scene' : 'HUD Only'}
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => stepPreset(-1, activeScene)}
                    aria-label="Previous theme preset"
                    title="Previous Theme (Alt+[)"
                    className="inline-flex h-8 items-center justify-center rounded-lg border transition-colors hover:bg-white/10"
                    style={{ borderColor: panelStyle.borderColor }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepPreset(1, activeScene)}
                    aria-label="Next theme preset"
                    title="Next Theme (Alt+])"
                    className="inline-flex h-8 items-center justify-center rounded-lg border transition-colors hover:bg-white/10"
                    style={{ borderColor: panelStyle.borderColor }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => randomizePreset(activeScene)}
                  title="Random Preset (Shift+X)"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{ backgroundColor: activePreset.accent, color: activePreset.accentFg }}
                >
                  <Shuffle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Mix</span>
                </button>
              </div>
            </div>

            {/* Auto-Switch Color Presets */}
            <div
              data-tour-id="studio-preset-cycle"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium">
                <input
                  type="checkbox"
                  checked={prefs.presetAutoCycle}
                  onChange={(e) => updatePrefs({ presetAutoCycle: e.target.checked })}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                <RefreshCw
                  className={`h-3.5 w-3.5 ${prefs.presetAutoCycle ? 'animate-spin' : ''}`}
                  style={{ color: activePreset.accent, animationDuration: '6s' }}
                  aria-hidden="true"
                />
                <span>Auto-Switch Presets</span>
                <InfoBadge id="studio-preset-cycle" />
              </label>
              <div className="flex items-center gap-1 rounded-md bg-black/15 p-0.5">
                {[5, 10, 20, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updatePrefs({ presetAutoCycleSec: sec, presetAutoCycle: true })}
                    className="rounded px-1.5 py-0.5 font-mono-num text-[10px] font-semibold transition-colors"
                    style={
                      prefs.presetAutoCycle && prefs.presetAutoCycleSec === sec
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : { color: mutedColor }
                    }
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Recent 5 Presets Strip */}
            {prefs.recentPresetIds.length > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: panelStyle.borderColor }}>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap" style={{ color: mutedColor }}>
                  Recent <InfoBadge id="studio-recent" />
                </span>
                <div className="flex items-center gap-1.5">
                  {prefs.recentPresetIds.slice(0, 5).map((id) => {
                    const p = getPresetById(id);
                    const isCurrent = p.id === activePreset.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={p.name}
                        onClick={() => selectPreset(p.id, activeScene)}
                        className="h-5 w-5 rounded-full border transition-transform hover:scale-110"
                        style={{
                          background: `linear-gradient(135deg, ${p.accent} 0%, ${p.surroundB} 100%)`,
                          borderColor: isCurrent ? '#ffffff' : 'rgba(255,255,255,0.28)',
                          boxShadow: isCurrent ? `0 0 0 2px ${p.accent}` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mood Filter Bar & Search */}
            <div data-tour-id="studio-presets-browser" className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px]" style={{ color: mutedColor }}>
                <span>Filter &amp; Search Presets</span>
                <InfoBadge id="studio-mood-search" />
              </div>
              <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/15 p-1">
                {MOOD_OPTIONS.map((mood) => (
                  <button
                    key={mood.id}
                    type="button"
                    onClick={() => updatePrefs({ presetMoodFilter: mood.id })}
                    className="h-6 rounded-md px-1 text-[10px] font-medium whitespace-nowrap transition-colors"
                    style={
                      prefs.presetMoodFilter === mood.id
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : { color: mutedColor }
                    }
                  >
                    {mood.label}
                  </button>
                ))}
              </div>

              {/* Search & Category Tabs for all 79 Presets */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5"
                  style={{ color: mutedColor }}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 79 color presets..."
                  aria-label="Search 79 color presets"
                  className="h-8 w-full rounded-lg border bg-black/15 pr-3 pl-8 text-xs focus:outline-none"
                  style={{ borderColor: panelStyle.borderColor }}
                />
              </div>

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="rounded-md px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors"
                style={
                  categoryFilter === 'all'
                    ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                    : { backgroundColor: 'rgba(148,163,184,0.14)', color: mutedColor }
                }
              >
                All ({availablePresets.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('favorites')}
                className="rounded-md px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors"
                style={
                  categoryFilter === 'favorites'
                    ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                    : { backgroundColor: 'rgba(148,163,184,0.14)', color: mutedColor }
                }
              >
                Favorites ({prefs.favoritePresetIds.length})
              </button>
              {PRESET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className="rounded-md px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors"
                  style={
                    categoryFilter === cat
                      ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                      : { backgroundColor: 'rgba(148,163,184,0.14)', color: mutedColor }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Preset Swatch Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {filteredPresets.map((preset) => {
                const isSelected = preset.id === activePreset.id;
                const isFav = prefs.favoritePresetIds.includes(preset.id);
                return (
                  <div
                    key={preset.id}
                    className="group flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 transition-colors"
                    style={{
                      borderColor: isSelected ? preset.accent : panelStyle.borderColor,
                      backgroundColor: isSelected ? `${preset.accent}18` : 'rgba(148,163,184,0.06)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectPreset(preset.id, activeScene)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-white/25"
                        style={{
                          background: `linear-gradient(135deg, ${preset.accent} 0%, ${preset.surroundB} 100%)`,
                        }}
                      />
                      <span className="truncate text-[11px] font-medium">{preset.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavoritePreset(preset.id)}
                      aria-label={isFav ? `Unfavorite ${preset.name}` : `Favorite ${preset.name}`}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-75 transition-opacity hover:opacity-100"
                    >
                      <Star
                        className={`h-3 w-3 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        )}

        {drawerTab === 'tour' && (
          <div className="flex flex-col gap-3.5">
            <div
              data-tour-id="studio-tour-arm"
              className="flex items-center justify-between rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span>Idle Auto Tour</span>
                  <InfoBadge id="studio-tour-arm" />
                </div>
                <div className="font-mono-num text-[11px]" style={{ color: mutedColor }}>
                  Status: {tourStatus.toUpperCase()}
                  {prefs.tourEnabled && tourStatus !== 'paused' ? ` · ${tourRemainingSec}s` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => updatePrefs({ tourEnabled: !prefs.tourEnabled })}
                className="h-8 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-opacity"
                style={
                  prefs.tourEnabled
                    ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                    : { backgroundColor: 'rgba(148,163,184,0.2)' }
                }
              >
                {prefs.tourEnabled ? 'Armed' : 'Enable'}
              </button>
            </div>

            {prefs.tourEnabled && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onTourTogglePause}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  {tourStatus === 'paused' ? (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{tourStatus === 'paused' ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  type="button"
                  onClick={onTourNext}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  <span>Skip Scene</span>
                </button>
              </div>
            )}

            <label
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>Auto-Turn On After 45s Idle</span>
                <InfoBadge id="studio-tour-auto45" />
              </span>
              <input
                type="checkbox"
                checked={prefs.tourAutoEnableIdle45}
                onChange={(e) => updatePrefs({ tourAutoEnableIdle45: e.target.checked })}
                className="h-4 w-4 accent-amber-400"
              />
            </label>

            <div data-tour-id="studio-tour-timing" className="flex flex-col gap-3">
            {/* Idle Trigger Delay */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Idle Trigger Delay
                </span>
                <InfoBadge id="studio-tour-delay" />
              </div>
              <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/15 p-1">
                {[5, 10, 15, 30, 45].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updatePrefs({ tourIdleDelaySec: sec })}
                    className="h-7 rounded-md font-mono-num text-[11px] font-medium"
                    style={
                      prefs.tourIdleDelaySec === sec
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : undefined
                    }
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Scene Dwell Time */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Time Per Scene
                </span>
                <InfoBadge id="studio-tour-dwell" />
              </div>
              <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/15 p-1">
                {[10, 15, 25, 45, 90].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updatePrefs({ tourDwellSec: sec })}
                    className="h-7 rounded-md font-mono-num text-[11px] font-medium"
                    style={
                      prefs.tourDwellSec === sec
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : undefined
                    }
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
            </div>

            <div data-tour-id="studio-tour-scenes" className="flex flex-col gap-3">
            {/* Rotation Order */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Rotation Order
                </span>
                <InfoBadge id="studio-tour-order" />
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
                {(
                  [
                    { id: 'sequential', label: 'Sequential Loop' },
                    { id: 'shuffle', label: 'Smart Shuffle' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePrefs({ tourOrderMode: opt.id })}
                    className="h-7 rounded-md text-[11px] font-medium"
                    style={
                      prefs.tourOrderMode === opt.id
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : undefined
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Included Scenes Checklist */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Included Scenes
                </span>
                <InfoBadge id="studio-tour-scenes" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_SCENES.map((sceneId) => {
                  const included = prefs.tourIncludedScenes.includes(sceneId);
                  return (
                    <button
                      key={sceneId}
                      type="button"
                      onClick={() => handleToggleSceneInTour(sceneId)}
                      className="flex h-8 items-center justify-between rounded-lg border px-2.5 text-xs font-medium"
                      style={{
                        borderColor: included ? activePreset.accent : panelStyle.borderColor,
                        backgroundColor: included ? `${activePreset.accent}18` : undefined,
                      }}
                    >
                      <span>{SCENE_META[sceneId].shortLabel}</span>
                      {included && (
                        <Check
                          className="h-3.5 w-3.5"
                          style={{ color: activePreset.accent }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tour Choreography Toggles */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Tour Behavior Rules
                </span>
                <InfoBadge id="studio-tour-rules" />
              </div>
              {(
                [
                  {
                    key: 'tourSyncPresets',
                    label: 'Choreograph Scene-Matched Colors',
                    helpId: 'studio-tour-sync',
                  },
                  {
                    key: 'tourRestoreMode',
                    label: 'Restore Auto/Manual on Return',
                    helpId: 'studio-tour-restore',
                  },
                  {
                    key: 'tourPauseOnHover',
                    label: 'Pause Tour While Hovering HUD',
                    helpId: 'studio-tour-hover',
                  },
                  {
                    key: 'tourPauseOnMouseMove',
                    label: 'Reset Idle Timer on Mouse Move',
                    helpId: 'studio-tour-mouse',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{item.label}</span>
                    <InfoBadge id={item.helpId} />
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={(e) => updatePrefs({ [item.key]: e.target.checked })}
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>
              ))}
            </div>
            </div>
          </div>
        )}

        {drawerTab === 'pc' && (
          <div className="flex flex-col gap-3.5">
            {/* Detected System & Display Summary */}
            <div
              data-tour-id="studio-pc-profile"
              className="flex flex-col gap-2 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span>Detected PC Profile</span>
                    <InfoBadge id="studio-pc-profile" />
                  </div>
                  <div className="font-mono-num text-[11px]" style={{ color: mutedColor }}>
                    {fps} FPS · {frameMs} ms
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => applyPcMatchPreset('auto-pc')}
                  className="h-8 rounded-lg px-2.5 text-[11px] font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{ backgroundColor: activePreset.accent, color: activePreset.accentFg }}
                >
                  Match My PC
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <div className="text-[10px]" style={{ color: mutedColor }}>
                    GPU Adapter
                  </div>
                  <div className="truncate font-semibold">{hardwareProfile.gpuShortName}</div>
                </div>
                <div>
                  <div className="text-[10px]" style={{ color: mutedColor }}>
                    CPU &amp; Memory
                  </div>
                  <div className="font-mono-num font-semibold">
                    {hardwareProfile.cpuThreads} Threads
                    {hardwareProfile.deviceMemoryGb ? ` · ${hardwareProfile.deviceMemoryGb}+ GB` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[10px]" style={{ color: mutedColor }}>
                    Display Resolution
                  </div>
                  <div className="font-mono-num font-semibold">
                    {hardwareProfile.screenWidth}×{hardwareProfile.screenHeight} (
                    {hardwareProfile.isUltrawide ? '21:9' : '16:9'})
                  </div>
                </div>
                <div>
                  <div className="text-[10px]" style={{ color: mutedColor }}>
                    Measured Refresh
                  </div>
                  <div className="font-mono-num font-semibold" style={{ color: activePreset.accent }}>
                    {hardwareProfile.measuredHz} Hz · {hardwareProfile.nativeDpr.toFixed(2)}x DPR
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Frame Pacing & Shader Scaling Presets */}
            <div
              data-tour-id="studio-pc-pacing"
              className="flex flex-col gap-2 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Frame Pacing &amp; GPU Scaling</span>
                <InfoBadge id="studio-pc-pacing" />
              </div>
              {(
                [
                  {
                    id: 'auto-pc',
                    label: 'Auto PC Match (Recommended)',
                    desc: '21:9 ultrawide + unlocked 2D Hz + adaptive 0.75–1.0x shaders for UHD iGPUs',
                  },
                  {
                    id: 'hybrid-179-60',
                    label: '2D High-Hz · 3D Steady 60fps',
                    desc: 'Unlocks 179Hz on Angry Birds / Hoops / Coastline while capping heavy 3D at 60fps',
                  },
                  {
                    id: 'max-179',
                    label: 'Max Refresh Everywhere (1.0x Scale)',
                    desc: 'Native refresh unlocked in all scenes using lightweight 1.0x pixel scaling',
                  },
                  {
                    id: 'std-60',
                    label: '16:9 Balanced Standard',
                    desc: 'Classic 16:9 stage framing with manual High / Balanced / Eco tier control',
                  },
                ] as Array<{ id: FramePacingMode; label: string; desc: string }>
              ).map((opt) => {
                const selected = prefs.framePacingMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyPcMatchPreset(opt.id)}
                    className="flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                    style={{
                      borderColor: selected ? activePreset.accent : panelStyle.borderColor,
                      backgroundColor: selected ? `${activePreset.accent}18` : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold">{opt.label}</span>
                      {selected && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: activePreset.accent }} />
                      )}
                    </div>
                    <span className="text-[10px] leading-snug" style={{ color: mutedColor }}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Potato Tier & Quick Shader Mood */}
            <div
              className="flex flex-col gap-2 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Quality Tier (Potato → High)</span>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setSandboxOpen(true);
                  }}
                  className="text-[10.5px] font-semibold underline-offset-2 hover:underline"
                  style={{ color: activePreset.accent }}
                >
                  Open Sandbox (B)
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/15 p-1">
                {(['potato', 'eco', 'auto', 'balanced', 'high'] as QualityTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => updatePrefs({ qualityTier: tier })}
                    className="h-7 rounded-md text-[10.5px] font-semibold capitalize"
                    style={
                      prefs.qualityTier === tier
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : undefined
                    }
                  >
                    {tier}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: mutedColor }}>
                  <Flame className="h-3 w-3" style={{ color: activePreset.accent }} aria-hidden="true" />
                  <span>3D Shader Mood</span>
                </span>
                <span className="text-[10px]" style={{ color: mutedColor }}>
                  {SHADER_MOOD_META[prefs.shaderMood].label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(SHADER_MOOD_META) as ShaderMood[]).map((moodKey) => (
                  <button
                    key={moodKey}
                    type="button"
                    onClick={() => updatePrefs({ shaderMood: moodKey })}
                    className="h-7 rounded-md border px-1.5 text-[10px] font-medium whitespace-nowrap"
                    style={
                      prefs.shaderMood === moodKey
                        ? {
                            borderColor: activePreset.accent,
                            backgroundColor: `${activePreset.accent}22`,
                            color: activePreset.accent,
                          }
                        : { borderColor: panelStyle.borderColor }
                    }
                  >
                    {SHADER_MOOD_META[moodKey].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Bottleneck & Optimization Advisories */}
            <div data-tour-id="studio-pc-bottlenecks" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Hardware Insights &amp; Bottlenecks
                </span>
                <InfoBadge id="studio-pc-bottlenecks" />
              </div>
              {hardwareProfile.bottlenecks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border p-2.5 text-[11px]"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: item.severity === 'warn' ? '#fbbf24' : activePreset.accent }}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-0.5 leading-snug" style={{ color: mutedColor }}>
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {drawerTab === 'audio' && (
          <div className="flex flex-col gap-3.5">
            {/* Soundscape Mood Presets */}
            <div
              data-tour-id="studio-audio-moods"
              className="flex flex-col gap-2.5 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span>Ambient Soundscapes</span>
                    <InfoBadge id="studio-audio-moods" />
                  </div>
                  <div className="text-[10px]" style={{ color: mutedColor }}>
                    {prefs.soundMood === 'custom'
                      ? 'Custom Mix'
                      : SOUND_MOOD_PRESETS[prefs.soundMood]?.label ?? 'Deep Calm'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!soundEnabled) toggleSound();
                      playTestChimeCue();
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium whitespace-nowrap hover:bg-white/10"
                    style={{ borderColor: panelStyle.borderColor }}
                  >
                    <span>Test Chime</span>
                    <InfoBadge id="studio-audio-test" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleSound}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold whitespace-nowrap"
                    style={
                      soundEnabled
                        ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                        : { backgroundColor: 'rgba(148,163,184,0.2)' }
                    }
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{soundEnabled ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  ['deep-calm', 'nature-walk', 'rainy-evening', 'classic'] as ActiveSoundMoodId[]
                ).map((moodId) => {
                  const mood = SOUND_MOOD_PRESETS[moodId];
                  const selected = prefs.soundMood === moodId;
                  return (
                    <button
                      key={moodId}
                      type="button"
                      onClick={() => {
                        if (!soundEnabled) toggleSound();
                        applySoundMood(moodId);
                      }}
                      className="flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                      style={{
                        borderColor: selected ? activePreset.accent : panelStyle.borderColor,
                        backgroundColor: selected ? `${activePreset.accent}18` : undefined,
                      }}
                    >
                      <span className="text-[11px] font-semibold">{mood.label}</span>
                      <span className="text-[9.5px] leading-tight" style={{ color: mutedColor }}>
                        {mood.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Peaceful Foley vs Classic Arcade SFX */}
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: mutedColor }}>
                    Sound Effect Character
                  </span>
                  <InfoBadge id="studio-audio-sfx-style" />
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
                  {(
                    [
                      { id: 'peaceful', label: 'Peaceful Foley' },
                      { id: 'classic', label: 'Classic Arcade' },
                    ] as Array<{ id: SfxStyle; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ sfxStyle: opt.id, soundMood: 'custom' })}
                      className="h-7 rounded-md px-2 text-[10px] font-medium whitespace-nowrap"
                      style={
                        prefs.sfxStyle === opt.id
                          ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                          : undefined
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 6-Channel Calm Layer Mixer & Stereo Reverb */}
            <div
              data-tour-id="studio-audio-sliders"
              className="flex flex-col gap-2.5 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Layer Mixer &amp; Acoustics</span>
                <div className="flex items-center gap-1">
                  <InfoBadge id="studio-audio-sliders" />
                  <InfoBadge id="studio-audio-mutes" />
                  <InfoBadge id="studio-audio-eq" />
                </div>
              </div>

              {(
                [
                  { key: 'masterVolume', label: 'Master Gain', keepMood: true, helpId: 'studio-audio-master' },
                  { key: 'ambienceVolume', label: 'Nature / World', keepMood: false, helpId: 'studio-audio-nature' },
                  { key: 'padsVolume', label: 'Ambient Pads', keepMood: false, helpId: 'studio-audio-pads' },
                  { key: 'rainVolume', label: 'Cozy Rain', keepMood: false, helpId: 'studio-audio-rain' },
                  { key: 'sfxVolume', label: 'Action SFX', keepMood: false, helpId: 'studio-audio-sfx' },
                  { key: 'reverbMix', label: 'Stereo Reverb', keepMood: false, helpId: 'studio-audio-reverb' },
                ] as const
              ).map((ch) => {
                const value = prefs[ch.key];
                return (
                  <label key={ch.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1" style={{ color: mutedColor }}>
                        <span>{ch.label}</span>
                        <InfoBadge id={ch.helpId} />
                      </span>
                      <span className="font-mono-num font-semibold">
                        {Math.round(value * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={value}
                      onChange={(e) => {
                        const nextVal = parseFloat(e.target.value);
                        updatePrefs(
                          ch.keepMood
                            ? { [ch.key]: nextVal }
                            : { [ch.key]: nextVal, soundMood: 'custom' }
                        );
                      }}
                      className="studio-range h-1.5 w-full cursor-pointer"
                    />
                  </label>
                );
              })}

              {/* Individual Channel Mute Switches */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {(
                  [
                    { key: 'masterMuted', label: 'Master' },
                    { key: 'ambienceMuted', label: 'Nature' },
                    { key: 'padsMuted', label: 'Pads' },
                    { key: 'rainMuted', label: 'Rain' },
                    { key: 'sfxMuted', label: 'SFX' },
                    { key: 'crowdMuted', label: 'Birds/Crowd' },
                  ] as const
                ).map((ch) => {
                  const muted = prefs[ch.key];
                  return (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => updatePrefs({ [ch.key]: !muted, soundMood: 'custom' })}
                      className="h-7 rounded-md border px-1 text-[10px] font-medium whitespace-nowrap transition-colors"
                      style={{
                        borderColor: muted ? '#fb7185' : panelStyle.borderColor,
                        backgroundColor: muted ? 'rgba(244, 63, 94, 0.18)' : undefined,
                        color: muted ? '#fda4af' : undefined,
                      }}
                    >
                      {muted ? `No ${ch.label}` : ch.label}
                    </button>
                  );
                })}
              </div>

              {/* Acoustic EQ Profile */}
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: mutedColor }}>
                    Acoustic EQ Profile
                  </span>
                  <InfoBadge id="studio-audio-eq" />
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
                  {(
                    [
                      { id: 'calm', label: 'Calm Acoustic' },
                      { id: 'warm', label: 'Late-Night Warm' },
                      { id: 'arcade', label: 'Arcade Punch' },
                      { id: 'broadcast', label: 'Broadcast Clean' },
                    ] as Array<{ id: AcousticProfile; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ acousticProfile: opt.id, soundMood: 'custom' })}
                      className="h-7 rounded-md px-1 text-[10px] font-medium whitespace-nowrap"
                      style={
                        prefs.acousticProfile === opt.id
                          ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                          : undefined
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-2 pt-0.5 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span>Mute Audio When Tab Blurred</span>
                  <InfoBadge id="studio-audio-tab-mute" />
                </span>
                <input
                  type="checkbox"
                  checked={prefs.muteOnTabBlur}
                  onChange={(e) => updatePrefs({ muteOnTabBlur: e.target.checked })}
                  className="h-4 w-4 accent-amber-400"
                />
              </label>
            </div>

            {/* Viewport, Aspect & HUD Tuning */}
            <div
              data-tour-id="studio-viewport-qol"
              className="flex flex-col gap-2.5 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Viewport, Framing &amp; QoL</span>
                <InfoBadge id="studio-viewport-qol" />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: mutedColor }}>
                    Stage Aspect Framing (16:9 / 21:9 Ultrawide)
                  </span>
                  <InfoBadge id="studio-qol-aspect" />
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/15 p-1">
                  {(
                    [
                      { id: '16:9', label: '16:9 Cinema' },
                      { id: '21:9', label: '21:9 Ultrawide' },
                      { id: 'fill', label: 'Fill Screen' },
                    ] as Array<{ id: StageAspectMode; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePrefs({ stageAspectLock: opt.id })}
                      className="h-7 rounded-md text-[10px] font-medium whitespace-nowrap"
                      style={
                        prefs.stageAspectLock === opt.id
                          ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                          : undefined
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: mutedColor }}>
                    <span>Idle Cursor Hide</span>
                    <InfoBadge id="studio-qol-cursor" />
                  </span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/15 p-1">
                    {([0, 2, 4] as const).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => updatePrefs({ cursorAutoHideSec: sec })}
                        className="h-6 rounded font-mono-num text-[10px] font-medium"
                        style={
                          prefs.cursorAutoHideSec === sec
                            ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                            : undefined
                        }
                      >
                        {sec === 0 ? 'Off' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: mutedColor }}>
                    <span>HUD Density</span>
                    <InfoBadge id="studio-qol-density" />
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/15 p-1">
                    {(['standard', 'compact'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updatePrefs({ hudDensity: d })}
                        className="h-6 rounded text-[10px] font-medium capitalize"
                        style={
                          prefs.hudDensity === d
                            ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                            : undefined
                        }
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1" style={{ color: mutedColor }}>
                    <span>HUD Opacity</span>
                    <InfoBadge id="studio-qol-opacity" />
                  </span>
                  <span className="font-mono-num font-semibold">
                    {Math.round(prefs.hudOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={1}
                  step={0.05}
                  value={prefs.hudOpacity}
                  onChange={(e) => updatePrefs({ hudOpacity: parseFloat(e.target.value) })}
                  className="studio-range h-1.5 w-full cursor-pointer"
                />
              </label>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: mutedColor }}>
                    Global Render Quality (Eco caps belts &amp; particles)
                  </span>
                  <InfoBadge id="studio-qol-quality" />
                </div>
                <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/15 p-1">
                  {(['potato', 'eco', 'auto', 'balanced', 'high'] as QualityTier[]).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => updatePrefs({ qualityTier: tier })}
                      className="h-7 rounded-md text-[10.5px] font-medium capitalize"
                      style={
                        prefs.qualityTier === tier
                          ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                          : undefined
                      }
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {(
                [
                  { key: 'fullscreenAutoZen', label: 'Fullscreen Auto-Zen HUD', helpId: 'studio-qol-fs-zen' },
                  { key: 'screenshotIncludeHud', label: 'Include Scene Caption in PNG', helpId: 'studio-qol-caption-png' },
                  { key: 'showTelemetryBar', label: 'Show Top Stats HUD', helpId: 'studio-qol-top-hud' },
                  { key: 'showFps', label: 'Show FPS & Frame Time', helpId: 'studio-qol-fps' },
                  { key: 'showAimGuides', label: 'Show Trajectory Aim Guides', helpId: 'studio-qol-aim' },
                  { key: 'showTrails', label: 'Show Ball & Bird Trails', helpId: 'studio-qol-trails' },
                  { key: 'reducedShake', label: 'Reduce Camera Impact Shake', helpId: 'studio-qol-shake' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between gap-2 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{item.label}</span>
                    <InfoBadge id={item.helpId} />
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={(e) => updatePrefs({ [item.key]: e.target.checked })}
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {drawerTab === 'records' && (
          <div className="flex flex-col gap-3">
            <div data-tour-id="studio-records-grid" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Personal Bests
                </span>
                <InfoBadge id="studio-records-grid" />
              </div>
              <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Best Hoops Streak', value: `${records.bestBasketballStreak}` },
                { label: 'Total Hoops Makes', value: `${records.totalBasketballMakes}` },
                { label: 'Total Clean Swishes', value: `${records.totalBasketballSwishes}` },
                { label: 'Best Angry Birds Score', value: `${records.bestSlingshotScore}` },
                { label: 'Total Birds Fired', value: `${records.totalBirdsUsed}` },
                { label: 'Best Temple Run', value: `${records.bestTempleDistance} m` },
                { label: 'Top Coastline Speed', value: `${records.bestCyclistSpeed.toFixed(1)}x` },
                { label: 'Snapshots Saved', value: `${records.totalScreenshots}` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border p-2.5"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  <div className="text-[10px]" style={{ color: mutedColor }}>
                    {stat.label}
                  </div>
                  <div
                    className="mt-0.5 font-mono-num text-base font-semibold"
                    style={{ color: activePreset.accent }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
              </div>
            </div>

            {/* 3 Named Studio Snapshot Slots */}
            <div
              data-tour-id="studio-snapshots"
              className="flex flex-col gap-2 rounded-lg border p-3"
              style={{ borderColor: panelStyle.borderColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Studio Snapshot Slots (A / B / C)</span>
                <InfoBadge id="studio-snapshots" />
              </div>
              {(['A', 'B', 'C'] as SnapshotSlotId[]).map((slot) => {
                const snap = snapshotSlots[slot];
                return (
                  <div
                    key={slot}
                    className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
                    style={{ borderColor: panelStyle.borderColor }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">Slot {slot}</div>
                      <div className="truncate text-[10px]" style={{ color: mutedColor }}>
                        {snap ? `${snap.name} · ${snap.savedAt}` : 'Empty slot'}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveSnapshotSlot(slot, activeScene)}
                        className="rounded border px-2 py-0.5 text-[10px] font-medium hover:bg-white/10"
                        style={{ borderColor: panelStyle.borderColor }}
                      >
                        Save
                      </button>
                      {snap && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const nextScene = loadSnapshotSlot(slot);
                              if (nextScene && onSwitchScene) onSwitchScene(nextScene);
                            }}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: activePreset.accent,
                              color: activePreset.accentFg,
                            }}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSnapshotSlot(slot)}
                            aria-label={`Clear Snapshot ${slot}`}
                            className="rounded p-1 text-rose-400 hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div data-tour-id="studio-export-reset" className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px]" style={{ color: mutedColor }}>
                <span>Backups &amp; Reset</span>
                <div className="flex items-center gap-1">
                  <InfoBadge id="studio-export-import" />
                  <InfoBadge id="studio-reset-records" />
                </div>
              </div>
            <button
              type="button"
              onClick={onCaptureScreenshot}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: activePreset.accent, color: activePreset.accentFg }}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>Capture Stage Snapshot (PNG · P)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportSettings}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium hover:bg-white/10"
                style={{ borderColor: panelStyle.borderColor }}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium hover:bg-white/10"
                style={{ borderColor: panelStyle.borderColor }}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Import JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void file.text().then((txt) => importSettingsJson(txt));
                  e.target.value = '';
                }}
              />
            </div>

            {undoResetAvailable && (
              <button
                type="button"
                onClick={restoreLastReset}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Undo Last Records Reset</span>
              </button>
            )}

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 text-xs font-medium text-rose-400 hover:bg-rose-500/10"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset Personal Bests</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetRecords();
                    setConfirmReset(false);
                  }}
                  className="h-8 rounded-lg bg-rose-500 text-xs font-semibold text-white hover:bg-rose-600"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="h-8 rounded-lg border text-xs font-medium"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  Cancel
                </button>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Timeless Studio Motto Footer */}
      <div
        className="border-t px-4 py-2 text-center text-[10px] font-medium"
        style={{ borderColor: panelStyle.borderColor, color: mutedColor }}
      >
        “{STUDIO_MOTTO}”
      </div>
    </aside>
  );
}
