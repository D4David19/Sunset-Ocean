export const STUDIO_MOTTO =
  'Every update built to stay timeless—crafted with care, now and always.';

export interface Feature25Item {
  num: number;
  title: string;
  category: '3D Worlds' | 'Shaders & Speed' | 'Freedom Sandbox' | 'UI & Log';
  summary: string;
}

export const V6_TWENTY_FIVE_FEATURES: readonly Feature25Item[] = [
  {
    num: 1,
    title: 'Solar Horizon 3D Alpine Mountains',
    category: '3D Worlds',
    summary: 'Multi-octave ridged 3D mountain range with basalt cliffs, pine slopes, snow caps, and aerial haze.',
  },
  {
    num: 2,
    title: 'Solar Horizon 3D Gerstner Ocean Shader',
    category: 'Shaders & Speed',
    summary: 'Displaced 3D ocean surface with Fresnel sky reflection, sun-path glitter, and horizon heat shimmer.',
  },
  {
    num: 3,
    title: 'Coastline Tour Full 3D Engine',
    category: '3D Worlds',
    summary: 'Rebuilt from 2D canvas into Three.js 3D terrain, undulating highway, animated rider, and biome props.',
  },
  {
    num: 4,
    title: 'Coastline 4 Switchable 3D Cameras',
    category: '3D Worlds',
    summary: 'Toggle seamlessly between Chase Cam, Side Peloton, Handlebar POV, and Overhead Drone.',
  },
  {
    num: 5,
    title: 'Coastline 3D Wheelie & Nitro Sprint',
    category: '3D Worlds',
    summary: 'Pop a 3D wheelie burst with dynamic FOV kick and tire dust plumes on demand.',
  },
  {
    num: 6,
    title: 'Angry Birds Full 3D Valley Engine',
    category: '3D Worlds',
    summary: 'Three.js 3D island, stretched Y-slingshot bands, articulated 3D birds, pigs, and destructible blocks.',
  },
  {
    num: 7,
    title: 'Angry Birds GLSL Impact Shockwaves',
    category: 'Shaders & Speed',
    summary: 'Expanding additive GLSL shockwave rings and 3D splinter bursts on TNT and heavy collisions.',
  },
  {
    num: 8,
    title: 'All-Star Hoops Full 3D Court Arena',
    category: '3D Worlds',
    summary: 'Real-time 3D hardwood & sunset streetball courts, cheering stands, glass backboard, and rope net.',
  },
  {
    num: 9,
    title: 'All-Star Hoops 3D Fireball Shader',
    category: 'Shaders & Speed',
    summary: '3+ streak (or Sandbox toggle) ignites the 3D basketball with animated emissive ember trails.',
  },
  {
    num: 10,
    title: 'All-Star Hoops 4 3D Camera Angles',
    category: '3D Worlds',
    summary: 'Switch between Baseline Broadcast, Court Side, Behind Shooter, and Overhead Rim views.',
  },
  {
    num: 11,
    title: 'Ultra-Low "Potato" Performance Mode',
    category: 'Shaders & Speed',
    summary: 'Drops pixel scale (0.65x), disables shadows, halves mesh/particle load for buttery FPS on any GPU.',
  },
  {
    num: 12,
    title: '5-Style Custom GLSL Shader Switcher',
    category: 'Shaders & Speed',
    summary: 'Swap live between Standard PBR, Golden Dusk Rim, Neon Rim, Warm Film, and Blueprint Holo.',
  },
  {
    num: 13,
    title: 'Atmospheric Sky Scattering Shader',
    category: 'Shaders & Speed',
    summary: 'Procedural sky dome shader with solar corona, horizon glow, and sunset-to-starlight blending.',
  },
  {
    num: 14,
    title: 'Global Gravity Lab Slider',
    category: 'Freedom Sandbox',
    summary: 'Dial world gravity from 0.25x Moon float up to 2.0x Heavy drop across all 3D physics games.',
  },
  {
    num: 15,
    title: 'Global Time-Scale Dial',
    category: 'Freedom Sandbox',
    summary: 'Run slow-motion matrix shots (0.25x) or turbo 2.0x speed across worlds in real time.',
  },
  {
    num: 16,
    title: 'Universal Free 3D Orbit Camera',
    category: 'Freedom Sandbox',
    summary: 'Unlock pointer drag & pinch/scroll zoom in every scene so players are never locked to one angle.',
  },
  {
    num: 17,
    title: 'Live 3D Weather FX Switcher',
    category: 'Freedom Sandbox',
    summary: 'Drop Clear skies, Coastal Mist, Rainstorms, or Glowing Embers into any 3D scene.',
  },
  {
    num: 18,
    title: 'Temple Run Chill Explore (Invincible)',
    category: 'Freedom Sandbox',
    summary: 'Toggle barrier invincibility and Triple-Jump Cloud Vault so kids and explorers can run stress-free.',
  },
  {
    num: 19,
    title: 'Angry Birds Giant Scale & Super Launch',
    category: 'Freedom Sandbox',
    summary: 'Multiply slingshot launch power up to 2.0x and enable 1.5x Giant Birds for colossal chain reactions.',
  },
  {
    num: 20,
    title: 'One-Click Sandbox Freedom Presets',
    category: 'Freedom Sandbox',
    summary: 'Instant presets for Standard, Moon Arcade, Hyper Turbo, Kid-Friendly Chill, and Cinematic Photo.',
  },
  {
    num: 21,
    title: 'Redesigned Uncluttered Spatial HUD',
    category: 'UI & Log',
    summary: 'Replaces congested corner panels with a sleek centered bottom dock and minimal 4-action top bar.',
  },
  {
    num: 22,
    title: 'Dedicated Slide-Out Sandbox Drawer',
    category: 'UI & Log',
    summary: 'Clean dedicated freedom panel separating physics & camera toys from gameplay viewports.',
  },
  {
    num: 23,
    title: 'Complete Update Log (v1.0 to v6.0)',
    category: 'UI & Log',
    summary: 'Searchable, filterable release history breaking down Added, Changed, Redesigned, and Removed items.',
  },
  {
    num: 24,
    title: '3 Exclusive Update 6.0 Studio Themes',
    category: 'UI & Log',
    summary: 'Unlocked Cyber Gold, Aurora Mint, and Solar Flare UI & stage lighting palettes.',
  },
  {
    num: 25,
    title: 'Solar Horizon Instant Sun & Wave Sculptor',
    category: 'Freedom Sandbox',
    summary: 'Manually scrub sun elevation, wave chop, and shimmer heat directly inside the Sandbox drawer.',
  },
];

