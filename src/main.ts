import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { trimVideo } from './trim.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;

function createWindow(filePath?: string) {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 1150,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const indexPath = path.join(__dirname, 'renderer', 'index.html');

  if (filePath) {
    const fileUrl = new URL(`file://${indexPath}`);
    fileUrl.searchParams.set('externalFile', filePath);
    mainWindow.loadURL(fileUrl.href);
  } else {
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  const args = process.argv;
  
  const filePath = args.find(arg => 
    (arg.toLowerCase().endsWith('.mp4') || 
     arg.toLowerCase().endsWith('.mkv') || 
     arg.toLowerCase().endsWith('.mov')) && 
    path.isAbsolute(arg)
  );

  createWindow(filePath);
});

ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'mov'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('trim-video', async (_, data: any) => {
  try {
    await trimVideo(data.input, data.output, data.start, data.duration);
    return { ok: true };
  } catch (err) {
    console.error('Erro no corte:', err);
    return { ok: false, error: err };
  }
});

ipcMain.handle('show-in-folder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath);
});