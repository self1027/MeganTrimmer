import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Resolve o caminho para funcionar dentro do ASAR em produção
const getCleanPath = () => {
  if (!ffmpegPath) return '';
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
};

ffmpeg.setFfmpegPath(getCleanPath());

export function trimVideo(
  input: string,
  output: string,
  start: string,
  duration: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions([`-ss ${start}`]) 
      .setDuration(duration)
      .outputOptions([
        '-c', 'copy', 
        '-map', '0',
        '-avoid_negative_ts', 'make_zero'
      ])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error('FFmpeg Error:', err);
        reject(err);
      })
      .run();
  });
}