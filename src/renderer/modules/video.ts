import { els } from './dom.js';
import { state } from './state.js';
import { updateTimelineUI, startPlaybackLoop, stopPlaybackLoop, syncPlayhead } from './timeline.js';
import { generateThumbnails } from './thumbnails.js';
import { applyFiltersFromVideo } from './dropdowns.js';

const { video, btnSelect, playPause, muteBtn, volumeSlider, startRange, endRange, playhead } = els;

function updateMuteIcon() {
  if (muteBtn) {
    muteBtn.textContent = video?.muted ? '🔇' : '🔊';
  }
}

function updatePlayPauseUI(): void {
  if (!playPause) return;
  const paused = video ? video.paused : true;
  playPause.textContent = paused ? '▶️' : '⏸️';
  playPause.title = paused ? 'Play' : 'Pause';
}

export function loadVideoFromPath(path: string): void {
  if (!video) return;
  state.selectedPath = path;
  video.src = `file:///${path.replace(/\\/g, '/')}`;
}

export function setupVideoPlayer(): void {
  muteBtn?.addEventListener('click', () => {
    if (video) {
      video.muted = !video.muted;
      updateMuteIcon();
    }
  });

  // Listener único de loadedmetadata (consolida os dois do monolítico).
  video?.addEventListener('loadedmetadata', async () => {
    state.duration = video.duration;
    [startRange, endRange, playhead].forEach(s => { 
      if(s) { s.max = state.duration.toString(); s.step = "0.01"; }
    });
    if(startRange) startRange.value = "0";
    if(endRange) endRange.value = state.duration.toString();
    updateTimelineUI();
    updateMuteIcon();
    updatePlayPauseUI();

    // Only attempt to get info if we have a file path
    if (state.selectedPath) {
      const info = await window.api.getVideoInfo(state.selectedPath);
      applyFiltersFromVideo(info, video);
    }

    setTimeout(() => { generateThumbnails(); }, 50);
  });

  video?.addEventListener('play', updatePlayPauseUI);
  video?.addEventListener('pause', updatePlayPauseUI);
  video?.addEventListener('ended', updatePlayPauseUI);

  playPause?.addEventListener('click', () => {
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {
        stopPlaybackLoop();
      });
      startPlaybackLoop();
    } else {
      video.pause();
      stopPlaybackLoop();
    }
  });

  volumeSlider?.addEventListener('input', () => {
    if (video) video.volume = parseFloat(volumeSlider.value);
  });

  btnSelect?.addEventListener('click', async () => {
    const path = await window.api.selectVideo();
    if (path && video) {
      loadVideoFromPath(path);
    }
  });

  video?.addEventListener('timeupdate', () => {
    if (video.paused) syncPlayhead();
  });
}
