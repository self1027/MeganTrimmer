import { registerDialogIpc } from './dialog.js';
import { registerExportIpc } from './export.js';
import { registerOptionsIpc } from './options.js';
import { registerSettingsIpc } from './settings.js';
import { registerVideoIpc } from './video.js';

/** Registra todos os handlers IPC do processo principal. Sem lógica aqui. */
export function registerIpcHandlers(): void {
  registerDialogIpc();
  registerOptionsIpc();
  registerSettingsIpc();
  registerExportIpc();
  registerVideoIpc();
}
