import { registerDialogIpc } from './dialog.js';
import { registerExportIpc } from './export.js';
import { registerOptionsIpc } from './options.js';
import { registerSettingsIpc } from './settings.js';
import { registerVideoIpc } from './video.js';
import type { AppSettings } from '../../shared/types.js';

/** Registra todos os handlers IPC do processo principal. Sem lógica aqui. */
export function registerIpcHandlers(onSettingsSaved?: (settings: AppSettings) => void): void {
  registerDialogIpc();
  registerOptionsIpc();
  registerSettingsIpc(onSettingsSaved);
  registerExportIpc();
  registerVideoIpc();
}
