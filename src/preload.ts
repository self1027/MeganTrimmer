import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AppSettings,
  ExportOptions,
  TrimVideoPayload,
  TrimVideoResult,
  VideoInfo, ValidateVideoResult, ExportProgress
} from './shared/types.js';

contextBridge.exposeInMainWorld('api', {
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  validateVideo: (filePath: string): Promise<ValidateVideoResult> => ipcRenderer.invoke('validate-video', filePath),
  onExportProgress: (callback: (progress: ExportProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ExportProgress) => callback(progress);
    ipcRenderer.on('export-progress', listener);
    return () => { ipcRenderer.removeListener('export-progress', listener); };
  },
  trimVideo: (data: TrimVideoPayload): Promise<TrimVideoResult> => ipcRenderer.invoke('trim-video', data),
  selectVideo: (): Promise<string | null> => ipcRenderer.invoke('select-video'),
  showInFolder: (path: string): Promise<void> => ipcRenderer.invoke('show-in-folder', path),
  getExportOptions: (): Promise<ExportOptions> => ipcRenderer.invoke('get-export-options'),
  getVideoInfo: (filePath: string): Promise<VideoInfo | null> => ipcRenderer.invoke('get-video-info', filePath),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('set-settings', settings),
  pickOutputFolder: (): Promise<string | null> => ipcRenderer.invoke('pick-output-folder')
});
