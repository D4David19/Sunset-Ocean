import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';
import { useAudioManager, type SceneId } from '../../context/AudioManagerContext';
import { useGuide } from '../../context/GuideContext';
import { useRelease } from '../../context/ReleaseContext';
import {
  ALL_SCENES,
  SCENE_META,
  SOUND_MOOD_PRESETS,
  dispatchSceneCommand,
  useStudio,
  type ActiveSoundMoodId,
  type HudSkin,
  type SnapshotSlotId,
  type StageSurround,
} from '../../context/StudioContext';
import { COLOR_PRESETS } from '../../data/colorPresets';
import { TUTORIAL_CHAPTERS } from '../../data/helpCatalog';
import { SHADER_MOOD_META, type ShaderMood } from '../../utils/threeShaders';

interface CommandPaletteProps {
  onSelectScene: (scene: SceneId) => void;
  onToggleGlobalAuto: () => void;
  onToggleFullscreen: () => void;
  onCaptureScreenshot: () => void;
}

type PaletteTab = 'all' | 'scenes' | 'themes' | 'actions';

interface CommandItem {
  id: string;
  label: string;
  group: string;
  tab: Exclude<PaletteTab, 'all'>;
  run: () => void;
}

const PLANET_JUMPS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const BIOME_JUMPS = [
  'USA Highway Tour',
  'Rocky Mountains',
  'Southwest Desert',
  'American Homes',
];

