import { ipcMain, shell } from 'electron';
import { getVideoInfo } from '../services/video-info.js';
import type { VideoInfo } from '../../shared/types.js';
import type { ValidateVideoResult } from '../../shared/types.js';
import { validateVideoPath } from '../services/validation.js';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function registerVideoIpc(): void {
  ipcMain.handle('validate-video', async (_, filePath: string): Promise<ValidateVideoResult> => {
    try {
      const info = await validateVideoPath(filePath);
      return { ok: true, info, url: pathToFileURL(filePath).href, name: path.basename(filePath) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível abrir este vídeo.' };
    }
  });
  ipcMain.handle('show-in-folder', async (_, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('get-video-info', async (_, filePath: string): Promise<VideoInfo | null> => {
    try {
      return await getVideoInfo(filePath);
    } catch (err) {
      console.error('Failed to get video info:', err);
      return null;
    }
  });
}