export interface UpdateLogEntry {
  version: string;
  title: string;
  date: string;
  tag: 'Major Overhaul' | 'Feature Drop' | 'Optimization' | 'Foundation';
  summary: string;
  added: string[];
  changed: string[];
  redesigned: string[];
  removed: string[];
}

export const UPDATE_LOGS: readonly UpdateLogEntry[] = [
  {
    version: 'v6.0',
    title: 'Everything 3D, Shaders, Potato Mode & Player Sandbox',
    date: 'Nov 2026',
    tag: 'Major Overhaul',
    summary:
      'Full Three.js 3D conversion across all 5 worlds, realistic 3D mountains in Solar Horizon, custom GLSL shaders, Ultra-Low Potato performance preset, 25 new features, Player Sandbox, and a completely uncluttered floating UI.',
    added: [
      'True Three.js 3D engines for Coastline Tour, Angry Birds, All-Star Hoops, and Solar Horizon Cove.',
      'Realistic 3D multi-octave ridged alpine mountains in Solar Horizon with strata rock, pine slopes, and snow caps.',
      'Custom GLSL shaders: Sky scattering dome, Gerstner 3D ocean reflections, PBR Rim Moods, Impact Shockwaves, Court Sheen, and Fireball trails.',
      'Ultra-Low "Potato" performance mode (0.65x pixel scale, zero shadows, low-poly segments) for lag-free play on weak GPUs.',
      'Dedicated Sandbox Freedom drawer with Gravity Scale (0.25x–2.0x), Time Scale, Free Orbit Camera, Weather FX, Invincible Chill Run, Giant Birds, and 5 presets.',
      'Complete versioned Update Log (v1.0 → v6.0) with Added/Changed/Redesigned/Removed filters and 25-feature showcase.',
      'Unlocked 3 exclusive v6.0 themes (Cyber Gold, Aurora Mint, Solar Flare), Temple Triple-Jump Vault, and Hoops 2x Hot-Streak bonus.',
    ],
    changed: [
      'Officially launched Update 6.0 live for all players while keeping Owner release scheduling available.',
      'Unified all five scenes onto a single disposable Three.js WebGL lifecycle to eliminate memory leaks on scene switch.',
      'Scaled particle pools, terrain subdivisions, and shader loops dynamically with Potato/Eco/Balanced/High quality presets.',
    ],
    redesigned: [
      'Replaced crowded multi-card corner stacks with a breathable centered bottom dock and compact top strip keeping 85%+ of the 3D viewport open.',
      'Consolidated secondary tools (Shortcuts, Screenshot, Tutorial Hub, PC Match, Command Palette) out of the top bar into clean Studio/Sandbox tabs.',
      'Elevated Solar Horizon waves and coastal cliffs from flat 2D projections into full 3D depth with aerial scattering.',
    ],
    removed: [
      'Removed 2D-only Canvas renderers from Coastline Tour, Angry Birds, All-Star Hoops, and Solar Horizon Bay.',
      'Removed redundant stacked side boxes and cluttered top-bar icon sprawl that felt like crowded mobile menus.',
      'Removed fixed-camera locks when Free 3D Orbit mode is enabled in Sandbox.',
    ],
  },
  {
    version: 'v5.5',
    title: 'Temple Lag Fix, Horizon Shimmer & Guided Tutorial Hub',
    date: 'Nov 2026',
    tag: 'Optimization',
    summary:
      'Hardware-matched Temple Run for integrated graphics, added heat-haze horizon shimmer + soaring horizon birds, mobile touch support, and a full spotlight tutorial.',
    added: [
      'Subtle refractive horizon heat-haze shimmer and random distant horizon bird silhouette particles in Solar Horizon.',
      'Interactive chaptered Spotlight Tutorial with futuristic dim cutout + Kid-Simple "i" info badges across controls.',
      'Full mobile & portrait tablet touch support with thumb pads in Temple Run and pinch-to-zoom in J2000 Space View.',
      '45-second idle auto-tour trigger with one-click Auto-Tour Guide mode.',
    ],
    changed: [
      'Optimized Temple Run terrain chunk count, shadow sizes, and DPR scaling for Intel UHD 770 / integrated GPUs.',
      'Expanded pointer & swipe responsiveness across touchscreen devices.',
    ],
    redesigned: [
      'Cleaned mobile safe-area docks and collapsible scene cards for 360px–430px phone screens.',
    ],
    removed: [
      'Removed heavy per-frame canvas allocations and redundant backdrop blurs over WebGL layers.',
    ],
  },
  {
    version: 'v5.0',
    title: 'Angry Birds Destruction Overhaul & Flock Squad',
    date: 'Nov 2026',
    tag: 'Feature Drop',
    summary:
      'Upgraded Angry Birds with 5 unique birds, Matter.js wood/ice/stone/TNT stages, rapid-fire mode, and Hardware PC Profile matching.',
    added: [
      '5 selectable birds with mid-air powers: Red Shockwave, Chuck Dash, Blues Split, Bomb Blast, and Matilda Egg Drop.',
      '6 multi-material stages (Timber Watch, Frostbite Spires, Stone Pyramid, TNT Quarry, Citadel, Skyway Bouncer).',
      'Pass-Through vs Collide flight modes, Rapid-Fire shooting, and 1-Click PC Match presets.',
    ],
    changed: [
      'Replaced single red-bird arcs with full Matter.js rigid-body structural collapse & chain-reaction TNT explosions.',
    ],
    redesigned: [
      'Added interactive flock roster strip and star-rating victory summary.',
    ],
    removed: [
      'Removed laggy old bird fade limits that froze long multi-salvo sessions.',
    ],
  },
  {
    version: 'v4.2',
    title: 'Hardware Profiler & Hybrid High-Hz Frame Pacing',
    date: 'Oct 2026',
    tag: 'Optimization',
    summary:
      'Added WebGL GPU detection, refresh-rate snapping up to 179Hz+, and PC Bottleneck Advisories.',
    added: [
      'Live GPU tier classification (Software, Intel UHD iGPU, Apple/Iris, Discrete GPU) and display Hz estimator.',
      'Hybrid 179/60 frame pacing mode and Eco resolution scaling.',
    ],
    changed: [
      'Adapted frame pacing budgets per scene workload.',
    ],
    redesigned: [
      'Added dedicated PC Hardware Match tab inside Studio Drawer.',
    ],
    removed: [
      'Removed forced 2x retina supersampling on fillrate-bound integrated GPUs.',
    ],
  },
  {
    version: 'v4.0 – v4.1',
    title: 'Kinetic Arcade Studio, 79 Presets & Audio Mixer',
    date: 'Oct 2026',
    tag: 'Major Overhaul',
    summary:
      'Introduced the multi-skin Studio shell, procedural Web Audio ambient synthesizer, 79 color themes, A/B/C snapshots, and Command Palette.',
    added: [
      '4 HUD skins (Neo-Arcade, Obsidian, Scoreboard, Swiss Day) and 79 filterable color presets.',
      'Web Audio procedural soundscape mixer with Deep Calm, Nature Walk, Rainy Evening, and Classic SFX moods.',
      'Cmd/Ctrl+K Command Palette, PNG Snapshot export, and 3 local save slots (A/B/C).',
    ],
    changed: [
      'Unified all five separate demos under a single persistent preference & record store.',
    ],
    redesigned: [
      'Replaced isolated page wrappers with a synchronized 16:9 / 21:9 cinema stage.',
    ],
    removed: [
      'Removed external audio file dependencies in favor of zero-404 procedural synthesis.',
    ],
  },
  {
    version: 'v2.0 – v3.0',
    title: 'J2000 Solar System Space View & Coast-to-Coast Biomes',
    date: 'Sep 2026',
    tag: 'Feature Drop',
    summary:
      'Expanded Sunset Ocean into J2000 planetary ephemeris space travel, added Moving Hoop + 3 shooter poses, and 4 US Coastline cycling biomes.',
    added: [
      'Seamless horizon-to-orbit J2000 Solar System tour with clickable planets, Showcase vs True AU scale, and time warp.',
      'Broken Arrow, OK live solar/lunar ephemeris sync.',
      'Moving Hoop mode & Verlet rope net physics in All-Star Hoops; 4 biomes in Coastline Tour.',
    ],
    changed: [
      'Upgraded static sunset backdrop to animated sun elevation and real-time moon phases.',
    ],
    redesigned: [
      'Reworked cyclist cadence controls for manual tap-to-pedal hyper speeds.',
    ],
    removed: [
      'Removed fixed non-interactive hoop ring.',
    ],
  },
  {
    version: 'v1.0',
    title: 'Initial Arcade & Ocean Sunset Launch',
    date: 'Aug 2026',
    tag: 'Foundation',
    summary:
      'First release featuring Jungle Temple Runner, Sunset Ocean Horizon, and core Canvas/Three.js prototypes.',
    added: [
      'Endless 3-lane Temple Runner with jumps, slides, coins, and power-ups.',
      'Initial Sunset Ocean atmospheric gradient and wave simulation.',
      'Foundational Cyclist, Slingshot, and Basketball arcade prototypes.',
    ],
    changed: [
      'Established Auto vs Manual play loop across scenes.',
    ],
    redesigned: [
      'Initial viewport framing for browser desktop screens.',
    ],
    removed: [
      'Initial placeholder static splash screens.',
    ],
  },
];
