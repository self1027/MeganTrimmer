import { els } from './dom.js';
import { state } from './state.js';
import { updateTimelineUI, startPlaybackLoop, stopPlaybackLoop, syncPlayhead } from './timeline.js';
import { generateThumbnails } from './thumbnails.js';
import { applyFiltersFromVideo } from './dropdowns.js';
import { exportCurrentCut } from './export.js';
import { captureEdit, hasUnsavedChanges, showStatus, updateEditorState } from './session.js';

const { video, btnSelect, playPause, muteBtn, volumeSlider, startRange, endRange, playhead } = els;

function updatePlayerIcons(): void {
  playPause!.dataset.icon = video?.paused ? 'play' : 'pause';
  playPause!.setAttribute('aria-label', video?.paused ? 'Reproduzir' : 'Pausar');
  muteBtn!.dataset.icon = video?.muted ? 'muted' : 'volume';
  muteBtn!.setAttribute('aria-label', video?.muted ? 'Ativar som' : 'Silenciar');
}

function confirmReplacement(): Promise<string> {
  const dialog = document.getElementById('replaceDialog') as HTMLDialogElement;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
}

export async function loadVideoFromPath(path: string): Promise<void> {
  if (!video || state.exporting || (document.getElementById('replaceDialog') as HTMLDialogElement).open) return;
  const generation = ++state.loadGeneration;
  state.loading = true;
  updateEditorState();
  const candidate = document.createElement('video');
  try {
    const result = await window.api.validateVideo(path);
    if (generation !== state.loadGeneration) return;
    if (!result.ok) { showStatus('Não foi possível abrir o vídeo.', 'error', result.error); return; }
    candidate.preload = 'auto';
    candidate.muted = true;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('O vídeo demorou demais para carregar.')), 15000);
      const finish = (error?: Error) => {
        clearTimeout(timer);
        candidate.onloadeddata = null;
        candidate.onerror = null;
        error ? reject(error) : resolve();
      };
      candidate.onloadeddata = () => finish();
      candidate.onerror = () => finish(new Error('Este vídeo não pode ser reproduzido no editor.'));
      candidate.src = result.url;
    });
    if (generation !== state.loadGeneration) return;
    state.loading = false;
    if (hasUnsavedChanges()) {
      const choice = await confirmReplacement();
      if (choice === 'cancel' || !choice) return;
      if (choice === 'export' && !await exportCurrentCut()) return;
    }
    if (generation !== state.loadGeneration) return;
    state.loading = true;
    state.thumbnailGeneration++;
    stopPlaybackLoop();
    if (state.scrubAnimationFrame !== null) cancelAnimationFrame(state.scrubAnimationFrame);
    clearTimeout(state.resizeTimeout);
    video.pause();
    state.selectedPath = path;
    state.duration = candidate.duration;
    state.ready = true;
    video.src = result.url;
    [startRange, endRange, playhead].forEach(range => {
      if (range) { range.min = '0'; range.max = String(state.duration); range.step = '0.001'; }
    });
    startRange!.value = '0';
    endRange!.value = String(state.duration);
    playhead!.value = '0';
    if (els.playheadLine) els.playheadLine.style.left = '0%';
    els.framesContainer!.replaceChildren();
    els.formatSelect!.value = 'original';
    applyFiltersFromVideo(result.info, candidate);
    els.formatSelect!.dispatchEvent(new Event('change'));
    state.savedEdit = captureEdit();
    document.getElementById('fileName')!.textContent = result.name;
    document.getElementById('fileName')!.title = path;
    document.getElementById('videoMeta')!.textContent = `${result.info.width} × ${result.info.height} · ${result.info.frameRate.toFixed(2)} fps`;
    document.getElementById('emptyState')!.hidden = true;
    document.getElementById('exportStatus')!.hidden = true;
    els.btnExport!.textContent = 'Exportar corte';
    updateTimelineUI();
    updatePlayerIcons();
    void generateThumbnails();
  } catch (error) {
    if (generation === state.loadGeneration) showStatus('Não foi possível abrir o vídeo. O corte atual foi preservado.', 'error', String(error));
  } finally {
    candidate.removeAttribute('src');
    candidate.load();
    if (generation === state.loadGeneration) { state.loading = false; updateEditorState(); }
  }
}

export function setupVideoPlayer(): void {
  muteBtn?.addEventListener('click', () => { if (video) { video.muted = !video.muted; updatePlayerIcons(); } });
  ['play', 'pause', 'ended'].forEach(event => video?.addEventListener(event, updatePlayerIcons));
  video?.addEventListener('loadeddata', () => { if (state.ready) void generateThumbnails(); });
  playPause?.addEventListener('click', () => {
    if (!video || !state.ready || state.exporting || state.loading) return;
    if (video.paused) {
      video.play().then(startPlaybackLoop).catch(error => showStatus('Não foi possível reproduzir o vídeo.', 'error', String(error)));
    } else { video.pause(); stopPlaybackLoop(); }
  });
  volumeSlider?.addEventListener('input', () => { if (video) video.volume = Number(volumeSlider.value); });
  btnSelect?.addEventListener('click', async () => {
    try { const path = await window.api.selectVideo(); if (path) await loadVideoFromPath(path); }
    catch (error) { showStatus('Não foi possível selecionar o arquivo.', 'error', String(error)); }
  });
  video?.addEventListener('timeupdate', () => { if (video.paused) syncPlayhead(); });
  let depth = 0;
  window.addEventListener('dragenter', event => {
    event.preventDefault();
    if (event.dataTransfer?.types.includes('Files') && !state.exporting) { depth++; document.body.classList.add('dragging-file'); }
  });
  window.addEventListener('dragover', event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = state.exporting ? 'none' : 'copy'; });
  window.addEventListener('dragleave', event => { event.preventDefault(); if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging-file'); } });
  window.addEventListener('drop', event => {
    event.preventDefault(); depth = 0; document.body.classList.remove('dragging-file');
    if (state.exporting) return;
    const files = event.dataTransfer?.files;
    if (!files || files.length !== 1) { showStatus('Arraste apenas um vídeo de cada vez.', 'error'); return; }
    try {
      const path = window.api.getPathForFile(files[0]);
      if (!path) throw new Error('Arraste um arquivo salvo no computador.');
      void loadVideoFromPath(path);
    } catch (error) { showStatus('Não foi possível abrir o arquivo arrastado.', 'error', String(error)); }
  });
  window.addEventListener('blur', () => { depth = 0; document.body.classList.remove('dragging-file'); });
  updatePlayerIcons();
}
