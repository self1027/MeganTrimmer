import { els } from './dom.js';
import { state } from './state.js';

export async function generateThumbnails(): Promise<void> {
  const { video, framesContainer } = els;
  if (!video?.src || !state.ready || !state.duration || !framesContainer) return;
  const generation = ++state.thumbnailGeneration;
  const source = video.src;
  const duration = state.duration;
  const temporary = document.createElement('video');
  temporary.muted = true;
  temporary.preload = 'auto';
  const waitFor = (eventName: 'loadeddata' | 'seeked'): Promise<void> => new Promise((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timer);
      temporary.removeEventListener(eventName, success);
      temporary.removeEventListener('error', failure);
      error ? reject(error) : resolve();
    };
    const success = () => done();
    const failure = () => done(new Error('Miniatura indisponível.'));
    const timer = setTimeout(failure, 5000);
    temporary.addEventListener(eventName, success, { once: true });
    temporary.addEventListener('error', failure, { once: true });
  });
  try {
    const loaded = waitFor('loadeddata');
    temporary.src = source;
    await loaded;
    const count = Math.min(30, Math.max(1, Math.ceil(framesContainer.offsetWidth / 80)));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index++) {
      if (generation !== state.thumbnailGeneration || video.src !== source) return;
      const time = duration * index / count;
      if (Math.abs(temporary.currentTime - time) > 0.001) {
        const seeked = waitFor('seeked');
        temporary.currentTime = time;
        await seeked;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 72;
      canvas.getContext('2d')?.drawImage(temporary, 0, 0, canvas.width, canvas.height);
      const image = document.createElement('img');
      image.src = canvas.toDataURL('image/jpeg', 0.6);
      image.className = 'frame-thumb'; image.alt = ''; image.draggable = false;
      fragment.append(image);
    }
    if (generation === state.thumbnailGeneration && video.src === source) framesContainer.replaceChildren(fragment);
  } catch { /* Preview and export remain available if thumbnails cannot be generated. */ }
  finally { temporary.removeAttribute('src'); temporary.load(); }
}

export function setupResizeHandler(): void {
  window.addEventListener('resize', () => {
    clearTimeout(state.resizeTimeout);
    state.resizeTimeout = setTimeout(() => { void generateThumbnails(); }, 300);
  });
}
