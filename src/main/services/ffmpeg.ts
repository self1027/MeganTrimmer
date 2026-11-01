import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

function unpack(binary: string): string {
  return binary.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

if (!ffmpegPath) throw new Error('Binário FFmpeg indisponível.');
export const binaryPath = unpack(ffmpegPath);
ffmpeg.setFfmpegPath(binaryPath);
ffmpeg.setFfprobePath(unpack(ffprobe.path));
export default ffmpeg;
