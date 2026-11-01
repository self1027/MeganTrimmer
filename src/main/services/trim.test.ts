import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { trimVideo, selectEncoder } from './trim.js';
import { validateTrimRequest } from './validation.js';
import { getVideoInfo } from './video-info.js';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-export-test-'));
const input = path.join(folder, 'vídeo com espaços.mp4');
before(() => {
  const result = spawnSync(ffmpegPath!, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', '-c:v', 'libx264', '-c:a', 'aac', input]);
  assert.equal(result.status, 0, result.stderr.toString());
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));

test('compiled AMD support does not hide a usable NVIDIA encoder', async () => {
  const tried: string[] = [];
  const selected = await selectEncoder(['h264_amf', 'h264_nvenc', 'h264_qsv'], async name => {
    tried.push(name); return name === 'h264_nvenc';
  });
  assert.equal(selected, 'h264_nvenc');
  assert.deepEqual(tried, ['h264_amf', 'h264_nvenc']);
});

test('Intel is selected when AMD and NVIDIA probes fail; no GPU uses software', async () => {
  const available = ['h264_amf', 'h264_nvenc', 'h264_qsv'];
  assert.equal(await selectEncoder(available, async name => name === 'h264_qsv'), 'h264_qsv');
  assert.equal(await selectEncoder(available, async () => false), 'libx264');
});

for (const format of ['mp4', 'mkv', 'avi', 'mp3', 'wav']) {
  test(`exports and decodes ${format} from the UI payload`, async () => {
    const output = path.join(folder, `result.${format}`);
    await trimVideo(input, output, '0.2', '1', { format });
    assert.ok(fs.statSync(output).size > 0);
    const result = spawnSync(ffmpegPath!, ['-v', 'error', '-i', output, '-f', 'null', '-']);
    assert.equal(result.status, 0, result.stderr.toString());
    if (format === 'wav' || format === 'mp3') {
      const info = spawnSync(ffmpegPath!, ['-hide_banner', '-i', output], { encoding: 'utf8' }).stderr;
      assert.match(info, format === 'wav' ? /Audio: pcm_s16le/ : /Audio: mp3/);
      assert.doesNotMatch(info, /Video:/);
    }
  });
}

test('a hardware export failure retries with software and publishes no partial file', async () => {
  const output = path.join(folder, 'fallback.mp4');
  const original = ffmpeg.prototype.videoCodec;
  const originalSpawn = childProcess.spawn;
  const originalAvailable = ffmpeg.getAvailableEncoders;
  const phases: string[] = [];
  // Simulate a successful GPU probe even on software-only CI, then fail its real encode.
  childProcess.spawn = ((...args: Parameters<typeof childProcess.spawn>) => {
    if (args[1]?.includes('color=size=128x128:rate=30')) {
      const child = new EventEmitter();
      process.nextTick(() => child.emit('close', 0));
      return child;
    }
    return originalSpawn(...args);
  }) as typeof childProcess.spawn;
  syncBuiltinESMExports();
  ffmpeg.getAvailableEncoders = callback => originalAvailable((error, encoders) => callback(error, {
    ...encoders, h264_amf: encoders.libx264,
  }));
  let softwareAttempts = 0;
  ffmpeg.prototype.videoCodec = function (codec: string) {
    if (codec === 'libx264') softwareAttempts++;
    return original.call(this, codec === 'libx264' ? codec : 'unavailable_hardware');
  };
  try {
    const isolated = await import(new URL('./trim.js?fallback-test', import.meta.url).href) as typeof import('./trim.js');
    await isolated.trimVideo(input, output, '0', '1', { resolution: '160:120', frameRate: '24' }, progress => phases.push(progress.phase));
    assert.ok(fs.statSync(output).size > 0);
    assert.equal(softwareAttempts, 1);
    assert.ok(phases.includes('fallback'));
    assert.equal(fs.readdirSync(folder).filter(name => name.includes('.partial')).length, 0);
  } finally {
    ffmpeg.prototype.videoCodec = original;
    ffmpeg.getAvailableEncoders = originalAvailable;
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
  }
});

test('never replaces an existing destination', async () => {
  const output = path.join(folder, 'protected.mp4');
  fs.writeFileSync(output, 'keep me');
  await assert.rejects(trimVideo(input, output, '0', '1', {}));
  assert.equal(fs.readFileSync(output, 'utf8'), 'keep me');
  assert.equal(fs.readdirSync(folder).filter(name => name.includes('.partial')).length, 0);
});

test('exports to filesystems without hard-link support', async () => {
  const output = path.join(folder, 'external-drive.mp4');
  const original = fs.linkSync;
  fs.linkSync = () => { throw Object.assign(new Error('Hard links unavailable'), { code: 'EPERM' }); };
  try {
    await trimVideo(input, output, '0', '1', {});
    assert.ok(fs.statSync(output).size > 0);
  } finally { fs.linkSync = original; }
});

test('MP4 captions are preserved when exporting MKV', async () => {
  const captions = path.join(folder, 'captions.srt');
  const captioned = path.join(folder, 'captioned.mp4');
  const output = path.join(folder, 'captioned.mkv');
  fs.writeFileSync(captions, '1\n00:00:00,000 --> 00:00:01,500\nTest caption\n');
  const created = spawnSync(ffmpegPath!, ['-v', 'error', '-i', input, '-i', captions, '-c', 'copy', '-c:s', 'mov_text', captioned]);
  assert.equal(created.status, 0, created.stderr.toString());
  await trimVideo(captioned, output, '0', '1', { format: 'mkv' });
  const decoded = spawnSync(ffmpegPath!, ['-v', 'error', '-i', output, '-map', '0:s:0', '-f', 'srt', '-'], { encoding: 'utf8' });
  assert.equal(decoded.status, 0, decoded.stderr);
  assert.match(decoded.stdout, /Test caption/);
});

for (const [label, options, width, height, fps] of [
  ['fps', { frameRate: '24' }, 320, 240, 24],
  ['resolution', { resolution: '160:120' }, 160, 120, 30],
  ['combined', { resolution: '160:120', frameRate: '24' }, 160, 120, 24],
] as const) {
  test(`original container with changed ${label} remains decodable`, async () => {
    const output = path.join(folder, `${label}.mp4`);
    await trimVideo(input, output, '0.25', '1', options);
    const info = await getVideoInfo(output);
    assert.equal(info.width, width); assert.equal(info.height, height); assert.equal(info.frameRate, fps);
    assert.ok(Math.abs(info.duration - 1) < 0.15, String(info.duration));
    const result = spawnSync(ffmpegPath!, ['-v', 'error', '-i', output, '-f', 'null', '-']);
    assert.equal(result.status, 0, result.stderr.toString());
  });
}

test('main validation rejects invalid options and intervals', async () => {
  const valid = { input, start: '0', duration: '1', format: 'mp4' };
  await validateTrimRequest(valid);
  for (const patch of [{ frameRate: '30,evil' }, { resolution: '1:1' }, { format: '../mp4' },
    { start: '-1' }, { start: 'NaN' }, { duration: 'Infinity' }, { duration: '0' }, { duration: '3' },
    { input: folder }, { input: 'relative.mp4' }]) {
    await assert.rejects(validateTrimRequest({ ...valid, ...patch }));
  }
});