export default function CommandPalette({
  onSelectScene,
  onToggleGlobalAuto,
  onToggleFullscreen,
  onCaptureScreenshot,
}: CommandPaletteProps) {
  const {
    paletteOpen,
    setPaletteOpen,
    setZenMode,
    setDrawerOpen,
    setDrawerTab,
    setSandboxOpen,
    setShortcutsOpen,
    hardwareProfile,
    applyPcMatchPreset,
    applySoundMood,
    updatePrefs,
    selectPreset,
    randomizePreset,
    snapshotSlots,
    loadSnapshotSlot,
    activePreset,
    activeScene,
    prefs,
  } = useStudio();
  const { soundEnabled, setSoundEnabledState, toggleSound } = useAudioManager();
  const { helpHintsEnabled, toggleHelpHints, setHubOpen, startFullTour, startAutoTour, startChapter } = useGuide();
  const { released60, isOwnerMode, setReleaseModalOpen, releaseNowByOwner } = useRelease();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PaletteTab>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setActiveTab('all');
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [paletteOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      ...ALL_SCENES.map((s) => ({
        id: `scene-${s}`,
        label: `Switch Scene: ${SCENE_META[s].label}`,
        group: 'Scenes',
        tab: 'scenes' as const,
        run: () => onSelectScene(s),
      })),
      ...PLANET_JUMPS.map((planet) => ({
        id: `planet-${planet.toLowerCase()}`,
        label: `Inspect Planet: ${planet} (Solar Horizon)`,
        group: 'Solar Jump',
        tab: 'scenes' as const,
        run: () => {
          onSelectScene('ocean');
          window.setTimeout(() => {
            dispatchSceneCommand({ scene: 'ocean', type: 'enter-space', planetName: planet });
          }, 80);
        },
      })),
      ...BIOME_JUMPS.map((biome, idx) => ({
        id: `biome-${idx}`,
        label: `Coastline Biome: ${biome}`,
        group: 'Biomes',
        tab: 'scenes' as const,
        run: () => {
          onSelectScene('cyclist');
          window.setTimeout(() => {
            dispatchSceneCommand({ scene: 'cyclist', type: 'jump-biome', biomeIndex: idx });
          }, 80);
        },
      })),
      ...(
        [
          [0, '01. Timber Watch'],
          [1, '02. Frostbite Spires'],
          [2, '03. Stone Pyramid'],
          [3, '04. TNT Quarry'],
          [4, "05. King's Citadel"],
          [5, '06. Skyway Bouncer'],
        ] as Array<[number, string]>
      ).map(([idx, name]) => ({
        id: `sling-lvl-${idx}`,
        label: `Angry Birds Stage: ${name}`,
        group: 'Angry Birds 5.0',
        tab: 'scenes' as const,
        run: () => {
          onSelectScene('slingshot');
          window.setTimeout(() => {
            dispatchSceneCommand({ scene: 'slingshot', type: 'load-level', levelIndex: idx });
          }, 80);
        },
      })),
      {
        id: 'act-ai',
        label: 'Toggle Global AI / Manual Mode (A)',
        group: 'Actions',
        tab: 'actions',
        run: onToggleGlobalAuto,
      },
      {
        id: 'act-tour',
        label: prefs.tourEnabled ? 'Disable Idle Auto Tour (T)' : 'Enable Idle Auto Tour (T)',
        group: 'Actions',
        tab: 'actions',
        run: () => updatePrefs({ tourEnabled: !prefs.tourEnabled }),
      },
      {
        id: 'act-zen',
        label: 'Toggle Zen Hide-HUD Mode (H)',
        group: 'Actions',
        tab: 'actions',
        run: () => setZenMode((p) => !p),
      },
      {
        id: 'act-shot',
        label: 'Save Stage PNG Screenshot (P)',
        group: 'Actions',
        tab: 'actions',
        run: onCaptureScreenshot,
      },
      {
        id: 'act-fs',
        label: 'Toggle Fullscreen (F)',
        group: 'Actions',
        tab: 'actions',
        run: onToggleFullscreen,
      },
      {
        id: 'act-sound',
        label: 'Toggle Audio Sound (M)',
        group: 'Actions',
        tab: 'actions',
        run: toggleSound,
      },
      {
        id: 'act-zen-calm',
        label: 'Audio: Enable Zen Calm Soundscape',
        group: 'Audio',
        tab: 'actions',
        run: () => {
          setSoundEnabledState(true);
          applySoundMood('deep-calm');
        },
      },
      {
        id: 'act-cozy-rain',
        label:
          prefs.rainMuted || prefs.rainVolume < 0.05
            ? 'Audio: Turn On Cozy Rain Overlay'
            : 'Audio: Mute Cozy Rain Overlay',
        group: 'Audio',
        tab: 'actions',
        run: () => {
          setSoundEnabledState(true);
          if (prefs.rainMuted || prefs.rainVolume < 0.05) {
            updatePrefs({
              rainMuted: false,
              rainVolume: Math.max(0.45, prefs.rainVolume),
              soundMood: 'custom',
            });
          } else {
            updatePrefs({ rainMuted: true, soundMood: 'custom' });
          }
        },
      },
      {
        id: 'act-sfx-style',
        label:
          prefs.sfxStyle === 'peaceful'
            ? 'Audio SFX: Switch to Classic Arcade'
            : 'Audio SFX: Switch to Peaceful Foley',
        group: 'Audio',
        tab: 'actions',
        run: () =>
          updatePrefs({
            sfxStyle: prefs.sfxStyle === 'peaceful' ? 'classic' : 'peaceful',
            soundMood: 'custom',
          }),
      },
      ...(
        ['deep-calm', 'nature-walk', 'rainy-evening', 'classic'] as ActiveSoundMoodId[]
      ).map((moodId) => ({
        id: `audio-mood-${moodId}`,
        label: `Audio Mood: ${SOUND_MOOD_PRESETS[moodId].label}`,
        group: 'Audio',
        tab: 'actions' as const,
        run: () => {
          if (!soundEnabled) setSoundEnabledState(true);
          applySoundMood(moodId);
        },
      })),
      {
        id: 'act-audio-mixer',
        label: 'Audio: Open Calm Soundscape Mixer',
        group: 'Audio',
        tab: 'actions',
        run: () => {
          setDrawerTab('audio');
          setDrawerOpen(true);
        },
      },
      {
        id: 'act-random',
        label: 'Surprise Me: Random Color Preset (Shift+X)',
        group: 'Actions',
        tab: 'actions',
        run: () => randomizePreset(activeScene),
      },
      {
        id: 'act-aspect-16',
        label: 'Stage Aspect: 16:9 Cinema Lock',
        group: 'Framing',
        tab: 'actions',
        run: () => updatePrefs({ stageAspectLock: '16:9' }),
      },
      {
        id: 'act-aspect-21',
        label: 'Stage Aspect: 21:9 Ultrawide Lock',
        group: 'Framing',
        tab: 'actions',
        run: () => updatePrefs({ stageAspectLock: '21:9' }),
      },
      {
        id: 'act-aspect-fill',
        label: 'Stage Aspect: Fill Viewport',
        group: 'Framing',
        tab: 'actions',
        run: () => updatePrefs({ stageAspectLock: 'fill' }),
      },
      {
        id: 'act-pc-match',
        label: `Match My PC (${hardwareProfile.gpuShortName} · ${hardwareProfile.measuredHz}Hz)`,
        group: 'PC Tune',
        tab: 'actions',
        run: () => applyPcMatchPreset('auto-pc'),
      },
      {
        id: 'act-pc-hybrid',
        label: 'Frame Pacing: 2D High-Hz + 3D Steady 60fps',
        group: 'PC Tune',
        tab: 'actions',
        run: () => applyPcMatchPreset('hybrid-179-60'),
      },
      {
        id: 'act-pc-max',
        label: 'Frame Pacing: Max Refresh (1.0x Scale)',
        group: 'PC Tune',
        tab: 'actions',
        run: () => applyPcMatchPreset('max-179'),
      },
      ...hardwareProfile.bottlenecks.map((b) => ({
        id: `bottleneck-${b.id}`,
        label: `${b.severity === 'warn' ? 'Bottleneck Alert: ' : 'PC Spec: '}${b.title}`,
        group: 'Diagnostics',
        tab: 'actions' as const,
        run: () => {
          setDrawerTab('pc');
          setDrawerOpen(true);
        },
      })),
      {
        id: 'act-studio',
        label: 'Open Studio Drawer (C)',
        group: 'Actions',
        tab: 'actions',
        run: () => {
          setSandboxOpen(false);
          setDrawerTab('themes');
          setDrawerOpen(true);
        },
      },
      {
        id: 'act-sandbox',
        label: 'Freedom Sandbox: Open Physics, Shaders & Potato Mode (B)',
        group: 'Update 6.0',
        tab: 'actions',
        run: () => {
          setDrawerOpen(false);
          setSandboxOpen(true);
        },
      },
      {
        id: 'act-render-mode',
        label:
          prefs.renderMode === '3d'
            ? 'View Engine: Switch to Classic 2D Art Mode (V)'
            : 'View Engine: Switch to Enhanced 3D Worlds (V)',
        group: 'Update 6.0',
        tab: 'actions',
        run: () =>
          updatePrefs({ renderMode: prefs.renderMode === '3d' ? '2d' : '3d' }),
      },
      {
        id: 'act-preset-cycle',
        label: prefs.presetAutoCycle
          ? 'Themes: Turn Off Auto-Switch Color Presets'
          : 'Themes: Auto-Switch Through All 79 Color Presets',
        group: 'Actions',
        tab: 'actions',
        run: () => updatePrefs({ presetAutoCycle: !prefs.presetAutoCycle }),
      },
      {
        id: 'act-potato-mode',
        label: 'Performance: Enable Ultra-Low "Potato" Mode (0.65x Scale, Max FPS)',
        group: 'Update 6.0',
        tab: 'actions',
        run: () => updatePrefs({ qualityTier: 'potato' }),
      },
      ...(Object.keys(SHADER_MOOD_META) as ShaderMood[]).map((moodKey) => ({
        id: `shader-mood-${moodKey}`,
        label: `3D Shader Mood: ${SHADER_MOOD_META[moodKey].label}`,
        group: '3D Shaders',
        tab: 'actions' as const,
        run: () => updatePrefs({ shaderMood: moodKey }),
      })),
      {
        id: 'act-release-timer',
        label: released60
          ? 'Updates Log: View Full v1.0–v6.0 Changelog & 25 Features (U)'
          : 'Update 6.0: Open Updates Log & Release Timer (U)',
        group: 'Update 6.0',
        tab: 'actions',
        run: () => setReleaseModalOpen(true),
      },
      ...(isOwnerMode && !released60
        ? [
            {
              id: 'act-release-owner-now',
              label: 'Owner Override: Release Update 6.0 Right Now!',
              group: 'Update 6.0',
              tab: 'actions' as const,
              run: () => releaseNowByOwner(),
            },
          ]
        : []),
      {
        id: 'act-guide-hub',
        label: 'Tutorial: Open 12-Chapter Interactive Guide (G)',
        group: 'Tutorial & Help',
        tab: 'actions',
        run: () => setHubOpen(true),
      },
      {
        id: 'act-guide-start',
        label: 'Tutorial: Start Full Click-Through Walkthrough',
        group: 'Tutorial & Help',
        tab: 'actions',
        run: () => startFullTour(),
      },
      {
        id: 'act-guide-autoplay',
        label: 'Tutorial: Watch Hands-Free Auto-Play Tour',
        group: 'Tutorial & Help',
        tab: 'actions',
        run: () => startAutoTour(),
      },
      {
        id: 'act-help-hints',
        label: helpHintsEnabled
          ? 'Help Hints: Hide Little "i" Info Badges'
          : 'Help Hints: Show Little "i" Info Badges Everywhere',
        group: 'Tutorial & Help',
        tab: 'actions',
        run: toggleHelpHints,
      },
      ...TUTORIAL_CHAPTERS.map((ch) => ({
        id: `tut-${ch.id}`,
        label: `Tutorial Ch.${ch.number}: ${ch.title}`,
        group: 'Tutorial Chapters',
        tab: 'actions' as const,
        run: () => startChapter(ch.id),
      })),
      {
        id: 'act-keys',
        label: 'Show Keyboard Shortcuts (?)',
        group: 'Actions',
        tab: 'actions',
        run: () => setShortcutsOpen(true),
      },
      ...(['A', 'B', 'C'] as SnapshotSlotId[])
        .filter((slot) => Boolean(snapshotSlots[slot]))
        .map((slot) => ({
          id: `slot-${slot}`,
          label: `Load Snapshot Slot ${slot}: ${snapshotSlots[slot]?.name}`,
          group: 'Snapshots',
          tab: 'actions' as const,
          run: () => {
            const targetScene = loadSnapshotSlot(slot);
            if (targetScene) onSelectScene(targetScene);
          },
        })),
      ...(
        [
          ['neo-arcade', 'Skin: Broadcast Neo-Arcade'],
          ['obsidian', 'Skin: Studio Obsidian'],
          ['scoreboard', 'Skin: Championship Scoreboard'],
          ['swiss', 'Skin: Swiss Sports Daylight'],
        ] as Array<[HudSkin, string]>
      ).map(([id, label]) => ({
        id: `skin-${id}`,
        label,
        group: 'Skins',
        tab: 'themes' as const,
        run: () => updatePrefs({ skin: id }),
      })),
      ...(
        [
          ['ambient', 'Frame: Ambient Scene Glow'],
          ['gradient', 'Frame: Preset Tinted Studio'],
          ['obsidian', 'Frame: Matte Obsidian Vignette'],
          ['grid', 'Frame: Architectural Studio Grid'],
        ] as Array<[StageSurround, string]>
      ).map(([id, label]) => ({
        id: `surround-${id}`,
        label,
        group: 'Stage Frames',
        tab: 'themes' as const,
        run: () => updatePrefs({ surround: id }),
      })),
      ...COLOR_PRESETS.map((p) => ({
        id: `preset-${p.id}`,
        label: `Theme: ${p.name} (${p.category})`,
        group: '79 Presets',
        tab: 'themes' as const,
        run: () => selectPreset(p.id, activeScene),
      })),
    ];

    const byTab =
      activeTab === 'all' ? base : base.filter((item) => item.tab === activeTab);

    const q = query.trim().toLowerCase();
    const filtered = !q
      ? byTab
      : byTab.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q)
        );

    if (!q && recentIds.length > 0 && activeTab === 'all') {
      const recentSet = new Set(recentIds);
      const recents = recentIds
        .map((id) => filtered.find((item) => item.id === id))
        .filter((x): x is CommandItem => Boolean(x))
        .map((item) => ({ ...item, group: 'Recent' }));
      const rest = filtered.filter((item) => !recentSet.has(item.id));
      return [...recents, ...rest];
    }

    return filtered;
  }, [
    activeScene,
    activeTab,
    applyPcMatchPreset,
    applySoundMood,
    hardwareProfile.bottlenecks,
    hardwareProfile.gpuShortName,
    hardwareProfile.measuredHz,
    helpHintsEnabled,
    isOwnerMode,
    loadSnapshotSlot,
    onCaptureScreenshot,
    onSelectScene,
    onToggleFullscreen,
    onToggleGlobalAuto,
    prefs.rainMuted,
    prefs.rainVolume,
    prefs.sfxStyle,
    prefs.tourEnabled,
    query,
    randomizePreset,
    recentIds,
    releaseNowByOwner,
    released60,
    selectPreset,
    setDrawerOpen,
    setDrawerTab,
    setHubOpen,
    setReleaseModalOpen,
    setShortcutsOpen,
    setSoundEnabledState,
    setZenMode,
    snapshotSlots,
    soundEnabled,
    startAutoTour,
    startChapter,
    startFullTour,
    toggleHelpHints,
    toggleSound,
    updatePrefs,
  ]);

  // Keep active keyboard selection visible inside scroll area
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, items.length]);

  const executeItem = (item: CommandItem) => {
    item.run();
    setRecentIds((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 4));
    setPaletteOpen(false);
  };

  if (!paletteOpen) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 flex items-start justify-center bg-black/70 pt-14"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Studio Command Palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            setPaletteOpen(false);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => (items.length === 0 ? 0 : Math.min(items.length - 1, i + 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter' && items[selectedIndex]) {
            e.preventDefault();
            executeItem(items[selectedIndex]);
          }
        }}
        className="w-[490px] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-white/15 bg-slate-950/96 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to scene, planet, biome, 79 themes, or action..."
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setPaletteOpen(false)}
            aria-label="Close command palette"
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-white/10 px-3 py-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'scenes', label: 'Scenes & Jumps' },
              { id: 'themes', label: 'Themes & Skins' },
              { id: 'actions', label: 'Actions' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedIndex(0);
              }}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors"
              style={
                activeTab === tab.id
                  ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                  : { color: '#94a3b8' }
              }
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto font-mono-num text-[10px] text-slate-400">
            {items.length} items
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              No matching commands or presets.
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => executeItem(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors"
                style={
                  idx === selectedIndex
                    ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                    : undefined
                }
              >
                <span className="flex items-center gap-2 font-medium">
                  <Command className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                <span className="ml-2 shrink-0 font-mono-num text-[10px] opacity-75">
                  {item.group}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
