import { ipcMain } from 'electron';
import { exportOptions } from '../../shared/constants.js';

export function registerOptionsIpc(): void {
  ipcMain.handle('get-export-options', () => {
    return exportOptions;
  });
}
