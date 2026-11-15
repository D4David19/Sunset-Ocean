import {
  Box,
  Camera,
  CloudRain,
  Compass,
  Cpu,
  Flame,
  Gauge,
  Layers,
  Orbit,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  Wand2,
  X,
} from 'lucide-react';
import {
  SCENE_META,
  useStudio,
  type QualityTier,
  type SandboxPresetId,
} from '../../context/StudioContext';
import {
  SHADER_MOOD_META,
  type ShaderMood,
  type WeatherFx,
} from '../../utils/threeShaders';

const SANDBOX_PRESETS: Array<{
  id: SandboxPresetId;
  label: string;
  desc: string;
}> = [
  { id: 'default', label: 'Standard', desc: 'Balanced physics & normal speed' },
  { id: 'moon', label: 'Moon Arcade', desc: '0.38x low gravity + Neon + Free Orbit' },
  { id: 'turbo', label: 'Hyper Turbo', desc: '1.6x speed, fireball hoops & super power' },
  { id: 'chill', label: 'Kid Chill', desc: 'Invincible Temple + Giant Birds + Mist' },
  { id: 'photo', label: 'Cinema Photo', desc: '0.4x slow-mo + Free Orbit + Warm Film' },
];

const QUALITY_OPTIONS: Array<{ id: QualityTier; label: string; hint: string }> = [
  { id: 'potato', label: 'Potato', hint: '0.65x scale · Zero shadows · Max FPS' },
  { id: 'eco', label: 'Eco', hint: '0.85x scale · Fast shaders' },
  { id: 'auto', label: 'Auto', hint: 'Hardware matched' },
  { id: 'balanced', label: 'Balanced', hint: 'Smooth crisp visuals' },
  { id: 'high', label: 'High', hint: 'Full shadows & reflections' },
];

const WEATHER_OPTIONS: Array<{ id: WeatherFx; label: string }> = [
  { id: 'clear', label: 'Clear' },
  { id: 'mist', label: 'Mist' },
  { id: 'rain', label: 'Rain' },
  { id: 'embers', label: 'Embers' },
];

