import type { AppSettings, ExportOptions } from './types.js';

export const exportOptions: ExportOptions = {
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
};

/** Formatos cujo container permite stream copy (sem reencode). */
export const STREAM_COPY_CONTAINERS = new Set<string>(['mp4', 'mkv', 'mov']);

/** Prioridade de detectação de encoder por hardware: AMD -> NVIDIA -> Intel. */
export const HARDWARE_ENCODER_PRIORITIES = ['h264_amf', 'h264_nvenc', 'h264_qsv'] as const;

/** Extensões de vídeo aceitas ao abrir via argumento de linha de comando. */
export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov'] as const;

/** Nome do arquivo de configuração dentro de app.getPath('userData'). */
export const SETTINGS_FILENAME = 'settings.json';

export const DEFAULT_SETTINGS: AppSettings = { outputFolder: '' };

/** Subpasta criada dentro de app.getPath('videos') quando nenhuma pasta foi escolhida. */
export const FALLBACK_SUBFOLDER = 'MeganTrimmer';
