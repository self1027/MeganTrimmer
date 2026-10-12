import { ipcMain, dialog } from 'electron';
import { loadSettings, saveSettings } from '../services/settings.js';
import type { AppSettings } from '../../shared/types.js';

export function registerSettingsIpc(): void {
  ipcMain.handle('get-settings', (): AppSettings => {
    return loadSettings();
  });

  ipcMain.handle('set-settings', (_, patch: Partial<AppSettings>): AppSettings => {
    const current = loadSettings();
    const next: AppSettings = { ...current };

    // Não confiar no renderer: só aceitar outputFolder se for string.
    if (typeof patch?.outputFolder === 'string') {
      next.outputFolder = patch.outputFolder;
    }

    saveSettings(next);
    return next;
  });

  ipcMain.handle('pick-output-folder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });

    // Cancelado → settings inalterado.
    if (result.canceled || result.filePaths.length === 0) return null;

    const folder = result.filePaths[0];
    saveSettings({ ...loadSettings(), outputFolder: folder });
    return folder;
  });
}
