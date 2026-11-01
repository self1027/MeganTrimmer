// Run with ELECTRON_RUN_AS_NODE=1 using release/win-unpacked/MeganTrimmer.exe.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const archive = path.join(root, 'release/win-unpacked/resources/app.asar');
const folder = path.join(root, '.cache/package-smoke');
fs.mkdirSync(folder, { recursive: true });

(async () => {
  process.env.PATH = '';
  const fromPackage = file => import(pathToFileURL(path.join(archive, file)).href);
  const { trimVideo } = await fromPackage('dist/main/services/trim.js');
  const { getVideoInfo } = await fromPackage('dist/main/services/video-info.js');
  const { binaryPath } = await fromPackage('dist/main/services/ffmpeg.js');
  assert.ok(binaryPath.includes('app.asar.unpacked'));
  const input = path.join(folder, 'source.mp4');
  const generated = spawnSync(binaryPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', '-c:v', 'libx264', '-c:a', 'aac', input]);
  assert.equal(generated.status, 0, generated.stderr.toString());
  assert.equal((await getVideoInfo(input)).width, 1280);
  for (const format of ['original', 'mp4', 'mkv', 'avi', 'mp3', 'wav']) {
    const output = path.join(folder, `${format}-${Date.now()}.${format === 'original' ? 'mp4' : format}`);
    const progress = [];
    await trimVideo(input, output, '0.2', '1', { format, resolution: '640:480', frameRate: '24' }, event => progress.push(event));
    assert.ok(fs.statSync(output).size > 0);
    const decoded = spawnSync(binaryPath, ['-v', 'error', '-i', output, '-f', 'null', '-']);
    assert.equal(decoded.status, 0, decoded.stderr.toString());
    if (!['mp3', 'wav'].includes(format)) {
      const info = await getVideoInfo(output);
      assert.equal(info.width, 640); assert.equal(info.height, 360); assert.equal(info.frameRate, 24);
    }
    assert.equal(progress.at(-1).percent, 100);
    console.log(`PASS packaged ${format}: nonempty, decodable, bundled binaries, PATH empty`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
