import { els } from './dom.js';
import { state } from './state.js';
import { isEditDirty, type EditSnapshot } from '../../shared/edit-session.js';

export function captureEdit(): EditSnapshot {
  return {
    input: state.selectedPath ?? '', start: Number(els.startRange?.value ?? 0), end: Number(els.endRange?.value ?? 0),
    format: els.formatSelect?.value || 'original', resolution: els.resolutionSelect?.value || 'original',
    frameRate: els.frameRateSelect?.value || 'original',
  };
}

export function hasUnsavedChanges(): boolean {
  return !!state.savedEdit && isEditDirty(captureEdit(), state.savedEdit);
}

export function updateEditorState(): void {
  window.api.reportEditorDirty(hasUnsavedChanges());
  const busy = state.exporting || state.loading;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('[data-requires-video]')
    .forEach(control => control.disabled = !state.ready || busy);
  document.querySelectorAll<HTMLButtonElement>('[data-lock-while-busy]')
    .forEach(control => control.disabled = busy);
  const dirty = document.getElementById('dirtyState')!;
  dirty.textContent = state.ready ? (hasUnsavedChanges() ? 'Alterações não exportadas' : 'Pronto para cortar') : 'Nenhum vídeo aberto';
  dirty.classList.toggle('is-dirty', hasUnsavedChanges());
  document.body.classList.toggle('is-busy', busy);
  document.body.classList.toggle('has-video', state.ready);
}

export function showStatus(message: string, kind: 'error' | 'success' | 'info' = 'info', details = ''): void {
  const status = document.getElementById('exportStatus')!;
  status.hidden = false;
  status.dataset.kind = kind;
  document.getElementById('openExportFolder')!.hidden = true;
  document.getElementById('statusMessage')!.textContent = message;
  const detail = document.getElementById('errorDetails') as HTMLTextAreaElement;
  detail.value = details;
  document.getElementById('copyDetails')!.textContent = 'Copiar detalhes';
  const disclosure = document.getElementById('statusDetails') as HTMLDetailsElement;
  disclosure.hidden = !details;
  disclosure.open = false;
}

export function setupSession(): void {
  document.addEventListener('input', updateEditorState);
  document.addEventListener('change', updateEditorState);
  document.getElementById('copyDetails')!.addEventListener('click', async () => {
    const details = document.getElementById('errorDetails') as HTMLTextAreaElement;
    try {
      await navigator.clipboard.writeText(details.value);
      document.getElementById('copyDetails')!.textContent = 'Copiado';
    } catch { details.focus(); details.select(); }
  });
  updateEditorState();
}
