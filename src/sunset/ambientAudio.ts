export interface AmbientOceanAudio {
  start: () => Promise<boolean>;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  isRunning: () => boolean;
  dispose: () => void;
}

// Builds a seamless looping stereo brown/pink-weighted noise buffer for warm ocean surf
function createSeamlessNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lastOut = 0;
    const raw = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.024 * white) / 1.024;
      raw[i] = lastOut * 3.4 + white * 0.14;
    }

    // Crossfade end into start over 0.6s so loop wrap has zero discontinuity
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.6), Math.floor(length * 0.25));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const eqIn = Math.sin(t * Math.PI * 0.5);
      const eqOut = Math.cos(t * Math.PI * 0.5);
      const tailIdx = length - fadeSamples + i;
      const blended = raw[i] * eqIn + raw[tailIdx] * eqOut;
      raw[i] = blended;
      raw[tailIdx] = blended;
    }

    // Normalize safely
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

export function createAmbientOceanAudio(): AmbientOceanAudio {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let gullTimerId: number | null = null;
  let muted = false;
  let initialized = false;
  let disposed = false;

  const scheduleNextGull = () => {
    if (disposed) return;
    const delayMs = 6500 + Math.random() * 6500;
    gullTimerId = window.setTimeout(() => {
      if (disposed || !ctx || !masterGain || ctx.state !== 'running' || muted) {
        scheduleNextGull();
        return;
      }

      const now = ctx.currentTime;
      const calls = Math.random() < 0.45 ? 2 : 1;

      for (let c = 0; c < calls; c++) {
        const start = now + c * (0.38 + Math.random() * 0.16);
        const dur = 0.34 + Math.random() * 0.14;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const pan = ctx.createStereoPanner();

        osc.type = 'triangle';
        const baseFreq = 1280 + Math.random() * 340;
        osc.frequency.setValueAtTime(baseFreq * 0.88, start);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.18, start + dur * 0.28);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, start + dur);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1450, start);
        filter.Q.setValueAtTime(2.6, start);

        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(0.022, start + 0.045);
        env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        pan.pan.setValueAtTime((Math.random() - 0.5) * 1.3, start);

        osc.connect(filter);
        filter.connect(env);
        env.connect(pan);
        pan.connect(masterGain);

        osc.start(start);
        osc.stop(start + dur + 0.05);
      }

      scheduleNextGull();
    }, delayMs);
  };

  const ensureGraph = () => {
    if (initialized || disposed) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const noiseBuf = createSeamlessNoiseBuffer(ctx, 12);

    // 1. Deep ocean swell bed
    const swellSrc = ctx.createBufferSource();
    swellSrc.buffer = noiseBuf;
    swellSrc.loop = true;

    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.value = 210;
    swellFilter.Q.value = 0.7;

    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.52;

    const swellLfo = ctx.createOscillator();
    swellLfo.frequency.value = 0.09;
    const swellLfoGain = ctx.createGain();
    swellLfoGain.gain.value = 75;
    swellLfo.connect(swellLfoGain);
    swellLfoGain.connect(swellFilter.frequency);

    swellSrc.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(masterGain);

    // 2. Rhythmic shorewash surge & foam hiss
    const washSrc = ctx.createBufferSource();
    washSrc.buffer = noiseBuf;
    washSrc.loop = true;

    const washFilter = ctx.createBiquadFilter();
    washFilter.type = 'bandpass';
    washFilter.frequency.value = 540;
    washFilter.Q.value = 0.55;

    const washGain = ctx.createGain();
    washGain.gain.value = 0.22;

    const washFreqLfo = ctx.createOscillator();
    washFreqLfo.frequency.value = 0.16; // ~6.2s wave wash cadence
    const washFreqDepth = ctx.createGain();
    washFreqDepth.gain.value = 320;
    washFreqLfo.connect(washFreqDepth);
    washFreqDepth.connect(washFilter.frequency);

    const washAmpLfo = ctx.createOscillator();
    washAmpLfo.frequency.value = 0.16;
    const washAmpDepth = ctx.createGain();
    washAmpDepth.gain.value = 0.15;
    washAmpLfo.connect(washAmpDepth);
    washAmpDepth.connect(washGain.gain);

    washSrc.connect(washFilter);
    washFilter.connect(washGain);
    washGain.connect(masterGain);

    // 3. Soft coastal evening breeze
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = noiseBuf;
    breezeSrc.loop = true;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 1250;
    breezeFilter.Q.value = 0.9;

    const breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.045;

    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(masterGain);

    swellSrc.start();
    swellLfo.start();
    washSrc.start();
    washFreqLfo.start();
    washAmpLfo.start();
    breezeSrc.start();

    initialized = true;
    scheduleNextGull();
  };

  const applyGain = () => {
    if (!ctx || !masterGain) return;
    const target = !muted && ctx.state === 'running' ? 0.42 : 0;
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, muted ? 0.15 : 0.65);
  };

  return {
    async start(): Promise<boolean> {
      if (disposed) return false;
      ensureGraph();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          return false;
        }
      }
      applyGain();
      return ctx.state === 'running';
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
      if (!muted && ctx && ctx.state === 'suspended') {
        void ctx.resume().then(applyGain);
      } else {
        applyGain();
      }
    },
    isMuted() {
      return muted;
    },
    isRunning() {
      return Boolean(ctx && ctx.state === 'running' && !muted);
    },
    dispose() {
      disposed = true;
      if (gullTimerId !== null) {
        clearTimeout(gullTimerId);
        gullTimerId = null;
      }
      if (ctx) {
        void ctx.close();
        ctx = null;
      }
      masterGain = null;
    },
  };
}
