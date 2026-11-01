import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { UpdateService } from './services/updater.js';
import { ExitGuard } from './services/exit-guard.js';
import { loadSettings } from './services/settings.js';
import { isExporting } from './ipc/export.js';

export function setupUpdates(window: BrowserWindow, injectedService?: UpdateService): UpdateService {
  const supported = app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE;
  const service = injectedService ?? new UpdateService(supported ? electronUpdater.autoUpdater : null,
    app.getVersion(), loadSettings().silentUpdates, () => !isExporting());
  let dirty = false;
  let allowQuit = false;
  let sessionEnding = false;
  let exiting = false;
  const guard = new ExitGuard(isExporting, () => dirty, async () => {
    const result = await dialog.showMessageBox(window, {
      type: 'question', title: 'Alterações não exportadas',
      message: 'Fechar e descartar as alterações deste corte?',
      detail: 'O vídeo original e os clipes já exportados serão preservados.',
      buttons: ['Continuar editando', 'Descartar e fechar'], defaultId: 0, cancelId: 0,
    });
    return result.response === 1;
  });

  async function requestExit(relaunch: boolean): Promise<boolean> {
    if (exiting || sessionEnding) return false;
    exiting = true;
    try {
      if (isExporting()) {
        void dialog.showMessageBox(window, { type: 'info', message: 'Aguarde a exportação terminar antes de fechar ou atualizar.' });
        return false;
      }
      if (!await guard.approve() || window.isDestroyed() || isExporting()) return false;
      allowQuit = true;
      if (relaunch) {
        const installing = service.install(true);
        if (!installing) allowQuit = false;
        return installing;
      }
      if (!service.installOnClose()) app.quit();
      return true;
    } finally { exiting = false; }
  }

  const channels = ['get-update-state', 'check-for-updates', 'download-update', 'install-update'];
  const handlers = [() => service.getState(), () => service.check(), () => service.download(), () => requestExit(true)];
  channels.forEach((channel, index) => ipcMain.handle(channel, event => {
    if (event.sender !== window.webContents) throw new Error('Janela inválida.');
    return handlers[index]();
  }));
  const reportDirty = (event: Electron.IpcMainEvent, value: unknown) => {
    if (event.sender === window.webContents && typeof value === 'boolean') dirty = value;
  };
  ipcMain.on('editor-dirty', reportDirty);
  const unsubscribe = service.subscribe(state => {
    if (state.status === 'error') allowQuit = false;
    if (!window.isDestroyed()) window.webContents.send('update-state', state);
  });
  window.on('close', event => {
    if (!allowQuit && !sessionEnding) { event.preventDefault(); void requestExit(false); }
  });
  window.on('session-end', () => { sessionEnding = true; });
  const beforeQuit = (event: Electron.Event) => {
    if (!allowQuit && !sessionEnding) { event.preventDefault(); void requestExit(false); }
  };
  app.on('before-quit', beforeQuit);
  window.webContents.once('did-finish-load', () => { void service.check(); });
  const timer = setInterval(() => { void service.check(); }, 6 * 60 * 60 * 1000);
  timer.unref();
  window.once('closed', () => {
    clearInterval(timer);
    unsubscribe();
    channels.forEach(channel => ipcMain.removeHandler(channel));
    ipcMain.removeListener('editor-dirty', reportDirty);
    app.removeListener('before-quit', beforeQuit);
  });
  return service;
}
