export type GpuClass = 'software' | 'igpu-uhd' | 'igpu-iris-apple' | 'discrete' | 'unknown';

export type FramePacingMode = 'auto-pc' | 'hybrid-179-60' | 'max-179' | 'std-60';
export type SceneWorkloadKind = '2d' | '3d-light' | '3d-heavy';

export interface BottleneckAdvisory {
  id: string;
  severity: 'info' | 'warn';
  title: string;
  detail: string;
}

export interface HardwareProfile {
  cpuThreads: number;
  deviceMemoryGb: number | null;
  gpuRenderer: string;
  gpuShortName: string;
  gpuClass: GpuClass;
  screenWidth: number;
  screenHeight: number;
  isUltrawide: boolean;
  nativeDpr: number;
  measuredHz: number;
  bottlenecks: BottleneckAdvisory[];
}

export interface SceneRenderBudget {
  dpr: number;
  glScale: number;
  targetFps: number;
  minFrameMs: number;
  fastShader: boolean;
  shadows: boolean;
  geometryDetail: 'low' | 'med' | 'high';
  particleScale: number;
}

function classifyGpu(rendererStr: string): { gpuClass: GpuClass; shortName: string } {
  const clean = rendererStr
    .replace(/^ANGLE\s*\([^,]*,\s*/i, '')
    .replace(/Direct3D[^)]*\)?/gi, '')
    .replace(/vs_\d+_\d+\s*ps_\d+_\d+/gi, '')
    .replace(/[()]/g, '')
    .trim();

  if (!rendererStr) {
    return { gpuClass: 'unknown', shortName: 'Integrated / Default GPU' };
  }
  if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr)) {
    return { gpuClass: 'software', shortName: 'Software WebGL' };
  }
  if (/Intel.*UHD|Intel.*HD Graphics/i.test(rendererStr)) {
    const match = rendererStr.match(/Intel\(R\)\s*U?HD\s*Graphics\s*\d*/i);
    return {
      gpuClass: 'igpu-uhd',
      shortName: match ? match[0].replace(/\(R\)/gi, '').trim() : 'Intel UHD Graphics',
    };
  }
  if (/Intel.*Iris|Intel.*Arc|Apple\s*(M\d|GPU)|Radeon\(TM\)\s*Graphics/i.test(rendererStr)) {
    return { gpuClass: 'igpu-iris-apple', shortName: clean.slice(0, 36) || 'Integrated GPU' };
  }
  if (/NVIDIA|GeForce|RTX|GTX|Quadro|Radeon RX/i.test(rendererStr)) {
    return { gpuClass: 'discrete', shortName: clean.slice(0, 36) || 'Discrete GPU' };
  }
  return { gpuClass: 'unknown', shortName: clean.slice(0, 36) || 'WebGL GPU' };
}

export function detectHardwareProfile(measuredHz = 60): HardwareProfile {
  if (typeof window === 'undefined') {
    return {
      cpuThreads: 8,
      deviceMemoryGb: 8,
      gpuRenderer: '',
      gpuShortName: 'Default GPU',
      gpuClass: 'unknown',
      screenWidth: 1920,
      screenHeight: 1080,
      isUltrawide: false,
      nativeDpr: 1,
      measuredHz,
      bottlenecks: [],
    };
  }

  const cpuThreads =
    typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : 8;
  const navWithMem =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number })
      : null;
  const deviceMemoryGb =
    navWithMem && typeof navWithMem.deviceMemory === 'number'
      ? navWithMem.deviceMemory
      : null;

  const screenWidth = window.screen?.width || window.innerWidth || 1920;
  const screenHeight = window.screen?.height || window.innerHeight || 1080;
  const isUltrawide = screenWidth / Math.max(1, screenHeight) >= 2.05;
  const nativeDpr = Math.max(1, window.devicePixelRatio || 1);

  let gpuRenderer = '';
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      gpuRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch {
    gpuRenderer = '';
  }

  const { gpuClass, shortName } = classifyGpu(gpuRenderer);
  const bottlenecks = buildBottleneckAdvisories({
    cpuThreads,
    deviceMemoryGb,
    gpuClass,
    gpuShortName: shortName,
    screenWidth,
    screenHeight,
    isUltrawide,
    measuredHz,
  });

  return {
    cpuThreads,
    deviceMemoryGb,
    gpuRenderer,
    gpuShortName: shortName,
    gpuClass,
    screenWidth,
    screenHeight,
    isUltrawide,
    nativeDpr,
    measuredHz,
    bottlenecks,
  };
}

