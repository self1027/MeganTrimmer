/**
 * Tipos compartilhados entre os processos main, preload e renderer.
 * Mantidos livres de dependências de runtime (apenas tipos).
 */

export type ExportOptionType = 'video' | 'audio';

export interface ExportOptionItem {
  label: string;
  value: string;
  type?: ExportOptionType;
}

export interface ExportOptions {
  format: ExportOptionItem[];
  resolution: ExportOptionItem[];
  frameRate: ExportOptionItem[];
}

export interface TrimVideoPayload {
  input: string;
  start: string;
  duration: string;
  format?: string;
  resolution?: string;
  frameRate?: string;
  formatType?: ExportOptionType;
}

export interface TrimVideoOptions {
  format?: string;
  resolution?: string;
  frameRate?: string;
  formatType?: ExportOptionType;
}

export type TrimVideoResult =
  | { ok: true; output: string }
  | { ok: false; error: unknown };

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  frameRate: number;
}

export interface AppSettings {
  /** Caminho absoluto da pasta de saída; '' = usar fallback (Videos/MeganTrimmer). */
  outputFolder: string;
}
