export {};

declare global {
  interface Window {
    api: {
      selectVideo: () => Promise<string | null>;
      trimVideo: (options: {
        input: string;
        output: string;
        start: string;
        duration: string;
        format?: string;
        resolution?: string;
        frameRate?: string;
        formatType?: string;
      }) => Promise<void>;
      showInFolder: (path: string) => Promise<void>;
      getExportOptions: () => Promise<{
        format: { label: string; value: string; type: string }[];
        resolution: { label: string; value: string }[];
        frameRate: { label: string; value: string }[];
      }>;
      getVideoInfo: (filePath: string) => Promise<{
        width: number;
        height: number;
        duration: number;
        frameRate: number;
      } | null>;
    };
  }
}

const video = document.getElementById('preview') as HTMLVideoElement | null;
const btnSelect = document.getElementById('select') as HTMLButtonElement | null;
const btnExport = document.getElementById('btn') as HTMLButtonElement | null;
const btnPlay = document.getElementById('play') as HTMLButtonElement | null;
const btnPause = document.getElementById('pause') as HTMLButtonElement | null;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement | null;
const volumeSlider = document.getElementById('volume') as HTMLInputElement | null;

const formatSelect = document.getElementById('formatSelect') as HTMLSelectElement | null;
const resolutionSelect = document.getElementById('resolutionSelect') as HTMLSelectElement | null;
const frameRateSelect = document.getElementById('frameRateSelect') as HTMLSelectElement | null;

const startRange = document.getElementById('startRange') as HTMLInputElement | null;
const endRange = document.getElementById('endRange') as HTMLInputElement | null;
const playhead = document.getElementById('playhead') as HTMLInputElement | null;
const timeline = document.getElementById('timeline') as HTMLDivElement | null;
const editorUI = document.getElementById('editor-ui') as HTMLDivElement | null;
const startDisplay = document.getElementById('startDisplay') as HTMLElement | null;
const endDisplay = document.getElementById('endDisplay') as HTMLElement | null;
const selectedDurationSpan = document.getElementById('selectedDuration') as HTMLElement | null;
const playheadLine = document.getElementById('playheadLine') as HTMLDivElement | null;
const framesContainer = document.getElementById('framesContainer') as HTMLDivElement | null;

let selectedPath: string | null = null;
let duration: number = 0;
let rafId: number | null = null;
let scrubAnimationFrame: number | null = null;
let resizeTimeout: ReturnType<typeof setTimeout>;
const MIN_GAP = 0.1;

// Store full lists & original video fps
let originalResolutions: { label: string; value: string }[] = [];
let originalFrameRates: { label: string; value: string }[] = [];
let formatOptions: { label: string; value: string; type: string }[] = [];
let originalFps: number = 0;   // real fps of loaded video

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00:00";
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateTimelineUI(): void {
  if (!duration || !startRange || !endRange || !timeline) return;

  const start = parseFloat(startRange.value);
  const end = parseFloat(endRange.value);
  const startPercent = (start / duration) * 100;
  const endPercent = (end / duration) * 100;

  timeline.style.setProperty('--start', `${startPercent}%`);
  timeline.style.setProperty('--end', `${endPercent}%`);

  if (startDisplay) startDisplay.textContent = formatTime(start);
  if (endDisplay) endDisplay.textContent = formatTime(end);
  if (selectedDurationSpan) selectedDurationSpan.textContent = `${(end - start).toFixed(1)}s`;
}

function syncPlayhead(): void {
  if (!video || !duration || !playhead || !playheadLine) return;
  
  const startVal = parseFloat(startRange?.value ?? '0');
  const endVal = parseFloat(endRange?.value ?? '0');
  let current = video.currentTime;

  if (current < startVal) {
    video.currentTime = startVal;
    current = startVal;
  }

  if (current >= (endVal - 0.01)) {
    stopPlaybackLoop();
    video.pause();
    video.currentTime = startVal;
    current = startVal;
  }

  playhead.value = current.toString();
  playheadLine.style.left = `${(current / duration) * 100}%`;

  if (!video.paused) {
    rafId = requestAnimationFrame(syncPlayhead);
  }
}

function startPlaybackLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(syncPlayhead);
}

function stopPlaybackLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function updateMuteIcon() {
  if (muteBtn) {
    muteBtn.textContent = video?.muted ? '🔇' : '🔊';
  }
}

muteBtn?.addEventListener('click', () => {
  if (video) {
    video.muted = !video.muted;
    updateMuteIcon();
  }
});

video?.addEventListener('loadedmetadata', () => {
  updateMuteIcon();
});

timeline?.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).classList.contains('timeline-input')) return;
  const rect = timeline.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const clickedPercentage = Math.max(0, Math.min(1, x / rect.width));
  const targetTime = duration * clickedPercentage;

  const startVal = parseFloat(startRange?.value ?? '0');
  const endVal = parseFloat(endRange?.value ?? '0');
  const clampedTime = Math.max(startVal, Math.min(endVal, targetTime));

  if (video) video.currentTime = clampedTime;
  syncPlayhead();
});

