import { X } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';

export default function ShortcutsModal() {
  const { shortcutsOpen, setShortcutsOpen, activePreset } = useStudio();
  if (!shortcutsOpen) return null;

  const groups = [
    {
      title: 'Studio & Navigation',
      rows: [
        ['1 – 5', 'Switch between the 5 3D worlds'],
        ['V', 'Toggle Enhanced 3D ↔ Classic 2D View'],
        ['B', 'Open / Close Freedom Sandbox & Shaders'],
        ['C', 'Open Studio Drawer (Themes, Tour, PC Tune, Audio, Tools)'],
        ['U', 'Open Updates Log (v1.0–v6.0), 25 Features & Timer'],
        ['G', 'Open Interactive Tutorial & Chapters Guide'],
        ['Cmd / Ctrl + K', 'Open Command Palette (Scenes, Planets, Shaders, Themes)'],
        ['Shift + X', 'Instant Random Color Preset'],
        ['Alt + [ / ]', 'Cycle Previous / Next Theme'],
        ['A', 'Toggle All Auto / Manual'],
        ['T', 'Arm / Disarm Idle Auto Tour'],
        ['[ / ]', 'Previous / Next Scene in Tour'],
        ['H  (Hold Alt)', 'Hide UI / Zen Mode (Hold Alt to Peek)'],
        ['F', 'Toggle Fullscreen'],
        ['P  (Cmd+Shift+S)', 'Save PNG Stage Screenshot'],
        ['M', 'Mute / Unmute Sound'],
        ['?', 'Open this Shortcuts Guide'],
      ],
    },
    {
      title: 'Gameplay Controls (Manual Mode)',
      rows: [
        ['Temple Run 6.0', 'A/D lanes · W/Space jump & Triple Vault · Hold S/Down slide'],
        ['Solar Horizon 3D', 'Drag Manual Sky or launch J2000 Space View · Click planets'],
        ['Coastline Tour 3D', 'Click OR tap Space rapidly · W/Up Wheelie · 4 3D Cameras'],
        ['Angry Birds 3D', 'Drag / Rapid-Click · Space/Right-Click ability · Q bird · Shift+1..6'],
        ['All-Star Hoops 3D', 'Click/drag court to shoot · A/D move · 4 3D Camera Angles'],
      ],
    },
  ];

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/72 p-4"
      onClick={() => setShortcutsOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts guide"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-[620px] max-w-full rounded-xl border border-white/15 bg-slate-950/96 p-5 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold">Keyboard &amp; Play Controls</h2>
            <p className="text-xs text-slate-400">
              Typing in search boxes automatically blocks single-letter hotkeys
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsOpen(false)}
            aria-label="Close shortcuts dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-2">
              <h3
                className="font-display text-xs font-semibold tracking-wide"
                style={{ color: activePreset.accent }}
              >
                {g.title}
              </h3>
              <div className="flex flex-col gap-1.5">
                {g.rows.map(([key, desc]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-2 border-b border-white/6 pb-1 text-[11px]"
                  >
                    <span className="font-mono-num shrink-0 font-semibold text-white">
                      {key}
                    </span>
                    <span className="text-right text-slate-300">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
