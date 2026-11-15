import type { SceneId } from '../context/AudioManagerContext';
import type { DrawerTabId } from '../context/StudioContext';

export interface HelpEntry {
  id: string;
  title: string;
  whatItDoes: string;
  tryThis?: string;
}

export interface TutorialStep {
  id: string;
  chapterId: string;
  targetId: string;
  title: string;
  description: string;
  tryThis: string;
  scene?: SceneId;
  drawerOpen?: boolean;
  drawerTab?: DrawerTabId;
  /** Optional scene-panel preparation before measuring the target */
  prepareCommand?:
    | { scene: SceneId; openControls?: boolean; spaceView?: boolean }
    | undefined;
  /** If true, clicking the highlighted target itself advances to the next step */
  advanceOnClick?: boolean;
  /** Preferred placement of the futuristic guide card */
  preferPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
}

export interface TutorialChapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  accent: string;
  scene?: SceneId;
  drawerTab?: DrawerTabId;
}

/**
 * Friendly, kid-simple dictionary of "i" info badges across the ENTIRE project:
 * Bottom Dock, Top Bar, all 5 games, and every setting inside all 5 Studio tabs.
 */
export const HELP_CATALOG: Record<string, HelpEntry> = {
  // ── Bottom Dock ────────────────────────────────────────────────────────────
  'dock-temple': {
    id: 'dock-temple',
    title: 'Temple Run 5.5',
    whatItDoes: 'Jump into a 3D jungle obstacle run! Dodge traps, collect gold coins, and fly with the Double Jump.',
    tryThis: 'Press key 1 or click here to start running.',
  },
  'dock-ocean': {
    id: 'dock-ocean',
    title: 'Solar Horizon & Space',
    whatItDoes: 'Watch calm ocean waves shimmer at sunset, or blast off into outer space to visit every planet!',
    tryThis: 'Press key 2 or click Space View inside this world.',
  },
  'dock-cyclist': {
    id: 'dock-cyclist',
    title: 'Coastline Tour',
    whatItDoes: 'Ride a bicycle across sunny beaches, mountains, deserts, and cozy neighborhoods.',
    tryThis: 'Switch to Manual and tap Spacebar fast to pedal super speed!',
  },
  'dock-slingshot': {
    id: 'dock-slingshot',
    title: 'Angry Birds 5.0',
    whatItDoes: 'Pull back the giant slingshot to launch birds with special superpowers at piggy towers!',
    tryThis: 'Drag the slingshot or turn on Rapid fire mode to blast away.',
  },
  'dock-basketball': {
    id: 'dock-basketball',
    title: 'All-Star Hoops',
    whatItDoes: 'Shoot basketballs into the hoop! Score 3 shots in a row to make the hoop start moving.',
    tryThis: 'Click anywhere on the screen or drag back to aim your shot.',
  },
  'dock-auto-mode': {
    id: 'dock-auto-mode',
    title: 'All: Auto / Manual',
    whatItDoes: 'Auto lets the computer play all scenes like a cool movie. Manual puts YOU in control!',
    tryThis: 'Click to swap between watching and playing yourself (key A).',
  },
  'dock-auto-tour': {
    id: 'dock-auto-tour',
    title: 'Auto Tour Screensaver',
    whatItDoes: 'When on, the app automatically visits different games after you rest your mouse for a few seconds.',
    tryThis: 'Click to arm it, or customize the timer inside Studio -> Tour.',
  },
  'dock-sound': {
    id: 'dock-sound',
    title: 'Master Sound Switch',
    whatItDoes: 'Turns all gentle nature sounds, music pads, rain, and game sound effects On or Off.',
    tryThis: 'Press key M anytime to mute or unmute in one snap.',
  },

  // ── Top Utility Bar ────────────────────────────────────────────────────────
  'hud-telemetry': {
    id: 'hud-telemetry',
    title: 'Live Score & Stats Bar',
    whatItDoes: 'Shows your live score, speed, distance, or planet facts for whichever world is open right now.',
    tryThis: 'You can hide or shrink this bar inside Studio -> PC Tune.',
  },
  'hud-fps': {
    id: 'hud-fps',
    title: 'FPS Smoothness Meter',
    whatItDoes: 'Shows how many pictures per second (FPS) your computer draws. Higher numbers feel extra smooth!',
    tryThis: 'Open Studio -> PC Tune or Sandbox -> Potato Mode to boost FPS.',
  },
  'hud-sandbox': {
    id: 'hud-sandbox',
    title: 'Freedom Sandbox & 3D Shaders (B)',
    whatItDoes: 'Opens the player freedom slide-out panel: Gravity & Time sliders, Free 3D Orbit camera, Shader Moods, Weather FX, and Potato Quality.',
    tryThis: 'Click Sandbox or press B anytime to customize physics and shaders.',
  },
  'hud-release-timer': {
    id: 'hud-release-timer',
    title: 'Update 6.0 Log & Release Timer (U)',
    whatItDoes: 'Read the complete Changelog (v1.0–v6.0), browse all 25 new features, or schedule/release updates as Owner.',
    tryThis: 'Click here or press U to open the Updates Log.',
  },
  'hud-studio': {
    id: 'hud-studio',
    title: 'Studio Settings Drawer (C)',
    whatItDoes: 'Opens the main control drawer with Quick Tools (Guide, "i" Hints, Auto Tour, Search, Calm Audio, Photo, Keys, Fullscreen), 79 Themes, PC Tune & Mixer!',
    tryThis: 'Click here or press key C anytime to open or close Studio.',
  },
  'hud-zen-btn': {
    id: 'hud-zen-btn',
    title: 'Hide All Menus (Zen Mode)',
    whatItDoes: 'Tucks away every top and bottom menu bar so you see pure 3D worlds edge-to-edge.',
    tryThis: 'Press H anytime to hide or restore the menus.',
  },
  'studio-quick-tools': {
    id: 'studio-quick-tools',
    title: 'Studio Quick Tools Strip',
    whatItDoes: 'One-tap access to Interactive Guide (G), "i" Info Hints, Idle Auto Tour (T), Command Search (⌘K), Calm Audio, PNG Photo (P), Keys (?), and Fullscreen (F).',
    tryThis: 'Click any tool tile here or use its shortcut key anytime.',
  },
  'hud-render-mode': {
    id: 'hud-render-mode',
    title: '3D ↔ Classic 2D Toggle (V)',
    whatItDoes: 'Lets you flip anytime between the full Three.js 3D worlds and our classic hand-crafted 2D art style!',
    tryThis: 'Press V or click 3D/2D anytime (Temple Run stays native 3D).',
  },
  'studio-preset-cycle': {
    id: 'studio-preset-cycle',
    title: 'Auto-Switch Color Presets',
    whatItDoes: 'Automatically glides through all 79 color presets every few seconds so the colors keep transforming live!',
    tryThis: 'Pick 5s, 10s, 20s, or 30s to set how fast themes rotate.',
  },
  'sandbox-drawer': {
    id: 'sandbox-drawer',
    title: 'Player Freedom Sandbox',
    whatItDoes: 'Tune 3D Shader Moods, Potato Low-Quality mode, Weather FX, Free 3D Camera Orbit, Gravity, Time Scale, and per-world freedom cheats.',
    tryThis: 'Try Moon Gravity or Golden Rim shaders with 1 click!',
  },
  'hud-pc-tune': {
    id: 'hud-pc-tune',
    title: 'PC Hardware Match',
    whatItDoes: 'Checks your exact computer chip and monitor speed so games run fast with zero lag.',
    tryThis: 'Click to open PC Tune, or Shift+Click to auto-tune in 1 click!',
  },
  'hud-zen-calm': {
    id: 'hud-zen-calm',
    title: 'Zen Calm Sound Mode',
    whatItDoes: 'Makes all sound effects soft, warm, and relaxing with gentle nature & ambient music pads.',
    tryThis: 'Click to toggle calm sounds, or Shift+Click to mix each sound.',
  },
  'hud-palette': {
    id: 'hud-palette',
    title: 'Quick Search Palette (⌘K)',
    whatItDoes: 'A fast search bar to jump straight to any planet, level, color theme, shader, or tutorial chapter.',
    tryThis: 'Open from Studio Quick Tools or press Ctrl+K (Cmd+K on Mac).',
  },
  'hud-screenshot': {
    id: 'hud-screenshot',
    title: 'Take a Picture (PNG)',
    whatItDoes: 'Saves a crisp photo of whatever game or planet you are looking at right onto your computer.',
    tryThis: 'Click in Studio Quick Tools or press key P to snap a picture!',
  },
  'hud-zen-mode': {
    id: 'hud-zen-mode',
    title: 'Hide All Menus (Zen View)',
    whatItDoes: 'Hides every button and scoreboard so you see nothing but pure 3D art, sky, or gameplay.',
    tryThis: 'Press key H to hide menus, and press H again to bring them back.',
  },
  'hud-shortcuts': {
    id: 'hud-shortcuts',
    title: 'Keyboard Cheat Sheet (?)',
    whatItDoes: 'Opens a handy list showing every keyboard button for all 5 3D worlds.',
    tryThis: 'Press ? anytime to peek at the controls.',
  },
  'hud-fullscreen': {
    id: 'hud-fullscreen',
    title: 'Fullscreen Mode (F)',
    whatItDoes: 'Stretches the app across your whole monitor from edge to edge with no browser bars.',
    tryThis: 'Press F to enter or Esc/F to leave fullscreen.',
  },
  'hud-guide': {
    id: 'hud-guide',
    title: 'Interactive Tutorial Hub',
    whatItDoes: 'Opens our futuristic click-through guide anytime! Replay the full tour or pick any chapter.',
    tryThis: 'Click in Studio Quick Tools or press G whenever you want a walkthrough.',
  },
  'hud-info-hints': {
    id: 'hud-info-hints',
    title: 'Little "i" Info Hints Toggle',
    whatItDoes: 'Turns these tiny blue "i" circles On or Off everywhere so the screen stays calm when you already know everything!',
    tryThis: 'Click any "i" circle to read what a button does.',
  },

  // ── Temple Run 5.5 ─────────────────────────────────────────────────────────
  'temple-score-card': {
    id: 'temple-score-card',
    title: 'Run Score, Fever & Relics',
    whatItDoes: 'Tracks your Score, Distance, Coins, Speed Multiplier, and active power-ups like Magnet or Shield.',
    tryThis: 'Chain coins and close dodges to reach 5x Combo and Golden Fever!',
  },
  'temple-quality': {
    id: 'temple-quality',
    title: 'Temple Graphics Speed',
    whatItDoes: 'Auto picks the smoothest look for your PC. Fast skips shadows for top speed; High adds extra shine.',
    tryThis: 'Leave on Auto for lag-free running on any computer.',
  },
  'temple-auto-manual': {
    id: 'temple-auto-manual',
    title: 'Runner Pilot: Auto or Manual',
    whatItDoes: 'Auto runs and jumps by itself. Manual lets you steer lanes (A/D), Double Vault (W/Space), and Slide (S).',
    tryThis: 'Try pressing Space twice in mid-air during Manual mode!',
  },
  'temple-controls-btn': {
    id: 'temple-controls-btn',
    title: 'Show / Hide Runner Options',
    whatItDoes: 'Opens the Graphics Quality selector and shows the quick keyboard helper strip.',
  },

  // ── Solar Horizon & Space View ─────────────────────────────────────────────
  'ocean-plaque': {
    id: 'ocean-plaque',
    title: 'Live Sky Clock & Moon Phase',
    whatItDoes: 'Shows real sunrise, sunset, moon brightness, and the poetic sky phase for Broken Arrow, OK.',
  },
  'ocean-almanac': {
    id: 'ocean-almanac',
    title: 'Moon Almanac Drawer',
    whatItDoes: 'Opens a mini picture of tonight’s Moon shape plus when the next Full Moon and New Moon arrive.',
  },
  'ocean-sync-sky': {
    id: 'ocean-sync-sky',
    title: 'Sync Real Sky vs Loop',
    whatItDoes: 'Switches between matching the real sky outside right now and a dreamy nonstop sunrise-to-sunset loop.',
  },
  'ocean-space-view': {
    id: 'ocean-space-view',
    title: 'Blast Off to Space View',
    whatItDoes: 'Zooms high above the ocean straight into our 3D Solar System with all planets orbiting the Sun!',
    tryThis: 'Click any planet label in space to zoom right up to it.',
  },
  'ocean-controls-panel': {
    id: 'ocean-controls-panel',
    title: 'Ocean & Sky Controls',
    whatItDoes: 'Lets you customize wave speed, sunset timing, moon syncing, and graphics smoothness.',
  },
  'ocean-sky-mode': {
    id: 'ocean-sky-mode',
    title: 'Classic Cycle vs Real Sky',
    whatItDoes: 'Classic Cycle glides through colorful sunsets endlessly. Broken Arrow matches real local daylight.',
  },
  'ocean-moon-phase': {
    id: 'ocean-moon-phase',
    title: 'Moon Phase Mode',
    whatItDoes: 'Live Tonight draws the exact Moon you see tonight. Mode Linked animates moon phases as time loops.',
  },
  'ocean-wave-speed': {
    id: 'ocean-wave-speed',
    title: 'Ocean Wave Speed Slider',
    whatItDoes: 'Controls how fast the ocean swells roll and shimmer toward shore—from glassy calm to energetic surf.',
  },
  'ocean-cycle-slider': {
    id: 'ocean-cycle-slider',
    title: 'Sunset Speed / Time Slider',
    whatItDoes: 'In Auto, sets how fast a whole day passes. In Manual, drag it to scrub sunrise, sunset, or starry midnight!',
  },
  'ocean-quality': {
    id: 'ocean-quality',
    title: 'Ocean Render Quality',
    whatItDoes: 'Auto tunes wave detail smoothly for your graphics card. Fast saves power; High maximizes reflections.',
  },
  'space-scale-mode': {
    id: 'space-scale-mode',
    title: 'Showcase vs True Space Scale',
    whatItDoes: 'Showcase brings planets close together so they are easy to see. True AU spreads them to real space distances!',
  },
  'space-time-warp': {
    id: 'space-time-warp',
    title: 'Space Time-Warp Speed',
    whatItDoes: 'Pause time, watch real-time motion, or fast-forward days and months per second to watch planets orbit!',
    tryThis: 'Click Today to jump straight back to today’s real planet positions.',
  },
  'space-labels-belts': {
    id: 'space-labels-belts',
    title: 'Units, Labels & Asteroid Belts',
    whatItDoes: 'Swap between Kilometers (KM) and Miles (MI), hide planet name tags, or toggle the Asteroid & Kuiper belts.',
  },
  'space-back-ocean': {
    id: 'space-back-ocean',
    title: 'Fly Back to Ocean',
    whatItDoes: 'Glides the spaceship smoothly back down from outer space to the sunset ocean shore.',
  },

  // ── Coastline Tour ─────────────────────────────────────────────────────────
  'cyclist-card': {
    id: 'cyclist-card',
    title: 'Bike Speedometer & Pedaling RPM',
    whatItDoes: 'Shows how fast your bike is rolling, your pedal rhythm (RPM), and which scenic region you are riding through.',
  },
  'cyclist-units': {
    id: 'cyclist-units',
    title: 'MPH vs KM/H Units',
    whatItDoes: 'Switches the speedometer between Miles Per Hour and Kilometers Per Hour.',
  },
  'cyclist-biome-lock': {
    id: 'cyclist-biome-lock',
    title: 'Lock Current Scenery',
    whatItDoes: 'Tour cycles naturally through Coast, Mountains, Desert, and Suburbs. Lock keeps your favorite view forever!',
  },
  'cyclist-scenery': {
    id: 'cyclist-scenery',
    title: 'Pick Highway Scenery',
    whatItDoes: 'Instantly ride straight into USA Tour, Rocky Mountains, Southwest Desert, or American Suburbs.',
  },
  'cyclist-auto-manual': {
    id: 'cyclist-auto-manual',
    title: 'Auto Cruise vs Manual Sprint',
    whatItDoes: 'Auto pedals gently for you. Manual lets you click or tap Spacebar rapidly to race up to 10x speed!',
  },
  'cyclist-cruise': {
    id: 'cyclist-cruise',
    title: 'Cruise Speed Slider',
    whatItDoes: 'Sets how fast your bike rolls while in Auto mode—from a sleepy stroll to a brisk breeze.',
  },
  'cyclist-wind': {
    id: 'cyclist-wind',
    title: 'Wind Streaks Effect',
    whatItDoes: 'Shows or hides playful cartoon wind lines flying past your helmet as you speed up.',
  },

  // ── Angry Birds 5.0 ────────────────────────────────────────────────────────
  'birds-card': {
    id: 'birds-card',
    title: 'Fortress Progress & Score',
    whatItDoes: 'Shows how many stars you earned (up to 3), your points, how many green pigs remain, and birds left.',
  },
  'birds-fortresses': {
    id: 'birds-fortresses',
    title: '6 Fortress Stages',
    whatItDoes: 'Pick from 6 custom castles to smash—including TNT Quarry, Ice Spires, and Skyway Bouncer!',
  },
  'birds-quiver': {
    id: 'birds-quiver',
    title: 'Bird Quiver Size',
    whatItDoes: 'Choose Infinite (∞) birds for endless fun, or challenge yourself with only 3, 5, or 7 birds per stage.',
  },
  'birds-camera': {
    id: 'birds-camera',
    title: 'Camera View (Wide vs Follow)',
    whatItDoes: 'Wide shows the whole castle and slingshot at once. Cam zooms along right behind your flying bird!',
  },
  'birds-ground-fx': {
    id: 'birds-ground-fx',
    title: 'Ground Impact Effects',
    whatItDoes: 'Controls dust puffs and ground craters when heavy birds or blocks smash into the grass.',
  },
  'birds-aim-arc': {
    id: 'birds-aim-arc',
    title: 'Aim Dots Length',
    whatItDoes: 'Makes the dotted aiming trail Short, Standard, or Long so lining up tricky bank shots is easy.',
  },
  'birds-env': {
    id: 'birds-env',
    title: 'Gravity & Wind Challenge',
    whatItDoes: 'Standard is normal earth gravity. Low-G makes floaty moon arcs! Headwind blows against your shots.',
  },
  'birds-fire-mode': {
    id: 'birds-fire-mode',
    title: 'Drag Pull vs Rapid Fire',
    whatItDoes: 'Drag lets you pull the rubber band back gently. Rapid lets you click anywhere to fire birds super fast!',
  },
  'birds-midair': {
    id: 'birds-midair',
    title: 'Mid-Air Bird Collisions',
    whatItDoes: 'Pass lets new birds fly smoothly past old birds. Collide makes birds bump into each other in mid-air!',
  },
  'birds-cleanup': {
    id: 'birds-cleanup',
    title: 'Landed Bird Cleanup',
    whatItDoes: 'Decides how long tired birds stay resting on the ground before gently poofing away to keep FPS fast.',
  },
  'birds-auto-rebuild': {
    id: 'birds-auto-rebuild',
    title: 'Auto AI & Rebuild Fortress',
    whatItDoes: 'Auto AI aims and fires automatically. Rebuild (R) puts the whole castle and all pigs right back up!',
  },
  'birds-roster': {
    id: 'birds-roster',
    title: '5 Superpower Birds',
    whatItDoes: 'Pick Red (Shockwave), Chuck (Turbo Dash), Blues (Triple Split), Bomb (Big Boom), or Matilda (Egg Drop)!',
    tryThis: 'Press Spacebar or click mid-air while a bird is flying to trigger its power!',
  },
  'birds-ability': {
    id: 'birds-ability',
    title: 'Trigger Bird Power (Space)',
    whatItDoes: 'Activates the current flying bird’s special ability—like splitting into 3 birds or exploding TNT!',
  },

  // ── All-Star Hoops ─────────────────────────────────────────────────────────
  'hoops-card': {
    id: 'hoops-card',
    title: 'Hoops Scoreboard & Hot Streak',
    whatItDoes: 'Counts baskets made, clean swishes (nothing but net!), and your streak. Hit 3 in a row to unlock the Moving Hoop!',
  },
  'hoops-venue': {
    id: 'hoops-venue',
    title: 'Basketball Court Venues',
    whatItDoes: 'Swap between glowing Pro Arena, sunny Streetball blacktop, or cozy wood-floor Retro Gym.',
  },
  'hoops-shooter': {
    id: 'hoops-shooter',
    title: 'Player vs Free Ball',
    whatItDoes: 'Show the animated basketball player dribbling on court, or use Free Ball for pure clean trick-shots.',
  },
  'hoops-court': {
    id: 'hoops-court',
    title: 'Full Court vs Fixed Spot',
    whatItDoes: 'Full Court lets the shooter walk or run anywhere (A/D keys). Fixed Spot plants your feet in one place.',
  },
  'hoops-shot-style': {
    id: 'hoops-shot-style',
    title: 'Auto Shooter Style',
    whatItDoes: 'Tells Auto mode whether to practice perfect Swishes, lucky Rim Bounces, high Bank Shots, or Mixed shots.',
  },
  'hoops-spots': {
    id: 'hoops-spots',
    title: 'Instant Court Spot Teleport',
    whatItDoes: 'Tap Deep, Wing, Top Key, or Paint to stand at that exact spot on the court right away!',
  },
  'hoops-net-fx': {
    id: 'hoops-net-fx',
    title: 'Swish Confetti, Smoke & Aim Arc',
    whatItDoes: 'Pick Confetti bursts, Hoop Smoke, or Both when you score—and toggle the glowing aim arc On or Off.',
  },
  'hoops-throw-power': {
    id: 'hoops-throw-power',
    title: 'Throw Power Sensitivity',
    whatItDoes: 'Adjusts how sensitive your mouse pull is when aiming basketball shots manually.',
  },
  'hoops-actions': {
    id: 'hoops-actions',
    title: 'Auto / Shoot / Reset',
    whatItDoes: 'Auto shoots for you, Shoot fires an instant shot right now, and Reset clears your score back to zero.',
  },

  // ── Studio Drawer: Themes Tab ──────────────────────────────────────────────
  'studio-tab-themes': {
    id: 'studio-tab-themes',
    title: 'Themes & Looks Tab',
    whatItDoes: 'Change HUD styles, outer background frames, and search through all 79 colorful studio themes!',
  },
  'studio-skin': {
    id: 'studio-skin',
    title: '4 Studio Visual Skins',
    whatItDoes: 'Changes the shape and brightness of every menu card—including bright daylight Swiss Day mode.',
  },
  'studio-surround': {
    id: 'studio-surround',
    title: 'Outer Stage Frame',
    whatItDoes: 'Changes the wallpaper space outside the 16:9 / 21:9 game screen (Glow, Gradient, Dark Obsidian, or Grid).',
  },
  'studio-scope': {
    id: 'studio-scope',
    title: 'Global vs Per-Scene Theme',
    whatItDoes: 'Global uses one color everywhere. Per-Scene remembers a different favorite color for each of the 5 games!',
  },
  'studio-target': {
    id: 'studio-target',
    title: 'Color Both HUD + Game vs HUD Only',
    whatItDoes: 'HUD+Scene tints the game sky & lighting too; HUD Only keeps the game original and only colors menus.',
  },
  'studio-mix': {
    id: 'studio-mix',
    title: 'Step & Surprise Mix',
    whatItDoes: 'Use < / > to try themes one by one, or press Mix (Shift+X) for an instant surprise color combo!',
  },
  'studio-recent': {
    id: 'studio-recent',
    title: 'Recent Color Dots',
    whatItDoes: 'Quickly jump back to the last 5 color themes you tried.',
  },
  'studio-mood-search': {
    id: 'studio-mood-search',
    title: 'Mood Filter, Search & Categories',
    whatItDoes: 'Filter themes by Dark, Vivid, Daylight, or Minimal mood, search by name, or click the Star to save Favorites!',
  },

  // ── Studio Drawer: Tour Tab ────────────────────────────────────────────────
  'studio-tab-tour': {
    id: 'studio-tab-tour',
    title: 'Auto Tour Settings Tab',
    whatItDoes: 'Set up how the automatic scene-hopping screensaver works when you sit back and watch.',
  },
  'studio-tour-arm': {
    id: 'studio-tour-arm',
    title: 'Idle Auto Tour Switch',
    whatItDoes: 'Arms or turns off Auto Tour. Shows whether it is waiting for you to rest or actively touring.',
  },
  'studio-tour-auto45': {
    id: 'studio-tour-auto45',
    title: 'Auto-Start After 45s Idle',
    whatItDoes: 'Even when Auto Tour is Off, leaving your mouse and keyboard idle for 45 seconds turns Auto Tour on automatically!',
  },
  'studio-tour-delay': {
    id: 'studio-tour-delay',
    title: 'Idle Trigger Delay',
    whatItDoes: 'How many seconds of resting before Auto Tour gently starts hopping between worlds.',
  },
  'studio-tour-dwell': {
    id: 'studio-tour-dwell',
    title: 'Time Per Scene',
    whatItDoes: 'How long Auto Tour stays inside each game before gliding to the next one.',
  },
  'studio-tour-order': {
    id: 'studio-tour-order',
    title: 'Rotation Order',
    whatItDoes: 'Sequential visits games 1 -> 2 -> 3 -> 4 -> 5 in order. Smart Shuffle picks surprises without repeating!',
  },
  'studio-tour-scenes': {
    id: 'studio-tour-scenes',
    title: 'Included Scenes Checklist',
    whatItDoes: 'Pick which of the 5 worlds are allowed inside your Auto Tour rotation.',
  },
  'studio-tour-rules': {
    id: 'studio-tour-rules',
    title: 'Tour Choreography Rules',
    whatItDoes: 'Match theme colors per game, restore Manual/Auto when you return, or pause automatically when your mouse touches menus.',
  },

  // ── Studio Drawer: PC Tune Tab ─────────────────────────────────────────────
  'studio-tab-pc': {
    id: 'studio-tab-pc',
    title: 'PC Tune & Speed Tab',
    whatItDoes: 'Matches graphics scaling and refresh rate (like 179Hz ultrawide) to your computer so games never stutter.',
  },
  'studio-pc-profile': {
    id: 'studio-pc-profile',
    title: 'Detected PC Profile & 1-Click Match',
    whatItDoes: 'Shows your graphics card, CPU threads, screen size, and live FPS. Click Match My PC anytime for instant smoothness!',
  },
  'studio-pc-pacing': {
    id: 'studio-pc-pacing',
    title: 'Frame Pacing & GPU Scaling',
    whatItDoes: 'Auto PC Match unlocks 179Hz on 2D games and tunes 3D shaders cleanly for Intel UHD graphics so nothing lags.',
  },
  'studio-pc-bottlenecks': {
    id: 'studio-pc-bottlenecks',
    title: 'Hardware Insights & Tips',
    whatItDoes: 'Explains any speed tips for your monitor or GPU in plain words so you know why the app tuned itself that way.',
  },

  // ── Studio Drawer: Audio Tab ───────────────────────────────────────────────
  'studio-tab-audio': {
    id: 'studio-tab-audio',
    title: 'Calm Audio Mixer Tab',
    whatItDoes: 'Customize peaceful nature ambiences, warm synth pads, cozy rain, reverb, and sound effects!',
  },
  'studio-audio-test': {
    id: 'studio-audio-test',
    title: 'Test Chime & Master Audio',
    whatItDoes: 'Test Chime plays a soft wind-chime note so you can hear your mix right away; On/Off toggles all sound.',
  },
  'studio-audio-moods': {
    id: 'studio-audio-moods',
    title: '4 Soundscape Mood Presets',
    whatItDoes: '1-click presets: Deep Calm (dreamy spa), Nature Walk (birds & breeze), Rainy Evening (cozy storm), or Classic.',
  },
  'studio-audio-sfx-style': {
    id: 'studio-audio-sfx-style',
    title: 'Peaceful Foley vs Classic Arcade',
    whatItDoes: 'Peaceful Foley turns hard clicks and pops into warm wooden taps & soft chimes. Classic keeps crisp retro pops.',
  },
  'studio-audio-sliders': {
    id: 'studio-audio-sliders',
    title: '6 Volume & Reverb Sliders',
    whatItDoes: 'Control Master Volume, Nature sounds, Warm Pads, Cozy Rain, Game SFX, and Stereo Room Reverb individually!',
  },
  'studio-audio-mutes': {
    id: 'studio-audio-mutes',
    title: '6 Quick Layer Mute Buttons',
    whatItDoes: 'Tap any layer button (like Rain or Pads) to silence just that sound layer without touching the others.',
  },
  'studio-audio-eq': {
    id: 'studio-audio-eq',
    title: 'Acoustic EQ & Auto-Mute',
    whatItDoes: 'Changes the warmth/tone of the audio (like Late-Night Warm for sleepy eyes) and auto-mutes if you switch browser tabs.',
  },
  'studio-viewport-qol': {
    id: 'studio-viewport-qol',
    title: 'Screen Shape, HUD & Game Visuals',
    whatItDoes: 'Pick 16:9 Cinema vs 21:9 Ultrawide, hide idle mouse cursor, shrink/fade HUDs, or toggle Aim Guides, Trails & Shake!',
  },

  // ── Studio Drawer: Stats & Save Tab ────────────────────────────────────────
  'studio-tab-records': {
    id: 'studio-tab-records',
    title: 'High Scores & Backups Tab',
    whatItDoes: 'See all your lifetime Personal Bests, save favorite Studio setups in Slots A/B/C, and export settings!',
  },
  'studio-records-grid': {
    id: 'studio-records-grid',
    title: 'Personal Best Scoreboard',
    whatItDoes: 'Keeps track of your best Hoops Streak, Swishes, Angry Birds Score, Temple Run distance, Coastline Speed, and Photos.',
  },
  'studio-snapshots': {
    id: 'studio-snapshots',
    title: 'Snapshot Slots (A / B / C)',
    whatItDoes: 'Save your favorite game + colors + audio mix into Slot A, B, or C so you can load that exact vibe anytime!',
  },
  'studio-export-import': {
    id: 'studio-export-import',
    title: 'Save Photo & Export/Import JSON',
    whatItDoes: 'Download a PNG picture or save all your Studio settings into a small JSON file you can reload later.',
  },
  'studio-reset-records': {
    id: 'studio-reset-records',
    title: 'Reset Personal Bests',
    whatItDoes: 'Clears your high scores back to zero if you want a fresh start—plus an Undo button just in case!',
  },
  // Individual Tour Rule entries
  'studio-tour-sync': {
    id: 'studio-tour-sync',
    title: 'Choreograph Scene-Matched Colors',
    whatItDoes: 'Automatically swaps Studio colors to match each game as Auto Tour visits it.',
  },
  'studio-tour-restore': {
    id: 'studio-tour-restore',
    title: 'Restore Auto/Manual on Return',
    whatItDoes: 'If you were playing in Manual before Auto Tour started, it puts you back in Manual when you wiggle the mouse!',
  },
  'studio-tour-hover': {
    id: 'studio-tour-hover',
    title: 'Pause Tour While Hovering HUD',
    whatItDoes: 'Freezes the Auto Tour countdown whenever your mouse rests on a toolbar or drawer.',
  },
  'studio-tour-mouse': {
    id: 'studio-tour-mouse',
    title: 'Reset Idle Timer on Mouse Move',
    whatItDoes: 'Moving your mouse resets the waiting timer so Auto Tour only starts when you really step away.',
  },
  // Individual Audio Channel entries
  'studio-audio-master': {
    id: 'studio-audio-master',
    title: 'Master Volume Slider',
    whatItDoes: 'Raises or lowers all sounds together in one slide.',
  },
  'studio-audio-nature': {
    id: 'studio-audio-nature',
    title: 'Nature / World Sounds Slider',
    whatItDoes: 'Adjusts gentle waves, forest birds, jungle breeze, or distant space hum for whichever scene is open.',
  },
  'studio-audio-pads': {
    id: 'studio-audio-pads',
    title: 'Warm Ambient Pads Slider',
    whatItDoes: 'Controls the soft dreamy synthesizer chords that make every game feel cozy and peaceful.',
  },
  'studio-audio-rain': {
    id: 'studio-audio-rain',
    title: 'Cozy Rain Overlay Slider',
    whatItDoes: 'Blends gentle rainfall droplets softly underneath any game or Sunset view.',
  },
  'studio-audio-sfx': {
    id: 'studio-audio-sfx',
    title: 'Action Sound Effects Slider',
    whatItDoes: 'Controls jumps, coin pickups, slingshot launches, and basketball swishes.',
  },
  'studio-audio-reverb': {
    id: 'studio-audio-reverb',
    title: 'Stereo Room Reverb Slider',
    whatItDoes: 'Adds spacious studio echo so every note and pop sounds soft and smooth instead of sharp.',
  },
  'studio-audio-tab-mute': {
    id: 'studio-audio-tab-mute',
    title: 'Mute When Tab Blurred',
    whatItDoes: 'Automatically pauses sound if you click another browser tab or window.',
  },
  // Individual Viewport, Framing & QoL entries
  'studio-qol-aspect': {
    id: 'studio-qol-aspect',
    title: 'Stage Aspect Framing',
    whatItDoes: 'Choose 16:9 TV frame, 21:9 Ultrawide cinema, or Fill Screen edge-to-edge.',
  },
  'studio-qol-cursor': {
    id: 'studio-qol-cursor',
    title: 'Idle Cursor Hide',
    whatItDoes: 'Makes the mouse arrow fade away after 2s or 4s of sitting still so movies and tours look extra clean.',
  },
  'studio-qol-density': {
    id: 'studio-qol-density',
    title: 'HUD Density (Standard / Compact)',
    whatItDoes: 'Compact shrinks the top and bottom toolbars slightly so more of the game fills your screen.',
  },
  'studio-qol-opacity': {
    id: 'studio-qol-opacity',
    title: 'HUD Opacity Slider',
    whatItDoes: 'Makes toolbars more see-through or solid dark depending on what is easiest to read.',
  },
  'studio-qol-quality': {
    id: 'studio-qol-quality',
    title: 'Global Render Quality',
    whatItDoes: 'Auto picks the fastest setting for your PC. Eco reduces extra particles and belts for maximum speed.',
  },
  'studio-qol-fs-zen': {
    id: 'studio-qol-fs-zen',
    title: 'Fullscreen Auto-Zen HUD',
    whatItDoes: 'When checked, entering Fullscreen (F) hides menus automatically for a clean theater look.',
  },
  'studio-qol-caption-png': {
    id: 'studio-qol-caption-png',
    title: 'Include Scene Caption in PNG',
    whatItDoes: 'Adds a neat title and score stamp along the bottom when you snap a PNG screenshot.',
  },
  'studio-qol-top-hud': {
    id: 'studio-qol-top-hud',
    title: 'Show Top Stats HUD',
    whatItDoes: 'Shows or hides the transparent live scoreboard strip in the top center.',
  },
  'studio-qol-fps': {
    id: 'studio-qol-fps',
    title: 'Show FPS & Frame Time',
    whatItDoes: 'Shows or hides the live smoothness meter in the top-right bar.',
  },
  'studio-qol-aim': {
    id: 'studio-qol-aim',
    title: 'Show Trajectory Aim Guides',
    whatItDoes: 'Shows or hides the dotted helper lines when aiming Angry Birds or basketballs.',
  },
  'studio-qol-trails': {
    id: 'studio-qol-trails',
    title: 'Show Ball & Bird Trails',
    whatItDoes: 'Draws glowing motion ribbons behind flying birds and basketballs.',
  },
  'studio-qol-shake': {
    id: 'studio-qol-shake',
    title: 'Reduce Camera Impact Shake',
    whatItDoes: 'Keeps the camera extra steady and gentle during big TNT blasts or Temple Run stunts.',
  },
};

