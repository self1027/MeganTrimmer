import ffmpeg from './ffmpeg.js';
import type { VideoInfo } from '../../shared/types.js';

export function getVideoInfo(filePath: string): Promise<VideoInfo> {
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
