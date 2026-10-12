import { els } from './dom.js';
import { state } from './state.js';

const { btnExport, formatSelect, resolutionSelect, frameRateSelect } = els;

let exportOriginalText = 'EXPORTAR CORTE';

// Erro de exportação (ffmpeg ou payload inválido): UI de erro tratada DENTRO do
// handler — o main engola o erro do ffmpeg em { ok: false }.
function showExportError(error: unknown): void {
  const progressTrack = document.querySelector('.progress-track') as HTMLElement | null;
  const progressFill = document.querySelector('.progress-fill') as HTMLElement | null;

  console.error('Export error:', error);
  btnExport!.textContent = '❌ ERRO';
  btnExport!.classList.remove('btn-processing');
  if (progressFill) {
    progressFill.style.width = '100%';
    progressFill.style.background = '#ff4d4d';
  }

  setTimeout(() => {
    btnExport!.textContent = exportOriginalText;
    btnExport!.disabled = false;
    if (progressTrack) progressTrack.style.display = 'none';
  }, 3000);
}

export function setupExport(): void {
  btnExport?.addEventListener('click', async () => {
    if (!state.selectedPath || btnExport.disabled) return;

    const progressTrack = document.querySelector('.progress-track') as HTMLElement | null;
    const progressFill = document.querySelector('.progress-fill') as HTMLElement | null;
    const sInput = document.querySelector('#startRange') as HTMLInputElement | null;
    const eInput = document.querySelector('#endRange') as HTMLInputElement | null;

    if (!sInput || !eInput) return;

    exportOriginalText = btnExport.textContent || 'EXPORTAR CORTE';
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

    const format = formatSelect?.value ?? 'original';
    const resolution = resolutionSelect?.value ?? 'original';
    const frameRate = frameRateSelect?.value ?? 'original';

    try {
      // O main monta o caminho final (pasta configurada + `_trimmed` + extensão final).
      const result = await window.api.trimVideo({ 
        input: state.selectedPath, 
        start: start.toFixed(6), 
        duration: rawDuration.toFixed(6),
        format,
        resolution,
        frameRate,
      });

      if (!result.ok) {
        showExportError(result.error);
        return;
      }

      if (progressFill) progressFill.style.width = '100%';
      btnExport.textContent = '✔ CONCLUÍDO';
      btnExport.classList.remove('btn-processing');
      
      // Abre a pasta com o arquivo realmente gravado (pode ter virado `arquivo (1).mp4`).
      await window.api.showInFolder(result.output);

      setTimeout(() => {
        btnExport.textContent = exportOriginalText;
        btnExport.disabled = false;
        if (progressTrack) progressTrack.style.display = 'none';
      }, 2000);

    } catch (err) {
      // Exceções do IPC em si (ex: handler não registrado).
      showExportError(err);
    }
  });
}
