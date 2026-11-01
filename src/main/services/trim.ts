import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpeg, { binaryPath } from './ffmpeg.js';
import { HARDWARE_ENCODER_PRIORITIES } from '../../shared/constants.js';
import type { ExportProgress, TrimVideoOptions } from '../../shared/types.js';

const encoderOptions: Record<string, string[]> = {
  h264_amf: ['-quality', 'speed'],
  h264_nvenc: ['-preset', 'p4'],
  h264_qsv: ['-preset', 'veryfast'],
  libx264: ['-preset', 'veryfast', '-crf', '20'],
};
let encoderPromise: Promise<string> | undefined;

export async function selectEncoder(available: string[], probe: (name: string) => Promise<boolean>): Promise<string> {
  for (const name of HARDWARE_ENCODER_PRIORITIES) {
    if (available.includes(name) && await probe(name)) return name;
  }
  return 'libx264';
}

function probeEncoder(name: string): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn(binaryPath, ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=128x128:rate=30',
      '-frames:v', '2', '-c:v', name, ...encoderOptions[name], '-f', 'null', '-'],
    { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 8000);
    child.once('error', () => { clearTimeout(timer); resolve(false); });
    child.once('close', code => { clearTimeout(timer); resolve(code === 0); });
  });
}

function getBestEncoder(): Promise<string> {
  return encoderPromise ??= new Promise<string>(resolve => {
    ffmpeg.getAvailableEncoders((error, encoders) => {
      if (error || !encoders) return resolve('libx264');
      selectEncoder(Object.keys(encoders), probeEncoder).then(resolve, () => resolve('libx264'));
    });
  });
}

function canCopy(target: string, metadata: ffmpeg.FfprobeData): boolean {
  if (target === 'original') return true;
  if (target === 'mkv') return metadata.streams.every(stream => stream.codec_type !== 'data');
  if (target !== 'mp4') return false;
  return metadata.streams.every(stream => {
    if (stream.codec_type === 'video') return ['h264', 'hevc', 'mpeg4', 'av1'].includes(stream.codec_name!);
    if (stream.codec_type === 'audio') return ['aac', 'mp3', 'alac', 'ac3', 'eac3'].includes(stream.codec_name!);
    return stream.codec_type === 'subtitle' && stream.codec_name === 'mov_text';
  });
}

export async function trimVideo(input: string, output: string, start: string, duration: string,
  options: TrimVideoOptions = {}, onProgress: (progress: ExportProgress) => void = () => {}): Promise<void> {
  const target = options.format ?? 'original';
  const audioOnly = target === 'mp3' || target === 'wav';
  const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(input, (error, data) => error ? reject(error) : resolve(data));
  });
  if (audioOnly && !metadata.streams.some(stream => stream.codec_type === 'audio')) {
    throw new Error('Este vídeo não possui uma trilha de áudio.');
  }
  const filters: string[] = [];
  if (options.resolution && options.resolution !== 'original') {
    const [width, height] = options.resolution.split(':');
    filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=bilinear`);
  }
  const copy = !audioOnly && !filters.length && (!options.frameRate || options.frameRate === 'original') && canCopy(target, metadata);
  if (!copy && !audioOnly) filters.push('pad=ceil(iw/2)*2:ceil(ih/2)*2', 'format=yuv420p');
  if (options.frameRate && options.frameRate !== 'original' && !audioOnly) filters.push(`fps=${options.frameRate}`);
  const parsed = path.parse(output);
  const temporary = path.join(parsed.dir, `.${parsed.name}.${randomUUID()}.partial${parsed.ext}`);
  const encoder = copy || audioOnly ? 'libx264' : await getBestEncoder();

  const encode = (codec: string, phase: ExportProgress['phase']): Promise<void> => new Promise((resolve, reject) => {
    const command = ffmpeg(input).inputOptions(['-ss', start]).duration(duration)
      .outputOptions(['-avoid_negative_ts', 'make_zero', '-map_metadata', '0']);
    if (audioOnly) {
      command.noVideo().audioCodec(target === 'mp3' ? 'libmp3lame' : 'pcm_s16le').outputOptions(['-map', '0:a:0']);
    } else if (copy) {
      command.outputOptions(['-c', 'copy', '-map', '0']);
      if (target === 'mkv') {
        metadata.streams.filter(stream => stream.codec_type === 'subtitle').forEach((stream, index) => {
          if (stream.codec_name === 'mov_text') command.outputOptions([`-c:s:${index}`, 'srt']);
        });
      }
    } else {
      command.videoCodec(codec).audioCodec('aac').outputOptions([...encoderOptions[codec], '-map', '0:v:0', '-map', '0:a:0?']);
      if (filters.length) command.videoFilters(filters);
    }
    if (target !== 'original') command.format(target === 'mkv' ? 'matroska' : target);
    onProgress({ percent: 0, phase });
    command.on('progress', progress => {
      const seconds = progress.timemark?.split(':').reduce((total, part) => total * 60 + Number(part), 0) || 0;
      onProgress({ percent: Math.max(0, Math.min(99, seconds / Number(duration) * 100)), phase });
    }).on('end', () => resolve()).on('error', (error, _stdout, stderr) => {
      reject(new Error(`${error.message}\n${stderr || ''}`));
    }).save(temporary);
  });

  try {
    try { await encode(encoder, 'encoding'); }
    catch (error) {
      if (copy || audioOnly || encoder === 'libx264') throw error;
      fs.rmSync(temporary, { force: true });
      encoderPromise = Promise.resolve('libx264');
      await encode('libx264', 'fallback');
    }
    if (!fs.statSync(temporary).size) throw new Error('O processamento produziu um arquivo vazio.');
    try {
      // Publish atomically without overwriting a file created meanwhile.
      fs.linkSync(temporary, output);
    } catch (error) {
      if (!['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EINVAL', 'ENOSYS'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      // exFAT has no hard links: reserve the name exclusively before the same-folder rename.
      const reservation = fs.openSync(output, 'wx');
      fs.closeSync(reservation);
      try { fs.renameSync(temporary, output); }
      catch (renameError) { fs.rmSync(output, { force: true }); throw renameError; }
    }
    onProgress({ percent: 100, phase: 'encoding' });
  } finally { fs.rmSync(temporary, { force: true }); }
}
