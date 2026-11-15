export type PresetCategory =
  | 'Championship Courts'
  | 'Coastal & Sunset'
  | 'Alpine & Forest'
  | 'Cosmic & Obsidian'
  | 'Warm Editorial'
  | 'Retro Arcade'
  | 'Pastel Studio'
  | 'Monochrome Ink';

export interface ColorPreset {
  id: string;
  name: string;
  category: PresetCategory;
  isLight: boolean;
  accent: string;
  accentFg: string;
  hudBg: string;
  hudSurface: string;
  hudBorder: string;
  hudText: string;
  hudMuted: string;
  stageGlow: string;
  surroundA: string;
  surroundB: string;
  canvasFilter: string;
  release6Only?: boolean;
}

interface PresetSeed {
  id: string;
  name: string;
  category: PresetCategory;
  accent: string;
  accentFg?: string;
  isLight?: boolean;
  hudTint?: string;
  surroundA: string;
  surroundB: string;
  glow?: string;
  canvasFilter?: string;
  release6Only?: boolean;
}

function buildPreset(seed: PresetSeed): ColorPreset {
  const light = Boolean(seed.isLight);
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    isLight: light,
    accent: seed.accent,
    accentFg: seed.accentFg ?? (light ? '#ffffff' : '#090d16'),
    hudBg:
      seed.hudTint ??
      (light ? 'rgba(248, 250, 252, 0.88)' : 'rgba(10, 14, 26, 0.84)'),
    hudSurface: light ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.08)',
    hudBorder: light ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.15)',
    hudText: light ? '#0f172a' : '#f8fafc',
    hudMuted: light ? '#475569' : '#94a3b8',
    stageGlow: seed.glow ?? `${seed.accent}38`,
    surroundA: seed.surroundA,
    surroundB: seed.surroundB,
    canvasFilter: seed.canvasFilter ?? 'none',
    release6Only: seed.release6Only,
  };
}