/**
 * All 12 Guided Tutorial Chapters covering the entire application from top to bottom.
 */
export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: 'ch-dock',
    number: '01',
    title: 'Minimal Floating Dock',
    subtitle: 'Switch between all 5 3D worlds, Auto/Manual & Sound',
    accent: '#38bdf8',
  },
  {
    id: 'ch-topbar',
    number: '02',
    title: 'Top Bar & Quick Tools',
    subtitle: 'Stats, FPS, Freedom Sandbox (B), v6.0 Log, Studio (C) & Hide UI',
    accent: '#22d3ee',
  },
  {
    id: 'ch-temple',
    number: '03',
    title: 'Temple Run 5.5',
    subtitle: 'Double-Jump Air Vault, Combo Fever, Relics & Graphics Quality',
    accent: '#10b981',
    scene: 'temple',
  },
  {
    id: 'ch-ocean',
    number: '04',
    title: 'Solar Horizon & Space',
    subtitle: 'Shimmering sunset ocean, Moon Almanac & 3D Solar System flight',
    accent: '#f59e0b',
    scene: 'ocean',
  },
  {
    id: 'ch-cyclist',
    number: '05',
    title: 'Coastline Tour',
    subtitle: 'Lock scenic biomes, pedal up to 10x speed & toggle MPH/KM/H',
    accent: '#a78bfa',
    scene: 'cyclist',
  },
  {
    id: 'ch-birds',
    number: '06',
    title: 'Angry Birds 5.0',
    subtitle: '6 castles, Rapid Fire, 5 Superpower Birds & physics tuning',
    accent: '#fb7185',
    scene: 'slingshot',
  },
  {
    id: 'ch-hoops',
    number: '07',
    title: 'All-Star Hoops',
    subtitle: '3 courts, Moving Hoop streaks, Court Spots & Net Confetti FX',
    accent: '#fbbf24',
    scene: 'basketball',
  },
  {
    id: 'ch-studio-themes',
    number: '08',
    title: 'Studio: Themes & Colors',
    subtitle: '4 HUD skins, outer frames & searching all 79 color presets',
    accent: '#e879f9',
    drawerTab: 'themes',
  },
  {
    id: 'ch-studio-tour',
    number: '09',
    title: 'Studio: Auto Tour',
    subtitle: 'Idle timers, dwell time, Smart Shuffle & scene checklist',
    accent: '#34d399',
    drawerTab: 'tour',
  },
  {
    id: 'ch-studio-pc',
    number: '10',
    title: 'Studio: PC Tune',
    subtitle: 'Hardware detection, 179Hz + UHD 770 frame pacing & bottlenecks',
    accent: '#60a5fa',
    drawerTab: 'pc',
  },
  {
    id: 'ch-studio-audio',
    number: '11',
    title: 'Studio: Audio & Viewport',
    subtitle: '4 sound moods, 6 layer sliders, Cozy Rain, EQ & 21:9 Ultrawide',
    accent: '#2dd4bf',
    drawerTab: 'audio',
  },
  {
    id: 'ch-studio-stats',
    number: '12',
    title: 'Studio: Stats & Backups',
    subtitle: 'Personal Bests, Snapshot Slots A/B/C & JSON export/import',
    accent: '#facc15',
    drawerTab: 'records',
  },
];