btnPlay?.addEventListener('click', () => {
  video?.play();
  startPlaybackLoop();
});

btnPause?.addEventListener('click', () => {
  video?.pause();
  stopPlaybackLoop();
});

volumeSlider?.addEventListener('input', () => {
  if (video) video.volume = parseFloat(volumeSlider.value);
});

async function generateThumbnails() {
  if (!video || !duration || !framesContainer) return;
  framesContainer.innerHTML = '';
  const tempVideo = document.createElement('video');
  tempVideo.src = video.src;
  tempVideo.muted = true;
  await new Promise(r => tempVideo.onloadedmetadata = r);
  
  const containerWidth = framesContainer.offsetWidth || window.innerWidth; 
  const thumbSize = 60; 
  const count = Math.ceil(containerWidth / thumbSize);
  const step = duration / count;

  for (let i = 0; i < count; i++) {
    const time = i * step;
    tempVideo.currentTime = time;
    await new Promise(r => tempVideo.onseeked = r);
    const canvas = document.createElement('canvas');
    canvas.width = thumbSize;
    canvas.height = thumbSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const videoAspect = tempVideo.videoWidth / tempVideo.videoHeight;
      let sw, sh, sx, sy;
      if (videoAspect > 1) {
        sh = tempVideo.videoHeight;
        sw = sh;
        sx = (tempVideo.videoWidth - sw) / 2;
        sy = 0;
      } else {
        sw = tempVideo.videoWidth;
        sh = sw;
        sx = 0;
        sy = (tempVideo.videoHeight - sh) / 2;
      }
      ctx.drawImage(tempVideo, sx, sy, sw, sh, 0, 0, thumbSize, thumbSize);
    }
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/jpeg', 0.6);
    img.className = 'frame-thumb';
    framesContainer.appendChild(img);
  }
}

btnSelect?.addEventListener('click', async () => {
  const path = await window.api.selectVideo();
  if (path && video) {
    selectedPath = path;
    video.src = `file:///${path.replace(/\\/g, '/')}`;
  }
});

window.addEventListener('resize', () => {
  if (!editorUI?.classList.contains('hidden')) {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      generateThumbnails();
    }, 300);
  }
});

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
  if (!resolutionSelect || !originalResolutions.length) return;
  if (origW === 0 || origH === 0) {
    fillSelect(resolutionSelect, originalResolutions);
    return;
  }
  const filtered = originalResolutions.filter(item => {
    if (item.value === 'original') return true;
    const [w, h] = item.value.split(':').map(Number);
    return w <= origW && h <= origH;
  });
  fillSelect(resolutionSelect, filtered);
}

/** Filter frame rate dropdown based on original video fps */
function filterFrameRates(fps: number) {
  if (!frameRateSelect || !originalFrameRates.length) return;
  if (fps <= 0) {
    fillSelect(frameRateSelect, originalFrameRates);
    return;
  }
  const filtered = originalFrameRates.filter(item => {
    if (item.value === 'original') return true;
    const targetFps = parseFloat(item.value);
    return targetFps <= fps;
  });
  fillSelect(frameRateSelect, filtered);
}

/** Toggle visibility of video‑only controls (resolution & fps) */
function updateVideoOptionsVisibility() {
  const selectedFormat = formatSelect?.value ?? 'original';
  const selectedOpt = formatOptions.find(f => f.value === selectedFormat);
  const isAudio = selectedOpt?.type === 'audio';

  const resLabel = document.querySelector('label[for="resolutionSelect"]') as HTMLElement | null;
  if (resLabel) resLabel.style.display = isAudio ? 'none' : '';
  if (resolutionSelect) resolutionSelect.style.display = isAudio ? 'none' : '';

  const fpsLabel = document.querySelector('label[for="frameRateSelect"]') as HTMLElement | null;
  if (fpsLabel) fpsLabel.style.display = isAudio ? 'none' : '';
  if (frameRateSelect) frameRateSelect.style.display = isAudio ? 'none' : '';
}

formatSelect?.addEventListener('change', updateVideoOptionsVisibility);

// ---------- Populate dropdowns with export options ----------
async function populateExportOptions() {
  const options = await window.api.getExportOptions();
  if (!options) return;

  formatOptions = options.format;
  originalResolutions = options.resolution;
  originalFrameRates = options.frameRate;

  fillSelect(formatSelect!, options.format);
  fillSelect(resolutionSelect!, options.resolution);
  fillSelect(frameRateSelect!, options.frameRate);

  updateVideoOptionsVisibility();
  // Filter with current video info if already available
  if (video && video.videoWidth && originalFps > 0) {
    filterResolutions(video.videoWidth, video.videoHeight);
    filterFrameRates(originalFps);
  }
}

