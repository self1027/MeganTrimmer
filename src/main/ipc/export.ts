import { ipcMain } from 'electron';
import path from 'node:path';
import { trimVideo } from '../services/trim.js';
import { resolveOutputPath } from '../services/output-path.js';
import { loadSettings, resolveOutputFolder } from '../services/settings.js';
import type { TrimVideoPayload, TrimVideoResult } from '../../shared/types.js';
import { validateTrimRequest } from '../services/validation.js';

let exporting = false;

/**
 * Monta o caminho desejado do clipe dentro da pasta de saída:
 * `pasta/<input>_trimmed.<ext>`, preservando a extensão original quando
 * o formato é 'original'.
 */
function buildDesiredPath(input: string, folder: string, format?: string): string {
  const parsed = path.parse(input);
  const finalExtension = format && format !== 'original'
    ? format
    : parsed.ext.replace(/^\./, '');

  const filename = finalExtension
    ? `${parsed.name}_trimmed.${finalExtension}`
    : `${parsed.name}_trimmed`;

  return path.join(folder, filename);
}

export function registerExportIpc(): void {
  ipcMain.handle('trim-video', async (event, data: TrimVideoPayload): Promise<TrimVideoResult> => {
    if (exporting) return { ok: false, error: { message: 'Já existe uma exportação em andamento.', details: '' } };
    exporting = true;
    try {
      await validateTrimRequest(data);

      const settings = loadSettings();
      const folder = resolveOutputFolder(settings);
      const desiredPath = buildDesiredPath(data.input, folder, data.format);

      // Evita sobrescrever: se o destino já existir, gera `nome (1).ext`, `nome (2).ext`, …
      const finalPath = resolveOutputPath(desiredPath);

      await trimVideo(
        data.input,
        finalPath,
        data.start,
        data.duration,
        {
          format: data.format,
          resolution: data.resolution,
          frameRate: data.frameRate,
          formatType: data.formatType,
        },
        progress => { if (!event.sender.isDestroyed()) event.sender.send('export-progress', progress); }
      );
      return { ok: true, output: finalPath };
    } catch (err) {
      console.error('Erro no corte:', err);
      const details = err instanceof Error ? err.message : String(err);
      return { ok: false, error: {
        message: details.includes('ffmpeg') ? 'Não foi possível exportar o corte. Consulte os detalhes e tente novamente.' : details.split('\n')[0],
        details,
      } };
    } finally { exporting = false; }
  });
}
