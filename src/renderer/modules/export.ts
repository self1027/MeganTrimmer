import { els } from './dom.js';
import { state } from './state.js';
import { captureEdit, showStatus, updateEditorState } from './session.js';

let exportedPath: string | null = null;

export async function exportCurrentCut(): Promise<boolean> {
  if (!state.ready || !state.selectedPath || state.exporting || state.loading) return false;
  const snapshot = captureEdit();
  state.exporting = true;
  els.video?.pause();
  updateEditorState();
  const progress = document.getElementById('exportProgress')!;
  exportedPath = null;
  document.getElementById('progressFill')!.style.transform = 'scaleX(0)';
  progress.setAttribute('aria-valuenow', '0');
  progress.hidden = false;
  els.btnExport!.textContent = 'Exportando…';
  showStatus('Preparando exportação…');
  try {
    const result = await window.api.trimVideo({
      input: snapshot.input, start: snapshot.start.toFixed(6), duration: (snapshot.end - snapshot.start).toFixed(6),
      format: snapshot.format, resolution: snapshot.resolution, frameRate: snapshot.frameRate,
    });
    if (!result.ok) {
      showStatus(result.error.message, 'error', result.error.details);
      els.btnExport!.textContent = 'Tentar novamente';
      return false;
    }
    state.savedEdit = snapshot;
    exportedPath = result.output;
    showStatus('✓ Clipe salvo', 'success');
    document.getElementById('openExportFolder')!.hidden = false;
    els.btnExport!.textContent = 'Exportar corte';
    return true;
  } catch (error) {
    showStatus('Não foi possível exportar o corte. Tente novamente.', 'error', String(error));
    els.btnExport!.textContent = 'Tentar novamente';
    return false;
  } finally {
    state.exporting = false;
    progress.hidden = true;
    updateEditorState();
  }
}

export function setupExport(): void {
  const openFolder = document.getElementById('openExportFolder') as HTMLButtonElement;
  openFolder.addEventListener('click', async () => {
    if (!exportedPath || openFolder.disabled) return;
    openFolder.disabled = true;
    try {
      await window.api.showInFolder(exportedPath);
      showStatus('✓ Clipe salvo', 'success');
    } catch {
      showStatus('Clipe salvo. Não foi possível abrir a pasta. Tente novamente.', 'success');
    } finally {
      openFolder.hidden = false;
      openFolder.disabled = false;
    }
  });
  els.btnExport?.addEventListener('click', () => { void exportCurrentCut(); });
  const unsubscribe = window.api.onExportProgress(({ percent, phase }) => {
    if (!state.exporting) return;
    const value = Math.max(0, Math.min(100, percent));
    document.getElementById('progressFill')!.style.transform = `scaleX(${value / 100})`;
    document.getElementById('exportProgress')!.setAttribute('aria-valuenow', String(Math.round(value)));
    document.getElementById('statusMessage')!.textContent = phase === 'fallback'
      ? `Exportando por software… ${Math.round(value)}%` : `Exportando… ${Math.round(value)}%`;
  });
  window.addEventListener('beforeunload', unsubscribe, { once: true });
}
