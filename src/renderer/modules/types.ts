import type {
  AppSettings, UpdateState,
  ExportOptions,
  TrimVideoPayload,
  TrimVideoResult,
  VideoInfo, ValidateVideoResult, ExportProgress
} from '../../shared/types.js';

declare global {
  interface Window {
    api: {
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => Promise<UpdateState>;
      downloadUpdate: () => Promise<UpdateState>;
      installUpdate: () => Promise<boolean>;
      reportEditorDirty: (dirty: boolean) => void;
      onUpdateState: (callback: (state: UpdateState) => void) => () => void;
      getPathForFile: (file: File) => string;
      validateVideo: (filePath: string) => Promise<ValidateVideoResult>;
      onExportProgress: (callback: (progress: ExportProgress) => void) => () => void;
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
