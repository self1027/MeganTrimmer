import fs from 'node:fs/promises';
import path from 'node:path';
import { SUPPORTED_VIDEO_EXTENSIONS, exportOptions } from '../../shared/constants.js';
import { getVideoInfo } from './video-info.js';
import type { TrimVideoPayload, VideoInfo } from '../../shared/types.js';

export async function validateVideoPath(input: string): Promise<VideoInfo> {
  if (typeof input !== 'string' || !path.isAbsolute(input) ||
    !SUPPORTED_VIDEO_EXTENSIONS.some(extension => path.extname(input).toLowerCase() === `.${extension}`)) {
    throw new Error('Escolha um vídeo MP4, MKV ou MOV válido.');
  }
  if (!(await fs.stat(input)).isFile()) throw new Error('O caminho selecionado não é um arquivo.');
  const info = await getVideoInfo(input);
  if (!Number.isFinite(info.duration) || info.duration <= 0 || info.width <= 0 || info.height <= 0) {
    throw new Error('Não foi possível ler um vídeo válido neste arquivo.');
  }
  return info;
}

export async function validateTrimRequest(data: TrimVideoPayload): Promise<void> {
  if (!data || typeof data !== 'object') throw new Error('Pedido de exportação inválido.');
  for (const key of ['format', 'resolution', 'frameRate'] as const) {
    if (data[key] !== undefined && !exportOptions[key].some(option => option.value === data[key])) {
      throw new Error(`Opção de exportação inválida: ${key}.`);
    }
  }
  const info = await validateVideoPath(data.input);
  const start = Number(data.start), duration = Number(data.duration);
  if (typeof data.start !== 'string' || !data.start.trim() || typeof data.duration !== 'string' || !data.duration.trim() ||
    !Number.isFinite(start) || !Number.isFinite(duration) || start < 0 || duration <= 0 ||
    start >= info.duration || start + duration > info.duration + 0.05) {
    throw new Error('O intervalo de corte deve estar dentro da duração do vídeo.');
  }
}