export function buildBottleneckAdvisories(params: {
  cpuThreads: number;
  deviceMemoryGb: number | null;
  gpuClass: GpuClass;
  gpuShortName: string;
  screenWidth: number;
  screenHeight: number;
  isUltrawide: boolean;
  measuredHz: number;
}): BottleneckAdvisory[] {
  const list: BottleneckAdvisory[] = [];
  const totalPixels = params.screenWidth * params.screenHeight;
  const highResOrRefresh = totalPixels >= 3600000 || params.measuredHz >= 120;

  if (params.gpuClass === 'igpu-uhd' && highResOrRefresh) {
    list.push({
      id: 'igpu-fillrate',
      severity: 'warn',
      title: `${params.gpuShortName} Fillrate Bottleneck (${params.screenWidth}×${params.screenHeight} @ ${params.measuredHz}Hz)`,
      detail:
        'Shading 5M+ pixels at 179Hz exceeds iGPU DDR4 bandwidth. Auto PC Match locks 1.0x native pixels, disables canvas backdrop-blur, and enables sprite caching.',
    });
  } else if (params.gpuClass === 'software') {
    list.push({
      id: 'software-gl',
      severity: 'warn',
      title: 'Software WebGL Fallback Active',
      detail: 'Hardware acceleration is unavailable; 1.0x resolution and Eco belts keep rendering responsive.',
    });
  }

  if (params.isUltrawide) {
    list.push({
      id: 'ultrawide-21-9',
      severity: 'info',
      title: `21:9 Ultrawide Display Ready (${params.screenWidth}×${params.screenHeight})`,
      detail: 'Native 21:9 stage framing removes black sidebars across all 5 interactive experiences.',
    });
  }

  if (params.cpuThreads >= 16) {
    list.push({
      id: 'cpu-headroom',
      severity: 'info',
      title: `High-Thread CPU Headroom (${params.cpuThreads} Threads)`,
      detail:
        'Plentiful CPU power for unlimited Angry Birds Matter.js salvos, Verlet basketball nets, and live J2000 planetary math.',
    });
  }

  if (params.measuredHz >= 140) {
    list.push({
      id: 'high-hz-2d',
      severity: 'info',
      title: `${params.measuredHz}Hz High-Refresh Input`,
      detail: '2D physics games (Angry Birds, All-Star Hoops, Coastline Tour) run unlocked for low-latency mouse aiming.',
    });
  }

  return list;
}

export function snapDisplayHz(rawHz: number): number {
  const anchors = [60, 75, 100, 120, 144, 165, 179, 180, 240];
  let best = Math.round(rawHz);
  let bestDiff = 999;
  for (const a of anchors) {
    const diff = Math.abs(rawHz - a);
    if (diff < bestDiff && diff <= 5) {
      best = a;
      bestDiff = diff;
    }
  }
  return Math.max(30, Math.min(240, best));
}

