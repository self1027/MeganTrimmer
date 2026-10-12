import { app, Menu } from 'electron';
import path from 'path';
import { SUPPORTED_VIDEO_EXTENSIONS } from '../shared/constants.js';
import { registerIpcHandlers } from './ipc/index.js';
import { createWindow } from './window.js';

Menu.setApplicationMenu(null);

function resolveExternalFilePath(argv: string[]): string | undefined {
  return argv.find(arg =>
    (SUPPORTED_VIDEO_EXTENSIONS.some(ext => arg.toLowerCase().endsWith(`.${ext}`))) &&
    path.isAbsolute(arg)
  );
}

app.whenReady().then(() => {
  const filePath = resolveExternalFilePath(process.argv);

  registerIpcHandlers();
  createWindow(filePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