/**
 * Full step-by-step interactive click-through sequence across all 12 chapters.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── Chapter 01: Bottom Dock ────────────────────────────────────────────────
  {
    id: 'dock-temple-step',
    chapterId: 'ch-dock',
    targetId: 'dock-temple',
    title: '1. Jump Into Temple Run 5.5',
    description:
      'Down here is your main world switcher! Click Temple Run (or press 1) anytime to explore the 3D jungle runner.',
    tryThis: 'Click the highlighted Temple Run button, or press Next.',
    advanceOnClick: true,
    drawerOpen: false,
    preferPlacement: 'top',
  },
  {
    id: 'dock-worlds-step',
    chapterId: 'ch-dock',
    targetId: 'dock-worlds',
    title: 'All 5 Playable Worlds',
    description:
      'Pick any adventure: Temple Run, Solar Horizon (with outer space!), Coastline bike tour, Angry Birds 5.0, or All-Star Hoops.',
    tryThis: 'Click any game button to preview it, or press Next.',
    advanceOnClick: true,
    drawerOpen: false,
    preferPlacement: 'top',
  },
  {
    id: 'dock-auto-step',
    chapterId: 'ch-dock',
    targetId: 'dock-auto-mode',
    title: 'All: Auto vs Manual Play',
    description:
      'When set to Auto, the computer plays calmly for you like a living 3D screensaver. Switch to Manual when YOU want to take over!',
    tryThis: 'Click All: Auto / Manual (or press A), or click Next.',
    advanceOnClick: true,
    drawerOpen: false,
    preferPlacement: 'top',
  },
  {
    id: 'dock-sound-step',
    chapterId: 'ch-dock',
    targetId: 'dock-sound',
    title: 'Master Sound On / Off',
    description:
      'One tap here turns peaceful nature layers, gentle ambient pads, cozy rain, and game effects On or Off (hotkey M).',
    tryThis: 'Click Sound On/Off to test it, or press Next.',
    advanceOnClick: true,
    drawerOpen: false,
    preferPlacement: 'top',
  },

  // ── Chapter 02: Minimal Top Bar & Studio Quick Tools ───────────────────────
  {
    id: 'hud-telemetry-step',
    chapterId: 'ch-topbar',
    targetId: 'hud-telemetry',
    title: 'Clean Live Stats Strip',
    description:
      'Look up top! This compact strip shows your world title and key live stats without crowding your 3D view.',
    tryThis: 'Press Next to check the FPS smoothness counter.',
    drawerOpen: false,
    preferPlacement: 'bottom',
  },
  {
    id: 'hud-fps-step',
    chapterId: 'ch-topbar',
    targetId: 'hud-fps',
    title: 'FPS Smoothness Counter',
    description:
      'FPS means "Frames Per Second". Bigger numbers mean super smooth motion. If your device ever lags, open Sandbox -> Potato Mode!',
    tryThis: 'Press Next to open the Player Freedom Sandbox.',
    drawerOpen: false,
    preferPlacement: 'bottom',
  },
  {
    id: 'hud-sandbox-step',
    chapterId: 'ch-topbar',
    targetId: 'hud-sandbox',
    title: 'Freedom Sandbox & 3D Shaders (B)',
    description:
      'Tap Sandbox (or press B) for instant Gravity & Time sliders, Free 3D Orbit camera, 5 custom GLSL Shader Moods, Weather FX, and Potato Quality.',
    tryThis: 'Click Sandbox to peek inside, or press Next.',
    drawerOpen: false,
    preferPlacement: 'bottom',
  },
  {
    id: 'hud-release-step',
    chapterId: 'ch-topbar',
    targetId: 'hud-release-timer',
    title: 'Update 6.0 Log & Release Timer (U)',
    description:
      'View the complete Update Log (v1.0 to v6.0), explore all 25 new features, or schedule update releases as Owner.',
    tryThis: 'Press Next to see the Studio Drawer button.',
    drawerOpen: false,
    preferPlacement: 'bottom',
  },
  {
    id: 'hud-studio-step',
    chapterId: 'ch-topbar',
    targetId: 'hud-studio',
    title: 'Studio Control Drawer (C)',
    description:
      'Opens the clean slide-out Studio Drawer with Quick Tools up top plus 5 tabs: Themes, Auto Tour, PC Tune, Audio Mixer, and High Scores.',
    tryThis: 'Press Next to see the Hide UI button.',
    drawerOpen: false,
    preferPlacement: 'bottom',
  },
  {
    id: 'hud-zen-btn-step',
    chapterId: 'ch-topbar',
    targetId: 'hud-zen-btn',
    title: 'Hide All Menus (H)',
    description:
      'Want zero buttons on screen? Click Hide UI (or press H) to enjoy pure edge-to-edge 3D scenery!',
    tryThis: 'Press Next to open Studio Quick Tools!',
    drawerOpen: false,
    preferPlacement: 'bottom',
  },
  {
    id: 'studio-quick-tools-step',
    chapterId: 'ch-topbar',
    targetId: 'studio-quick-tools',
    title: 'Quick Tools: Guide, "i" Hints, Auto Tour & Search',
    description:
      'All helper tools live neatly here inside Studio: reopen this Guide (G), toggle "i" Info Hints, arm Auto Tour (T), Search (⌘K), Calm Audio, Photo (P), Keys (?), and Fullscreen (F)!',
    tryThis: 'Click Next to tour Temple Run 5.5 in 3D!',
    drawerOpen: true,
    drawerTab: 'themes',
    preferPlacement: 'left',
  },

  // ── Chapter 03: Temple Run 5.5 ─────────────────────────────────────────────
  {
    id: 'temple-score-step',
    chapterId: 'ch-temple',
    targetId: 'temple-score-card',
    title: 'Temple Run 5.5 Score & Fever',
    description:
      'Watch your Score, Distance, Coins, and Combo multiplier! Collect coins fast to build 5x Combo and Golden Fever (2x points).',
    tryThis: 'Press Next to check the Temple Run controls!',
    scene: 'temple',
    drawerOpen: false,
    prepareCommand: { scene: 'temple', openControls: true },
    preferPlacement: 'right',
  },
  {
    id: 'temple-quality-step',
    chapterId: 'ch-temple',
    targetId: 'temple-quality',
    title: 'Lag-Free Graphics Picker',
    description:
      'Auto picks super fast smooth settings for your graphics chip (so there is zero lag!). Switch between Auto, Fast, or High anytime.',
    tryThis: 'Try clicking Auto, Fast, or High, or press Next.',
    scene: 'temple',
    drawerOpen: false,
    prepareCommand: { scene: 'temple', openControls: true },
    advanceOnClick: true,
    preferPlacement: 'left',
  },
  {
    id: 'temple-mode-step',
    chapterId: 'ch-temple',
    targetId: 'temple-auto-manual',
    title: 'Auto AI Runner vs Manual Run',
    description:
      'Switch to Manual to play yourself! Use A / D to dodge lanes, S to slide under fire beams, and tap W or Space TWICE to Double Jump Air Vault!',
    tryThis: 'Click Auto/Manual to try taking the wheel, or press Next.',
    scene: 'temple',
    drawerOpen: false,
    prepareCommand: { scene: 'temple', openControls: true },
    advanceOnClick: true,
    preferPlacement: 'left',
  },

  // ── Chapter 04: Solar Horizon & Space View ─────────────────────────────────
  {
    id: 'ocean-plaque-step',
    chapterId: 'ch-ocean',
    targetId: 'ocean-plaque',
    title: 'Sunset Ocean & Heat Shimmer',
    description:
      'Look at the horizon line shimmer gently as distant bird silhouettes glide across the waves! This card shows real sunrise, sunset, and Moon phase.',
    tryThis: 'Press Next to peek inside the Moon Almanac!',
    scene: 'ocean',
    drawerOpen: false,
    prepareCommand: { scene: 'ocean', openControls: true, spaceView: false },
    preferPlacement: 'right',
  },
  {
    id: 'ocean-sync-step',
    chapterId: 'ch-ocean',
    targetId: 'ocean-sync-sky',
    title: 'Real Sky vs Sunset Loop',
    description:
      'Classic Mode cycles sunrise to starry midnight continuously. Sync BA Sky locks the sky to the real sun position in Broken Arrow, OK.',
    tryThis: 'Click Sync BA Sky / BA Sky Live to compare, or press Next.',
    scene: 'ocean',
    drawerOpen: false,
    prepareCommand: { scene: 'ocean', openControls: true, spaceView: false },
    advanceOnClick: true,
    preferPlacement: 'right',
  },
  {
    id: 'ocean-controls-step',
    chapterId: 'ch-ocean',
    targetId: 'ocean-controls-panel',
    title: 'Wave Speed, Moon & Sky Sliders',
    description:
      'Drag Wave Speed to calm or speed up ocean swells, link Moon phases, and control how fast sunsets glide across the water.',
    tryThis: 'Press Next—next stop is OUTER SPACE!',
    scene: 'ocean',
    drawerOpen: false,
    prepareCommand: { scene: 'ocean', openControls: true, spaceView: false },
    preferPlacement: 'left',
  },
  {
    id: 'ocean-space-launch-step',
    chapterId: 'ch-ocean',
    targetId: 'ocean-space-view',
    title: 'Launch Into 3D Space View!',
    description:
      'Ready to fly past the Moon? Click Space View to zoom all the way into our 3D Solar System with Mercury, Earth, Saturn, and Pluto!',
    tryThis: 'Click Space View or press Next to launch!',
    scene: 'ocean',
    drawerOpen: false,
    prepareCommand: { scene: 'ocean', openControls: true, spaceView: false },
    advanceOnClick: true,
    preferPlacement: 'right',
  },
  {
    id: 'space-dock-step',
    chapterId: 'ch-ocean',
    targetId: 'space-dock',
    title: 'Space Flight Deck',
    description:
      'Welcome to Space! Use Showcase vs True AU distance, speed up planet orbits (up to 6 Mo/s!), toggle Asteroid Belts, or click any floating planet label to inspect it.',
    tryThis: 'Try clicking a Time Warp speed or Ocean to fly back, or press Next.',
    scene: 'ocean',
    drawerOpen: false,
    prepareCommand: { scene: 'ocean', spaceView: true },
    preferPlacement: 'top',
  },

  // ── Chapter 05: Coastline Tour ─────────────────────────────────────────────
  {
    id: 'cyclist-scenery-step',
    chapterId: 'ch-cyclist',
    targetId: 'cyclist-scenery',
    title: 'Pick Your Bike Trail Region',
    description:
      'Ride across the USA Tour, snowy Rockies, sunny Southwest Desert, or cozy American Suburbs. Click any region to pedal right there!',
    tryThis: 'Click a scenery tab (Rockies, Desert, Suburbs) or press Next.',
    scene: 'cyclist',
    drawerOpen: false,
    prepareCommand: { scene: 'cyclist', openControls: true },
    advanceOnClick: true,
    preferPlacement: 'right',
  },
  {
    id: 'cyclist-lock-units-step',
    chapterId: 'ch-cyclist',
    targetId: 'cyclist-top-badges',
    title: 'MPH / KM/H & Scenery Lock',
    description:
      'Swap miles vs kilometers anytime, and press Lock if you want to stay inside your favorite landscape without changing.',
    tryThis: 'Press Next to control bike speed and wind!',
    scene: 'cyclist',
    drawerOpen: false,
    prepareCommand: { scene: 'cyclist', openControls: true },
    preferPlacement: 'right',
  },
  {
    id: 'cyclist-speed-step',
    chapterId: 'ch-cyclist',
    targetId: 'cyclist-speed-row',
    title: 'Pedal Faster & Wind Streaks',
    description:
      'Slide Cruise Target to change your relaxed Auto speed, toggle Wind On/Off, or switch to Manual and tap Spacebar fast to race up to 10x speed!',
    tryThis: 'Press Next to visit Angry Birds 5.0!',
    scene: 'cyclist',
    drawerOpen: false,
    prepareCommand: { scene: 'cyclist', openControls: true },
    preferPlacement: 'right',
  },

  // ── Chapter 06: Angry Birds 5.0 ────────────────────────────────────────────
  {
    id: 'birds-stages-step',
    chapterId: 'ch-birds',
    targetId: 'birds-fortresses',
    title: '6 Piggy Fortresses (5.0 Update)',
    description:
      'Choose from 6 destructible levels—like Frostbite Spires, TNT Quarry, and Skyway Bouncer! Or press Shift+1 through Shift+6.',
    tryThis: 'Click any fortress stage to load it, or press Next.',
    scene: 'slingshot',
    drawerOpen: false,
    prepareCommand: { scene: 'slingshot', openControls: true },
    advanceOnClick: true,
    preferPlacement: 'right',
  },
  {
    id: 'birds-quiver-cam-step',
    chapterId: 'ch-birds',
    targetId: 'birds-quiver-cam',
    title: 'Infinite Birds & Follow Camera',
    description:
      'Choose ∞ for unlimited birds or 3/5/7 for classic challenge. Wide shows the whole stage; Cam rides behind your bird as it flies!',
    tryThis: 'Press Next to check physics and rapid fire.',
    scene: 'slingshot',
    drawerOpen: false,
    prepareCommand: { scene: 'slingshot', openControls: true },
    preferPlacement: 'right',
  },
  {
    id: 'birds-physics-step',
    chapterId: 'ch-birds',
    targetId: 'birds-physics-grid',
    title: 'Ground FX, Aim Dots & Gravity',
    description:
      'Customize dust/craters, make your dotted Aim Arc longer, or try Low-G Moon gravity and Breezy Headwind!',
    tryThis: 'Press Next to unlock Rapid-Fire & Mid-Air powers.',
    scene: 'slingshot',
    drawerOpen: false,
    prepareCommand: { scene: 'slingshot', openControls: true },
    preferPlacement: 'right',
  },
  {
    id: 'birds-rapid-step',
    chapterId: 'ch-birds',
    targetId: 'birds-rapid-grid',
    title: 'Rapid Fire & Bird Collisions',
    description:
      'Drag lets you pull back the slingshot. Rapid lets you click anywhere to launch birds non-stop! Cleanup keeps your PC super smooth.',
    tryThis: 'Press Next to meet the 5 Superpower Birds!',
    scene: 'slingshot',
    drawerOpen: false,
    prepareCommand: { scene: 'slingshot', openControls: true },
    preferPlacement: 'right',
  },
  {
    id: 'birds-roster-step',
    chapterId: 'ch-birds',
    targetId: 'birds-roster-bar',
    title: '5 Superpower Birds & Space Ability',
    description:
      'Pick Red (Sonic Push), Chuck (Speed Boost), Blues (Splits into 3!), Bomb (Explodes!), or Matilda (Drops Explosive Egg!). Tap Spacebar mid-flight!',
    tryThis: 'Click any bird in the roster to put them in the slingshot, or press Next.',
    scene: 'slingshot',
    drawerOpen: false,
    prepareCommand: { scene: 'slingshot', openControls: true },
    advanceOnClick: true,
    preferPlacement: 'top',
  },

  // ── Chapter 07: All-Star Hoops ─────────────────────────────────────────────
  {
    id: 'hoops-venue-step',
    chapterId: 'ch-hoops',
    targetId: 'hoops-venue',
    title: 'Pick Your Basketball Court',
    description:
      'Play inside the glowing Pro Arena, outdoors at sunny Streetball, or inside a classic Retro Gym! Score 3 in a row to make the hoop move!',
    tryThis: 'Click a court style to transform the arena, or press Next.',
    scene: 'basketball',
    drawerOpen: false,
    prepareCommand: { scene: 'basketball', openControls: true },
    advanceOnClick: true,
    preferPlacement: 'right',
  },
  {
    id: 'hoops-options-step',
    chapterId: 'ch-hoops',
    targetId: 'hoops-play-options',
    title: 'Shooter, Court Spots & Shot Style',
    description:
      'Toggle the player on/off, lock your feet or move with A/D, pick Mixed/Swish/Bank shots, or teleport to Deep, Wing, Top Key, or Paint!',
    tryThis: 'Press Next to customize Confetti & Throw Power.',
    scene: 'basketball',
    drawerOpen: false,
    prepareCommand: { scene: 'basketball', openControls: true },
    preferPlacement: 'right',
  },
  {
    id: 'hoops-fx-step',
    chapterId: 'ch-hoops',
    targetId: 'hoops-fx-controls',
    title: 'Swish Confetti, Throw Power & Shoot!',
    description:
      'Pick Confetti or Smoke bursts on every bucket, toggle the glowing Aim Arc, adjust Throw Power, or hit Shoot to sink one right now!',
    tryThis: 'Click Shoot or press Next to open the Studio Settings Drawer!',
    scene: 'basketball',
    drawerOpen: false,
    prepareCommand: { scene: 'basketball', openControls: true },
    preferPlacement: 'right',
  },

  // ── Chapter 08: Studio Themes Tab ──────────────────────────────────────────
  {
    id: 'studio-skin-step',
    chapterId: 'ch-studio-themes',
    targetId: 'studio-skin',
    title: 'Studio Themes: 4 Visual Skins',
    description:
      'Welcome to the Studio Drawer! Pick Neo-Arcade, Obsidian, Scoreboard, or bright Swiss Day to change how every menu card looks.',
    tryThis: 'Click any Skin button to preview it live, or press Next.',
    drawerOpen: true,
    drawerTab: 'themes',
    advanceOnClick: true,
    preferPlacement: 'left',
  },
  {
    id: 'studio-surround-step',
    chapterId: 'ch-studio-themes',
    targetId: 'studio-surround',
    title: 'Outer Frame Backdrop',
    description:
      'Changes the space outside the game window—soft Scene Glow, Sunset Gradient, Dark Obsidian, or Architectural Grid.',
    tryThis: 'Click an Outer Frame button, or press Next.',
    drawerOpen: true,
    drawerTab: 'themes',
    advanceOnClick: true,
    preferPlacement: 'left',
  },
  {
    id: 'studio-scope-mix-step',
    chapterId: 'ch-studio-themes',
    targetId: 'studio-scope-mix',
    title: 'Global Lock & Surprise Mix',
    description:
      'Global keeps 1 color everywhere; Per-Scene saves unique colors per game! HUD+Scene tints the world too. Press Mix for a fun random theme!',
    tryThis: 'Click Mix to roll a surprise color theme, or press Next.',
    drawerOpen: true,
    drawerTab: 'themes',
    advanceOnClick: true,
    preferPlacement: 'left',
  },
  {
    id: 'studio-presets-step',
    chapterId: 'ch-studio-themes',
    targetId: 'studio-presets-browser',
    title: 'Search & Star 79 Color Presets',
    description:
      'Filter by Mood (Dark, Vivid, Daylight, Minimal), type to search all 79 themes, or tap the Star icon to save your favorites!',
    tryThis: 'Press Next to visit the Auto Tour tab!',
    drawerOpen: true,
    drawerTab: 'themes',
    preferPlacement: 'left',
  },

  // ── Chapter 09: Studio Tour Tab ────────────────────────────────────────────
  {
    id: 'studio-tour-arm-step',
    chapterId: 'ch-studio-tour',
    targetId: 'studio-tour-arm',
    title: 'Auto Tour Master Switch',
    description:
      'Turn Auto Tour on so the app automatically gives you a scenic tour of your favorite games whenever you step away.',
    tryThis: 'Click Enable/Armed to test it, or press Next.',
    drawerOpen: true,
    drawerTab: 'tour',
    preferPlacement: 'left',
  },
  {
    id: 'studio-tour-timing-step',
    chapterId: 'ch-studio-tour',
    targetId: 'studio-tour-timing',
    title: 'Idle Wait & Time Per Game',
    description:
      'Pick how long before the tour starts (5s–30s) and how long it stays inside each world (10s–90s) before gliding to the next.',
    tryThis: 'Press Next to pick which scenes join the tour.',
    drawerOpen: true,
    drawerTab: 'tour',
    preferPlacement: 'left',
  },
  {
    id: 'studio-tour-scenes-step',
    chapterId: 'ch-studio-tour',
    targetId: 'studio-tour-scenes',
    title: 'Scene Picker & Smart Rules',
    description:
      'Check which of the 5 worlds you want in rotation, pick Sequential vs Shuffle, and keep Auto-Pause on Hover so it never switches while you adjust settings.',
    tryThis: 'Press Next to open PC Tune!',
    drawerOpen: true,
    drawerTab: 'tour',
    preferPlacement: 'left',
  },

  // ── Chapter 10: Studio PC Tune Tab ─────────────────────────────────────────
  {
    id: 'studio-pc-profile-step',
    chapterId: 'ch-studio-pc',
    targetId: 'studio-pc-profile',
    title: 'Your PC Profile & 1-Click Match',
    description:
      'See your exact Graphics Card, CPU Threads, Screen Resolution, and Refresh Rate! Click Match My PC anytime to eliminate lag automatically.',
    tryThis: 'Click Match My PC to optimize your screen, or press Next.',
    drawerOpen: true,
    drawerTab: 'pc',
    advanceOnClick: true,
    preferPlacement: 'left',
  },
  {
    id: 'studio-pc-pacing-step',
    chapterId: 'ch-studio-pc',
    targetId: 'studio-pc-pacing',
    title: 'Frame Pacing & Scaling Modes',
    description:
      'Auto PC Match keeps all 5 Three.js 3D worlds ultra-smooth on any screen, while Potato Mode lowers pixel density and shadows for older devices!',
    tryThis: 'Press Next to see your PC bottleneck check.',
    drawerOpen: true,
    drawerTab: 'pc',
    preferPlacement: 'left',
  },
  {
    id: 'studio-pc-bottlenecks-step',
    chapterId: 'ch-studio-pc',
    targetId: 'studio-pc-bottlenecks',
    title: 'Hardware Tips & Bottlenecks',
    description:
      'If your monitor or graphics chip has any special quirks (like ultrawide 3440×1440 resolution or shared iGPU VRAM), this card explains how we tuned around it.',
    tryThis: 'Press Next to open the Calm Audio & Screen tab!',
    drawerOpen: true,
    drawerTab: 'pc',
    preferPlacement: 'left',
  },

  // ── Chapter 11: Studio Audio & Viewport Tab ────────────────────────────────
  {
    id: 'studio-audio-moods-step',
    chapterId: 'ch-studio-audio',
    targetId: 'studio-audio-moods',
    title: '4 Calm Soundscape Presets & Test Chime',
    description:
      'Pick Deep Calm, Nature Walk, Rainy Evening, or Classic in one click! Tap Test Chime anytime to hear how peaceful your audio sounds.',
    tryThis: 'Click Test Chime or pick a Sound Mood, or press Next.',
    drawerOpen: true,
    drawerTab: 'audio',
    preferPlacement: 'left',
  },
  {
    id: 'studio-audio-sliders-step',
    chapterId: 'ch-studio-audio',
    targetId: 'studio-audio-sliders',
    title: '6 Sound Layers & Quick Mute Chips',
    description:
      'Mix Nature/World, Warm Ambient Pads, Cozy Rain, Game SFX, and Stereo Reverb to perfection—or mute individual layers like Rain with one tap!',
    tryThis: 'Press Next to check Acoustic EQ & Screen Framing.',
    drawerOpen: true,
    drawerTab: 'audio',
    preferPlacement: 'left',
  },
  {
    id: 'studio-viewport-qol-step',
    chapterId: 'ch-studio-audio',
    targetId: 'studio-viewport-qol',
    title: 'Aspect Ratio, HUD Opacity & Visual FX',
    description:
      'Switch between 16:9 Cinema, 21:9 Ultrawide, or Full Screen! Hide idle cursors, shrink/fade the HUD, set Quality Tier, or toggle Aim Guides & Camera Shake.',
    tryThis: 'Press Next for the final chapter: High Scores & Backups!',
    drawerOpen: true,
    drawerTab: 'audio',
    preferPlacement: 'left',
  },

  // ── Chapter 12: Studio Stats & Save Tab ────────────────────────────────────
  {
    id: 'studio-records-step',
    chapterId: 'ch-studio-stats',
    targetId: 'studio-records-grid',
    title: 'Your Lifetime Personal Bests',
    description:
      'Every Hoops Streak, Clean Swish, Angry Birds high score, Temple Run distance, and Coastline top speed is safely remembered right here!',
    tryThis: 'Press Next to see Snapshot Slots A / B / C.',
    drawerOpen: true,
    drawerTab: 'records',
    preferPlacement: 'left',
  },
  {
    id: 'studio-snapshots-step',
    chapterId: 'ch-studio-stats',
    targetId: 'studio-snapshots',
    title: '3 Saved Vibe Slots (A / B / C)',
    description:
      'Made a super cool combo of game, colors, and rainy sounds? Click Save on Slot A, B, or C to bookmark that exact setup forever!',
    tryThis: 'Click Save on Slot A if you like, or press Next.',
    drawerOpen: true,
    drawerTab: 'records',
    preferPlacement: 'left',
  },
  {
    id: 'studio-export-step',
    chapterId: 'ch-studio-stats',
    targetId: 'studio-export-reset',
    title: 'PNG Photos, JSON Backups & Reset',
    description:
      'Download a PNG snapshot, export or reload your settings JSON file, or reset your high scores (with an Undo button if you change your mind). You did it—you know the entire app!',
    tryThis: 'Click Finish Tour—you can press Guide or toggle "i" hints anytime!',
    drawerOpen: true,
    drawerTab: 'records',
    preferPlacement: 'left',
  },
];
