import { ipcMain, dialog } from 'electron';
import { SUPPORTED_VIDEO_EXTENSIONS } from '../../shared/constants.js';

export function registerDialogIpc(): void {
  ipcMain.handle('select-video', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: [...SUPPORTED_VIDEO_EXTENSIONS] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