export default function SandboxDrawer() {
  const {
    prefs,
    activePreset,
    activeScene,
    sandboxOpen,
    setSandboxOpen,
    updatePrefs,
    applySandboxPreset,
  } = useStudio();

  if (!sandboxOpen) return null;

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

  return (
    <aside
      aria-label="Player Freedom Sandbox and Shaders Drawer"
      data-tour-id="sandbox-drawer"
      style={panelStyle}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute top-14 right-2 bottom-16 left-2 z-40 flex flex-col overflow-hidden rounded-xl border shadow-2xl sm:top-13 sm:right-3 sm:bottom-16 sm:left-auto sm:w-[392px] sm:max-w-[calc(100%-1.5rem)]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: panelStyle.borderColor }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${activePreset.accent}24`, color: activePreset.accent }}
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold">Freedom Sandbox</h2>
            <p className="text-[11px]" style={{ color: mutedColor }}>
              {SCENE_META[activeScene].label} · 3D Shaders &amp; Physics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applySandboxPreset('default')}
            title="Reset all sandbox tweaks to default"
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium hover:bg-white/10"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setSandboxOpen(false)}
            aria-label="Close Sandbox drawer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5">
        {/* Render Mode (Enhanced 3D <-> Classic 2D) & Auto-Switch Presets */}
        <section
          className="space-y-2.5 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              {prefs.renderMode === '2d' ? (
                <Layers className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              ) : (
                <Box className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              )}
              <span>World Engine (3D ↔ Classic 2D)</span>
            </span>
            <span className="font-mono-num text-[10px]" style={{ color: mutedColor }}>
              Key V
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-black/15 p-1">
            {(
              [
                { id: '3d', label: 'Enhanced 3D' },
                { id: '2d', label: 'Classic 2D Art' },
              ] as const
            ).map((opt) => {
              const selected = prefs.renderMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePrefs({ renderMode: opt.id })}
                  className="h-7 rounded-md text-[11px] font-semibold transition-colors"
                  style={
                    selected
                      ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                      : { color: mutedColor }
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {activeScene === 'temple' && prefs.renderMode === '2d' && (
            <p className="text-[10px] text-amber-300/90">
              Temple Run is native 3D; all other 4 games switch to Classic 2D.
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium">
              <input
                type="checkbox"
                checked={prefs.presetAutoCycle}
                onChange={(e) => updatePrefs({ presetAutoCycle: e.target.checked })}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              <RefreshCw
                className={`h-3 w-3 ${prefs.presetAutoCycle ? 'animate-spin' : ''}`}
                style={{ color: activePreset.accent, animationDuration: '5s' }}
                aria-hidden="true"
              />
              <span>Auto-Switch Color Presets</span>
            </label>
            <div className="flex items-center gap-0.5 rounded bg-black/20 p-0.5">
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
        </section>

        {/* 1-Click Freedom Presets */}
        <section
          className="space-y-2 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              <span>1-Click Freedom Presets</span>
            </span>
            <span className="text-[10px]" style={{ color: mutedColor }}>
              Global Mods
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SANDBOX_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applySandboxPreset(p.id)}
                title={p.desc}
                className="flex flex-col rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-white/10"
                style={{ borderColor: panelStyle.borderColor }}
              >
                <span className="text-[11px] font-semibold">{p.label}</span>
                <span className="line-clamp-1 text-[9.5px]" style={{ color: mutedColor }}>
                  {p.desc}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Potato & Performance Mode */}
        <section
          className="space-y-2 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Cpu className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              <span>Quality &amp; Ultra-Low Potato Mode</span>
            </span>
            <span className="font-mono-num text-[10px] uppercase" style={{ color: activePreset.accent }}>
              {prefs.qualityTier}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/15 p-1">
            {QUALITY_OPTIONS.map((q) => {
              const selected = prefs.qualityTier === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  title={q.hint}
                  onClick={() => updatePrefs({ qualityTier: q.id })}
                  className="h-7 rounded-md text-[10.5px] font-semibold transition-colors"
                  style={
                    selected
                      ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                      : { color: mutedColor }
                  }
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px]" style={{ color: mutedColor }}>
            {QUALITY_OPTIONS.find((q) => q.id === prefs.qualityTier)?.hint}
          </p>
        </section>

        {/* Custom GLSL Shader Moods */}
        <section
          className="space-y-2 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              <span>3D GLSL Shader Mood</span>
            </span>
            <span className="text-[10px]" style={{ color: mutedColor }}>
              {SHADER_MOOD_META[prefs.shaderMood].label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(SHADER_MOOD_META) as ShaderMood[]).map((moodKey) => {
              const meta = SHADER_MOOD_META[moodKey];
              const active = prefs.shaderMood === moodKey;
              return (
                <button
                  key={moodKey}
                  type="button"
                  onClick={() => updatePrefs({ shaderMood: moodKey })}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                  style={{
                    borderColor: active ? activePreset.accent : panelStyle.borderColor,
                    backgroundColor: active ? `${activePreset.accent}18` : undefined,
                  }}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/30"
                    style={{ backgroundColor: `#${meta.rimHex.toString(16).padStart(6, '0')}` }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold">{meta.label}</div>
                    <div className="truncate text-[9.5px]" style={{ color: mutedColor }}>
                      {meta.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Live 3D Weather & Free 3D Orbit */}
        <section
          className="space-y-2.5 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <CloudRain className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              <span>3D Weather &amp; Camera Freedom</span>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/15 p-1">
            {WEATHER_OPTIONS.map((w) => {
              const active = prefs.sandboxWeather === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => updatePrefs({ sandboxWeather: w.id })}
                  className="h-7 rounded-md text-[11px] font-medium transition-colors"
                  style={
                    active
                      ? { backgroundColor: activePreset.accent, color: activePreset.accentFg }
                      : { color: mutedColor }
                  }
                >
                  {w.label}
                </button>
              );
            })}
          </div>

          <label
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <span className="inline-flex items-center gap-2">
              <Orbit className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              <span>
                <span className="block font-semibold">Free 3D Orbit Camera</span>
                <span className="block text-[10px]" style={{ color: mutedColor }}>
                  Drag to look around · Scroll to zoom · Double-click reset
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.sandboxFreeOrbit}
              onChange={(e) => updatePrefs({ sandboxFreeOrbit: e.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </section>

        {/* Global Physics & Time Sliders */}
        <section
          className="space-y-2.5 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Gauge className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
            <span>Global Physics &amp; Time Lab</span>
          </div>

          <label className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: mutedColor }}>Gravity Scale</span>
              <span className="font-mono-num font-semibold">
                {prefs.sandboxGravityScale.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.25}
              max={2.0}
              step={0.05}
              value={prefs.sandboxGravityScale}
              onChange={(e) =>
                updatePrefs({ sandboxGravityScale: parseFloat(e.target.value) })
              }
              className="studio-range h-1.5 w-full cursor-pointer"
            />
          </label>

          <label className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: mutedColor }}>Time Scale (Slow-Mo → Turbo)</span>
              <span className="font-mono-num font-semibold">
                {prefs.sandboxTimeScale.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={0.25}
              max={2.0}
              step={0.05}
              value={prefs.sandboxTimeScale}
              onChange={(e) =>
                updatePrefs({ sandboxTimeScale: parseFloat(e.target.value) })
              }
              className="studio-range h-1.5 w-full cursor-pointer"
            />
          </label>
        </section>

        {/* Per-Scene Freedom Controls */}
        <section
          className="space-y-2.5 rounded-lg border p-3"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Compass className="h-3.5 w-3.5" style={{ color: activePreset.accent }} aria-hidden="true" />
              <span>World Freedom Modifiers</span>
            </span>
            <span className="text-[10px]" style={{ color: mutedColor }}>
              All 5 Scenes
            </span>
          </div>

          {/* Temple Run */}
          <label
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <span className="inline-flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>
                <span className="block text-[11px] font-semibold">Temple Run: Invincible Chill</span>
                <span className="block text-[10px]" style={{ color: mutedColor }}>
                  Smash obstacles &amp; bounce out of chasms
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.sandboxTempleInvincible}
              onChange={(e) => updatePrefs({ sandboxTempleInvincible: e.target.checked })}
              className="h-4 w-4 accent-emerald-400"
            />
          </label>

          {/* Angry Birds */}
          <div
            className="space-y-2 rounded-lg border p-2.5"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>Angry Birds Freedom</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-normal">
                <span style={{ color: mutedColor }}>Giant Birds (1.5×)</span>
                <input
                  type="checkbox"
                  checked={prefs.sandboxGiantBirds}
                  onChange={(e) => updatePrefs({ sandboxGiantBirds: e.target.checked })}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span style={{ color: mutedColor }}>Slingshot Launch Power</span>
                <span className="font-mono-num font-semibold">
                  {prefs.sandboxBirdsPower.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={2.0}
                step={0.05}
                value={prefs.sandboxBirdsPower}
                onChange={(e) =>
                  updatePrefs({ sandboxBirdsPower: parseFloat(e.target.value) })
                }
                className="studio-range h-1.5 w-full cursor-pointer"
              />
            </label>
          </div>

          {/* All-Star Hoops */}
          <div
            className="space-y-2 rounded-lg border p-2.5"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>All-Star Hoops Freedom</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-normal">
                <span style={{ color: mutedColor }}>Always Fireball</span>
                <input
                  type="checkbox"
                  checked={prefs.sandboxHoopsFireball}
                  onChange={(e) => updatePrefs({ sandboxHoopsFireball: e.target.checked })}
                  className="h-3.5 w-3.5 accent-orange-400"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span style={{ color: mutedColor }}>Moving Hoop Speed</span>
                <span className="font-mono-num font-semibold">
                  {prefs.sandboxHoopsSpeed.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.0}
                step={0.05}
                value={prefs.sandboxHoopsSpeed}
                onChange={(e) =>
                  updatePrefs({ sandboxHoopsSpeed: parseFloat(e.target.value) })
                }
                className="studio-range h-1.5 w-full cursor-pointer"
              />
            </label>
          </div>

          {/* Coastline Tour */}
          <div
            className="space-y-1.5 rounded-lg border p-2.5"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <div className="text-[11px] font-semibold">Coastline Tour Boost</div>
            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span style={{ color: mutedColor }}>Pedal Speed Multiplier</span>
                <span className="font-mono-num font-semibold">
                  {prefs.sandboxCoastlineBoost.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={prefs.sandboxCoastlineBoost}
                onChange={(e) =>
                  updatePrefs({ sandboxCoastlineBoost: parseFloat(e.target.value) })
                }
                className="studio-range h-1.5 w-full cursor-pointer"
              />
            </label>
          </div>

          {/* Solar Horizon */}
          <div
            className="space-y-2 rounded-lg border p-2.5"
            style={{ borderColor: panelStyle.borderColor }}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1">
                <Sun className="h-3 w-3 text-amber-400" aria-hidden="true" />
                <span>Solar Horizon Sculptor</span>
              </span>
              {prefs.sandboxSolarElevation !== null && (
                <button
                  type="button"
                  onClick={() => updatePrefs({ sandboxSolarElevation: null })}
                  className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-white/10"
                  style={{ borderColor: panelStyle.borderColor }}
                >
                  Auto Cycle
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span style={{ color: mutedColor }}>Sun Elevation Lock</span>
                <span className="font-mono-num font-semibold">
                  {prefs.sandboxSolarElevation === null
                    ? 'Auto'
                    : `${Math.round(prefs.sandboxSolarElevation * 100)}°`}
                </span>
              </div>
              <input
                type="range"
                min={-0.08}
                max={0.45}
                step={0.01}
                value={prefs.sandboxSolarElevation ?? 0.12}
                onChange={(e) =>
                  updatePrefs({ sandboxSolarElevation: parseFloat(e.target.value) })
                }
                className="studio-range h-1.5 w-full cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span style={{ color: mutedColor }}>3D Wave Chop</span>
                <span className="font-mono-num font-semibold">
                  {prefs.sandboxWaveChop.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.0}
                step={0.05}
                value={prefs.sandboxWaveChop}
                onChange={(e) =>
                  updatePrefs({ sandboxWaveChop: parseFloat(e.target.value) })
                }
                className="studio-range h-1.5 w-full cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Camera hint */}
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]"
          style={{ borderColor: panelStyle.borderColor, color: mutedColor }}
        >
          <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Tip: Press B anytime to open/close Freedom Sandbox.</span>
        </div>
      </div>
    </aside>
  );
}