const SEEDS: PresetSeed[] = [
  // 1. Championship Courts (10)
  { id: 'arena-gold', name: 'Arena Gold', category: 'Championship Courts', accent: '#fbbf24', surroundA: '#080c18', surroundB: '#181424' },
  { id: 'hardwood-classic', name: 'Hardwood Classic', category: 'Championship Courts', accent: '#f59e0b', surroundA: '#130c07', surroundB: '#26170d', canvasFilter: 'saturate(1.06) contrast(1.02)' },
  { id: 'boston-parquet', name: 'Boston Parquet', category: 'Championship Courts', accent: '#22c55e', surroundA: '#06140c', surroundB: '#0f271a', canvasFilter: 'saturate(1.05)' },
  { id: 'showtime-royal', name: 'Showtime Royal', category: 'Championship Courts', accent: '#facc15', surroundA: '#140c24', surroundB: '#24143c' },
  { id: 'msg-knick-orange', name: 'Garden Orange', category: 'Championship Courts', accent: '#fb923c', surroundA: '#091022', surroundB: '#1e1620' },
  { id: 'miami-heat-crimson', name: 'Arena Crimson', category: 'Championship Courts', accent: '#f43f5e', accentFg: '#ffffff', surroundA: '#16070d', surroundB: '#260b16' },
  { id: 'chicago-bulls-red', name: 'Windy City Red', category: 'Championship Courts', accent: '#ef4444', accentFg: '#ffffff', surroundA: '#12080a', surroundB: '#220f12' },
  { id: 'golden-bay-blue', name: 'Bay Championship', category: 'Championship Courts', accent: '#38bdf8', surroundA: '#061224', surroundB: '#0e223d' },
  { id: 'pheonix-valley', name: 'Desert Tipoff', category: 'Championship Courts', accent: '#f97316', surroundA: '#140c1e', surroundB: '#25152a' },
  { id: 'san-antonio-silver', name: 'Alamo Silver', category: 'Championship Courts', accent: '#cbd5e1', surroundA: '#090b10', surroundB: '#181c24' },

  // 2. Coastal & Sunset (10)
  { id: 'broken-arrow-dusk', name: 'Broken Arrow Dusk', category: 'Coastal & Sunset', accent: '#fb923c', surroundA: '#170a1c', surroundB: '#2d1522', canvasFilter: 'saturate(1.08)' },
  { id: 'pacific-amber', name: 'Pacific Amber', category: 'Coastal & Sunset', accent: '#f59e0b', surroundA: '#0a1426', surroundB: '#24161e' },
  { id: 'wine-dark-sea', name: 'Wine-Dark Sea', category: 'Coastal & Sunset', accent: '#e11d48', accentFg: '#ffffff', surroundA: '#140818', surroundB: '#290f24' },
  { id: 'tangerine-tide', name: 'Tangerine Tide', category: 'Coastal & Sunset', accent: '#fb7185', surroundA: '#160b16', surroundB: '#2b1822' },
  { id: 'lagoon-teal', name: 'Lagoon Teal', category: 'Coastal & Sunset', accent: '#2dd4bf', surroundA: '#05161a', surroundB: '#0c2930' },
  { id: 'horizon-cobalt', name: 'Horizon Cobalt', category: 'Coastal & Sunset', accent: '#60a5fa', surroundA: '#071126', surroundB: '#112244' },
  { id: 'coral-harbor', name: 'Coral Harbor', category: 'Coastal & Sunset', accent: '#f472b6', surroundA: '#140c20', surroundB: '#26142c' },
  { id: 'golden-pier', name: 'Golden Pier', category: 'Coastal & Sunset', accent: '#fcd34d', surroundA: '#14101c', surroundB: '#281d22' },
  { id: 'pacific-mist', name: 'Pacific Mist', category: 'Coastal & Sunset', accent: '#38bdf8', surroundA: '#091522', surroundB: '#16283c' },
  { id: 'crimson-horizon', name: 'Crimson Horizon', category: 'Coastal & Sunset', accent: '#fb923c', surroundA: '#1a0a12', surroundB: '#33121c', canvasFilter: 'contrast(1.05) saturate(1.1)' },

  // 3. Alpine & Forest (10)
  { id: 'temple-emerald', name: 'Temple Emerald', category: 'Alpine & Forest', accent: '#34d399', surroundA: '#061410', surroundB: '#0e2820' },
  { id: 'jade-sanctuary', name: 'Jade Sanctuary', category: 'Alpine & Forest', accent: '#10b981', surroundA: '#051412', surroundB: '#0c2722' },
  { id: 'pine-ridge', name: 'Pine Ridge', category: 'Alpine & Forest', accent: '#84cc16', surroundA: '#0a1409', surroundB: '#172613' },
  { id: 'glacier-mint', name: 'Glacier Mint', category: 'Alpine & Forest', accent: '#2dd4bf', surroundA: '#07161a', surroundB: '#102930' },
  { id: 'cedar-valley', name: 'Cedar Valley', category: 'Alpine & Forest', accent: '#a3e635', surroundA: '#0d140a', surroundB: '#1c2614' },
  { id: 'moss-stone', name: 'Moss & Stone', category: 'Alpine & Forest', accent: '#4ade80', surroundA: '#0c120e', surroundB: '#18221b' },
  { id: 'summit-spruce', name: 'Summit Spruce', category: 'Alpine & Forest', accent: '#22d3ee', surroundA: '#06141a', surroundB: '#0e242e' },
  { id: 'bamboo-grove', name: 'Bamboo Grove', category: 'Alpine & Forest', accent: '#bef264', surroundA: '#0a1308', surroundB: '#192610' },
  { id: 'emerald-canopy', name: 'Emerald Canopy', category: 'Alpine & Forest', accent: '#6ee7b7', surroundA: '#061612', surroundB: '#0d2b22' },
  { id: 'fern-shadow', name: 'Fern Shadow', category: 'Alpine & Forest', accent: '#34d399', surroundA: '#08120e', surroundB: '#12221a', canvasFilter: 'saturate(1.05)' },

  // 4. Cosmic & Obsidian (10)
  { id: 'obsidian-amber', name: 'Obsidian Amber', category: 'Cosmic & Obsidian', accent: '#fbbf24', surroundA: '#05070e', surroundB: '#101420' },
  { id: 'stellar-cyan', name: 'Stellar Cyan', category: 'Cosmic & Obsidian', accent: '#22d3ee', surroundA: '#040814', surroundB: '#0c162b' },
  { id: 'nebula-indigo', name: 'Nebula Indigo', category: 'Cosmic & Obsidian', accent: '#818cf8', accentFg: '#ffffff', surroundA: '#08081c', surroundB: '#141434' },
  { id: 'lunar-slate', name: 'Lunar Slate', category: 'Cosmic & Obsidian', accent: '#e2e8f0', surroundA: '#070a12', surroundB: '#131926' },
  { id: 'pulsar-violet', name: 'Pulsar Violet', category: 'Cosmic & Obsidian', accent: '#a78bfa', surroundA: '#0b081a', surroundB: '#1a1432' },
  { id: 'deep-orbit', name: 'Deep Orbit', category: 'Cosmic & Obsidian', accent: '#38bdf8', surroundA: '#040914', surroundB: '#0b182c' },
  { id: 'solar-flare', name: 'Solar Flare', category: 'Cosmic & Obsidian', accent: '#f97316', surroundA: '#0c080a', surroundB: '#1f1210' },
  { id: 'midnight-azure', name: 'Midnight Azure', category: 'Cosmic & Obsidian', accent: '#60a5fa', surroundA: '#050a18', surroundB: '#0e1932' },
  { id: 'eclipse-ruby', name: 'Eclipse Ruby', category: 'Cosmic & Obsidian', accent: '#f43f5e', accentFg: '#ffffff', surroundA: '#0c060c', surroundB: '#1d0d18' },
  { id: 'void-platinum', name: 'Void Platinum', category: 'Cosmic & Obsidian', accent: '#f1f5f9', surroundA: '#06070a', surroundB: '#12151c' },

  // 5. Warm Editorial (10)
  { id: 'sandstone-cream', name: 'Sandstone Cream', category: 'Warm Editorial', accent: '#b45309', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(253, 250, 245, 0.90)', surroundA: '#1c1814', surroundB: '#2b241d' },
  { id: 'terracotta-warm', name: 'Terracotta Kiln', category: 'Warm Editorial', accent: '#ea580c', accentFg: '#ffffff', surroundA: '#180e0a', surroundB: '#2a1812', canvasFilter: 'sepia(0.08) saturate(1.06)' },
  { id: 'espresso-gold', name: 'Espresso Gold', category: 'Warm Editorial', accent: '#d97706', accentFg: '#ffffff', surroundA: '#140e0a', surroundB: '#241a12' },
  { id: 'linen-ink', name: 'Linen & Ink', category: 'Warm Editorial', accent: '#0f172a', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(249, 248, 244, 0.92)', surroundA: '#1a1b1f', surroundB: '#272930' },
  { id: 'copper-oak', name: 'Copper Oak', category: 'Warm Editorial', accent: '#f59e0b', surroundA: '#160f0a', surroundB: '#291c12' },
  { id: 'saffron-press', name: 'Saffron Press', category: 'Warm Editorial', accent: '#eab308', surroundA: '#141108', surroundB: '#251f10' },
  { id: 'ochre-gallery', name: 'Ochre Gallery', category: 'Warm Editorial', accent: '#92400e', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(252, 247, 238, 0.90)', surroundA: '#1d1712', surroundB: '#2e241b' },
  { id: 'mahogany-club', name: 'Mahogany Club', category: 'Warm Editorial', accent: '#fbbf24', surroundA: '#170c0a', surroundB: '#2b1612' },
  { id: 'parchment-sage', name: 'Parchment Sage', category: 'Warm Editorial', accent: '#047857', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(246, 249, 245, 0.90)', surroundA: '#121a16', surroundB: '#1d2a23' },
  { id: 'amber-atelier', name: 'Amber Atelier', category: 'Warm Editorial', accent: '#fb923c', surroundA: '#15100c', surroundB: '#281d16' },

  // 6. Retro Arcade (10)
  { id: 'crt-amber', name: 'CRT Amber', category: 'Retro Arcade', accent: '#fbbf24', surroundA: '#100c04', surroundB: '#1f1808', canvasFilter: 'contrast(1.06) saturate(1.1)' },
  { id: 'phosphor-green', name: 'Phosphor Green', category: 'Retro Arcade', accent: '#4ade80', surroundA: '#041208', surroundB: '#0a2410', canvasFilter: 'contrast(1.04)' },
  { id: 'cabinet-cyan', name: 'Cabinet Cyan', category: 'Retro Arcade', accent: '#06b6d4', surroundA: '#041018', surroundB: '#08202e' },
  { id: 'synth-sunset', name: 'Synth Sunset', category: 'Retro Arcade', accent: '#f43f5e', accentFg: '#ffffff', surroundA: '#14081c', surroundB: '#281034', canvasFilter: 'saturate(1.12)' },
  { id: 'vector-gold', name: 'Vector Gold', category: 'Retro Arcade', accent: '#facc15', surroundA: '#0c0c08', surroundB: '#1c1b10' },
  { id: 'pixel-cobalt', name: 'Pixel Cobalt', category: 'Retro Arcade', accent: '#3b82f6', accentFg: '#ffffff', surroundA: '#060c1f', surroundB: '#0f1c3d' },
  { id: 'coin-op-red', name: 'Coin-Op Red', category: 'Retro Arcade', accent: '#ef4444', accentFg: '#ffffff', surroundA: '#140709', surroundB: '#260d12' },
  { id: 'laser-lime', name: 'Laser Lime', category: 'Retro Arcade', accent: '#a3e635', surroundA: '#091206', surroundB: '#14260c' },
  { id: 'outrun-magenta', name: 'Outrun Rose', category: 'Retro Arcade', accent: '#ec4899', accentFg: '#ffffff', surroundA: '#160718', surroundB: '#2b0f2f' },
  { id: 'arcade-chrome', name: 'Arcade Chrome', category: 'Retro Arcade', accent: '#38bdf8', surroundA: '#090c12', surroundB: '#181f2c' },

  // 7. Pastel Studio (10)
  { id: 'swiss-paper', name: 'Swiss Paper', category: 'Pastel Studio', accent: '#0284c7', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(248, 250, 252, 0.92)', surroundA: '#111827', surroundB: '#1e293b' },
  { id: 'sky-chalk', name: 'Sky Chalk', category: 'Pastel Studio', accent: '#0369a1', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(240, 249, 255, 0.90)', surroundA: '#0c1926', surroundB: '#162c40' },
  { id: 'peach-cloud', name: 'Peach Cloud', category: 'Pastel Studio', accent: '#c2410c', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(255, 247, 237, 0.90)', surroundA: '#1f1410', surroundB: '#301f19' },
  { id: 'mint-cream', name: 'Mint Cream', category: 'Pastel Studio', accent: '#0f766e', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(240, 253, 250, 0.90)', surroundA: '#0d1b1a', surroundB: '#172e2c' },
  { id: 'lavender-fog', name: 'Lavender Fog', category: 'Pastel Studio', accent: '#6d28d9', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(245, 243, 255, 0.90)', surroundA: '#141024', surroundB: '#231c3d' },
  { id: 'rose-quartz', name: 'Rose Quartz', category: 'Pastel Studio', accent: '#be123c', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(255, 241, 242, 0.90)', surroundA: '#1e0e14', surroundB: '#301720' },
  { id: 'butter-studio', name: 'Butter Studio', category: 'Pastel Studio', accent: '#a16207', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(254, 252, 232, 0.90)', surroundA: '#1c190d', surroundB: '#2d2815' },
  { id: 'glacier-frost', name: 'Glacier Frost', category: 'Pastel Studio', accent: '#0e7490', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(236, 254, 255, 0.90)', surroundA: '#0b181d', surroundB: '#142932' },
  { id: 'blossom-slate', name: 'Blossom Slate', category: 'Pastel Studio', accent: '#f9a8d4', surroundA: '#12101a', surroundB: '#221b2e' },
  { id: 'pistachio-mist', name: 'Pistachio Mist', category: 'Pastel Studio', accent: '#86efac', surroundA: '#0b1410', surroundB: '#16241d' },

  // 8. Monochrome Ink (9 -> total 79!)
  { id: 'pure-onyx', name: 'Pure Onyx', category: 'Monochrome Ink', accent: '#ffffff', accentFg: '#090d16', surroundA: '#050608', surroundB: '#111318' },
  { id: 'graphite-pro', name: 'Graphite Pro', category: 'Monochrome Ink', accent: '#e2e8f0', surroundA: '#0a0c10', surroundB: '#161a22' },
  { id: 'titanium-line', name: 'Titanium Line', category: 'Monochrome Ink', accent: '#cbd5e1', surroundA: '#0d1016', surroundB: '#1c212c' },
  { id: 'chalk-broadsheet', name: 'Chalk Broadsheet', category: 'Monochrome Ink', accent: '#111827', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(255, 255, 255, 0.93)', surroundA: '#14171c', surroundB: '#22262e' },
  { id: 'silver-gelatin', name: 'Silver Gelatin', category: 'Monochrome Ink', accent: '#f8fafc', surroundA: '#09090b', surroundB: '#18181b', canvasFilter: 'contrast(1.06) saturate(0.82)' },
  { id: 'charcoal-matte', name: 'Charcoal Matte', category: 'Monochrome Ink', accent: '#94a3b8', surroundA: '#08090c', surroundB: '#14161b' },
  { id: 'newsprint-day', name: 'Newsprint Day', category: 'Monochrome Ink', accent: '#1e293b', accentFg: '#ffffff', isLight: true, hudTint: 'rgba(241, 245, 249, 0.92)', surroundA: '#161920', surroundB: '#242933' },
  { id: 'noir-cinema', name: 'Noir Cinema', category: 'Monochrome Ink', accent: '#f1f5f9', surroundA: '#030406', surroundB: '#0c0e14', canvasFilter: 'contrast(1.08) saturate(0.65)' },
  { id: 'pewter-studio', name: 'Pewter Studio', category: 'Monochrome Ink', accent: '#d4d4d8', surroundA: '#0c0c0e', surroundB: '#1a1a1f' },

  // Update 6.0 Exclusive Bonus Themes
  { id: 'cyber-gold-60', name: 'Cyber Gold 6.0', category: 'Championship Courts', accent: '#facc15', surroundA: '#070b1a', surroundB: '#1e1635', canvasFilter: 'saturate(1.08) contrast(1.03)', release6Only: true },
  { id: 'aurora-mint-60', name: 'Aurora Mint 6.0', category: 'Cosmic & Obsidian', accent: '#2dd4bf', surroundA: '#031318', surroundB: '#0b2530', canvasFilter: 'saturate(1.06)', release6Only: true },
  { id: 'solar-flare-60', name: 'Solar Flare 6.0', category: 'Coastal & Sunset', accent: '#fb7185', surroundA: '#170714', surroundB: '#2d111a', canvasFilter: 'saturate(1.1)', release6Only: true },
];

export const COLOR_PRESETS: readonly ColorPreset[] = SEEDS.map(buildPreset);

export type PresetMood = 'all' | 'dark' | 'vivid' | 'daylight' | 'minimal';

export function getPresetMood(preset: ColorPreset): Exclude<PresetMood, 'all'> {
  if (preset.isLight) return 'daylight';
  if (preset.category === 'Monochrome Ink' || preset.id === 'lunar-slate' || preset.id === 'void-platinum') {
    return 'minimal';
  }
  if (
    preset.category === 'Retro Arcade' ||
    preset.category === 'Championship Courts' ||
    preset.id === 'broken-arrow-dusk' ||
    preset.id === 'wine-dark-sea' ||
    preset.id === 'stellar-cyan'
  ) {
    return 'vivid';
  }
  return 'dark';
}

export const PRESET_CATEGORIES: readonly PresetCategory[] = [
  'Championship Courts',
  'Coastal & Sunset',
  'Alpine & Forest',
  'Cosmic & Obsidian',
  'Warm Editorial',
  'Retro Arcade',
  'Pastel Studio',
  'Monochrome Ink',
];

export function getPresetById(id: string): ColorPreset {
  return COLOR_PRESETS.find((p) => p.id === id) ?? COLOR_PRESETS[0];
}
