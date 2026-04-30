import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { trimVideo } from './trim.js';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;

export const exportOptions = {
  format: [
    { label: 'ORIGINAL', value: 'original', type: 'video' },
    { label: 'MP4', value: 'mp4', type: 'video' },
    { label: 'MKV', value: 'mkv', type: 'video' },
    { label: 'AVI', value: 'avi', type: 'video' },
    { label: 'MP3', value: 'mp3', type: 'audio' },
    { label: 'WAV', value: 'wav', type: 'audio' }
  ],
  resolution: [
    { label: 'ORIGINAL', value: 'original' },
    { label: '3840×2160', value: '3840:2160' },
    { label: '2560×1440', value: '2560:1440' },
    { label: '1920×1080', value: '1920:1080' },
    { label: '1280×720', value: '1280:720' },
    { label: '640×480', value: '640:480' },
  ],
  frameRate: [
    { label: 'ORIGINAL', value: 'original' },
    { label: '120 FPS', value: '120' },
    { label: '60 FPS', value: '60' },
    { label: '30 FPS', value: '30' },
    { label: '24 FPS', value: '24' },
    { label: '15 FPS', value: '15' },
  ],
} as const;

function createWindow(filePath?: string) {
  mainWindow = new BrowserWindow({
    minWidth: 900,
    minHeight: 700,
    resizable: true,
    icon: path.join(__dirname, 'assets', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  //mainWindow.webContents.openDevTools();

  const indexPath = path.join(__dirname, 'renderer', 'index.html');

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'mov'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-export-options', () => {
  return exportOptions;
});

ipcMain.handle('trim-video', async (_, data: any) => {
  try {
    await trimVideo(
      data.input,
      data.output,
      data.start,
      data.duration,
      {
        format: data.format,
        resolution: data.resolution,
        frameRate: data.frameRate,
        formatType: data.formatType,
      }
    );
    return { ok: true };
  } catch (err) {
    console.error('Erro no corte:', err);
    return { ok: false, error: err };
  }
});

ipcMain.handle('show-in-folder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath);
});

function getVideoInfo(filePath: string): Promise<{
  width: number; height: number; duration: number; frameRate: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));
      const width = videoStream.width ?? 0;
      const height = videoStream.height ?? 0;
      const duration = metadata.format.duration ?? 0;
      // frame rate: prefer r_frame_rate, fallback to avg_frame_rate
      let frameRate = 0;
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        if (den) frameRate = num / den;
      } else if (videoStream.avg_frame_rate) {
        const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
        if (den) frameRate = num / den;
      }
      resolve({ width, height, duration, frameRate });
    });
  });
}

ipcMain.handle('get-video-info', async (_, filePath: string) => {
  try {
    return await getVideoInfo(filePath);
  } catch (err) {
    console.error('Failed to get video info:', err);
    return null;
  }
});