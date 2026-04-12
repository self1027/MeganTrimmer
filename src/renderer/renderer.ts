export {};

declare global {
  interface Window {
    api: {
      selectVideo: () => Promise<string | null>;
      trimVideo: (options: { input: string; output: string; start: string; duration: string }) => Promise<void>;
      showInFolder: (path: string) => Promise<void>;
    };
  }
}

const video = document.getElementById('preview') as HTMLVideoElement | null;
const btnSelect = document.getElementById('select') as HTMLButtonElement | null;
const btnExport = document.getElementById('btn') as HTMLButtonElement | null;
const btnPlay = document.getElementById('play') as HTMLButtonElement | null;
const btnPause = document.getElementById('pause') as HTMLButtonElement | null;
const volumeSlider = document.getElementById('volume') as HTMLInputElement | null;

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
let resizeTimeout: ReturnType<typeof setTimeout>;
const MIN_GAP = 0.1;

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

video?.addEventListener('loadedmetadata', () => {
  duration = video.duration;
  [startRange, endRange, playhead].forEach(s => { 
    if(s) { s.max = duration.toString(); s.step = "0.01"; }
  });
  if(startRange) startRange.value = "0";
  if(endRange) endRange.value = duration.toString();
  editorUI?.classList.remove('hidden');
  updateTimelineUI();
  setTimeout(() => { generateThumbnails(); }, 50);
});

video?.addEventListener('timeupdate', () => {
  if (video.paused) syncPlayhead();
});

startRange?.addEventListener('input', () => {
  const start = parseFloat(startRange.value);
  const end = parseFloat(endRange!.value);
  if (start >= end - MIN_GAP) startRange.value = (end - MIN_GAP).toString();
  
  if (video && video.currentTime < parseFloat(startRange.value)) {
    video.currentTime = parseFloat(startRange.value);
  }
  
  updateTimelineUI();
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
});

btnExport?.addEventListener('click', async () => {
  if (!selectedPath) return;
  const start = parseFloat(startRange!.value);
  const end = parseFloat(endRange!.value);
  const rawDuration = end - start;
  const output = selectedPath.replace(/(\.[\w\d]+)$/i, '_trimmed$1');
  await window.api.trimVideo({ 
    input: selectedPath, 
    output, 
    start: start.toFixed(6), 
    duration: rawDuration.toFixed(6) 
  });
  await window.api.showInFolder(output);
});