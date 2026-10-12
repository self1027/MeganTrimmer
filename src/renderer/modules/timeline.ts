import { els } from './dom.js';
import { state, MIN_GAP } from './state.js';
import { formatTime } from './format.js';

const { video, startRange, endRange, playhead, timeline, startDisplay, endDisplay, selectedDurationSpan, playheadLine } = els;

export function updateTimelineUI(): void {
  if (!state.duration || !startRange || !endRange || !timeline) return;

  const start = parseFloat(startRange.value);
  const end = parseFloat(endRange.value);
  const startPercent = (start / state.duration) * 100;
  const endPercent = (end / state.duration) * 100;

  timeline.style.setProperty('--start', `${startPercent}%`);
  timeline.style.setProperty('--end', `${endPercent}%`);

  if (startDisplay) startDisplay.textContent = formatTime(start);
  if (endDisplay) endDisplay.textContent = formatTime(end);
  if (selectedDurationSpan) selectedDurationSpan.textContent = `${(end - start).toFixed(1)}s`;
}

export function syncPlayhead(): void {
  if (!video || !state.duration || !playhead || !playheadLine) return;
  
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
  playheadLine.style.left = `${(current / state.duration) * 100}%`;

  if (!video.paused) {
    state.rafId = requestAnimationFrame(syncPlayhead);
  }
}

export function startPlaybackLoop() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = requestAnimationFrame(syncPlayhead);
}

export function stopPlaybackLoop() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

export function setupTimeline(): void {
  timeline?.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).classList.contains('timeline-input')) return;
    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedPercentage = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = state.duration * clickedPercentage;

    const startVal = parseFloat(startRange?.value ?? '0');
    const endVal = parseFloat(endRange?.value ?? '0');
    const clampedTime = Math.max(startVal, Math.min(endVal, targetTime));

    if (video) video.currentTime = clampedTime;
    syncPlayhead();
  });

  startRange?.addEventListener('input', () => {
    const start = parseFloat(startRange.value);
    const end = parseFloat(endRange?.value ?? '0');
    if (start >= end - MIN_GAP) startRange.value = (end - MIN_GAP).toString();
    
    updateTimelineUI();
    
    if (video) {
      if (state.scrubAnimationFrame !== null) {
        cancelAnimationFrame(state.scrubAnimationFrame);
      }
      state.scrubAnimationFrame = requestAnimationFrame(() => {
        video.currentTime = parseFloat(startRange.value);
        if (playheadLine && state.duration) {
          playheadLine.style.left = `${(video.currentTime / state.duration) * 100}%`;
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
}
