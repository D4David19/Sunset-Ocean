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

export type SceneId = 'temple' | 'ocean' | 'cyclist' | 'slingshot' | 'basketball';
export type AcousticProfile = 'calm' | 'warm' | 'arcade' | 'broadcast';
export type SfxStyle = 'peaceful' | 'classic';
export type SoundMoodPreset =
  | 'deep-calm'
  | 'nature-walk'
  | 'rainy-evening'
  | 'classic'
  | 'custom';
export type CoastlineBiome = 'mountains' | 'desert' | 'homes';

interface AudioManagerContextValue {
  soundEnabled: boolean;
  masterVolume: number;
  ambienceVolume: number;
  padsVolume: number;
  rainVolume: number;
  sfxVolume: number;
  reverbMix: number;
  masterMuted: boolean;
  ambienceMuted: boolean;
  padsMuted: boolean;
  rainMuted: boolean;
  sfxMuted: boolean;
  crowdMuted: boolean;
  muteOnTabBlur: boolean;
  acousticProfile: AcousticProfile;
  sfxStyle: SfxStyle;
  toggleSound: () => void;
  setSoundEnabledState: (enabled: boolean) => void;
  setMasterVolume: (vol: number) => void;
  setAmbienceVolume: (vol: number) => void;
  setPadsVolume: (vol: number) => void;
  setRainVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  setReverbMix: (vol: number) => void;
  setMasterMuted: (muted: boolean) => void;
  setAmbienceMuted: (muted: boolean) => void;
  setPadsMuted: (muted: boolean) => void;
  setRainMuted: (muted: boolean) => void;
  setSfxMuted: (muted: boolean) => void;
  setCrowdMuted: (muted: boolean) => void;
  setMuteOnTabBlur: (enabled: boolean) => void;
  setAcousticProfile: (profile: AcousticProfile) => void;
  setSfxStyle: (style: SfxStyle) => void;
  setActiveSceneAudio: (scene: SceneId) => void;
  setCyclistSpeed: (speedMultiplier: number) => void;
  setOceanSpaceBlend: (blend: number) => void;
  setCoastlineBiome: (biome: CoastlineBiome) => void;
  playCoinChime: () => void;
  playJumpCue: () => void;
  playPowerUpCue: (kind: 'speed' | 'shield' | 'magnet' | 'fever') => void;
  playShieldBreakCue: () => void;
  playHurtCue: () => void;
  playSlingshotStretchCue: () => void;
  playSlingshotReleaseCue: () => void;
  playBlockImpactCue: (
    intensity: number,
    kind?: 'wood' | 'ice' | 'stone' | 'pig' | 'tnt' | 'bouncer' | 'boulder'
  ) => void;
  playGroundImpactCue: (
    intensity: number,
    kind?: 'wood' | 'ice' | 'stone' | 'pig' | 'bird' | 'soil' | 'tnt' | 'bouncer' | 'boulder'
  ) => void;
  playAbilityCue: (birdType: 'red' | 'chuck' | 'blues' | 'bomb' | 'terence') => void;
  playExplosionCue: (intensity?: number) => void;
  playVictoryFanfareCue: (stars?: number) => void;
  playBasketballSwishCue: () => void;
  playBasketballRimCue: (intensity?: number) => void;
  playBasketballBoardCue: (intensity?: number) => void;
  playBasketballBounceCue: (intensity?: number) => void;
  playBasketballHornCue: () => void;
  playBasketballCheerCue: (intensity?: number) => void;
  playPlanetFocusCue: () => void;
  playTestChimeCue: () => void;
}

const AudioManagerContext = createContext<AudioManagerContextValue | null>(null);

// Warm pink/brown seamless loopable noise buffer (low CPU, pre-allocated once)
function createSeamlessNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let brown = 0;
    const raw = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      brown = (brown + 0.018 * white) / 1.018;
      raw[i] = (b0 + b1 + b2) * 0.45 + brown * 2.1;
    }

    const fadeSamples = Math.min(Math.floor(sampleRate * 0.65), Math.floor(length * 0.25));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const eqIn = Math.sin(t * Math.PI * 0.5);
      const eqOut = Math.cos(t * Math.PI * 0.5);
      const tailIdx = length - fadeSamples + i;
      const blended = raw[i] * eqIn + raw[tailIdx] * eqOut;
      raw[i] = blended;
      raw[tailIdx] = blended;
    }

    let peak = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(raw[i]);
      if (abs > peak) peak = abs;
    }
    const norm = peak > 0 ? 0.85 / peak : 1;
    for (let i = 0; i < length; i++) {
      data[i] = raw[i] * norm;
    }
  }

  return buffer;
}

// Seamless raindrop patter texture blended with soft pink mist (allocated once)
function createSoftRainPatterBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const raw = new Float32Array(length);
    let lp = 0;

    // Gentle filtered mist base
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lp = lp * 0.92 + white * 0.08;
      raw[i] = lp * 0.35;
    }

    // Scatter organic soft raindrops on leaves/roof
    const dropCount = Math.floor(durationSec * 42);
    for (let d = 0; d < dropCount; d++) {
      const start = Math.floor(Math.random() * (length - 400));
      const dropLen = Math.floor((0.008 + Math.random() * 0.014) * sampleRate);
      const amp = 0.08 + Math.random() * 0.16;
      const freq = 900 + Math.random() * 2400;
      for (let j = 0; j < dropLen && start + j < length; j++) {
        const env = Math.exp((-j / dropLen) * 5.5) * Math.sin((j / dropLen) * Math.PI);
        const phase = (j / sampleRate) * freq * Math.PI * 2;
        raw[start + j] += Math.sin(phase) * env * amp;
      }
    }

    const fadeSamples = Math.min(Math.floor(sampleRate * 0.5), Math.floor(length * 0.2));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const eqIn = Math.sin(t * Math.PI * 0.5);
      const eqOut = Math.cos(t * Math.PI * 0.5);
      const tailIdx = length - fadeSamples + i;
      const blended = raw[i] * eqIn + raw[tailIdx] * eqOut;
      raw[i] = blended;
      raw[tailIdx] = blended;
    }

    let peak = 0;
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(raw[i]);
      if (abs > peak) peak = abs;
    }
    const norm = peak > 0 ? 0.85 / peak : 1;
    for (let i = 0; i < length; i++) {
      data[i] = raw[i] * norm;
    }
  }

  return buffer;
}

// Warm progressively-damped stereo hall impulse response (allocated once)
function createWarmImpulseResponse(
  ctx: AudioContext,
  durationSec = 2.1,
  decayRate = 2.8
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const ir = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp1 = 0;
    let lp2 = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const fadeIn = Math.min(1, i / (sampleRate * 0.018));
      const env = Math.pow(1 - t, decayRate) * fadeIn;
      const white = (Math.random() * 2 - 1) * env;
      // Two-pole progressive warm air absorption
      const damping = 0.72 + t * 0.22;
      lp1 = lp1 * damping + white * (1 - damping);
      lp2 = lp2 * 0.65 + lp1 * 0.35;
      data[i] = lp2 * 0.85;
    }
  }
  return ir;
}