// When video metadata loads, also get full video info (fps) and apply filters
video?.addEventListener('loadedmetadata', async () => {
  duration = video.duration;
  [startRange, endRange, playhead].forEach(s => { 
    if(s) { s.max = duration.toString(); s.step = "0.01"; }
  });
  if(startRange) startRange.value = "0";
  if(endRange) endRange.value = duration.toString();
  editorUI?.classList.remove('hidden');
  updateTimelineUI();
  updateMuteIcon();

  // Only attempt to get info if we have a file path
  if (selectedPath) {
    const info = await window.api.getVideoInfo(selectedPath);
    if (info) {
      originalFps = info.frameRate;
      filterResolutions(info.width, info.height);
      filterFrameRates(info.frameRate);
    } else {
      // Fallback: still filter resolutions with videoWidth/Height
      filterResolutions(video.videoWidth, video.videoHeight);
      // No fps filtering possible without info
    }
  }

  setTimeout(() => { generateThumbnails(); }, 50);
});

video?.addEventListener('timeupdate', () => {
  if (video.paused) syncPlayhead();
});

startRange?.addEventListener('input', () => {
  const start = parseFloat(startRange.value);
  const end = parseFloat(endRange?.value ?? '0');
  if (start >= end - MIN_GAP) startRange.value = (end - MIN_GAP).toString();
  
  updateTimelineUI();
  
  if (video) {
    if (scrubAnimationFrame !== null) {
      cancelAnimationFrame(scrubAnimationFrame);
    }
    scrubAnimationFrame = requestAnimationFrame(() => {
      video.currentTime = parseFloat(startRange.value);
      if (playheadLine && duration) {
        playheadLine.style.left = `${(video.currentTime / duration) * 100}%`;
      }
    });
  }
});

endRange?.addEventListener('input', () => {
  const start = parseFloat(startRange!.value);
  const end = parseFloat(endRange.value);
  if (end <= start + MIN_GAP) endRange.value = (start + MIN_GAP).toString();
  
  if (video && video.currentTime > parseFloat(endRange.value)) {
    video.currentTime = parseFloat(endRange.value);
  }

  updateTimelineUI();
});

playhead?.addEventListener('input', () => {
  const startVal = parseFloat(startRange?.value ?? '0');
  const endVal = parseFloat(endRange?.value ?? '0');
  let val = parseFloat(playhead.value);

  if (val < startVal) val = startVal;
  if (val > endVal) val = endVal;

  video!.currentTime = val;
  syncPlayhead(); 
});

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const externalFile = params.get('externalFile');

  if (externalFile && video) {
    selectedPath = externalFile;
    video.src = `file:///${externalFile.replace(/\\/g, '/')}`;
  }

  populateExportOptions();
});

btnExport?.addEventListener('click', async () => {
  if (!selectedPath || btnExport.disabled) return;

  const progressTrack = document.querySelector('.progress-track') as HTMLElement | null;
  const progressFill = document.querySelector('.progress-fill') as HTMLElement | null;
  const sInput = document.querySelector('#startRange') as HTMLInputElement | null;
  const eInput = document.querySelector('#endRange') as HTMLInputElement | null;

  if (!sInput || !eInput) return;

  const originalText = btnExport.textContent || 'EXPORTAR CORTE';
  btnExport.disabled = true;
  btnExport.classList.add('btn-processing');
  btnExport.textContent = '⚙ PROCESSANDO...';
  
  if (progressTrack) progressTrack.style.display = 'block';
  if (progressFill) {
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #007bff, #00c6ff)';
  }

  const start = parseFloat(sInput.value);
  const end = parseFloat(eInput.value);
  const rawDuration = end - start;

  const format = (document.querySelector('#formatSelect') as HTMLSelectElement)?.value ?? 'original';
  const resolution = (document.querySelector('#resolutionSelect') as HTMLSelectElement)?.value ?? 'original';
  const frameRate = (document.querySelector('#frameRateSelect') as HTMLSelectElement)?.value ?? 'original';

  const output = format !== 'original' 
    ? selectedPath.replace(/(\.[\w\d]+)$/i, `_trimmed.${format}`)
    : selectedPath.replace(/(\.[\w\d]+)$/i, '_trimmed$1');

  try {
    await window.api.trimVideo({ 
      input: selectedPath, 
      output, 
      start: start.toFixed(6), 
      duration: rawDuration.toFixed(6),
      format,
      resolution,
      frameRate,
    });

    if (progressFill) progressFill.style.width = '100%';
    btnExport.textContent = '✔ CONCLUÍDO';
    btnExport.classList.remove('btn-processing');
    
    await window.api.showInFolder(output);

    setTimeout(() => {
      btnExport.textContent = originalText;
      btnExport.disabled = false;
      if (progressTrack) progressTrack.style.display = 'none';
    }, 2000);

  } catch (err) {
    console.error('Export error:', err);
    btnExport.textContent = '❌ ERRO';
    btnExport.classList.remove('btn-processing');
    if (progressFill) {
      progressFill.style.width = '100%';
      progressFill.style.background = '#ff4d4d';
    }
    
    setTimeout(() => {
      btnExport.textContent = originalText;
      btnExport.disabled = false;
      if (progressTrack) progressTrack.style.display = 'none';
    }, 3000);
  }
});