export function computeSceneRenderBudget(opts: {
  framePacingMode: FramePacingMode;
  qualityTier: 'potato' | 'auto' | 'high' | 'balanced' | 'eco';
  gpuClass: GpuClass;
  nativeDpr: number;
  sceneKind: SceneWorkloadKind;
  cssWidth: number;
}): SceneRenderBudget {
  const { framePacingMode, qualityTier, gpuClass, nativeDpr, sceneKind, cssWidth } = opts;
  const isWeakGpu = gpuClass === 'igpu-uhd' || gpuClass === 'software';
  const isWideCanvas = cssWidth >= 2300;

  if (qualityTier === 'potato') {
    return {
      dpr: 0.65,
      glScale: 0.58,
      targetFps: 60,
      minFrameMs: 16.4,
      fastShader: true,
      shadows: false,
      geometryDetail: 'low',
      particleScale: 0.3,
    };
  }

  if (qualityTier === 'eco') {
    return {
      dpr: 0.85,
      glScale: sceneKind === '3d-heavy' ? 0.72 : sceneKind === '3d-light' ? 0.8 : 0.9,
      targetFps: sceneKind === '2d' ? 0 : 60,
      minFrameMs: sceneKind === '2d' ? 0 : 16.4,
      fastShader: true,
      shadows: false,
      geometryDetail: 'low',
      particleScale: 0.55,
    };
  }

  const baseShadows = qualityTier === 'high' ? true : !isWeakGpu;
  const baseDetail: 'low' | 'med' | 'high' =
    qualityTier === 'high' ? 'high' : qualityTier === 'balanced' || isWeakGpu ? 'med' : 'high';
  const baseParticles = qualityTier === 'high' ? 1.0 : isWeakGpu ? 0.7 : 0.88;

  if (framePacingMode === 'hybrid-179-60') {
    if (sceneKind === '2d') {
      return {
        dpr: isWeakGpu ? 1.0 : Math.min(nativeDpr, 1.35),
        glScale: 1.0,
        targetFps: 0,
        minFrameMs: 0,
        fastShader: isWeakGpu || isWideCanvas,
        shadows: baseShadows,
        geometryDetail: baseDetail,
        particleScale: baseParticles,
      };
    }
    return {
      dpr: isWeakGpu ? 1.0 : Math.min(nativeDpr, 1.25),
      glScale:
        sceneKind === '3d-heavy'
          ? isWeakGpu
            ? 0.8
            : 1.0
          : isWeakGpu
            ? isWideCanvas
              ? 0.82
              : 0.9
            : 1.0,
      targetFps: 60,
      minFrameMs: 16.4,
      fastShader: isWeakGpu || sceneKind === '3d-heavy',
      shadows: baseShadows,
      geometryDetail: baseDetail,
      particleScale: baseParticles,
    };
  }

  if (framePacingMode === 'max-179') {
    return {
      dpr: 1.0,
      glScale: sceneKind === '3d-heavy' ? (isWeakGpu ? 0.75 : 0.9) : isWeakGpu && isWideCanvas ? 0.85 : 1.0,
      targetFps: 0,
      minFrameMs: 0,
      fastShader: isWeakGpu || isWideCanvas,
      shadows: baseShadows,
      geometryDetail: baseDetail,
      particleScale: baseParticles,
    };
  }

  if (framePacingMode === 'std-60') {
    const cap = qualityTier === 'high' ? 1.5 : 1.25;
    return {
      dpr: isWeakGpu ? 1.0 : Math.min(nativeDpr, cap),
      glScale: sceneKind === '3d-heavy' ? (qualityTier === 'high' ? 1.25 : 0.95) : Math.min(nativeDpr, cap),
      targetFps: 0,
      minFrameMs: 0,
      fastShader: isWeakGpu,
      shadows: baseShadows,
      geometryDetail: baseDetail,
      particleScale: baseParticles,
    };
  }

  if (sceneKind === '2d') {
    const uhdUltrawideCap = isWeakGpu && isWideCanvas;
    return {
      dpr: isWeakGpu ? 1.0 : Math.min(nativeDpr, 1.35),
      glScale: 1.0,
      targetFps: uhdUltrawideCap ? 120 : 0,
      minFrameMs: uhdUltrawideCap ? 8.1 : 0,
      fastShader: isWeakGpu || isWideCanvas,
      shadows: baseShadows,
      geometryDetail: baseDetail,
      particleScale: baseParticles,
    };
  }

  if (sceneKind === '3d-heavy') {
    const scale = isWeakGpu ? (isWideCanvas ? 0.75 : 0.85) : qualityTier === 'high' ? Math.min(nativeDpr, 1.25) : 1.0;
    const lock60 = isWeakGpu || (isWideCanvas && gpuClass !== 'discrete');
    return {
      dpr: isWeakGpu ? 1.0 : Math.min(nativeDpr, 1.25),
      glScale: scale,
      targetFps: lock60 ? 60 : 0,
      minFrameMs: lock60 ? 16.4 : 0,
      fastShader: isWeakGpu || (isWideCanvas && gpuClass !== 'discrete'),
      shadows: baseShadows,
      geometryDetail: baseDetail,
      particleScale: baseParticles,
    };
  }

  return {
    dpr: isWeakGpu ? 1.0 : Math.min(nativeDpr, qualityTier === 'high' ? 1.5 : 1.25),
    glScale: isWeakGpu ? (isWideCanvas ? 0.82 : 0.9) : Math.min(nativeDpr, 1.35),
    targetFps: isWeakGpu ? 60 : 0,
    minFrameMs: isWeakGpu ? 16.4 : 0,
    fastShader: isWeakGpu,
    shadows: baseShadows,
    geometryDetail: baseDetail,
    particleScale: baseParticles,
  };
}