// Lush warm suspended & Maj9 chord progression (Fmaj9 -> Dm9 -> Bbmaj7 -> Csus2)
const PAD_CHORDS_HZ: ReadonlyArray<readonly [number, number, number, number]> = [
  [174.61, 220.0, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
  [146.83, 220.0, 261.63, 329.63], // Dm9 (D3, A3, C4, E4)
  [116.54, 174.61, 220.0, 293.66], // Bbmaj7 (Bb2, F3, A3, D4)
  [130.81, 196.0, 246.94, 293.66], // Cmaj9 (C3, G3, B3, D4)
];

// Gentle F major pentatonic notes for organic wind chimes & space bells
const PENTATONIC_CHIMES_HZ = [523.25, 587.33, 698.46, 880.0, 1046.5, 1174.66];
const ORBITAL_BELLS_HZ = [440.0, 523.25, 659.25, 783.99, 987.77, 1318.51];

interface AudioGraph {
  ctx: AudioContext;
  masterGain: GainNode;
  eqLowShelf: BiquadFilterNode;
  eqMidDip: BiquadFilterNode;
  eqHighShelf: BiquadFilterNode;
  ambienceBusGain: GainNode;
  padBusGain: GainNode;
  rainBusGain: GainNode;
  sfxBusGain: GainNode;
  sfxReverbTapGain: GainNode;
  reverbSendGain: GainNode;
  reverbReturnGain: GainNode;
  oceanBusGain: GainNode;
  spaceBusGain: GainNode;
  cyclistBusGain: GainNode;
  templeBusGain: GainNode;
  slingshotBusGain: GainNode;
  hoopsBusGain: GainNode;
  aeroFilter: BiquadFilterNode;
  aeroGain: GainNode;
  padOscs: OscillatorNode[];
  padSubOsc: OscillatorNode;
  noiseBuf: AudioBuffer;
  rainBuf: AudioBuffer;
  dispose: () => void;
}

export function AudioManagerProvider({
  children,
  initialScene = 'temple',
}: {
  children: ReactNode;
  initialScene?: SceneId;
}) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(0.78);
  const [ambienceVolume, setAmbienceVolumeState] = useState(0.8);
  const [padsVolume, setPadsVolumeState] = useState(0.62);
  const [rainVolume, setRainVolumeState] = useState(0.28);
  const [sfxVolume, setSfxVolumeState] = useState(0.85);
  const [reverbMix, setReverbMixState] = useState(0.55);

  const [masterMuted, setMasterMutedState] = useState(false);
  const [ambienceMuted, setAmbienceMutedState] = useState(false);
  const [padsMuted, setPadsMutedState] = useState(false);
  const [rainMuted, setRainMutedState] = useState(false);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const [crowdMuted, setCrowdMutedState] = useState(false);
  const [muteOnTabBlur, setMuteOnTabBlurState] = useState(true);
  const [acousticProfile, setAcousticProfileState] = useState<AcousticProfile>('calm');
  const [sfxStyle, setSfxStyleState] = useState<SfxStyle>('peaceful');

  const soundEnabledRef = useRef(false);
  const masterVolumeRef = useRef(0.78);
  const ambienceVolumeRef = useRef(0.8);
  const padsVolumeRef = useRef(0.62);
  const rainVolumeRef = useRef(0.28);
  const sfxVolumeRef = useRef(0.85);
  const reverbMixRef = useRef(0.55);

  const masterMutedRef = useRef(false);
  const ambienceMutedRef = useRef(false);
  const padsMutedRef = useRef(false);
  const rainMutedRef = useRef(false);
  const sfxMutedRef = useRef(false);
  const crowdMutedRef = useRef(false);
  const muteOnTabBlurRef = useRef(true);
  const acousticProfileRef = useRef<AcousticProfile>('calm');
  const sfxStyleRef = useRef<SfxStyle>('peaceful');

  const tabHiddenRef = useRef(false);
  const sceneRef = useRef<SceneId>(initialScene);
  const oceanSpaceBlendRef = useRef(0);
  const cyclistBiomeRef = useRef<CoastlineBiome>('mountains');
  const graphRef = useRef<AudioGraph | null>(null);
  const suspendTimerRef = useRef<number | null>(null);
  const lastStretchCueMsRef = useRef(0);

  const applyMix = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const now = graph.ctx.currentTime;
    const suppressedByTab = muteOnTabBlurRef.current && tabHiddenRef.current;
    const shouldPlay = soundEnabledRef.current && !masterMutedRef.current && !suppressedByTab;

    if (suspendTimerRef.current !== null) {
      window.clearTimeout(suspendTimerRef.current);
      suspendTimerRef.current = null;
    }

    if (shouldPlay && graph.ctx.state === 'suspended') {
      void graph.ctx.resume();
    }

    const isRunning = graph.ctx.state === 'running';
    const masterActive = shouldPlay && isRunning;
    const masterTarget = masterActive ? masterVolumeRef.current * 0.64 : 0;

    // Scene crossfades (including Solar Horizon Shore <-> Space View)
    const spaceBlend = Math.max(0, Math.min(1, oceanSpaceBlendRef.current));
    const oceanTarget = sceneRef.current === 'ocean' ? Math.max(0.03, 1 - spaceBlend * 0.96) : 0;
    const spaceTarget = sceneRef.current === 'ocean' ? spaceBlend : 0;
    const cyclistTarget = sceneRef.current === 'cyclist' ? 1 : 0;
    const templeTarget = sceneRef.current === 'temple' ? 1 : 0;
    const slingshotTarget = sceneRef.current === 'slingshot' ? 1 : 0;
    const hoopsTarget = sceneRef.current === 'basketball' ? 1 : 0;

    // 3-band EQ voicing
    let lowGain = 1.6;
    let midDip = 0;
    let highGain = 1.0;
    if (acousticProfileRef.current === 'calm') {
      lowGain = 2.4;
      midDip = -2.2;
      highGain = -3.0;
    } else if (acousticProfileRef.current === 'warm') {
      lowGain = 3.0;
      midDip = -2.6;
      highGain = -5.2;
    } else if (acousticProfileRef.current === 'broadcast') {
      lowGain = -1.2;
      midDip = 0.5;
      highGain = 2.4;
    }

    graph.eqLowShelf.gain.setTargetAtTime(lowGain, now, 0.14);
    graph.eqMidDip.gain.setTargetAtTime(midDip, now, 0.14);
    graph.eqHighShelf.gain.setTargetAtTime(highGain, now, 0.14);

    graph.masterGain.gain.setTargetAtTime(masterTarget, now, masterTarget > 0 ? 0.28 : 0.09);
    graph.ambienceBusGain.gain.setTargetAtTime(
      ambienceMutedRef.current ? 0 : ambienceVolumeRef.current,
      now,
      0.12
    );
    graph.padBusGain.gain.setTargetAtTime(
      padsMutedRef.current ? 0 : padsVolumeRef.current * 0.52,
      now,
      0.18
    );
    graph.rainBusGain.gain.setTargetAtTime(
      rainMutedRef.current ? 0 : rainVolumeRef.current * 0.72,
      now,
      0.16
    );
    graph.sfxBusGain.gain.setTargetAtTime(
      sfxMutedRef.current ? 0 : sfxVolumeRef.current,
      now,
      0.06
    );
    graph.reverbReturnGain.gain.setTargetAtTime(0.12 + reverbMixRef.current * 0.78, now, 0.14);
    graph.sfxReverbTapGain.gain.setTargetAtTime(
      sfxStyleRef.current === 'peaceful'
        ? 0.22 + reverbMixRef.current * 0.36
        : 0.08 + reverbMixRef.current * 0.18,
      now,
      0.1
    );

    graph.oceanBusGain.gain.setTargetAtTime(oceanTarget, now, 0.42);
    graph.spaceBusGain.gain.setTargetAtTime(spaceTarget, now, 0.48);
    graph.cyclistBusGain.gain.setTargetAtTime(cyclistTarget, now, 0.38);
    graph.templeBusGain.gain.setTargetAtTime(templeTarget, now, 0.38);
    graph.slingshotBusGain.gain.setTargetAtTime(slingshotTarget, now, 0.38);
    graph.hoopsBusGain.gain.setTargetAtTime(hoopsTarget, now, 0.38);

    // Suspend AudioContext gracefully when muted/blurred to save CPU
    if (!shouldPlay && graph.ctx.state === 'running') {
      suspendTimerRef.current = window.setTimeout(() => {
        const g = graphRef.current;
        if (!g) return;
        const stillSuppressed =
          !soundEnabledRef.current ||
          masterMutedRef.current ||
          (muteOnTabBlurRef.current && tabHiddenRef.current);
        if (stillSuppressed && g.ctx.state === 'running') {
          void g.ctx.suspend();
        }
      }, 480);
    }
  }, []);

  const ensureAudioGraph = useCallback((): AudioGraph | null => {
    if (graphRef.current) return graphRef.current;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();

    // Master EQ + Gentle Soft Limiter
    const eqLowShelf = ctx.createBiquadFilter();
    eqLowShelf.type = 'lowshelf';
    eqLowShelf.frequency.value = 175;
    eqLowShelf.gain.value = 2.4;

    const eqMidDip = ctx.createBiquadFilter();
    eqMidDip.type = 'peaking';
    eqMidDip.frequency.value = 2350;
    eqMidDip.Q.value = 0.85;
    eqMidDip.gain.value = -2.2;

    const eqHighShelf = ctx.createBiquadFilter();
    eqHighShelf.type = 'highshelf';
    eqHighShelf.frequency.value = 3400;
    eqHighShelf.gain.value = -3.0;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 18;
    limiter.ratio.value = 3.5;
    limiter.attack.value = 0.015;
    limiter.release.value = 0.25;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);

    eqLowShelf.connect(eqMidDip);
    eqMidDip.connect(eqHighShelf);
    eqHighShelf.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Pre-allocated seamless textures & impulse buffer
    const noiseBuf = createSeamlessNoiseBuffer(ctx, 14);
    const rainBuf = createSoftRainPatterBuffer(ctx, 10);
    const irBuf = createWarmImpulseResponse(ctx, 2.1, 2.8);

    // Shared Stereo Convolution Reverb Bus
    const reverbSendGain = ctx.createGain();
    reverbSendGain.gain.value = 0.9;
    const reverbPreDelay = ctx.createDelay(0.1);
    reverbPreDelay.delayTime.value = 0.022;
    const reverbConvolver = ctx.createConvolver();
    reverbConvolver.buffer = irBuf;
    const reverbDamping = ctx.createBiquadFilter();
    reverbDamping.type = 'lowpass';
    reverbDamping.frequency.value = 2700;
    const reverbReturnGain = ctx.createGain();
    reverbReturnGain.gain.value = 0.55;

    reverbSendGain.connect(reverbPreDelay);
    reverbPreDelay.connect(reverbConvolver);
    reverbConvolver.connect(reverbDamping);
    reverbDamping.connect(reverbReturnGain);
    reverbReturnGain.connect(eqLowShelf);

    // Layer Sub-Mixers
    const ambienceBusGain = ctx.createGain();
    ambienceBusGain.gain.value = ambienceMutedRef.current ? 0 : ambienceVolumeRef.current;
    ambienceBusGain.connect(eqLowShelf);

    const padBusGain = ctx.createGain();
    padBusGain.gain.value = padsMutedRef.current ? 0 : padsVolumeRef.current * 0.52;
    padBusGain.connect(eqLowShelf);
    const padReverbTap = ctx.createGain();
    padReverbTap.gain.value = 0.42;
    padBusGain.connect(padReverbTap);
    padReverbTap.connect(reverbSendGain);

    const rainBusGain = ctx.createGain();
    rainBusGain.gain.value = rainMutedRef.current ? 0 : rainVolumeRef.current * 0.72;
    rainBusGain.connect(eqLowShelf);
    const rainReverbTap = ctx.createGain();
    rainReverbTap.gain.value = 0.25;
    rainBusGain.connect(rainReverbTap);
    rainReverbTap.connect(reverbSendGain);

    const sfxBusGain = ctx.createGain();
    sfxBusGain.gain.value = sfxMutedRef.current ? 0 : sfxVolumeRef.current;
    sfxBusGain.connect(eqLowShelf);

    const sfxReverbTapGain = ctx.createGain();
    sfxReverbTapGain.gain.value = 0.4;
    sfxBusGain.connect(sfxReverbTapGain);
    sfxReverbTapGain.connect(reverbSendGain);

    // Scene Nature Sub-Buses
    const oceanBusGain = ctx.createGain();
    oceanBusGain.gain.value = sceneRef.current === 'ocean' ? 1 : 0;
    oceanBusGain.connect(ambienceBusGain);

    const spaceBusGain = ctx.createGain();
    spaceBusGain.gain.value = 0;
    spaceBusGain.connect(ambienceBusGain);

    const cyclistBusGain = ctx.createGain();
    cyclistBusGain.gain.value = sceneRef.current === 'cyclist' ? 1 : 0;
    cyclistBusGain.connect(ambienceBusGain);

    const templeBusGain = ctx.createGain();
    templeBusGain.gain.value = sceneRef.current === 'temple' ? 1 : 0;
    templeBusGain.connect(ambienceBusGain);

    const slingshotBusGain = ctx.createGain();
    slingshotBusGain.gain.value = sceneRef.current === 'slingshot' ? 1 : 0;
    slingshotBusGain.connect(ambienceBusGain);

    const hoopsBusGain = ctx.createGain();
    hoopsBusGain.gain.value = sceneRef.current === 'basketball' ? 1 : 0;
    hoopsBusGain.connect(ambienceBusGain);

    // -------------------------------------------------------------------------
    // 1. SOLAR HORIZON — SHORE (Deep rolling swell + surf wash + coastal air)
    // -------------------------------------------------------------------------
    const swellSrc = ctx.createBufferSource();
    swellSrc.buffer = noiseBuf;
    swellSrc.loop = true;
    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.value = 195;
    swellFilter.Q.value = 0.65;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.54;
    const swellLfo = ctx.createOscillator();
    swellLfo.frequency.value = 0.085;
    const swellLfoDepth = ctx.createGain();
    swellLfoDepth.gain.value = 68;
    swellLfo.connect(swellLfoDepth);
    swellLfoDepth.connect(swellFilter.frequency);
    swellSrc.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(oceanBusGain);

    const washSrc = ctx.createBufferSource();
    washSrc.buffer = noiseBuf;
    washSrc.loop = true;
    const washFilter = ctx.createBiquadFilter();
    washFilter.type = 'bandpass';
    washFilter.frequency.value = 460;
    washFilter.Q.value = 0.5;
    const washGain = ctx.createGain();
    washGain.gain.value = 0.19;
    const washFreqLfo = ctx.createOscillator();
    washFreqLfo.frequency.value = 0.14;
    const washFreqDepth = ctx.createGain();
    washFreqDepth.gain.value = 240;
    washFreqLfo.connect(washFreqDepth);
    washFreqDepth.connect(washFilter.frequency);
    const washAmpLfo = ctx.createOscillator();
    washAmpLfo.frequency.value = 0.14;
    const washAmpDepth = ctx.createGain();
    washAmpDepth.gain.value = 0.12;
    washAmpLfo.connect(washAmpDepth);
    washAmpDepth.connect(washGain.gain);
    washSrc.connect(washFilter);
    washFilter.connect(washGain);
    washGain.connect(oceanBusGain);

    const coastalBreezeSrc = ctx.createBufferSource();
    coastalBreezeSrc.buffer = noiseBuf;
    coastalBreezeSrc.loop = true;
    const coastalBreezeFilter = ctx.createBiquadFilter();
    coastalBreezeFilter.type = 'bandpass';
    coastalBreezeFilter.frequency.value = 980;
    coastalBreezeFilter.Q.value = 0.8;
    const coastalBreezeGain = ctx.createGain();
    coastalBreezeGain.gain.value = 0.036;
    coastalBreezeSrc.connect(coastalBreezeFilter);
    coastalBreezeFilter.connect(coastalBreezeGain);
    coastalBreezeGain.connect(oceanBusGain);

    // -------------------------------------------------------------------------
    // 2. SOLAR HORIZON — SPACE VIEW (Cosmic harmonic drone + starry air)
    // -------------------------------------------------------------------------
    const spaceFilter = ctx.createBiquadFilter();
    spaceFilter.type = 'lowpass';
    spaceFilter.frequency.value = 420;
    spaceFilter.Q.value = 0.8;
    const spaceLfo = ctx.createOscillator();
    spaceLfo.frequency.value = 0.06;
    const spaceLfoDepth = ctx.createGain();
    spaceLfoDepth.gain.value = 140;
    spaceLfo.connect(spaceLfoDepth);
    spaceLfoDepth.connect(spaceFilter.frequency);
    spaceFilter.connect(spaceBusGain);

    const spaceVoices: OscillatorNode[] = [];
    const spaceFreqs = [65.41, 98.0, 146.83, 196.0]; // Warm C2-G2-D3-G3 cosmic fifths
    spaceFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (idx % 2 === 0 ? -1 : 1) * (3 + idx * 1.8);
      const pan = ctx.createStereoPanner();
      pan.pan.value = idx === 0 ? 0 : idx % 2 === 0 ? -0.35 : 0.35;
      const g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.16 : 0.065;
      osc.connect(g);
      g.connect(pan);
      pan.connect(spaceFilter);
      spaceVoices.push(osc);
    });

    const spaceAirSrc = ctx.createBufferSource();
    spaceAirSrc.buffer = noiseBuf;
    spaceAirSrc.loop = true;
    const spaceAirFilter = ctx.createBiquadFilter();
    spaceAirFilter.type = 'bandpass';
    spaceAirFilter.frequency.value = 320;
    spaceAirFilter.Q.value = 1.4;
    const spaceAirGain = ctx.createGain();
    spaceAirGain.gain.value = 0.08;
    spaceAirSrc.connect(spaceAirFilter);
    spaceAirFilter.connect(spaceAirGain);
    spaceAirGain.connect(spaceBusGain);

    // -------------------------------------------------------------------------
    // 3. COASTLINE TOUR (Meadow wind + silky speed aero + grass rustle)
    // -------------------------------------------------------------------------
    const meadowWindSrc = ctx.createBufferSource();
    meadowWindSrc.buffer = noiseBuf;
    meadowWindSrc.loop = true;
    const meadowFilter = ctx.createBiquadFilter();
    meadowFilter.type = 'lowpass';
    meadowFilter.frequency.value = 310;
    meadowFilter.Q.value = 0.6;
    const meadowLfo = ctx.createOscillator();
    meadowLfo.frequency.value = 0.11;
    const meadowLfoDepth = ctx.createGain();
    meadowLfoDepth.gain.value = 95;
    meadowLfo.connect(meadowLfoDepth);
    meadowLfoDepth.connect(meadowFilter.frequency);
    const meadowGain = ctx.createGain();
    meadowGain.gain.value = 0.34;
    meadowWindSrc.connect(meadowFilter);
    meadowFilter.connect(meadowGain);
    meadowGain.connect(cyclistBusGain);

    const aeroSrc = ctx.createBufferSource();
    aeroSrc.buffer = noiseBuf;
    aeroSrc.loop = true;
    const aeroFilter = ctx.createBiquadFilter();
    aeroFilter.type = 'bandpass';
    aeroFilter.frequency.value = 380;
    aeroFilter.Q.value = 0.75;
    const aeroGain = ctx.createGain();
    aeroGain.gain.value = 0.11;
    aeroSrc.connect(aeroFilter);
    aeroFilter.connect(aeroGain);
    aeroGain.connect(cyclistBusGain);

    const grassRustleSrc = ctx.createBufferSource();
    grassRustleSrc.buffer = noiseBuf;
    grassRustleSrc.loop = true;
    const grassFilter = ctx.createBiquadFilter();
    grassFilter.type = 'bandpass';
    grassFilter.frequency.value = 1480;
    grassFilter.Q.value = 1.0;
    const grassGain = ctx.createGain();
    grassGain.gain.value = 0.025;
    grassRustleSrc.connect(grassFilter);
    grassFilter.connect(grassGain);
    grassGain.connect(cyclistBusGain);

    // -------------------------------------------------------------------------
    // 4. TEMPLE RUN (Jungle waterfall + warm canopy mist)
    // -------------------------------------------------------------------------
    const waterfallSrc = ctx.createBufferSource();
    waterfallSrc.buffer = noiseBuf;
    waterfallSrc.loop = true;
    const waterfallFilter = ctx.createBiquadFilter();
    waterfallFilter.type = 'lowpass';
    waterfallFilter.frequency.value = 430;
    waterfallFilter.Q.value = 0.6;
    const waterfallLfo = ctx.createOscillator();
    waterfallLfo.frequency.value = 0.13;
    const waterfallDepth = ctx.createGain();
    waterfallDepth.gain.value = 105;
    waterfallLfo.connect(waterfallDepth);
    waterfallDepth.connect(waterfallFilter.frequency);
    const waterfallGain = ctx.createGain();
    waterfallGain.gain.value = 0.36;
    waterfallSrc.connect(waterfallFilter);
    waterfallFilter.connect(waterfallGain);
    waterfallGain.connect(templeBusGain);

    const mistSrc = ctx.createBufferSource();
    mistSrc.buffer = noiseBuf;
    mistSrc.loop = true;
    const mistFilter = ctx.createBiquadFilter();
    mistFilter.type = 'bandpass';
    mistFilter.frequency.value = 1350;
    mistFilter.Q.value = 0.65;
    const mistGain = ctx.createGain();
    mistGain.gain.value = 0.06;
    mistSrc.connect(mistFilter);
    mistFilter.connect(mistGain);
    mistGain.connect(templeBusGain);

    // -------------------------------------------------------------------------
    // 5. ANGRY BIRDS (Open valley breeze + warm hillside rustle)
    // -------------------------------------------------------------------------
    const valleyWindSrc = ctx.createBufferSource();
    valleyWindSrc.buffer = noiseBuf;
    valleyWindSrc.loop = true;
    const valleyFilter = ctx.createBiquadFilter();
    valleyFilter.type = 'lowpass';
    valleyFilter.frequency.value = 280;
    valleyFilter.Q.value = 0.55;
    const valleyLfo = ctx.createOscillator();
    valleyLfo.frequency.value = 0.095;
    const valleyDepth = ctx.createGain();
    valleyDepth.gain.value = 90;
    valleyLfo.connect(valleyDepth);
    valleyDepth.connect(valleyFilter.frequency);
    const valleyGain = ctx.createGain();
    valleyGain.gain.value = 0.3;
    valleyWindSrc.connect(valleyFilter);
    valleyFilter.connect(valleyGain);
    valleyGain.connect(slingshotBusGain);

    const leavesSrc = ctx.createBufferSource();
    leavesSrc.buffer = noiseBuf;
    leavesSrc.loop = true;
    const leavesFilter = ctx.createBiquadFilter();
    leavesFilter.type = 'bandpass';
    leavesFilter.frequency.value = 1520;
    leavesFilter.Q.value = 0.9;
    const leavesGain = ctx.createGain();
    leavesGain.gain.value = 0.022;
    leavesSrc.connect(leavesFilter);
    leavesFilter.connect(leavesGain);
    leavesGain.connect(slingshotBusGain);

    // -------------------------------------------------------------------------
    // 6. ALL-STAR HOOPS (Quiet twilight court / warm arena air)
    // -------------------------------------------------------------------------
    const arenaRoomSrc = ctx.createBufferSource();
    arenaRoomSrc.buffer = noiseBuf;
    arenaRoomSrc.loop = true;
    const arenaRoomFilter = ctx.createBiquadFilter();
    arenaRoomFilter.type = 'lowpass';
    arenaRoomFilter.frequency.value = 230;
    arenaRoomFilter.Q.value = 0.6;
    const arenaRoomGain = ctx.createGain();
    arenaRoomGain.gain.value = 0.22;
    arenaRoomSrc.connect(arenaRoomFilter);
    arenaRoomFilter.connect(arenaRoomGain);
    arenaRoomGain.connect(hoopsBusGain);

    // -------------------------------------------------------------------------
    // 7. UNIVERSAL GENERATIVE WARM PAD BED (Slow breathing Maj9 chords)
    // -------------------------------------------------------------------------
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 620;
    padFilter.Q.value = 0.7;

    const padBreathLfo = ctx.createOscillator();
    padBreathLfo.frequency.value = 0.07;
    const padBreathDepth = ctx.createGain();
    padBreathDepth.gain.value = 210;
    padBreathLfo.connect(padBreathDepth);
    padBreathDepth.connect(padFilter.frequency);
    padFilter.connect(padBusGain);

    const padOscs: OscillatorNode[] = [];
    const initialChord = PAD_CHORDS_HZ[0];
    initialChord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (idx - 1.5) * 4.5;
      const pan = ctx.createStereoPanner();
      pan.pan.value = (idx - 1.5) * 0.36;
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 0.065;
      osc.connect(voiceGain);
      voiceGain.connect(pan);
      pan.connect(padFilter);
      padOscs.push(osc);
    });

    const padSubOsc = ctx.createOscillator();
    padSubOsc.type = 'sine';
    padSubOsc.frequency.value = initialChord[0] * 0.5;
    const padSubGain = ctx.createGain();
    padSubGain.gain.value = 0.09;
    padSubOsc.connect(padSubGain);
    padSubGain.connect(padFilter);

    // -------------------------------------------------------------------------
    // 8. GLOBAL COZY RAIN OVERLAY (Warm rain bed + stereo droplet patter)
    // -------------------------------------------------------------------------
    const rainBedSrc = ctx.createBufferSource();
    rainBedSrc.buffer = noiseBuf;
    rainBedSrc.loop = true;
    const rainBedFilter = ctx.createBiquadFilter();
    rainBedFilter.type = 'bandpass';
    rainBedFilter.frequency.value = 660;
    rainBedFilter.Q.value = 0.55;
    const rainBedGain = ctx.createGain();
    rainBedGain.gain.value = 0.24;
    rainBedSrc.connect(rainBedFilter);
    rainBedFilter.connect(rainBedGain);
    rainBedGain.connect(rainBusGain);

    const rainDropsSrc = ctx.createBufferSource();
    rainDropsSrc.buffer = rainBuf;
    rainDropsSrc.loop = true;
    const rainDropsFilter = ctx.createBiquadFilter();
    rainDropsFilter.type = 'bandpass';
    rainDropsFilter.frequency.value = 2150;
    rainDropsFilter.Q.value = 0.65;
    const rainDropsGain = ctx.createGain();
    rainDropsGain.gain.value = 0.22;
    rainDropsSrc.connect(rainDropsFilter);
    rainDropsFilter.connect(rainDropsGain);
    rainDropsGain.connect(rainBusGain);

    // Start all continuous loops
    swellSrc.start();
    swellLfo.start();
    washSrc.start();
    washFreqLfo.start();
    washAmpLfo.start();
    coastalBreezeSrc.start();

    spaceLfo.start();
    spaceVoices.forEach((o) => o.start());
    spaceAirSrc.start();

    meadowWindSrc.start();
    meadowLfo.start();
    aeroSrc.start();
    grassRustleSrc.start();

    waterfallSrc.start();
    waterfallLfo.start();
    mistSrc.start();

    valleyWindSrc.start();
    valleyLfo.start();
    leavesSrc.start();

    arenaRoomSrc.start();

    padBreathLfo.start();
    padOscs.forEach((o) => o.start());
    padSubOsc.start();

    rainBedSrc.start();
    rainDropsSrc.start();

    // -------------------------------------------------------------------------
    // Unified Lightweight Ambient Event Scheduler (chimes, birds, gulls, pads)
    // -------------------------------------------------------------------------
    let disposed = false;
    let chordIdx = 0;
    let nextChordAt = Date.now() + 14000;
    let nextNatureEventAt = Date.now() + 3500;

    const triggerGentleNote = (
      freq: number,
      targetNode: AudioNode,
      delayOffset: number,
      duration: number,
      peakGain: number,
      panVal: number,
      type: OscillatorType = 'sine'
    ) => {
      const start = ctx.currentTime + delayOffset;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const pan = ctx.createStereoPanner();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(peakGain, start + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      pan.pan.setValueAtTime(panVal, start);
      osc.connect(env);
      env.connect(pan);
      pan.connect(targetNode);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    const triggerSoftBird = (baseHz: number, targetNode: AudioNode) => {
      const now = ctx.currentTime;
      const notes = Math.random() < 0.5 ? 2 : 3;
      const panVal = (Math.random() - 0.5) * 1.4;
      for (let i = 0; i < notes; i++) {
        const start = now + i * (0.14 + Math.random() * 0.09);
        const dur = 0.09 + Math.random() * 0.07;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const pan = ctx.createStereoPanner();
        osc.type = 'sine';
        const f = baseHz * (0.9 + Math.random() * 0.25);
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * (1.14 + Math.random() * 0.16), start + dur);
        filter.type = 'bandpass';
        filter.frequency.value = f * 1.1;
        filter.Q.value = 1.6;
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(0.016, start + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        pan.pan.setValueAtTime(panVal, start);
        osc.connect(filter);
        filter.connect(env);
        env.connect(pan);
        pan.connect(targetNode);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      }
    };

    const triggerCricket = (targetNode: AudioNode) => {
      const now = ctx.currentTime;
      const chirps = 3;
      const panVal = (Math.random() - 0.5) * 1.5;
      for (let i = 0; i < chirps; i++) {
        const start = now + i * 0.065;
        triggerGentleNote(3750 + Math.random() * 240, targetNode, start - now, 0.045, 0.008, panVal, 'sine');
      }
    };

    const schedulerId = window.setInterval(() => {
      if (disposed) return;
      const suppressed = muteOnTabBlurRef.current && tabHiddenRef.current;
      if (!soundEnabledRef.current || masterMutedRef.current || suppressed || ctx.state !== 'running') {
        return;
      }

      const nowMs = Date.now();
      const nowCtx = ctx.currentTime;

      // Evolve harmonic pad chord smoothly every ~15s
      if (nowMs >= nextChordAt && !padsMutedRef.current && padsVolumeRef.current > 0.02) {
        nextChordAt = nowMs + 14500 + Math.random() * 4500;
        chordIdx = (chordIdx + 1) % PAD_CHORDS_HZ.length;
        const nextChord = PAD_CHORDS_HZ[chordIdx];
        padOscs.forEach((osc, i) => {
          osc.frequency.setTargetAtTime(nextChord[i], nowCtx, 2.4);
        });
        padSubOsc.frequency.setTargetAtTime(nextChord[0] * 0.5, nowCtx, 2.6);
      }

      // Trigger scene-tailored peaceful acoustic sparkles / nature calls
      if (nowMs >= nextNatureEventAt && !ambienceMutedRef.current && ambienceVolumeRef.current > 0.03) {
        nextNatureEventAt = nowMs + 4200 + Math.random() * 5200;
        const scene = sceneRef.current;

        if (scene === 'ocean') {
          if (oceanSpaceBlendRef.current > 0.55) {
            // Space View: crystalline orbital bell harmonic into stereo reverb
            const f = ORBITAL_BELLS_HZ[Math.floor(Math.random() * ORBITAL_BELLS_HZ.length)];
            triggerGentleNote(f, reverbSendGain, 0, 2.2, 0.028 * oceanSpaceBlendRef.current, (Math.random() - 0.5) * 1.2);
          } else if (!crowdMutedRef.current) {
            // Shore View: mellow distant sea gull
            const calls = Math.random() < 0.4 ? 2 : 1;
            const panVal = (Math.random() - 0.5) * 1.3;
            for (let c = 0; c < calls; c++) {
              const start = nowCtx + c * (0.4 + Math.random() * 0.15);
              const dur = 0.35 + Math.random() * 0.14;
              const osc = ctx.createOscillator();
              const filter = ctx.createBiquadFilter();
              const env = ctx.createGain();
              const pan = ctx.createStereoPanner();
              osc.type = 'triangle';
              const baseFreq = 1180 + Math.random() * 280;
              osc.frequency.setValueAtTime(baseFreq * 0.88, start);
              osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, start + dur * 0.28);
              osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, start + dur);
              filter.type = 'bandpass';
              filter.frequency.setValueAtTime(1320, start);
              filter.Q.setValueAtTime(2.3, start);
              env.gain.setValueAtTime(0.0001, start);
              env.gain.linearRampToValueAtTime(0.017, start + 0.05);
              env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
              pan.pan.setValueAtTime(panVal, start);
              osc.connect(filter);
              filter.connect(env);
              env.connect(pan);
              pan.connect(oceanBusGain);
              pan.connect(reverbSendGain);
              osc.start(start);
              osc.stop(start + dur + 0.05);
            }
          }
        } else if (scene === 'temple') {
          if (Math.random() < 0.62) {
            // Bamboo wind chime cluster into reverb
            const count = Math.random() < 0.5 ? 2 : 3;
            for (let i = 0; i < count; i++) {
              const f = PENTATONIC_CHIMES_HZ[Math.floor(Math.random() * PENTATONIC_CHIMES_HZ.length)];
              triggerGentleNote(f, reverbSendGain, i * 0.24, 1.45, 0.022, (Math.random() - 0.5) * 1.1, 'triangle');
            }
          } else if (!crowdMutedRef.current) {
            triggerSoftBird(1480, reverbSendGain);
          }
        } else if (scene === 'cyclist' && !crowdMutedRef.current) {
          if (cyclistBiomeRef.current === 'desert') {
            triggerCricket(reverbSendGain);
          } else {
            triggerSoftBird(cyclistBiomeRef.current === 'homes' ? 1950 : 1650, reverbSendGain);
          }
        } else if (scene === 'slingshot' && !crowdMutedRef.current) {
          triggerSoftBird(1850, reverbSendGain);
        } else if (scene === 'basketball' && Math.random() < 0.45) {
          // Subtle warm evening wind chime near outdoor twilight court
          const f = PENTATONIC_CHIMES_HZ[Math.floor(Math.random() * 3)];
          triggerGentleNote(f, reverbSendGain, 0, 1.6, 0.012, (Math.random() - 0.5) * 0.9);
        }
      }
    }, 1800);

    const graph: AudioGraph = {
      ctx,
      masterGain,
      eqLowShelf,
      eqMidDip,
      eqHighShelf,
      ambienceBusGain,
      padBusGain,
      rainBusGain,
      sfxBusGain,
      sfxReverbTapGain,
      reverbSendGain,
      reverbReturnGain,
      oceanBusGain,
      spaceBusGain,
      cyclistBusGain,
      templeBusGain,
      slingshotBusGain,
      hoopsBusGain,
      aeroFilter,
      aeroGain,
      padOscs,
      padSubOsc,
      noiseBuf,
      rainBuf,
      dispose: () => {
        disposed = true;
        window.clearInterval(schedulerId);
        if (suspendTimerRef.current !== null) {
          window.clearTimeout(suspendTimerRef.current);
          suspendTimerRef.current = null;
        }
        void ctx.close();
      },
    };

    graphRef.current = graph;
    return graph;
  }, []);

  // Tab blur / visibility auto-mute listener
  useEffect(() => {
    const syncVisibility = () => {
      tabHiddenRef.current = document.visibilityState === 'hidden';
      applyMix();
    };
    const onBlur = () => {
      if (document.visibilityState === 'hidden') {
        tabHiddenRef.current = true;
        applyMix();
      }
    };
    const onFocus = () => {
      tabHiddenRef.current = document.visibilityState === 'hidden';
      applyMix();
    };
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [applyMix]);

  const setSoundEnabledState = useCallback(
    (next: boolean) => {
      soundEnabledRef.current = next;
      setSoundEnabled(next);

      if (next) {
        const graph = ensureAudioGraph();
        if (!graph) return;
        if (graph.ctx.state === 'suspended') {
          void graph.ctx.resume().then(applyMix);
        } else {
          applyMix();
        }
      } else {
        applyMix();
      }
    },
    [applyMix, ensureAudioGraph]
  );

  const toggleSound = useCallback(() => {
    setSoundEnabledState(!soundEnabledRef.current);
  }, [setSoundEnabledState]);

  const setMasterVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      masterVolumeRef.current = clamped;
      setMasterVolumeState(clamped);
      applyMix();
    },
    [applyMix]
  );

  const setAmbienceVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      ambienceVolumeRef.current = clamped;
      setAmbienceVolumeState(clamped);
      applyMix();
    },
    [applyMix]
  );

  const setPadsVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      padsVolumeRef.current = clamped;
      setPadsVolumeState(clamped);
      applyMix();
    },
    [applyMix]
  );

  const setRainVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      rainVolumeRef.current = clamped;
      setRainVolumeState(clamped);
      applyMix();
    },
    [applyMix]
  );

  const setSfxVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      sfxVolumeRef.current = clamped;
      setSfxVolumeState(clamped);
      applyMix();
    },
    [applyMix]
  );

  const setReverbMix = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      reverbMixRef.current = clamped;
      setReverbMixState(clamped);
      applyMix();
    },
    [applyMix]
  );

  const setMasterMuted = useCallback(
    (muted: boolean) => {
      masterMutedRef.current = muted;
      setMasterMutedState(muted);
      applyMix();
    },
    [applyMix]
  );

  const setAmbienceMuted = useCallback(
    (muted: boolean) => {
      ambienceMutedRef.current = muted;
      setAmbienceMutedState(muted);
      applyMix();
    },
    [applyMix]
  );

  const setPadsMuted = useCallback(
    (muted: boolean) => {
      padsMutedRef.current = muted;
      setPadsMutedState(muted);
      applyMix();
    },
    [applyMix]
  );

  const setRainMuted = useCallback(
    (muted: boolean) => {
      rainMutedRef.current = muted;
      setRainMutedState(muted);
      applyMix();
    },
    [applyMix]
  );

  const setSfxMuted = useCallback(
    (muted: boolean) => {
      sfxMutedRef.current = muted;
      setSfxMutedState(muted);
      applyMix();
    },
    [applyMix]
  );

  const setCrowdMuted = useCallback((muted: boolean) => {
    crowdMutedRef.current = muted;
    setCrowdMutedState(muted);
  }, []);

  const setMuteOnTabBlur = useCallback(
    (enabled: boolean) => {
      muteOnTabBlurRef.current = enabled;
      setMuteOnTabBlurState(enabled);
      applyMix();
    },
    [applyMix]
  );

  const setAcousticProfile = useCallback(
    (profile: AcousticProfile) => {
      acousticProfileRef.current = profile;
      setAcousticProfileState(profile);
      applyMix();
    },
    [applyMix]
  );

  const setSfxStyle = useCallback(
    (style: SfxStyle) => {
      sfxStyleRef.current = style;
      setSfxStyleState(style);
      applyMix();
    },
    [applyMix]
  );

  const setActiveSceneAudio = useCallback(
    (scene: SceneId) => {
      sceneRef.current = scene;
      applyMix();
    },
    [applyMix]
  );

  const setOceanSpaceBlend = useCallback(
    (blend: number) => {
      const clamped = Math.max(0, Math.min(1, blend));
      if (Math.abs(clamped - oceanSpaceBlendRef.current) < 0.015) return;
      oceanSpaceBlendRef.current = clamped;
      applyMix();
    },
    [applyMix]
  );

  const setCoastlineBiome = useCallback((biome: CoastlineBiome) => {
    cyclistBiomeRef.current = biome;
  }, []);

  const setCyclistSpeed = useCallback((speedMultiplier: number) => {
    const graph = graphRef.current;
    if (!graph) return;
    const clamped = Math.max(0, Math.min(10.0, speedMultiplier));
    const t = clamped / 10.0;
    const now = graph.ctx.currentTime;
    const maxHz = sfxStyleRef.current === 'peaceful' ? 1450 : 2150;
    graph.aeroFilter.frequency.setTargetAtTime(240 + Math.pow(t, 0.88) * maxHz, now, 0.12);
    graph.aeroGain.gain.setTargetAtTime(0.025 + t * 0.34, now, 0.12);
  }, []);

  const canPlaySfx = useCallback((graph: AudioGraph | null): graph is AudioGraph => {
    if (!graph) return false;
    if (!soundEnabledRef.current || masterMutedRef.current || sfxMutedRef.current) return false;
    if (muteOnTabBlurRef.current && tabHiddenRef.current) return false;
    return graph.ctx.state === 'running';
  }, []);

  const playCoinChime = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    if (sfxStyleRef.current === 'peaceful') {
      // Warm wooden marimba / kalimba fifths into reverb
      [698.46, 1046.5].forEach((freq, idx) => {
        const start = now + idx * 0.04;
        const osc = graph.ctx.createOscillator();
        const env = graph.ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(idx === 0 ? 0.055 : 0.036, start + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    } else {
      const osc = graph.ctx.createOscillator();
      const env = graph.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.exponentialRampToValueAtTime(1479.98, now + 0.09);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.085, now + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(env);
      env.connect(graph.sfxBusGain);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }, [canPlaySfx]);

  const playJumpCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    const osc = graph.ctx.createOscillator();
    const env = graph.ctx.createGain();
    if (sfxStyleRef.current === 'peaceful') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.14);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.042, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.055, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    }
    osc.connect(env);
    env.connect(graph.sfxBusGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }, [canPlaySfx]);

  const playPowerUpCue = useCallback(
    (kind: 'speed' | 'shield' | 'magnet' | 'fever') => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const now = graph.ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const notes =
        kind === 'speed'
          ? [523.25, 659.25, 1046.5]
          : kind === 'magnet'
            ? [440.0, 587.33, 880.0]
            : kind === 'fever'
              ? [523.25, 659.25, 783.99, 1046.5]
              : [392.0, 493.88, 783.99];
      notes.forEach((freq, idx) => {
        const start = now + idx * (peaceful ? 0.065 : 0.055);
        const osc = graph.ctx.createOscillator();
        const env = graph.ctx.createGain();
        osc.type = peaceful ? 'sine' : kind === 'speed' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(peaceful ? 0.042 : 0.055, start + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, start + (peaceful ? 0.34 : 0.22));
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    },
    [canPlaySfx]
  );

  const playShieldBreakCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    const peaceful = sfxStyleRef.current === 'peaceful';
    const osc = graph.ctx.createOscillator();
    const env = graph.ctx.createGain();
    osc.type = peaceful ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(peaceful ? 540 : 720, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peaceful ? 0.055 : 0.09, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(env);
    env.connect(graph.sfxBusGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }, [canPlaySfx]);

  const playHurtCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    const peaceful = sfxStyleRef.current === 'peaceful';
    const osc = graph.ctx.createOscillator();
    const env = graph.ctx.createGain();
    if (peaceful) {
      // Soft felt thump instead of jarring sawtooth buzz
      osc.type = 'sine';
      osc.frequency.setValueAtTime(124, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.22);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.075, now + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.25);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.085, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    }
    osc.connect(env);
    env.connect(graph.sfxBusGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }, [canPlaySfx]);

  const playSlingshotStretchCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const nowMs = performance.now();
    if (nowMs - lastStretchCueMsRef.current < 420) return;
    lastStretchCueMsRef.current = nowMs;
    const now = graph.ctx.currentTime;
    const osc = graph.ctx.createOscillator();
    const env = graph.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(162, now + 0.09);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.024, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(env);
    env.connect(graph.sfxBusGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }, [canPlaySfx]);

  const playSlingshotReleaseCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    const peaceful = sfxStyleRef.current === 'peaceful';
    const osc = graph.ctx.createOscillator();
    const env = graph.ctx.createGain();
    osc.type = peaceful ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(peaceful ? 310 : 380, now + 0.085);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.21);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peaceful ? 0.08 : 0.11, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
    osc.connect(env);
    env.connect(graph.sfxBusGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }, [canPlaySfx]);

  const playBlockImpactCue = useCallback(
    (
      intensity: number,
      kind: 'wood' | 'ice' | 'stone' | 'pig' | 'tnt' | 'bouncer' | 'boulder' = 'wood'
    ) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const now = graph.ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const amp = Math.max(0.015, Math.min(peaceful ? 0.095 : 0.13, intensity * 0.09));
      const osc = graph.ctx.createOscillator();
      const env = graph.ctx.createGain();
      if (kind === 'ice') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(peaceful ? 1050 : 1320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.1);
      } else if (kind === 'stone' || kind === 'boulder') {
        osc.type = peaceful ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(kind === 'boulder' ? 92 : 112, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      } else if (kind === 'pig') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(peaceful ? 460 : 540, now);
        osc.frequency.exponentialRampToValueAtTime(peaceful ? 680 : 860, now + 0.12);
      } else if (kind === 'bouncer') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(195, now);
        osc.frequency.exponentialRampToValueAtTime(470, now + 0.16);
      } else {
        osc.type = peaceful ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(kind === 'tnt' ? 260 : 220, now);
        osc.frequency.exponentialRampToValueAtTime(92, now + 0.11);
      }
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp, now + (peaceful ? 0.014 : 0.008));
      env.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'bouncer' ? 0.2 : 0.16));
      osc.connect(env);
      env.connect(graph.sfxBusGain);
      osc.start(now);
      osc.stop(now + 0.22);
    },
    [canPlaySfx]
  );

  // Earthy thud + soft dust scatter using cached noiseBuf
  const playGroundImpactCue = useCallback(
    (
      intensity: number,
      kind: 'wood' | 'ice' | 'stone' | 'pig' | 'bird' | 'soil' | 'tnt' | 'bouncer' | 'boulder' = 'soil'
    ) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const ctx = graph.ctx;
      const now = ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const clampedInt = Math.max(0.1, Math.min(1.4, intensity));

      const thud = ctx.createOscillator();
      const thudEnv = ctx.createGain();
      thud.type = 'sine';
      const baseHz = kind === 'stone' || kind === 'boulder' ? 74 : kind === 'wood' ? 96 : 86;
      thud.frequency.setValueAtTime(baseHz, now);
      thud.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      thudEnv.gain.setValueAtTime(0.0001, now);
      thudEnv.gain.linearRampToValueAtTime(
        Math.min(peaceful ? 0.13 : 0.18, 0.035 + clampedInt * 0.085),
        now + (peaceful ? 0.012 : 0.007)
      );
      thudEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      thud.connect(thudEnv);
      thudEnv.connect(graph.sfxBusGain);
      thud.start(now);
      thud.stop(now + 0.24);

      const dustSrc = ctx.createBufferSource();
      dustSrc.buffer = graph.noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(kind === 'ice' ? 1150 : 540, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.2);
      filter.Q.value = 0.85;
      const dustEnv = ctx.createGain();
      dustEnv.gain.setValueAtTime(0.0001, now);
      dustEnv.gain.linearRampToValueAtTime(
        Math.min(peaceful ? 0.075 : 0.11, clampedInt * 0.06),
        now + 0.018
      );
      dustEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
      dustSrc.connect(filter);
      filter.connect(dustEnv);
      dustEnv.connect(graph.sfxBusGain);
      dustSrc.start(now, Math.random() * 10, 0.25);
    },
    [canPlaySfx]
  );

  const playAbilityCue = useCallback(
    (birdType: 'red' | 'chuck' | 'blues' | 'bomb' | 'terence') => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const ctx = graph.ctx;
      const now = ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';

      if (birdType === 'blues') {
        const notes = [659.25, 880, 1174.66];
        notes.forEach((f, idx) => {
          const t = now + idx * 0.035;
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.09);
          env.gain.setValueAtTime(0.0001, t);
          env.gain.linearRampToValueAtTime(peaceful ? 0.045 : 0.07, t + 0.012);
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          osc.connect(env);
          env.connect(graph.sfxBusGain);
          osc.start(t);
          osc.stop(t + 0.16);
        });
      } else if (birdType === 'chuck') {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = peaceful ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(980, now + 0.11);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peaceful ? 0.07 : 0.1, now + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(now);
        osc.stop(now + 0.27);
      } else if (birdType === 'terence') {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.26);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peaceful ? 0.11 : 0.16, now + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.29);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(now);
        osc.stop(now + 0.31);
      } else {
        // Red sonic pulse or Bomb pre-detonation chirp
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(birdType === 'bomb' ? 240 : 420, now);
        osc.frequency.exponentialRampToValueAtTime(birdType === 'bomb' ? 620 : 210, now + 0.18);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peaceful ? 0.065 : 0.095, now + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    },
    [canPlaySfx]
  );

  const playExplosionCue = useCallback(
    (intensity = 1.0) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const ctx = graph.ctx;
      const now = ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const power = Math.max(0.4, Math.min(1.5, intensity));

      // Warm sub-bass punch
      const sub = ctx.createOscillator();
      const subEnv = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(112, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.36);
      subEnv.gain.setValueAtTime(0.0001, now);
      subEnv.gain.linearRampToValueAtTime(
        Math.min(peaceful ? 0.16 : 0.24, 0.12 * power),
        now + 0.014
      );
      subEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      sub.connect(subEnv);
      subEnv.connect(graph.sfxBusGain);
      sub.start(now);
      sub.stop(now + 0.45);

      // Filtered noise bloom into reverb
      const src = ctx.createBufferSource();
      src.buffer = graph.noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(peaceful ? 680 : 1250, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.46);
      const noiseEnv = ctx.createGain();
      noiseEnv.gain.setValueAtTime(0.0001, now);
      noiseEnv.gain.linearRampToValueAtTime(
        Math.min(peaceful ? 0.13 : 0.2, 0.1 * power),
        now + 0.02
      );
      noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      src.connect(filter);
      filter.connect(noiseEnv);
      noiseEnv.connect(graph.sfxBusGain);
      src.start(now, Math.random() * 8, 0.54);
    },
    [canPlaySfx]
  );

  const playVictoryFanfareCue = useCallback(
    (stars = 3) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const ctx = graph.ctx;
      const now = ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const freqs =
        stars >= 3
          ? [392.0, 493.88, 587.33, 783.99]
          : stars === 2
            ? [392.0, 493.88, 587.33]
            : [392.0, 493.88];
      freqs.forEach((f, idx) => {
        const start = now + idx * 0.09;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = peaceful ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, start);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(peaceful ? 0.055 : 0.075, start + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(start);
        osc.stop(start + 0.6);
      });
    },
    [canPlaySfx]
  );

  // Silky zero-allocation swish
  const playBasketballSwishCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const ctx = graph.ctx;
    const now = ctx.currentTime;
    const peaceful = sfxStyleRef.current === 'peaceful';
    const src = ctx.createBufferSource();
    src.buffer = graph.noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(peaceful ? 1900 : 2400, now);
    filter.frequency.exponentialRampToValueAtTime(peaceful ? 3400 : 4600, now + 0.09);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.28);
    filter.Q.value = 1.3;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peaceful ? 0.16 : 0.22, now + 0.032);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    src.connect(filter);
    filter.connect(env);
    env.connect(graph.sfxBusGain);
    src.start(now, Math.random() * 10, 0.3);

    if (peaceful) {
      // Gentle warm chime undertone for a clean swish
      const osc = ctx.createOscillator();
      const chimeEnv = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(698.46, now + 0.04);
      chimeEnv.gain.setValueAtTime(0.0001, now + 0.04);
      chimeEnv.gain.linearRampToValueAtTime(0.025, now + 0.06);
      chimeEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      osc.connect(chimeEnv);
      chimeEnv.connect(graph.sfxBusGain);
      osc.start(now + 0.04);
      osc.stop(now + 0.38);
    }
  }, [canPlaySfx]);

  const playBasketballRimCue = useCallback(
    (intensity = 0.8) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const now = graph.ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const amp = Math.max(0.02, Math.min(peaceful ? 0.095 : 0.14, intensity * 0.1));

      const partials = peaceful ? [360, 560] : [392, 648, 1085];
      partials.forEach((freq, idx) => {
        const osc = graph.ctx.createOscillator();
        const env = graph.ctx.createGain();
        osc.type = idx === 0 && !peaceful ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.02), now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + 0.18);

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(amp / (idx + 1), now + (peaceful ? 0.01 : 0.004));
        env.gain.exponentialRampToValueAtTime(0.0001, now + (idx === 0 ? 0.24 : 0.14));

        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(now);
        osc.stop(now + 0.26);
      });
    },
    [canPlaySfx]
  );

  const playBasketballBoardCue = useCallback(
    (intensity = 0.75) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const now = graph.ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const amp = Math.max(0.02, Math.min(peaceful ? 0.1 : 0.14, intensity * 0.11));

      const osc = graph.ctx.createOscillator();
      const env = graph.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(peaceful ? 148 : 175, now);
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.12);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(env);
      env.connect(graph.sfxBusGain);
      osc.start(now);
      osc.stop(now + 0.16);
    },
    [canPlaySfx]
  );

  const playBasketballBounceCue = useCallback(
    (intensity = 0.75) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph)) return;
      const now = graph.ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const amp = Math.max(0.02, Math.min(peaceful ? 0.11 : 0.16, intensity * 0.12));

      const osc = graph.ctx.createOscillator();
      const env = graph.ctx.createGain();
      osc.type = peaceful ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(118, now);
      osc.frequency.exponentialRampToValueAtTime(46, now + 0.1);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp, now + (peaceful ? 0.009 : 0.004));
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(env);
      env.connect(graph.sfxBusGain);
      osc.start(now);
      osc.stop(now + 0.14);
    },
    [canPlaySfx]
  );

  const playBasketballHornCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    const peaceful = sfxStyleRef.current === 'peaceful';
    if (peaceful) {
      // Warm acoustic bell chord instead of harsh airhorn
      const freqs = [293.66, 369.99, 440.0];
      freqs.forEach((f, idx) => {
        const start = now + idx * 0.055;
        const osc = graph.ctx.createOscillator();
        const env = graph.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(0.048, start + 0.025);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.68);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(start);
        osc.stop(start + 0.72);
      });
    } else {
      const freqs = [185, 233.08, 277.18];
      freqs.forEach((f, idx) => {
        const osc = graph.ctx.createOscillator();
        const filter = graph.ctx.createBiquadFilter();
        const env = graph.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(980, now);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.065 / (idx * 0.35 + 1), now + 0.03);
        env.gain.setValueAtTime(0.065 / (idx * 0.35 + 1), now + 0.36);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.54);
        osc.connect(filter);
        filter.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(now);
        osc.stop(now + 0.56);
      });
    }
  }, [canPlaySfx]);

  // Zero-allocation warm applause / crowd cheer
  const playBasketballCheerCue = useCallback(
    (intensity = 0.75) => {
      const graph = graphRef.current;
      if (!canPlaySfx(graph) || crowdMutedRef.current) return;
      const ctx = graph.ctx;
      const now = ctx.currentTime;
      const peaceful = sfxStyleRef.current === 'peaceful';
      const dur = 0.75 + intensity * 0.35;
      const src = ctx.createBufferSource();
      src.buffer = graph.noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(peaceful ? 560 : 720, now);
      filter.frequency.exponentialRampToValueAtTime(peaceful ? 960 : 1280, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(520, now + dur);
      filter.Q.value = 0.78;

      const env = ctx.createGain();
      const peak = Math.min(peaceful ? 0.14 : 0.24, 0.08 + intensity * 0.09);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.12);
      env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      src.connect(filter);
      filter.connect(env);
      env.connect(graph.sfxBusGain);
      src.start(now, Math.random() * 9, dur + 0.04);
    },
    [canPlaySfx]
  );

  const playPlanetFocusCue = useCallback(() => {
    const graph = graphRef.current;
    if (!canPlaySfx(graph)) return;
    const now = graph.ctx.currentTime;
    const freqs = [528, 792, 1056];
    freqs.forEach((f, idx) => {
      const start = now + idx * 0.055;
      const osc = graph.ctx.createOscillator();
      const env = graph.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(idx === 2 ? 0.022 : 0.036, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(env);
      env.connect(graph.sfxBusGain);
      osc.start(start);
      osc.stop(start + 0.46);
    });
  }, [canPlaySfx]);

  const playTestChimeCue = useCallback(() => {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const trigger = () => {
      const now = graph.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((f, idx) => {
        const start = now + idx * 0.075;
        const osc = graph.ctx.createOscillator();
        const env = graph.ctx.createGain();
        osc.type = sfxStyleRef.current === 'peaceful' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, start);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(0.052, start + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(env);
        env.connect(graph.sfxBusGain);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    };
    if (graph.ctx.state === 'suspended') {
      void graph.ctx.resume().then(() => {
        applyMix();
        trigger();
      });
    } else {
      trigger();
    }
  }, [applyMix, ensureAudioGraph]);

  useEffect(() => {
    return () => {
      if (graphRef.current) {
        graphRef.current.dispose();
        graphRef.current = null;
      }
    };
  }, []);

  const value = useMemo<AudioManagerContextValue>(
    () => ({
      soundEnabled,
      masterVolume,
      ambienceVolume,
      padsVolume,
      rainVolume,
      sfxVolume,
      reverbMix,
      masterMuted,
      ambienceMuted,
      padsMuted,
      rainMuted,
      sfxMuted,
      crowdMuted,
      muteOnTabBlur,
      acousticProfile,
      sfxStyle,
      toggleSound,
      setSoundEnabledState,
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
      setActiveSceneAudio,
      setCyclistSpeed,
      setOceanSpaceBlend,
      setCoastlineBiome,
      playCoinChime,
      playJumpCue,
      playPowerUpCue,
      playShieldBreakCue,
      playHurtCue,
      playSlingshotStretchCue,
      playSlingshotReleaseCue,
      playBlockImpactCue,
      playGroundImpactCue,
      playAbilityCue,
      playExplosionCue,
      playVictoryFanfareCue,
      playBasketballSwishCue,
      playBasketballRimCue,
      playBasketballBoardCue,
      playBasketballBounceCue,
      playBasketballHornCue,
      playBasketballCheerCue,
      playPlanetFocusCue,
      playTestChimeCue,
    }),
    [
      soundEnabled,
      masterVolume,
      ambienceVolume,
      padsVolume,
      rainVolume,
      sfxVolume,
      reverbMix,
      masterMuted,
      ambienceMuted,
      padsMuted,
      rainMuted,
      sfxMuted,
      crowdMuted,
      muteOnTabBlur,
      acousticProfile,
      sfxStyle,
      toggleSound,
      setSoundEnabledState,
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
      setActiveSceneAudio,
      setCyclistSpeed,
      setOceanSpaceBlend,
      setCoastlineBiome,
      playCoinChime,
      playJumpCue,
      playPowerUpCue,
      playShieldBreakCue,
      playHurtCue,
      playSlingshotStretchCue,
      playSlingshotReleaseCue,
      playBlockImpactCue,
      playGroundImpactCue,
      playAbilityCue,
      playExplosionCue,
      playVictoryFanfareCue,
      playBasketballSwishCue,
      playBasketballRimCue,
      playBasketballBoardCue,
      playBasketballBounceCue,
      playBasketballHornCue,
      playBasketballCheerCue,
      playPlanetFocusCue,
      playTestChimeCue,
    ]
  );

  return <AudioManagerContext.Provider value={value}>{children}</AudioManagerContext.Provider>;
}

export function useAudioManager(): AudioManagerContextValue {
  const ctx = useContext(AudioManagerContext);
  if (!ctx) {
    throw new Error('useAudioManager must be used within an AudioManagerProvider');
  }
  return ctx;
}
