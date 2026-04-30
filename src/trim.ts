import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const getCleanPath = (): string => {
  if (!ffmpegPath) return '';
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
};

ffmpeg.setFfmpegPath(getCleanPath());

/**
 * Cache for available hardware encoders to avoid re-probing every time.
 */
let supportedHardwareEncoder: string | null = null;

const getBestEncoder = (): Promise<string> => {
  return new Promise((resolve) => {
    if (supportedHardwareEncoder) return resolve(supportedHardwareEncoder);

    ffmpeg.getAvailableEncoders((err, encoders) => {
      if (err || !encoders) return resolve('libx264');

      // Priority: AMD -> NVIDIA -> Intel -> Software
      const priorities = ['h264_amf', 'h264_nvenc', 'h264_qsv'];
      for (const encoder of priorities) {
        if (encoders[encoder]) {
          supportedHardwareEncoder = encoder;
          return resolve(encoder);
        }
      }
      
      supportedHardwareEncoder = 'libx264';
      resolve('libx264');
    });
  });
};

const STREAM_COPY_CONTAINERS = new Set(['mp4', 'mkv', 'mov']);

export async function trimVideo(
  input: string,
  output: string,
  start: string,
  duration: string,
  options?: {
    format?: string;
    resolution?: string;
    frameRate?: string;
    formatType?: 'video' | 'audio';
  }
): Promise<void> {
  // Detect encoder before building the command
  const vCodec = await getBestEncoder();
  const isGPU = vCodec.includes('_');

  return new Promise((resolve, reject) => {
    const targetFormat = options?.format ?? 'original';
    const isAudioOnly = options?.formatType === 'audio';

    const cmd = ffmpeg(input).inputOptions([`-ss ${start}`]);

    if (duration) cmd.setDuration(duration);

    if (isAudioOnly) {
      cmd.noVideo();
      const aCodec = targetFormat === 'mp3' ? 'libmp3lame' : (targetFormat === 'wav' ? 'pcm_s16le' : 'copy');
      cmd.audioCodec(aCodec);
    } else {
      const videoFilters: string[] = [];

      if (options?.resolution && options.resolution !== 'original') {
        const [w, h] = options.resolution.split(':');
        videoFilters.push(
          `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=fast_bilinear`,
          `pad='ceil(iw/2)*2:ceil(ih/2)*2:(ow-iw)/2:(oh-ih)/2'`,
          `format=yuv420p`
        );
      }

      if (options?.frameRate && options.frameRate !== 'original') {
        videoFilters.push(`fps=${options.frameRate}`);
      }

      const needsReencode = videoFilters.length > 0 || (targetFormat !== 'original' && !STREAM_COPY_CONTAINERS.has(targetFormat));

      if (needsReencode) {
        // Build output options based on detected encoder
        const outputOpts = [
          '-avoid_negative_ts', 'make_zero',
          '-map_metadata', '0'
        ];

        if (isGPU) {
          // Hardware presets are different (quality/speed usually works for AMF/NVENC/QSV)
          outputOpts.push('-quality', 'speed');
        } else {
          outputOpts.push('-preset', 'veryfast', '-threads', '0');
        }

        cmd.videoCodec(vCodec)
           .audioCodec('aac')
           .outputOptions(outputOpts);

        if (videoFilters.length > 0) cmd.videoFilters(videoFilters);
      } else {
        cmd.outputOptions(['-c', 'copy', '-map', '0', '-avoid_negative_ts', 'make_zero']);
      }
    }

    if (targetFormat !== 'original') cmd.toFormat(targetFormat);

    cmd
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error('FFmpeg Error:', err);
        reject(err);
      })
      .save(output);
  });
}