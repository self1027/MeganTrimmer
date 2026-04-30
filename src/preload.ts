import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  trimVideo: (data: any) => ipcRenderer.invoke('trim-video', data),
  selectVideo: () => ipcRenderer.invoke('select-video'),
  showInFolder: (path: string) => ipcRenderer.invoke('show-in-folder', path),
  getExportOptions: () => ipcRenderer.invoke('get-export-options'),
  getVideoInfo: (filePath: string) => ipcRenderer.invoke('get-video-info', filePath)
});