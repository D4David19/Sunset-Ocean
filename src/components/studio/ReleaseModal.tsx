import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Crown,
  History,
  Layers,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  formatCountdown,
  RELEASE_6_HIGHLIGHTS,
  useRelease,
} from '../../context/ReleaseContext';
import { useStudio } from '../../context/StudioContext';
import {
  STUDIO_MOTTO,
  UPDATE_LOGS,
  V6_TWENTY_FIVE_FEATURES,
  type Feature25Item,
} from '../../data/updateLogs';

type ReleaseTab = 'changelog' | 'features25' | 'timer';
type LogFilter = 'all' | 'added' | 'changed' | 'redesigned' | 'removed';
type FeatureCategoryFilter = 'All' | Feature25Item['category'];

function defaultLocalDatetimeInput(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function ReleaseModal() {
  const {
    released60,
    isOwnerMode,
    toggleOwnerMode,
    timerStatus,
    remainingMs,
    releasedAtIso,
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
  } = useRelease();
  const { notify } = useStudio();

  const [activeTab, setActiveTab] = useState<ReleaseTab>('changelog');
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [logSearch, setLogSearch] = useState('');
  const [featureFilter, setFeatureFilter] = useState<FeatureCategoryFilter>('All');

  const [customMinutes, setCustomMinutes] = useState(2);
  const [customSeconds, setCustomSeconds] = useState(0);
  const [targetDatetime, setTargetDatetime] = useState<string>(defaultLocalDatetimeInput);

  useEffect(() => {
    if (!releaseModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setReleaseModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [releaseModalOpen, setReleaseModalOpen]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return UPDATE_LOGS.map((entry) => {
      const matchText = (items: string[]) =>
        q ? items.filter((i) => i.toLowerCase().includes(q)) : items;

      const added = logFilter === 'all' || logFilter === 'added' ? matchText(entry.added) : [];
      const changed = logFilter === 'all' || logFilter === 'changed' ? matchText(entry.changed) : [];
      const redesigned =
        logFilter === 'all' || logFilter === 'redesigned' ? matchText(entry.redesigned) : [];
      const removed = logFilter === 'all' || logFilter === 'removed' ? matchText(entry.removed) : [];

      const headerMatches =
        !q ||
        entry.version.toLowerCase().includes(q) ||
        entry.title.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q);

      const hasAnyItems =
        added.length + changed.length + redesigned.length + removed.length > 0;

      if (!hasAnyItems && !(headerMatches && logFilter === 'all')) {
        return null;
      }

      return {
        ...entry,
        added,
        changed,
        redesigned,
        removed,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [logFilter, logSearch]);

  const filteredFeatures25 = useMemo(() => {
    if (featureFilter === 'All') return V6_TWENTY_FIVE_FEATURES;
    return V6_TWENTY_FIVE_FEATURES.filter((f) => f.category === featureFilter);
  }, [featureFilter]);

  return (
    <>
      {/* Celebratory Live 6.0 Toast-Banner when timer hits 0 or Owner launches */}
      {justReleasedCelebration && !releaseModalOpen && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(7, 13, 28, 0.96)',
            borderColor: 'rgba(52, 211, 153, 0.65)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 32px rgba(16, 185, 129, 0.25)',
          }}
          className="pointer-events-auto fixed top-16 left-1/2 z-[108] flex w-[460px] max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-slate-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/20 text-emerald-300">
              <Rocket className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white">
                Update 6.0 Is Now Live!
              </div>
              <div className="text-[11px] text-emerald-200/90">
                Full 3D worlds, 3D mountains, GLSL shaders, Potato mode &amp; 25 features unlocked!
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                dismissCelebration();
                setReleaseModalOpen(true);
              }}
              className="h-7 rounded-lg bg-emerald-400 px-2.5 text-[11px] font-bold text-slate-950 hover:brightness-110"
            >
              Details
            </button>
            <button
              type="button"
              onClick={dismissCelebration}
              aria-label="Dismiss 6.0 celebration"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!releaseModalOpen ? null : (
        <div
          onClick={() => setReleaseModalOpen(false)}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed inset-0 z-[112] flex items-center justify-center bg-slate-950/78 p-2.5 sm:p-4"
        >
          <div
            role="dialog"
            aria-label="Update 6.0 Log, 25 Features and Release Timer"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(7, 12, 26, 0.98)',
              borderColor: released60 ? 'rgba(52, 211, 153, 0.5)' : 'rgba(251, 191, 36, 0.45)',
              boxShadow:
                '0 28px 80px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
            className="flex max-h-[92dvh] w-[820px] max-w-full flex-col overflow-hidden rounded-2xl border text-slate-100"
          >
            {/* Top accent strip */}
            <div
              aria-hidden="true"
              className="h-1 w-full"
              style={{
                background: released60
                  ? 'linear-gradient(90deg, #10b981, #38bdf8, #34d399)'
                  : 'linear-gradient(90deg, #f59e0b, #fbbf24, #38bdf8)',
              }}
            />

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    released60
                      ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                      : 'border-amber-400/45 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {released60 ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold tracking-tight text-white">
                      {released60 ? 'Update 6.0 Live · Release Hub' : 'Update 6.0 Release Hub'}
                    </h2>
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300">
                      {released60 ? 'v6.0 ACTIVE' : formatCountdown(remainingMs)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-sky-300/90">
                    “{STUDIO_MOTTO}”
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleOwnerMode}
                  aria-pressed={isOwnerMode}
                  title="Switch between Owner Controls and Visitor Preview"
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                    isOwnerMode
                      ? 'border-amber-400/55 bg-amber-500/20 text-amber-200'
                      : 'border-white/15 bg-white/6 text-slate-300 hover:bg-white/12'
                  }`}
                >
                  <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{isOwnerMode ? 'Owner Mode' : 'Visitor View'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReleaseModalOpen(false)}
                  aria-label="Close release modal"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* 3 Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-white/[0.02] px-5 py-2">
              {(
                [
                  { id: 'changelog', label: 'Updates Log (v1.0–v6.0)', icon: History },
                  { id: 'features25', label: '25 New Features', icon: Layers },
                  { id: 'timer', label: 'Release Timer & Owner', icon: Clock },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {activeTab === 'changelog' && (
                <div className="space-y-4">
                  {/* Filter Pills & Search */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'added', label: 'Added' },
                          { id: 'changed', label: 'Changed' },
                          { id: 'redesigned', label: 'Redesigned' },
                          { id: 'removed', label: 'Removed' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setLogFilter(f.id)}
                          className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${
                            logFilter === f.id
                              ? 'bg-sky-400 text-slate-950'
                              : 'border border-white/12 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[200px] flex-1 sm:max-w-[240px]">
                      <Search
                        className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="Filter update notes..."
                        className="h-7.5 w-full rounded-lg border border-white/15 bg-black/30 pr-2.5 pl-8 text-xs text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Version Entries */}
                  <div className="space-y-3.5">
                    {filteredLogs.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-slate-400">
                        No update log items match your current filter.
                      </div>
                    ) : (
                      filteredLogs.map((entry) => (
                        <article
                          key={entry.version}
                          className="space-y-3 rounded-xl border border-white/12 bg-white/[0.03] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="rounded-md bg-emerald-400/20 px-2 py-0.5 font-mono-num text-xs font-bold text-emerald-300">
                                {entry.version}
                              </span>
                              <h3 className="font-display text-sm font-bold text-white">
                                {entry.title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-slate-400">
                              <span className="rounded border border-white/12 px-1.5 py-0.5 text-slate-300">
                                {entry.tag}
                              </span>
                              <span>{entry.date}</span>
                            </div>
                          </div>

                          <p className="text-xs leading-relaxed text-slate-300">
                            {entry.summary}
                          </p>

                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {entry.added.length > 0 && (
                              <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] p-2.5">
                                <div className="mb-1 text-[10.5px] font-bold tracking-wider text-emerald-300 uppercase">
                                  Added ({entry.added.length})
                                </div>
                                <ul className="space-y-1 text-[11px] leading-snug text-slate-200">
                                  {entry.added.map((line) => (
                                    <li key={line}>• {line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {entry.changed.length > 0 && (
                              <div className="rounded-lg border border-sky-400/25 bg-sky-500/[0.06] p-2.5">
                                <div className="mb-1 text-[10.5px] font-bold tracking-wider text-sky-300 uppercase">
                                  Changed ({entry.changed.length})
                                </div>
                                <ul className="space-y-1 text-[11px] leading-snug text-slate-200">
                                  {entry.changed.map((line) => (
                                    <li key={line}>• {line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {entry.redesigned.length > 0 && (
                              <div className="rounded-lg border border-purple-400/25 bg-purple-500/[0.06] p-2.5">
                                <div className="mb-1 text-[10.5px] font-bold tracking-wider text-purple-300 uppercase">
                                  Redesigned ({entry.redesigned.length})
                                </div>
                                <ul className="space-y-1 text-[11px] leading-snug text-slate-200">
                                  {entry.redesigned.map((line) => (
                                    <li key={line}>• {line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {entry.removed.length > 0 && (
                              <div className="rounded-lg border border-rose-400/25 bg-rose-500/[0.06] p-2.5">
                                <div className="mb-1 text-[10.5px] font-bold tracking-wider text-rose-300 uppercase">
                                  Removed ({entry.removed.length})
                                </div>
                                <ul className="space-y-1 text-[11px] leading-snug text-slate-200">
                                  {entry.removed.map((line) => (
                                    <li key={line}>• {line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'features25' && (
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          'All',
                          '3D Worlds',
                          'Shaders & Speed',
                          'Freedom Sandbox',
                          'UI & Log',
                        ] as FeatureCategoryFilter[]
                      ).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFeatureFilter(cat)}
                          className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${
                            featureFilter === cat
                              ? 'bg-emerald-400 text-slate-950'
                              : 'border border-white/12 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <span className="font-mono-num text-[11px] text-slate-400">
                      Showing {filteredFeatures25.length} / 25 features
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {filteredFeatures25.map((feat) => (
                      <div
                        key={feat.num}
                        className="flex items-start gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] p-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 font-mono-num text-[11px] font-bold text-emerald-300">
                          {feat.num}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{feat.title}</span>
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold text-sky-300/85">
                            {feat.category}
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-slate-300">
                            {feat.summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'timer' && (
                <div className="space-y-4">
                  {/* Live Countdown Readout + Owner Instant Launch */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">
                        {timerStatus === 'released'
                          ? `Active Build${
                              releasedAtIso
                                ? ` · Released ${new Date(releasedAtIso).toLocaleTimeString()}`
                                : ''
                            }`
                          : timerStatus === 'counting'
                            ? 'Time Until 6.0 Auto-Release'
                            : timerStatus === 'paused'
                              ? 'Countdown Paused'
                              : 'No Timer Scheduled Yet'}
                      </div>
                      <div
                        className={`font-mono-num mt-1 text-3xl font-bold tracking-tight ${
                          released60
                            ? 'text-emerald-300'
                            : timerStatus === 'counting'
                              ? 'text-amber-300'
                              : 'text-white'
                        }`}
                      >
                        {released60
                          ? 'v6.0 LIVE'
                          : timerStatus === 'unscheduled'
                            ? '00:00'
                            : formatCountdown(remainingMs)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {timerStatus === 'counting' && (
                        <button
                          type="button"
                          onClick={pauseTimer}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 text-xs font-semibold text-slate-200 hover:bg-white/15"
                        >
                          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Pause</span>
                        </button>
                      )}
                      {timerStatus === 'paused' && (
                        <button
                          type="button"
                          onClick={resumeTimer}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/20 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          <span>Resume</span>
                        </button>
                      )}
                      {(timerStatus === 'counting' || timerStatus === 'paused') && (
                        <button
                          type="button"
                          onClick={cancelTimer}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Cancel</span>
                        </button>
                      )}

                      {isOwnerMode && !released60 && (
                        <button
                          type="button"
                          onClick={() => {
                            releaseNowByOwner();
                            notify('Owner Release!', 'Update 6.0 launched right away!');
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-400 px-4 text-xs font-bold text-slate-950 shadow-md transition-transform hover:brightness-110 active:scale-95"
                        >
                          <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Release 6.0 Now (Owner)</span>
                        </button>
                      )}

                      {isOwnerMode && released60 && (
                        <button
                          type="button"
                          onClick={() => {
                            rollbackPre6ByOwner();
                            notify('Rolled Back to Pre-6.0', 'Set a new timer whenever you want!');
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-3.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Reset &amp; Test Timer Again</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Owner Scheduler Panel */}
                  {isOwnerMode && (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Choose When to Release 6.0
                        </span>
                        <span className="text-[11px] text-amber-300/90">
                          Owner Controls
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '10s Demo', sec: 10 },
                          { label: '30s', sec: 30 },
                          { label: '1 Min', sec: 60 },
                          { label: '5 Min', sec: 300 },
                          { label: '15 Min', sec: 900 },
                          { label: '1 Hour', sec: 3600 },
                        ].map((preset) => (
                          <button
                            key={preset.sec}
                            type="button"
                            onClick={() => {
                              scheduleInSeconds(preset.sec);
                              notify(
                                '6.0 Countdown Started',
                                `Releasing automatically in ${preset.label}`
                              );
                            }}
                            className="h-8 rounded-lg border border-white/15 bg-white/6 px-3 font-mono-num text-xs font-semibold text-slate-100 transition-colors hover:border-amber-400/60 hover:bg-amber-500/15"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid gap-3 pt-1 sm:grid-cols-2">
                        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/25 p-2.5">
                          <label className="flex flex-1 flex-col gap-1 text-[10.5px] text-slate-300">
                            <span>Minutes</span>
                            <input
                              type="number"
                              min={0}
                              max={1440}
                              value={customMinutes}
                              onChange={(e) =>
                                setCustomMinutes(Math.max(0, Number(e.target.value) || 0))
                              }
                              className="h-8 w-full rounded-lg border border-white/15 bg-slate-900 px-2 font-mono-num text-xs text-white focus:border-amber-400 focus:outline-none"
                            />
                          </label>
                          <label className="flex flex-1 flex-col gap-1 text-[10.5px] text-slate-300">
                            <span>Seconds</span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={customSeconds}
                              onChange={(e) =>
                                setCustomSeconds(
                                  Math.min(59, Math.max(0, Number(e.target.value) || 0))
                                )
                              }
                              className="h-8 w-full rounded-lg border border-white/15 bg-slate-900 px-2 font-mono-num text-xs text-white focus:border-amber-400 focus:outline-none"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const total = customMinutes * 60 + customSeconds;
                              if (total <= 0) {
                                releaseNowByOwner();
                                return;
                              }
                              scheduleInSeconds(total);
                              notify(
                                'Custom 6.0 Timer Set',
                                `Dropping in ${formatCountdown(total * 1000)}`
                              );
                            }}
                            className="h-8 shrink-0 rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-950 hover:brightness-110"
                          >
                            Start
                          </button>
                        </div>

                        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/25 p-2.5">
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10.5px] text-slate-300">
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3 w-3 text-sky-300" aria-hidden="true" />
                              <span>Exact Date &amp; Time</span>
                            </span>
                            <input
                              type="datetime-local"
                              value={targetDatetime}
                              onChange={(e) => setTargetDatetime(e.target.value)}
                              className="h-8 w-full rounded-lg border border-white/15 bg-slate-900 px-2 font-mono-num text-[11px] text-white focus:border-sky-400 focus:outline-none"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const ms = new Date(targetDatetime).getTime();
                              if (Number.isNaN(ms)) return;
                              scheduleAtTimestamp(ms);
                              notify(
                                '6.0 Scheduled',
                                `Set for ${new Date(ms).toLocaleString()}`
                              );
                            }}
                            className="h-8 shrink-0 rounded-lg bg-sky-400 px-3 text-xs font-bold text-slate-950 hover:brightness-110"
                          >
                            Schedule
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Core Highlights */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                        <Sparkles
                          className={`h-3.5 w-3.5 ${
                            released60 ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                          aria-hidden="true"
                        />
                        <span>
                          {released60
                            ? 'Unlocked in Update 6.0'
                            : 'What Drops When 6.0 Releases'}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {released60 ? 'All upgrades live' : 'Auto-unlocks at 00:00'}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {RELEASE_6_HIGHLIGHTS.map((item) => (
                        <div
                          key={item.area}
                          className={`rounded-xl border p-2.5 ${
                            released60
                              ? 'border-emerald-400/35 bg-emerald-500/8'
                              : 'border-white/10 bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{item.area}</span>
                            <span
                              className={`text-[10px] font-semibold ${
                                released60 ? 'text-emerald-300' : 'text-amber-300/80'
                              }`}
                            >
                              {released60 ? 'LIVE' : '6.0'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-slate-300">
                            {item.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
