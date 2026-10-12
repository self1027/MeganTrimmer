import { BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Raiz do build (dist/): este módulo compila para dist/main/window.js. */
const APP_ROOT = path.join(__dirname, '..');

export function createWindow(filePath?: string): BrowserWindow {
  const mainWindow = new BrowserWindow({
    minWidth: 900,
    minHeight: 700,
    resizable: true,
    icon: path.join(APP_ROOT, 'assets', 'logo.ico'),
    webPreferences: {
      preload: path.join(APP_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  //mainWindow.webContents.openDevTools();

  const indexPath = path.join(APP_ROOT, 'renderer', 'index.html');

  if (filePath) {
    const fileUrl = new URL(`file://${indexPath}`);
    fileUrl.searchParams.set('externalFile', filePath);
    mainWindow.loadURL(fileUrl.href);
  } else {
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}
