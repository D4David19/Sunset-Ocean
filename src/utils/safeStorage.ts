export function safeReadStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeWriteStorage(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore private browsing or storage quota errors
  }
}

export function safeReadJson<T>(key: string, fallback: T): T {
  const raw = safeReadStorage(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeWriteJson<T>(key: string, value: T): void {
  try {
    safeWriteStorage(key, JSON.stringify(value));
  } catch {
    // Ignore serialization errors
  }
}

export interface ScreenshotCaption {
  title: string;
  subtitle?: string;
  accent?: string;
}

export function captureStageCanvasPng(
  stageEl: HTMLElement | null,
  filenamePrefix: string,
  caption?: ScreenshotCaption
): boolean {
  if (!stageEl || typeof document === 'undefined') return false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kas:prepare-capture'));
  }
  const canvases = Array.from(stageEl.querySelectorAll('canvas')).filter(
    (c) => c.width > 0 && c.height > 0
  );
  if (canvases.length === 0) return false;

  const targetW = Math.max(...canvases.map((c) => c.width));
  const targetH = Math.max(...canvases.map((c) => c.height));

  const composite = document.createElement('canvas');
  composite.width = targetW;
  composite.height = targetH;
  const ctx = composite.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#070b18';
  ctx.fillRect(0, 0, targetW, targetH);

  let drewAny = false;
  for (const canvas of canvases) {
    try {
      ctx.drawImage(canvas, 0, 0, targetW, targetH);
      drewAny = true;
    } catch {
      // Skip tainted or unavailable canvases gracefully
    }
  }
  if (!drewAny) return false;

  if (caption) {
    const barH = Math.max(36, Math.round(targetH * 0.056));
    const grad = ctx.createLinearGradient(0, targetH - barH * 1.4, 0, targetH);
    grad.addColorStop(0, 'rgba(7, 11, 24, 0)');
    grad.addColorStop(1, 'rgba(7, 11, 24, 0.84)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, targetH - barH * 1.4, targetW, barH * 1.4);

    const padX = Math.max(18, Math.round(targetW * 0.02));
    const midY = targetH - Math.round(barH * 0.45);
    ctx.fillStyle = caption.accent ?? '#fbbf24';
    ctx.fillRect(padX, midY - 7, 4, 14);

    const fontPx = Math.max(13, Math.round(targetH * 0.022));
    ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption.title, padX + 12, midY);

    if (caption.subtitle) {
      const titleW = ctx.measureText(caption.title).width;
      ctx.font = `500 ${Math.max(11, Math.round(fontPx * 0.84))}px ui-monospace, monospace`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
      ctx.fillText(`  ·  ${caption.subtitle}`, padX + 16 + titleW, midY);
    }
  }

  try {
    const dataUrl = composite.toDataURL('image/png');
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `${filenamePrefix}-${stamp}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}
