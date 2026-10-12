import type {
  AppSettings,
  ExportOptions,
  TrimVideoPayload,
  TrimVideoResult,
  VideoInfo
} from '../../shared/types.js';

declare global {
  interface Window {
    api: {
      selectVideo: () => Promise<string | null>;
      trimVideo: (options: TrimVideoPayload) => Promise<TrimVideoResult>;
      showInFolder: (path: string) => Promise<void>;
      getExportOptions: () => Promise<ExportOptions>;
      getVideoInfo: (filePath: string) => Promise<VideoInfo | null>;
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      pickOutputFolder: () => Promise<string | null>;
    };
  }
}
