import { ipcMain, shell } from 'electron';
import { getVideoInfo } from '../services/video-info.js';
import type { VideoInfo } from '../../shared/types.js';

export function registerVideoIpc(): void {
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
