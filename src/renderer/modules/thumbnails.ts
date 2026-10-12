import { els } from './dom.js';
import { state } from './state.js';

const { video, framesContainer } = els;

export async function generateThumbnails() {
  if (!video || !state.duration || !framesContainer) return;
  framesContainer.innerHTML = '';
  const tempVideo = document.createElement('video');
  tempVideo.src = video.src;
  tempVideo.muted = true;
  await new Promise(r => tempVideo.onloadedmetadata = r);
  
  const containerWidth = framesContainer.offsetWidth || window.innerWidth; 
  const thumbSize = 60; 
  const count = Math.ceil(containerWidth / thumbSize);
  const step = state.duration / count;

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

export function setupResizeHandler(): void {
  window.addEventListener('resize', () => {
    clearTimeout(state.resizeTimeout);
    state.resizeTimeout = setTimeout(() => {
      generateThumbnails();
    }, 300);
  });
}
