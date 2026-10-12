import { els } from './dom.js';
import { state } from './state.js';
import type { VideoInfo } from '../../shared/types.js';

const { formatSelect, resolutionSelect, frameRateSelect, video } = els;

/** Helper to fill a select element */
function fillSelect(select: HTMLSelectElement, items: { label: string; value: string }[]) {
  select.innerHTML = '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    select.appendChild(opt);
  });
}

/** Filter resolution dropdown based on original video dimensions */
function filterResolutions(origW: number, origH: number) {
  if (!resolutionSelect || !state.originalResolutions.length) return;
  if (origW === 0 || origH === 0) {
    fillSelect(resolutionSelect, state.originalResolutions);
    return;
  }
  const filtered = state.originalResolutions.filter(item => {
    if (item.value === 'original') return true;
    const [w, h] = item.value.split(':').map(Number);
    return w <= origW && h <= origH;
  });
  fillSelect(resolutionSelect, filtered);
}

/** Filter frame rate dropdown based on original video fps */
function filterFrameRates(fps: number) {
  if (!frameRateSelect || !state.originalFrameRates.length) return;
  if (fps <= 0) {
    fillSelect(frameRateSelect, state.originalFrameRates);
    return;
  }
  const filtered = state.originalFrameRates.filter(item => {
    if (item.value === 'original') return true;
    const targetFps = parseFloat(item.value);
    return targetFps <= fps;
  });
  fillSelect(frameRateSelect, filtered);
}

/** Toggle visibility of video‑only controls (resolution & fps) */
function updateVideoOptionsVisibility() {
  const selectedFormat = formatSelect?.value ?? 'original';
  const selectedOpt = state.formatOptions.find(f => f.value === selectedFormat);
  const isAudio = selectedOpt?.type === 'audio';

  const resLabel = document.querySelector('label[for="resolutionSelect"]') as HTMLElement | null;
  if (resLabel) resLabel.style.display = isAudio ? 'none' : '';
  if (resolutionSelect) resolutionSelect.style.display = isAudio ? 'none' : '';

  const fpsLabel = document.querySelector('label[for="frameRateSelect"]') as HTMLElement | null;
  if (fpsLabel) fpsLabel.style.display = isAudio ? 'none' : '';
  if (frameRateSelect) frameRateSelect.style.display = isAudio ? 'none' : '';
}

/**
 * Aplica os filtros de resolução/fps a partir das infos do vídeo.
 * Fallback (info ausente) usa as dimensões do <video> — mesmo comportamento do handler.
 */
export function applyFiltersFromVideo(info: VideoInfo | null, videoEl: HTMLVideoElement | null): void {
  if (info) {
    state.originalFps = info.frameRate;
    filterResolutions(info.width, info.height);
    filterFrameRates(info.frameRate);
  } else if (videoEl) {
    // Fallback: still filter resolutions with videoWidth/Height
    filterResolutions(videoEl.videoWidth, videoEl.videoHeight);
    // No fps filtering possible without info
  }
}

// ---------- Populate dropdowns with export options ----------
export async function populateExportOptions() {
  const options = await window.api.getExportOptions();
  if (!options) return;

  state.formatOptions = options.format;
  state.originalResolutions = options.resolution;
  state.originalFrameRates = options.frameRate;

  fillSelect(formatSelect!, options.format);
  fillSelect(resolutionSelect!, options.resolution);
  fillSelect(frameRateSelect!, options.frameRate);

  updateVideoOptionsVisibility();
  // Filter with current video info if already available
  if (video && video.videoWidth && state.originalFps > 0) {
    filterResolutions(video.videoWidth, video.videoHeight);
    filterFrameRates(state.originalFps);
  }
}

export function setupDropdowns(): void {
  formatSelect?.addEventListener('change', updateVideoOptionsVisibility);
}
